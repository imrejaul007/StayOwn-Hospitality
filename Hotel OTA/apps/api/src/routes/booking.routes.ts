import { Router, Request, Response } from 'express';
import express from 'express';
import crypto, { timingSafeEqual } from 'crypto';
import { BookingService } from '../services/booking/booking.service';
import { authenticateUser } from '../middleware/auth';
import { bookingRateLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { Errors } from '../utils/errors';
import { q, qInt } from '../utils/query';
import { asyncHandler } from '../middleware/asyncHandler';
import { getContextualFinanceOffer } from '../services/finance/financeIntegration.service';
import { InventoryEngine } from '../services/booking/inventory-engine.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import dayjs from 'dayjs';
import {
  captureBookingHold,
  captureBookingConfirmed,
  captureBookingCancelled,
} from '../services/shared/intent-capture.service';

const router = Router();

// FIX-BUG-7: Add date range validation
// Prevent past dates and dates too far in future
const validateFutureDate = (dateStr: string) => {
  const date = dayjs(dateStr);
  const now = dayjs();
  const maxFuture = dayjs().add(365, 'day');
  
  if (!date.isValid()) {
    throw new Error('Invalid date format');
  }
  if (date.isBefore(now, 'day')) {
    throw new Error('Checkin date must be in the future');
  }
  if (date.isAfter(maxFuture, 'day')) {
    throw new Error('Checkin date cannot be more than 365 days in the future');
  }
  return dateStr;
};

const holdSchema = z.object({
  hotel_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  checkin_date: z.string().refine(validateFutureDate, { message: 'Invalid checkin date' }),
  checkout_date: z.string(),
  num_rooms: z.number().int().min(1).default(1),
  num_guests: z.number().int().min(1).default(2),
  guest_name: z.string(),
  guest_phone: z.string(),
  special_requests: z.string().optional(),
  channel_source: z.enum(['ota_app', 'rez_app', 'corporate', 'hotel_qr']).default('ota_app'),
  ota_coin_burn_paise: z.number().int().min(0).default(0),
  rez_coin_burn_paise: z.number().int().min(0).default(0),
  hotel_brand_coin_burn_paise: z.number().int().min(0).default(0),
}).refine(
  (data) => {
    const checkout = dayjs(data.checkout_date);
    const checkin = dayjs(data.checkin_date);
    return checkout.isAfter(checkin, 'day');
  },
  { message: 'Checkout date must be after checkin date', path: ['checkout_date'] }
);

const confirmSchema = z.object({
  hold_id: z.string().uuid(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  razorpay_order_id: z.string().optional(),
});

router.post('/hold', authenticateUser, bookingRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = holdSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid booking data', { errors: parsed.error.flatten() });

  const result = await BookingService.hold({
    userId: req.user!.userId,
    hotelId: parsed.data.hotel_id,
    roomTypeId: parsed.data.room_type_id,
    checkinDate: parsed.data.checkin_date,
    checkoutDate: parsed.data.checkout_date,
    numRooms: parsed.data.num_rooms,
    numGuests: parsed.data.num_guests,
    guestName: parsed.data.guest_name,
    guestPhone: parsed.data.guest_phone,
    specialRequests: parsed.data.special_requests,
    channelSource: parsed.data.channel_source,
    otaCoinBurnPaise: parsed.data.ota_coin_burn_paise,
    rezCoinBurnPaise: parsed.data.rez_coin_burn_paise,
    hotelBrandCoinBurnPaise: parsed.data.hotel_brand_coin_burn_paise,
    userTier: req.user!.tier,
  });

  // Fetch contextual finance offer (non-blocking — never fails the hold)
  const financeOffer = await getContextualFinanceOffer(
    req.user!.userId,
    'booking_checkout',
    result.holdId,
    result.pgAmountPaise / 100,
  ).catch(() => null);

  // RTMN Commerce Memory: Capture booking hold intent (non-blocking)
  captureBookingHold({
    userId: req.user!.userId,
    hotelId: parsed.data.hotel_id,
    roomTypeId: parsed.data.room_type_id,
    checkin: parsed.data.checkin_date,
    checkout: parsed.data.checkout_date,
  }).catch((err) => logger.debug('[IntentCapture] Hold capture failed', { err }));

  res.json({
    hold_id: result.holdId,
    booking_ref: result.bookingRef,
    expires_at: result.expiresAt,
    room_rate_paise: result.roomRatePaise,
    total_value_paise: result.totalValuePaise,
    ota_coin_applied_paise: result.otaCoinAppliedPaise,
    rez_coin_applied_paise: result.rezCoinAppliedPaise,
    pg_amount_paise: result.pgAmountPaise,
    razorpay_order_id: result.razorpayOrderId,
    finance_offer: financeOffer,   // null if not eligible — client renders BNPL banner
  });
}));

