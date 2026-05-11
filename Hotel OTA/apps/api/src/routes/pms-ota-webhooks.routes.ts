/**
 * PMS ↔ OTA Webhook Routes
 *
 * Bidirectional webhook endpoints for Hotel PMS ↔ Hotel OTA integration.
 *
 * Mounted at:
 * - POST /api/webhooks/pms/*      — PMS→OTA events
 * - POST /api/webhooks/ota/*       — OTA→PMS events (for testing/internal use)
 *
 * Security:
 * - HMAC-SHA256 signature verification
 * - Rate limiting (100 req/min per IP)
 * - Timestamp validation (5-minute tolerance)
 * - Event deduplication (24-hour window)
 */

import { Router, Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import * as crypto from 'crypto';
import { asyncHandler } from '../middleware/asyncHandler';
import { handlePMSWebhook } from '../services/integrations/ota-pms-webhook-handler';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { PMSWebhookEventType, PMSWebhookPayload } from '../services/integrations/pms-ota-types';

const router = Router();

// ── Rate limiting ─────────────────────────────────────────────────────────────

const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many webhook requests' },
});

router.use(webhookRateLimiter);

// ── Raw body parser for signature verification ────────────────────────────────

const rawBodyParser = express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  },
});

// ── Signature verification helper ─────────────────────────────────────────────

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ── Webhook Handlers ─────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/pms/booking-confirmed
 * Handles PMS booking confirmation events
 */
router.post(
  '/pms/booking-confirmed',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS booking_confirmed webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      logger.info('[OTA] PMS booking_confirmed processed', {
        success: result.success,
        coinsAwarded: result.coinsAwarded,
        duplicate: result.duplicate,
      });

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
        ...(result.coinsAwarded !== undefined && { coinsAwarded: result.coinsAwarded }),
        ...(result.duplicate !== undefined && { duplicate: result.duplicate }),
      });
    } catch (error) {
      logger.error('[OTA] Booking confirmed handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/check-in
 * Handles PMS guest check-in events
 */
router.post(
  '/pms/check-in',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS check_in webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
        ...(result.duplicate !== undefined && { duplicate: result.duplicate }),
      });
    } catch (error) {
      logger.error('[OTA] Check-in handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/check-out
 * Handles PMS guest check-out events (awards brand coins)
 */
router.post(
  '/pms/check-out',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS check_out webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      logger.info('[OTA] PMS check_out processed', {
        success: result.success,
        brandCoinsAwarded: result.brandCoinsAwarded,
      });

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
        ...(result.brandCoinsAwarded !== undefined && { brandCoinsAwarded: result.brandCoinsAwarded }),
        ...(result.duplicate !== undefined && { duplicate: result.duplicate }),
      });
    } catch (error) {
      logger.error('[OTA] Check-out handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/room-status-change
 * Handles PMS room status change events
 */
router.post(
  '/pms/room-status-change',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS room_status_change webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
      });
    } catch (error) {
      logger.error('[OTA] Room status change handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/guest-data-update
 * Handles PMS guest data update events
 */
router.post(
  '/pms/guest-data-update',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS guest_data_updated webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
      });
    } catch (error) {
      logger.error('[OTA] Guest data update handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/pricing-change
 * Handles PMS pricing change events
 */
router.post(
  '/pms/pricing-change',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS pricing_changed webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
      });
    } catch (error) {
      logger.error('[OTA] Pricing change handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/housekeeping-status
 * Handles PMS housekeeping status events
 */
router.post(
  '/pms/housekeeping-status',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS housekeeping_status webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
      });
    } catch (error) {
      logger.error('[OTA] Housekeeping status handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/inventory-update
 * Handles PMS inventory update events
 */
router.post(
  '/pms/inventory-update',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS inventory_updated webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
      });
    } catch (error) {
      logger.error('[OTA] Inventory update handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/reservation-cancelled
 * Handles PMS reservation cancellation events
 */
router.post(
  '/pms/reservation-cancelled',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('[OTA] PMS reservation_cancelled webhook received', {
        eventId: req.body?.eventId,
        hotelId: req.body?.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(req.body, signature, secret, pmsId);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
      });
    } catch (error) {
      logger.error('[OTA] Reservation cancelled handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * POST /api/webhooks/pms/unified
 * Unified webhook endpoint that handles all PMS event types
 * Uses the eventType from the payload to dispatch to the correct handler
 */
router.post(
  '/pms/unified',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const payload = req.body as PMSWebhookPayload;

      logger.info('[OTA] PMS unified webhook received', {
        eventId: payload.eventId,
        eventType: payload.eventType,
        hotelId: payload.hotelId,
      });

      const signature = req.headers['x-signature'] as string;
      const pmsId = req.headers['x-pms-id'] as string | undefined;
      const secret = process.env.PMS_WEBHOOK_SECRET || '';

      const result = await handlePMSWebhook(payload, signature, secret, pmsId);

      logger.info('[OTA] PMS unified webhook processed', {
        success: result.success,
        eventType: payload.eventType,
      });

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message,
        ...(result.coinsAwarded !== undefined && { coinsAwarded: result.coinsAwarded }),
        ...(result.brandCoinsAwarded !== undefined && { brandCoinsAwarded: result.brandCoinsAwarded }),
        ...(result.duplicate !== undefined && { duplicate: result.duplicate }),
      });
    } catch (error) {
      logger.error('[OTA] Unified webhook handler error', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production'
            ? 'Webhook processing failed'
            : error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  })
);

/**
 * GET /api/webhooks/pms/health
 * Health check endpoint for PMS webhooks
 */
router.get('/pms/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'PMS→OTA Webhooks',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/webhooks/ota/test
 * Test endpoint for OTA webhooks (for internal testing)
 */
router.post(
  '/ota/test',
  rawBodyParser,
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('[OTA] Test webhook received', { body: req.body });

    res.json({
      success: true,
      message: 'Test webhook received',
      receivedAt: new Date().toISOString(),
    });
  })
);

export default router;
