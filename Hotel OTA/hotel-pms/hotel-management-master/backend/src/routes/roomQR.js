import express from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { catchAsync } from '../utils/catchAsync.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import Hotel from '../models/Hotel.js';
import logger from '../utils/logger.js';
import { captureIntent } from '../services/intentCaptureService.ts';

const QR_SECRET = process.env.ROOM_QR_SECRET || process.env.DIGITAL_KEY_QR_SECRET || crypto.randomBytes(32).toString('hex');

const router = express.Router();

// Apply authentication and tenant isolation to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * Generate a QR code for a specific room
 * This QR code redirects guests to the RoomHub with room context
 *
 * @route POST /api/room-qr/generate
 * @access Admin/Manager/FrontDesk
 */
router.post('/generate', authorizePolicy('roomQrs', 'create'), catchAsync(async (req, res) => {
  const { roomId, validUntil } = req.body;

  if (!roomId) {
    return res.status(400).json({
      status: 'error',
      message: 'Room ID is required'
    });
  }

  // Fetch room details
  const room = await Room.findById(roomId)
    .populate('hotelId', 'name address brand')
    .lean();

  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: 'Room not found'
    });
  }

  // Verify room belongs to current hotel
  if (room.hotelId._id.toString() !== req.user.hotelId.toString()) {
    return res.status(403).json({
      status: 'error',
      message: 'Room does not belong to your hotel'
    });
  }

  // Calculate expiry (default: 30 days from now, or booking checkout date if provided)
  let expiresAt;
  if (validUntil) {
    expiresAt = new Date(validUntil);
  } else {
    // Default expiry: 30 days
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Generate room QR payload
  const qrPayload = {
    roomId: room._id.toString(),
    roomNumber: room.number,
    roomType: room.type || room.category || 'Standard',
    floor: room.floor?.toString() || '1',
    hotelId: room.hotelId._id.toString(),
    hotelName: room.hotelId.name,
    // Hotel OTA slug — set via REZ_NOW_FRONTEND_URL or falls back to hotel name slug
    hotelSlug: room.hotelId.slug || room.hotelId.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    expiresAt: expiresAt.toISOString(),
    timestamp: Math.floor(Date.now() / 1000)
  };

  // Create signature for verification
  const payloadStr = JSON.stringify(qrPayload);
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payloadStr)
    .digest('hex')
    .slice(0, 16);

  // Complete QR data
  const qrData = {
    ...qrPayload,
    signature
  };

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
    width: 400,
    margin: 2,
    color: {
      dark: '#1e3a5f',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  });

  // Also generate a URL that can be used directly
  // Primary: REZ Now Hotel Room Hub (https://now.rez.money/[hotelSlug]/room/[roomId]?token=...)
  // Fallback: StayOwn Room Hub (FRONTEND_URL/room-hub?...)
  const rezNowUrl = process.env.REZ_NOW_URL || 'https://now.rez.money';
  const stayOwnUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173';

  const encodedToken = encodeURIComponent(JSON.stringify(qrData));
  const roomHubUrl = `${rezNowUrl}/${qrPayload.hotelSlug}/room/${qrPayload.roomId}?token=${encodedToken}`;
  const stayOwnHubUrl = `${stayOwnUrl}/room-hub?${new URLSearchParams({
    roomId: qrPayload.roomId,
    roomNumber: qrPayload.roomNumber,
    roomType: qrPayload.roomType,
    floor: qrPayload.floor,
    hotelId: qrPayload.hotelId,
    hotelName: qrPayload.hotelName,
    expiresAt: qrPayload.expiresAt,
    token: encodedToken
  }).toString()}`;

  logger.info('Room QR code generated', {
    roomId: room._id,
    roomNumber: room.number,
    hotelId: room.hotelId._id,
    generatedBy: req.user.id
  });

  res.json({
    status: 'success',
    data: {
      roomId: room._id,
      roomNumber: room.number,
      roomType: room.type,
      floor: room.floor,
      hotelName: room.hotelId.name,
      hotelSlug: qrPayload.hotelSlug,
      qrCode: qrCodeDataUrl,
      // REZ Now room hub URL — use this for the Hotel QR feature
      url: roomHubUrl,
      // StayOwn room hub URL — fallback
      stayOwnUrl: stayOwnHubUrl,
      // Full QR payload for embedding in custom QR codes
      qrPayload: qrData,
      expiresAt: expiresAt.toISOString(),
      generatedAt: new Date().toISOString(),
      validForDays: Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    }
  });
}));

