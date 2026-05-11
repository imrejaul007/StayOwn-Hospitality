import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/database';
import { PaymentService } from '../services/payments/payment.service';
import { CoinService } from '../services/finance/coin.service';
import { Errors } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateUser, authenticateHotelStaff } from '../middleware/auth';
import { qInt } from '../utils/query';

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const initiateSchema = z.object({
  hotel_id: z.string().uuid(),
  bill_amount_paise: z.number().int().min(100),
  ota_coin_burn_paise: z.number().int().min(0).default(0),
  rez_coin_burn_paise: z.number().int().min(0).default(0),
  stay_date: z.string().optional(), // ISO date string YYYY-MM-DD
  notes: z.string().max(500).optional(),
  payment_method: z.enum(['upi', 'card', 'netbanking', 'wallet']).optional(),
});

const confirmSchema = z.object({
  payment_id: z.string().uuid(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

// ─── OTA Coin burn cap: 10% of bill amount ──────────────────────────────────
const OTA_BURN_CAP_PCT = 10;
// ─── ReZ Coin burn cap:  5% of bill amount ──────────────────────────────────
const REZ_BURN_CAP_PCT = 5;
// ─── Transaction fee: 1% of bill amount ─────────────────────────────────────
const TRANSACTION_FEE_PCT = 1;
// ─── OTA earn: 2% of bill amount ────────────────────────────────────────────
const OTA_EARN_PCT = 2;
// ─── ReZ earn: 4% of bill amount ────────────────────────────────────────────
const REZ_EARN_PCT = 4;

// ─── POST /offline-payment/initiate ─────────────────────────────────────────

router.post(
  '/offline-payment/initiate',
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = initiateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('Invalid bill pay data', { errors: parsed.error.flatten() });
    }

    const {
      hotel_id,
      bill_amount_paise,
      ota_coin_burn_paise,
      rez_coin_burn_paise,
      stay_date,
      notes,
      payment_method,
    } = parsed.data;

    // Validate hotel exists and is active
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotel_id },
      select: { id: true, name: true, onboardingStatus: true },
    });
    if (!hotel) throw Errors.notFound('Hotel');
    if (hotel.onboardingStatus !== 'active') throw Errors.validation('Hotel is not active for bill payments');

    // Validate OTA burn cap (max 10% of bill)
    const maxOtaBurn = Math.floor(bill_amount_paise * (OTA_BURN_CAP_PCT / 100));
    if (ota_coin_burn_paise > maxOtaBurn) {
      throw Errors.coinCapExceeded(
        `OTA coins cannot exceed ${OTA_BURN_CAP_PCT}% of bill amount (max ₹${(maxOtaBurn / 100).toFixed(2)})`
      );
    }

    // Validate ReZ burn cap (max 5% of bill)
    const maxRezBurn = Math.floor(bill_amount_paise * (REZ_BURN_CAP_PCT / 100));
    if (rez_coin_burn_paise > maxRezBurn) {
      throw Errors.coinCapExceeded(
        `ReZ coins cannot exceed ${REZ_BURN_CAP_PCT}% of bill amount (max ₹${(maxRezBurn / 100).toFixed(2)})`
      );
    }

    // Check user has sufficient balances
    const wallet = await prisma.coinWallet.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!wallet) throw Errors.internal('Wallet not found');

    if (ota_coin_burn_paise > 0 && wallet.otaCoinBalancePaise < ota_coin_burn_paise) {
      throw Errors.coinInsufficient();
    }
    if (rez_coin_burn_paise > 0 && wallet.rezCoinBalancePaise < rez_coin_burn_paise) {
      throw Errors.coinInsufficient();
    }

    // Calculate amounts
    const totalCoinBurn = ota_coin_burn_paise + rez_coin_burn_paise;
    const pgAmountPaise = bill_amount_paise - totalCoinBurn;
    const transactionFeePaise = Math.floor(bill_amount_paise * (TRANSACTION_FEE_PCT / 100));

    if (pgAmountPaise < 0) {
      throw Errors.validation('Coin burn amount exceeds bill amount');
    }

    // Coin earn preview
    const otaEarnPreviewPaise = Math.floor(bill_amount_paise * (OTA_EARN_PCT / 100));
    const rezEarnPreviewPaise = Math.floor(bill_amount_paise * (REZ_EARN_PCT / 100));

    // Generate unique payment ref
    const paymentRef = `BILLPAY-${crypto.randomUUID()}`;

    // Create Razorpay order (if PG payment needed)
    let razorpayOrderId: string | null = null;
    if (pgAmountPaise > 0) {
      const order = await PaymentService.createOrder(pgAmountPaise, paymentRef);
      razorpayOrderId = order.orderId;
    }

    // Create pending OfflinePayment record
    const payment = await prisma.offlinePayment.create({
      data: {
        hotelId: hotel_id,
        userId: req.user!.userId,
        amountPaise: pgAmountPaise,
        billAmountPaise: bill_amount_paise,
        paymentRef,
        razorpayOrderId: razorpayOrderId ?? undefined,
        otaCoinBurnedPaise: ota_coin_burn_paise,
        rezCoinBurnedPaise: rez_coin_burn_paise,
        transactionFeePaise,
        stayDate: stay_date ? new Date(stay_date) : undefined,
        notes: notes ?? undefined,
        paymentMethod: payment_method ?? undefined,
        status: 'pending',
      },
    });

    res.json({
      payment_id: payment.id,
      payment_ref: paymentRef,
      razorpay_order_id: razorpayOrderId,
      bill_amount_paise,
      pg_amount_paise: pgAmountPaise,
      ota_coin_burn_paise,
      rez_coin_burn_paise,
      transaction_fee_paise: transactionFeePaise,
      coin_earn_preview: {
        ota_coin_paise: otaEarnPreviewPaise,
        rez_coin_paise: rezEarnPreviewPaise,
      },
      hotel: { id: hotel.id, name: hotel.name },
    });
  })
);

