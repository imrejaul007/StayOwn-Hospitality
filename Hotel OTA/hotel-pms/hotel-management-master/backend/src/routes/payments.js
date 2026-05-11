import express from 'express';
import Joi from 'joi';
import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import POSOrder from '../models/POSOrder.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { validate, schemas } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { CircuitBreaker } from '../utils/circuitBreaker.js';
import { enforceIdempotency } from '../middleware/idempotency.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import billingService from '../modules/billing/service.js';
import bookingAuditService from '../services/bookingAuditService.js';
import invoiceLifecycleSyncService from '../services/invoiceLifecycleSyncService.js';
import rateLimit from 'express-rate-limit';
import { checkPropertyAccess } from '../middleware/propertyAccess.js';

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const stripeBreaker = new CircuitBreaker({ name: 'stripe', failureThreshold: 5, resetTimeout: 30000, timeout: 30000 });
const idempotentFinancialMutation = enforceIdempotency({ namespace: 'payments' });
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

const assertBookingPropertyAccess = async (booking, user) => {
  if (!booking?.hotelId) {
    throw new ApplicationError('Booking hotel context is missing', 400);
  }

  const hasAccess = await checkPropertyAccess(user._id, booking.hotelId, user);
  if (!hasAccess) {
    throw new ApplicationError('You do not have access to this property', 403);
  }
};

function requireStripe() {
  if (!stripe) {
    throw new ApplicationError('Payment processing is not configured. Set STRIPE_SECRET_KEY.', 503);
  }
  return stripe;
}

// Rate limiting for payment operations
const financialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for financial operations
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many financial requests' } },
});

// All routes require authentication, rate limiting, and property access
router.use(financialLimiter);
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /payments/intent:
 *   post:
 *     summary: Create payment intent
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *             properties:
 *               bookingId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 */
router.post('/intent',
  authenticate,
  ensureTenantContext,
  authorizePolicy('payments', 'createIntent'),
  idempotentFinancialMutation,
  validate(schemas.createPaymentIntent),
  catchAsync(async (req, res) => {
    const { bookingId, currency = 'INR' } = req.body;
    const result = await billingService.createBookingPaymentIntent({
      bookingId,
      currency,
      requestHeaders: req.headers,
      requestUserId: req.user._id,
      createPaymentIntent: (payload, stripeOptions) => stripeBreaker.execute(
        () => requireStripe().paymentIntents.create(payload, stripeOptions),
        () => { throw new Error('Payment service temporarily unavailable. Please try again.'); }
      )
    });

    res.json({
      status: 'success',
      data: {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId
      }
    });
  })
);

/**
 * @swagger
 * /payments/confirm:
 *   post:
 *     summary: Confirm payment (server-side)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed successfully
 */
router.post('/confirm',
  authenticate,
  ensureTenantContext,
  authorizePolicy('payments', 'confirmIntent'),
  idempotentFinancialMutation,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { paymentIntentId } = req.body;
    const paymentIntentSummary = await billingService.confirmPaymentIntent({
      paymentIntentId,
      retrievePaymentIntent: (intentId) => stripeBreaker.execute(
        () => requireStripe().paymentIntents.retrieve(intentId),
        () => { throw new Error('Payment service temporarily unavailable. Please try again.'); }
      )
    });

    res.json({
      status: 'success',
      data: {
        paymentIntent: paymentIntentSummary
      }
    });
  })
);

/**
 * @swagger
 * /payments/extra-person-charges/intent:
 *   post:
 *     summary: Create payment intent for extra person charges
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - extraPersonCharges
 *             properties:
 *               bookingId:
 *                 type: string
 *               extraPersonCharges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     personId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     description:
 *                       type: string
 *               currency:
 *                 type: string
 *                 default: INR
 *     responses:
 *       200:
 *         description: Payment intent created for extra person charges
 */
