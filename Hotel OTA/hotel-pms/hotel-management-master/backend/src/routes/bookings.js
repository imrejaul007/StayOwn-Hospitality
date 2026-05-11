import express from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess, refToHotelIdString } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate, schemas } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { dashboardUpdateService } from '../services/dashboardUpdateService.js';
import { createAndDeliverInApp } from '../services/inAppNotificationDeliveryService.js';
import websocketService from '../services/websocketService.js';
import { marketingSyncMiddleware } from '../middleware/marketingSyncMiddleware.js';
import { bookingCompletionMiddleware } from '../middleware/crmTrackingMiddleware.js';
import logger from '../utils/logger.js';
import cancellationService from '../services/cancellationService.js';
import { validateTransition } from '../utils/bookingStateMachine.js';
import bookingService from '../modules/booking/service.js';
import availabilityService from '../services/availabilityService.js';
import {
  getRoomTypeCountsForBooking,
  expandPlan,
  inventoryPlansEqual,
  patchTouchesInventory
} from '../services/bookingInventoryPlan.js';
import {
  getSettlement,
  addSettlementAdjustment,
  paySettlement,
  markNoShow
} from '../modules/booking/controller.js';
import bookingAuditService from '../services/bookingAuditService.js';
import invoiceLifecycleSyncService from '../services/invoiceLifecycleSyncService.js';
import { awardStayCompletionPoints } from '../services/loyaltyAwardService.js';
import { awardBrandCoinsOnCheckout } from '../services/rezOtaConnector.js';
import pmsOtaIntegration from '../services/pmsOtaIntegration.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true);

/**
 * @swagger
 * /bookings/current-hotel:
 *   get:
 *     summary: Get current user's hotel ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user's hotel ID
 */
router.get('/current-hotel', authenticate, ensureTenantContext, ensurePropertyAccess, catchAsync(async (req, res) => {
  let scopedHotelId = refToHotelIdString(req.query.hotelId) || refToHotelIdString(req.user.hotelId || req.user.hotel);

  if (!scopedHotelId && (req.user.role === 'guest' || req.user.role === 'travel_agent')) {
    const now = new Date();
    const booking = await Booking.findOne({
      userId: req.user._id,
      status: { $in: ['confirmed', 'checked_in', 'pending'] },
      checkOut: { $gte: now }
    })
      .sort({ checkIn: -1 })
      .select('hotelId')
      .lean();
    scopedHotelId = booking?.hotelId ? refToHotelIdString(booking.hotelId) : null;
  }

  res.json({
    status: 'success',
    data: {
      hotelId: scopedHotelId
    }
  });
}));

/**
 * @swagger
 * /bookings/upcoming:
 *   get:
 *     summary: Get upcoming bookings (arrivals within next 7-30 days)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to look ahead for upcoming arrivals
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of upcoming bookings
 */
router.get('/upcoming', authenticate, ensureTenantContext, ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    days: rawDays = 7,
    page: rawPage = 1,
    limit: rawLimit = 50
  } = req.query;

  // Sanitize and clamp query params to prevent NaN/Infinity/abuse
  const days = Math.min(Math.max(parseInt(rawDays) || 7, 1), 90);
  const page = Math.max(parseInt(rawPage) || 1, 1);
  const limit = Math.min(Math.max(parseInt(rawLimit) || 50, 1), 100);

  // Build query based on user role
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Query for upcoming bookings:
  // - confirmed/pending: checkIn is today or in the future (within specified days)
  // - checked_in: checkOut is in the future (guest is still in hotel)
  const query = {
    $or: [
      {
        // Future arrivals (confirmed or pending)
        status: { $in: ['confirmed', 'pending'] },
        checkIn: {
          $gte: today,
          $lte: futureDate
        }
      },
      {
        // Currently checked-in guests (not yet checked out)
        status: 'checked_in',
        checkOut: { $gt: today } // Checkout is in the future
      }
    ]
  };

  // Role-based filtering - wrap $or query with additional conditions
  const finalQuery = { ...query };

  // Use the user's own hotelId; only admin/manager may override via query param
  const scopedHotelId = (req.user.role === 'admin' || req.user.role === 'manager')
    ? (req.query.hotelId || req.user.hotelId)
    : req.user.hotelId;
  if (req.user.role === 'guest') {
    finalQuery.userId = req.user._id;
  } else if (scopedHotelId) {
    // All non-guest roles MUST be scoped to a hotel to prevent cross-tenant data leaks
    finalQuery.hotelId = scopedHotelId;
  } else {
    // No hotelId available - return empty to prevent cross-tenant exposure
    return res.json({
      status: 'success',
      results: 0,
      stats: { todayArrivals: 0, tomorrowArrivals: 0, totalUpcoming: 0 },
      pagination: { page, limit, total: 0, pages: 0 },
      data: []
    });
  }

  const skip = (page - 1) * limit;

  const bookings = await Booking.find(finalQuery)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name address contact')
    .populate('corporateBooking.corporateCompanyId', 'name gstNumber')
    .sort({ checkIn: 1 }) // Sort by check-in date (ascending)
    .skip(skip)
    .limit(limit).lean();

  const total = await Booking.countDocuments(finalQuery);

  // Get quick stats for today and tomorrow arrivals
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  // Count arrivals for today (confirmed, pending, or checked_in bookings with checkIn today)
  const todayQuery = {
    status: { $in: ['confirmed', 'pending', 'checked_in'] },
    checkIn: { $gte: today, $lt: tomorrow }
  };

  // Count arrivals for tomorrow (confirmed or pending bookings checking in tomorrow)
  const tomorrowQuery = {
    status: { $in: ['confirmed', 'pending'] },
    checkIn: { $gte: tomorrow, $lt: dayAfterTomorrow }
  };

  // Add role-based filtering to stats queries (must match main query scoping)
  if (req.user.role === 'guest') {
    todayQuery.userId = req.user._id;
    tomorrowQuery.userId = req.user._id;
  } else if (scopedHotelId) {
    todayQuery.hotelId = scopedHotelId;
    tomorrowQuery.hotelId = scopedHotelId;
  }
  // Note: if no scopedHotelId, the early return above already handled it

  const [todayCount, tomorrowCount] = await Promise.all([
    Booking.countDocuments(todayQuery),
    Booking.countDocuments(tomorrowQuery)
  ]);

  res.json({
    status: 'success',
    results: bookings.length,
    stats: {
      todayArrivals: todayCount,
      tomorrowArrivals: tomorrowCount,
      totalUpcoming: total
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: bookings
  });
}));

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Get bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, checked_in, checked_out, cancelled, no_show]
 *       - in: query
 *         name: checkIn
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOut
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [corporate, individual]
 *         description: Filter by booking type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of bookings
 */
router.get('/', authenticate, ensureTenantContext, ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    status,
    paymentStatus,
    source,
    search,
    checkIn,
    checkOut,
    checkInDate,
    checkOutDate,
    startDate,
    endDate,
    type,
    page = 1,
    limit = 10
  } = req.query;

  // Enforce max limit to prevent unbounded queries
  const parsedLimit = Math.min(parseInt(limit) || 10, 100);

  // Build query based on user role
  const query = {};

  // Use the user's own hotelId; only admin/manager may override via query param
  const scopedHotelId = (req.user.role === 'admin' || req.user.role === 'manager')
    ? (req.query.hotelId || req.user.hotelId)
    : req.user.hotelId;
  if (req.user.role === 'guest') {
    query.userId = req.user._id;
  } else if (scopedHotelId) {
    // All roles (admin, manager, staff, frontdesk) are scoped to their hotel
    query.hotelId = scopedHotelId;
  } else {
    // No hotelId available for non-guest role - refuse to return unscoped data
    const parsedPage = parseInt(page) || 1;
    return res.json({
      status: 'success',
      results: 0,
      pagination: { page: parsedPage, current: parsedPage, limit: parsedLimit, total: 0, pages: 0 },
      stats: { total: 0, totalBookings: 0, pending: 0, pendingBookings: 0, averageBookingValue: 0, totalRevenue: 0 },
      data: []
    });
  }

  if (status) {
    // Support comma-separated status values (e.g., "confirmed,pending,checked_in")
    if (status.includes(',')) {
      query.status = { $in: status.split(',').map(s => s.trim()) };
    } else {
      query.status = status;
    }
  }

  // Filter by payment status
  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  // Filter by booking source
  if (source) {
    query.source = source;
  }

  // Search by guest name, email, or booking number
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { bookingNumber: searchRegex },
      { 'guestDetails.name': searchRegex }
    ];
    // Note: searching by populated userId fields (name/email) requires
    // a post-query filter or a lookup aggregation. For bookingNumber
    // and guestDetails.name we can filter directly.
  }

  // Filter by booking type (corporate, individual)
  if (type === 'corporate') {
    query['corporateBooking.corporateCompanyId'] = { $exists: true, $ne: null };
  } else if (type === 'individual') {
    // Only add $or for type filter if search didn't already set it
    if (!query.$or) {
      query.$or = [
        { 'corporateBooking.corporateCompanyId': { $exists: false } },
        { 'corporateBooking.corporateCompanyId': null }
      ];
    }
  }

  if (checkIn) {
    query.checkIn = { $gte: new Date(checkIn) };
  }

  if (checkOut) {
    query.checkOut = { $lte: new Date(checkOut) };
  }

  // Exact-day filters for dashboard use-cases (arrivals/departures on a specific date)
  if (checkInDate) {
    const d = new Date(checkInDate);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    query.checkIn = { $gte: d, $lt: next };
  }
  if (checkOutDate) {
    const d = new Date(checkOutDate);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    query.checkOut = { $gte: d, $lt: next };
  }

  // Date range overlap filter: find bookings that overlap with [startDate, endDate]
  if (startDate && endDate) {
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    // A booking overlaps if: checkIn < rangeEnd AND checkOut > rangeStart
    if (!query.checkIn) query.checkIn = {};
    if (!query.checkOut) query.checkOut = {};
    query.checkIn = { ...query.checkIn, $lte: rangeEnd };
    query.checkOut = { ...query.checkOut, $gte: rangeStart };
  }

  const skip = (parseInt(page) - 1) * parsedLimit;

  const bookings = await Booking.find(query)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name address contact')
    .populate('corporateBooking.corporateCompanyId', 'name gstNumber')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parsedLimit).lean();

  const total = await Booking.countDocuments(query);

  // Calculate stats for the current query
  const baseQuery = { ...query };
  delete baseQuery.status; // Remove status filter for overall counts

  // Build aggregation match with proper ObjectId casting (aggregation bypasses Mongoose casting)
  const aggMatch = { ...baseQuery };
  if (aggMatch.hotelId && typeof aggMatch.hotelId === 'string' && mongoose.Types.ObjectId.isValid(aggMatch.hotelId)) {
    aggMatch.hotelId = new mongoose.Types.ObjectId(aggMatch.hotelId);
  }
  if (aggMatch.userId && typeof aggMatch.userId === 'string' && mongoose.Types.ObjectId.isValid(aggMatch.userId)) {
    aggMatch.userId = new mongoose.Types.ObjectId(aggMatch.userId);
  }

  const [
    totalBookings,
    pendingCount,
    allBookingsForStats
  ] = await Promise.all([
    Booking.countDocuments(baseQuery),
    Booking.countDocuments({ ...baseQuery, status: 'pending' }),
    Booking.aggregate([
      { $match: aggMatch },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ])
  ]);

  // Calculate average booking value from aggregation
  const revenueStats = allBookingsForStats[0] || { totalRevenue: 0, count: 0 };
  const totalRevenue = revenueStats.totalRevenue || 0;
  const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

  const parsedPage = parseInt(page) || 1;
  const totalPages = Math.ceil(total / parsedLimit) || 1;

  res.json({
    status: 'success',
    results: bookings.length,
    pagination: {
      page: parsedPage,
      current: parsedPage, // alias for frontend compatibility
      limit: parsedLimit,
      total,
      pages: totalPages
    },
    stats: {
      total: totalBookings,
      totalBookings,
      pending: pendingCount,
      pendingBookings: pendingCount,
      averageBookingValue,
      totalRevenue
    },
    data: bookings
  });
}));