// ─── POST /offline-payment/confirm ──────────────────────────────────────────

router.post(
  '/offline-payment/confirm',
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation('Invalid confirmation data', { errors: parsed.error.flatten() });
    }

    const { payment_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    // Find payment and verify ownership
    const payment = await prisma.offlinePayment.findUnique({
      where: { id: payment_id },
      include: { hotel: { select: { id: true, name: true } } },
    });

    if (!payment) throw Errors.notFound('Payment');
    if (payment.userId !== req.user!.userId) throw Errors.forbidden();
    if (payment.status !== 'pending') {
      throw Errors.validation(`Payment is already ${payment.status}`);
    }

    // Verify Razorpay signature (skip if no PG payment)
    if (payment.amountPaise > 0 && payment.razorpayOrderId) {
      const valid = PaymentService.verifyPaymentSignature(
        payment.razorpayOrderId,
        razorpay_payment_id,
        razorpay_signature
      );
      if (!valid) throw Errors.paymentFailed('Invalid payment signature');
    }

    // Burn coins if applied
    if (payment.otaCoinBurnedPaise > 0) {
      await CoinService.burnCoins({
        userId: payment.userId,
        coinType: 'ota',
        amountPaise: payment.otaCoinBurnedPaise,
        bookingId: payment.id,
      });
    }

    if (payment.rezCoinBurnedPaise > 0) {
      await CoinService.burnCoins({
        userId: payment.userId,
        coinType: 'rez',
        amountPaise: payment.rezCoinBurnedPaise,
        bookingId: payment.id,
      });
    }

    // Calculate coin earn (2% OTA + 4% ReZ of bill amount)
    const billAmount = payment.billAmountPaise ?? payment.amountPaise;
    const otaCoinEarnedPaise = Math.floor(billAmount * (OTA_EARN_PCT / 100));
    const rezCoinEarnedPaise = Math.floor(billAmount * (REZ_EARN_PCT / 100));

    // Find or use a fallback earn rule for hotel_qr channel
    const earnRule = await CoinService.findEarnRule({
      coinType: 'ota',
      channelSource: 'hotel_qr',
      hotelId: payment.hotelId,
      userTier: req.user!.tier,
      bookingValue: billAmount,
    });

    // Earn OTA coins
    if (otaCoinEarnedPaise > 0 && earnRule) {
      await CoinService.earnCoins({
        userId: payment.userId,
        coinType: 'ota',
        amountPaise: otaCoinEarnedPaise,
        bookingId: payment.id,
        earnRuleId: earnRule.id,
      });
    }

    // Earn ReZ coins (find rez earn rule)
    const rezEarnRule = await CoinService.findEarnRule({
      coinType: 'rez',
      channelSource: 'hotel_qr',
      hotelId: payment.hotelId,
      userTier: req.user!.tier,
      bookingValue: billAmount,
    });

    if (rezCoinEarnedPaise > 0 && rezEarnRule) {
      await CoinService.earnCoins({
        userId: payment.userId,
        coinType: 'rez',
        amountPaise: rezCoinEarnedPaise,
        bookingId: payment.id,
        earnRuleId: rezEarnRule.id,
      });
    }

    // Update payment to completed
    await prisma.offlinePayment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        razorpayPaymentId: razorpay_payment_id,
        otaCoinEarnedPaise: earnRule ? otaCoinEarnedPaise : 0,
        rezCoinEarnedPaise: rezEarnRule ? rezCoinEarnedPaise : 0,
      },
    });

    res.json({
      success: true,
      payment_id: payment.id,
      payment_ref: payment.paymentRef,
      hotel: { id: payment.hotel.id, name: payment.hotel.name },
      bill_amount_paise: billAmount,
      amount_paid_paise: payment.amountPaise,
      coins_earned: {
        ota_coin_paise: earnRule ? otaCoinEarnedPaise : 0,
        rez_coin_paise: rezEarnRule ? rezCoinEarnedPaise : 0,
      },
    });
  })
);

