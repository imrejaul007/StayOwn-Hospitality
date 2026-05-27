import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import {
  initiatePayment,
  processWebhook,
  getPaymentById,
  getPaymentByBooking,
  getPaymentHistory,
  getHostPayoutHistory,
  createPayout,
  processRefund,
} from '../../services';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { authMiddleware, AuthenticatedRequest } from '../../integrations/rez-auth';

const router = Router();
const paymentLogger = logger.child({ service: 'PaymentRoutes' });

// ─── Helper Functions ──────────────────────────────────────────────────────────

function verifyRazorpaySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

// ── Validation Schemas ──────────────────────────────────────────────────────────

const initiatePaymentSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
  method: z.enum(['card', 'upi', 'netbanking', 'wallet']).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const payoutSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  hostId: z.string().min(1, 'Host ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
});

const refundSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().positive('Amount must be positive').optional(),
  reason: z.string().max(500).optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/habixo/payments
 * Initiate a payment
 * Requires authentication
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = initiatePaymentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await initiatePayment(validation.data);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    if (error instanceof Error && error.name === 'ConflictError') {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }
    paymentLogger.error({ error, body: req.body }, 'Failed to initiate payment');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initiate payment',
    });
  }
});

/**
 * POST /api/habixo/payments/webhook
 * Process payment webhook (Razorpay/Stripe)
 * CRITICAL: Signature verification enabled
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string ||
      req.headers['stripe-signature'] as string;

    const webhookSecret = config.razorpay.keySecret || process.env.RAZORPAY_WEBHOOK_SECRET;

    // CRITICAL: Verify signature when available
    if (signature && webhookSecret) {
      const bodyString = JSON.stringify(req.body);
      const isValid = verifyRazorpaySignature(bodyString, signature, webhookSecret);

      if (!isValid) {
        paymentLogger.warn({ ip: req.ip }, 'Invalid webhook signature rejected');
        res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
        return;
      }
    } else if (!signature) {
      paymentLogger.warn({ ip: req.ip }, 'Webhook missing signature');
      res.status(401).json({
        success: false,
        message: 'Missing webhook signature'
      });
      return;
    } else {
      paymentLogger.warn('Webhook signature verification skipped - no secret configured');
    }

    const result = await processWebhook({
      event: req.body.event,
      payload: req.body.payload || req.body,
      signature,
    });

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
      });
    }
  } catch (error) {
    paymentLogger.error({ error }, 'Failed to process webhook');
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
    });
  }
});

/**
 * GET /api/habixo/payments/:paymentId
 * Get payment by ID
 * Requires authentication
 */
router.get('/:paymentId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await getPaymentById(req.params.paymentId);
    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
      return;
    }
    paymentLogger.error({ error, paymentId: req.params.paymentId }, 'Failed to get payment');
    res.status(500).json({
      success: false,
      message: 'Failed to get payment',
    });
  }
});

/**
 * GET /api/habixo/payments/booking/:bookingId
 * Get payment by booking ID
 * Requires authentication
 */
router.get('/booking/:bookingId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await getPaymentByBooking(req.params.bookingId);
    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found for this booking',
      });
      return;
    }
    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    paymentLogger.error({ error, bookingId: req.params.bookingId }, 'Failed to get payment');
    res.status(500).json({
      success: false,
      message: 'Failed to get payment',
    });
  }
});

/**
 * GET /api/habixo/payments/history/:userId
 * Get payment history for user
 * Requires authentication
 */
router.get('/history/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { type, status, page, limit } = req.query;

    const result = await getPaymentHistory(userId, {
      type: type as 'booking' | 'payout' | 'refund' | undefined,
      status: status as 'pending' | 'completed' | 'failed' | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.payments,
      summary: result.summary,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    paymentLogger.error({ error, userId: req.params.userId }, 'Failed to get payment history');
    res.status(500).json({
      success: false,
      message: 'Failed to get payment history',
    });
  }
});

/**
 * GET /api/habixo/payments/payouts/:hostId
 * Get payout history for host
 * Requires authentication
 */
router.get('/payouts/:hostId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hostId } = req.params;
    const { status, page, limit } = req.query;

    const result = await getHostPayoutHistory(hostId, {
      status: status as 'pending' | 'completed' | 'failed' | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.payouts,
      summary: result.summary,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    paymentLogger.error({ error, hostId: req.params.hostId }, 'Failed to get payout history');
    res.status(500).json({
      success: false,
      message: 'Failed to get payout history',
    });
  }
});

/**
 * POST /api/habixo/payments/payout
 * Create a payout for host
 * Requires authentication
 */
router.post('/payout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = payoutSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const payment = await createPayout(validation.data);
    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    paymentLogger.error({ error, body: req.body }, 'Failed to create payout');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create payout',
    });
  }
});

/**
 * POST /api/habixo/payments/refund
 * Process refund
 * Requires authentication
 */
router.post('/refund', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = refundSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { paymentId, amount, reason } = validation.data;
    const payment = await processRefund(paymentId, amount, reason);
    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    paymentLogger.error({ error, body: req.body }, 'Failed to process refund');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to process refund',
    });
  }
});

export default router;
