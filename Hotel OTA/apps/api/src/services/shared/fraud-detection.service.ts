/**
 * FraudDetectionService
 *
 * Rule-based fraud and risk detection for bookings, coin operations, and
 * stay registrations.  No ML — purely heuristic/threshold logic.
 *
 * Risk scores are 0–100 (higher = riskier).
 * Actions:
 *   allow   — proceed normally
 *   review  — flag for manual review, allow but log
 *   block   — reject the operation
 *
 * Risk events are stored as raw SQL inserts into the `risk_events` table
 * (not in the Prisma schema yet — the INSERT is done via $executeRaw so it
 * works as soon as the table exists; meanwhile it fails silently so it never
 * blocks the happy path).
 *
 * CREATE TABLE IF NOT EXISTS risk_events (
 *   id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id        UUID,
 *   hotel_id       UUID,
 *   event_type     VARCHAR(100) NOT NULL,
 *   risk_score     SMALLINT    NOT NULL,
 *   details        JSONB,
 *   created_at     TIMESTAMPTZ DEFAULT NOW()
 * );
 */

import dayjs from 'dayjs';
import { prisma } from '../../config/database';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max coin-burn bookings a user may make per calendar day. */
const BURN_RATE_LIMIT_PER_DAY = 3;

/** If a user account is younger than this many days, risk score rises. */
const NEW_ACCOUNT_THRESHOLD_DAYS = 7;

/** High velocity: more than this many bookings in a rolling 24-h window. */
const HIGH_VELOCITY_BOOKINGS_24H = 5;

/** Coin farming: same IP submitting more than this many stay regs in 1 hour. */
const STAY_REG_IP_LIMIT_1H = 3;

/** Recency window for stay registration receipts (older = suspicious). */
const RECEIPT_MAX_AGE_DAYS = 30;

/** Inventory churn: more than this many block/unblock cycles in 7 days = suspicious. */
const INVENTORY_CHURN_THRESHOLD_7D = 10;

/** Self-booking: confidence threshold above which we block. */
const SELF_BOOKING_BLOCK_CONFIDENCE = 0.85;

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskAction = 'allow' | 'review' | 'block';

export interface BookingRiskResult {
  score: number;
  flags: string[];
  action: RiskAction;
}

export interface CoinFarmingResult {
  isSuspicious: boolean;
  reasons: string[];
}

export interface StayRegistrationValidation {
  valid: boolean;
  flags: string[];
}

export interface InventoryManipulationResult {
  suspicious: boolean;
  patterns: string[];
}