/**
 * @swagger
 * /bookings/room/{roomId}:
 *   get:
 *     summary: Get bookings for a specific room
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, checked_in, checked_out, cancelled, no_show]
 *       - in: query
 *         name: timeFilter
 *         schema:
 *           type: string
 *           enum: [past, future, current, all]
 *         default: all
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of bookings for the room
 */
router.get('/room/:roomId', authenticate, ensureTenantContext, authorizePolicy('bookings', 'getRoomBookings'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const {
    status,
    timeFilter = 'all',
    page: rawPage = 1,
    limit: rawLimit = 10
  } = req.query;

  const parsedPage = Math.max(parseInt(rawPage) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 100);

  // Validate room exists and user has access
  const room = await Room.findById(roomId).lean();
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  // Check if user has access to this hotel (all non-guest roles must match)
  const userHotelId = req.user.hotelId?.toString();
  if (req.user.role !== 'guest' && userHotelId && userHotelId !== room.hotelId.toString()) {
    throw new ApplicationError('You do not have access to this room', 403);
  }

  // Build query - always scope to the room's hotel for tenant isolation
  const query = {
    'rooms.roomId': roomId,
    hotelId: room.hotelId
  };

  if (status) {
    query.status = status;
  }

  // Add time-based filters
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (timeFilter) {
    case 'past':
      query.checkOut = { $lt: today };
      break;
    case 'future':
      query.checkIn = { $gt: today };
      break;
    case 'current':
      query.$and = [
        { checkIn: { $lte: today } },
        { checkOut: { $gte: today } }
      ];
      break;
    // 'all' case - no additional filter needed
  }

  const skip = (parsedPage - 1) * parsedLimit;

  const bookings = await Booking.find(query)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name')
    .sort({ checkIn: -1 })
    .skip(skip)
    .limit(parsedLimit).lean();

  const total = await Booking.countDocuments(query);

  res.json({
    status: 'success',
    data: {
      bookings,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      }
    }
  });
}));

// Check room availability for given dates
router.post('/check-availability', validate(mutationBaselineSchema), authenticate, authorizePolicy('bookings', 'baseAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const { roomIds, checkIn, checkOut, hotelId } = req.body;

  if (!roomIds || !checkIn || !checkOut) {
    throw new ApplicationError('roomIds, checkIn, and checkOut are required', 400);
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkOutDate <= checkInDate) {
    throw new ApplicationError('Check-out must be after check-in', 400);
  }

  // Always use the authenticated user's hotelId to prevent cross-tenant availability checks
  const resolvedHotelId = hotelId || req.user.hotelId;
  if (!resolvedHotelId) {
    throw new ApplicationError('Hotel context is required for availability check', 400);
  }

  // Find overlapping bookings for the requested rooms and dates
  const overlappingBookings = await Booking.find({
    hotelId: resolvedHotelId,
    'rooms.roomId': { $in: roomIds },
    status: { $nin: ['cancelled', 'no_show', 'checked_out'] },
    $or: [
      { checkIn: { $lt: checkOutDate }, checkOut: { $gt: checkInDate } }
    ]
  }).select('rooms checkIn checkOut status bookingNumber').lean().limit(100);

  const unavailableRoomIds = new Set();
  for (const booking of overlappingBookings) {
    for (const room of booking.rooms) {
      if (roomIds.includes(room.roomId?.toString())) {
        unavailableRoomIds.add(room.roomId.toString());
      }
    }
  }

  const availability = roomIds.map(roomId => ({
    roomId,
    available: !unavailableRoomIds.has(roomId.toString())
  }));

  res.json({
    status: 'success',
    data: {
      available: unavailableRoomIds.size === 0,
      rooms: availability,
      conflicts: overlappingBookings.length
    }
  });
}));

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details
 */
