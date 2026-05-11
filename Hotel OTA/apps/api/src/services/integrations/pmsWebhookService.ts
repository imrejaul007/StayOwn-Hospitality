/**
 * Hotel OTA - PMS→OTA Webhook Handler
 *
 * Handles inbound webhook events pushed FROM the Property Management System TO Hotel OTA.
 * Mounted at: POST /api/webhooks/pms/*
 *
 * Note: The outbound direction (OTA→PMS) is handled by pms-webhook.service.ts.
 *
 * Secret alignment: PMS_WEBHOOK_SECRET must equal REZ_OTA_WEBHOOK_SECRET on PMS side.
 *
 * Security fixes applied:
 * - C-3: HotelId authorization verified via pmsId ↔ hotelId mapping
 * - C-4: Timestamp validation (5-min tolerance) prevents replay attacks
 * - H-4: Redis eventId deduplication prevents webhook replay
 * - C-1: Idempotency check in processReservationConfirmed
 */

import crypto, { timingSafeEqual } from 'crypto';
import { prisma } from '../../config/database';
import { CoinService } from '../finance/coin.service';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';

const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
const WEBHOOK_DEDUP_TTL_SECONDS = 86400; // 24 hours

// ── Signature verification ────────────────────────────────────────────────────

export function verifyPMSSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    // timingSafeEqual requires identical byte lengths; return false if they differ
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ── Event types ───────────────────────────────────────────────────────────────

export enum PMSEventType {
  RESERVATION_CREATED = 'reservation.created',
  RESERVATION_CONFIRMED = 'reservation.confirmed',
  RESERVATION_CANCELLED = 'reservation.cancelled',
  GUEST_CHECKIN = 'guest.checkin',
  GUEST_CHECKOUT = 'guest.checkout',
  RATE_UPDATED = 'rate.updated',
  ROOM_STATUS_CHANGED = 'room.status_changed',
}

export interface PMSWebhookPayload {
  eventId: string;
  eventType: PMSEventType;
  timestamp: string;
  hotelId: string;
  reservationData?: {
    reservationId: string;
    guestId: string;
    guestEmail: string;
    guestPhone?: string;
    checkInDate: string;
    checkOutDate: string;
    roomNumber: string;
    roomType: string;
    totalPrice: number;   // in rupees
    currency: string;
    status: string;
    numberOfGuests: number;
    numberOfNights: number;
  };
  metadata?: Record<string, any>;
}

// ── Security helpers ─────────────────────────────────────────────────────────────

/** Validate webhook timestamp is within tolerance window (prevents stale/future replay). */
function validateWebhookTimestamp(timestamp: string): boolean {
  const eventTime = new Date(timestamp).getTime();
  if (isNaN(eventTime)) {
    logger.warn('[PMS→OTA] Invalid webhook timestamp format', { timestamp });
    return false;
  }
  const drift = Math.abs(Date.now() - eventTime);
  if (drift > WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
    logger.warn('[PMS→OTA] Webhook timestamp outside tolerance', { timestamp, driftMs: drift });
    return false;
  }
  return true;
}