export interface SelfBookingResult {
  isSelfBooking: boolean;
  confidence: number;
  reasons: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class FraudDetectionService {
  /**
   * Calculate composite risk score for a booking attempt.
   *
   * Factors:
   *   - Account age (new accounts are riskier)
   *   - Booking velocity in the last 24 h
   *   - Coin usage pattern (large burn on a new account)
   *   - Self-booking detection
   *
   * Device fingerprint and IP history require client-side collection and are
   * accepted as optional fields in `bookingParams`.
   */
  static async calculateBookingRisk(
    userId: string,
    bookingParams: {
      hotelId?: string;
      totalValuePaise?: number;
      otaCoinBurnPaise?: number;
      rezCoinBurnPaise?: number;
      deviceId?: string;
      ipAddress?: string;
    },
  ): Promise<BookingRiskResult> {
    const flags: string[] = [];
    let score = 0;

    const [user, recentBookings, wallet] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, createdAt: true, tier: true },
      }),
      prisma.booking.findMany({
        where: {
          userId,
          createdAt: { gte: dayjs().subtract(24, 'hour').toDate() },
        },
        select: { id: true, status: true, otaCoinBurnedPaise: true },
      }),
      prisma.coinWallet.findUnique({
        where: { userId },
        select: { otaCoinBalancePaise: true, otaCoinLifetimeBurnedPaise: true },
      }),
    ]);

    if (!user) {
      return { score: 100, flags: ['USER_NOT_FOUND'], action: 'block' };
    }

    // ── Factor 1: Account age ──
    const accountAgeDays = dayjs().diff(dayjs(user.createdAt), 'day');
    if (accountAgeDays < NEW_ACCOUNT_THRESHOLD_DAYS) {
      score += 20;
      flags.push(`NEW_ACCOUNT_${accountAgeDays}d`);
    }

    // ── Factor 2: Booking velocity ──
    const recentCount = recentBookings.length;
    if (recentCount >= HIGH_VELOCITY_BOOKINGS_24H) {
      score += 30;
      flags.push(`HIGH_VELOCITY_${recentCount}_IN_24H`);
    } else if (recentCount >= 3) {
      score += 10;
      flags.push(`ELEVATED_VELOCITY_${recentCount}_IN_24H`);
    }

    // ── Factor 3: Coin usage on a brand-new account ──
    const coinBurn = (bookingParams.otaCoinBurnPaise ?? 0) + (bookingParams.rezCoinBurnPaise ?? 0);
    if (coinBurn > 0 && accountAgeDays < NEW_ACCOUNT_THRESHOLD_DAYS) {
      score += 25;
      flags.push('COIN_BURN_ON_NEW_ACCOUNT');
    }

    // Large relative burn (burning >30% of booking value on first booking)
    if (
      coinBurn > 0 &&
      bookingParams.totalValuePaise &&
      coinBurn / bookingParams.totalValuePaise > 0.3 &&
      wallet?.otaCoinLifetimeBurnedPaise === 0
    ) {
      score += 15;
      flags.push('FIRST_BURN_HIGH_RATIO');
    }

    // ── Factor 4: Self-booking check (if hotelId available) ──
    if (bookingParams.hotelId) {
      const selfResult = await FraudDetectionService.detectSelfBooking(
        userId,
        bookingParams.hotelId,
      );
      if (selfResult.isSelfBooking) {
        const selfScore = Math.round(selfResult.confidence * 40);
        score += selfScore;
        flags.push(...selfResult.reasons.map((r) => `SELF_BOOKING:${r}`));
      }
    }

    // Cap at 100
    score = Math.min(100, score);

    const action: RiskAction = score >= 80 ? 'block' : score >= 40 ? 'review' : 'allow';

    // Log asynchronously — never block the booking flow
    FraudDetectionService.logRiskEvent({
      userId,
      hotelId: bookingParams.hotelId,
      eventType: 'booking_risk_check',
      riskScore: score,
      details: { flags, action, accountAgeDays, recentBookings24h: recentCount, coinBurn },
    }).catch((err: unknown) => { console.warn('[FraudDetection] operation failed', { err }); });

    return { score, flags, action };
  }

  /**
   * Detect coin farming — users creating multiple accounts to exploit
   * referral/earn bonuses.
   *
   * Checks:
   *   - Multiple referral codes redeemed from same phone prefix pattern
   *   - User referred by someone with the same phone number prefix
   *   - Short interval between account creation and first coin earn
   *   - Referral chain depth > 2 (A refers B refers C — circular pattern)
   */
  static async detectCoinFarming(userId: string): Promise<CoinFarmingResult> {
    const reasons: string[] = [];

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, createdAt: true },
    });
    if (!user) return { isSuspicious: false, reasons: [] };

    // ── Check 1: First coin earn < 10 minutes after account creation ──
    const firstEarn = await prisma.coinTransaction.findFirst({
      where: { userId, transactionType: 'earn' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    if (firstEarn) {
      const minutesSinceCreation = dayjs(firstEarn.createdAt).diff(
        dayjs(user.createdAt),
        'minute',
      );
      if (minutesSinceCreation < 10) {
        reasons.push('EARN_WITHIN_10MIN_OF_SIGNUP');
      }
    }

    // ── Check 2: Same user referred by someone with same phone prefix ──
    // This catches family/shared-device scenarios where one person controls
    // multiple numbers, e.g. 98765_XXXX pattern.
    const phonePrefix = user.phone.slice(0, 7);
    const referralRecord = await prisma.referral.findFirst({
      where: { referredUserId: userId },
      select: { referrerId: true },
    });

    if (referralRecord) {
      const referrer = await prisma.user.findUnique({
        where: { id: referralRecord.referrerId },
        select: { phone: true },
      });
      if (referrer && referrer.phone.startsWith(phonePrefix)) {
        reasons.push('REFERRER_SAME_PHONE_PREFIX');
      }
    }

    // ── Check 3: User has referred more than 5 accounts in the last 30 days ──
    const recentReferrals = await prisma.referral.count({
      where: {
        referrerId: userId,
        createdAt: { gte: dayjs().subtract(30, 'day').toDate() },
      },
    });
    if (recentReferrals > 5) {
      reasons.push(`HIGH_REFERRAL_RATE_${recentReferrals}_IN_30D`);
    }

    // ── Check 4: Referral chain depth (A referred by B, B referred by C
    //            where A and C share data) ──
    // Simple depth check — a 3-hop chain starting from this user
    const chainDepth = await FraudDetectionService._referralChainDepth(userId, 0);
    if (chainDepth >= 3) {
      reasons.push(`DEEP_REFERRAL_CHAIN_DEPTH_${chainDepth}`);
    }

    const isSuspicious = reasons.length > 0;

    if (isSuspicious) {
      FraudDetectionService.logRiskEvent({
        userId,
        eventType: 'coin_farming_detection',
        riskScore: Math.min(100, reasons.length * 25),
        details: { reasons },
      }).catch((err: unknown) => { console.warn('[FraudDetection] operation failed', { err }); });
    }

    return { isSuspicious, reasons };
  }

  /**
   * Validate a stay registration for fraud signals before awarding coins.
   *
   * Checks:
   *   - Same user already registered a stay at this hotel on the same date
   *   - Receipt date is older than 30 days
   *   - More than STAY_REG_IP_LIMIT_1H registrations from the same IP in 1 h
   *   - Low OCR confidence score (when extracted data is available)
   */
  static async validateStayRegistration(
    userId: string,
    hotelId: string,
    stayDate: string,
    meta?: { ipAddress?: string; ocrConfidence?: number },
  ): Promise<StayRegistrationValidation> {
    const flags: string[] = [];

    const stayDateObj = dayjs(stayDate);

    // ── Check 1: Duplicate registration (same user, hotel, date) ──
    const duplicate = await prisma.stayRegistration.findFirst({
      where: {
        userId,
        hotelId,
        stayDate: stayDateObj.toDate(),
        verificationStatus: { in: ['pending', 'approved'] },
      },
      select: { id: true },
    });
    if (duplicate) {
      flags.push('DUPLICATE_STAY_REGISTRATION');
    }

    // ── Check 2: Receipt too old ──
    const ageInDays = dayjs().diff(stayDateObj, 'day');
    if (ageInDays > RECEIPT_MAX_AGE_DAYS) {
      flags.push(`RECEIPT_TOO_OLD_${ageInDays}d`);
    }

    // Future-dated stays are also invalid
    if (stayDateObj.isAfter(dayjs(), 'day')) {
      flags.push('FUTURE_STAY_DATE');
    }

    // ── Check 3: High-frequency from same IP in past 1 h ──
    if (meta?.ipAddress) {
      // We store IP in ocrExtractedData.meta if the client sends it
      const recentFromIp = await prisma.stayRegistration.count({
        where: {
          createdAt: { gte: dayjs().subtract(1, 'hour').toDate() },
          ocrExtractedData: {
            path: ['meta', 'ipAddress'],
            equals: meta.ipAddress,
          },
        },
      });
      if (recentFromIp >= STAY_REG_IP_LIMIT_1H) {
        flags.push(`HIGH_FREQUENCY_FROM_IP_${recentFromIp}_IN_1H`);
      }
    }

    // ── Check 4: Low OCR confidence ──
    if (meta?.ocrConfidence !== undefined && meta.ocrConfidence < 0.6) {
      flags.push(`LOW_OCR_CONFIDENCE_${Math.round(meta.ocrConfidence * 100)}pct`);
    }

    const valid = flags.length === 0;

    if (!valid) {
      FraudDetectionService.logRiskEvent({
        userId,
        hotelId,
        eventType: 'stay_registration_fraud',
        riskScore: Math.min(100, flags.length * 30),
        details: { flags, stayDate },
      }).catch((err: unknown) => { console.warn('[FraudDetection] operation failed', { err }); });
    }

    return { valid, flags };
  }

  /**
   * Detect hotel inventory manipulation:
   *   - Sustained blocking (>80% of a week blocked) then sudden unblock
   *   - Rapid block/unblock cycling (churning) in short periods
   *   - Blocking correlates with detected high-demand periods
   *
   * This relies on booking_events and inventory_slots history.
   * For now we detect churn via raw SQL on inventory_slots update timestamps.
   */
  static async detectInventoryManipulation(hotelId: string): Promise<InventoryManipulationResult> {
    const patterns: string[] = [];

    const sevenDaysAgo = dayjs().subtract(7, 'day').toDate();

    // ── Pattern 1: High block ratio in the past 7 days ──
    const [totalSlots, blockedSlots] = await Promise.all([
      prisma.inventorySlot.count({
        where: {
          hotelId,
          date: { gte: sevenDaysAgo },
        },
      }),
      prisma.inventorySlot.count({
        where: {
          hotelId,
          date: { gte: sevenDaysAgo },
          isBlocked: true,
        },
      }),
    ]);

    if (totalSlots > 0) {
      const blockRatioPct = (blockedSlots / totalSlots) * 100;
      if (blockRatioPct >= 80) {
        patterns.push(`HIGH_BLOCK_RATIO_${Math.round(blockRatioPct)}pct_IN_7D`);
      }
    }

    // ── Pattern 2: Rapid churn — slots updated frequently (proxy for block/unblock) ──
    // Count inventory_slots rows for this hotel updated more than INVENTORY_CHURN_THRESHOLD_7D
    // times in the last 7 days (via updatedAt vs createdAt delta heuristic).
    const churnSlots = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM inventory_slots
      WHERE hotel_id = ${hotelId}::uuid
        AND updated_at >= ${sevenDaysAgo}
        AND EXTRACT(EPOCH FROM (updated_at - created_at)) < 3600
    `;
    const churnCount = Number(churnSlots[0]?.count ?? 0);
    if (churnCount >= INVENTORY_CHURN_THRESHOLD_7D) {
      patterns.push(`RAPID_CHURN_${churnCount}_SLOTS_IN_7D`);
    }

    // ── Pattern 3: Zero availability right before a high-demand period ──
    // A simple proxy: hotel has blocked slots for the next 7 days but has
    // historically shown high bookings in that window.
    const upcomingBlocked = await prisma.inventorySlot.count({
      where: {
        hotelId,
        date: {
          gte: new Date(),
          lte: dayjs().add(7, 'day').toDate(),
        },
        isBlocked: true,
      },
    });
    const upcomingTotal = await prisma.inventorySlot.count({
      where: {
        hotelId,
        date: {
          gte: new Date(),
          lte: dayjs().add(7, 'day').toDate(),
        },
      },
    });

    if (upcomingTotal > 0 && upcomingBlocked / upcomingTotal >= 0.9) {
      patterns.push('NEAR_FULL_BLOCK_UPCOMING_7D');
    }

    const suspicious = patterns.length > 0;

    if (suspicious) {
      FraudDetectionService.logRiskEvent({
        hotelId,
        eventType: 'inventory_manipulation',
        riskScore: Math.min(100, patterns.length * 35),
        details: { patterns, totalSlots, blockedSlots, churnCount },
      }).catch((err: unknown) => { console.warn('[FraudDetection] operation failed', { err }); });
    }

    return { suspicious, patterns };
  }

  /**
   * Self-booking detection for mining manipulation.
   *
   * Signals:
   *   - User is a registered HotelStaff member at this hotel
   *   - User's phone matches the hotel's primary contact phone
   *   - User has a history of bookings at this specific hotel that were
   *     cancelled shortly after confirmation (coin-earn then immediate cancel)
   *   - User created ≥3 bookings at this hotel that were all cancelled within
   *     1 hour of confirmation
   */
  static async detectSelfBooking(
    userId: string,
    hotelId: string,
  ): Promise<SelfBookingResult> {
    const reasons: string[] = [];
    let confidence = 0;

    const [user, hotel, staffRecord] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      }),
      prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { primaryContactPhone: true },
      }),
      prisma.hotelStaff.findFirst({
        where: { hotelId, isActive: true },
        // We only have hotelId + phone on HotelStaff; we join via user.phone
        select: { phone: true },
      }),
    ]);

    if (!user || !hotel) return { isSelfBooking: false, confidence: 0, reasons: [] };

    // ── Signal 1: User phone matches hotel primary contact ──
    if (hotel.primaryContactPhone && user.phone === hotel.primaryContactPhone) {
      confidence += 0.5;
      reasons.push('PHONE_MATCHES_HOTEL_CONTACT');
    }

    // ── Signal 2: User phone matches any hotel staff record ──
    if (staffRecord && user.phone === staffRecord.phone) {
      confidence += 0.5;
      reasons.push('USER_IS_HOTEL_STAFF');
    }

    // ── Signal 3: Previous bookings at this hotel cancelled within 1 hour ──
    const quickCancellations = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM bookings
      WHERE user_id   = ${userId}::uuid
        AND hotel_id  = ${hotelId}::uuid
        AND status    = 'cancelled'
        AND cancelled_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (cancelled_at - created_at)) < 3600
    `;
    const quickCancelCount = Number(quickCancellations[0]?.count ?? 0);
    if (quickCancelCount >= 2) {
      confidence += Math.min(0.4, quickCancelCount * 0.1);
      reasons.push(`QUICK_CANCEL_HISTORY_${quickCancelCount}`);
    }

    // ── Signal 4: All past bookings at hotel ended in cancellation ──
    const [totalAtHotel, cancelledAtHotel] = await Promise.all([
      prisma.booking.count({ where: { userId, hotelId } }),
      prisma.booking.count({ where: { userId, hotelId, status: 'cancelled' } }),
    ]);

    if (totalAtHotel >= 3 && totalAtHotel === cancelledAtHotel) {
      confidence += 0.3;
      reasons.push(`ALL_${totalAtHotel}_BOOKINGS_CANCELLED`);
    }

    confidence = Math.min(1.0, confidence);
    const isSelfBooking = confidence >= SELF_BOOKING_BLOCK_CONFIDENCE;

    if (isSelfBooking || confidence > 0.3) {
      FraudDetectionService.logRiskEvent({
        userId,
        hotelId,
        eventType: 'self_booking_detection',
        riskScore: Math.round(confidence * 100),
        details: { reasons, confidence },
      }).catch((err: unknown) => { console.warn('[FraudDetection] operation failed', { err }); });
    }

    return { isSelfBooking, confidence, reasons };
  }

  /**
   * Rate limiting check — max BURN_RATE_LIMIT_PER_DAY coin-burn bookings
   * per user per calendar day.
   *
   * Returns true if the user is WITHIN the limit (may proceed).
   * Returns false if the limit has been reached (must block).
   */
  static async checkBurnRateLimit(userId: string): Promise<boolean> {
    const startOfToday = dayjs().startOf('day').toDate();

    const burnBookingsToday = await prisma.booking.count({
      where: {
        userId,
        createdAt: { gte: startOfToday },
        OR: [
          { otaCoinBurnedPaise: { gt: 0 } },
          { rezCoinBurnedPaise: { gt: 0 } },
        ],
        status: { notIn: ['cancelled'] },
      },
    });

    const withinLimit = burnBookingsToday < BURN_RATE_LIMIT_PER_DAY;

    if (!withinLimit) {
      FraudDetectionService.logRiskEvent({
        userId,
        eventType: 'burn_rate_limit_exceeded',
        riskScore: 60,
        details: { burnBookingsToday, limit: BURN_RATE_LIMIT_PER_DAY },
      }).catch((err: unknown) => { console.warn('[FraudDetection] operation failed', { err }); });
    }

    return withinLimit;
  }

  /**
   * Log a risk event for audit trail.
   *
   * Uses raw SQL so this works even before the Prisma schema is migrated.
   * Any failure is swallowed — risk logging must never block the hot path.
   */
  static async logRiskEvent(params: {
    userId?: string;
    hotelId?: string;
    eventType: string;
    riskScore: number;
    details: Record<string, unknown>;
  }): Promise<void> {
    const { userId, hotelId, eventType, riskScore, details } = params;

    try {
      await prisma.$executeRaw`
        INSERT INTO risk_events (user_id, hotel_id, event_type, risk_score, details)
        VALUES (
          ${userId ? `${userId}::uuid` : null}::uuid,
          ${hotelId ? `${hotelId}::uuid` : null}::uuid,
          ${eventType},
          ${riskScore},
          ${JSON.stringify(details)}::jsonb
        )
      `;
    } catch (err) {
      // Table may not exist yet — log to console and continue
      console.warn('[FraudDetection] logRiskEvent failed (table may not exist):', err);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Recursively resolve referral chain depth for a user.
   * Caps at depth 5 to prevent infinite loops.
   */
  private static async _referralChainDepth(
    userId: string,
    depth: number,
  ): Promise<number> {
    if (depth >= 5) return depth;

    const referral = await prisma.referral.findFirst({
      where: { referredUserId: userId },
      select: { referrerId: true },
    });

    if (!referral) return depth;

    return FraudDetectionService._referralChainDepth(referral.referrerId, depth + 1);
  }
}
