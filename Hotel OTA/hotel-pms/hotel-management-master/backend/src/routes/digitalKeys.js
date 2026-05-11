import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import crypto from 'crypto';
import QRCode from 'qrcode';
import rateLimit from 'express-rate-limit';
import DigitalKey from '../models/DigitalKey.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import websocketService from '../services/websocketService.js';
import logger from '../utils/logger.js';

const QR_SECRET = process.env.DIGITAL_KEY_QR_SECRET || crypto.randomBytes(32).toString('hex');

const keyValidationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute per IP
  message: { status: 'error', message: 'Too many validation attempts. Please try again later.' }
});

const router = express.Router();

const keyPopulateSpec = [
  { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
  { path: 'roomId', select: 'number type floor' },
  { path: 'hotelId', select: 'name address' }
];

async function emitDigitalKeyEvent(userIds, suffix, payload) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map((id) => String(id)))];
  await Promise.all(
    ids.map((uid) =>
      websocketService
        .sendToUser(uid, `digital-key:${suffix}`, payload)
        .catch((err) => logger.warn('digital-key realtime emit failed', { uid, suffix, error: err.message }))
    )
  );
}
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

const sanitizeDigitalKey = (digitalKey) => {
  if (!digitalKey) return digitalKey;

  const key = typeof digitalKey.toObject === 'function'
    ? digitalKey.toObject({ virtuals: true })
    : { ...digitalKey };

  if (key.securitySettings) {
    // Never expose hashed PIN material to clients.
    const { pin, ...safeSecuritySettings } = key.securitySettings;
    key.securitySettings = safeSecuritySettings;
  }

  // Remove internal metadata from general list/detail responses.
  delete key.metadata;
  delete key.__v;

  return key;
};

const sanitizeDigitalKeys = (digitalKeys = []) => digitalKeys.map((key) => sanitizeDigitalKey(key));

// Apply authentication, tenant isolation, and property access to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('digitalKeys', 'baseAccess'));

// Get all digital keys for the authenticated user
// Allowlists for digital key query filter fields — prevent NoSQL operator injection.
const ALLOWED_KEY_STATUSES = ['active', 'expired', 'revoked', 'suspended'];
const ALLOWED_KEY_TYPES = ['standard', 'master', 'temporary', 'guest'];

router.get('/', catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, type } = req.query;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  // SECURITY: Validate enum filter values against allowlists to prevent NoSQL operator injection.
  if (status && !ALLOWED_KEY_STATUSES.includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Invalid status filter value' });
  }
  if (type && !ALLOWED_KEY_TYPES.includes(type)) {
    return res.status(400).json({ status: 'error', message: 'Invalid type filter value' });
  }

  // Guests may not have a hotelId on their user record (they belong to a hotel
  // via booking, not via the user.hotelId field).  Use tenantId from context when
  // available; for guest users without a tenant, skip the hotelId filter and rely
  // on userId scoping alone.
  const userHotelId = req.tenantId || req.user.hotelId;
  const filter = userHotelId
    ? { userId: req.user.id, hotelId: userHotelId }
    : { userId: req.user.id };
  if (status) filter.status = status;
  if (type) filter.type = type;
  
  const keys = await DigitalKey.find(filter)
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('roomId', 'number type floor')
    .populate('hotelId', 'name address')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit).lean();
  
  const total = await DigitalKey.countDocuments(filter);
  
  res.json({
    success: true,
    data: {
      keys: sanitizeDigitalKeys(keys),
      pagination: {
        currentPage: safePage,
        totalPages: Math.ceil(total / safeLimit),
        totalItems: total,
        hasNext: skip + keys.length < total,
        hasPrev: safePage > 1
      }
    }
  });
}));

// Get shared keys for the authenticated user
router.get('/shared', catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  
  const sharedHotelId = req.tenantId || req.user.hotelId;

  const keys = await DigitalKey.getSharedKeysForUser(req.user.id, {
    page: safePage,
    limit: safeLimit,
    hotelId: sharedHotelId
  });

  const sharedCountFilter = {
    'sharedWith.userId': req.user.id,
    'sharedWith.isActive': true,
    status: 'active',
    validUntil: { $gt: new Date() }
  };
  if (sharedHotelId) sharedCountFilter.hotelId = sharedHotelId;

  const total = await DigitalKey.countDocuments(sharedCountFilter);
  
  res.json({
    success: true,
    data: {
      keys: sanitizeDigitalKeys(keys),
      pagination: {
        currentPage: safePage,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        totalItems: total,
        hasNext: (safePage - 1) * safeLimit + keys.length < total,
        hasPrev: safePage > 1
      }
    }
  });
}));

// Get the current user's most relevant active key (mobile compatibility endpoint)
router.get('/my-key', catchAsync(async (req, res) => {
  const now = new Date();
  const myKeyHotelId = req.tenantId || req.user.hotelId;
  const myKeyFilter = {
    userId: req.user.id,
    status: 'active',
    validUntil: { $gt: now }
  };
  if (myKeyHotelId) myKeyFilter.hotelId = myKeyHotelId;
  const key = await DigitalKey.findOne(myKeyFilter)
    .sort({ validUntil: 1, createdAt: -1 })
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('roomId', 'number type floor')
    .populate('hotelId', 'name address')
    .lean();

  res.json({
    success: true,
    data: sanitizeDigitalKey(key)
  });
}));