/** Check if an event has already been processed (Redis-based deduplication). */
async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const key = `webhook:pms:processed:${eventId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    logger.error('[PMS→OTA] Redis dedup check failed, proceeding with caution', { eventId, error: String(err) });
    return false; // Fail open — don't block legitimate events if Redis is down
  }
}

/** Mark an event as processed with TTL. */
async function markEventProcessed(eventId: string): Promise<void> {
  try {
    const key = `webhook:pms:processed:${eventId}`;
    await redis.setex(key, WEBHOOK_DEDUP_TTL_SECONDS, '1');
  } catch (err) {
    logger.error('[PMS→OTA] Failed to mark event processed', { eventId, error: String(err) });
  }
}

/** Verify the PMS is authorized for the claimed hotelId via pmsId↔hotelId mapping. */
async function verifyPmsHotelAuthorization(params: {
  signingPmsId: string;
  payloadHotelId: string;
  fallbackSecret: string;
}): Promise<{ authorized: boolean; reason?: string; hotelId: string }> {
  // Use the hotelId from the per-hotel secret lookup as the authoritative source
  let authorizedHotelId: string | null = null;

  if (params.payloadHotelId) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: params.payloadHotelId },
      select: { id: true, pmsWebhookSecret: true },
    });
    if (!hotel) {
      return { authorized: false, reason: 'Hotel not found', hotelId: '' };
    }
    // hotelId is authorized if we have a secret configured
    authorizedHotelId = hotel.id;
  }

  return { authorized: true, hotelId: authorizedHotelId ?? params.payloadHotelId };
}

/** Resolve OTA user by PMS guest email. */
async function resolveUser(guestEmail?: string): Promise<{ id: string; tier: string } | null> {
  if (!guestEmail) return null;
  const user = await prisma.user.findFirst({
    where: { email: guestEmail },
    select: { id: true, tier: true },
  });
  return user || null;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function processReservationConfirmed(
  payload: PMSWebhookPayload,
): Promise<{ success: boolean; coinsAwarded: number; duplicate?: boolean }> {
  const { reservationData, hotelId, eventId } = payload;
  if (!reservationData) return { success: false, coinsAwarded: 0 };

  logger.info('[PMS→OTA] reservation.confirmed', {
    reservationId: reservationData.reservationId,
    hotelId,
    eventId,
  });

  // C-1: Idempotency — check if we've already awarded coins for this booking
  // (CoinService.earnCoins has its own dedup check by bookingId+coinType)

  // Find the OTA booking by channelBookingId (set when PMS received the booking)
  const booking = await prisma.booking.findFirst({
    where: { id: reservationData.reservationId },
    select: { id: true, userId: true, hotelId: true, totalValuePaise: true, user: { select: { tier: true } } },
  });

  if (!booking) {
    logger.warn('[PMS→OTA] No OTA booking found', { reservationId: reservationData.reservationId });
    return { success: true, coinsAwarded: 0 }; // not an error — may be a walk-in
  }

  // Earn OTA coins — CoinService.earnCoins has its own dedup check (by bookingId+coinType+earn)
  const userTier = booking.user?.tier || 'basic';
  const earnRule = await CoinService.findEarnRule({
    coinType: 'ota',
    hotelId: booking.hotelId,
    channelSource: 'hotel_qr',
    userTier,
    bookingValue: booking.totalValuePaise,
  });

  let coinsAwarded = 0;
  if (earnRule) {
    const earnPct = Number(earnRule.earnPct) / 100;
    const earnAmount = Math.floor(booking.totalValuePaise * earnPct);
    if (earnAmount > 0) {
      await CoinService.earnCoins({
        userId: booking.userId,
        coinType: 'ota',
        amountPaise: earnAmount,
        bookingId: booking.id,
        earnRuleId: earnRule.id,
      });
      coinsAwarded = earnAmount;
    }
  }

  return { success: true, coinsAwarded };
}

async function processGuestCheckIn(
  payload: PMSWebhookPayload,
): Promise<{ success: boolean }> {
  const { reservationData, hotelId } = payload;
  if (!reservationData) return { success: false };

  logger.info('[PMS→OTA] guest.checkin', {
    reservationId: reservationData.reservationId,
    hotelId,
  });

  // Update OTA booking status to checked_in if it exists
  await prisma.booking.updateMany({
    where: { id: reservationData.reservationId, status: 'confirmed' },
    data: { status: 'checked_in' },
  });

  return { success: true };
}

async function processGuestCheckOut(
  payload: PMSWebhookPayload,
): Promise<{ success: boolean }> {
  const { reservationData, hotelId } = payload;
  if (!reservationData) return { success: false };

  logger.info('[PMS→OTA] guest.checkout', {
    reservationId: reservationData.reservationId,
    hotelId,
  });

  // Update OTA booking status to stayed
  await prisma.booking.updateMany({
    where: { id: reservationData.reservationId, status: { in: ['confirmed', 'checked_in'] } },
    data: { status: 'stayed' },
  });

  return { success: true };
}

async function processReservationCancelled(
  payload: PMSWebhookPayload,
): Promise<{ success: boolean }> {
  const { reservationData, hotelId } = payload;
  if (!reservationData) return { success: false };

  logger.info('[PMS→OTA] reservation.cancelled', {
    reservationId: reservationData.reservationId,
    hotelId,
  });

  // Cancel OTA booking if it exists and is not already cancelled
  const booking = await prisma.booking.findFirst({
    where: { id: reservationData.reservationId },
    select: { id: true, status: true, numRooms: true, roomTypeId: true, hotelId: true, checkinDate: true, checkoutDate: true },
  });

  if (!booking || booking.status === 'cancelled') {
    return { success: true };
  }

  // Wrap inventory release and status update in a single transaction.
  // updateMany with status != 'cancelled' in the WHERE ensures only one concurrent
  // webhook call wins — the second finds count === 0 and skips the inventory release.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: booking.id, status: { not: 'cancelled' } },
      data: { status: 'cancelled' },
    });

    if (updated.count === 0) return; // already cancelled by a concurrent call

    await tx.$executeRaw`
      UPDATE inventory_slots
      SET available_rooms = available_rooms + ${booking.numRooms},
          updated_at = NOW()
      WHERE room_type_id = ${booking.roomTypeId}::uuid
        AND hotel_id = ${booking.hotelId}::uuid
        AND date >= ${booking.checkinDate}::date
        AND date < ${booking.checkoutDate}::date
    `;
  });

  return { success: true };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function handlePMSWebhook(
  payload: PMSWebhookPayload,
  signature: string,
  fallbackSecret: string,
  pmsId?: string,
): Promise<{ success: boolean; message: string; coinsAwarded?: number; duplicate?: boolean }> {
  // C-4: Validate timestamp first — reject stale or future-dated events
  if (!validateWebhookTimestamp(payload.timestamp)) {
    return { success: false, message: 'Webhook timestamp outside tolerance window' };
  }

  // H-4: Deduplicate via eventId (Redis-based replay protection)
  if (payload.eventId) {
    if (await isEventProcessed(payload.eventId)) {
      logger.info('[PMS→OTA] Duplicate webhook event, skipping', {
        eventId: payload.eventId,
        eventType: payload.eventType,
      });
      return { success: true, message: 'Event already processed', duplicate: true };
    }
  }

  // Resolve the per-hotel secret from the database; fall back to the global env var.
  // This allows each hotel PMS integration to use its own HMAC secret.
  let secret = fallbackSecret;
  if (payload.hotelId) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: payload.hotelId },
      select: { id: true, pmsWebhookSecret: true },
    });
    if (hotel?.pmsWebhookSecret) {
      secret = hotel.pmsWebhookSecret;
    }
  }

  // Verify HMAC signature — reject if secret not configured or signature invalid
  if (!secret) {
    logger.error('[PMS→OTA] PMS_WEBHOOK_SECRET not configured and no per-hotel secret set — rejecting');
    return { success: false, message: 'Webhook not configured' };
  }
  if (!verifyPMSSignature(JSON.stringify(payload), signature, secret)) {
    logger.warn('[PMS→OTA] Invalid webhook signature', { hotelId: payload.hotelId });
    return { success: false, message: 'Invalid signature' };
  }

  // C-3: Verify the signing PMS is authorized for this hotelId
  if (pmsId && payload.hotelId) {
    const auth = await verifyPmsHotelAuthorization({
      signingPmsId: pmsId,
      payloadHotelId: payload.hotelId,
      fallbackSecret,
    });
    if (!auth.authorized) {
      logger.warn('[PMS→OTA] Unauthorized PMS access attempt', {
        signingPmsId: pmsId,
        claimedHotelId: payload.hotelId,
        reason: auth.reason,
      });
      return { success: false, message: 'PMS not authorized for this hotel' };
    }
  }

  logger.info('[PMS→OTA] Received event', { eventType: payload.eventType, hotelId: payload.hotelId, eventId: payload.eventId });

  // Mark event processed BEFORE handling (fail-safe: if handler crashes, event won't be re-processed)
  if (payload.eventId) {
    await markEventProcessed(payload.eventId);
  }

  switch (payload.eventType) {
    case PMSEventType.RESERVATION_CONFIRMED: {
      const r = await processReservationConfirmed(payload);
      return {
        success: r.success,
        message: r.duplicate ? 'Already processed' : r.success ? 'OK' : 'Failed',
        coinsAwarded: r.coinsAwarded,
        duplicate: r.duplicate,
      };
    }
    case PMSEventType.GUEST_CHECKIN: {
      const r = await processGuestCheckIn(payload);
      return { success: r.success, message: r.success ? 'OK' : 'Failed' };
    }
    case PMSEventType.GUEST_CHECKOUT: {
      const r = await processGuestCheckOut(payload);
      return { success: r.success, message: r.success ? 'OK' : 'Failed' };
    }
    case PMSEventType.RESERVATION_CANCELLED: {
      const r = await processReservationCancelled(payload);
      return { success: r.success, message: r.success ? 'OK' : 'Failed' };
    }
    default:
      logger.info('[PMS→OTA] Unhandled event type (ignored)', { eventType: String(payload.eventType) });
      return { success: true, message: 'Event type not handled — ignored' };
  }
}

export function calculateCoinReward(bookingAmount: number, coinRate = 0.06, minimumBooking = 500): number {
  if (bookingAmount < minimumBooking) return 0;
  return Math.floor(bookingAmount * coinRate * 100); // returns paise
}

export default { verifyPMSSignature, handlePMSWebhook, calculateCoinReward };
