import { Router, Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/asyncHandler';
import { PmsService } from '../services/integrations/pms.service';
import { Errors } from '../utils/errors';
import { q } from '../utils/query';
import { handlePMSWebhook } from '../services/integrations/pmsWebhookService';
import { createServiceLogger } from '../config/logger';

const router = Router();
const logger = createServiceLogger('pms-routes');

// H-7: Rate limiting on webhook endpoints — prevents flooding with valid signatures
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many webhook requests' },
});

// Apply API-key authentication to all PMS management routes on this router
router.use(asyncHandler(async (req: Request, _res: Response, next: Function) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) throw Errors.forbidden();
  (req as any).pmsHotelId = await PmsService.validateApiKey(apiKey);
  next();
}));

/**
 * POST /pms/inventory/push
 */
router.post('/inventory/push', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = (req as any).pmsHotelId as string;
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    throw Errors.validation('updates array is required');
  }

  const result = await PmsService.pushInventory(hotelId, updates);
  res.json(result);
}));

/**
 * GET /pms/bookings
 */
router.get('/bookings', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = (req as any).pmsHotelId as string;
  const dateFrom = q(req, 'date_from');
  const dateTo = q(req, 'date_to');
  const status = q(req, 'status');

  const bookings = await PmsService.getBookings(hotelId, dateFrom, dateTo, status);
  res.json({ bookings });
}));

// ── PMS Webhook Endpoints ──
// H-7: Rate limiter applied first, then body parsing
const webhookRouter = Router();
webhookRouter.use(webhookRateLimiter);
webhookRouter.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

/**
 * @route   POST /api/webhooks/pms/reservation-confirmed
 * @desc    Handle PMS reservation confirmation events - award coins on booking
 * @access  Public (secured by HMAC-SHA256 signature verification)
 *
 * Headers:
 *   X-Signature — HMAC-SHA256 signature (required)
 *
 * Body:
 *   eventId: string — Unique event ID
 *   eventType: 'reservation.confirmed' — Event type
 *   timestamp: string — ISO 8601 timestamp
 *   hotelId: string — Hotel ID
 *   reservationData: object — Reservation details (id, guestEmail, totalPrice, etc.)
 */
webhookRouter.post('/pms/reservation-confirmed', asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('[PMS] Reservation confirmed webhook received', {
      eventId: req.body?.eventId,
      hotelId: req.body?.hotelId,
      reservationId: req.body?.reservationData?.reservationId,
    });

    const signature = req.headers['x-signature'] as string;
    const pmsId = req.headers['x-pms-id'] as string | undefined;
    const secret = process.env.PMS_WEBHOOK_SECRET || '';

    const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

    if (result.success) {
      logger.info('[PMS] Reservation processed — coins awarded', {
        hotelId: req.body?.hotelId,
        coinsAwarded: result.coinsAwarded,
        duplicate: result.duplicate,
      });
    }

    // M-3: Generic error responses in production — hide internal details
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      // message: only in development
      ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
      ...(result.coinsAwarded !== undefined && { coinsAwarded: result.coinsAwarded }),
      ...(result.duplicate !== undefined && { duplicate: result.duplicate }),
    });
  } catch (error) {
    logger.error('[PMS] Webhook handler error', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        // Never expose internal error details in production
        message: process.env.NODE_ENV === 'production' ? 'Webhook processing failed' : error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}));

/**
 * @route   POST /api/webhooks/pms/guest-checkin
 * @desc    Handle PMS guest check-in events
 * @access  Public (secured by HMAC-SHA256 signature verification)
 */
webhookRouter.post('/pms/guest-checkin', asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('[PMS] Guest check-in webhook received', {
      eventId: req.body?.eventId,
      hotelId: req.body?.hotelId,
    });

    const signature = req.headers['x-signature'] as string;
    const pmsId = req.headers['x-pms-id'] as string | undefined;
    const secret = process.env.PMS_WEBHOOK_SECRET || '';

    const result = await handlePMSWebhook(req.body, signature, secret, pmsId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error('[PMS] Check-in handler error', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Webhook processing failed' : error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}));

/**
 * @route   POST /api/webhooks/pms/guest-checkout
 * @desc    Handle PMS guest check-out events
 * @access  Public (secured by HMAC-SHA256 signature verification)
 */
webhookRouter.post('/pms/guest-checkout', asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('[PMS] Guest check-out webhook received', {
      eventId: req.body?.eventId,
      hotelId: req.body?.hotelId,
    });

    const signature = req.headers['x-signature'] as string;
    const pmsId = req.headers['x-pms-id'] as string | undefined;
    const secret = process.env.PMS_WEBHOOK_SECRET || '';

    const result = await handlePMSWebhook(req.body, signature, secret, pmsId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error('[PMS] Check-out handler error', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Webhook processing failed' : error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}));

/**
 * @route   POST /api/webhooks/pms/reservation-cancelled
 * @desc    Handle PMS reservation cancellation events - refund coins
 * @access  Public (secured by HMAC-SHA256 signature verification)
 */
webhookRouter.post('/pms/reservation-cancelled', asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('[PMS] Reservation cancelled webhook received', {
      eventId: req.body?.eventId,
      hotelId: req.body?.hotelId,
    });

    const signature = req.headers['x-signature'] as string;
    const pmsId = req.headers['x-pms-id'] as string | undefined;
    const secret = process.env.PMS_WEBHOOK_SECRET || '';

    const result = await handlePMSWebhook(req.body, signature, secret, pmsId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    logger.error('[PMS] Cancellation handler error', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Webhook processing failed' : error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}));

export default router;
export { webhookRouter };