router.post('/extra-person-charges/intent',
  authenticate,
  ensureTenantContext,
  authorizePolicy('payments', 'createExtraPersonIntent'),
  idempotentFinancialMutation,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { bookingId, extraPersonCharges, currency = 'INR' } = req.body;

    // Get booking
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }
    await assertBookingPropertyAccess(booking, req.user);

    // Check permissions - only admin/staff/manager/frontdesk can create extra person charge payments
    // (aligned with RBAC policy payments.createExtraPersonIntent)
    if (!['admin', 'staff', 'manager', 'frontdesk'].includes(req.user.role)) {
      throw new ApplicationError('Only authorized staff can process extra person charges', 403);
    }

    // Calculate total extra person charges
    const totalExtraCharges = extraPersonCharges.reduce((sum, charge) => sum + charge.amount, 0);

    if (totalExtraCharges <= 0) {
      throw new ApplicationError('Extra person charges must be greater than 0', 400);
    }

    // Support idempotency key to prevent duplicate payment intents
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const stripeOptions = idempotencyKey ? { idempotencyKey } : {};

    // Create Stripe Payment Intent (with circuit breaker)
    const paymentIntent = await stripeBreaker.execute(
      () => requireStripe().paymentIntents.create({
        amount: Math.round(totalExtraCharges * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
          bookingId: bookingId,
          paymentType: 'extra_person_charges',
          processedBy: req.user._id.toString(),
          bookingNumber: booking.bookingNumber,
          extraPersonCount: extraPersonCharges.length.toString()
        },
        description: `Extra person charges for booking ${booking.bookingNumber}`,
        automatic_payment_methods: {
          enabled: true,
        },
      }, stripeOptions),
      () => { throw new Error('Payment service temporarily unavailable. Please try again.'); }
    );

    // Create payment record
    await Payment.create({
      bookingId,
      hotelId: booking.hotelId,
      stripePaymentIntentId: paymentIntent.id,
      amount: totalExtraCharges,
      currency: currency.toUpperCase(),
      status: 'pending',
      paymentMethod: 'card',
      metadata: new Map([
        ['paymentType', 'extra_person_charges'],
        ['processedBy', req.user._id.toString()],
        ['extraPersonCount', extraPersonCharges.length.toString()],
        ['chargeDetails', JSON.stringify(extraPersonCharges)]
      ])
    });

    res.json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalExtraCharges,
        currency: currency.toUpperCase()
      }
    });
  })
);

/**
 * @swagger
 * /payments/settlement/intent:
 *   post:
 *     summary: Create payment intent for settlement
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - settlementId
 *               - amount
 *             properties:
 *               settlementId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: INR
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment intent created for settlement
 */
router.post('/settlement/intent',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('payments', 'createSettlementIntent'),
  idempotentFinancialMutation,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { settlementId, amount, currency = 'INR', description = '' } = req.body;

    // Import Settlement model
    const Settlement = (await import('../models/Settlement.js')).default;

    // Get settlement with full booking details including hotel
    const settlement = await Settlement.findById(settlementId).populate({
      path: 'bookingId',
      populate: { path: 'hotelId' }
    }).lean();

    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    // CRITICAL FIX: Multi-property validation using checkPropertyAccess
    const { checkPropertyAccess } = await import('../middleware/propertyAccess.js');
    const hasAccess = await checkPropertyAccess(
      req.user._id,
      settlement.bookingId.hotelId._id,
      req.user
    );

    // Check permissions - operational staff with property access or booking owner
    const isBookingOwner = settlement.bookingId.userId.toString() === req.user._id.toString();
    const isStaffWithAccess = ['admin', 'staff', 'manager', 'frontdesk'].includes(req.user.role) && hasAccess;

    if (!isBookingOwner && !isStaffWithAccess) {
      throw new ApplicationError('You do not have permission to pay this settlement', 403);
    }

    if (amount <= 0) {
      throw new ApplicationError('Settlement amount must be greater than 0', 400);
    }
    if (settlement.outstandingBalance != null && amount > settlement.outstandingBalance) {
      throw new ApplicationError('Settlement payment exceeds outstanding balance', 400);
    }

    // CRITICAL FIX: Proper rounding for INR (smallest unit = paisa = 1/100 rupee)
    // Stripe expects amount in smallest currency unit (paisa for INR)
    const amountInPaisa = Math.round(amount * 100);

    // Support idempotency key to prevent duplicate payment intents
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const stripeOptions = idempotencyKey ? { idempotencyKey } : {};

    // Create Stripe Payment Intent (with circuit breaker)
    const paymentIntent = await stripeBreaker.execute(
      () => requireStripe().paymentIntents.create({
        amount: amountInPaisa,
        currency: currency.toLowerCase(),
        metadata: {
          settlementId: settlementId,
          bookingId: settlement.bookingId._id.toString(),
          paymentType: 'settlement',
          paidBy: req.user._id.toString(),
          bookingNumber: settlement.bookingId.bookingNumber
        },
        description: description || `Settlement payment for booking ${settlement.bookingId.bookingNumber}`,
        automatic_payment_methods: {
          enabled: true,
        },
      }, stripeOptions),
      () => { throw new Error('Payment service temporarily unavailable. Please try again.'); }
    );

    // Create payment record
    await Payment.create({
      bookingId: settlement.bookingId._id,
      hotelId: settlement.bookingId.hotelId,
      stripePaymentIntentId: paymentIntent.id,
      amount: amount,
      currency: currency.toUpperCase(),
      status: 'pending',
      paymentMethod: 'card',
      metadata: new Map([
        ['paymentType', 'settlement'],
        ['settlementId', settlementId],
        ['paidBy', req.user._id.toString()]
      ])
    });

    res.json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency: currency.toUpperCase()
      }
    });
  })
);

