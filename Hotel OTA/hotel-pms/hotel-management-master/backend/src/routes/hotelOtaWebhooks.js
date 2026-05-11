/**
 * Hotel OTA → PMS Webhook Routes
 *
 * Handles inbound webhook events from Hotel OTA.
 * Mounted at: POST /api/v1/ota-webhooks/hotel-ota
 *
 * Handles:
 * - inventory_sync_request  — OTA requests inventory update from PMS
 * - pricing_sync_request    — OTA requests rate update from PMS
 * - guest_loyalty_query     — OTA queries guest loyalty info
 * - booking_created         — OTA creates booking in PMS
 * - booking_cancelled      — OTA cancels booking in PMS
 *
 * Security:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation
 * - Constant-time token comparison
 */

import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { catchAsync } from '../utils/catchAsync.js';
import Booking from '../models/Booking.js';
import RoomAvailability from '../models/RoomAvailability.js';
import InventoryService from '../services/inventoryService.js';
import RoomType from '../models/RoomType.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';

const router = express.Router();

// ── Signature verification ────────────────────────────────────────────────────────

function verifySignature(req, res, next) {
  const signature = req.headers['x-webhook-signature'];

  // Allow unsigned webhooks in development
  if (!signature && process.env.NODE_ENV !== 'production') {
    logger.warn('[HotelOTA→PMS] No signature — allowed in dev mode');
    return next();
  }

  if (!signature) {
    return res.status(401).json({ error: 'Missing x-webhook-signature' });
  }

  // Check for webhook secret
  if (!process.env.REZ_OTA_WEBHOOK_SECRET) {
    logger.error('[HotelOTA→PMS] REZ_OTA_WEBHOOK_SECRET not configured');
    return res.status(503).json({ error: 'Webhook service misconfigured', code: 'MISSING_SECRET' });
  }

  // Verify HMAC-SHA256 signature
  const rawPayload = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.REZ_OTA_WEBHOOK_SECRET)
    .update(rawPayload)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSignature, 'hex');

    if (sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)) {
      logger.warn('[HotelOTA→PMS] Invalid signature, rejecting');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } catch (err) {
    logger.warn('[HotelOTA→PMS] Signature verification error', { error: err.message });
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Validate timestamp (5-minute tolerance)
  const timestamp = req.headers['x-webhook-timestamp'];
  if (timestamp) {
    const age = Date.now() - parseInt(timestamp);
    if (age > 5 * 60 * 1000) {
      logger.warn('[HotelOTA→PMS] Webhook timestamp too old', { age });
      return res.status(401).json({ error: 'Webhook timestamp too old' });
    }
  }

  next();
}

// ── Event handlers ─────────────────────────────────────────────────────────────

/**
 * Handle inventory sync request from OTA.
 * Updates room availability in PMS.
 */