// Generate a new digital key for a booking
router.post('/generate', validate(schemas.generateDigitalKey), catchAsync(async (req, res) => {
  const { bookingId, type = 'primary', maxUses: maxUsesBody, securitySettings = {} } = req.body;
  let safeMaxUses = -1;
  if (maxUsesBody !== undefined && maxUsesBody !== null && maxUsesBody !== '') {
    const n = Number(maxUsesBody);
    safeMaxUses = Number.isFinite(n) ? n : -1;
  }
  
  // Verify booking exists and belongs to user
  const booking = await Booking.findOne({ 
    _id: bookingId, 
    userId: req.user.id,
    hotelId: req.user.hotelId,
    status: { $in: ['confirmed', 'checked_in'] }
  }).populate('hotelId').populate('rooms.roomId').lean();
  
  if (!booking) {
    throw new ApplicationError('Booking not found or not eligible for digital key', 404);
  }
  
  if (!booking.rooms || booking.rooms.length === 0) {
    throw new ApplicationError('Booking has no rooms assigned', 400);
  }
  
  // Check if key already exists for this booking
  const existingKey = await DigitalKey.findOne({ 
    bookingId, 
    userId: req.user.id,
    hotelId: req.user.hotelId,
    status: { $in: ['active', 'expired'] }
  }).lean();
  
  if (existingKey && type === 'primary') {
    throw new ApplicationError('A primary key already exists for this booking', 400);
  }
  
  // Use the first room (for multi-room bookings, we'll generate key for first room)
  const firstRoom = booking.rooms[0];
  
  // Generate QR code data (keep it minimal for QR code size limits)
  const keyCode = DigitalKey.generateKeyCode();
  const qrPayload = {
    k: keyCode,
    b: booking._id.toString().slice(-8),
    r: firstRoom.roomId._id.toString().slice(-8),
    h: booking.hotelId._id.toString().slice(-8),
    t: type.charAt(0),
    ts: Math.floor(Date.now() / 1000)
  };
  const qrPayloadStr = JSON.stringify(qrPayload);
  const signature = crypto.createHmac('sha256', QR_SECRET).update(qrPayloadStr).digest('hex').slice(0, 16);
  const qrData = JSON.stringify({ ...qrPayload, sig: signature });
  
  const qrCode = await QRCode.toDataURL(qrData);
  
  // Create digital key
  const digitalKey = new DigitalKey({
    userId: req.user.id,
    bookingId: booking._id,
    roomId: firstRoom.roomId._id,
    hotelId: booking.hotelId._id,
    keyCode,
    qrCode,
    type,
    validFrom: new Date(),
    validUntil: booking.checkOut,
    maxUses: safeMaxUses,
    securitySettings: {
      requirePin: securitySettings.requirePin || false,
      pin: securitySettings.pin,
      allowSharing: securitySettings.allowSharing !== false,
      maxSharedUsers: securitySettings.maxSharedUsers || 5,
      requireApproval: securitySettings.requireApproval || false
    },
    metadata: {
      generatedBy: req.user.id,
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    }
  });
  
  await digitalKey.save();
  
  // Populate references for response
  await digitalKey.populate(keyPopulateSpec);
  
  const sanitizedGen = sanitizeDigitalKey(digitalKey);
  await emitDigitalKeyEvent(req.user.id, 'created', { digitalKey: sanitizedGen });

  try {
    const { createAndDeliverInApp } = await import('../services/inAppNotificationDeliveryService.js');
    const roomNo = firstRoom.roomId?.number || 'your room';
    await createAndDeliverInApp({
      userId: req.user.id,
      hotelId: booking.hotelId._id,
      type: 'system_alert',
      title: 'Digital key ready',
      message: `Your digital key for Room ${roomNo} is active until ${new Date(booking.checkOut).toLocaleDateString()}.`,
      priority: 'medium',
      metadata: { category: 'system', tags: ['digital_key', 'key_created'] }
    });
  } catch (e) {
    logger.warn('digital-key in-app (created) skipped', { error: e.message });
  }

  res.status(201).json({
    success: true,
    message: 'Digital key generated successfully',
    data: sanitizedGen
  });
}));

// Admin Routes - System-wide digital key management (MUST be before /:keyId route)
// Get all digital keys (admin only)
router.get('/admin', authenticate, authorizePolicy('digitalKeys', 'adminAccess'), catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, type, hotel, search } = req.query;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  // SECURITY: always resolve the effective hotel from the tenant context so a
  // staff/frontdesk user cannot query another hotel's keys by supplying a
  // different `hotel` query param.  Super-admins (no hotelId) may pass any
  // hotel, but the value is still validated via mongoose ObjectId coercion.
  const tenantHotelId = req.tenantId || String(req.user.hotelId || '');
  const adminHotelId = tenantHotelId || hotel;  // tenant wins; fall back to param only if no tenant

  if (!adminHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Prevent cross-hotel data access: if the user has a fixed tenant, the
  // requested hotel must match it.
  if (tenantHotelId && hotel && String(hotel) !== tenantHotelId) {
    throw new ApplicationError('Access denied: hotel parameter does not match your property', 403);
  }

  const filter = { hotelId: new mongoose.Types.ObjectId(adminHotelId) };
  if (status) filter.status = status;
  if (type) filter.type = type;
  
  // Build base Mongoose filter (without search which needs a join)
  // keyCode search is directly filterable; booking number search requires an
  // aggregation lookup because bookingId is a reference (ObjectId), not a
  // denormalised string field.
  let keys;
  let total;

  if (search) {
    const escapedSearch = escapeRegex(search);

    // Use aggregation to enable search across the joined bookingNumber field.
    const searchPipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: '_booking'
        }
      },
      {
        $match: {
          $or: [
            { keyCode: { $regex: escapedSearch, $options: 'i' } },
            { '_booking.bookingNumber': { $regex: escapedSearch, $options: 'i' } }
          ]
        }
      }
    ];

    const [results, countResult] = await Promise.all([
      DigitalKey.aggregate([
        ...searchPipeline,
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: safeLimit }
      ]),
      DigitalKey.aggregate([...searchPipeline, { $count: 'total' }])
    ]);

    // Populate references on the raw aggregation documents
    keys = await DigitalKey.populate(results, [
      { path: 'userId', select: 'name email' },
      { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
      { path: 'roomId', select: 'number type floor' },
      { path: 'hotelId', select: 'name address' }
    ]);

    total = countResult[0]?.total || 0;
  } else {
    [keys, total] = await Promise.all([
      DigitalKey.find(filter)
        .populate('userId', 'name email')
        .populate('bookingId', 'bookingNumber checkIn checkOut')
        .populate('roomId', 'number type floor')
        .populate('hotelId', 'name address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      DigitalKey.countDocuments(filter)
    ]);
  }

  res.json({
    success: true,
    data: {
      keys: sanitizeDigitalKeys(keys),
      pagination: {
        currentPage: safePage,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        totalItems: total,
        hasNext: skip + keys.length < total,
        hasPrev: safePage > 1
      }
    }
  });
}));

