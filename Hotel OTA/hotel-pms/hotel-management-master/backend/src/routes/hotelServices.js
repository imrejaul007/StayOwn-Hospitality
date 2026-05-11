import express from 'express';
import mongoose from 'mongoose';
import HotelService from '../models/HotelService.js';
import ServiceBooking from '../models/ServiceBooking.js';
import HotelServiceFavorite from '../models/HotelServiceFavorite.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { resolvePublicHotelIdFromRequest } from '../utils/publicHotelContext.js';

const router = express.Router();

// Note: Catalog-browsing routes use optionalAuth (public for booking widgets).
// Mutation routes and user-specific routes require full authentication.

/**
 * @swagger
 * /hotel-services:
 *   get:
 *     summary: Get all hotel services
 *     tags: [Hotel Services]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [dining, spa, gym, transport, entertainment, business, wellness, recreation]
 *         description: Filter by service type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search services by name or description
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter featured services only
 *     responses:
 *       200:
 *         description: List of hotel services
 */
router.get('/', optionalAuth, catchAsync(async (req, res) => {
  const { type, search, featured, page = '1', limit = '20', tags, minPrice, maxPrice, availabilityNow } = req.query;
  // Guest JWTs often omit hotelId; align with public catalog + query ?hotelId= + PUBLIC_DEFAULT_HOTEL_ID
  const resolvedHotelId = resolvePublicHotelIdFromRequest(req);

  const query = { isActive: true, hotelId: resolvedHotelId };

  if (type) {
    query.type = type;
  }

  if (featured === 'true') {
    query.featured = true;
    const now = new Date();
    query.$and = [
      {
        $or: [
          { featuredFrom: { $exists: false } },
          { featuredFrom: null },
          { featuredFrom: { $lte: now } }
        ]
      },
      {
        $or: [
          { featuredUntil: { $exists: false } },
          { featuredUntil: null },
          { featuredUntil: { $gte: now } }
        ]
      }
    ];
  }

  if (tags && typeof tags === 'string') {
    const tagsList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagsList.length) {
      query.tags = { $in: tagsList };
    }
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined && Number.isFinite(Number(minPrice))) {
      query.price.$gte = Number(minPrice);
    }
    if (maxPrice !== undefined && Number.isFinite(Number(maxPrice))) {
      query.price.$lte = Number(maxPrice);
    }
    if (Object.keys(query.price).length === 0) {
      delete query.price;
    }
  }

  if (availabilityNow === 'true') {
    query.isActive = true;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  if (search && typeof search === 'string') {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
    if (safeSearch) {
      const regex = new RegExp(safeSearch, 'i');
      query.$or = [{ name: regex }, { description: regex }, { tags: regex }];
    }
  }

  const [services, totalCount] = await Promise.all([
    HotelService.find(query)
      .sort({ featured: -1, 'rating.average': -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('hotelId', 'name')
      .lean(),
    HotelService.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: services,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum)
    }
  });
}));

/**
 * @swagger
 * /hotel-services/bookings:
 *   get:
 *     summary: Get user's service bookings
 *     tags: [Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *     responses:
 *       200:
 *         description: User's service bookings
 */
router.get('/bookings',
  authenticate, ensureTenantContext,
  authorizePolicy('hotelServices', 'baseAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const resolvedHotelId = resolvePublicHotelIdFromRequest(req);
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      hotelId: resolvedHotelId
    };
    
    if (status) {
      options.status = status;
    }
    
    const result = await ServiceBooking.getUserBookings(req.user._id, options);

    res.json({
      status: 'success',
      data: result
    });
  })
);

router.get('/favorites',
  authenticate, ensureTenantContext,
  authorizePolicy('hotelServices', 'baseAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const hotelId = resolvePublicHotelIdFromRequest(req);
    const favorites = await HotelServiceFavorite.find({ userId: req.user._id, hotelId })
      .select('serviceId')
      .lean()
      .limit(1000);
    res.json({
      status: 'success',
      data: favorites.map((f) => String(f.serviceId))
    });
  })
);