/**
 * @swagger
 * /payments/refund:
 *   post:
 *     summary: Create refund
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund created successfully
 */
router.post('/refund',
  authenticate,
  ensureTenantContext,
  authorizePolicy('payments', 'refund'),
  idempotentFinancialMutation,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { paymentIntentId, amount, reason } = req.body;

    if (!paymentIntentId) {
      throw new ApplicationError('Payment Intent ID is required', 400);
    }

    // Find payment record
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId })
      .populate('bookingId');

    if (!payment) {
      throw new ApplicationError('Payment not found', 404);
    }
    await assertBookingPropertyAccess(payment.bookingId, req.user);

    // Check permissions (admin/staff or booking owner)
    if (req.user.role === 'guest' && 
        payment.bookingId.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You do not have permission to refund this payment', 403);
    }

    // Validate refund amount doesn't exceed remaining refundable amount
    if (amount) {
      const totalRefunded = (payment.refunds || []).reduce((sum, r) => sum + (r.amount || 0), 0);
      if ((totalRefunded + amount) > payment.amount) {
        throw new ApplicationError(
          `Refund amount (${amount}) would exceed remaining refundable amount (${payment.amount - totalRefunded})`,
          400
        );
      }
    }

    const bookingBeforeRefund = bookingAuditService.buildSnapshot(payment.bookingId);

    // Create refund in Stripe (with circuit breaker)
    const refund = await stripeBreaker.execute(
      () => requireStripe().refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
        reason: reason || 'requested_by_customer',
        metadata: {
          bookingId: payment.bookingId._id.toString(),
          refundedBy: req.user._id.toString()
        }
      }),
      () => { throw new Error('Payment service temporarily unavailable. Please try again.'); }
    );

    // Keep booking/payment state in sync with a single transaction.
    const paymentRecordStatus = refund.amount === payment.amount * 100 ? 'refunded' : 'partially_refunded';
    const bookingPaymentStatus = refund.amount === payment.amount * 100 ? 'refunded' : 'partially_paid';
    const session = await Payment.startSession();
    try {
      await session.withTransaction(async () => {
        await Payment.findByIdAndUpdate(
          payment._id,
          {
            $push: {
              refunds: {
                stripeRefundId: refund.id,
                amount: refund.amount / 100,
                reason: refund.reason
              }
            },
            $set: { status: paymentRecordStatus }
          },
          { new: true, session }
        );

        await Booking.findByIdAndUpdate(
          payment.bookingId._id,
          { paymentStatus: bookingPaymentStatus },
          { new: true, session }
        );
      });
    } finally {
      await session.endSession();
    }

    try {
      await invoiceLifecycleSyncService.syncInvoiceAfterRefund({
        bookingId: payment.bookingId._id,
        refundAmount: refund.amount / 100,
        reason
      });
    } catch (error) {
      invoiceLifecycleSyncService.logSyncFailure(
        { bookingId: payment.bookingId._id, flow: 'payment-refund' },
        error
      );
    }

    await bookingAuditService.logBookingMutation({
      booking: {
        ...payment.bookingId.toObject(),
        paymentStatus: bookingPaymentStatus
      },
      changeType: 'update',
      user: req.user,
      req,
      oldValues: bookingBeforeRefund,
      newValues: {
        ...bookingBeforeRefund,
        paymentStatus: bookingPaymentStatus
      },
      metadata: {
        priority: 'high',
        tags: ['payment_refund'],
        paymentIntentId,
        refundAmount: refund.amount / 100
      }
    });

    res.json({
      status: 'success',
      data: {
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status
        }
      }
    });
  })
);