router.get('/:id', authenticate, ensureTenantContext, ensurePropertyAccess, catchAsync(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type baseRate currentRate')
    .populate('hotelId', 'name address contact policies').lean();

  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest' && booking.userId._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You do not have permission to view this booking', 403);
  }

  // Enforce strict tenant isolation for all non-guest roles.
  const bookingHotelId =
    typeof booking.hotelId === 'object' && booking.hotelId?._id
      ? booking.hotelId._id.toString()
      : booking.hotelId?.toString?.() || '';
  const userHotelId = req.user?.hotelId?.toString?.() || '';
  if (req.user.role !== 'guest' && bookingHotelId !== userHotelId) {
    throw new ApplicationError('You do not have permission to view this booking', 403);
  }

  res.json({
    status: 'success',
    data: {
      booking
    }
  });
}));

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - roomIds
 *               - checkIn
 *               - checkOut
 *               - idempotencyKey
 *             properties:
 *               hotelId:
 *                 type: string
 *               roomIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               checkIn:
 *                 type: string
 *                 format: date
 *               checkOut:
 *                 type: string
 *                 format: date
 *               guestDetails:
 *                 type: object
 *               idempotencyKey:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post('/',
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'create'),
  ensurePropertyAccess,
  bookingCompletionMiddleware,
  validate(schemas.createBooking),
  marketingSyncMiddleware('booking_created'),
  catchAsync(async (req, res) => {
    logger.debug('Create booking request received', { hotelId: req.body.hotelId, userId: req.body.userId });

    const {
      hotelId,
      userId,
      roomIds,
      checkIn,
      checkOut,
      guestDetails,
      totalAmount,
      currency,
      paymentStatus,
      status,
      idempotencyKey: clientIdempotencyKey,
      roomType, // Add roomType field for room-type bookings
      // Payment information for walk-in bookings (legacy singular fields)
      paymentMethod,
      advanceAmount,
      paymentReference,
      paymentNotes,
      // Payment information for walk-in bookings (new array-based fields from WalkInBooking)
      paymentMethods: reqPaymentMethods,
      paidAmount: reqPaidAmount,
      remainingAmount: reqRemainingAmount,
      // Walk-in booking metadata
      source: reqSource,
      checkInTime: reqCheckInTime,
      // Walk-in guest details for auto-registration
      guestName,
      guestEmail,
      guestPhone
    } = req.body;

    logger.debug('Booking payment fields', { paymentMethod, hasAdvanceAmount: !!advanceAmount, hasPaymentMethods: !!(reqPaymentMethods && reqPaymentMethods.length) });

    const session = await mongoose.startSession();

    try {
      // Use snapshot read concern for stronger isolation against double-booking
      await session.withTransaction(async () => {
        const {
          idempotencyKey,
          checkInDate,
          checkOutDate,
          rooms,
          roomsWithRates,
          nights,
          calculatedTotal
        } = await bookingService.prepareBookingCreation({
          clientIdempotencyKey,
          requestedUserId: userId || req.user._id,
          userId,
          roomIds,
          hotelId,
          checkIn,
          checkOut,
          totalAmount,
          session
        });

        // Create booking - use admin-provided values when available
        // Prepare payment details if payment information is provided
        // Supports both legacy singular fields (paymentMethod/advanceAmount) and
        // new array-based fields (paymentMethods[]/paidAmount) from WalkInBooking
        logger.debug('Payment processing check', { paymentMethod, hasAdvanceAmount: !!advanceAmount, hasPaymentMethods: !!(reqPaymentMethods && reqPaymentMethods.length) });

        // IMPORTANT: This object is spread into the booking document at the TOP LEVEL.
        // The key MUST be 'paymentDetails' (matching the schema subdocument name) so
        // Mongoose maps it correctly. Do NOT spread individual sub-fields at top level.
        let bookingPaymentData = {};
        const numericAdvanceAmount = Number(advanceAmount);

        if (Array.isArray(reqPaymentMethods) && reqPaymentMethods.length > 0) {
          // New array-based payment format from WalkInBooking component
          const walkinTotalPaid = reqPaymentMethods.reduce((sum, pm) => sum + (Number(pm.amount) || 0), 0);
          bookingPaymentData = {
            paymentDetails: {
              paymentMethods: reqPaymentMethods.map(pm => ({
                method: pm.method || 'cash',
                amount: Number(pm.amount) || 0,
                reference: pm.reference || '',
                processedBy: req.user._id,
                processedAt: new Date(),
                notes: pm.notes || 'Walk-in booking payment'
              })),
              totalPaid: walkinTotalPaid,
              remainingAmount: Math.max(0, (totalAmount || calculatedTotal) - walkinTotalPaid),
              collectedAt: new Date(),
              collectedBy: req.user._id
            }
          };
          logger.debug('Payment details created from paymentMethods array', { totalPaid: walkinTotalPaid });
        } else if (paymentMethod && numericAdvanceAmount > 0) {
          // Legacy singular payment format
          bookingPaymentData = {
            paymentDetails: {
              paymentMethods: [{
                method: paymentMethod,
                amount: numericAdvanceAmount,
                reference: paymentReference || '',
                processedBy: req.user._id,
                processedAt: new Date(),
                notes: paymentNotes || 'Walk-in booking payment'
              }],
              totalPaid: numericAdvanceAmount,
              remainingAmount: Math.max(0, (totalAmount || calculatedTotal) - numericAdvanceAmount),
              collectedAt: new Date(),
              collectedBy: req.user._id
            }
          };
          logger.debug('Payment details created from legacy singular fields');
        } else {
          logger.debug('Payment skipped - no payment data provided');
        }

        // Ensure paymentStatus is consistent with actual payment data.
        // Since Booking.create([...]) uses insertMany and does NOT run pre-save hooks,
        // we must validate consistency here at the route handler level.
        let resolvedPaymentStatus = paymentStatus || 'pending';
        if (bookingPaymentData.paymentDetails) {
          const pd = bookingPaymentData.paymentDetails;
          const bookingTotal = totalAmount || calculatedTotal;
          if (pd.totalPaid >= bookingTotal && bookingTotal > 0) {
            resolvedPaymentStatus = 'paid';
          } else if (pd.totalPaid > 0) {
            resolvedPaymentStatus = 'partially_paid';
          } else {
            resolvedPaymentStatus = 'pending';
          }
        } else if (resolvedPaymentStatus === 'paid') {
          // paymentStatus says 'paid' but no payment data was provided -- reset to pending
          resolvedPaymentStatus = 'pending';
        }

        // Look up rate plan for cancellation policy snapshot
        let ratePlanSnapshot = { cancellationPolicy: { type: 'flexible', hoursBeforeCheckIn: 24, penaltyPercentage: 0 } };
        if (req.body.ratePlanId) {
          try {
            const { RatePlan } = await import('../models/RateManagement.js');
            const ratePlan = await RatePlan.findOne({ planId: req.body.ratePlanId }).lean();
            if (ratePlan?.cancellationPolicy) {
              ratePlanSnapshot = { cancellationPolicy: ratePlan.cancellationPolicy };
            }
          } catch (e) { /* Use default policy */ }
        }

        // Auto-create guest for walk-in bookings if no userId provided
        let resolvedUserId = userId;
        if (!resolvedUserId && guestName) {
          try {
            // Check if guest exists by phone or email
            let guestUser = null;
            if (guestEmail) {
              guestUser = await User.findOne({ email: guestEmail }).lean();
            }
            if (!guestUser && guestPhone) {
              guestUser = await User.findOne({ phone: guestPhone }).lean();
            }

            if (!guestUser) {
              const crypto = await import('crypto');
              guestUser = await User.create({
                name: guestName,
                email: guestEmail || `walkin_${Date.now()}@placeholder.local`,
                phone: guestPhone || '',
                role: 'guest',
                password: crypto.randomBytes(16).toString('hex'),
                hotelId: hotelId,
                isActive: true
              });
              logger.info('Auto-created guest for walk-in booking', { userId: guestUser._id });
            }

            resolvedUserId = guestUser._id;
          } catch (guestError) {
            logger.warn('Failed to auto-create guest for walk-in', { error: guestError.message });
          }
        }

        const holdPrimaryType =
          (!rooms || rooms.length === 0) &&
          req.body.roomTypeId &&
          mongoose.Types.ObjectId.isValid(String(req.body.roomTypeId));

        const booking = await Booking.create([{
          hotelId,
          userId: resolvedUserId || req.user._id, // Use provided userId for admin bookings, fallback to current user
          rooms: roomsWithRates,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights,
          guestDetails,
          totalAmount: totalAmount || calculatedTotal, // Use provided total or calculated total (required for non-room bookings)
          currency: currency || 'INR',
          idempotencyKey,
          status: status || 'pending',
          paymentStatus: resolvedPaymentStatus,
          roomType, // Add roomType for room-type preference bookings
          ...(reqSource && ['direct','walk_in','phone','email','web','online','booking_com','expedia','airbnb','ota','manual','frontdesk'].includes(reqSource) ? { source: reqSource } : { source: 'direct' }),
          ...(reqCheckInTime ? { checkInTime: new Date(reqCheckInTime) } : {}),
          ...(holdPrimaryType
            ? {
                primaryRoomTypeId: new mongoose.Types.ObjectId(String(req.body.roomTypeId)),
                primaryRoomQuantity: Math.max(1, Number(req.body.primaryRoomQuantity) || 1)
              }
            : {}),
          ratePlanSnapshot,
          ...bookingPaymentData // Spread as { paymentDetails: { paymentMethods, totalPaid, remainingAmount, ... } }
        }], { session });

        // Keep RoomAvailability calendar aligned when specific rooms are assigned (FAB-004/005)
        if (rooms && rooms.length > 0) {
          const countsByRoomType = new Map();
          for (const room of rooms) {
            const rtId = room.roomTypeId;
            if (!rtId) continue;
            const key = rtId.toString();
            countsByRoomType.set(key, (countsByRoomType.get(key) || 0) + 1);
          }
          for (const [roomTypeIdStr, roomsCount] of countsByRoomType) {
            await availabilityService.reserveRoomsWithParentSession(session, {
              hotelId,
              roomTypeId: new mongoose.Types.ObjectId(roomTypeIdStr),
              checkIn: checkInDate,
              checkOut: checkOutDate,
              roomsCount,
              bookingId: booking[0]._id,
              source: 'direct',
              userId: req.user._id
            });
          }
        } else if (holdPrimaryType) {
          await availabilityService.reserveRoomsWithParentSession(session, {
            hotelId,
            roomTypeId: new mongoose.Types.ObjectId(String(req.body.roomTypeId)),
            checkIn: checkInDate,
            checkOut: checkOutDate,
            roomsCount: Math.max(1, Number(req.body.primaryRoomQuantity) || 1),
            bookingId: booking[0]._id,
            source: 'direct',
            userId: req.user._id
          });
        }

        // Create corresponding invoice for billing history
        const finalAmount = totalAmount || calculatedTotal;
        const bookingCurrency = currency || 'INR';
        
        // Calculate due date (typically 30 days from issue date)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        // Create invoice items from room charges
        const invoiceItems = roomsWithRates.length > 0 
          ? roomsWithRates.map(room => {
              const roomDetails = rooms.find(r => r._id.toString() === room.roomId.toString());
              return {
                description: `Room ${roomDetails?.roomNumber || 'N/A'} - ${roomDetails?.type || 'Standard'} (${nights} nights)`,
                category: 'accommodation',
                quantity: nights,
                unitPrice: room.rate,
                totalPrice: room.rate * nights,
                taxRate: 18, // 18% GST standard rate
                taxAmount: Math.round((room.rate * nights * 18) / 100 * 100) / 100
              };
            })
          : [{
              description: `Accommodation Booking (${nights} nights) - Room allocation pending`,
              category: 'accommodation',
              quantity: nights,
              unitPrice: Math.round(finalAmount / nights),
              totalPrice: finalAmount,
              taxRate: 18, // 18% GST for Indian bookings
              taxAmount: 0 // Tax already included in finalAmount from frontend
            }];
        
        // Calculate subtotal and tax
        const subtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const taxAmount = invoiceItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const totalWithTax = subtotal + taxAmount;
        
        const invoice = await Invoice.create([{
          hotelId,
          bookingId: booking[0]._id,
          guestId: resolvedUserId || req.user._id,
          type: 'accommodation',
          status: resolvedPaymentStatus === 'paid' ? 'paid' : 'issued',
          items: invoiceItems,
          subtotal,
          taxAmount,
          totalAmount: totalWithTax,
          currency: bookingCurrency,
          dueDate,
          paidDate: resolvedPaymentStatus === 'paid' ? new Date() : null,
          payments: paymentStatus === 'paid' ? [{
            amount: totalWithTax,
            method: 'credit_card', // Default method, can be updated later
            paidBy: resolvedUserId || req.user._id,
            paidAt: new Date(),
            notes: 'Booking payment'
          }] : []
        }], { session });

        // Notify admin dashboard of new booking
        await dashboardUpdateService.notifyNewBooking(booking[0], req.user);
        await dashboardUpdateService.triggerDashboardRefresh(hotelId, 'bookings');

        // Real-time WebSocket notifications
        try {
          // Notify hotel staff and admins of new booking
          await websocketService.broadcastToHotel(hotelId, 'booking:created', {
            booking: booking[0],
            invoice: invoice[0],
            user: req.user
          });

          // Notify the guest who created the booking
          if (booking[0].userId) {
            await websocketService.sendToUser(booking[0].userId.toString(), 'booking:created', {
              booking: booking[0],
              invoice: invoice[0]
            });
          }

          // Notify staff roles specifically (including frontdesk), scoped to hotel
          const bookingHotelId = (booking[0].hotelId?._id || booking[0].hotelId)?.toString();
          if (bookingHotelId) {
            await websocketService.broadcastToHotelRole(bookingHotelId, 'staff', 'booking:created', booking[0]);
            await websocketService.broadcastToHotelRole(bookingHotelId, 'admin', 'booking:created', booking[0]);
            await websocketService.broadcastToHotelRole(bookingHotelId, 'manager', 'booking:created', booking[0]);
            await websocketService.broadcastToHotelRole(bookingHotelId, 'frontdesk', 'booking:created', booking[0]);
          }
        } catch (wsError) {
          // Log WebSocket errors but don't fail the booking creation
          logger.warn('Failed to send real-time booking notification', { error: wsError.message });
        }

        if (booking[0].userId) {
          try {
            await createAndDeliverInApp({
              userId: booking[0].userId,
              hotelId,
              type: 'booking_confirmation',
              title: 'Booking confirmed',
              message: `Your stay is confirmed. Reference ${booking[0].bookingNumber || ''}.`,
              priority: 'medium',
              metadata: { category: 'booking', bookingId: booking[0]._id }
            });
          } catch (gErr) {
            logger.warn('Guest booking confirmation notification failed', { error: gErr.message });
          }
        }

        res.status(201).json({
          status: 'success',
          data: {
            booking: booking[0],
            invoice: invoice[0]
          }
        });

        // PMS→OTA: Emit booking_confirmed webhook for paid/confirmed bookings (fire-and-forget)
        try {
          const hotel = await mongoose.model('Hotel').findById(hotelId).lean();
          const guest = await User.findById(booking[0].userId).lean();
          const firstRoom = booking[0].rooms?.[0]?.roomId
            ? await mongoose.model('Room').findById(booking[0].rooms[0].roomId).lean()
            : null;

          // Only emit for paid or confirmed bookings
          if (['paid', 'confirmed'].includes(booking[0].status) && hotel) {
            await pmsOtaIntegration.emitBookingConfirmed(
              hotel,
              booking[0],
              guest
            );
          }
        } catch (webhookErr) {
          logger.warn('[PMS→OTA] Booking confirmed webhook emission failed (non-blocking):', webhookErr.message);
        }
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  })
);

/**
 * @swagger
 * /bookings/{id}:
 *   patch:
 *     summary: Update booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking updated successfully
 */
router.patch('/:id',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'update'),
  ensurePropertyAccess,
  marketingSyncMiddleware('booking_updated'),
  catchAsync(async (req, res) => {
    // SECURITY: filter by hotelId to prevent cross-hotel data leakage in audit snapshot.
    // Using findById alone would allow a manager from Hotel A to read Hotel B booking data
    // even though the subsequent findOneAndUpdate correctly rejects the mutation.
    const booking = await Booking.findOne({ _id: req.params.id, hotelId: req.tenantId }).lean();
    if (!booking) throw new ApplicationError('Booking not found', 404);
    bookingService.assertCanModifyBooking(booking, req.user, 'modify');
    const bookingBeforeUpdate = bookingAuditService.buildSnapshot(booking);
    const updateData = bookingService.buildBookingUpdateData(req.body, req.user.role);

    if (updateData.status && updateData.status !== booking.status) {
      const transition = validateTransition(booking.status, updateData.status);
      if (!transition.valid) {
        throw new ApplicationError(transition.reason || `Invalid status transition from ${booking.status} to ${updateData.status}`, 400);
      }
    }

    const originalBooking = await Booking.findOne({ _id: req.params.id, hotelId: req.tenantId }).lean();
    const oldPaymentStatus = originalBooking?.paymentStatus;

    const updatedBooking = await Booking.findOneAndUpdate(
      { _id: req.params.id, hotelId: booking.hotelId?._id || booking.hotelId },
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'rooms.roomId', select: 'roomNumber type baseRate currentRate' },
      { path: 'userId', select: 'name email phone' },
      { path: 'hotelId', select: 'name address contact' }
    ]);

    if (
      patchTouchesInventory(updateData) &&
      !['cancelled', 'checked_out', 'no_show'].includes(updatedBooking.status)
    ) {
      const oldCounts = await getRoomTypeCountsForBooking(originalBooking);
      const newCounts = await getRoomTypeCountsForBooking(updatedBooking.toObject());

      const oldHotelId = originalBooking.hotelId?._id || originalBooking.hotelId;
      const newHotelId = updatedBooking.hotelId?._id || updatedBooking.hotelId;

      const oldPlan = expandPlan(oldHotelId, originalBooking.checkIn, originalBooking.checkOut, oldCounts);
      const newPlan = expandPlan(newHotelId, updatedBooking.checkIn, updatedBooking.checkOut, newCounts);

      if (!inventoryPlansEqual(oldPlan, newPlan)) {
        for (const entry of oldPlan) {
          try {
            const rel = await availabilityService.releaseRooms({
              hotelId: entry.hotelId,
              roomTypeId: entry.roomTypeId,
              checkIn: entry.checkIn,
              checkOut: entry.checkOut,
              roomsCount: entry.roomsCount,
              bookingId: originalBooking._id,
              userId: req.user._id
            });
            if (!rel.success) {
              logger.warn('releaseRooms on booking patch', {
                message: rel.message,
                bookingId: req.params.id
              });
            }
          } catch (e) {
            logger.warn('releaseRooms on booking patch threw', {
              error: e.message,
              bookingId: req.params.id
            });
          }
        }

        for (const entry of newPlan) {
          const r = await availabilityService.reserveRooms({
            hotelId: entry.hotelId,
            roomTypeId: entry.roomTypeId,
            checkIn: entry.checkIn,
            checkOut: entry.checkOut,
            roomsCount: entry.roomsCount,
            bookingId: updatedBooking._id,
            source: 'direct',
            userId: req.user._id
          });
          if (!r.success) {
            const rollback = {};
            for (const k of ['checkIn', 'checkOut', 'rooms', 'primaryRoomTypeId', 'primaryRoomQuantity']) {
              if (Object.prototype.hasOwnProperty.call(updateData, k)) {
                rollback[k] = originalBooking[k];
              }
            }
            if (Object.keys(rollback).length) {
              await Booking.findOneAndUpdate({ _id: req.params.id, hotelId: originalBooking.hotelId?._id || originalBooking.hotelId }, { $set: rollback }, { new: true });
            }
            for (const entry2 of oldPlan) {
              try {
                await availabilityService.reserveRooms({
                  hotelId: entry2.hotelId,
                  roomTypeId: entry2.roomTypeId,
                  checkIn: entry2.checkIn,
                  checkOut: entry2.checkOut,
                  roomsCount: entry2.roomsCount,
                  bookingId: originalBooking._id,
                  source: 'direct',
                  userId: req.user._id
                });
              } catch (re) {
                logger.error('Failed to re-reserve inventory after patch rollback', {
                  bookingId: req.params.id,
                  error: re.message
                });
              }
            }
            throw new ApplicationError(
              r.message || 'Could not secure inventory for the updated booking; changes were reverted.',
              409
            );
          }
        }
      }
    }

    // Update corresponding invoice if payment status changed
    if (updateData.paymentStatus && ['admin', 'staff'].includes(req.user.role)) {
      try {
        await invoiceLifecycleSyncService.syncBookingPaymentStatus({
          bookingId: req.params.id,
          paymentStatus: updateData.paymentStatus,
          actorUserId: req.user._id
        });
      } catch (error) {
        invoiceLifecycleSyncService.logSyncFailure(
          { bookingId: req.params.id, flow: 'booking-update-payment-status' },
          error
        );
      }

      // Notify admin dashboard if payment status changed
      if (oldPaymentStatus !== updateData.paymentStatus) {
        await dashboardUpdateService.notifyPaymentUpdate(
          updatedBooking,
          oldPaymentStatus,
          updateData.paymentStatus,
          req.user
        );
        await dashboardUpdateService.triggerDashboardRefresh(updatedBooking.hotelId, 'payments');
      }
    }

    // Real-time WebSocket notifications for booking update
    try {
      // Notify hotel staff and admins of booking update
      await websocketService.broadcastToHotel(updatedBooking.hotelId, 'booking:updated', {
        booking: updatedBooking,
        updateData,
        updatedBy: req.user
      });

      // Notify the guest who owns the booking
      if (updatedBooking.userId) {
        await websocketService.sendToUser(updatedBooking.userId.toString(), 'booking:updated', {
          booking: updatedBooking,
          updateData
        });
      }

      // Notify staff roles specifically if payment status changed, scoped to hotel
      if (oldPaymentStatus !== updateData.paymentStatus) {
        const paymentHotelId = (updatedBooking.hotelId?._id || updatedBooking.hotelId)?.toString();
        if (paymentHotelId) {
          await websocketService.broadcastToHotelRole(paymentHotelId, 'staff', 'booking:payment_updated', {
            booking: updatedBooking,
            oldPaymentStatus,
            newPaymentStatus: updateData.paymentStatus
          });
          await websocketService.broadcastToHotelRole(paymentHotelId, 'admin', 'booking:payment_updated', {
            booking: updatedBooking,
            oldPaymentStatus,
            newPaymentStatus: updateData.paymentStatus
          });
          await websocketService.broadcastToHotelRole(paymentHotelId, 'frontdesk', 'booking:payment_updated', {
            booking: updatedBooking,
            oldPaymentStatus,
            newPaymentStatus: updateData.paymentStatus
          });
        }
      }
    } catch (wsError) {
      // Log WebSocket errors but don't fail the booking update
      logger.warn('Failed to send real-time booking update notification', { error: wsError.message });
    }

    if (updatedBooking.userId) {
      const guestId = updatedBooking.userId._id || updatedBooking.userId;
      try {
        if (updateData.paymentStatus != null && oldPaymentStatus !== updateData.paymentStatus) {
          const p = updateData.paymentStatus;
          const type = p === 'paid' ? 'payment_success' : p === 'failed' ? 'payment_failed' : 'system_alert';
          const title = p === 'paid' ? 'Payment received' : p === 'failed' ? 'Payment issue' : 'Payment updated';
          await createAndDeliverInApp({
            userId: guestId,
            hotelId: updatedBooking.hotelId?._id || updatedBooking.hotelId,
            type,
            title,
            message: `Booking ${updatedBooking.bookingNumber}: payment is now ${p}.`,
            priority: p === 'failed' ? 'high' : 'medium',
            metadata: { category: 'payment', bookingId: updatedBooking._id }
          });
        } else {
          const guestKeys = [
            'checkIn',
            'checkOut',
            'status',
            'rooms',
            'primaryRoomTypeId',
            'primaryRoomQuantity',
            'roomIds',
            'guestInfo',
            'nights'
          ];
          if (Object.keys(updateData).some((k) => guestKeys.includes(k))) {
            await createAndDeliverInApp({
              userId: guestId,
              hotelId: updatedBooking.hotelId?._id || updatedBooking.hotelId,
              type: 'system_alert',
              title: 'Booking updated',
              message: `Your booking ${updatedBooking.bookingNumber} has been updated.`,
              priority: 'low',
              metadata: { category: 'booking', bookingId: updatedBooking._id }
            });
          }
        }
      } catch (guestNotifErr) {
        logger.warn('Guest booking update notification failed', { error: guestNotifErr.message });
      }
    }

    await bookingAuditService.logBookingMutation({
      booking: updatedBooking,
      changeType: 'update',
      user: req.user,
      req,
      oldValues: bookingBeforeUpdate,
      newValues: bookingAuditService.buildSnapshot(updatedBooking),
      metadata: {
        priority: 'medium',
        tags: ['booking_update']
      }
    });

    res.json({
      status: 'success',
      data: {
        booking: updatedBooking
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/assign-rooms:
 *   patch:
 *     summary: Assign specific rooms to a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Rooms assigned successfully
 */
router.patch('/:id/assign-rooms',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'update'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { roomAssignments } = req.body;

    if (!roomAssignments || !Array.isArray(roomAssignments) || roomAssignments.length === 0) {
      throw new ApplicationError('Room assignments are required', 400);
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    const bookingBeforeAssign = bookingAuditService.buildSnapshot(booking);

    // Look up rooms by number and assign them
    const roomIds = [];
    for (const assignment of roomAssignments) {
      const room = await Room.findOne({
        roomNumber: assignment.roomNumber,
        hotelId: booking.hotelId
      });
      if (!room) {
        throw new ApplicationError(`Room ${assignment.roomNumber} not found`, 404);
      }
      roomIds.push({ roomId: room._id, roomType: assignment.roomType || room.type });
    }

    booking.rooms = roomIds;
    await booking.save();

    const updatedBooking = await Booking.findById(req.params.id)
      .populate([
        { path: 'rooms.roomId', select: 'roomNumber type baseRate currentRate' },
        { path: 'userId', select: 'name email phone' },
        { path: 'hotelId', select: 'name address contact' }
      ]);

    await bookingAuditService.logBookingMutation({
      booking: updatedBooking,
      changeType: 'update',
      user: req.user,
      req,
      oldValues: bookingBeforeAssign,
      newValues: bookingAuditService.buildSnapshot(updatedBooking),
      metadata: {
        priority: 'medium',
        tags: ['room_assignment']
      }
    });

    res.json({
      status: 'success',
      data: {
        booking: updatedBooking
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */
router.patch('/:id/cancel',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'cancel'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    bookingService.assertCanModifyBooking(booking, req.user, 'cancel');
    const bookingBeforeCancel = bookingAuditService.buildSnapshot(booking);

    if (!booking.canCancel()) {
      throw new ApplicationError('This booking cannot be cancelled', 400);
    }

    // Calculate refund based on cancellation policy
    const refundCalc = cancellationService.calculateRefund(booking);

    // Store refund details on booking
    booking.settlementTracking = booking.settlementTracking || {};
    booking.settlementTracking.refundAmount = refundCalc.refundAmount;
    booking.settlementTracking.penaltyAmount = refundCalc.penaltyAmount;

    // Process Stripe refund if applicable
    if (refundCalc.refundAmount > 0) {
      try {
        await cancellationService.processStripeRefund(booking, refundCalc.refundAmount);
      } catch (refundError) {
        logger.warn('Stripe refund failed, manual processing needed', {
          bookingId: booking._id, error: refundError.message
        });
      }
    }

    // Validate status transition using state machine
    const transition = validateTransition(booking.status, 'cancelled');
    if (!transition.valid) {
      throw new ApplicationError(transition.error, 400);
    }

    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by user';
    await booking.save();

    // Update room status after cancellation — mark occupied/reserved rooms as vacant
    if (booking.rooms && booking.rooms.length > 0) {
      try {
        const roomIds = booking.rooms.map(r => r.roomId?._id || r.roomId);
        await Room.updateMany(
          { _id: { $in: roomIds }, status: { $in: ['occupied', 'reserved'] } },
          { $set: { status: 'vacant' }, $unset: { currentBookingId: '' } }
        );
      } catch (roomErr) {
        logger.warn('Failed to update room status on cancellation', {
          bookingId: booking._id,
          error: roomErr.message
        });
      }
    }

    try {
      await invoiceLifecycleSyncService.syncBookingCancellationInvoices({
        bookingId: booking._id,
        refundAmount: refundCalc.refundAmount,
        reason: booking.cancellationReason
      });
    } catch (error) {
      invoiceLifecycleSyncService.logSyncFailure(
        { bookingId: booking._id, flow: 'booking-cancel' },
        error
      );
    }

    // Release RoomAvailability calendar counts (physical rooms and/or primary room type)
    const countsByType = await getRoomTypeCountsForBooking(booking);
    for (const [roomTypeId, roomsCount] of countsByType) {
      try {
        const result = await availabilityService.releaseRooms({
          hotelId: booking.hotelId,
          roomTypeId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          roomsCount,
          bookingId: booking._id,
          userId: req.user._id
        });
        if (!result.success) {
          logger.warn('availabilityService.releaseRooms failed on cancel', {
            bookingId: booking._id,
            roomTypeId,
            message: result.message
          });
        }
      } catch (err) {
        logger.warn('Failed to release room availability on cancel', {
          bookingId: booking._id,
          roomTypeId,
          error: err.message
        });
      }
    }

    // Notify admin dashboard of booking cancellation
    await dashboardUpdateService.notifyBookingCancellation(booking, req.user, req.body.reason);
    await dashboardUpdateService.triggerDashboardRefresh(booking.hotelId, 'bookings');

    if (booking.userId) {
      try {
        await createAndDeliverInApp({
          userId: booking.userId,
          hotelId: booking.hotelId,
          type: 'booking_cancellation',
          title: 'Booking cancelled',
          message: `Booking ${booking.bookingNumber} has been cancelled.`,
          priority: 'high',
          metadata: {
            category: 'booking',
            bookingId: booking._id,
            reason: booking.cancellationReason
          }
        });
      } catch (cErr) {
        logger.warn('Guest cancellation notification failed', { error: cErr.message });
      }
    }

    // Broadcast booking cancellation via WebSocket
    try {
      websocketService.broadcastToHotel(booking.hotelId?.toString() || booking.hotelId, 'booking:cancelled', {
        bookingId: booking._id,
        rooms: booking.rooms
      });
    } catch (e) { /* WebSocket is non-critical */ }

    // Notify the guest user directly
    if (booking.userId) {
      try {
        const guestUserId = booking.userId._id?.toString() || booking.userId.toString();
        websocketService.sendToUser(guestUserId, 'booking:cancelled', {
          bookingId: booking._id,
          status: 'cancelled'
        });
      } catch (e) { /* WebSocket is non-critical */ }
    }

    await bookingAuditService.logBookingMutation({
      booking,
      changeType: 'cancellation',
      user: req.user,
      req,
      oldValues: bookingBeforeCancel,
      newValues: bookingAuditService.buildSnapshot(booking),
      metadata: {
        priority: refundCalc.refundAmount > 0 ? 'high' : 'medium',
        tags: ['booking_cancellation'],
        refundAmount: refundCalc.refundAmount,
        penaltyAmount: refundCalc.penaltyAmount
      }
    });

    res.json({
      status: 'success',
      data: {
        booking,
        refund: refundCalc
      }
    });
  })
);

// Change room for a booking (for drag & drop in tape chart)
router.post('/change-room',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'changeRoom'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { bookingId, newRoomId, newRoomNumber, reason, changeDate } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.applyExistingRoomChange({
      booking,
      newRoomId: new mongoose.Types.ObjectId(newRoomId),
      newRoomNumber,
      actorName: req.user.name,
      reason
    });
    
    await booking.save();
    
    res.json({
      success: true,
      data: {
        booking,
        message: `Room changed to ${newRoomNumber} successfully`
      }
    });
  })
);

// Change room by finding booking via guest details or booking ID (for drag & drop in tape chart)
router.post('/change-room-by-guest',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'changeRoomByGuest'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    logger.debug('Change room by guest request', { bookingId: req.body.bookingId, newRoomId: req.body.newRoomId });

    const { bookingId, guestName, checkIn, checkOut, newRoomId, newRoomNumber, reason, newCheckInDate } = req.body;

    const booking = await bookingService.findBookingForRoomChange({
      bookingId,
      guestName,
      checkIn,
      checkOut
    });
    logger.debug('Found booking for room change', { bookingId: booking._id, status: booking.status });

    const room = await bookingService.validateRoomAssignment({
      booking,
      newRoomId,
      newRoomNumber
    });
    logger.debug('Room details for assignment', { roomNumber: room.roomNumber, roomType: room.roomType, isActive: room.isActive });

    bookingService.assertRoomChangeDateWithinBooking({
      booking,
      newCheckInDate
    });

    const roomRate = room.price || booking.totalAmount / booking.nights || 100;

    logger.debug('Applying room assignment update', { bookingId: booking._id, newRoomId });
    bookingService.applyRoomAssignment({
      booking,
      newRoomId,
      roomRate,
      newRoomNumber,
      actorName: req.user.name,
      reason
    });

    logger.debug('Saving booking with updated room', { bookingId: booking._id });
    await booking.save();

    logger.info('Room change saved successfully', { bookingId: booking._id, newRoomId });

    // Populate the updated booking with user and room details
    await booking.populate('userId', 'name email');
    await booking.populate('rooms.roomId', 'roomNumber roomType');

    res.json({
      success: true,
      data: {
        booking,
        message: `${guestName || 'Booking'}'s room assigned to ${newRoomNumber} successfully`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/modification-request:
 *   post:
 *     summary: Create a booking modification request
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               modificationType:
 *                 type: string
 *                 enum: [date_change, room_upgrade, guest_count, early_checkin, late_checkout, cancellation]
 *               requestedChanges:
 *                 type: object
 *               reason:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *     responses:
 *       200:
 *         description: Modification request created successfully
 */
router.post('/:id/modification-request',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'createModificationRequest'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { modificationType, requestedChanges, reason, priority = 'medium' } = req.body;
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId).populate('userId hotelId');
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertModificationAccess(booking, req.user, 'modify');
    const modificationRequest = bookingService.buildModificationRequest({
      booking,
      modificationType,
      requestedChanges,
      reason,
      user: req.user,
      ip: req.ip
    });

    // Add to booking's modifications array
    if (!booking.modifications) booking.modifications = [];
    booking.modifications.push(modificationRequest);

    await booking.save();

    // Notify staff/admin about new modification request
    try {
      if (websocketService) {
        const notificationData = {
          type: 'booking_modification_request',
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          guestName: booking.userId.name,
          modificationType,
          priority,
          requestedChanges,
          reason,
          requestedBy: req.user.name,
          hotelId: (booking.hotelId?._id || booking.hotelId)
        };

        // Notify hotel staff and admins, scoped to hotel
        const hotelIdStr = booking.hotelId?._id?.toString() || booking.hotelId?.toString();
        if (hotelIdStr) {
          await websocketService.broadcastToHotel(hotelIdStr, 'booking:modification_requested', notificationData);
          await websocketService.broadcastToHotelRole(hotelIdStr, 'admin', 'booking:modification_requested', notificationData);
          await websocketService.broadcastToHotelRole(hotelIdStr, 'staff', 'booking:modification_requested', notificationData);
          await websocketService.broadcastToHotelRole(hotelIdStr, 'frontdesk', 'booking:modification_requested', notificationData);
        }
      }
    } catch (wsError) {
      logger.warn('WebSocket notification failed', { error: wsError.message });
    }

    res.json({
      status: 'success',
      data: {
        modificationRequest,
        message: 'Modification request submitted successfully'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/modification-requests:
 *   get:
 *     summary: Get modification requests for a booking
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Modification requests retrieved successfully
 */
router.get('/:id/modification-requests',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId)
      .populate('userId', 'name email').lean();

    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertModificationAccess(booking, req.user, 'view modification requests for');

    res.json({
      status: 'success',
      data: {
        modifications: booking.modifications || []
      }
    });
  })
);

// Get booking audit trail (modification history + status history)
router.get('/:id/audit-trail',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id)
      .select('modificationHistory statusHistory modifications bookingNumber').lean();

    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Combine and sort all audit entries by date
    const auditTrail = [
      ...(booking.modificationHistory || []).map(m => ({
        type: 'field_change',
        timestamp: m.modifiedAt,
        ...m.toObject()
      })),
      ...(booking.statusHistory || []).map(s => ({
        type: 'status_change',
        timestamp: s.timestamp,
        ...s.toObject()
      })),
      ...(booking.modifications || []).map(m => ({
        type: 'ota_modification',
        timestamp: m.modificationDate,
        ...m.toObject()
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      status: 'success',
      data: { bookingNumber: booking.bookingNumber, auditTrail }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/modification-requests/{requestId}/review:
 *   patch:
 *     summary: Review (approve/reject) a booking modification request
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Modification Request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               reviewNotes:
 *                 type: string
 *               approvedChanges:
 *                 type: object
 *     responses:
 *       200:
 *         description: Modification request reviewed successfully
 */
router.patch('/:id/modification-requests/:requestId/review',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'reviewModificationRequest'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { action, reviewNotes, approvedChanges } = req.body;
    const { id: bookingId, requestId } = req.params;

    const booking = await Booking.findById(bookingId).populate('userId hotelId');
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    const modificationRequest = bookingService.findModificationRequestOrThrow(booking, requestId);
    bookingService.applyApprovedModificationChanges({
      booking,
      modificationRequest,
      action,
      reviewNotes,
      approvedChanges,
      reviewer: req.user
    });

    await booking.save();

    // Notify guest about decision
    try {
      if (websocketService) {
        const notificationData = {
          type: 'booking_modification_reviewed',
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          modificationType: modificationRequest.modificationType,
          status: modificationRequest.status,
          reviewNotes,
          reviewedBy: req.user.name,
          hotelId: (booking.hotelId?._id || booking.hotelId)
        };

        // Notify the guest
        await websocketService.notifyUser(booking.userId._id, 'booking:modification_reviewed', notificationData);
      }
    } catch (wsError) {
      logger.warn('WebSocket notification failed', { error: wsError.message });
    }

    res.json({
      status: 'success',
      data: {
        modificationRequest,
        message: `Modification request ${action}d successfully`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/check-in:
 *   patch:
 *     summary: Check-in a guest
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentDetails:
 *                 type: object
 *                 properties:
 *                   paymentMethods:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         method:
 *                           type: string
 *                           enum: [cash, card, upi, online_portal, corporate]
 *                         amount:
 *                           type: number
 *                         reference:
 *                           type: string
 *                         notes:
 *                           type: string
 *     responses:
 *       200:
 *         description: Guest checked in successfully
 */
router.patch('/:id/check-in',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'checkIn'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const session = await mongoose.startSession();
    let booking;
    let updatedBooking;
    let bookingBeforeCheckIn;
    const paymentDetails = req.body.paymentDetails;

    try {
      await session.withTransaction(async () => {
        booking = await Booking.findById(req.params.id).session(session);
        bookingService.assertCanCheckInBooking(booking, req.user);
        bookingBeforeCheckIn = bookingAuditService.buildSnapshot(booking);

        // Log current booking status for debugging
        logger.debug('Check-in attempt', { bookingId: booking._id, bookingNumber: booking.bookingNumber, currentStatus: booking.status });
        bookingService.assertBookingCanBeCheckedIn(booking);

        // Auto-confirm pending bookings before checking in
        if (booking.status === 'pending') {
          // Validate pending -> confirmed transition
          const confirmTransition = validateTransition(booking.status, 'confirmed');
          if (!confirmTransition.valid) {
            throw new ApplicationError(confirmTransition.error, 400);
          }
          booking.status = 'confirmed';
          booking.lastStatusChange = {
            from: 'pending',
            to: 'confirmed',
            timestamp: new Date(),
            reason: 'Auto-confirmed during check-in'
          };
          await booking.save({ session });
        }

        // Validate confirmed -> checked_in transition
        const checkInTransition = validateTransition(booking.status, 'checked_in');
        if (!checkInTransition.valid) {
          throw new ApplicationError(checkInTransition.error, 400);
        }

        // Mutate the already-fetched in-session Mongoose document directly to avoid
        // a redundant findByIdAndUpdate that would create a race-condition window and
        // also silently discard fields not in the schema (e.g. paymentHistory).
        booking.status = 'checked_in';
        booking.checkInTime = new Date();
        booking.lastStatusChange = {
          from: 'confirmed',
          to: 'checked_in',
          timestamp: new Date(),
          reason: 'Guest checked in'
        };

        // Append to statusHistory (array exists in schema)
        booking.statusHistory.push({
          status: 'checked_in',
          timestamp: new Date(),
          changedBy: {
            source: 'admin',
            userId: req.user._id.toString(),
            userName: req.user.name
          },
          reason: 'Guest checked in',
          automaticTransition: false,
          validatedTransition: true
        });

        // Store payment details in the schema-defined paymentDetails field
        if (paymentDetails && paymentDetails.paymentMethods && Array.isArray(paymentDetails.paymentMethods)) {
          const totalPaymentAmount = paymentDetails.paymentMethods.reduce((sum, pm) => sum + (pm.amount || 0), 0);
          booking.paymentDetails = {
            ...paymentDetails,
            totalPaid: totalPaymentAmount,
            collectedAt: new Date(),
            collectedBy: req.user._id
          };
          logger.info('Check-in payment processed', { bookingNumber: booking.bookingNumber, paymentAmount: totalPaymentAmount });
        }

        // Capture ID verification if provided
        if (req.body.idVerification) {
          booking.idVerification = {
            ...req.body.idVerification,
            verified: true,
            verifiedBy: req.user._id,
            verifiedAt: new Date()
          };
        }

        // Single atomic save within the session
        await booking.save({ session });

        // Re-fetch with populated refs so response has full data
        updatedBooking = await Booking.findById(booking._id).session(session).populate([
          { path: 'rooms.roomId', select: 'roomNumber type baseRate currentRate' },
          { path: 'userId', select: 'name email phone' },
          { path: 'hotelId', select: 'name address contact' }
        ]);

        // Batch: update all room statuses to 'occupied' with a single updateMany
        if (updatedBooking.rooms && updatedBooking.rooms.length > 0) {
          const roomIdsToUpdate = updatedBooking.rooms
            .filter(r => r.roomId)
            .map(r => r.roomId._id || r.roomId);
          if (roomIdsToUpdate.length > 0) {
            await Room.updateMany(
              { _id: { $in: roomIdsToUpdate } },
              { $set: { status: 'occupied', currentBookingId: updatedBooking._id } },
              { session }
            );
          }
        }
      });
    } finally {
      await session.endSession();
    }

    if (updatedBooking.paymentStatus) {
      try {
        await invoiceLifecycleSyncService.syncBookingPaymentStatus({
          bookingId: updatedBooking._id,
          paymentStatus: updatedBooking.paymentStatus,
          actorUserId: req.user._id
        });
      } catch (invoiceSyncError) {
        invoiceLifecycleSyncService.logSyncFailure(
          { bookingId: updatedBooking._id, flow: 'booking-check-in' },
          invoiceSyncError
        );
      }
    }

    logger.debug('Post-save payment status', { bookingNumber: updatedBooking.bookingNumber, paymentStatus: updatedBooking.paymentStatus });

    // Auto-generate a primary digital key for the guest upon check-in if one does not
    // already exist.  This is best-effort — a failure here must never block the check-in
    // response.  The key owner is set to booking.userId (the guest), not the staff member
    // performing check-in.
    let autoGeneratedKey = null;
    try {
      const { default: DigitalKey } = await import('../models/DigitalKey.js');
      const crypto = await import('crypto');
      const QRCode = await import('qrcode');

      const guestUserId = updatedBooking.userId?._id || updatedBooking.userId;
      const hotelId = updatedBooking.hotelId?._id || updatedBooking.hotelId;
      const firstRoom = updatedBooking.rooms?.[0];
      const roomId = firstRoom?.roomId?._id || firstRoom?.roomId;

      if (guestUserId && hotelId && roomId) {
        // Only generate if no active primary key already exists for this booking
        const existingKey = await DigitalKey.findOne({
          bookingId: updatedBooking._id,
          userId: guestUserId,
          type: 'primary',
          status: { $in: ['active'] }
        }).lean();

        if (!existingKey) {
          const QR_SECRET = process.env.DIGITAL_KEY_QR_SECRET || crypto.randomBytes(32).toString('hex');
          const keyCode = DigitalKey.generateKeyCode();
          const qrPayload = {
            k: keyCode,
            b: updatedBooking._id.toString().slice(-8),
            r: roomId.toString().slice(-8),
            h: hotelId.toString().slice(-8),
            t: 'p', // primary
            ts: Math.floor(Date.now() / 1000)
          };
          const qrPayloadStr = JSON.stringify(qrPayload);
          const signature = crypto.createHmac('sha256', QR_SECRET).update(qrPayloadStr).digest('hex').slice(0, 16);
          const qrData = JSON.stringify({ ...qrPayload, sig: signature });
          const qrCode = await QRCode.toDataURL(qrData);

          const digitalKey = new DigitalKey({
            userId: guestUserId,
            bookingId: updatedBooking._id,
            roomId,
            hotelId,
            keyCode,
            qrCode,
            type: 'primary',
            validFrom: new Date(),
            validUntil: updatedBooking.checkOut,
            maxUses: -1, // unlimited
            securitySettings: {
              requirePin: false,
              allowSharing: true,
              maxSharedUsers: 5,
              requireApproval: false
            },
            metadata: {
              generatedBy: req.user._id,
              notes: `auto_generated:check_in:staff_role=${req.user.role}`,
              deviceInfo: {
                userAgent: req.get('User-Agent'),
                ipAddress: req.ip
              }
            }
          });

          await digitalKey.save();
          autoGeneratedKey = { keyCode: digitalKey.keyCode, keyId: digitalKey._id };

          // Notify the guest via WebSocket
          const guestIdStr = guestUserId.toString();
          websocketService.sendToUser(guestIdStr, 'digital-key:created', {
            bookingId: updatedBooking._id,
            keyCode: digitalKey.keyCode,
            roomNumber: firstRoom?.roomId?.roomNumber || firstRoom?.roomId?.number
          });

          // Deliver in-app notification to guest
          try {
            const { createAndDeliverInApp } = await import('../services/inAppNotificationDeliveryService.js');
            await createAndDeliverInApp({
              userId: guestUserId,
              hotelId,
              type: 'system_alert',
              title: 'Your digital room key is ready',
              message: `Welcome! Your digital key is now active. Valid until ${new Date(updatedBooking.checkOut).toLocaleDateString()}.`,
              priority: 'high',
              metadata: { category: 'system', tags: ['digital_key', 'check_in', 'auto_generated'] }
            });
          } catch (notifErr) {
            logger.warn('Check-in digital key in-app notification skipped', { error: notifErr.message });
          }

          logger.info('Auto-generated digital key on check-in', {
            bookingNumber: updatedBooking.bookingNumber,
            keyId: digitalKey._id,
            guestUserId
          });
        }
      }
    } catch (keyGenErr) {
      // Key generation failure must never prevent a successful check-in
      logger.warn('Auto digital key generation on check-in failed (non-fatal)', {
        bookingId: updatedBooking._id,
        error: keyGenErr.message
      });
    }

    // Calculate balance information for frontend
    const totalPaid = updatedBooking.paymentDetails?.totalPaid || 0;
    const balanceInfo = {
      totalAmount: updatedBooking.totalAmount || 0,
      totalPaid: totalPaid,
      balanceRemaining: (updatedBooking.totalAmount || 0) - totalPaid,
      paymentCollected: paymentDetails && paymentDetails.paymentMethods ? true : false
    };

    // Broadcast room status change via WebSocket after check-in
    try {
      const hotelId = booking.hotelId?.toString() || booking.hotelId;
      websocketService.broadcastToHotel(hotelId, 'room:status_changed', {
        roomId: booking.rooms?.[0]?.roomId,
        status: 'occupied',
        bookingId: booking._id,
        guestName: booking.guestDetails?.name || 'Guest'
      });
      // Also emit booking:updated so booking dashboards refresh
      websocketService.broadcastToHotel(hotelId, 'booking:updated', {
        bookingId: booking._id,
        status: 'checked_in',
        action: 'checked_in'
      });
      // Notify the guest
      const guestId = booking.userId?._id?.toString() || booking.userId?.toString();
      if (guestId) {
        websocketService.sendToUser(guestId, 'booking:updated', {
          bookingId: booking._id,
          status: 'checked_in'
        });
      }
    } catch (e) { /* WebSocket is non-critical */ }

    await bookingAuditService.logBookingMutation({
      booking: updatedBooking,
      changeType: 'update',
      user: req.user,
      req,
      oldValues: bookingBeforeCheckIn,
      newValues: bookingAuditService.buildSnapshot(updatedBooking),
      metadata: {
        priority: paymentDetails && paymentDetails.paymentMethods ? 'high' : 'medium',
        tags: ['booking_check_in'],
        paymentCollected: !!(paymentDetails && paymentDetails.paymentMethods)
      }
    });

    res.json({
      status: 'success',
      data: {
        booking: updatedBooking,
        balanceInfo,
        // Include auto-generated digital key metadata so the front desk UI can
        // display the key code / QR immediately without a separate API call.
        digitalKey: autoGeneratedKey,
        message: 'Guest checked in successfully'
      }
    });

    // Emit check-in webhook to OTA (fire-and-forget, never blocks response)
    try {
      const hotel = updatedBooking.hotelId;
      const guest = updatedBooking.userId;
      const firstRoom = updatedBooking.rooms?.[0]?.roomId;

      await pmsOtaIntegration.emitCheckIn(
        { ...hotel, _id: hotel._id || hotel },
        updatedBooking,
        guest,
        firstRoom
      );
    } catch (webhookErr) {
      logger.warn('[PMS→OTA] Check-in webhook emission failed (non-blocking):', webhookErr.message);
    }
  })
);

/**
 * @swagger
 * /bookings/{id}/check-out:
 *   patch:
 *     summary: Check-out a guest
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Guest checked out successfully
 */
router.patch('/:id/check-out',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'checkOut'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const session = await mongoose.startSession();
    let updatedBooking;
    let bookingBeforeCheckout;
    let booking;
    const scopedHotelId = req.tenantId || req.user?.hotelId;
    let bypassBalanceCheck = false;
    let bypassReason;
    let outstandingBalance = 0;

    try {
      await session.withTransaction(async () => {
        booking = await Booking.findById(req.params.id).session(session);
        bookingService.assertResourceInScopedHotel(booking, scopedHotelId, 'Booking');
        bookingService.assertBookingCanBeCheckedOut(booking);
        bookingBeforeCheckout = bookingAuditService.buildSnapshot(booking);

        // ensurePropertyAccess middleware already verified access
        // No need for additional hotelId check - supports multi-property

        // CRITICAL: Validate payment balance BEFORE allowing checkout
        // Guests cannot checkout with outstanding balance unless explicitly bypassed
        ({ bypassBalanceCheck, bypassReason } = req.body);
        ({ outstandingBalance } = bookingService.getCheckoutBalanceInfo(booking));

        logger.debug('Checkout payment validation', { bookingNumber: booking.bookingNumber, outstandingBalance, bypassBalanceCheck });

        if (outstandingBalance > 0 && !bypassBalanceCheck) {
          throw new ApplicationError(
            `Cannot check out guest with outstanding balance of ₹${outstandingBalance.toLocaleString()}. Please collect payment first or use bypass checkout.`,
            400,
            'OUTSTANDING_BALANCE'
          );
        }

        // Update booking with check-out information
        const updateData = {
          status: 'checked_out',
          checkOutTime: new Date(), // Auto-update check-out time
          lastStatusChange: {
            from: booking.status,
            to: 'checked_out',
            timestamp: new Date(),
            reason: 'Guest checked out'
          }
        };

        if (bypassBalanceCheck && outstandingBalance > 0) {
          updateData.$push = {
            notes: {
              text: `BYPASS CHECKOUT - Outstanding balance: Rs ${outstandingBalance}. Reason: ${bypassReason || 'Not specified'}`,
              createdBy: req.user._id,
              createdAt: new Date(),
              type: 'bypass_checkout'
            }
          };
        }

        updatedBooking = await Booking.findOneAndUpdate(
          {
            _id: req.params.id,
            ...(scopedHotelId ? { hotelId: scopedHotelId } : {})
          },
          updateData,
          { new: true, runValidators: true, session }
        ).populate([
          { path: 'rooms.roomId', select: 'roomNumber type baseRate currentRate' },
          { path: 'userId', select: 'name email phone otaUserId' },
          { path: 'hotelId', select: 'name address contact otaConnections' }
        ]);

        // Add to status history
        updatedBooking.statusHistory.push({
          status: 'checked_out',
          timestamp: new Date(),
          changedBy: {
            source: 'admin',
            userId: req.user._id.toString(),
            userName: req.user.name
          },
          reason: 'Guest checked out',
          automaticTransition: false,
          validatedTransition: true
        });

        await updatedBooking.save({ session });

        // Batch: update all room statuses to 'dirty' with a single updateMany
        if (updatedBooking.rooms && updatedBooking.rooms.length > 0) {
          const roomIdsForDirty = updatedBooking.rooms
            .filter(r => r.roomId)
            .map(r => r.roomId._id || r.roomId);
          if (roomIdsForDirty.length > 0) {
            await Room.updateMany(
              {
                _id: { $in: roomIdsForDirty },
                ...(scopedHotelId ? { hotelId: scopedHotelId } : {})
              },
              {
                $set: { status: 'dirty', lastCheckout: new Date() },
                $unset: { currentBookingId: '' }
              },
              { session }
            );
          }
          logger.debug('Room status updated to dirty at checkout', {
            bookingNumber: updatedBooking.bookingNumber,
            roomCount: updatedBooking.rooms.length
          });

          // AUTO-CREATE housekeeping tasks for dirty rooms.
          // Guard against duplicates: skip rooms that already have an active
          // checkout_clean task (e.g. created by checkoutInventory completion).
          const Housekeeping = mongoose.model('Housekeeping');
          const existingTaskRoomIds = await Housekeeping.distinct('roomId', {
            hotelId: updatedBooking.hotelId._id || updatedBooking.hotelId,
            roomId: { $in: roomIdsForDirty },
            taskType: 'checkout_clean',
            status: { $in: ['pending', 'assigned', 'in_progress'] }
          }, { session });
          const existingSet = new Set(existingTaskRoomIds.map(id => id.toString()));
          const housekeepingTasks = roomIdsForDirty
            .filter(roomId => !existingSet.has(roomId.toString()))
            .map(roomId => ({
              hotelId: updatedBooking.hotelId._id || updatedBooking.hotelId,
              roomId: roomId,
              taskType: 'checkout_clean',
              type: 'checkout_clean',
              title: `Checkout Cleaning - Room ${updatedBooking.rooms.find(r => (r.roomId._id || r.roomId).toString() === roomId.toString())?.roomId?.roomNumber || 'Unknown'}`,
              description: `Post-checkout cleaning for booking ${updatedBooking.bookingNumber}. Guest: ${updatedBooking.userId?.name || 'Unknown'}`,
              priority: 'high',
              status: 'pending',
              estimatedDuration: 30,
              notes: `Auto-created on checkout of booking ${updatedBooking.bookingNumber}`
            }));

          if (housekeepingTasks.length > 0) {
            await Housekeeping.insertMany(housekeepingTasks, { session });
            logger.info('Auto-created housekeeping tasks at checkout', {
              bookingNumber: updatedBooking.bookingNumber,
              taskCount: housekeepingTasks.length
            });

            // Try to auto-assign to available housekeeping staff (non-blocking).
            // Use atomic updateOne with assignedToUserId:null filter to prevent
            // double-assignment if two checkouts race simultaneously.
            try {
              const User = mongoose.model('User');
              const availableStaff = await User.find({
                hotelId: updatedBooking.hotelId._id || updatedBooking.hotelId,
                role: { $in: ['housekeeping', 'staff'] },
                isActive: true
              }).select('_id name').lean().limit(10);

              if (availableStaff.length > 0) {
                let staffIndex = 0;
                for (const hkTask of housekeepingTasks) {
                  const staff = availableStaff[staffIndex % availableStaff.length];
                  // Atomic: only assign if still unassigned (prevents double-assignment race)
                  const result = await Housekeeping.updateOne(
                    {
                      hotelId: updatedBooking.hotelId._id || updatedBooking.hotelId,
                      roomId: hkTask.roomId,
                      taskType: 'checkout_clean',
                      status: 'pending',
                      $or: [{ assignedToUserId: null }, { assignedToUserId: { $exists: false } }]
                    },
                    { $set: { assignedToUserId: staff._id, assignedTo: staff._id, status: 'assigned' } }
                  );
                  if (result.modifiedCount > 0) staffIndex++;
                }
                logger.info('Auto-assigned housekeeping staff', { staffCount: availableStaff.length });
              }
            } catch (assignError) {
              logger.warn('Failed to auto-assign housekeeping staff', { error: assignError.message });
            }
          }
        }
      });
    } finally {
      await session.endSession();
    }

    // Auto-generate final invoice at checkout
    try {
      const invoiceResult = await invoiceLifecycleSyncService.ensureCheckoutInvoice({
        booking: updatedBooking
      });
      if (invoiceResult.created) {
        logger.info('Invoice auto-generated at checkout', { bookingId: booking._id });
      }
    } catch (invoiceError) {
      logger.warn('Failed to auto-generate invoice at checkout', {
        bookingId: booking._id, error: invoiceError.message
      });
    }

    // AUTO-CREATE SETTLEMENT AT CHECKOUT
    // This ensures balance tracking starts immediately
    const settlement = updatedBooking.calculateSettlement();

    // Initialize settlement tracking if balance due or refund needed
    if (settlement.outstandingBalance > 0 || settlement.refundAmount > 0) {
      updatedBooking.settlementTracking = {
        status: settlement.outstandingBalance > 0 ? 'pending' :
                settlement.refundAmount > 0 ? 'refund_pending' : 'completed',
        finalAmount: settlement.finalAmount,
        outstandingBalance: settlement.outstandingBalance,
        refundAmount: settlement.refundAmount,
        adjustments: settlement.adjustments || [],
        settlementHistory: [{
          action: 'settlement_created',
          amount: settlement.finalAmount,
          processedBy: { userId: req.user._id, userName: req.user.name || '', userRole: req.user.role || '' },
          timestamp: new Date(),
          description: 'Settlement automatically created at checkout',
          reference: `SETTLEMENT-${updatedBooking.bookingNumber}-${Date.now()}`
        }]
      };

      await updatedBooking.save();

      logger.info('Settlement auto-created at checkout', {
        bookingNumber: updatedBooking.bookingNumber,
        status: updatedBooking.settlementTracking.status
      });
    } else {
      // No balance due, mark as completed
      updatedBooking.settlementTracking = {
        status: 'completed',
        finalAmount: settlement.finalAmount,
        outstandingBalance: 0,
        refundAmount: 0,
        adjustments: settlement.adjustments || [],
        settlementHistory: [{
          action: 'settlement_completed',
          amount: settlement.finalAmount,
          processedBy: { userId: req.user._id, userName: req.user.name || '', userRole: req.user.role || '' },
          timestamp: new Date(),
          description: 'Settlement completed - fully paid at checkout',
          reference: `SETTLEMENT-${updatedBooking.bookingNumber}-${Date.now()}`
        }]
      };

      await updatedBooking.save();

      logger.info('Settlement auto-completed at checkout', { bookingNumber: updatedBooking.bookingNumber });
    }

    // Loyalty: award points for completed stay (idempotent per booking; never fails checkout)
    try {
      const loyaltyResult = await awardStayCompletionPoints(updatedBooking);
      if (loyaltyResult.awarded) {
        logger.info('Checkout loyalty award applied', {
          bookingNumber: updatedBooking.bookingNumber,
          points: loyaltyResult.points
        });
      }
    } catch (loyaltyErr) {
      logger.warn('Checkout loyalty award skipped', { error: loyaltyErr.message });
    }

    // REZ OTA: award hotel brand coins on checkout (fire-and-forget, never blocks checkout)
    try {
      const hotel = updatedBooking.hotelId;
      const otaHotelId = hotel?.otaConnections?.rezOta?.hotelId;
      const otaUserId = updatedBooking.userId?.otaUserId;

      if (otaHotelId && otaUserId) {
        const bookingValuePaise = Math.round((updatedBooking.totalAmount || 0) * 100);
        awardBrandCoinsOnCheckout({
          otaUserId,
          otaHotelId,
          bookingId: updatedBooking._id?.toString(),
          bookingValuePaise,
          earnRuleHint: hotel?.otaConnections?.rezOta?.earnRuleHint || null,
        }).catch(err => logger.warn('[RezOta] Brand coin award failed at checkout:', err.message));
      }
    } catch (brandCoinErr) {
      logger.warn('[RezOta] Brand coin award skipped', { error: brandCoinErr.message });
    }

    // PMS→OTA: Emit check-out webhook (fires brand coin award via webhook, in addition to direct API call above)
    // This provides bidirectional confirmation and enables OTA to track checkout status
    try {
      const hotel = updatedBooking.hotelId;
      const guest = updatedBooking.userId;
      const firstRoom = updatedBooking.rooms?.[0]?.roomId;
      const bookingValuePaise = Math.round((updatedBooking.totalAmount || 0) * 100);

      await pmsOtaIntegration.emitCheckOut(
        { ...hotel, _id: hotel._id || hotel },
        updatedBooking,
        guest,
        firstRoom,
        bookingValuePaise
      );
    } catch (webhookErr) {
      logger.warn('[PMS→OTA] Check-out webhook emission failed (non-blocking):', webhookErr.message);
    }

    // Auto-revoke all digital keys for this booking.
    // Use $push on accessLogs so the audit trail is kept, and persist revokedAt/revokedReason
    // which are now proper schema fields (previously these were silently dropped by Mongoose strict mode).
    try {
      const { default: DigitalKey } = await import('../models/DigitalKey.js');
      const revokedAt = new Date();
      const revokedReason = 'Automatic revocation on checkout';
      const revokedKeys = await DigitalKey.updateMany(
        { bookingId: booking._id, status: 'active' },
        {
          $set: {
            status: 'revoked',
            revokedAt,
            revokedReason
          },
          $push: {
            accessLogs: {
              action: 'revoked',
              userId: req.user?._id || null,
              timestamp: revokedAt,
              deviceInfo: {},
              metadata: { reason: revokedReason, triggeredBy: 'checkout' }
            }
          }
        }
      );
      if (revokedKeys.modifiedCount > 0) {
        logger.info(`Revoked ${revokedKeys.modifiedCount} digital keys for booking ${booking._id} on checkout`);
        // Notify guest that keys are revoked
        const guestUserId = booking.userId?._id?.toString() || booking.userId?.toString();
        if (guestUserId) {
          websocketService.sendToUser(guestUserId, 'digital-key:updated', {
            bookingId: booking._id,
            action: 'bulk_revoked',
            reason: 'checkout'
          });
        }
      }
    } catch (keyErr) {
      logger.warn('Failed to revoke digital keys on checkout:', keyErr.message);
    }

    // Broadcast room status change via WebSocket after checkout
    try {
      const hotelId = booking.hotelId?.toString() || booking.hotelId;
      websocketService.broadcastToHotel(hotelId, 'room:status_changed', {
        roomId: booking.rooms?.[0]?.roomId,
        status: 'dirty',
        bookingId: booking._id,
        event: 'checkout'
      });
      // Also emit booking:updated so booking dashboards refresh
      websocketService.broadcastToHotel(hotelId, 'booking:updated', {
        bookingId: booking._id,
        status: 'checked_out',
        action: 'checked_out'
      });
      // Notify the guest
      const guestId = booking.userId?._id?.toString() || booking.userId?.toString();
      if (guestId) {
        websocketService.sendToUser(guestId, 'booking:updated', {
          bookingId: booking._id,
          status: 'checked_out'
        });
      }
    } catch (e) { /* WebSocket is non-critical */ }

    await bookingAuditService.logBookingMutation({
      booking: updatedBooking,
      changeType: 'update',
      user: req.user,
      req,
      oldValues: bookingBeforeCheckout,
      newValues: bookingAuditService.buildSnapshot(updatedBooking),
      metadata: {
        priority: outstandingBalance > 0 ? 'high' : 'medium',
        tags: ['booking_checkout'],
        bypassBalanceCheck: !!bypassBalanceCheck,
        outstandingBalance
      }
    });

    // Trigger billing dashboard refresh
    try {
      dashboardUpdateService.triggerDashboardRefresh(
        (booking.hotelId?._id || booking.hotelId)?.toString(),
        'payments'
      );
    } catch (err) {
      logger.warn('Failed to trigger billing dashboard refresh on checkout:', err.message);
    }

    res.json({
      status: 'success',
      data: {
        booking: updatedBooking,
        settlement: settlement,
        message: 'Guest checked out successfully',
        settlementStatus: updatedBooking.settlementTracking?.status || 'completed'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons:
 *   post:
 *     summary: Add extra person to booking with pending charge (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Person's name
 *               type:
 *                 type: string
 *                 enum: [adult, child]
 *                 description: Person type
 *               age:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 120
 *                 description: Age (required for children)
 *     responses:
 *       200:
 *         description: Extra person added with pending charge. Charge must be approved before payment.
 *       400:
 *         description: Invalid input data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/extra-persons',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'addExtraPerson'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, type, age } = req.body;  // REMOVED: autoCalculateCharges

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertBookingInUserHotel(booking, req.user);

    // User context for RBAC
    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    // Add extra person
    const extraPerson = await booking.addExtraPerson({ name, type, age }, userContext);

    // Calculate suggested charge (but DON'T auto-apply)
    const chargeResult = await booking.calculateExtraPersonCharges();

    // Find the charge for this person and set status to 'pending'
    const personChargeIndex = booking.extraPersonCharges.findIndex(
      c => c.personId === extraPerson.personId
    );

    if (personChargeIndex !== -1) {
      // Set status to pending (not applied yet)
      booking.extraPersonCharges[personChargeIndex].status = 'pending';

      // Store calculated amount
      if (!booking.extraPersonCharges[personChargeIndex].calculatedAmount) {
        booking.extraPersonCharges[personChargeIndex].calculatedAmount =
          booking.extraPersonCharges[personChargeIndex].totalCharge;
      }
    }

    // Save booking
    await booking.save();

    // Populate booking details for response
    await booking.populate('userId', 'name email');
    await booking.populate('rooms.roomId', 'roomNumber roomType');

    // Get the suggested charge for this person
    const suggestedCharge = booking.extraPersonCharges.find(
      c => c.personId === extraPerson.personId
    );

    res.json({
      status: 'success',
      data: {
        extraPerson,
        suggestedCharge,  // Return suggested charge info
        booking,
        message: `${type} ${name} added to booking. Suggested charge: ₹${suggestedCharge?.totalCharge || 0}. Status: Pending approval.`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/{personId}:
 *   delete:
 *     summary: Remove extra person from booking (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: personId
 *         required: true
 *         schema:
 *           type: string
 *         description: Extra person ID
 *     responses:
 *       200:
 *         description: Extra person removed successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking or person not found
 */
router.delete('/:id/extra-persons/:personId',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'removeExtraPerson'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { id, personId } = req.params;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertBookingInUserHotel(booking, req.user);

    // User context for RBAC
    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    // Remove extra person
    const removedPerson = await booking.removeExtraPerson(personId, userContext);

    // Recalculate charges
    await booking.calculateExtraPersonCharges();

    // Save booking
    await booking.save();

    res.json({
      status: 'success',
      data: {
        removedPerson,
        message: `${removedPerson.type} ${removedPerson.name} removed from booking successfully`
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/{personId}/update-charge:
 *   put:
 *     summary: Update extra person charge amount (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: personId
 *         required: true
 *         schema:
 *           type: string
 *         description: Extra person ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adjustedAmount
 *               - adjustmentReason
 *             properties:
 *               adjustedAmount:
 *                 type: number
 *                 description: New adjusted price
 *               adjustmentReason:
 *                 type: string
 *                 description: Reason for price adjustment
 *     responses:
 *       200:
 *         description: Charge updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 *       404:
 *         description: Booking or charge not found
 */
router.put('/:id/extra-persons/:personId/update-charge',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'updateExtraPersonCharge'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { id, personId } = req.params;
    const { adjustedAmount, adjustmentReason } = req.body;

    // Validation
    if (!adjustedAmount || adjustedAmount < 0) {
      throw new ApplicationError('Valid adjusted amount is required', 400);
    }
    if (!adjustmentReason || !adjustmentReason.trim()) {
      throw new ApplicationError('Adjustment reason is required', 400);
    }

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertBookingInUserHotel(booking, req.user);

    // Find the charge
    const chargeIndex = booking.extraPersonCharges.findIndex(
      c => c.personId === personId
    );

    if (chargeIndex === -1) {
      throw new ApplicationError('Extra person charge not found', 404);
    }

    const charge = booking.extraPersonCharges[chargeIndex];

    // Only allow updating pending charges
    if (charge.status !== 'pending') {
      throw new ApplicationError('Can only update pending charges', 400);
    }

    // Update the charge
    booking.extraPersonCharges[chargeIndex].adjustedAmount = adjustedAmount;
    booking.extraPersonCharges[chargeIndex].adjustmentReason = adjustmentReason.trim();
    booking.extraPersonCharges[chargeIndex].totalCharge = adjustedAmount;  // Update total to match adjusted amount
    booking.extraPersonCharges[chargeIndex].adjustedBy = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      adjustedAt: new Date()
    };

    await booking.save();

    // Populate for response
    await booking.populate('userId', 'name email');
    await booking.populate('rooms.roomId', 'roomNumber');

    res.json({
      status: 'success',
      data: {
        booking,
        updatedCharge: booking.extraPersonCharges[chargeIndex],
        message: 'Extra person charge updated successfully'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/calculate-charges:
 *   post:
 *     summary: Calculate charges for extra persons (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Extra person charges calculated successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/extra-persons/calculate-charges',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'calculateExtraPersonCharges'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { id } = req.params;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertBookingInUserHotel(booking, req.user);

    // Calculate charges
    const chargeResult = await booking.calculateExtraPersonCharges();

    // Save booking
    await booking.save();

    // Populate the updated booking to get complete data
    await booking.populate([
      { path: 'userId', select: 'name email phone' },
      { path: 'rooms.roomId', select: 'roomNumber type baseRate' }
    ]);

    res.json({
      status: 'success',
      data: {
        chargeBreakdown: chargeResult.chargeBreakdown,
        totalExtraCharge: chargeResult.totalExtraCharge,
        currency: chargeResult.currency,
        updatedTotalAmount: booking.calculateTotalAmount(),
        booking: booking, // Include the full updated booking
        extraPersonCharges: booking.extraPersonCharges, // Include updated charges with payment status
        message: 'Extra person charges calculated successfully'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/{personId}/approve:
 *   post:
 *     summary: Approve and apply extra person charge (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: personId
 *         required: true
 *         schema:
 *           type: string
 *         description: Extra person ID
 *     responses:
 *       200:
 *         description: Charge approved and applied successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Access denied
 *       404:
 *         description: Booking or charge not found
 */
router.post('/:id/extra-persons/:personId/approve',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'approveExtraPersonCharge'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { id, personId } = req.params;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertBookingInUserHotel(booking, req.user);

    // Find the charge
    const chargeIndex = booking.extraPersonCharges.findIndex(
      c => c.personId === personId
    );

    if (chargeIndex === -1) {
      throw new ApplicationError('Extra person charge not found', 404);
    }

    const charge = booking.extraPersonCharges[chargeIndex];

    // Only allow approving pending charges
    if (charge.status !== 'pending') {
      throw new ApplicationError('Charge is already applied or paid', 400);
    }

    // Approve and apply the charge
    booking.extraPersonCharges[chargeIndex].status = 'applied';
    booking.extraPersonCharges[chargeIndex].approvedBy = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };
    booking.extraPersonCharges[chargeIndex].approvedAt = new Date();
    booking.extraPersonCharges[chargeIndex].appliedAt = new Date();
    booking.extraPersonCharges[chargeIndex].appliedBy = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    await booking.save();

    // Populate for response
    await booking.populate('userId', 'name email');
    await booking.populate('rooms.roomId', 'roomNumber');

    res.json({
      status: 'success',
      data: {
        booking,
        approvedCharge: booking.extraPersonCharges[chargeIndex],
        message: 'Extra person charge approved and applied successfully. Guest can now pay.'
      }
    });
  })
);

/**
 * @swagger
 * /bookings/{id}/extra-persons/payment:
 *   post:
 *     summary: Process multi-payment for extra person charges (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     method:
 *                       type: string
 *                       enum: [cash, upi, stripe]
 *                     amount:
 *                       type: number
 *                     reference:
 *                       type: string
 *                     notes:
 *                       type: string
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
 *               totalAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/extra-persons/payment',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'payExtraPersonCharges'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { paymentMethods, extraPersonCharges, totalAmount } = req.body;

    // Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    bookingService.assertBookingInUserHotel(booking, req.user);
    const bookingBeforeExtraPersonPayment = bookingAuditService.buildSnapshot(booking);

    // Validate payment methods
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
      throw new ApplicationError('Payment methods are required', 400);
    }

    // Calculate total paid amount
    const totalPaid = paymentMethods.reduce((sum, payment) => sum + (payment.amount || 0), 0);

    if (totalPaid <= 0) {
      throw new ApplicationError('Total payment amount must be greater than 0', 400);
    }

    try {
      // Process each payment method
      const processedPayments = paymentMethods.map(payment => ({
        method: payment.method,
        amount: payment.amount,
        reference: payment.reference || `${payment.method}-${Date.now()}`,
        processedBy: req.user._id,
        processedAt: new Date(),
        notes: payment.notes || `${payment.method.toUpperCase()} payment for extra person charges`
      }));

      // Update booking with payment information in paymentDetails
      if (!booking.paymentDetails) {
        booking.paymentDetails = {
          paymentMethods: [],
          totalPaid: 0,
          remainingAmount: booking.totalAmount || 0,
          collectedAt: new Date(),
          collectedBy: req.user._id
        };
      }

      if (!booking.paymentDetails.paymentMethods) {
        booking.paymentDetails.paymentMethods = [];
      }

      // Add the new payment methods to paymentDetails
      booking.paymentDetails.paymentMethods.push(...processedPayments);

      // Pre-save hook will calculate totalPaid from paymentMethods
      // But we need to update paymentStatus here based on total
      const bookingTotalAmount = booking.calculateTotalAmount();
      const totalPaidAfterThisPayment = (booking.paymentDetails.totalPaid || 0) + totalPaid;

      if (totalPaidAfterThisPayment >= bookingTotalAmount) {
        booking.paymentStatus = 'paid';
      } else if (totalPaidAfterThisPayment > 0) {
        booking.paymentStatus = 'partially_paid';
      }

      // Mark extra person charges as paid
      if (booking.extraPersonCharges && booking.extraPersonCharges.length > 0) {
        booking.extraPersonCharges.forEach(charge => {
          // Find corresponding charge in the request
          const requestCharge = extraPersonCharges.find(reqCharge =>
            reqCharge.personId === charge.personId
          );

          if (requestCharge) {
            charge.paidAmount = (charge.paidAmount || 0) + requestCharge.amount;
            charge.isPaid = charge.paidAmount >= charge.totalCharge;
            if (charge.isPaid && !charge.paidAt) {
              charge.paidAt = new Date();
            }
          }
        });
      }

      // Add payment record to history
      if (!booking.paymentHistory) {
        booking.paymentHistory = [];
      }

      booking.paymentHistory.push({
        type: 'extra_person_charges',
        amount: totalPaid,
        paymentMethods: processedPayments,
        processedBy: req.user._id,
        processedAt: new Date(),
        description: 'Payment for extra person charges',
        extraPersonCharges: extraPersonCharges
      });

      // Save booking
      await booking.save();

      try {
        await invoiceLifecycleSyncService.syncBookingPaymentStatus({
          bookingId: booking._id,
          paymentStatus: booking.paymentStatus,
          actorUserId: req.user._id
        });
      } catch (invoiceSyncError) {
        invoiceLifecycleSyncService.logSyncFailure(
          { bookingId: booking._id, flow: 'extra-person-charge-payment' },
          invoiceSyncError
        );
      }

      await bookingAuditService.logBookingMutation({
        booking,
        changeType: 'update',
        user: req.user,
        req,
        oldValues: bookingBeforeExtraPersonPayment,
        newValues: bookingAuditService.buildSnapshot(booking),
        metadata: {
          priority: 'high',
          tags: ['extra_person_charge_payment'],
          totalPaid,
          chargeCount: Array.isArray(extraPersonCharges) ? extraPersonCharges.length : 0
        }
      });

      // Populate booking details for response
      await booking.populate('userId', 'name email');
      await booking.populate('rooms.roomId', 'roomNumber roomType');

      res.json({
        status: 'success',
        data: {
          booking,
          paymentSummary: {
            totalPaid,
            paymentMethods: processedPayments,
            updatedBookingTotal: bookingTotalAmount,
            updatedTotalPaid: booking.paymentDetails?.totalPaid || 0,
            remainingAmount: booking.paymentDetails?.remainingAmount || 0,
            paymentStatus: booking.paymentStatus
          },
          message: 'Extra person charges payment processed successfully'
        }
      });

    } catch (error) {
      logger.error('Error processing extra person charges payment', { error: error.message });
      throw new ApplicationError('Failed to process payment', 500);
    }
  })
);

/**
 * @swagger
 * /bookings/{id}/settlement:
 *   get:
 *     summary: Get booking settlement details (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Settlement details retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.get('/:id/settlement',
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'getSettlement'),
  ensurePropertyAccess,
  getSettlement
);

/**
 * @swagger
 * /bookings/{id}/settlement/adjustment:
 *   post:
 *     summary: Add settlement adjustment (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [extra_person_charge, damage_charge, minibar_charge, service_charge, discount, refund, penalty, other]
 *                 description: Type of adjustment
 *               amount:
 *                 type: number
 *                 description: Adjustment amount (positive for charges, negative for credits)
 *               description:
 *                 type: string
 *                 description: Detailed description of the adjustment
 *     responses:
 *       200:
 *         description: Settlement adjustment added successfully
 *       400:
 *         description: Invalid adjustment data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/settlement/adjustment',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'addSettlementAdjustment'),
  ensurePropertyAccess,
  addSettlementAdjustment
);


/**
 * @swagger
 * /bookings/{id}/settlement/payment:
 *   post:
 *     summary: Process settlement payment (Admin/Staff only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethods
 *               - amount
 *             properties:
 *               paymentMethods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     method:
 *                       type: string
 *                       enum: [cash, upi, stripe, bank_transfer]
 *                     amount:
 *                       type: number
 *                     reference:
 *                       type: string
 *                     notes:
 *                       type: string
 *               amount:
 *                 type: number
 *                 description: Total settlement amount
 *     responses:
 *       200:
 *         description: Settlement payment processed successfully
 *       400:
 *         description: Invalid payment data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/settlement/payment',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'paySettlement'),
  ensurePropertyAccess,
  paySettlement
);


/**
 * @swagger
 * /bookings/{id}/no-show:
 *   post:
 *     summary: Mark a booking as no-show
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for marking as no-show
 *               chargeAmount:
 *                 type: number
 *                 minimum: 0
 *                 description: Optional no-show charge amount (defaults to 0)
 *     responses:
 *       200:
 *         description: Booking marked as no-show successfully
 *       400:
 *         description: Invalid request or booking status
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/:id/no-show',
  validate(mutationBaselineSchema),
  authenticate,
  ensureTenantContext,
  authorizePolicy('bookings', 'markNoShow'),
  ensurePropertyAccess,
  markNoShow
);

export default router;