// Get admin analytics for digital keys
router.get('/admin/analytics', authenticate, authorizePolicy('digitalKeys', 'adminAccess'), catchAsync(async (req, res) => {
  const { timeRange = '30d' } = req.query;

  // SECURITY: Always derive hotelId from tenant context so staff cannot query
  // another hotel's analytics by supplying an arbitrary hotelId query param.
  const tenantHotelId = req.tenantId || String(req.user.hotelId || '');
  const requestedHotelId = req.query.hotelId ? String(req.query.hotelId) : null;

  // If the requester has a fixed tenant, the optional hotelId param must match.
  if (tenantHotelId && requestedHotelId && requestedHotelId !== tenantHotelId) {
    throw new ApplicationError('Access denied: hotel parameter does not match your property', 403);
  }

  const targetHotelId = tenantHotelId || requestedHotelId;

  if (!targetHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const hotelFilter = { hotelId: new mongoose.Types.ObjectId(targetHotelId) };

  // Calculate date range
  let startDate = new Date();
  switch (timeRange) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const [
    totalKeys,
    activeKeys,
    expiredKeys,
    revokedKeys,
    totalUses,
    uniqueUsers,
    keysByType,
    keysByHotel,
    usageTrends,
    recentActivity,
    topUsers
  ] = await Promise.all([
    // Total keys count
    DigitalKey.countDocuments(hotelFilter),

    // Active keys count
    DigitalKey.countDocuments({
      ...hotelFilter,
      status: 'active',
      validUntil: { $gt: new Date() }
    }),

    // Expired keys count
    DigitalKey.countDocuments({
      ...hotelFilter,
      $or: [
        { status: 'expired' },
        { validUntil: { $lt: new Date() } }
      ]
    }),

    // Revoked keys count
    DigitalKey.countDocuments({ ...hotelFilter, status: 'revoked' }),

    // Total usage count
    DigitalKey.aggregate([
      { $match: hotelFilter },
      { $group: { _id: null, total: { $sum: '$currentUses' } } }
    ]),

    // Unique users count
    DigitalKey.distinct('userId', hotelFilter).then(users => users.length),

    // Keys by type
    DigitalKey.aggregate([
      { $match: hotelFilter },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),

    // Keys by hotel (scoped to current hotel)
    DigitalKey.aggregate([
      { $match: hotelFilter },
      {
        $lookup: {
          from: 'hotels',
          localField: 'hotelId',
          foreignField: '_id',
          as: 'hotel'
        }
      },
      { $unwind: '$hotel' },
      {
        $group: {
          _id: '$hotelId',
          hotelName: { $first: '$hotel.name' },
          count: { $sum: 1 }
        }
      }
    ]),

    // Usage trends over time
    DigitalKey.aggregate([
      {
        $match: {
          ...hotelFilter,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),

    // Recent activity
    DigitalKey.aggregate([
      { $match: hotelFilter },
      { $unwind: '$accessLogs' },
      { $sort: { 'accessLogs.timestamp': -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'hotels',
          localField: 'hotelId',
          foreignField: '_id',
          as: 'hotel'
        }
      },
      { $unwind: '$hotel' },
      { $project: {
        keyId: '$_id',
        action: '$accessLogs.action',
        timestamp: '$accessLogs.timestamp',
        user: {
          name: { $ifNull: ['$user.name', 'Unknown'] },
          email: '$user.email'
        },
        hotel: '$hotel.name',
        deviceInfo: '$accessLogs.deviceInfo'
      }}
    ]),

    // Top users by key count
    DigitalKey.aggregate([
      { $match: hotelFilter },
      {
        $group: {
          _id: '$userId',
          keyCount: { $sum: 1 },
          totalUses: { $sum: '$currentUses' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: { $ifNull: ['$user.name', 'Unknown'] },
          email: '$user.email',
          keyCount: 1,
          totalUses: 1
        }
      },
      { $sort: { keyCount: -1 } },
      { $limit: 10 }
    ])
  ]);
  
  res.json({
    success: true,
    data: {
      overview: {
        totalKeys,
        activeKeys,
        expiredKeys,
        revokedKeys,
        totalUses: totalUses[0]?.total || 0,
        uniqueUsers
      },
      breakdowns: {
        byType: keysByType,
        byHotel: keysByHotel
      },
      trends: {
        usage: usageTrends,
        timeRange
      },
      activity: {
        recent: recentActivity,
        topUsers
      }
    }
  });
}));

// Get key statistics (MUST be before /:keyId to avoid route conflict)
router.get('/stats/overview', catchAsync(async (req, res) => {
  const userId = req.user.id;
  const statsHotelId = req.tenantId || req.user.hotelId;

  if (!statsHotelId) {
    throw new ApplicationError('Hotel assignment is required to retrieve key statistics', 400);
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const hotelObjectId = new mongoose.Types.ObjectId(statsHotelId);
  const tenantKeyFilter = { userId, hotelId: statsHotelId };

  const [
    totalKeys,
    activeKeys,
    expiredKeys,
    sharedKeys,
    totalUses,
    recentActivity
  ] = await Promise.all([
    DigitalKey.countDocuments(tenantKeyFilter),
    DigitalKey.countDocuments({
      ...tenantKeyFilter,
      status: 'active',
      validUntil: { $gt: new Date() }
    }),
    DigitalKey.countDocuments({
      ...tenantKeyFilter,
      status: 'expired'
    }),
    DigitalKey.countDocuments({
      'sharedWith.userId': userId,
      'sharedWith.isActive': true,
      status: 'active',
      validUntil: { $gt: new Date() },
      hotelId: statsHotelId
    }),
    DigitalKey.aggregate([
      { $match: { userId: userObjectId, hotelId: hotelObjectId } },
      { $group: { _id: null, total: { $sum: '$currentUses' } } }
    ]),
    DigitalKey.aggregate([
      { $match: { userId: userObjectId, hotelId: hotelObjectId } },
      { $unwind: '$accessLogs' },
      { $sort: { 'accessLogs.timestamp': -1 } },
      { $limit: 10 },
      { $project: {
        keyId: '$_id',
        action: '$accessLogs.action',
        timestamp: '$accessLogs.timestamp',
        deviceInfo: '$accessLogs.deviceInfo'
      }}
    ])
  ]);

  res.json({
    success: true,
    data: {
      totalKeys,
      activeKeys,
      expiredKeys,
      sharedKeys,
      totalUses: totalUses[0]?.total || 0,
      recentActivity
    }
  });
}));

// Get admin activity logs for all digital keys (MUST be before /:keyId to avoid route conflict)
router.get('/admin/activity-logs', authenticate, authorizePolicy('digitalKeys', 'adminAccess'), catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    action,
    userId,
    timeRange = '30d'
  } = req.query;

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (safePage - 1) * safeLimit;

  // Calculate date range
  let startDate = new Date();
  switch (timeRange) {
    case '1d':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  // SECURITY: Enforce tenant isolation so staff cannot read another hotel's
  // activity logs by supplying an arbitrary hotelId query param.
  const tenantActivityHotelId = req.tenantId || String(req.user.hotelId || '');
  const requestedActivityHotelId = req.query.hotelId ? String(req.query.hotelId) : null;

  if (tenantActivityHotelId && requestedActivityHotelId && requestedActivityHotelId !== tenantActivityHotelId) {
    throw new ApplicationError('Access denied: hotel parameter does not match your property', 403);
  }

  const activityHotelId = tenantActivityHotelId || requestedActivityHotelId;
  if (!activityHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Build match conditions for aggregation - always filter by hotel
  const matchConditions = {
    hotelId: new mongoose.Types.ObjectId(activityHotelId),
    'accessLogs.timestamp': { $gte: startDate }
  };

  if (action) {
    matchConditions['accessLogs.action'] = action;
  }

  if (userId) {
    matchConditions['accessLogs.userId'] = new mongoose.Types.ObjectId(userId);
  }

  // Aggregate all access logs from all digital keys
  const pipeline = [
    { $unwind: '$accessLogs' },
    { $match: matchConditions },
    {
      $lookup: {
        from: 'users',
        localField: 'accessLogs.userId',
        foreignField: '_id',
        as: 'actorUser'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'keyOwner'
      }
    },
    {
      $lookup: {
        from: 'rooms',
        localField: 'roomId',
        foreignField: '_id',
        as: 'room'
      }
    },
    {
      $lookup: {
        from: 'hotels',
        localField: 'hotelId',
        foreignField: '_id',
        as: 'hotel'
      }
    },
    {
      $project: {
        _id: '$accessLogs._id',
        keyId: '$_id',
        keyCode: '$keyCode',
        keyType: '$type',
        keyStatus: '$status',
        action: '$accessLogs.action',
        timestamp: '$accessLogs.timestamp',
        deviceInfo: '$accessLogs.deviceInfo',
        actor: {
          _id: { $arrayElemAt: ['$actorUser._id', 0] },
          name: { $arrayElemAt: ['$actorUser.name', 0] },
          email: { $arrayElemAt: ['$actorUser.email', 0] },
          role: { $arrayElemAt: ['$actorUser.role', 0] }
        },
        keyOwner: {
          _id: { $arrayElemAt: ['$keyOwner._id', 0] },
          name: { $arrayElemAt: ['$keyOwner.name', 0] },
          email: { $arrayElemAt: ['$keyOwner.email', 0] }
        },
        room: {
          _id: { $arrayElemAt: ['$room._id', 0] },
          roomNumber: { $arrayElemAt: ['$room.roomNumber', 0] },
          floor: { $arrayElemAt: ['$room.floor', 0] }
        },
        hotel: {
          _id: { $arrayElemAt: ['$hotel._id', 0] },
          name: { $arrayElemAt: ['$hotel.name', 0] }
        }
      }
    },
    { $sort: { timestamp: -1 } }
  ];

  // Get paginated results
  const [logs, total] = await Promise.all([
    DigitalKey.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: safeLimit }
    ]),
    DigitalKey.aggregate([
      ...pipeline,
      { $count: 'total' }
    ])
  ]);

  const totalCount = total[0]?.total || 0;

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        currentPage: safePage,
        totalPages: Math.max(1, Math.ceil(totalCount / safeLimit)),
        totalItems: totalCount,
        hasNext: skip + logs.length < totalCount,
        hasPrev: safePage > 1
      }
    }
  });
}));

