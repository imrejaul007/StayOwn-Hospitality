/**
 * REZ OTA Webhook Routes
 * Mounted at: POST /api/v1/ota-webhooks/rez-ota
 *
 * Hotel OTA pushes events here when bookings are confirmed or cancelled.
 * Secured by x-webhook-signature HMAC-SHA256.
 */

import express from 'express';
import {
  handleOtaBookingConfirmed,
  handleOtaBookingCancelled,
  verifyOtaWebhookSignature,
} from '../services/rezOtaConnector.js';
import logger from '../utils/logger.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// ── Signature verification ────────────────────────────────────────────────────

function verifySignature(req, res, next) {
  const signature = req.headers['x-webhook-signature'];
  if (!signature && process.env.NODE_ENV !== 'production') {
    logger.warn('[RezOtaWebhook] No signature — allowed in dev mode');
    return next();
  }
  if (!signature) {
    return res.status(401).json({ error: 'Missing x-webhook-signature' });
  }

  // Distinguish misconfiguration (no secret) from bad signature — return 503 so
  // monitoring alerts fire instead of silently failing as a 401 auth error.
  if (!process.env.REZ_OTA_WEBHOOK_SECRET) {
    logger.error('[RezOtaWebhook] REZ_OTA_WEBHOOK_SECRET not configured — cannot verify signature');
    return res.status(503).json({ error: 'Webhook service misconfigured', code: 'MISSING_SECRET' });
  }

  // Pass the parsed object so signPayload's JSON.stringify matches what the sender signed
  const valid = verifyOtaWebhookSignature(req.body, signature);
  if (!valid) {
    logger.warn('[RezOtaWebhook] Invalid signature, rejecting');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  next();
}

// ── Main webhook handler ──────────────────────────────────────────────────────

/**
 * POST /api/v1/ota-webhooks/rez-ota
 * Body: { event, data: { ... } }
 *
 * Events:
 *   booking_confirmed  — OTA booking paid & confirmed, push into PMS
 *   booking_cancelled  — OTA booking cancelled, update PMS record
 */
router.post('/', verifySignature, catchAsync(async (req, res) => {
  const { event, data } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: 'event and data are required' });
  }

  logger.info('[RezOtaWebhook] Received event:', event, '| bookingId:', data.bookingId);

  let result = null;

  switch (event) {
    case 'booking_confirmed':
      result = await handleOtaBookingConfirmed(data);
      break;

    case 'booking_cancelled':
      result = await handleOtaBookingCancelled(data);
      break;

    default:
      logger.warn('[RezOtaWebhook] Unknown event type:', event);
      return res.status(422).json({ error: `Unknown event: ${event}` });
  }

  res.json({
    received: true,
    event,
    pmsBookingId: result?._id || null,
  });
}));

export default router;