router.post('/favorites/:serviceId',
  authenticate, ensureTenantContext,
  authorizePolicy('hotelServices', 'baseAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { serviceId } = req.params;
    const hotelId = resolvePublicHotelIdFromRequest(req);
    const service = await HotelService.findOne({ _id: serviceId, hotelId, isActive: true }).select('_id').lean();
    if (!service) throw new ApplicationError('Service not found', 404);
    await HotelServiceFavorite.updateOne(
      { userId: req.user._id, hotelId, serviceId },
      { $setOnInsert: { userId: req.user._id, hotelId, serviceId } },
      { upsert: true }
    );
    res.status(201).json({ status: 'success', data: { serviceId } });
  })
);

router.delete('/favorites/:serviceId',
  authenticate, ensureTenantContext,
  authorizePolicy('hotelServices', 'baseAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { serviceId } = req.params;
    const hotelId = resolvePublicHotelIdFromRequest(req);
    await HotelServiceFavorite.deleteOne({ userId: req.user._id, hotelId, serviceId });
    res.json({ status: 'success', data: { serviceId } });
  })
);

/**
 * @swagger
 * /hotel-services/bookings/{bookingId}:
 *   get:
 *     summary: Get specific service booking details
 *     tags: [Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service booking details
 *       404:
 *         description: Booking not found
 */
router.get('/bookings/:bookingId',
  authenticate, ensureTenantContext,
  authorizePolicy('hotelServices', 'baseAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    
    const booking = await ServiceBooking.findById(bookingId)
      .populate('serviceId', 'name type price images description contactInfo')
      .populate('hotelId', 'name address')
      .populate('userId', 'name email').lean();
      
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }
    
    // Check if user owns this booking
    if (booking.userId._id.toString() !== req.user._id.toString()) {
      throw new ApplicationError('Not authorized to view this booking', 403);
    }

    res.json({
      status: 'success',
      data: booking
    });
  })
);

/**
 * @swagger
 * /hotel-services/types:
 *   get:
 *     summary: Get all service types
 *     tags: [Hotel Services]
 *     responses:
 *       200:
 *         description: List of service types
 */
router.get('/types', catchAsync(async (req, res) => {
  const types = [
    { value: 'dining', label: 'Dining & Restaurants', icon: '🍽️' },
    { value: 'spa', label: 'Spa & Wellness', icon: '💆' },
    { value: 'gym', label: 'Fitness & Gym', icon: '💪' },
    { value: 'transport', label: 'Transportation', icon: '🚗' },
    { value: 'entertainment', label: 'Entertainment', icon: '🎭' },
    { value: 'business', label: 'Business Services', icon: '💼' },
    { value: 'wellness', label: 'Wellness & Health', icon: '🧘' },
    { value: 'recreation', label: 'Recreation', icon: '🏊' }
  ];

  res.json({
    status: 'success',
    data: types
  });
}));

/**
 * @swagger
 * /hotel-services/featured:
 *   get:
 *     summary: Get featured hotel services
 *     tags: [Hotel Services]
 *     responses:
 *       200:
 *         description: List of featured services
 */
router.get('/featured', optionalAuth, catchAsync(async (req, res) => {
  const hotelId = resolvePublicHotelIdFromRequest(req);

  const featuredServices = await HotelService.getFeaturedServices(hotelId);

  res.json({
    status: 'success',
    data: featuredServices
  });
}));

/**
 * @swagger
 * /hotel-services/{serviceId}:
 *   get:
 *     summary: Get specific hotel service details
 *     tags: [Hotel Services]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel service details
 *       404:
 *         description: Service not found
 */
router.get('/:serviceId', optionalAuth, catchAsync(async (req, res) => {
  const { serviceId } = req.params;
  const resolvedHotelId = resolvePublicHotelIdFromRequest(req);

  const query = { _id: serviceId, isActive: true };
  query.hotelId = resolvedHotelId;

  const service = await HotelService.findOne(query)
    .populate('hotelId', 'name address').lean();

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  res.json({
    status: 'success',
    data: service
  });
}));