/**
 * Generate QR codes for all rooms in the hotel
 *
 * @route POST /api/room-qr/generate-all
 * @access Admin
 */
router.post('/generate-all', authorizePolicy('roomQrs', 'create'), catchAsync(async (req, res) => {
  const { validUntil, roomType } = req.body;

  // Calculate expiry
  let expiresAt;
  if (validUntil) {
    expiresAt = new Date(validUntil);
  } else {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Build query
  const query = { hotelId: req.user.hotelId };
  if (roomType) {
    query.type = roomType;
  }

  // Fetch all rooms
  const rooms = await Room.find(query)
    .populate('hotelId', 'name')
    .lean();

  if (rooms.length === 0) {
    return res.status(404).json({
      status: 'error',
      message: 'No rooms found'
    });
  }

  // Generate QR codes for each room
  const qrCodes = await Promise.all(rooms.map(async (room) => {
    const qrPayload = {
      roomId: room._id.toString(),
      roomNumber: room.number,
      roomType: room.type || room.category || 'Standard',
      floor: room.floor?.toString() || '1',
      hotelId: room.hotelId._id.toString(),
      hotelName: room.hotelId.name,
      hotelSlug: room.hotelId.slug || room.hotelId.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      expiresAt: expiresAt.toISOString(),
      timestamp: Math.floor(Date.now() / 1000)
    };

    const payloadStr = JSON.stringify(qrPayload);
    const signature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(payloadStr)
      .digest('hex')
      .slice(0, 16);

    const qrData = { ...qrPayload, signature };

    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 400,
      margin: 2,
      color: {
        dark: '#1e3a5f',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    const rezNowUrl = process.env.REZ_NOW_URL || 'https://now.rez.money';
    const stayOwnUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173';
    const encodedToken = encodeURIComponent(JSON.stringify(qrData));
    const url = `${rezNowUrl}/${qrPayload.hotelSlug}/room/${qrPayload.roomId}?token=${encodedToken}`;
    const stayOwnUrl2 = `${stayOwnUrl}/room-hub?${new URLSearchParams({
      roomId: qrPayload.roomId,
      roomNumber: qrPayload.roomNumber,
      roomType: qrPayload.roomType,
      floor: qrPayload.floor,
      hotelId: qrPayload.hotelId,
      hotelName: qrPayload.hotelName,
      expiresAt: qrPayload.expiresAt,
      token: encodedToken
    }).toString()}`;

    return {
      roomId: room._id,
      roomNumber: room.number,
      roomType: room.type,
      floor: room.floor,
      qrCode,
      url,
      stayOwnUrl: stayOwnUrl2
    };
  }));

  logger.info('Batch room QR codes generated', {
    hotelId: req.user.hotelId,
    roomCount: qrCodes.length,
    expiresAt: expiresAt.toISOString(),
    generatedBy: req.user.id
  });

  res.json({
    status: 'success',
    data: {
      count: qrCodes.length,
      expiresAt: expiresAt.toISOString(),
      rooms: qrCodes
    }
  });
}));

/**
 * Validate a room QR code
 * This endpoint is called by the frontend to verify QR data
 *
 * @route POST /api/room-qr/validate
 * @access Public (no auth required)
 */
router.post('/validate', catchAsync(async (req, res) => {
  const { qrData, signature } = req.body;

  if (!qrData) {
    return res.status(400).json({
      status: 'error',
      message: 'QR data is required'
    });
  }

  let payload;
  try {
    payload = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
  } catch {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid QR data format'
    });
  }

  // Verify signature if provided
  if (signature || payload.signature) {
    const sig = signature || payload.signature;
    const sigPayload = { ...payload };
    delete sigPayload.signature;

    const expectedSig = crypto
      .createHmac('sha256', QR_SECRET)
      .update(JSON.stringify(sigPayload))
      .digest('hex')
      .slice(0, 16);

    if (sig !== expectedSig) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid QR signature'
      });
    }
  }

  // Check expiration
  if (payload.expiresAt) {
    const expiresAt = new Date(payload.expiresAt);
    if (expiresAt < new Date()) {
      return res.status(401).json({
        status: 'error',
        message: 'QR code has expired',
        expired: true
      });
    }
  }

  // Fetch room and hotel details
  const room = await Room.findById(payload.roomId)
    .populate('hotelId', 'name brand address')
    .lean();

  if (!room) {
    return res.status(404).json({
      status: 'error',
      message: 'Room not found'
    });
  }

  // Check if there's an active booking for this room
  const activeBooking = await Booking.findOne({
    'rooms.roomId': payload.roomId,
    status: { $in: ['checked_in'] }
  }).lean();

  // RTMN Commerce Memory: Capture room QR scan intent (non-blocking)
  if (activeBooking?.guestId?._id || activeBooking?.userId) {
    const guestId = activeBooking.guestId?._id?.toString() || activeBooking.userId?.toString();
    captureIntent({
      userId: guestId,
      appType: 'hotel_pms',
      eventType: 'view',
      category: 'TRAVEL',
      intentKey: `hotel_room_qr_${room.hotelId._id}`,
      metadata: {
        roomId: payload.roomId,
        hotelId: room.hotelId._id.toString(),
        hotelName: room.hotelId.name,
        city: room.hotelId.address?.city || '',
        bookingId: activeBooking._id?.toString(),
      },
    }).catch(() => {});
  }

  res.json({
    status: 'success',
    data: {
      valid: true,
      room: {
        roomId: room._id,
        roomNumber: room.number,
        roomType: room.type,
        floor: room.floor
      },
      hotel: {
        hotelId: room.hotelId._id,
        name: room.hotelId.name,
        brand: room.hotelId.brand
      },
      hasActiveGuest: !!activeBooking,
      expiresAt: payload.expiresAt
    }
  });
}));