// Export admin digital keys data (MUST be before /:keyId to avoid route conflict)
router.get('/admin/export', authenticate, authorizePolicy('digitalKeys', 'adminAccess'), catchAsync(async (req, res) => {
  const {
    status,
    type,
    hotel,
    format = 'csv'
  } = req.query;

  // SECURITY: Enforce tenant isolation on export — staff cannot export another
  // hotel's keys by supplying a foreign hotel query param.
  const tenantExportHotelId = req.tenantId || String(req.user.hotelId || '');
  const requestedExportHotelId = hotel ? String(hotel) : null;

  if (tenantExportHotelId && requestedExportHotelId && requestedExportHotelId !== tenantExportHotelId) {
    throw new ApplicationError('Access denied: hotel parameter does not match your property', 403);
  }

  const exportHotelId = tenantExportHotelId || requestedExportHotelId;
  if (!exportHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Build query filters - always filter by hotel
  const filters = { hotelId: new mongoose.Types.ObjectId(exportHotelId) };
  if (status && status !== 'all') filters.status = status;
  if (type && type !== 'all') filters.type = type;

  // Get matching keys with populated data (capped at 1000 for export)
  const keys = await DigitalKey.find(filters)
    .populate('userId', 'name email')
    .populate('roomId', 'roomNumber floor type')
    .populate('hotelId', 'name')
    .populate('bookingId', 'bookingNumber')
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  // Prepare data for export
  const exportData = keys.map(key => ({
    'Key Code': key.keyCode,
    'Key Type': key.type,
    'Status': key.status,
    'Owner Name': key.userId?.name || 'N/A',
    'Owner Email': key.userId?.email || 'N/A',
    'Room Number': key.roomId?.roomNumber || 'N/A',
    'Floor': key.roomId?.floor || 'N/A',
    'Room Type': key.roomId?.type || 'N/A',
    'Hotel': key.hotelId?.name || 'N/A',
    'Booking Number': key.bookingId?.bookingNumber || 'N/A',
    'Valid From': key.validFrom ? key.validFrom.toISOString() : 'N/A',
    'Valid Until': key.validUntil ? key.validUntil.toISOString() : 'N/A',
    'Max Uses': key.maxUses === -1 ? 'Unlimited' : key.maxUses,
    'Current Uses': key.currentUses || 0,
    'Last Used': key.lastUsedAt ? key.lastUsedAt.toISOString() : 'Never',
    'Shared Count': key.sharedWith?.length || 0,
    'Access Logs Count': key.accessLogs?.length || 0,
    'Requires PIN': key.securitySettings?.requirePin ? 'Yes' : 'No',
    'Sharing Allowed': key.securitySettings?.allowSharing ? 'Yes' : 'No',
    'Created Date': key.createdAt.toISOString(),
    'Updated Date': key.updatedAt.toISOString()
  }));

  if (format === 'csv') {
    // Generate CSV
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="digital-keys-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } else {
    // For Excel format, we'll send JSON that can be processed client-side
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="digital-keys-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportDate: new Date().toISOString(),
      totalRecords: exportData.length,
      filters: { status, type, hotel },
      data: exportData
    });
  }
}));