router.post('/confirm', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid confirmation data');

  const result = await BookingService.confirm({
    holdId: parsed.data.hold_id,
    razorpayPaymentId: parsed.data.razorpay_payment_id,
    razorpaySignature: parsed.data.razorpay_signature,
    userId: req.user!.userId,
  });

  // RTMN Commerce Memory: Capture booking confirmed intent (non-blocking)
  captureBookingConfirmed({
    userId: req.user!.userId,
    hotelId: result.bookingId, // Will be enhanced to include hotelId when available
    roomTypeId: '', // Will be enhanced when available
    bookingId: result.bookingId,
  }).catch((err) => logger.debug('[IntentCapture] Confirm capture failed', { err }));

  res.json({
    booking_id: result.bookingId,
    booking_ref: result.bookingRef,
    status: result.status,
    hotel_name: result.hotelName,
    checkin_date: result.checkinDate,
    checkout_date: result.checkoutDate,
    voucher_url: result.voucherUrl,
    ota_coin_earned_paise: result.otaCoinEarnedPaise,
    rez_coin_earned_paise: result.rezCoinEarnedPaise,
    hotel_brand_coin_earned_paise: result.hotelBrandCoinEarnedPaise,
    ota_coin_new_balance_paise: result.otaCoinNewBalancePaise,
  });
}));

router.get('/', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const result = await BookingService.listForUser(
    req.user!.userId,
    q(req, 'status'),
    qInt(req, 'page'),
    qInt(req, 'per_page'),
  );
  res.json(result);
}));

router.get('/:booking_id', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const result = await BookingService.getById(req.params.booking_id, req.user!.userId);
  res.json(result);
}));

router.post('/:booking_id/cancel', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  const result = await BookingService.cancel(req.params.booking_id, req.user!.userId, reason || '');

  // RTMN Commerce Memory: Capture booking cancelled intent (non-blocking)
  captureBookingCancelled({
    userId: req.user!.userId,
    hotelId: req.params.booking_id, // Will be enhanced to include actual hotelId
    bookingId: req.params.booking_id,
    reason,
  }).catch((err) => logger.debug('[IntentCapture] Cancel capture failed', { err }));

  res.json(result);
}));

// ── Razorpay Webhook ──────────────────────────────────────────────────────────
// Separate sub-router with raw body capture for HMAC verification
export const razorpayWebhookRouter = Router();
razorpayWebhookRouter.use(
  express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf.toString(); },
  })
);

/**
 * POST /api/webhooks/razorpay
 * Handles payment.failed and order.paid events from Razorpay.
 * Prevents ghost charges (payment captured but /confirm timed out).
 */
razorpayWebhookRouter.post('/razorpay', asyncHandler(async (req: Request, res: Response) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // Verify signature
  if (!secret) {
    logger.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not configured — rejecting all webhook calls');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }
  if (!signature) {
    return res.status(400).json({ error: 'Missing webhook signature' });
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    logger.warn('[Razorpay] Invalid webhook signature');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const event = req.body?.event;
  const payload = req.body?.payload;

  logger.info('[Razorpay] Webhook received', { event });

  // payment.failed — mark the hold as failed so the user can retry
  if (event === 'payment.failed') {
    const orderId = payload?.payment?.entity?.order_id;
    if (orderId) {
      // Fetch booking before cancellation so we have its fields for inventory release.
      // Then cancel + release inventory inside a single transaction so concurrent webhook
      // deliveries cannot double-release inventory.
      const bookingToCancel = await prisma.booking.findFirst({
        where: { razorpayOrderId: orderId, status: 'hold' },
        select: { id: true, numRooms: true, roomTypeId: true, hotelId: true, checkinDate: true, checkoutDate: true },
      });
      if (bookingToCancel) {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.booking.updateMany({
            where: { id: bookingToCancel.id, status: 'hold' },
            data: { status: 'cancelled' },
          });
          if (updated.count === 0) return; // another concurrent call already handled it
          await InventoryEngine.releaseInventory(tx, {
            hotelId: bookingToCancel.hotelId,
            roomTypeId: bookingToCancel.roomTypeId,
            checkinDate: bookingToCancel.checkinDate.toISOString().slice(0, 10),
            checkoutDate: bookingToCancel.checkoutDate.toISOString().slice(0, 10),
            numRooms: bookingToCancel.numRooms,
          });
        });
        logger.info('[Razorpay] payment.failed — hold cancelled and inventory released', { orderId });
      }
    }
  }

  // order.paid — confirm booking if somehow /confirm was never called (reconciliation)
  // FIX-BUG-23: Also filter by razorpayPaymentId: null to prevent duplicate confirmations
  // if webhook fires twice for the same payment. The idempotent updateMany in
  // BookingService.confirm() is the primary guard, but this query filter is a
  // fast-path to skip already-confirmed bookings before even calling the service.
  if (event === 'order.paid') {
    const orderId = payload?.order?.entity?.id;
    const paymentId = payload?.payment?.entity?.id;
    if (orderId && paymentId) {
      const booking = await prisma.booking.findFirst({
        where: {
          razorpayOrderId: orderId,
          status: 'hold',
          paymentStatus: 'pending',
          razorpayPaymentId: null, // FIX-BUG-23: skip if already confirmed with this payment
        },
        select: { id: true, userId: true },
      });
      if (booking) {
        logger.warn('[Razorpay] order.paid reconciliation — calling BookingService.confirm', {
          bookingId: booking.id, orderId, paymentId,
        });
        // Reuse BookingService.confirm so coin earn, PMS push, and settlement all fire.
        // skipSignatureVerification=true because Razorpay HMAC above already confirmed authenticity.
        BookingService.confirm({
          holdId: booking.id,
          razorpayPaymentId: paymentId,
          razorpaySignature: '',
          userId: booking.userId,
          skipSignatureVerification: true,
        }).catch((err) =>
          logger.error(`[Razorpay] reconciliation confirm failed: ${err?.message} bookingId=${booking.id}`)
        );
      }
    }
  }

  res.json({ success: true });
}));

export default router;