/**
 * Get list of rooms with their QR status
 *
 * @route GET /api/room-qr
 * @access Admin/Manager/FrontDesk
 */
router.get('/', authorizePolicy('roomQrs', 'read'), catchAsync(async (req, res) => {
  const { page = 1, limit = 50, roomType, floor, status } = req.query;

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (safePage - 1) * safeLimit;

  // Build query
  const query = { hotelId: req.user.hotelId };
  if (roomType) query.type = roomType;
  if (floor) query.floor = parseInt(floor, 10);

  // Fetch rooms
  const [rooms, total] = await Promise.all([
    Room.find(query)
      .skip(skip)
      .limit(safeLimit)
      .sort({ floor: 1, number: 1 })
      .lean(),
    Room.countDocuments(query)
  ]);

  // Get active bookings for these rooms
  const roomIds = rooms.map(r => r._id);
  const activeBookings = await Booking.find({
    'rooms.roomId': { $in: roomIds },
    status: 'checked_in'
  }).lean();

  // Map bookings to rooms
  const bookingMap = new Map();
  activeBookings.forEach(booking => {
    booking.rooms.forEach(r => {
      if (roomIds.some(rid => rid.toString() === r.roomId.toString())) {
        bookingMap.set(r.roomId.toString(), {
          bookingId: booking._id,
          guestName: booking.guestId?.name || 'Guest',
          checkIn: booking.checkIn,
          checkOut: booking.checkOut
        });
      }
    });
  });

  const roomList = rooms.map(room => {
    const booking = bookingMap.get(room._id.toString());
    return {
      roomId: room._id,
      roomNumber: room.number,
      roomType: room.type,
      floor: room.floor,
      status: room.status,
      hasActiveGuest: !!booking,
      currentGuest: booking ? {
        name: booking.guestName,
        checkOut: booking.checkOut
      } : null
    };
  });

  res.json({
    status: 'success',
    data: {
      rooms: roomList,
      page: safePage,
      limit: safeLimit,
      totalCount: total,
      totalPages: Math.ceil(total / safeLimit)
    }
  });
}));

export default router;
