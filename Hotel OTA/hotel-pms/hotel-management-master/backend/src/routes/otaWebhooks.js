import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import Booking from '../models/Booking.js';
import RoomAvailability from '../models/RoomAvailability.js';
import { Channel } from '../models/ChannelManager.js';
import InventoryService from '../services/inventoryService.js';
import logger from '../utils/logger.js';
import { validateTransition } from '../utils/bookingStateMachine.js';
import { validate } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

/**
 * @swagger
 * /api/v1/webhooks/ota:
 *   post:
 *     summary: Handle OTA webhook requests
 *     tags: [OTA Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [booking_com, expedia, airbnb, agoda]
 *               eventType:
 *                 type: string
 *                 enum: [reservation, modification, cancellation, rate_change]
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook data
 *       500:
 *         description: Internal server error
 */

// Webhook signature verification middleware
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const channel = req.body?.channel || req.query?.channel;
  const timestamp = req.headers['x-webhook-timestamp'];

  // In non-production, allow unsigned webhooks only when no signature is provided.
  // If a signature IS present it must always be verified — a forged/incorrect sig
  // in staging indicates a misconfigured partner and should not silently pass.
  if (process.env.NODE_ENV !== 'production' && !signature) {
    logger.warn('Unsigned webhook received in non-production environment', { channel });
    return next();
  }

  if (!signature || !channel) {
    logger.warn('Webhook missing signature or channel', { channel, ip: req.ip });
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  // Per-channel secrets from environment
  const channelSecrets = {
    booking_com: process.env.BOOKINGCOM_WEBHOOK_SECRET,
    expedia: process.env.EXPEDIA_WEBHOOK_SECRET,
    airbnb: process.env.AIRBNB_WEBHOOK_SECRET,
    agoda: process.env.AGODA_WEBHOOK_SECRET
  };

  const secret = channelSecrets[channel];
  if (!secret) {
    logger.warn('Webhook from unknown channel or missing secret', { channel, ip: req.ip });
    return res.status(401).json({ error: 'Unknown webhook channel' });
  }

  // Verify HMAC-SHA256 signature with optional timestamp for replay protection
  const hasRawPayload = typeof req.rawBody === 'string' && req.rawBody.length > 0;
  if (process.env.NODE_ENV === 'production' && !hasRawPayload) {
    logger.error('Webhook raw payload missing for signature verification', { channel, ip: req.ip });
    return res.status(500).json({ error: 'Webhook verification unavailable' });
  }
  const rawPayload = hasRawPayload ? req.rawBody : JSON.stringify(req.body);
  const payload = timestamp
    ? `${timestamp}.${rawPayload}`
    : rawPayload;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      logger.warn('Webhook signature mismatch', { channel, ip: req.ip });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } catch (err) {
    logger.warn('Webhook signature verification error', { channel, ip: req.ip, error: err.message });
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Reject stale timestamps (replay protection)
  if (timestamp) {
    const age = Date.now() - parseInt(timestamp);
    if (age > 5 * 60 * 1000) { // 5 minutes
      logger.warn('Webhook timestamp too old', { channel, age, ip: req.ip });
      return res.status(401).json({ error: 'Webhook timestamp too old' });
    }
  }

  next();
};