/** Property staff: generate a digital key for a guest booking (owner = booking.userId) */
router.post(
  '/admin/generate',
  authenticate,
  authorizePolicy('digitalKeys', 'adminAccess'),
  validate(schemas.generateDigitalKey),
  catchAsync(async (req, res) => {
    const {
      bookingId,
      type = 'primary',
      maxUses: maxUsesBody,
      securitySettings = {},
      hotel: hotelFromBody
    } = req.body;

    // SECURITY: tenant context always wins over the body/query hotel param.
    // This prevents a staff member from generating a key for a different hotel
    // by supplying a foreign hotelId in the request body.
    const tenantHotelId = req.tenantId || String(req.user.hotelId || '');
    const requestedHotelId = hotelFromBody || req.query.hotel;

    if (tenantHotelId && requestedHotelId && String(requestedHotelId) !== tenantHotelId) {
      throw new ApplicationError('Access denied: hotel parameter does not match your property', 403);
    }

    const scopeHotelId = tenantHotelId || requestedHotelId;
    if (!scopeHotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    let safeMaxUses = -1;
    if (maxUsesBody !== undefined && maxUsesBody !== null && maxUsesBody !== '') {
      const n = Number(maxUsesBody);
      safeMaxUses = Number.isFinite(n) ? n : -1;
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      hotelId: scopeHotelId,
      status: { $in: ['confirmed', 'checked_in'] }
    })
      .populate('hotelId')
      .populate('rooms.roomId')
      .lean();

    if (!booking) {
      throw new ApplicationError('Booking not found or not eligible for digital key', 404);
    }

    const bookingHotelId = String(booking.hotelId?._id || booking.hotelId);
    if (bookingHotelId !== String(scopeHotelId)) {
      throw new ApplicationError('Booking is not in the selected property', 403);
    }

    if (!booking.rooms || booking.rooms.length === 0) {
      throw new ApplicationError('Booking has no rooms assigned', 400);
    }

    const guestUserId = booking.userId;
    if (!guestUserId) {
      throw new ApplicationError('Booking has no guest user', 400);
    }

    const existingKey = await DigitalKey.findOne({
      bookingId,
      userId: guestUserId,
      hotelId: scopeHotelId,
      status: { $in: ['active', 'expired'] }
    }).lean();

    if (existingKey && type === 'primary') {
      throw new ApplicationError('A primary key already exists for this booking', 400);
    }

    const firstRoom = booking.rooms[0];
    const keyCode = DigitalKey.generateKeyCode();
    // SECURITY FIX: Sign the QR payload with HMAC (same as guest-generated keys)
    // so the validate endpoint can verify the signature and reject forged codes.
    const qrPayload = {
      k: keyCode,
      b: booking._id.toString().slice(-8),
      r: firstRoom.roomId._id.toString().slice(-8),
      h: booking.hotelId._id.toString().slice(-8),
      t: type.charAt(0),
      ts: Math.floor(Date.now() / 1000)
    };
    const qrPayloadStr = JSON.stringify(qrPayload);
    const signature = crypto.createHmac('sha256', QR_SECRET).update(qrPayloadStr).digest('hex').slice(0, 16);
    const qrData = JSON.stringify({ ...qrPayload, sig: signature });

    const qrCode = await QRCode.toDataURL(qrData);

    const digitalKey = new DigitalKey({
      userId: guestUserId,
      bookingId: booking._id,
      roomId: firstRoom.roomId._id,
      hotelId: booking.hotelId._id,
      keyCode,
      qrCode,
      type,
      validFrom: new Date(),
      validUntil: booking.checkOut,
      maxUses: safeMaxUses,
      securitySettings: {
        requirePin: securitySettings.requirePin || false,
        pin: securitySettings.pin,
        allowSharing: securitySettings.allowSharing !== false,
        maxSharedUsers: securitySettings.maxSharedUsers || 5,
        requireApproval: securitySettings.requireApproval || false
      },
      metadata: {
        generatedBy: req.user.id,
        notes: `staff_issued:${req.user.role}`,
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      }
    });

    await digitalKey.save();
    await digitalKey.populate(keyPopulateSpec);

    const sanitizedGen = sanitizeDigitalKey(digitalKey);
    await emitDigitalKeyEvent(String(guestUserId), 'created', { digitalKey: sanitizedGen });

    try {
      const { createAndDeliverInApp } = await import('../services/inAppNotificationDeliveryService.js');
      const roomNo = firstRoom.roomId?.number || 'your room';
      await createAndDeliverInApp({
        userId: guestUserId,
        hotelId: booking.hotelId._id,
        type: 'system_alert',
        title: 'Digital key ready',
        message: `Your digital key for Room ${roomNo} is active until ${new Date(booking.checkOut).toLocaleDateString()}.`,
        priority: 'medium',
        metadata: { category: 'system', tags: ['digital_key', 'key_created', 'staff_issued'] }
      });
    } catch (e) {
      logger.warn('digital-key in-app (staff created) skipped', { error: e.message });
    }

    res.status(201).json({
      success: true,
      message: 'Digital key generated successfully',
      data: sanitizedGen
    });
  })
);