/**
 * @swagger
 * /hotel-services/{serviceId}/availability:
 *   get:
 *     summary: Check service availability
 *     tags: [Hotel Services]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check availability
 *       - in: query
 *         name: people
 *         required: true
 *         schema:
 *           type: integer
 *         description: Number of people
 *     responses:
 *       200:
 *         description: Availability status
 */
router.get('/:serviceId/availability', optionalAuth, catchAsync(async (req, res) => {
  const { serviceId } = req.params;
  const { date, people } = req.query;

  if (!date || !people) {
    throw new ApplicationError('Date and number of people are required', 400);
  }
  const peopleNum = Number.parseInt(String(people), 10);
  if (!Number.isInteger(peopleNum) || peopleNum < 1) {
    throw new ApplicationError('Number of people must be a positive integer', 400);
  }
  const bookingDate = new Date(String(date));
  if (Number.isNaN(bookingDate.getTime())) {
    throw new ApplicationError('Invalid booking date', 400);
  }

  const resolvedHotelId = resolvePublicHotelIdFromRequest(req);
  const service = await HotelService.findOne({ _id: serviceId, hotelId: resolvedHotelId, isActive: true }).lean();
  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  const availability = await ServiceBooking.checkAvailability(
    serviceId,
    bookingDate,
    peopleNum
  );

  res.json({
    status: 'success',
    data: availability
  });
}));

/**
 * @swagger
 * /hotel-services/{serviceId}/bookings:
 *   post:
 *     summary: Book a hotel service
 *     tags: [Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingDate
 *               - numberOfPeople
 *             properties:
 *               bookingDate:
 *                 type: string
 *                 format: date-time
 *               numberOfPeople:
 *                 type: integer
 *                 minimum: 1
 *               specialRequests:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service booked successfully
 *       400:
 *         description: Invalid booking request
 */