// Rate limiting for public webhook endpoint.
const channelRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 120 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.channel || 'unknown'}`,
  message: { error: 'Too many webhook requests' }
});

// Main webhook handler
router.post('/ota', 
  validate(mutationBaselineSchema),
  verifyWebhookSignature,
  channelRateLimit,
  catchAsync(async (req, res) => {
    const { channel, eventType, data, channelId } = req.body;
    
    logger.info(`OTA Webhook received: ${channel} - ${eventType}`, {
      channel,
      eventType,
      channelId,
      timestamp: new Date().toISOString()
    });

    try {
      switch (eventType) {
        case 'reservation':
          await handleReservation(channel, data);
          break;
        case 'modification':
          await handleModification(channel, data);
          break;
        case 'cancellation':
          await handleCancellation(channel, data);
          break;
        case 'rate_change':
          await handleRateChange(channel, data);
          break;
        default:
          logger.warn(`Unknown event type: ${eventType}`);
          return res.status(400).json({ error: 'Unknown event type' });
      }

      res.status(200).json({ 
        success: true, 
        message: `${eventType} processed successfully` 
      });

    } catch (error) {
      logger.error(`Error processing OTA webhook: ${error.message}`, {
        channel,
        eventType,
        channelId,
        error: error.stack
      });

      res.status(500).json({ 
        error: 'Failed to process webhook',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
      });
    }
  })
);

// Handle new reservations from OTAs with transaction safety
async function handleReservation(channel, data) {
  const {
    bookingId,
    reservationId,
    hotelId,
    roomTypeId,
    checkIn,
    checkOut,
    guests,
    rate,
    currency,
    confirmationCode
  } = data;

  // FIX PMS-HIGH-002: Validate hotelId scope to prevent cross-tenant injection.
  // An attacker could send a forged webhook with a hotelId from a different tenant.
  // We must verify this hotelId is authorized for the sending channel.
  const channelRecord = await Channel.findOne({
    category: channel,
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  }).lean();

  if (!channelRecord) {
    logger.error('[otaWebhooks] Cross-tenant injection attempt blocked', {
      channel,
      hotelId,
      bookingId,
      error: 'Hotel not authorized for this channel'
    });
    throw new Error('Hotel not authorized for this OTA channel');
  }

  // Start MongoDB transaction for atomic booking
  const session = await mongoose.startSession();
  
  try {
    return await session.withTransaction(async () => {
      // Check if booking already exists (enhanced idempotency)
      const existingBooking = await Booking.findOne({
        source: channel,
        channelBookingId: bookingId
      }).session(session);

      if (existingBooking) {
        logger.info(`Booking already exists: ${bookingId}`, { channel, bookingId });
        return existingBooking;
      }

      // Book rooms using centralized inventory service with locking
      await InventoryService.bookRoomsWithLocking({
        hotelId,
        roomTypeId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        roomsCount: 1,
        source: channel,
        channelId: null, // Will be populated if channel mapping exists
        session
      });

      // Create new booking within transaction
      const booking = new Booking({
        hotelId,
        userId: null, // OTA bookings don't have user accounts
        rooms: [{
          roomId: null, // Will be assigned during check-in
          roomTypeId: roomTypeId,
          rate: rate
        }],
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        nights: Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)),
        status: 'confirmed',
        paymentStatus: 'paid', // OTAs handle payments
        totalAmount: rate,
        currency: currency || 'INR',
        
        // OTA-specific fields with enhanced structure
        source: channel,
        channelBookingId: bookingId,
        channelReservationId: reservationId,
        
        channelData: {
          confirmationCode,
          channelRate: rate,
          channelCurrency: currency,
          bookerCountry: guests?.country,
          bookerLanguage: guests?.language
        },

        guestDetails: {
          adults: guests?.adults || 1,
          children: guests?.children || 0,
          specialRequests: guests?.specialRequests
        }
      });

      await booking.save({ session });

      logger.info(`OTA reservation created with transaction safety: ${booking._id}`, { 
        channel, 
        bookingId, 
        hotelId 
      });

      return booking;
    });
    
  } finally {
    await session.endSession();
  }
}

// Handle booking modifications from OTAs (wrapped in transaction)
async function handleModification(channel, data) {
  const {
    bookingId,
    modificationType,
    oldValues,
    newValues,
    reason
  } = data;

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        source: channel,
        channelBookingId: bookingId
      }).session(session);

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Store old dates for inventory adjustment
      const oldCheckIn = new Date(booking.checkIn);
      const oldCheckOut = new Date(booking.checkOut);

      // Add modification to history
      booking.modifications.push({
        modificationId: `mod_${Date.now()}`,
        modificationType,
        modificationDate: new Date(),
        modifiedBy: {
          source: channel,
          userId: 'ota_system',
          channel: channel
        },
        oldValues,
        newValues,
        reason
      });

      // Update booking fields based on modification type
      if (modificationType === 'date_change') {
        if (newValues.checkIn) booking.checkIn = new Date(newValues.checkIn);
        if (newValues.checkOut) booking.checkOut = new Date(newValues.checkOut);
        if (newValues.checkIn || newValues.checkOut) {
          booking.nights = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
        }

        // Adjust inventory: release old dates, book new dates
        if (booking.rooms[0]?.roomTypeId) {
          await InventoryService.releaseRoomsWithLocking({
            hotelId: booking.hotelId,
            roomTypeId: booking.rooms[0].roomTypeId,
            checkIn: oldCheckIn,
            checkOut: oldCheckOut,
            roomsCount: 1,
            source: channel,
            session
          });
          await InventoryService.bookRoomsWithLocking({
            hotelId: booking.hotelId,
            roomTypeId: booking.rooms[0].roomTypeId,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            roomsCount: 1,
            source: channel,
            channelId: null,
            session
          });
        }
      }

      if (modificationType === 'guest_change') {
        if (newValues.guestDetails) {
          booking.guestDetails = { ...booking.guestDetails, ...newValues.guestDetails };
        }
      }

      if (modificationType === 'rate_change') {
        if (newValues.rate) {
          booking.rooms[0].rate = newValues.rate;
          booking.totalAmount = newValues.rate;
        }
      }

      await booking.save({ session });

      logger.info(`OTA modification processed: ${booking._id}`, {
        channel,
        bookingId,
        modificationType
      });

      return booking;
    });
  } finally {
    await session.endSession();
  }
}

// Handle booking cancellations from OTAs (wrapped in transaction)
async function handleCancellation(channel, data) {
  const { bookingId, reason } = data;

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        source: channel,
        channelBookingId: bookingId
      }).session(session);

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Validate status transition using state machine
      const transition = validateTransition(booking.status, 'cancelled');
      if (!transition.valid) {
        throw new Error(transition.error);
      }

      // Calculate refund for OTA cancellation
      let refundInfo = { refundAmount: 0, penaltyAmount: 0, refundPercentage: 0 };
      try {
        const cancellationService = (await import('../services/cancellationService.js')).default;
        refundInfo = cancellationService.calculateRefund(booking);
      } catch { /* cancellation service not available */ }

      // Update booking status
      booking.status = 'cancelled';
      booking.cancellationReason = reason;
      booking.settlementTracking = booking.settlementTracking || {};
      booking.settlementTracking.refundAmount = refundInfo.refundAmount;
      booking.settlementTracking.penaltyAmount = refundInfo.penaltyAmount;

      // Add to modifications history
      booking.modifications.push({
        modificationId: `cancel_${Date.now()}`,
        modificationType: 'cancellation',
        modificationDate: new Date(),
        modifiedBy: {
          source: channel,
          userId: 'ota_system',
          channel: channel
        },
        oldValues: { status: 'confirmed' },
        newValues: { status: 'cancelled' },
        reason
      });

      await booking.save({ session });

      // Release inventory within the same transaction
      await InventoryService.releaseRoomsWithLocking({
        hotelId: booking.hotelId,
        roomTypeId: booking.rooms[0].roomTypeId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomsCount: 1,
        source: channel,
        session
      });

      logger.info(`OTA cancellation processed: ${booking._id}`, {
        channel,
        bookingId,
        reason
      });

      return booking;
    });
  } finally {
    await session.endSession();
  }
}

// Handle rate changes from OTAs
async function handleRateChange(channel, data) {
  const { roomTypeId, date, newRate, currency } = data;

  // Update room availability rates
  await RoomAvailability.updateMany(
    {
      roomTypeId,
      date: new Date(date)
    },
    {
      $set: {
        sellingRate: newRate,
        currency: currency || 'INR',
        needsSync: true
      }
    }
  );

  logger.info(`OTA rate change processed`, { 
    channel, 
    roomTypeId, 
    date, 
    newRate 
  });
}

// Legacy inventory functions replaced with centralized InventoryService
// All inventory operations now use distributed locking and atomic transactions
// See: InventoryService.bookRoomsWithLocking() and InventoryService.releaseRoomsWithLocking()

// Health check endpoint for webhook monitoring
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'OTA Webhooks',
    timestamp: new Date().toISOString()
  });
});

export default router;