/** Property staff: revoke any guest key in the hotel */
router.delete(
  '/admin/:keyId',
  authenticate,
  authorizePolicy('digitalKeys', 'adminAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { keyId } = req.params;
    // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
    if (!mongoose.Types.ObjectId.isValid(keyId)) {
      throw new ApplicationError('Digital key not found', 404);
    }

    // SECURITY: Enforce tenant isolation — staff cannot revoke a key from
    // another hotel by supplying a foreign hotel query param.
    const tenantRevokeHotelId = req.tenantId || String(req.user.hotelId || '');
    const requestedRevokeHotelId = req.query.hotel ? String(req.query.hotel) : null;

    if (tenantRevokeHotelId && requestedRevokeHotelId && requestedRevokeHotelId !== tenantRevokeHotelId) {
      throw new ApplicationError('Access denied: hotel parameter does not match your property', 403);
    }

    const scopeHotelId = tenantRevokeHotelId || requestedRevokeHotelId;
    if (!scopeHotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    const digitalKey = await DigitalKey.findOne({
      _id: keyId,
      hotelId: scopeHotelId
    });

    if (!digitalKey) {
      throw new ApplicationError('Digital key not found', 404);
    }

    const guestUserId = String(digitalKey.userId);
    const previousStatus = digitalKey.status;
    // Pass the revoking staff member's ID for audit trail
    await digitalKey.revokeKey(String(req.user._id || req.user.id), {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });
    await digitalKey.populate(keyPopulateSpec);
    const sanitizedRevoked = sanitizeDigitalKey(digitalKey);

    await emitDigitalKeyEvent(guestUserId, 'updated', {
      digitalKey: sanitizedRevoked,
      previousStatus
    });

    try {
      const { createAndDeliverInApp } = await import('../services/inAppNotificationDeliveryService.js');
      const rn = sanitizedRevoked.roomId?.number || 'your room';
      await createAndDeliverInApp({
        userId: guestUserId,
        hotelId: scopeHotelId,
        type: 'system_alert',
        title: 'Digital key revoked',
        message: `Your digital key for Room ${rn} has been revoked by the hotel.`,
        priority: 'high',
        metadata: { category: 'system', tags: ['digital_key', 'key_revoked', 'staff_revoked'] }
      });
    } catch (e) {
      logger.warn('digital-key in-app (staff revoked) skipped', { error: e.message });
    }

    res.json({
      success: true,
      message: 'Digital key revoked successfully'
    });
  })
);