async function handleInventorySyncRequest(req, res) {
  const { roomTypeId, date, availableRooms, isBlocked } = req.body.data;

  logger.info('[HotelOTA→PMS] Inventory sync request', { roomTypeId, date, availableRooms });

  // Find room type
  const roomType = await RoomType.findById(roomTypeId);
  if (!roomType) {
    return res.status(404).json({ error: 'Room type not found' });
  }

  // Update room availability
  const availability = await RoomAvailability.findOneAndUpdate(
    { roomType: roomTypeId, date: new Date(date) },
    {
      $set: {
        availableRooms: isBlocked ? 0 : availableRooms,
        totalRooms: roomType.maxOccupancy,
        isBlocked: isBlocked || false,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  logger.info('[HotelOTA→PMS] Inventory updated', {
    roomTypeId,
    date,
    availableRooms: availability.availableRooms,
  });

  res.json({
    success: true,
    roomTypeId,
    date,
    availableRooms: availability.availableRooms,
    totalRooms: availability.totalRooms,
    isBlocked: availability.isBlocked,
  });
}

/**
 * Handle pricing sync request from OTA.
 * Updates room rate in PMS.
 */
async function handlePricingSyncRequest(req, res) {
  const { roomTypeId, date, ratePaise, currency = 'INR' } = req.body.data;

  logger.info('[HotelOTA→PMS] Pricing sync request', { roomTypeId, date, ratePaise });

  // Find room type
  const roomType = await RoomType.findById(roomTypeId);
  if (!roomType) {
    return res.status(404).json({ error: 'Room type not found' });
  }

  // Convert paise to rupees
  const rate = ratePaise / 100;

  // Update room availability rate
  const availability = await RoomAvailability.findOneAndUpdate(
    { roomType: roomTypeId, date: new Date(date) },
    {
      $set: {
        sellingRate: rate,
        baseRate: roomType.baseRate,
        currency,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  logger.info('[HotelOTA→PMS] Pricing updated', {
    roomTypeId,
    date,
    rate,
    currency,
  });

  res.json({
    success: true,
    roomTypeId,
    date,
    rate,
    currency,
  });
}

/**
 * Handle guest loyalty query from OTA.
 * Returns loyalty info for a guest.
 */
async function handleGuestLoyaltyQuery(req, res) {
  const { guestEmail, guestPhone, otaUserId } = req.body.data;

  logger.info('[HotelOTA→PMS] Guest loyalty query', { guestEmail, guestPhone, otaUserId });

  // Find user
  let user = null;
  if (otaUserId) {
    user = await User.findOne({ otaUserId }).select('loyalty email phone name').lean();
  }
  if (!user && guestPhone) {
    user = await User.findOne({ phone: guestPhone }).select('loyalty email phone name').lean();
  }
  if (!user && guestEmail) {
    user = await User.findOne({ email: guestEmail }).select('loyalty email phone name').lean();
  }

  if (!user) {
    return res.json({
      found: false,
      loyaltyTier: null,
      loyaltyPoints: null,
    });
  }

  res.json({
    found: true,
    loyaltyTier: user.loyalty?.tier || 'basic',
    loyaltyPoints: user.loyalty?.points || 0,
    email: user.email,
    phone: user.phone,
  });
}

/**
 * Handle booking created event from OTA.
 * Creates or updates booking in PMS.
 */
async function handleBookingCreated(req, res) {
  const {
    bookingId,
    bookingRef,
    userId,
    checkInDate,
    checkOutDate,
    numRooms,
    numGuests,
    guestName,
    guestPhone,
    guestEmail,
    totalValuePaise,
    pgAmountPaise,
    otaCoinBurnedPaise,
    rezCoinBurnedPaise,
    hotelBrandCoinBurnedPaise,
    specialRequests,
  } = req.body.data;

  logger.info('[HotelOTA→PMS] Booking created', { bookingId, bookingRef });

  // Find hotel by OTA hotel ID
  const hotel = await Hotel.findOne({ 'otaConnections.rezOta.hotelId': req.body.hotelId });
  if (!hotel) {
    logger.warn('[HotelOTA→PMS] Hotel not found for OTA hotel ID:', req.body.hotelId);
    return res.status(404).json({ error: 'Hotel not found' });
  }

  // Find or create user
  let user = null;
  if (guestPhone) {
    user = await User.findOne({ hotel: hotel._id, $or: [{ phone: guestPhone }, { otaUserId: userId }] }).lean();
  }
  if (!user) {
    user = await User.findOne({ hotel: hotel._id, role: 'guest' }).lean()
      || await User.findOne({ hotel: hotel._id, role: 'admin' }).lean();
  }

  if (!user) {
    logger.warn('[HotelOTA→PMS] No user found for booking');
    return res.status(400).json({ error: 'No user found' });
  }

  // Calculate nights
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));

  // Create or update booking
  const bookingData = {
    hotelId: hotel._id,
    userId: user._id,
    source: 'ota',
    channelBookingId: bookingId,
    channelReservationId: bookingRef,
    checkIn,
    checkOut,
    nights,
    status: 'confirmed',
    paymentStatus: 'paid',
    guestDetails: {
      adults: numGuests || 1,
      specialRequests: specialRequests || '',
    },
    totalAmount: totalValuePaise / 100,
    currency: 'INR',
    channelData: {
      channelRate: totalValuePaise / 100,
      channelCurrency: 'INR',
      otaCoinBurnedPaise,
      rezCoinBurnedPaise,
      hotelBrandCoinBurnedPaise,
      pgAmountPaise,
      otaUserId: userId,
    },
  };

  const booking = await Booking.findOneAndUpdate(
    { channelBookingId: bookingId },
    { $setOnInsert: bookingData },
    { upsert: true, new: true }
  );

  logger.info('[HotelOTA→PMS] Booking created/updated in PMS', {
    pmsBookingId: booking._id,
    otaBookingId: bookingId,
  });

  res.json({
    success: true,
    pmsBookingId: booking._id,
    otaBookingId: bookingId,
  });
}

/**
 * Handle booking cancelled event from OTA.
 * Cancels booking in PMS.
 */
async function handleBookingCancelled(req, res) {
  const { bookingId, bookingRef, reason, refundAmount } = req.body.data;

  logger.info('[HotelOTA→PMS] Booking cancelled', { bookingId, bookingRef });

  const booking = await Booking.findOneAndUpdate(
    { channelBookingId: bookingId },
    {
      $set: {
        status: 'cancelled',
        cancellationReason: reason,
        updatedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!booking) {
    logger.warn('[HotelOTA→PMS] Booking not found for cancellation', { bookingId });
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Release room inventory
  if (booking.rooms && booking.rooms.length > 0) {
    const Room = (await import('../models/Room.js')).default;
    const roomIds = booking.rooms.map(r => r.roomId?._id || r.roomId).filter(Boolean);
    if (roomIds.length > 0) {
      await Room.updateMany(
        { _id: { $in: roomIds }, status: { $in: ['occupied', 'reserved'] } },
        { $set: { status: 'vacant' }, $unset: { currentBookingId: '' } }
      );
    }
  }

  logger.info('[HotelOTA→PMS] Booking cancelled in PMS', {
    pmsBookingId: booking._id,
    otaBookingId: bookingId,
  });

  res.json({
    success: true,
    pmsBookingId: booking._id,
    otaBookingId: bookingId,
  });
}

// ── Main webhook handler ───────────────────────────────────────────────────────

/**
 * POST /api/v1/ota-webhooks/hotel-ota
 * Main webhook endpoint for Hotel OTA events
 */
router.post('/hotel-ota', verifySignature, catchAsync(async (req, res) => {
  const { event, data, hotelId } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: 'event and data are required' });
  }

  logger.info('[HotelOTA→PMS] Received event:', event, '| hotelId:', hotelId);

  let result = null;

  switch (event) {
    case 'inventory_sync_request':
      await handleInventorySyncRequest(req, res);
      return; // Response already sent

    case 'pricing_sync_request':
      await handlePricingSyncRequest(req, res);
      return; // Response already sent

    case 'guest_loyalty_query':
      await handleGuestLoyaltyQuery(req, res);
      return; // Response already sent

    case 'booking_created':
      await handleBookingCreated(req, res);
      return; // Response already sent

    case 'booking_cancelled':
      await handleBookingCancelled(req, res);
      return; // Response already sent

    default:
      logger.warn('[HotelOTA→PMS] Unknown event type:', event);
      return res.status(422).json({ error: `Unknown event: ${event}` });
  }
}));

/**
 * GET /api/v1/ota-webhooks/hotel-ota/health
 * Health check endpoint
 */
router.get('/hotel-ota/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Hotel OTA→PMS Webhooks',
    timestamp: new Date().toISOString(),
  });
});

export default router;
