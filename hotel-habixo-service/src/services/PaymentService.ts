import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Booking } from '../models';

const paymentLogger = logger.child({ service: 'PaymentService' });

// ── Payment Model ──────────────────────────────────────────────────────────────

export interface IPayment extends Document {
  paymentId: string;
  bookingId?: string;
  userId: string;
  hostId?: string;
  amount: number;
  currency: string;
  type: 'booking' | 'payout' | 'refund' | 'security_deposit';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  method?: 'card' | 'upi' | 'netbanking' | 'wallet' | 'bank_transfer';
  provider?: 'razorpay' | 'stripe' | 'internal';
  providerReference?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  refundAmount?: number;
  refundReason?: string;
  webhookLogs: Array<{
    event: string;
    receivedAt: Date;
    processed: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true },
    bookingId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    hostId: { type: String, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    type: {
      type: String,
      required: true,
      enum: ['booking', 'payout', 'refund', 'security_deposit'],
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    method: {
      type: String,
      enum: ['card', 'upi', 'netbanking', 'wallet', 'bank_transfer'],
    },
    provider: {
      type: String,
      enum: ['razorpay', 'stripe', 'internal'],
      default: 'razorpay',
    },
    providerReference: { type: String, index: true },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed },
    refundAmount: { type: Number },
    refundReason: { type: String },
    webhookLogs: [
      {
        event: String,
        receivedAt: { type: Date, default: Date.now },
        processed: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

PaymentSchema.index({ paymentId: 1 }, { unique: true });
PaymentSchema.index({ bookingId: 1, status: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ hostId: 1, createdAt: -1 });
PaymentSchema.index({ providerReference: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InitiatePaymentInput {
  bookingId: string;
  userId: string;
  amount: number;
  currency?: string;
  method?: 'card' | 'upi' | 'netbanking' | 'wallet';
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentWebhookInput {
  event: string;
  payload: Record<string, unknown>;
  signature?: string;
}

export interface PayoutInput {
  bookingId: string;
  hostId: string;
  amount: number;
  currency?: string;
}

// ── Service Functions ───────────────────────────────────────────────────────────

/**
 * Generate a secure signature for webhook verification
 */
function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Initiate a payment
 */
export async function initiatePayment(
  input: InitiatePaymentInput
): Promise<{
  payment: IPayment;
  paymentUrl?: string;
  orderId?: string;
}> {
  const { bookingId, userId, amount, currency = 'INR', method, description, metadata } = input;

  // Verify booking exists
  const booking = await Booking.findOne({ bookingId }).lean();
  if (!booking) {
    throw new NotFoundError('Booking', bookingId);
  }

  // Check if payment already exists
  const existingPayment = await Payment.findOne({
    bookingId,
    status: { $nin: ['failed', 'refunded'] },
  });

  if (existingPayment) {
    throw new ConflictError('Payment already exists for this booking');
  }

  // Validate amount
  if (amount <= 0) {
    throw new ValidationError('Invalid payment amount');
  }

  const paymentId = `PAY-${uuidv4().substring(0, 8).toUpperCase()}`;

  // In production, this would call Razorpay/Stripe API
  // For now, we create an internal payment record
  const payment = new Payment({
    paymentId,
    bookingId,
    userId,
    hostId: booking.hostId,
    amount,
    currency,
    type: 'booking',
    status: 'pending',
    method,
    provider: 'razorpay',
    description: description || `Payment for booking ${bookingId}`,
    metadata,
  });

  await payment.save();
  paymentLogger.info({ paymentId, bookingId, userId, amount }, 'Payment initiated');

  // In production: Create order with payment provider
  // const razorpayOrder = await razorpay.orders.create({ ... });

  return {
    payment,
    // In production: return { orderId: razorpayOrder.id, paymentUrl: razorpayOrder.short_url }
  };
}

/**
 * Process payment webhook
 */
export async function processWebhook(input: PaymentWebhookInput): Promise<{
  success: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
}> {
  const { event, payload } = input;

  try {
    const paymentId = payload.payment_id as string;
    const status = payload.status as string;

    if (!paymentId) {
      return { success: false, error: 'Missing payment_id' };
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      paymentLogger.warn({ paymentId }, 'Payment not found for webhook');
      return { success: false, error: 'Payment not found' };
    }

    // Log webhook event
    payment.webhookLogs.push({
      event,
      receivedAt: new Date(),
      processed: false,
    });

    // Process based on event
    switch (event) {
      case 'payment.captured':
      case 'payment.success':
        payment.status = 'completed';
        payment.providerReference = (payload.id || payload.receipt) as string;

        // Update booking status
        if (payment.bookingId) {
          await Booking.updateOne(
            { bookingId: payment.bookingId },
            { $set: { 'paymentStatus': 'paid' } }
          );
        }
        break;

      case 'payment.failed':
        payment.status = 'failed';
        payment.metadata = { ...payment.metadata, failureReason: payload.error_message };
        break;

      case 'refund.created':
        payment.status = 'refunded';
        payment.refundAmount = payload.amount_refunded as number;
        payment.refundReason = payload.refund_reason as string;
        break;

      default:
        paymentLogger.info({ event, paymentId }, 'Unhandled webhook event');
    }

    // Mark webhook as processed
    const lastLog = payment.webhookLogs[payment.webhookLogs.length - 1];
    if (lastLog) {
      lastLog.processed = true;
    }

    await payment.save();
    paymentLogger.info({ paymentId, event, status }, 'Webhook processed');

    return { success: true, paymentId, status: payment.status };
  } catch (error) {
    paymentLogger.error({ error, event }, 'Webhook processing failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed',
    };
  }
}

/**
 * Get payment by ID
 */
export async function getPaymentById(paymentId: string): Promise<IPayment> {
  const payment = await Payment.findOne({ paymentId }).lean();
  if (!payment) {
    throw new NotFoundError('Payment', paymentId);
  }
  return payment as unknown as IPayment;
}

/**
 * Get payment by booking ID
 */
export async function getPaymentByBooking(bookingId: string): Promise<IPayment | null> {
  return (await Payment.findOne({ bookingId }).lean()) as unknown as IPayment | null;
}

/**
 * Get payment history for user
 */
export async function getPaymentHistory(
  userId: string,
  options: {
    type?: 'booking' | 'payout' | 'refund';
    status?: 'pending' | 'completed' | 'failed';
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  payments: IPayment[];
  total: number;
  page: number;
  totalPages: number;
  summary: {
    totalSpent: number;
    totalPending: number;
    totalRefunded: number;
  };
}> {
  const { type, status, page = 1, limit = 20 } = options;

  const query: Record<string, unknown> = { userId };
  if (type) query.type = type;
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(query),
  ]);

  // Calculate summary
  const summaryResult = await Payment.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalSpent: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$type', 'booking'] }, { $eq: ['$status', 'completed'] }] },
              '$amount',
              0,
            ],
          },
        },
        totalPending: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0],
          },
        },
        totalRefunded: {
          $sum: {
            $cond: [{ $eq: ['$status', 'refunded'] }, '$refundAmount', 0],
          },
        },
      },
    },
  ]);

  const summary = summaryResult[0] || {
    totalSpent: 0,
    totalPending: 0,
    totalRefunded: 0,
  };

  return {
    payments: payments as unknown as IPayment[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary: {
      totalSpent: summary.totalSpent,
      totalPending: summary.totalPending,
      totalRefunded: summary.totalRefunded,
    },
  };
}