// --- Parameterized routes below (/:keyId) --- must come AFTER all static routes ---

// Get a specific digital key
router.get('/:keyId', catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.keyId)) {
    throw new ApplicationError('Digital key not found', 404);
  }
  const keyHotelId = req.tenantId || req.user.hotelId;
  const keyFilter = {
    _id: req.params.keyId,
    $or: [
      { userId: req.user.id },
      { 'sharedWith.userId': req.user.id, 'sharedWith.isActive': true }
    ]
  };
  if (keyHotelId) keyFilter.hotelId = keyHotelId;

  const digitalKey = await DigitalKey.findOne(keyFilter)
  .populate('bookingId', 'bookingNumber checkIn checkOut')
  .populate('roomId', 'number type floor')
  .populate('hotelId', 'name address')
  .populate('sharedWith.userId', 'name email').lean();
  
  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }
  
  res.json({
    success: true,
    data: sanitizeDigitalKey(digitalKey)
  });
}));

// Validate a digital key (for door access)
router.post('/validate/:keyCode', keyValidationLimiter, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { keyCode } = req.params;
  const { pin, deviceInfo = {} } = req.body;
  const now = new Date();

  const digitalKey = await DigitalKey.findByKeyCode(keyCode);

  if (!digitalKey) {
    throw new ApplicationError('Invalid key code', 404);
  }

  // Validate QR payload signature if provided
  if (req.body.sig && req.body.ts) {
    const payloadStr = JSON.stringify({ k: req.body.k, b: req.body.b, r: req.body.r, h: req.body.h, t: req.body.t, ts: req.body.ts });
    const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(payloadStr).digest('hex').slice(0, 16);
    if (req.body.sig !== expectedSig) {
      return res.status(403).json({ status: 'error', message: 'Invalid QR code signature' });
    }
    // Check timestamp freshness (5 minute window)
    const nowTs = Math.floor(Date.now() / 1000);
    if (nowTs - req.body.ts > 300) {
      return res.status(403).json({ status: 'error', message: 'QR code has expired. Please refresh your digital key.' });
    }
  }

  const requesterId = String(req.user.id);
  const requesterHotelId = String(req.user.hotelId);
  const keyOwnerId = String(digitalKey.userId?._id || digitalKey.userId);
  const keyHotelId = String(digitalKey.hotelId?._id || digitalKey.hotelId);
  const requesterEmail = req.user.email ? String(req.user.email).toLowerCase() : null;

  const isOwner = keyOwnerId === requesterId;
  const hasActiveShare = (digitalKey.sharedWith || []).some((share) => {
    if (!share?.isActive) return false;
    if (share.expiresAt && new Date(share.expiresAt) <= now) return false;
    if (share.userId && String(share.userId?._id || share.userId) === requesterId) return true;
    if (requesterEmail && share.email && String(share.email).toLowerCase() === requesterEmail) return true;
    return false;
  });

  if (keyHotelId !== requesterHotelId || (!isOwner && !hasActiveShare)) {
    throw new ApplicationError('You are not authorized to use this key', 403);
  }
  
  if (!digitalKey.canBeUsed) {
    throw new ApplicationError('Key is not valid or has expired', 400);
  }
  
  // Check PIN if required (PIN is hashed in the database)
  if (digitalKey.securitySettings.requirePin) {
    if (!pin) {
      throw new ApplicationError('PIN is required', 400);
    }
    if (!(await digitalKey.verifyPin(pin))) {
      throw new ApplicationError('Invalid PIN', 400);
    }
  }
  
  // Use the key
  await digitalKey.useKey(req.user.id, {
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    ...deviceInfo
  });

  await digitalKey.populate(keyPopulateSpec);
  const sanitizedAccess = sanitizeDigitalKey(digitalKey);
  const ownerId = String(digitalKey.userId?._id || digitalKey.userId);
  const accessorId = String(req.user.id);
  await emitDigitalKeyEvent(
    accessorId === ownerId ? [ownerId] : [accessorId, ownerId],
    'accessed',
    { digitalKey: sanitizedAccess }
  );
  
  res.json({
    success: true,
    message: 'Key validated successfully',
    data: {
      keyId: digitalKey._id,
      roomNumber: digitalKey.roomId.number,
      hotelName: digitalKey.hotelId.name,
      remainingUses: digitalKey.remainingUses,
      validUntil: digitalKey.validUntil
    }
  });
}));