// Look up a payment by Stripe payment intent ID
router.get('/intent/:paymentIntentId', authenticate, ensureTenantContext, authorizePolicy('payments', 'confirmIntent'), catchAsync(async (req, res) => {
  const { paymentIntentId } = req.params;

  if (!paymentIntentId) {
    throw new ApplicationError('Payment intent ID is required', 400);
  }

  // SECURITY: Enforce tenant isolation. Always use the hotelId resolved by
  // ensureTenantContext (req.tenantId) — fall back to req.user.hotelId for
  // users that are assigned to a single hotel.  If neither is available the
  // request is rejected so cross-hotel payment lookups are impossible.
  const tenantHotelId = req.tenantId || req.user?.hotelId;

  if (!tenantHotelId) {
    throw new ApplicationError('Hotel context is required', 400);
  }

  const payment = await Payment.findOne({
    stripePaymentIntentId: paymentIntentId,
    hotelId: tenantHotelId
  }).lean();

  if (!payment) {
    throw new ApplicationError('Payment not found', 404);
  }

  res.json({
    status: 'success',
    data: { payment }
  });
}));

// Food ordering payment methods

// Process room charge payment for food orders
router.post('/room-charge', authenticate, ensureTenantContext, authorizePolicy('payments', 'roomCharge'), idempotentFinancialMutation, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { orderId, amount, currency = 'INR', roomNumber, bookingId, items } = req.body;

  if (!amount || !bookingId) {
    throw new ApplicationError('Amount and booking ID are required', 400);
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }
  await assertBookingPropertyAccess(booking, req.user);

  if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Access denied', 403);
  }

  const bookingBeforeRoomCharge = bookingAuditService.buildSnapshot(booking);

  const reference = `RC-${Date.now()}`;
  const paymentData = {
    method: 'room_charge',
    status: 'paid',
    paymentDetails: { roomChargeReference: reference, roomNumber, bookingId }
  };

  // Atomic POS order update
  if (orderId) {
    const updatedOrder = await POSOrder.findOneAndUpdate(
      { _id: orderId, hotelId: booking.hotelId },
      { $set: { payment: paymentData } },
      { new: true }
    );
    if (!updatedOrder) {
      throw new ApplicationError('POS order not found for booking property', 404);
    }
  }

  booking.addSettlementAdjustment({
    type: 'service_charge',
    amount: parseFloat(amount),
    description: `Room service order - ${items?.length || 0} items`
  }, {
    userId: req.user._id,
    userName: req.user.name,
    userRole: req.user.role === 'guest' ? 'staff' : req.user.role
  });

  await booking.save();

  await bookingAuditService.logBookingMutation({
    booking,
    changeType: 'update',
    user: req.user,
    req,
    oldValues: bookingBeforeRoomCharge,
    newValues: bookingAuditService.buildSnapshot(booking),
    metadata: {
      priority: 'high',
      tags: ['room_charge'],
      roomChargeAmount: parseFloat(amount),
      orderId: orderId || null,
      reference
    }
  });

  res.json({
    success: true,
    message: 'Amount added to room charges successfully',
    data: { transactionId: reference, amount, currency, paymentMethod: 'room_charge', status: 'paid' }
  });
}));

// Process cash on delivery for food orders
router.post('/cash-on-delivery', authenticate, ensureTenantContext, authorizePolicy('payments', 'cashOnDelivery'), idempotentFinancialMutation, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { orderId, amount, currency = 'INR', roomNumber } = req.body;

  if (!amount) {
    throw new ApplicationError('Amount is required', 400);
  }

  const reference = `COD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const paymentData = {
    method: 'cash',
    status: 'pending',
    paymentDetails: { reference, deliveryAddress: roomNumber ? `Room ${roomNumber}` : 'Guest location' }
  };

  // Atomic POS order update
  if (orderId) {
    const order = await POSOrder.findById(orderId).lean();
    if (!order) {
      throw new ApplicationError('POS order not found', 404);
    }
    const hasOrderAccess = await checkPropertyAccess(req.user._id, order.hotelId, req.user);
    if (!hasOrderAccess) {
      throw new ApplicationError('You do not have permission for this POS order', 403);
    }
    await POSOrder.findByIdAndUpdate(orderId, { $set: { payment: paymentData } }, { new: true });
  }

  res.json({
    success: true,
    message: 'Cash on delivery order created successfully',
    data: { transactionId: reference, amount: parseFloat(amount), currency, paymentMethod: 'cash', status: 'pending' }
  });
}));

export default router;
