import crypto, { timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import dayjs from 'dayjs';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { Errors } from '../../utils/errors';
import { CoinService } from '../finance/coin.service';
import { SettlementService } from '../payments/settlement.service';
import { NotificationService } from '../notifications/notification.service';
import { AttributionService } from '../marketing/attribution.service';
import { RezWebhookService } from '../integrations/rez-webhook.service';
import { holdExpiryQueue } from '../../jobs/queues';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentIntent {
  holdId: string;
  bookingRef: string;
  razorpayOrderId: string;
  totalValuePaise: number;
  otaCoinAppliedPaise: number;
  rezCoinAppliedPaise: number;
  pgAmountPaise: number;
  expiresAt: Date | null;
  breakdown: {
    roomRatePaise: number;
    numNights: number;
    numRooms: number;
    subtotalPaise: number;
    otaCoinDiscountPaise: number;
    rezCoinDiscountPaise: number;
    chargeablePaise: number;
  };
}

export interface PaymentResult {
  bookingId: string;
  bookingRef: string;
  status: 'confirmed';
  hotelName: string;
  checkinDate: Date;
  checkoutDate: Date;
  otaCoinEarnedPaise: number;
  rezCoinEarnedPaise: number;
  otaCoinNewBalancePaise: number;
}

export interface RefundResult {
  refundId: string;
  amountPaise: number;
  status: 'initiated';
  eta: string;
}

export interface ReconciliationResult {
  date: string;
  totalChecked: number;
  matched: number;
  mismatches: Array<{
    bookingId: string;
    bookingRef: string;
    razorpayPaymentId: string;
    ourStatus: string;
    razorpayStatus: string;
    amountPaiseMismatch?: boolean;
  }>;
}

// ─── Lazy Razorpay init ───────────────────────────────────────────────────────

let _razorpay: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class PaymentOrchestrationService {
  /**
   * Create a payment intent — wraps the full payment flow:
   * 1. Validate booking hold is still active
   * 2. Calculate final amounts (coins applied, PG amount)
   * 3. Create Razorpay order
   * 4. Log payment intent in DB
   * Returns orderId + breakdown.
   *
   * NOTE: This is intentionally a read-through operation.  The booking hold
   * was already created by BookingService.hold(); this method re-derives the
   * numbers from the persisted booking so the client always gets a fresh,
   * consistent view before launching the payment sheet.
   */
  static async createPaymentIntent(holdId: string, userId: string): Promise<PaymentIntent> {
    const booking = await prisma.booking.findUnique({
      where: { id: holdId },
      select: {
        id: true,
        bookingRef: true,
        userId: true,
        status: true,
        holdExpiresAt: true,
        razorpayOrderId: true,
        totalValuePaise: true,
        otaCoinBurnedPaise: true,
        rezCoinBurnedPaise: true,
        pgAmountPaise: true,
        roomRatePaise: true,
        numNights: true,
        numRooms: true,
      },
    });

    if (!booking) throw Errors.notFound('Booking');
    if (booking.userId !== userId) throw Errors.forbidden();
    if (booking.status !== 'hold') {
      throw Errors.validation('Booking is not in hold state');
    }
    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
      throw Errors.holdExpired();
    }

    // If a Razorpay order already exists (idempotent re-fetch), reuse it.
    // Otherwise create a fresh order (edge case: order creation failed earlier).
    let orderId = booking.razorpayOrderId;
    if (!orderId) {
      const order = await PaymentOrchestrationService._createRazorpayOrder(
        booking.pgAmountPaise,
        booking.bookingRef,
      );
      orderId = order.id;
      await prisma.booking.update({
        where: { id: holdId },
        data: { razorpayOrderId: orderId },
      });
    }

    return {
      holdId: booking.id,
      bookingRef: booking.bookingRef,
      razorpayOrderId: orderId,
      totalValuePaise: booking.totalValuePaise,
      otaCoinAppliedPaise: booking.otaCoinBurnedPaise,
      rezCoinAppliedPaise: booking.rezCoinBurnedPaise,
      pgAmountPaise: booking.pgAmountPaise,
      expiresAt: booking.holdExpiresAt,
      breakdown: {
        roomRatePaise: booking.roomRatePaise,
        numNights: booking.numNights,
        numRooms: booking.numRooms,
        subtotalPaise: booking.totalValuePaise,
        otaCoinDiscountPaise: booking.otaCoinBurnedPaise,
        rezCoinDiscountPaise: booking.rezCoinBurnedPaise,
        chargeablePaise: booking.pgAmountPaise,
      },
    };
  }

  /**
   * Verify and complete payment — atomic operation.
   *
   * Flow:
   * 1. Verify Razorpay signature  (CRITICAL — never skip)
   * 2. Check idempotency (prevent double-credit)
   * 3. Transition booking to confirmed inside a DB transaction
   * 4. Trigger coin earn
   * 5. Create settlement entry
   * 6. Send notifications async
   *
   * All DB mutations are inside a single transaction.  Coin earn and
   * settlement happen outside the transaction boundary because they
   * operate on separate tables and their own inner transactions; the
   * booking status flip is the authoritative source of truth.
   */
  static async completePayment(params: {
    holdId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    userId: string;
  }): Promise<PaymentResult> {
    const { holdId, razorpayPaymentId, razorpaySignature, userId } = params;

    const booking = await prisma.booking.findUnique({
      where: { id: holdId },
      // CD-XS-05 FIX: Include rezBookingSyncs for session attribution
      include: {
        hotel: { select: { name: true, otaCommissionPct: true } },
        user: {
          select: {
            id: true,
            phone: true,
            rezUserId: true,
            tier: true,
            attributionPartner: true,
            attributionExpiryTs: true,
            lastCampaignClickTs: true,
            lastCampaignId: true,
          },
        },
        rezBookingSyncs: { select: { rezSessionId: true } },
      },
    });

    if (!booking) throw Errors.notFound('Booking');
    if (booking.userId !== userId) throw Errors.forbidden();

    // ── 1. Signature verification (critical — never skip in production) ──
    const isValidSig = PaymentOrchestrationService._verifyPaymentSignature(
      booking.razorpayOrderId!,
      razorpayPaymentId,
      razorpaySignature,
    );
    if (!isValidSig) throw Errors.paymentFailed('Invalid payment signature');

    // ── 2. Idempotency guard ──
    // If booking is already confirmed with the same paymentId, return success
    if (booking.status === 'confirmed' && booking.razorpayPaymentId === razorpayPaymentId) {
      const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
      return {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        status: 'confirmed',
        hotelName: booking.hotel.name,
        checkinDate: booking.checkinDate,
        checkoutDate: booking.checkoutDate,
        otaCoinEarnedPaise: 0,
        rezCoinEarnedPaise: 0,
        otaCoinNewBalancePaise: wallet?.otaCoinBalancePaise ?? 0,
      };
    }

    if (booking.status !== 'hold') {
      throw Errors.validation(`Booking is not in hold state (current: ${booking.status})`);
    }
    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
      throw Errors.holdExpired();
    }

    // ── 3. Atomic status transition ──
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'confirmed',
          paymentStatus: 'paid',
          razorpayPaymentId,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'payment_received',
          eventData: { razorpayPaymentId, razorpayOrderId: booking.razorpayOrderId },
          triggeredBy: 'user',
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'confirmed',
          eventData: { confirmedAt: new Date().toISOString() },
          triggeredBy: 'system',
        },
      });
    });

    // Remove hold-expiry job now that booking is confirmed
    const job = await holdExpiryQueue.getJob(`hold-${booking.id}`);
    if (job) await job.remove().catch(() => {/* non-fatal */});

    // ── 4. Attribution ──
    await AttributionService.resolveAttribution(userId, booking.campaignId).catch((err) =>
      console.error('[PaymentOrchestration] Attribution resolve failed:', err),
    );

    // ── 4. Coin earn ──
    let otaCoinEarned = 0;
    let rezCoinEarned = 0;

    const otaRule = await CoinService.findEarnRule({
      coinType: 'ota',
      channelSource: booking.channelSource,
      hotelId: booking.hotelId,
      userTier: booking.user.tier,
      campaignId: booking.campaignId,
      bookingValue: booking.totalValuePaise,
    });

    if (otaRule) {
      otaCoinEarned = CoinService.calculateEarnAmount(
        booking.totalValuePaise,
        Number(otaRule.earnPct),
        otaRule.maxEarnPerBookingPaise,
      );
      await CoinService.earnCoins({
        userId,
        coinType: 'ota',
        amountPaise: otaCoinEarned,
        bookingId: booking.id,
        earnRuleId: otaRule.id,
      });
    }

    const rezRule = await CoinService.findEarnRule({
      coinType: 'rez',
      channelSource: booking.channelSource,
      hotelId: booking.hotelId,
      userTier: booking.user.tier,
      campaignId: booking.campaignId,
      bookingValue: booking.totalValuePaise,
    });

    if (rezRule) {
      rezCoinEarned = CoinService.calculateEarnAmount(
        booking.totalValuePaise,
        Number(rezRule.earnPct),
        rezRule.maxEarnPerBookingPaise,
      );
    }

    // ── 5. Settlement ──
    await SettlementService.createEntry({
      hotelId: booking.hotelId,
      bookingId: booking.id,
      grossAmountPaise: booking.pgAmountPaise,
      commissionPaise: Number(booking.otaCommissionPaise),
      coinLiabilityPaise: booking.otaCoinBurnedPaise + booking.rezCoinBurnedPaise,
    });

    // ── 6. Async side-effects (notifications, ReZ webhook) ──
    if (rezCoinEarned > 0 && booking.user.rezUserId) {
      RezWebhookService.sendBookingConfirmed({
        bookingId: booking.id,
        rezUserId: booking.user.rezUserId,
        bookingValuePaise: Number(booking.totalValuePaise),
        channelSource: booking.channelSource,
        rezCoinToCreditPaise: rezCoinEarned,
        // CD-XS-05 FIX: Pass actual session ID from RezBookingSync for campaign attribution
        rezSessionId: booking.rezBookingSyncs[0]?.rezSessionId ?? undefined,
      }).catch((err) => console.error('[PaymentOrchestration] ReZ webhook failed:', err));
    }

    NotificationService.sendBookingConfirmation(
      booking.guestPhone || booking.user.phone,
      booking.bookingRef,
      booking.hotel.name,
    ).catch((err) => console.error('[PaymentOrchestration] SMS failed:', err));

    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });

    return {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      status: 'confirmed',
      hotelName: booking.hotel.name,
      checkinDate: booking.checkinDate,
      checkoutDate: booking.checkoutDate,
      otaCoinEarnedPaise: otaCoinEarned,
      rezCoinEarnedPaise: rezCoinEarned,
      otaCoinNewBalancePaise: wallet?.otaCoinBalancePaise ?? 0,
    };
  }

  /**
   * Handle payment failure:
   * 1. Release inventory back to available
   * 2. Reverse coin burns (restore wallet balances)
   * 3. Log failure event on the booking
   */
  static async handlePaymentFailure(holdId: string, reason: string): Promise<void> {
    const booking = await prisma.booking.findUnique({ where: { id: holdId } });
    if (!booking) return; // Already cleaned up or does not exist

    if (!['hold', 'init'].includes(booking.status)) return; // Nothing to do

    await prisma.$transaction(async (tx) => {
      // Release inventory
      await tx.$executeRaw`
        UPDATE inventory_slots
        SET available_rooms = available_rooms + ${booking.numRooms},
            updated_at      = NOW()
        WHERE room_type_id = ${booking.roomTypeId}::uuid
          AND hotel_id     = ${booking.hotelId}::uuid
          AND date >= ${booking.checkinDate}::date
          AND date <  ${booking.checkoutDate}::date
      `;

      // Mark booking cancelled with payment-failed reason
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'cancelled',
          cancellationReason: `payment_failed: ${reason}`,
          cancelledAt: new Date(),
          refundStatus: 'not_applicable',
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'cancelled',
          eventData: { reason: `payment_failed: ${reason}` },
          triggeredBy: 'system',
        },
      });
    });

    // Reverse coin burns outside the transaction (coin service has own tx)
    if (booking.otaCoinBurnedPaise > 0) {
      await CoinService.reverseBurn({
        userId: booking.userId,
        coinType: 'ota',
        amountPaise: booking.otaCoinBurnedPaise,
        bookingId: booking.id,
      }).catch((err) =>
        console.error('[PaymentOrchestration] OTA coin burn reversal failed:', err),
      );
    }

    if (booking.rezCoinBurnedPaise > 0) {
      await CoinService.reverseBurn({
        userId: booking.userId,
        coinType: 'rez',
        amountPaise: booking.rezCoinBurnedPaise,
        bookingId: booking.id,
      }).catch((err) =>
        console.error('[PaymentOrchestration] REZ coin burn reversal failed:', err),
      );
    }

    // Remove hold-expiry job (already being cleaned up)
    const job = await holdExpiryQueue.getJob(`hold-${booking.id}`);
    if (job) await job.remove().catch(() => {/* non-fatal */});
  }

  /**
   * Process refund with full reconciliation:
   * 1. Initiate Razorpay refund
   * 2. Track refund status on the booking
   * 3. Reverse coin earn
   * 4. Update settlement entry
   * 5. Log refund event
   */
  static async processRefund(bookingId: string, amountPaise?: number): Promise<RefundResult> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: { select: { name: true } } },
    });

    if (!booking) throw Errors.notFound('Booking');
    if (booking.status !== 'cancelled' && booking.status !== 'confirmed') {
      throw Errors.validation('Booking is not eligible for refund');
    }
    if (!booking.razorpayPaymentId) {
      throw Errors.validation('No Razorpay payment found for this booking');
    }
    if (booking.refundStatus === 'processed') {
      throw Errors.validation('Refund has already been processed');
    }

    const refundAmount = amountPaise ?? booking.pgAmountPaise;
    if (refundAmount <= 0) throw Errors.validation('Refund amount must be positive');
    if (refundAmount > booking.pgAmountPaise) {
      throw Errors.validation('Refund amount exceeds original payment');
    }

    // ── 1. Initiate Razorpay refund ──
    let razorpayRefundId: string;
    if (env.NODE_ENV === 'development' && !env.RAZORPAY_KEY_ID) {
      razorpayRefundId = `rfnd_dev_${Date.now()}`;
    } else {
      const refund = await getRazorpay().payments.refund(booking.razorpayPaymentId, {
        amount: refundAmount,
      });
      razorpayRefundId = refund.id;
    }

    const isPartial = refundAmount < booking.pgAmountPaise;

    // ── 2 & 5. Update booking refund status + log event in one transaction ──
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          refundAmountPaise: refundAmount,
          refundStatus: 'processed',
          paymentStatus: isPartial ? 'partial_refund' : 'refunded',
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: 'refunded',
          eventData: {
            razorpayRefundId,
            refundAmountPaise: refundAmount,
            isPartial,
            initiatedAt: new Date().toISOString(),
          },
          triggeredBy: 'system',
        },
      });

      // ── 4. Update settlement entry to reflect refund ──
      await tx.settlementEntry.updateMany({
        where: { bookingId: booking.id },
        data: { status: 'disputed' }, // Finance team will reconcile
      });
    });

    // ── 3. Reverse coin earn (non-fatal — coins already consumed) ──
    const earnTxs = await prisma.coinTransaction.findMany({
      where: { bookingId: booking.id, transactionType: 'earn' },
    });

    for (const tx of earnTxs) {
      await CoinService.reverseEarn({
        userId: booking.userId,
        coinType: tx.coinType,
        amountPaise: tx.amountPaise,
        bookingId: booking.id,
      }).catch((err) =>
        console.error('[PaymentOrchestration] Coin earn reversal failed:', err),
      );
    }

    return {
      refundId: razorpayRefundId,
      amountPaise: refundAmount,
      status: 'initiated',
      eta: '3–5 business days',
    };
  }

  /**
   * Webhook handler for Razorpay payment/refund events.
   *
   * Verifies webhook signature before processing.
   * Handles edge cases: late success (payment.captured after our hold expired),
   * late failure (payment.failed after we confirmed).
   *
   * Webhook event types handled:
   *   payment.captured  — late success
   *   payment.failed    — late failure / confirmation
   *   refund.created    — refund initiated by Razorpay
   *   refund.processed  — refund completed
   */
  static async handleRazorpayWebhook(payload: any, signature: string): Promise<void> {
    // ── Signature verification ──
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw Errors.paymentFailed('Razorpay webhook secret not configured');
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const sigIsValid = (() => {
      try {
        return timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature));
      } catch {
        return false;
      }
    })();

    if (!sigIsValid) {
      throw Errors.paymentFailed('Invalid webhook signature');
    }

    const event: string = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;
    const refundEntity = payload?.payload?.refund?.entity;

    switch (event) {
      case 'payment.captured': {
        if (!paymentEntity) break;
        const { order_id: orderId, id: paymentId } = paymentEntity;
        if (!orderId || !paymentId) break;

        const booking = await prisma.booking.findFirst({
          where: { razorpayOrderId: orderId },
        });
        if (!booking) break;

        // Late success: payment captured after our hold window — log it, let
        // admin reconcile manually.  We do NOT auto-confirm because inventory
        // may have been re-sold.
        if (booking.status === 'cancelled') {
          await prisma.bookingEvent.create({
            data: {
              bookingId: booking.id,
              eventType: 'payment_received',
              eventData: {
                razorpayPaymentId: paymentId,
                note: 'LATE_CAPTURE: booking already cancelled — requires manual reconciliation',
              },
              triggeredBy: 'rez_webhook',
            },
          });
          console.warn(`[PaymentOrchestration] Late capture for cancelled booking ${booking.bookingRef}`);
          break;
        }

        // Happy path: if booking is hold, update razorpayPaymentId for reconciliation
        if (booking.status === 'hold' && !booking.razorpayPaymentId) {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { razorpayPaymentId: paymentId },
          });
        }
        break;
      }

      case 'payment.failed': {
        if (!paymentEntity) break;
        const { order_id: orderId, error_description: errorDesc } = paymentEntity;
        if (!orderId) break;

        const booking = await prisma.booking.findFirst({
          where: { razorpayOrderId: orderId },
        });
        if (!booking || booking.status !== 'hold') break;

        await PaymentOrchestrationService.handlePaymentFailure(
          booking.id,
          errorDesc ?? 'payment.failed webhook',
        );
        break;
      }

      case 'refund.created': {
        if (!refundEntity) break;
        const { payment_id: paymentId, id: refundId, amount } = refundEntity;

        const booking = await prisma.booking.findFirst({
          where: { razorpayPaymentId: paymentId },
        });
        if (!booking) break;

        await prisma.bookingEvent.create({
          data: {
            bookingId: booking.id,
            eventType: 'refunded',
            eventData: { razorpayRefundId: refundId, amountPaise: amount, status: 'created' },
            triggeredBy: 'rez_webhook',
          },
        });
        break;
      }

      case 'refund.processed': {
        if (!refundEntity) break;
        const { payment_id: paymentId, id: refundId, amount } = refundEntity;

        const booking = await prisma.booking.findFirst({
          where: { razorpayPaymentId: paymentId },
        });
        if (!booking) break;

        await prisma.bookingEvent.create({
          data: {
            bookingId: booking.id,
            eventType: 'refunded',
            eventData: { razorpayRefundId: refundId, amountPaise: amount, status: 'processed' },
            triggeredBy: 'rez_webhook',
          },
        });
        break;
      }

      default:
        // Unknown / unhandled event — log silently
        console.log(`[PaymentOrchestration] Unhandled webhook event: ${event}`);
    }
  }

  /**
   * Daily reconciliation — compare our DB records with Razorpay for a given date.
   *
   * Flags mismatches:
   *   - Booking confirmed in our DB but payment not captured in Razorpay
   *   - Booking in hold/cancelled but payment captured in Razorpay
   *   - Amount mismatch between what we recorded and what Razorpay charged
   *
   * @param date  ISO date string e.g. "2025-03-24"
   */
  static async reconcilePayments(date: string): Promise<ReconciliationResult> {
    const startOfDay = dayjs(date).startOf('day').toDate();
    const endOfDay = dayjs(date).endOf('day').toDate();

    // All bookings that had a Razorpay payment ID and were updated on this date
    const bookings = await prisma.booking.findMany({
      where: {
        razorpayPaymentId: { not: null },
        updatedAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['confirmed', 'cancelled'] },
      },
      select: {
        id: true,
        bookingRef: true,
        razorpayPaymentId: true,
        razorpayOrderId: true,
        pgAmountPaise: true,
        paymentStatus: true,
        status: true,
      },
    });

    const mismatches: ReconciliationResult['mismatches'] = [];

    for (const booking of bookings) {
      if (!booking.razorpayPaymentId) continue;

      let razorpayPayment: any;
      try {
        if (env.NODE_ENV === 'development' && !env.RAZORPAY_KEY_ID) {
          // In dev, simulate a matched record
          continue;
        }
        razorpayPayment = await getRazorpay().payments.fetch(booking.razorpayPaymentId);
      } catch (err) {
        console.error(
          `[PaymentOrchestration] Reconcile: could not fetch payment ${booking.razorpayPaymentId}`,
          err,
        );
        mismatches.push({
          bookingId: booking.id,
          bookingRef: booking.bookingRef,
          razorpayPaymentId: booking.razorpayPaymentId,
          ourStatus: booking.status,
          razorpayStatus: 'FETCH_FAILED',
        });
        continue;
      }

      const rzpStatus: string = razorpayPayment.status; // captured | failed | created
      const rzpAmount: number = razorpayPayment.amount; // in paise

      const statusMismatch =
        (booking.status === 'confirmed' && rzpStatus !== 'captured') ||
        (booking.status === 'cancelled' && rzpStatus === 'captured');

      const amountMismatch = booking.pgAmountPaise !== rzpAmount;

      if (statusMismatch || amountMismatch) {
        mismatches.push({
          bookingId: booking.id,
          bookingRef: booking.bookingRef,
          razorpayPaymentId: booking.razorpayPaymentId,
          ourStatus: `${booking.status}/${booking.paymentStatus}`,
          razorpayStatus: rzpStatus,
          ...(amountMismatch && { amountPaiseMismatch: true }),
        });
      }
    }

    // Persist reconciliation result as a booking event on each mismatch
    for (const m of mismatches) {
      await prisma.bookingEvent.create({
        data: {
          bookingId: m.bookingId,
          eventType: 'payment_received', // closest available event type
          eventData: {
            reconciliationDate: date,
            mismatch: true,
            ourStatus: m.ourStatus,
            razorpayStatus: m.razorpayStatus,
            amountPaiseMismatch: m.amountPaiseMismatch ?? false,
          },
          triggeredBy: 'system',
        },
      }).catch(() => {/* Non-fatal */});
    }

    return {
      date,
      totalChecked: bookings.length,
      matched: bookings.length - mismatches.length,
      mismatches,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private static async _createRazorpayOrder(
    amountPaise: number,
    bookingRef: string,
  ): Promise<{ id: string }> {
    if (env.NODE_ENV === 'development' && !env.RAZORPAY_KEY_ID) {
      return { id: `order_dev_${Date.now()}` };
    }
    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: bookingRef,
    });
    return { id: order.id };
  }

  private static _verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    if (env.NODE_ENV === 'development' && !env.RAZORPAY_KEY_SECRET) {
      return true;
    }
    // HOTEL-OTA-P1 FIX: Fail closed — throw if key secret is unset in non-dev.
    if (!env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_SECRET is not configured. Cannot verify payment.');
    }
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