// Share a digital key
router.post('/:keyId/share', validate(schemas.shareDigitalKey), catchAsync(async (req, res) => {
  const { keyId } = req.params;
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(keyId)) {
    throw new ApplicationError('Digital key not found', 404);
  }
  const { email, name, expiresAt } = req.body;

  // Do NOT use .lean() — we need Mongoose instance methods (shareWithUser)
  const shareKeyHotelId = req.tenantId || req.user.hotelId;
  const shareKeyFilter = { _id: keyId, userId: req.user.id };
  if (shareKeyHotelId) shareKeyFilter.hotelId = shareKeyHotelId;

  const digitalKey = await DigitalKey.findOne(shareKeyFilter);

  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }

  if (!digitalKey.canBeShared) {
    throw new ApplicationError('This key cannot be shared', 400);
  }

  // Find user by email if provided
  let sharedUserId = null;
  if (email) {
    const sharedUser = await User.findOne({ email, hotelId: req.user.hotelId }).lean();
    if (sharedUser) {
      sharedUserId = sharedUser._id;
    }
  }

  const shareData = {
    userId: sharedUserId,
    email,
    name,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined
  };

  await digitalKey.shareWithUser(shareData);
  await digitalKey.populate(keyPopulateSpec);
  const sanitizedShare = sanitizeDigitalKey(digitalKey);
  const sharePayload = { digitalKey: sanitizedShare, sharedWith: { name } };
  await emitDigitalKeyEvent(req.user.id, 'shared', sharePayload);
  if (sharedUserId) {
    await emitDigitalKeyEvent(sharedUserId, 'shared', sharePayload);
    try {
      const { createAndDeliverInApp } = await import('../services/inAppNotificationDeliveryService.js');
      const rn = sanitizedShare.roomId?.number || 'a room';
      await createAndDeliverInApp({
        userId: sharedUserId,
        hotelId: req.user.hotelId,
        type: 'system_alert',
        title: 'Digital key shared with you',
        message: `You now have shared access to Room ${rn}.`,
        priority: 'medium',
        metadata: { category: 'system', tags: ['digital_key', 'key_shared'] }
      });
    } catch (e) {
      logger.warn('digital-key in-app (share) skipped', { error: e.message });
    }
  }

  res.json({
    success: true,
    message: 'Key shared successfully',
    data: {
      keyId: digitalKey._id,
      sharedWith: shareData
    }
  });
}));

// Revoke a shared key
router.delete('/:keyId/share/:userIdOrEmail', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { keyId, userIdOrEmail } = req.params;
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(keyId)) {
    throw new ApplicationError('Digital key not found', 404);
  }

  // Do NOT use .lean() — we need Mongoose instance methods (revokeShare)
  const revokeShareHotelId = req.tenantId || req.user.hotelId;
  const revokeShareFilter = { _id: keyId, userId: req.user.id };
  if (revokeShareHotelId) revokeShareFilter.hotelId = revokeShareHotelId;

  const digitalKey = await DigitalKey.findOne(revokeShareFilter);

  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }

  const shareEntry = digitalKey.sharedWith.find(
    (share) =>
      (share.userId && share.userId.toString() === userIdOrEmail) ||
      (share.email && share.email === userIdOrEmail)
  );

  await digitalKey.revokeShare(userIdOrEmail);
  await digitalKey.populate(keyPopulateSpec);
  const sanitizedRevokeShare = sanitizeDigitalKey(digitalKey);
  await emitDigitalKeyEvent(req.user.id, 'share-revoked', { digitalKey: sanitizedRevokeShare });
  if (shareEntry?.userId) {
    await emitDigitalKeyEvent(shareEntry.userId, 'share-revoked', { digitalKey: sanitizedRevokeShare });
  }

  res.json({
    success: true,
    message: 'Key access revoked successfully'
  });
}));

// Get access logs for a digital key
router.get('/:keyId/logs', catchAsync(async (req, res) => {
  const { keyId } = req.params;
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(keyId)) {
    throw new ApplicationError('Digital key not found', 404);
  }
  const { page = 1, limit = 50 } = req.query;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (safePage - 1) * safeLimit;

  const logsHotelId = req.tenantId || req.user.hotelId;
  const logsFilter = { _id: keyId, userId: req.user.id };
  if (logsHotelId) logsFilter.hotelId = logsHotelId;

  const digitalKey = await DigitalKey.findOne(logsFilter)
    .populate('accessLogs.userId', 'name email').lean();
  
  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }
  
  const logs = digitalKey.accessLogs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(skip, skip + safeLimit);
  
  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        currentPage: safePage,
        totalPages: Math.max(1, Math.ceil(digitalKey.accessLogs.length / safeLimit)),
        totalItems: digitalKey.accessLogs.length,
        hasNext: skip + logs.length < digitalKey.accessLogs.length,
        hasPrev: safePage > 1
      }
    }
  });
}));

// Revoke a digital key
router.delete('/:keyId', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { keyId } = req.params;
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(keyId)) {
    throw new ApplicationError('Digital key not found', 404);
  }
  const selfRevokeHotelId = req.tenantId || req.user.hotelId;

  // Do NOT use .lean() — we need Mongoose instance methods (revokeKey)
  const selfRevokeFilter = { _id: keyId, userId: req.user.id };
  if (selfRevokeHotelId) selfRevokeFilter.hotelId = selfRevokeHotelId;

  const digitalKey = await DigitalKey.findOne(selfRevokeFilter);

  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }

  const previousStatus = digitalKey.status;
  await digitalKey.revokeKey(String(req.user._id || req.user.id), {
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip
  });
  await digitalKey.populate(keyPopulateSpec);
  const sanitizedRevoked = sanitizeDigitalKey(digitalKey);
  await emitDigitalKeyEvent(req.user.id, 'updated', {
    digitalKey: sanitizedRevoked,
    previousStatus
  });

  try {
    const { createAndDeliverInApp } = await import('../services/inAppNotificationDeliveryService.js');
    const rn = sanitizedRevoked.roomId?.number || 'your room';
    await createAndDeliverInApp({
      userId: req.user.id,
      hotelId: req.user.hotelId,
      type: 'system_alert',
      title: 'Digital key revoked',
      message: `Your digital key for Room ${rn} has been revoked.`,
      priority: 'medium',
      metadata: { category: 'system', tags: ['digital_key', 'key_revoked'] }
    });
  } catch (e) {
    logger.warn('digital-key in-app (revoked) skipped', { error: e.message });
  }

  res.json({
    success: true,
    message: 'Digital key revoked successfully'
  });
}));

export default router;