// ─── GET /offline-payment/history ───────────────────────────────────────────

router.get(
  '/offline-payment/history',
  authenticateUser,
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, qInt(req, 'page') || 1);
    const perPage = Math.min(50, Math.max(1, qInt(req, 'per_page') || 20));

    const [payments, total] = await Promise.all([
      prisma.offlinePayment.findMany({
        where: { userId: req.user!.userId, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          hotel: { select: { id: true, name: true, city: true } },
        },
      }),
      prisma.offlinePayment.count({
        where: { userId: req.user!.userId, status: 'completed' },
      }),
    ]);

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        payment_ref: p.paymentRef,
        hotel: p.hotel,
        bill_amount_paise: p.billAmountPaise ?? p.amountPaise,
        amount_paid_paise: p.amountPaise,
        ota_coin_earned_paise: p.otaCoinEarnedPaise,
        rez_coin_earned_paise: p.rezCoinEarnedPaise,
        ota_coin_burned_paise: p.otaCoinBurnedPaise,
        rez_coin_burned_paise: p.rezCoinBurnedPaise,
        transaction_fee_paise: p.transactionFeePaise,
        stay_date: p.stayDate,
        created_at: p.createdAt,
      })),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  })
);

// ─── GET /hotel/bill-payments (hotel staff) ──────────────────────────────────

router.get(
  '/hotel/bill-payments',
  authenticateHotelStaff,
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, qInt(req, 'page') || 1);
    const perPage = Math.min(50, Math.max(1, qInt(req, 'per_page') || 20));
    const hotelId = req.hotelStaff!.hotelId;

    const [payments, total] = await Promise.all([
      prisma.offlinePayment.findMany({
        where: { hotelId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: { select: { id: true, phone: true, fullName: true } },
        },
      }),
      prisma.offlinePayment.count({ where: { hotelId } }),
    ]);

    res.json({
      payments: payments.map((p) => ({
        id: p.id,
        payment_ref: p.paymentRef,
        user: {
          id: p.user.id,
          name: p.user.fullName,
          phone: p.user.phone,
        },
        bill_amount_paise: p.billAmountPaise ?? p.amountPaise,
        amount_paid_paise: p.amountPaise,
        ota_coin_earned_paise: p.otaCoinEarnedPaise,
        rez_coin_earned_paise: p.rezCoinEarnedPaise,
        transaction_fee_paise: p.transactionFeePaise,
        status: p.status,
        stay_date: p.stayDate,
        created_at: p.createdAt,
      })),
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  })
);

export default router;