/**
 * Get payment history for host (payouts)
 */
export async function getHostPayoutHistory(
  hostId: string,
  options: {
    status?: 'pending' | 'completed' | 'failed';
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  payouts: IPayment[];
  total: number;
  page: number;
  totalPages: number;
  summary: {
    totalEarnings: number;
    totalPending: number;
    totalPaidOut: number;
  };
}> {
  const { status, page = 1, limit = 20 } = options;

  const query: Record<string, unknown> = { hostId, type: 'payout' };
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [payouts, total] = await Promise.all([
    Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(query),
  ]);

  // Calculate summary
  const summaryResult = await Payment.aggregate([
    { $match: { hostId, type: 'payout' } },
    {
      $group: {
        _id: null,
        totalEarnings: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0],
          },
        },
        totalPending: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0],
          },
        },
        totalPaidOut: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0],
          },
        },
      },
    },
  ]);

  const summary = summaryResult[0] || {
    totalEarnings: 0,
    totalPending: 0,
    totalPaidOut: 0,
  };

  return {
    payouts: payouts as unknown as IPayment[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary: {
      totalEarnings: summary.totalEarnings,
      totalPending: summary.totalPending,
      totalPaidOut: summary.totalPaidOut,
    },
  };
}

/**
 * Create payout for host
 */
export async function createPayout(input: PayoutInput): Promise<IPayment> {
  const { bookingId, hostId, amount, currency = 'INR' } = input;

  // Verify booking exists
  const booking = await Booking.findOne({ bookingId }).lean();
  if (!booking) {
    throw new NotFoundError('Booking', bookingId);
  }

  if (booking.hostId !== hostId) {
    throw new ValidationError('Host not authorized for this booking');
  }

  if (amount <= 0) {
    throw new ValidationError('Invalid payout amount');
  }

  const paymentId = `PAY-${uuidv4().substring(0, 8).toUpperCase()}`;

  const payment = new Payment({
    paymentId,
    bookingId,
    userId: booking.guestId,
    hostId,
    amount,
    currency,
    type: 'payout',
    status: 'pending',
    provider: 'razorpay',
    description: `Payout for booking ${bookingId}`,
  });

  await payment.save();
  paymentLogger.info({ paymentId, bookingId, hostId, amount }, 'Payout created');

  return payment;
}

/**
 * Process refund
 */
export async function processRefund(
  paymentId: string,
  amount?: number,
  reason?: string
): Promise<IPayment> {
  const payment = await Payment.findOne({ paymentId });
  if (!payment) {
    throw new NotFoundError('Payment', paymentId);
  }

  if (payment.status !== 'completed') {
    throw new ValidationError('Can only refund completed payments');
  }

  const refundAmount = amount || payment.amount;

  if (refundAmount > payment.amount) {
    throw new ValidationError('Refund amount exceeds payment amount');
  }

  // In production: Call payment provider refund API
  // const refund = await razorpay.payments.refund(payment.providerReference, { amount: refundAmount });

  payment.status = 'refunded';
  payment.refundAmount = refundAmount;
  payment.refundReason = reason || 'Customer requested refund';

  await payment.save();
  paymentLogger.info({ paymentId, refundAmount, reason }, 'Refund processed');

  // Update booking
  if (payment.bookingId) {
    await Booking.updateOne(
      { bookingId: payment.bookingId },
      { $set: { paymentStatus: 'refunded' } }
    );
  }

  return payment;
}
