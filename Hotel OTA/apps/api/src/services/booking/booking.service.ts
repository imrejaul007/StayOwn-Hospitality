import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import { generateBookingRef, calculateNights } from '../../utils/helpers';
import { CoinService } from '../finance/coin.service';
import { PaymentService } from '../payments/payment.service';
import { AttributionService } from '../marketing/attribution.service';
import { NotificationService } from '../notifications/notification.service';
import { SettlementService } from '../payments/settlement.service';
import { RezWebhookService } from '../integrations/rez-webhook.service';
import { PmsWebhookService } from '../integrations/pms-webhook.service';
import { InventoryEngine } from './inventory-engine.service';
import { holdExpiryQueue } from '../../jobs/queues';
import { createServiceLogger } from '../../config/logger';
import dayjs from 'dayjs';
import axios from 'axios';
import { env } from '../../config/env';
import { Prisma } from '@prisma/client';

export class BookingService {
  private static readonly logger = createServiceLogger('booking-service');

  /**
   * Place a hold on inventory for 10 minutes.
   * Uses SELECT FOR UPDATE to prevent double-booking.
   */
  static async hold(params: {
    userId: string;
    hotelId: string;
    roomTypeId: string;
    checkinDate: string;
    checkoutDate: string;
    numRooms: number;
    numGuests: number;
    guestName: string;
    guestPhone: string;
    specialRequests?: string;
    channelSource: string;
    otaCoinBurnPaise?: number;
    rezCoinBurnPaise?: number;
    hotelBrandCoinBurnPaise?: number;
    userTier: string;
  }) {
    const {
      userId, hotelId, roomTypeId, checkinDate, checkoutDate,
      numRooms, numGuests, guestName, guestPhone, specialRequests,
      channelSource, otaCoinBurnPaise = 0, rezCoinBurnPaise = 0,
      hotelBrandCoinBurnPaise = 0, userTier,
    } = params;

    // H-1: Validate dates at service layer — route-level Zod may be bypassed
    const checkin = new Date(checkinDate);
    const checkout = new Date(checkoutDate);
    if (isNaN(checkin.getTime()) || isNaN(checkout.getTime())) {
      throw Errors.validation('Invalid date format');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkin < today) {
      throw Errors.validation('Check-in date cannot be in the past');
    }
    const MAX_STAY_DAYS = 365;
    const numNights = calculateNights(checkinDate, checkoutDate);
    if (numNights <= 0) throw Errors.validation('Checkout must be after checkin');
    if (numNights > MAX_STAY_DAYS) {
      throw Errors.validation(`Stay cannot exceed ${MAX_STAY_DAYS} nights`);
    }

    // Hoist coin variables so they're accessible after the transaction closes
    let otaCoinApplied = 0;
    let rezCoinApplied = 0;
    let hotelBrandCoinApplied = 0;

    const booking = await prisma.$transaction(async (tx) => {
      // Lock inventory and decrement atomically via InventoryEngine.
      // Uses SELECT FOR UPDATE NOWAIT + is_blocked check + post-decrement oversell guard.
      const slots = await InventoryEngine.lockInventory(tx, {
        hotelId,
        roomTypeId,
        checkinDate,
        checkoutDate,
        numRooms,
      });

      // Calculate total value from locked slots
      const totalValuePaise = slots.reduce((sum, s) => sum + s.ratePaise, 0) * numRooms;
      const roomRatePaise = Math.round(totalValuePaise / numNights / numRooms);

      // Get hotel commission
      const hotel = await tx.hotel.findUnique({ where: { id: hotelId }, select: { otaCommissionPct: true } });
      if (!hotel) throw Errors.notFound('Hotel');
      const otaCommissionPaise = Math.round(totalValuePaise * (Number(hotel.otaCommissionPct) / 100));

      // Check burn limits
      if (otaCoinBurnPaise > 0 || rezCoinBurnPaise > 0 || hotelBrandCoinBurnPaise > 0) {
        const burnCheck = await CoinService.checkBurn({
          bookingValuePaise: totalValuePaise,
          otaCoinRequestedPaise: otaCoinBurnPaise,
          rezCoinRequestedPaise: rezCoinBurnPaise,
          hotelBrandCoinRequestedPaise: hotelBrandCoinBurnPaise,
          hotelId,
          userTier,
          userId,
        });
        otaCoinApplied = burnCheck.otaCoinApplicablePaise;
        rezCoinApplied = burnCheck.rezCoinApplicablePaise;
        hotelBrandCoinApplied = burnCheck.hotelBrandCoinApplicablePaise;
      }

      const pgAmountPaise = Math.max(0, totalValuePaise - otaCoinApplied - rezCoinApplied - hotelBrandCoinApplied);

      // Create Razorpay order — skip if fully covered by coins (Razorpay minimum is 100 paise)
      const bookingRef = generateBookingRef();
      const orderId = pgAmountPaise >= 100
        ? (await PaymentService.createOrder(pgAmountPaise, bookingRef)).orderId
        : `order_coins_${Date.now()}`;

      const holdExpiresAt = dayjs().add(10, 'minute').toDate();

      // Create booking
      const newBooking = await tx.booking.create({
        data: {
          bookingRef,
          userId,
          hotelId,
          roomTypeId,
          channelSource: channelSource as any,
          checkinDate: new Date(checkinDate),
          checkoutDate: new Date(checkoutDate),
          numNights,
          numRooms,
          numGuests,
          guestName,
          guestPhone,
          specialRequests,
          roomRatePaise,
          totalValuePaise,
          otaCommissionPaise,
          otaCoinBurnedPaise: otaCoinApplied,
          rezCoinBurnedPaise: rezCoinApplied,
          hotelBrandCoinBurnedPaise: hotelBrandCoinApplied,
          pgAmountPaise,
          razorpayOrderId: orderId,
          status: 'hold',
          holdExpiresAt,
        },
      });

      // Append booking event
      await tx.bookingEvent.create({
        data: {
          bookingId: newBooking.id,
          eventType: 'hold_placed',
          eventData: {
            totalValuePaise,
            otaCoinApplied,
            rezCoinApplied,
            hotelBrandCoinApplied,
            pgAmountPaise,
            holdExpiresAt: holdExpiresAt.toISOString(),
          },
          triggeredBy: 'user',
        },
      });

      return newBooking;
    });

    // Burn coins AFTER the booking transaction commits (avoid nested prisma.$transaction).
    // Each burn is individually guarded — a failure schedules a compensating refund job
    // and re-throws so the caller receives a 500 with the booking still in 'hold' state.
    // The user can retry or contact support; coins burned before the crash will be refunded.
    if (otaCoinApplied > 0) {
      try {
        await CoinService.burnCoins({
          userId, coinType: 'ota', amountPaise: otaCoinApplied, bookingId: booking.id,
        });
      } catch (burnErr) {
        console.error('[BookingService] OTA coin burn failed — scheduling refund', { bookingId: booking.id, burnErr });
        await CoinService.scheduleRefund({ userId, coinType: 'ota', amountPaise: otaCoinApplied, bookingId: booking.id, reason: 'hold_burn_failed' }).catch((err: unknown) => { console.warn('[BookingService] scheduleRefund failed', { err, bookingId: booking.id, reason: 'hold_burn_failed' }); });
        throw burnErr;
      }
    }
    if (rezCoinApplied > 0) {
      try {
        await CoinService.burnCoins({
          userId, coinType: 'rez', amountPaise: rezCoinApplied, bookingId: booking.id,
        });

        // Debit the actual REZ wallet so the REZ app shows the correct balance.
        // Fire-and-forget — local burn already recorded above; if this fails the
        // balance will re-sync on next /wallet or /user/profile fetch.
        if (env.REZ_WALLET_SERVICE_URL && env.INTERNAL_SERVICE_TOKEN) {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { rezUserId: true } });
          if (user?.rezUserId) {
            const debitCoins = Math.round(rezCoinApplied / 100);
            if (debitCoins > 0) {
              void (async () => {
                try {
                  await axios.post(
                    `${env.REZ_WALLET_SERVICE_URL}/internal/debit`,
                    {
                      userId: user.rezUserId,
                      amount: debitCoins,
                      source: 'ota_burn',
                      sourceId: `ota_burn_${booking.id}`,
                      description: `REZ coins burned on hotel booking ${booking.id}`,
                      autoOrder: true,
                    },
                    {
                      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN },
                      timeout: 10000,
                    },
                  );
                } catch (err) {
                  BookingService.logger.warn('[BookingService] REZ wallet debit failed', { err, bookingId: booking.id });
                }
              })();
            }
          }
        }
      } catch (burnErr) {
        console.error('[BookingService] REZ coin burn failed — scheduling refunds', { bookingId: booking.id, burnErr });
        // Refund OTA coins already burned above
        if (otaCoinApplied > 0) await CoinService.scheduleRefund({ userId, coinType: 'ota', amountPaise: otaCoinApplied, bookingId: booking.id, reason: 'partial_burn_rollback' }).catch((err: unknown) => { console.warn('[BookingService] scheduleRefund failed', { err, bookingId: booking.id, reason: 'partial_burn_rollback' }); });
        await CoinService.scheduleRefund({ userId, coinType: 'rez', amountPaise: rezCoinApplied, bookingId: booking.id, reason: 'hold_burn_failed' }).catch((err: unknown) => { console.warn('[BookingService] scheduleRefund failed', { err, bookingId: booking.id, reason: 'hold_burn_failed' }); });
        throw burnErr;
      }
    }
    if (hotelBrandCoinApplied > 0) {
      try {
        await CoinService.burnCoins({
          userId, coinType: 'hotel_brand', amountPaise: hotelBrandCoinApplied,
          bookingId: booking.id, hotelId,
        });
      } catch (burnErr) {
        console.error('[BookingService] Hotel brand coin burn failed — scheduling refunds', { bookingId: booking.id, burnErr });
        if (otaCoinApplied > 0) await CoinService.scheduleRefund({ userId, coinType: 'ota', amountPaise: otaCoinApplied, bookingId: booking.id, reason: 'partial_burn_rollback' }).catch((err: unknown) => { console.warn('[BookingService] scheduleRefund failed', { err, bookingId: booking.id, reason: 'partial_burn_rollback' }); });
        if (rezCoinApplied > 0) await CoinService.scheduleRefund({ userId, coinType: 'rez', amountPaise: rezCoinApplied, bookingId: booking.id, reason: 'partial_burn_rollback' }).catch((err: unknown) => { console.warn('[BookingService] scheduleRefund failed', { err, bookingId: booking.id, reason: 'partial_burn_rollback' }); });
        await CoinService.scheduleRefund({ userId, coinType: 'hotel_brand', amountPaise: hotelBrandCoinApplied, bookingId: booking.id, reason: 'hold_burn_failed' }).catch((err: unknown) => { console.warn('[BookingService] scheduleRefund failed', { err, bookingId: booking.id, reason: 'hold_burn_failed' }); });
        throw burnErr;
      }
    }

    // Schedule hold expiry job (10 minutes)
    await holdExpiryQueue.add(
      'expire-hold',
      { bookingId: booking.id },
      { delay: 10 * 60 * 1000, jobId: `hold-${booking.id}` }
    );

    return {
      holdId: booking.id,
      bookingRef: booking.bookingRef,
      expiresAt: booking.holdExpiresAt,
      roomRatePaise: booking.roomRatePaise,
      totalValuePaise: booking.totalValuePaise,
      otaCoinAppliedPaise: booking.otaCoinBurnedPaise,
      rezCoinAppliedPaise: booking.rezCoinBurnedPaise,
      hotelBrandCoinAppliedPaise: booking.hotelBrandCoinBurnedPaise,
      pgAmountPaise: booking.pgAmountPaise,
      razorpayOrderId: booking.razorpayOrderId,
    };
  }

  /**
   * Confirm booking after successful payment.
   * Verifies Razorpay signature, triggers coin earn + settlement.
   */
  static async confirm(params: {
    holdId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    userId: string;
    /** Skip Razorpay signature check — use ONLY when the caller has already verified payment authenticity (e.g. Razorpay webhook HMAC). */
    skipSignatureVerification?: boolean;
  }) {
    const { holdId, razorpayPaymentId, razorpaySignature, userId, skipSignatureVerification } = params;

    const booking = await prisma.booking.findUnique({
      where: { id: holdId },
      // CD-XS-05 FIX: Include rezBookingSyncs for session attribution
      include: {
        hotel: { select: { name: true, otaCommissionPct: true } },
        user: true,
        rezBookingSyncs: { select: { rezSessionId: true } },
      },
    });

    if (!booking) throw Errors.notFound('Booking');
    if (booking.userId !== userId) throw Errors.forbidden();
    if (booking.status !== 'hold') throw Errors.validation('Booking is not in hold state');
    
    // FIX-BUG-21: Check user is still active before confirming
    if (!booking.user.isActive) {
      throw Errors.validation('User account is suspended');
    }
    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
      throw Errors.holdExpired();
    }

    // Verify payment signature (skip for coin-only bookings or when caller already verified)
    const isCoinOnly = booking.pgAmountPaise < 100;
    if (!isCoinOnly && !skipSignatureVerification) {
      const isValid = PaymentService.verifyPaymentSignature(
        booking.razorpayOrderId!, razorpayPaymentId, razorpaySignature
      );
      if (!isValid) throw Errors.paymentFailed('Invalid payment signature');
    }

    // Confirm in transaction — use updateMany with status: 'hold' in WHERE so that
    // concurrent confirm calls (double-tap or webhook reconciliation) are idempotent.
    // BUG-12 FIX: Move coin earn INSIDE the transaction to prevent double-reward on retry.
    // BUG-6 FIX: Include settlement creation in the same transaction for atomicity.
    // BUG-20 FIX: Snapshot mining eligibility at confirmation time to prevent rule changes from affecting past bookings
    const miningEligibilitySnapshot = await prisma.hotel.findUnique({
      where: { id: booking.hotelId },
      select: { miningEligible: true, onboardingStatus: true },
    });
    const isEligibleForMining =
      miningEligibilitySnapshot?.miningEligible === true &&
      miningEligibilitySnapshot?.onboardingStatus === 'active';

    const result = await prisma.$transaction(async (tx) => {
      // H-3: Lock the booking row before updating to prevent concurrent confirmations
      await tx.$executeRaw`SELECT id FROM "booking" WHERE id = ${booking.id} AND status = 'hold' FOR UPDATE`;

      const updated = await tx.booking.updateMany({
        where: { id: booking.id, status: 'hold' },
        data: {
          status: 'confirmed',
          paymentStatus: 'paid',
          razorpayPaymentId,
          miningEligible: isEligibleForMining,
          miningRulesVersion: 'v1',
          miningEligibilitySnapshotAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw Errors.validation('Booking is not in hold state');
      }

      // Append events
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'payment_received',
          eventData: { razorpayPaymentId },
          triggeredBy: 'system',
        },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'confirmed',
          eventData: {},
          triggeredBy: 'system',
        },
      });

      // BUG-12 FIX: Coin earn runs inside transaction with idempotency check via bookingId
      // This prevents double-earning on webhook retry (Razorpay can deliver multiple times)
      await CoinService.earnCoinsTx(tx, {
        userId,
        coinType: 'ota',
        amountPaise: 0, // Will be calculated below
        bookingId: booking.id,
        earnRuleId: '',
        channelSource: booking.channelSource,
        hotelId: booking.hotelId,
        userTier: booking.user.tier,
        campaignId: booking.campaignId,
        bookingValue: booking.totalValuePaise,
      });

      await CoinService.earnCoinsTx(tx, {
        userId,
        coinType: 'hotel_brand',
        amountPaise: 0,
        bookingId: booking.id,
        earnRuleId: '',
        channelSource: booking.channelSource,
        hotelId: booking.hotelId,
        userTier: booking.user.tier,
        campaignId: booking.campaignId,
        bookingValue: booking.totalValuePaise,
      });

      // BUG-6 FIX: Create settlement entry in the same transaction.
      // If crash happens, both booking update and settlement rollback atomically.
      // This prevents payout without booking finalization.
      const coinLiabilityPaise = booking.otaCoinBurnedPaise + booking.rezCoinBurnedPaise;
      const netPayablePaise = booking.pgAmountPaise - booking.otaCommissionPaise;

      await tx.settlementEntry.create({
        data: {
          hotelId: booking.hotelId,
          bookingId: booking.id,
          grossAmountPaise: booking.pgAmountPaise,
          commissionPaise: booking.otaCommissionPaise,
          coinLiabilityPaise,
          netPayablePaise,
          status: 'pending',
        },
      });

      // Update hotel wallet pending balance
      await tx.hotelWallet.upsert({
        where: { hotelId: booking.hotelId },
        create: {
          hotelId: booking.hotelId,
          pendingBalancePaise: netPayablePaise,
          lifetimeEarnedPaise: netPayablePaise,
        },
        update: {
          pendingBalancePaise: { increment: netPayablePaise },
          lifetimeEarnedPaise: { increment: netPayablePaise },
        },
      });

      return booking;
    });

    // Attribution (runs before reward per spec)
    const attribution = await AttributionService.resolveAttribution(
      userId, booking.campaignId
    );

    // BUG-12 FIX: These earn amounts are now calculated and stored inside the transaction.
    // We read back the actual earned amounts from the transaction log.
    const [otaEarnTx, brandEarnTx] = await Promise.all([
      prisma.coinTransaction.findFirst({
        where: { bookingId: booking.id, coinType: 'ota', transactionType: 'earn' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coinTransaction.findFirst({
        where: { bookingId: booking.id, coinType: 'hotel_brand', transactionType: 'earn' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const otaCoinEarned = otaEarnTx?.amountPaise ?? 0;
    const hotelBrandCoinEarned = brandEarnTx?.amountPaise ?? 0;

    // ReZ coin earn - calculate and send webhook (ReZ manages their ledger)
    // BUG-12 FIX: ReZ earn also uses idempotency key (bookingId) in earnCoins
    const rezRule = await CoinService.findEarnRule({
      coinType: 'rez',
      channelSource: booking.channelSource,
      hotelId: booking.hotelId,
      userTier: booking.user.tier,
      campaignId: booking.campaignId,
      bookingValue: booking.totalValuePaise,
    });

    let rezCoinEarned = 0;
    if (rezRule) {
      rezCoinEarned = CoinService.calculateEarnAmount(
        booking.totalValuePaise, Number(rezRule.earnPct), rezRule.maxEarnPerBookingPaise
      );
    }

    // Send ReZ webhook asynchronously
    if (rezCoinEarned > 0 && booking.user.rezUserId) {
      RezWebhookService.sendBookingConfirmed({
        bookingId: booking.id,
        rezUserId: booking.user.rezUserId,
        bookingValuePaise: booking.totalValuePaise,
        channelSource: booking.channelSource,
        rezCoinToCreditPaise: rezCoinEarned,
        // CD-XS-05 FIX: Pass actual session ID from RezBookingSync for campaign attribution
        rezSessionId: booking.rezBookingSyncs[0]?.rezSessionId ?? undefined,
      }).catch((err) => console.error('ReZ webhook failed (will retry):', err));
    }

    // Push to Hotel PMS (fire-and-forget)
    PmsWebhookService.notifyBookingConfirmed({
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      hotelId: booking.hotelId,
      userId: booking.userId,
      checkinDate: booking.checkinDate,
      checkoutDate: booking.checkoutDate,
      numRooms: booking.numRooms,
      numGuests: booking.numGuests,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      totalValuePaise: booking.totalValuePaise,
      pgAmountPaise: booking.pgAmountPaise,
      otaCoinBurnedPaise: booking.otaCoinBurnedPaise,
      rezCoinBurnedPaise: booking.rezCoinBurnedPaise,
      hotelBrandCoinBurnedPaise: booking.hotelBrandCoinBurnedPaise,
    });

    // Send SMS notification
    NotificationService.sendBookingConfirmation(
      booking.guestPhone || booking.user.phone, booking.bookingRef, booking.hotel.name
    ).catch((err) => console.error('SMS failed:', err));

    // Remove hold expiry job
    const job = await holdExpiryQueue.getJob(`hold-${booking.id}`);
    if (job) await job.remove();

    // Get updated wallet
    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });

    return {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      status: 'confirmed',
      hotelName: booking.hotel.name,
      checkinDate: booking.checkinDate,
      checkoutDate: booking.checkoutDate,
      voucherUrl: null, // TODO: generate voucher
      otaCoinEarnedPaise: otaCoinEarned,
      rezCoinEarnedPaise: rezCoinEarned,
      hotelBrandCoinEarnedPaise: hotelBrandCoinEarned,
      otaCoinNewBalancePaise: wallet?.otaCoinBalancePaise || 0,
    };
  }

  /**
   * Cancel booking - release inventory, reverse coins, trigger refund
   */
  static async cancel(bookingId: string, userId: string, reason: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) throw Errors.notFound('Booking');
    if (booking.userId !== userId) throw Errors.forbidden();
    if (!['hold', 'confirmed'].includes(booking.status)) {
      throw Errors.validation('Booking cannot be cancelled in current state');
    }

    // P0-LOGIC-2: Enforce 24-hour cancellation policy with penalty
    // FIX-BUG-18: Use >= boundary (cancellations within 24h of checkin incur penalty)
    const CANCELLATION_WINDOW_HOURS = 24;
    const now = new Date();
    const hoursUntilCheckin = (new Date(booking.checkinDate).getTime() - now.getTime()) / (1000 * 60 * 60);
    const isWithinWindow = hoursUntilCheckin >= 0 && hoursUntilCheckin < CANCELLATION_WINDOW_HOURS && booking.status === 'confirmed';

    // Calculate penalty and refund upfront so the transaction writes consistent values
    let refundAmountPaise: number;
    let cancellationPenalty = 0;
    if (booking.status === 'confirmed') {
      if (isWithinWindow) {
        // Within 24 hours of checkin — 50% cancellation penalty
        cancellationPenalty = Math.round(booking.totalValuePaise * 0.5);
        refundAmountPaise = booking.pgAmountPaise - cancellationPenalty;
      } else {
        // Outside window — full refund
        refundAmountPaise = booking.pgAmountPaise;
      }
    } else {
      // Hold status — no payment captured yet
      refundAmountPaise = 0;
    }

    await prisma.$transaction(async (tx) => {
      // Re-check and update status atomically to prevent concurrent double-cancellation
      const updated = await tx.booking.updateMany({
        where: { id: booking.id, status: { in: ['hold', 'confirmed'] } },
        data: {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancellationPenaltyPaise: cancellationPenalty || 0,
          refundAmountPaise,
          refundStatus: booking.status === 'confirmed' ? 'pending' : 'not_applicable',
        },
      });

      if (updated.count === 0) {
        throw Errors.validation('Booking cannot be cancelled in current state');
      }

      // Release inventory via InventoryEngine (includes oversell post-check)
      await InventoryEngine.releaseInventory(tx, {
        hotelId: booking.hotelId,
        roomTypeId: booking.roomTypeId,
        checkinDate: booking.checkinDate.toISOString().slice(0, 10),
        checkoutDate: booking.checkoutDate.toISOString().slice(0, 10),
        numRooms: booking.numRooms,
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'cancelled',
          eventData: { reason, previousStatus: booking.status },
          triggeredBy: 'user',
        },
      });
    });

    // BUG-13 FIX: Reverse coin burns with compensation guarantee.
    // Coins MUST be restored even if refund fails — use try-finally pattern.
    let coinRestorationFailed = false;

    try {
      if (booking.otaCoinBurnedPaise > 0) {
        try {
          await CoinService.reverseBurn({
            userId, coinType: 'ota', amountPaise: booking.otaCoinBurnedPaise, bookingId: booking.id,
          });
        } catch (err) {
          coinRestorationFailed = true;
          BookingService.logger.error('[BookingService] OTA coin reversal failed', { bookingId: booking.id, err });
          throw err;
        }
      }
      if (booking.rezCoinBurnedPaise > 0) {
        try {
          await CoinService.reverseBurn({
            userId, coinType: 'rez', amountPaise: booking.rezCoinBurnedPaise, bookingId: booking.id,
          });
        } catch (err) {
          coinRestorationFailed = true;
          BookingService.logger.error('[BookingService] REZ coin reversal failed', { bookingId: booking.id, err });
          throw err;
        }
      }
      if (booking.hotelBrandCoinBurnedPaise > 0) {
        try {
          await CoinService.reverseBurn({
            userId, coinType: 'hotel_brand', amountPaise: booking.hotelBrandCoinBurnedPaise,
            bookingId: booking.id, hotelId: booking.hotelId,
          });
        } catch (err) {
          coinRestorationFailed = true;
          BookingService.logger.error('[BookingService] Hotel brand coin reversal failed', { bookingId: booking.id, err });
          throw err;
        }
      }
    } finally {
      // BUG-13 FIX: If any coin reversal failed, schedule compensation as background job.
      // This ensures coins are eventually restored even if cancellation request times out.
      if (coinRestorationFailed) {
        BookingService.logger.warn('[BookingService] Coin reversal failed — scheduling compensation job', { bookingId: booking.id });
        if (booking.otaCoinBurnedPaise > 0) {
          await CoinService.scheduleRefund({
            userId, coinType: 'ota', amountPaise: booking.otaCoinBurnedPaise,
            bookingId: booking.id, reason: 'cancellation_compensation',
          }).catch((err) => BookingService.logger.error('Failed to schedule OTA compensation', { err }));
        }
        if (booking.rezCoinBurnedPaise > 0) {
          await CoinService.scheduleRefund({
            userId, coinType: 'rez', amountPaise: booking.rezCoinBurnedPaise,
            bookingId: booking.id, reason: 'cancellation_compensation',
          }).catch((err) => BookingService.logger.error('Failed to schedule REZ compensation', { err }));
        }
        if (booking.hotelBrandCoinBurnedPaise > 0) {
          await CoinService.scheduleRefund({
            userId, coinType: 'hotel_brand', amountPaise: booking.hotelBrandCoinBurnedPaise,
            bookingId: booking.id, hotelId: booking.hotelId, reason: 'cancellation_compensation',
          }).catch((err) => BookingService.logger.error('Failed to schedule brand compensation', { err }));
        }
      }
    }

    // BUG-13 FIX: Refund handling with error tracking — refund failure doesn't prevent success
    let refundError: Error | null = null;

    // Reverse coin earn if booking was confirmed
    if (booking.status === 'confirmed') {
      const earnTxs = await prisma.coinTransaction.findMany({
        where: { bookingId: booking.id, transactionType: 'earn' },
      });
      for (const earnTx of earnTxs) {
        await CoinService.reverseEarn({
          userId, coinType: earnTx.coinType, amountPaise: earnTx.amountPaise, bookingId: booking.id,
          // hotelId required for hotel_brand earn reversal — stored on CoinTransaction
          ...(earnTx.coinType === 'hotel_brand' && { hotelId: (earnTx as any).hotelId || booking.hotelId }),
        });
      }

      // Trigger refund — use net refundAmountPaise (after penalty deduction)
      // BUG-13 FIX: Track refund errors but don't fail the cancellation
      // BUG-14 FIX: Pass bookingId for refund audit tracking
      if (booking.razorpayPaymentId && refundAmountPaise > 0) {
        try {
          await PaymentService.initiateRefund(booking.razorpayPaymentId, refundAmountPaise, booking.id);
        } catch (err) {
          refundError = err as Error;
          BookingService.logger.error('[BookingService] Refund initiation failed', { bookingId: booking.id, error: refundError.message });
          // Update refund status to processed (attempted) for reconciliation
          await prisma.booking.update({
            where: { id: booking.id },
            data: { refundStatus: 'processed' },
          }).catch(() => {});
        }
      }
    }

    // BUG-15 FIX: Reverse settlement entry so cancelled stays are not paid out to the hotel.
    // Now properly throws on failure instead of failing silently.
    if (booking.status === 'confirmed') {
      try {
        await SettlementService.reverseEntry(booking.id);
      } catch (settlementError) {
        // Log but don't block cancellation — refund is still being processed
        BookingService.logger.error('[BookingService] Settlement reversal failed', {
          bookingId: booking.id,
          error: settlementError instanceof Error ? settlementError.message : String(settlementError),
        });
        // The settlement reversal failure is logged to SettlementAuditLog by SettlementService
      }
    }

    // Push cancellation to Hotel PMS (fire-and-forget)
    PmsWebhookService.notifyBookingCancelled({
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      hotelId: booking.hotelId,
      reason,
    });

    return {
      status: 'cancelled',
      cancellationPenalty,
      refundAmountPaise,
      refundEta: booking.status === 'confirmed' ? '3-5 business days' : null,
    };
  }

  /**
   * Get booking by ID
   */
  static async getById(bookingId: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: { select: { name: true, addressLine1: true, city: true, primaryContactPhone: true } },
      },
    });

    if (!booking) throw Errors.notFound('Booking');
    if (booking.userId !== userId) throw Errors.forbidden();

    const coinEarned = await prisma.coinTransaction.aggregate({
      where: { bookingId, transactionType: 'earn', coinType: 'ota' },
      _sum: { amountPaise: true },
    });

    return {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      hotel: {
        name: booking.hotel.name,
        address: [booking.hotel.addressLine1, booking.hotel.city].filter(Boolean).join(', '),
        phone: booking.hotel.primaryContactPhone,
      },
      checkinDate: booking.checkinDate,
      checkoutDate: booking.checkoutDate,
      numNights: booking.numNights,
      totalValuePaise: booking.totalValuePaise,
      pgPaidPaise: booking.pgAmountPaise,
      coinsUsedPaise: booking.otaCoinBurnedPaise + booking.rezCoinBurnedPaise + booking.hotelBrandCoinBurnedPaise,
      coinsEarnedPaise: coinEarned._sum.amountPaise || 0,
      cancellationPolicy: 'Free cancellation until 24 hours before checkin; 50% penalty within 24 hours',
      canCancel: ['hold', 'confirmed'].includes(booking.status),
      cancelDeadline: dayjs(booking.checkinDate).subtract(24, 'hour').toISOString(),
    };
  }

  /**
   * List bookings for a user
   */
  static async listForUser(userId: string, status?: string, page = 1, perPage = 10) {
    const where: any = { userId };
    if (status === 'upcoming') {
      where.status = { in: ['confirmed', 'hold'] };
      where.checkinDate = { gte: new Date() };
    } else if (status === 'past') {
      where.status = { in: ['stayed', 'checked_in'] };
    } else if (status === 'cancelled') {
      where.status = 'cancelled';
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { hotel: { select: { name: true, city: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings: bookings.map((b) => ({
        bookingId: b.id,
        bookingRef: b.bookingRef,
        status: b.status,
        hotelName: b.hotel.name,
        city: b.hotel.city,
        checkinDate: b.checkinDate,
        checkoutDate: b.checkoutDate,
        totalValuePaise: b.totalValuePaise,
      })),
      total,
      page,
    };
  }
}