router.post('/:serviceId/bookings',
  authenticate, ensureTenantContext,
  authorizePolicy('hotelServices', 'baseAccess'),
  ensurePropertyAccess,
  validate(schemas.createServiceBooking),
  catchAsync(async (req, res) => {
    const { serviceId } = req.params;
    const { bookingDate, numberOfPeople, specialRequests } = req.body;
    const resolvedHotelId = resolvePublicHotelIdFromRequest(req);
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    if (idempotencyKey && typeof idempotencyKey !== 'string') {
      throw new ApplicationError('Invalid idempotency key', 400);
    }
    
    // Get the service
    const service = await HotelService.findOne({ _id: serviceId, hotelId: resolvedHotelId, isActive: true }).lean();
    if (!service) {
      throw new ApplicationError('Service not found', 404);
    }
    
    // Check operating hours
    if (service.operatingHours && service.operatingHours.open && service.operatingHours.close) {
      const bookingDate_ = new Date(bookingDate);
      const bookingHour = bookingDate_.getHours();
      const bookingMinute = bookingDate_.getMinutes();
      const bookingTimeStr = `${String(bookingHour).padStart(2, '0')}:${String(bookingMinute).padStart(2, '0')}`;

      const openTime = service.operatingHours.open;
      const closeTime = service.operatingHours.close;

      // Time comparison supporting both normal and overnight hours
      let isOutsideHours;
      if (openTime <= closeTime) {
        // Normal hours (e.g., 09:00 - 18:00)
        isOutsideHours = bookingTimeStr < openTime || bookingTimeStr >= closeTime;
      } else {
        // Overnight hours (e.g., 20:00 - 02:00)
        isOutsideHours = bookingTimeStr < openTime && bookingTimeStr >= closeTime;
      }

      if (isOutsideHours) {
        return res.status(400).json({
          status: 'error',
          message: `This service is only available between ${openTime} and ${closeTime}`
        });
      }
    }

    // Check availability
    const availability = await ServiceBooking.checkAvailability(
      serviceId,
      new Date(bookingDate),
      numberOfPeople
    );

    if (!availability.available) {
      throw new ApplicationError(availability.reason, 400);
    }

    // Re-verify capacity atomically to prevent TOCTOU race condition
    // (another request may have booked between the check above and the create below)
    if (service.capacity) {
      const bookingDateObj = new Date(bookingDate);
      const startOfDay = new Date(bookingDateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(bookingDateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const existingBookingsCount = await ServiceBooking.aggregate([
        {
          $match: {
            serviceId: new mongoose.Types.ObjectId(serviceId),
            bookingDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $nin: ['cancelled'] }
          }
        },
        { $group: { _id: null, totalPeople: { $sum: '$numberOfPeople' } } }
      ]);

      const totalBooked = existingBookingsCount.length > 0 ? existingBookingsCount[0].totalPeople : 0;
      if (totalBooked + numberOfPeople > service.capacity) {
        return res.status(400).json({
          status: 'error',
          message: 'Service is fully booked for this date'
        });
      }
    }

    // Calculate total amount
    const totalAmount = service.price * numberOfPeople;
    const maxDaily = Number.parseInt(process.env.HOTEL_SERVICE_BOOKING_DAILY_LIMIT || '10', 10);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const todayCount = await ServiceBooking.countDocuments({
      userId: req.user._id,
      hotelId: resolvedHotelId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
      status: { $ne: 'cancelled' }
    });
    if (todayCount >= maxDaily) {
      throw new ApplicationError('Daily service booking limit exceeded', 429);
    }

    if (idempotencyKey) {
      const existing = await ServiceBooking.findOne({ userId: req.user._id, idempotencyKey }).lean();
      if (existing) {
        return res.status(200).json({
          status: 'success',
          data: {
            message: 'Service booking already created for this idempotency key',
            booking: existing
          }
        });
      }
    }
    
    // Create booking
    const booking = await ServiceBooking.create({
      userId: req.user._id,
      serviceId,
      hotelId: service.hotelId,
      bookingDate: new Date(bookingDate),
      numberOfPeople,
      totalAmount,
      currency: service.currency,
      specialRequests
      ,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined
    });
    
    // Populate booking data
    await booking.populate([
      { path: 'serviceId', select: 'name type price images description contactInfo' },
      { path: 'hotelId', select: 'name address' }
    ]);

    res.status(201).json({
      status: 'success',
      data: {
        message: 'Service booked successfully',
        booking
      }
    });
    logger.info('Service booking created', {
      bookingId: booking._id,
      serviceId,
      hotelId: String(resolvedHotelId),
      userId: String(req.user._id)
    });
  })
);

/**
 * @swagger
 * /hotel-services/bookings/{bookingId}/cancel:
 *   post:
 *     summary: Cancel a service booking
 *     tags: [Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *       400:
 *         description: Cannot cancel booking
 */
router.post('/bookings/:bookingId/cancel',
  authenticate, ensureTenantContext,
  authorizePolicy('hotelServices', 'baseAccess'),
  ensurePropertyAccess,
  validate(schemas.cancelServiceBooking),
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const { reason } = req.body;
    
    // Do NOT use .lean() — we need the cancelBooking instance method
    const booking = await ServiceBooking.findById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }
    const currentHotelId = resolvePublicHotelIdFromRequest(req);
    if (booking.hotelId.toString() !== currentHotelId.toString()) {
      throw new ApplicationError('Not authorized to cancel this booking', 403);
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('Not authorized to cancel this booking', 403);
    }

    if (typeof booking.cancelBooking !== 'function') {
      throw new ApplicationError('Booking cancellation handler unavailable', 500);
    }
    await booking.cancelBooking(reason, req.user._id);

    res.json({
      status: 'success',
      data: {
        message: 'Booking cancelled successfully',
        booking
      }
    });
  })
);

export default router;
