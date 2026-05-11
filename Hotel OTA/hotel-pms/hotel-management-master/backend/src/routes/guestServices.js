import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import GuestService from '../models/GuestService.js';
import Booking from '../models/Booking.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess, refToHotelIdString } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { serviceNotificationService } from '../services/serviceNotificationService.js';
import { validate, schemas } from '../middleware/validation.js';
import websocketService from '../services/websocketService.js';
import guestServicePOSIntegration from '../services/guestServicePOSIntegration.js';
import logger from '../utils/logger.js';
import { validateStatusTransition, GUEST_SERVICE_TRANSITIONS } from '../utils/statusTransitions.js';
import { track as intentTrack } from '../services/intentCaptureService.ts';

const APP_TYPE = 'hotel-pms';
const router = express.Router();
const ASSIGNABLE_ROLES = ['staff', 'frontdesk'];
const GUEST_SERVICE_LIST_CREATE_ROLES = ['guest', 'staff', 'frontdesk', 'manager', 'admin'];
const GUEST_SERVICE_UPDATE_ROLES = ['guest', 'staff', 'frontdesk', 'manager', 'admin'];
const objectIdSchema = Joi.string().length(24).hex();
const serviceTypeSchema = Joi.string().valid('room_service', 'housekeeping', 'maintenance', 'concierge', 'transport', 'spa', 'laundry', 'other');
const prioritySchema = Joi.string().valid('now', 'later', 'low', 'medium', 'high', 'urgent');
const itemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  quantity: Joi.number().integer().min(1).max(1000).required(),
  price: Joi.number().min(0).max(1000000).optional() // Note: client-supplied price will be overridden server-side
});
const createGuestServiceSchema = Joi.object({
  bookingId: objectIdSchema.required(),
  serviceType: serviceTypeSchema.required(),
  serviceVariation: Joi.string().trim().allow('').max(120).optional(),
  serviceVariations: Joi.array().items(Joi.string().trim().min(1).max(120)).max(20).optional(),
  title: Joi.string().trim().max(200).allow('').optional(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  priority: prioritySchema.optional(),
  scheduledTime: Joi.date().iso().optional(),
  items: Joi.array().items(itemSchema).max(100).optional(),
  specialInstructions: Joi.string().trim().max(2000).allow('').optional()
}).required();
const bulkAssignSchema = Joi.object({
  serviceIds: Joi.array().items(objectIdSchema).min(1).max(200).required(),
  assignedTo: objectIdSchema.required(),
  hotelId: objectIdSchema.optional()
}).required();
const bulkStatusSchema = Joi.object({
  serviceIds: Joi.array().items(objectIdSchema).min(1).max(200).required(),
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'cancelled').required(),
  hotelId: objectIdSchema.optional()
}).required();
const updateGuestServiceSchema = Joi.object({
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'cancelled').optional(),
  assignedTo: Joi.alternatives().try(objectIdSchema, Joi.allow(null), Joi.string().allow('')).optional(),
  notes: Joi.string().trim().max(2000).allow('').optional(),
  actualCost: Joi.number().min(0).max(1000000).optional(),
  scheduledTime: Joi.date().iso().optional(),
  priority: prioritySchema.optional(),
  completedServiceVariations: Joi.array().items(Joi.string().trim().min(1).max(120)).max(50).optional(),
  cancellationReason: Joi.string().trim().max(500).allow('').optional(),
  rating: Joi.number().min(1).max(5).optional(),
  feedback: Joi.string().trim().max(2000).allow('').optional(),
  hotelId: objectIdSchema.optional()
}).min(1).required();
const feedbackSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  feedback: Joi.string().trim().max(2000).allow('').optional()
}).required();

const authorizeRoles = (allowedRoles) => (req, _res, next) => {
  if (!allowedRoles.includes(req.user?.role)) {
    return next(new ApplicationError('Insufficient permissions for guest services', 403));
  }
  return next();
};

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return (value._id || value).toString();
};

const buildHotelSafeServicePayload = (serviceRequest) => ({
  _id: toIdString(serviceRequest?._id),
  hotelId: toIdString(serviceRequest?.hotelId),
  userId: toIdString(serviceRequest?.userId),
  bookingId: toIdString(serviceRequest?.bookingId),
  serviceType: serviceRequest?.serviceType,
  serviceVariation: serviceRequest?.serviceVariation,
  serviceVariations: serviceRequest?.serviceVariations,
  completedServiceVariations: serviceRequest?.completedServiceVariations,
  title: serviceRequest?.title,
  description: serviceRequest?.description,
  priority: serviceRequest?.priority,
  status: serviceRequest?.status,
  assignedTo: toIdString(serviceRequest?.assignedTo),
  estimatedCost: serviceRequest?.estimatedCost,
  actualCost: serviceRequest?.actualCost,
  notes: serviceRequest?.notes,
  scheduledTime: serviceRequest?.scheduledTime,
  createdAt: serviceRequest?.createdAt,
  updatedAt: serviceRequest?.updatedAt,
  completedTime: serviceRequest?.completedTime
});

// All routes require authentication, tenant isolation, and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /guest-services:
 *   post:
 *     summary: Create a new guest service request
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - serviceType
 *               - serviceVariation
 *             properties:
 *               bookingId:
 *                 type: string
 *               serviceType:
 *                 type: string
 *                 enum: [room_service, housekeeping, maintenance, concierge, transport, spa, laundry, other]
 *               serviceVariation:
 *                 type: string
 *               serviceVariations:
 *                 type: array
 *                 items:
 *                   type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [now, later, low, medium, high, urgent]
 *               scheduledTime:
 *                 type: string
 *                 format: date-time
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     price:
 *                       type: number
 *               specialInstructions:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service request created successfully
 */
router.post('/', authorizePolicy('guestServices', 'baseAccess'), validate(createGuestServiceSchema), catchAsync(async (req, res) => {
  const {
    bookingId,
    serviceType,
    serviceVariation,
    serviceVariations,
    title,
    description,
    priority,
    scheduledTime,
    items: rawItems,
    specialInstructions
  } = req.body;

  // Verify booking exists and belongs to user — include hotelId tenant check for non-guest roles
  const bookingQuery = { _id: bookingId };
  if (req.user.role !== 'guest' && req.user.hotelId) {
    bookingQuery.hotelId = req.user.hotelId;
  }
  const booking = await Booking.findOne(bookingQuery).lean();
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  // Guests can only create requests for their own bookings
  if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only create requests for your own bookings', 403);
  }

  // Validate items: quantity must be >= 1, names must be non-empty
  if (rawItems && Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (item.name && typeof item.name === 'string' && item.name.trim()) {
        if (typeof item.quantity !== 'number' || item.quantity < 1) {
          throw new ApplicationError(`Item "${item.name}" must have a quantity of at least 1`, 400);
        }
      }
    }
  }

  // Override client-supplied prices - prices are server-authoritative
  // For inventory requests, prices default to 0 (complimentary items like towels/toiletries)
  // For room service with POS integration, prices come from the POS menu catalog downstream
  const items = rawItems && rawItems.length > 0
    ? rawItems.map(item => ({
        ...item,
        price: 0 // Client price ignored — set to 0 for complimentary; POS integration applies actual prices
      }))
    : rawItems;

  // Duplicate request guard: prevent creating the same service type while one is already active
  // Active = pending | assigned | in_progress for the same booking+serviceType
  const existingActive = await GuestService.findOne({
    bookingId,
    serviceType,
    status: { $in: ['pending', 'assigned', 'in_progress'] }
  }).select('_id status').lean();

  if (existingActive) {
    throw new ApplicationError(
      `An active ${serviceType.replace(/_/g, ' ')} request already exists for this booking (status: ${existingActive.status}). Please wait for it to complete or cancel it first.`,
      409
    );
  }

  // Handle multiple service variations
  const finalServiceVariations = serviceVariations && serviceVariations.length > 0 ? serviceVariations : [];
  const primaryVariation = serviceVariation || (finalServiceVariations.length > 0 ? finalServiceVariations[0] : '');

  // VIP priority escalation: auto-upgrade to 'high' for loyalty platinum/diamond guests
  // who haven't explicitly requested urgent or high priority
  let effectivePriority = priority || 'now';
  const requestingUser = await (mongoose.model('User')).findById(booking.userId).select('loyalty').lean();
  const isVipTier = requestingUser?.loyalty?.tier === 'platinum' || requestingUser?.loyalty?.tier === 'diamond';
  if (isVipTier && !['urgent', 'high'].includes(effectivePriority)) {
    effectivePriority = 'high';
  }

  // Create initial service request
  let serviceRequest = new GuestService({
    hotelId: booking.hotelId,
    userId: booking.userId,
    bookingId,
    serviceType,
    serviceVariation: primaryVariation,
    serviceVariations: finalServiceVariations,
    title: title || (finalServiceVariations.length > 1 ? `${finalServiceVariations.length} ${serviceType.replace('_', ' ')} services` : primaryVariation),
    description,
    priority: effectivePriority,
    scheduledTime,
    items: (items || []).filter(i => i.name && i.name.trim()),
    specialInstructions,
    status: 'pending'
  });

  // Apply intelligent staff assignment
  serviceRequest = await GuestService.autoAssignToStaff(serviceRequest, booking.hotelId);

  // Save the service request
  await serviceRequest.save();

  // Track intent for service request creation (LOW priority)
  intentTrack({
    userId: booking.userId.toString(),
    event: 'service_request_created',
    appType: APP_TYPE,
    intentKey: `hotel:${booking.hotelId}:service:${serviceType}`,
    properties: { serviceType, serviceVariation: primaryVariation, priority: effectivePriority, bookingId },
  });

  await serviceRequest.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'userId', select: 'name email' },
    { path: 'bookingId', select: 'bookingNumber' },
    { path: 'assignedTo', select: 'name email role' },
    { path: 'relatedHotelService', select: 'name type' }
  ]);

  // Send notification to assigned staff member
  if (serviceRequest.assignedTo) {
    try {
      await serviceNotificationService.notifyStaffAssignment(serviceRequest, serviceRequest.assignedTo);
    } catch (error) {
      logger.error('Failed to send staff assignment notification', { error: error.message });
    }
  }

  // Attempt to create POS order for food-related service requests
  let posOrder = null;
  try {
    posOrder = await guestServicePOSIntegration.createPOSOrderFromServiceRequest(serviceRequest);
    if (posOrder) {
      logger.debug('POS order created for service request', { orderNumber: posOrder.orderNumber, serviceRequestId: serviceRequest._id });

      // Link the service request to the POS order
      await guestServicePOSIntegration.linkServiceRequestToPOSOrder(serviceRequest, posOrder);

      // Re-populate the updated service request
      await serviceRequest.populate([
        { path: 'hotelId', select: 'name' },
        { path: 'userId', select: 'name email' },
        { path: 'bookingId', select: 'bookingNumber' },
        { path: 'assignedTo', select: 'name email role' },
        { path: 'relatedHotelService', select: 'name type' }
      ]);
    }
  } catch (posError) {
    // Log POS integration errors but don't fail the service request creation
    logger.error('Failed to create POS order for service request', { error: posError.message });
  }

  // Real-time WebSocket notifications for guest service request
  try {
    const hotelSafeServiceRequest = buildHotelSafeServicePayload(serviceRequest);
    await websocketService.broadcastToHotel(booking.hotelId, 'guest-services:created', {
      serviceRequest: hotelSafeServiceRequest
    });

    if (serviceRequest.assignedTo) {
      const assigneeId = typeof serviceRequest.assignedTo === 'object'
        ? (serviceRequest.assignedTo._id || serviceRequest.assignedTo).toString()
        : serviceRequest.assignedTo.toString();
      await websocketService.sendToUser(assigneeId, 'guest-services:assigned', {
        serviceRequest,
        booking
      });
    }

    await websocketService.sendToUser(serviceRequest.userId.toString(), 'guest-services:created', {
      serviceRequest,
      status: 'confirmed'
    });
  } catch (wsError) {
    logger.warn('Failed to send real-time guest service notification', { error: wsError.message });
  }

  res.status(201).json({
    status: 'success',
    data: {
      serviceRequest,
      ...(posOrder && { posOrder: {
        _id: posOrder._id,
        orderNumber: posOrder.orderNumber,
        totalAmount: posOrder.totalAmount,
        status: posOrder.status
      }})
    }
  });
}));

/**
 * @swagger
 * /guest-services:
 *   get:
 *     summary: Get guest service requests
 *     tags: [Guest Services]
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
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of service requests
 */
// Allowlists for guest service query filter fields — prevent NoSQL operator injection.
const ALLOWED_GS_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
const ALLOWED_GS_SERVICE_TYPES = ['room_service', 'housekeeping', 'maintenance', 'concierge', 'transport', 'spa', 'laundry', 'other'];
const ALLOWED_GS_PRIORITIES = ['now', 'later', 'low', 'medium', 'high', 'urgent'];

router.get('/', authorizePolicy('guestServices', 'baseAccess'), catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    serviceType,
    serviceTypes,
    serviceVariation,
    excludeServiceVariation,
    priority,
    assignedTo,
    bookingId,
    userId,
    fromDate,
    toDate,
    completedFrom,
    completedTo
  } = req.query;

  // SECURITY: Validate enum filter values against allowlists to prevent NoSQL operator injection.
  if (status && !ALLOWED_GS_STATUSES.includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Invalid status filter value' });
  }
  if (serviceType && !ALLOWED_GS_SERVICE_TYPES.includes(serviceType)) {
    return res.status(400).json({ status: 'error', message: 'Invalid serviceType filter value' });
  }
  if (priority && !ALLOWED_GS_PRIORITIES.includes(priority)) {
    return res.status(400).json({ status: 'error', message: 'Invalid priority filter value' });
  }
  // SECURITY: Validate ObjectId fields to prevent CastError leakage and injection.
  if (assignedTo && !mongoose.Types.ObjectId.isValid(assignedTo)) {
    return res.status(400).json({ status: 'error', message: 'Invalid assignedTo filter value' });
  }
  if (bookingId && !mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ status: 'error', message: 'Invalid bookingId filter value' });
  }
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ status: 'error', message: 'Invalid userId filter value' });
  }

  const query = {};

  // Role-based filtering with mandatory tenant isolation
  if (req.user.role === 'guest') {
    query.userId = req.user._id;
    let guestHotelId = refToHotelIdString(req.query.hotelId || req.user?.hotelId);
    // Guests may not have hotelId on their user record — resolve from active booking
    if (!guestHotelId) {
      const activeBooking = await Booking.findOne({
        userId: req.user._id,
        status: { $in: ['confirmed', 'checked_in', 'pending'] },
        checkOut: { $gte: new Date() }
      }).select('hotelId').sort({ checkIn: -1 }).lean();
      guestHotelId = activeBooking?.hotelId ? refToHotelIdString(activeBooking.hotelId) : null;
    }
    if (!guestHotelId) {
      // No active booking — return empty list rather than 400 (guest may have no current stay)
      return res.json({ status: 'success', data: { serviceRequests: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } });
    }
    query.hotelId = guestHotelId;
  } else {
    const hotelId = refToHotelIdString(req.query.hotelId || req.body.hotelId || req.user?.hotelId);
    if (!hotelId) {
      return res.status(400).json({ status: 'error', message: 'Hotel context required' });
    }
    query.hotelId = hotelId;
  }

  // Apply filters
  if (status) query.status = status;
  if (serviceType) query.serviceType = serviceType;
  if (serviceTypes) {
    const types = String(serviceTypes)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      // SECURITY: Allowlist each service type to prevent NoSQL operator injection via $in array.
      .filter((v) => ALLOWED_GS_SERVICE_TYPES.includes(v));
    if (types.length > 0) {
      query.serviceType = { $in: types };
    }
  }
  if (serviceVariation) {
    const variation = String(serviceVariation).trim();
    if (variation) {
      query.$or = [
        { serviceVariation: variation },
        { serviceVariations: variation }
      ];
    }
  }
  if (excludeServiceVariation) {
    const excluded = String(excludeServiceVariation).trim();
    if (excluded) {
      query.$and = (query.$and || []).concat([
        { serviceVariation: { $ne: excluded } },
        { serviceVariations: { $nin: [excluded] } }
      ]);
    }
  }
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (bookingId) query.bookingId = bookingId;
  if (userId && req.user.role !== 'guest') query.userId = userId;

  // Server-side text search
  const { search } = req.query;
  if (search && typeof search === 'string' && search.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchConditions = [
      { 'items.name': { $regex: escapedSearch, $options: 'i' } },
      { specialInstructions: { $regex: escapedSearch, $options: 'i' } },
      { serviceVariation: { $regex: escapedSearch, $options: 'i' } }
    ];
    query.$or = query.$or ? [...query.$or, ...searchConditions] : searchConditions;
  }

  // Date range filtering — used by staff for "completed today" etc.
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      const from = new Date(fromDate);
      if (!Number.isNaN(from.getTime())) query.createdAt.$gte = from;
    }
    if (toDate) {
      const to = new Date(toDate);
      if (!Number.isNaN(to.getTime())) query.createdAt.$lte = to;
    }
    // Clean up if both were invalid
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
  }

  // completedTime range filtering — used by staff for "completed today" view
  if (completedFrom || completedTo) {
    query.completedTime = {};
    if (completedFrom) {
      const from = new Date(completedFrom);
      if (!Number.isNaN(from.getTime())) query.completedTime.$gte = from;
    }
    if (completedTo) {
      const to = new Date(completedTo);
      if (!Number.isNaN(to.getTime())) query.completedTime.$lte = to;
    }
    if (Object.keys(query.completedTime).length === 0) delete query.completedTime;
  }

  // Staff users are scoped to their own assignments for non-pending requests.
  // For pending (unassigned) requests, staff must be able to see the full hotel
  // queue so they can claim requests via "Assign to Me".
  if (req.user.role === 'staff') {
    if (status === 'pending') {
      // Show all pending requests for the hotel — no assignedTo filter
      // (pending requests are unassigned by definition)
      delete query.assignedTo;
    } else {
      // For all other statuses, scope to the staff member's own requests
      query.assignedTo = req.user._id;
    }
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [serviceRequests, total] = await Promise.all([
    GuestService.find(query)
      .populate('hotelId', 'name')
      .populate('userId', 'name email')
      .populate({
        path: 'bookingId',
        select: 'bookingNumber rooms',
        populate: {
          path: 'rooms.roomId',
          select: 'roomNumber'
        }
      })
      .populate('assignedTo', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    GuestService.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      serviceRequests,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: parsedLimit > 0 ? Math.ceil(total / parsedLimit) : 1
      }
    }
  });
}));

/**
 * @swagger
 * /guest-services/stats:
 *   get:
 *     summary: Get service statistics (staff/admin only)
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Service statistics
 */
router.get('/stats', authorizePolicy('guestServices', 'staffAccess'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  let hotelId;
  if (['staff', 'frontdesk', 'manager'].includes(req.user.role)) {
    hotelId = refToHotelIdString(req.query.hotelId || req.user.hotelId);
  } else if (req.user.role === 'admin') {
    hotelId = refToHotelIdString(req.query.hotelId || req.user.hotelId);
  }

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required. Admin users should provide hotelId as query parameter.', 400);
  }

  const stats = await GuestService.getServiceStats(hotelId, startDate, endDate);

  // Get overall stats
  const overallStats = await GuestService.aggregate([
    { 
      $match: {
        hotelId: mongoose.Types.ObjectId.isValid(hotelId) ? new mongoose.Types.ObjectId(hotelId) : hotelId,
        ...(startDate && endDate ? {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        } : {})
      }
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        totalRevenue: { $sum: '$actualCost' },
        pendingCount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        assignedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] }
        },
        inProgressCount: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        completedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelledCount: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        totalResponseTime: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$scheduledTime', null] }, { $ne: ['$createdAt', null] }] },
              { $subtract: ['$scheduledTime', '$createdAt'] },
              null
            ]
          }
        },
        totalCompletionTime: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$completedTime', null] }, { $ne: ['$createdAt', null] }] },
              { $subtract: ['$completedTime', '$createdAt'] },
              null
            ]
          }
        }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      overall: overallStats[0] || {},
      byServiceType: stats
    }
  });
}));

/**
 * @swagger
 * /guest-services/available-staff:
 *   get:
 *     summary: Get available staff for guest services (staff/admin only)
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available staff list
 */
router.get('/available-staff', authorizePolicy('guestServices', 'staffAccess'), catchAsync(async (req, res) => {
  const hotelId = refToHotelIdString(req.query.hotelId || req.user.hotelId);

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required. Admin users should provide hotelId as query parameter.', 400);
  }

  const { page = 1, limit = 50 } = req.query;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (parsedPage - 1) * parsedLimit;

  const User = mongoose.model('User');
  const [staffMembers, total] = await Promise.all([
    User.find({
      hotelId,
      role: { $in: ASSIGNABLE_ROLES },
      isActive: true
    }).select('_id name email department').sort({ name: 1 }).skip(skip).limit(parsedLimit).lean(),
    User.countDocuments({ hotelId, role: { $in: ASSIGNABLE_ROLES }, isActive: true })
  ]);

  res.json({
    status: 'success',
    data: staffMembers,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      pages: Math.ceil(total / parsedLimit)
    }
  });
}));

/**
 * @swagger
 * /guest-services/{id}:
 *   get:
 *     summary: Get specific service request
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service request details
 */
// Bulk assign services to staff (MUST be before /:id routes)
router.patch('/bulk/assign', authorizePolicy('guestServices', 'staffAccess'), validate(bulkAssignSchema), catchAsync(async (req, res) => {
  const { serviceIds, assignedTo } = req.body;
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new ApplicationError('serviceIds array is required', 400);
  }
  if (!assignedTo) {
    throw new ApplicationError('assignedTo is required', 400);
  }
  const hotelId = refToHotelIdString(req.query.hotelId || req.body.hotelId || req.user.hotelId);
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }
  const User = mongoose.model('User');
  const assignee = await User.findOne({
    _id: assignedTo,
    hotelId,
    role: { $in: ASSIGNABLE_ROLES },
    isActive: true
  }).select('_id').lean();
  if (!assignee) {
    throw new ApplicationError('assignedTo must be an active staff/frontdesk user in the same hotel', 400);
  }
  const result = await GuestService.updateMany(
    { _id: { $in: serviceIds }, hotelId },
    { $set: { assignedTo, status: 'assigned', updatedAt: new Date() } }
  );

  // Track intent for staff assignment (LOW priority)
  if (result.modifiedCount > 0) {
    const assignedServices = await GuestService.find(
      { _id: { $in: serviceIds } },
      { userId: 1, serviceType: 1 }
    ).lean();
    for (const svc of assignedServices) {
      intentTrack({
        userId: svc.userId.toString(),
        event: 'staff_assigned',
        appType: APP_TYPE,
        intentKey: `hotel:${hotelId}:service:${svc.serviceType}`,
        properties: { serviceId: svc._id.toString(), assignedTo, hotelId },
      });
    }
  }

  try {
    await websocketService.broadcastToHotel(hotelId, 'guest-services:assigned', {
      bulkOperation: true,
      serviceIds,
      assignedTo,
      updated: result.modifiedCount
    });
    await websocketService.broadcastToHotel(hotelId, 'guest-services:updated', {
      bulkOperation: true,
      serviceIds,
      assignedTo,
      updated: result.modifiedCount
    });
  } catch (wsError) {
    logger.warn('Failed to send guest-services bulk assignment notification', { error: wsError.message });
  }

  res.json({ status: 'success', data: { updated: result.modifiedCount } });
}));

// Bulk update status
router.patch('/bulk/status', authorizePolicy('guestServices', 'staffAccess'), validate(bulkStatusSchema), catchAsync(async (req, res) => {
  const { serviceIds, status } = req.body;
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new ApplicationError('serviceIds array is required', 400);
  }
  const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ApplicationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }
  const updateData = { status, updatedAt: new Date() };
  if (status === 'completed') updateData.completedTime = new Date();
  const bulkHotelId = refToHotelIdString(req.query.hotelId || req.body.hotelId || req.user.hotelId);
  if (!bulkHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }
  const services = await GuestService.find(
    { _id: { $in: serviceIds }, hotelId: bulkHotelId },
    { _id: 1, status: 1 }
  ).lean();
  if (services.length === 0) {
    throw new ApplicationError('No matching service requests found for this hotel', 404);
  }
  const invalidTransitions = services
    .map((service) => {
      if (service.status === status) {
        return null;
      }
      const transition = validateStatusTransition(GUEST_SERVICE_TRANSITIONS, service.status, status);
      if (transition.valid) {
        return null;
      }
      return { serviceId: service._id.toString(), from: service.status, to: status, error: transition.error };
    })
    .filter(Boolean);
  if (invalidTransitions.length > 0) {
    throw new ApplicationError(
      `Invalid status transition for ${invalidTransitions.length} request(s). Example: ${invalidTransitions[0].from} -> ${invalidTransitions[0].to}`,
      400
    );
  }
  const result = await GuestService.updateMany(
    { _id: { $in: serviceIds }, hotelId: bulkHotelId },
    { $set: updateData }
  );

  // Track intent for request completion (HIGH priority)
  if (status === 'completed' && result.modifiedCount > 0) {
    const completedServices = await GuestService.find(
      { _id: { $in: serviceIds } },
      { userId: 1, serviceType: 1 }
    ).lean();
    for (const svc of completedServices) {
      intentTrack({
        userId: svc.userId.toString(),
        event: 'request_completed',
        appType: APP_TYPE,
        intentKey: `hotel:${bulkHotelId}:service:${svc.serviceType}`,
        properties: { serviceId: svc._id.toString(), hotelId: bulkHotelId },
      });
    }
  }

  try {
    await websocketService.broadcastToHotel(bulkHotelId, 'guest-services:status_changed', {
      bulkOperation: true,
      serviceIds,
      status,
      newStatus: status,
      updated: result.modifiedCount
    });
    await websocketService.broadcastToHotel(bulkHotelId, 'guest-services:updated', {
      bulkOperation: true,
      serviceIds,
      status,
      newStatus: status,
      updated: result.modifiedCount
    });
  } catch (wsError) {
    logger.warn('Failed to send guest-services bulk status notification', { error: wsError.message });
  }

  res.json({ status: 'success', data: { updated: result.modifiedCount } });
}));

// Export services as CSV
router.get('/export', authorizePolicy('guestServices', 'staffAccess'), catchAsync(async (req, res) => {
  const { format = 'csv', status: statusFilter, serviceType, priority } = req.query;
  const hotelId = refToHotelIdString(req.query.hotelId || req.user?.hotelId);
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required for export', 400);
  }
  const filter = { hotelId };
  if (statusFilter) filter.status = statusFilter;
  if (serviceType) filter.serviceType = serviceType;
  if (priority) filter.priority = priority;

  const services = await GuestService.find(filter)
    .populate('userId', 'name email')
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 }).lean().limit(5000);

  if (format === 'csv') {
    // Escape a cell value: wrap in double-quotes and escape internal double-quotes
    const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['ID', 'Service Type', 'Guest', 'Priority', 'Status', 'Assigned To', 'Cost', 'Created', 'Completed'];
    const rows = services.map(s => [
      s._id, s.serviceType || '', s.userId?.name || '', s.priority || '',
      s.status || '', s.assignedTo?.name || '', s.actualCost ?? 0,
      s.createdAt ? new Date(s.createdAt).toISOString() : '',
      s.completedTime ? new Date(s.completedTime).toISOString() : ''
    ]);
    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=guest-services-${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  }
  res.json({ status: 'success', data: { services } });
}));

// Delete a service request (only pending/cancelled)
router.delete('/:id', authorizePolicy('guestServices', 'staffAccess'), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Service request not found', 404);
  }
  const service = await GuestService.findById(req.params.id).lean();
  if (!service) throw new ApplicationError('Service request not found', 404);

  // Tenant isolation: ensure the service belongs to the user's hotel
  const deleteHotelId = refToHotelIdString(req.query.hotelId || req.user?.hotelId);
  if (deleteHotelId && service.hotelId.toString() !== deleteHotelId.toString()) {
    throw new ApplicationError('You can only delete service requests for your hotel', 403);
  }

  if (!['pending', 'cancelled'].includes(service.status)) {
    throw new ApplicationError('Only pending or cancelled service requests can be deleted', 400);
  }
  await GuestService.findByIdAndDelete(req.params.id);
  res.json({ status: 'success', message: 'Service request deleted successfully' });
}));

router.get('/:id', authorizePolicy('guestServices', 'baseAccess'), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Service request not found', 404);
  }
  const serviceRequest = await GuestService.findById(req.params.id)
    .populate('hotelId', 'name contact')
    .populate('userId', 'name email phone')
    .populate({
      path: 'bookingId',
      select: 'bookingNumber rooms checkIn checkOut',
      populate: {
        path: 'rooms.roomId',
        select: 'roomNumber'
      }
    })
    .populate('assignedTo', 'name email').lean();

  if (!serviceRequest) {
    throw new ApplicationError('Service request not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest' && serviceRequest.userId._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only view your own service requests', 403);
  }

  if (req.user.role !== 'guest') {
    const requesterHotelId = refToHotelIdString(req.query.hotelId || req.user?.hotelId);
    if (!requesterHotelId) {
      throw new ApplicationError('Hotel context required', 400);
    }
    if (serviceRequest.hotelId._id.toString() !== requesterHotelId.toString()) {
      throw new ApplicationError('You can only view requests for your hotel', 403);
    }
  }

  res.json({
    status: 'success',
    data: { serviceRequest }
  });
}));

/**
 * @swagger
 * /guest-services/{id}:
 *   patch:
 *     summary: Update service request
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, assigned, in_progress, completed, cancelled]
 *               assignedTo:
 *                 type: string
 *               notes:
 *                 type: string
 *               actualCost:
 *                 type: number
 *               scheduledTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Service request updated successfully
 */
router.patch('/:id', authorizePolicy('guestServices', 'baseAccess'), validate(updateGuestServiceSchema), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Service request not found', 404);
  }
  // First fetch current state to validate permissions and transitions
  const currentRequest = await GuestService.findById(req.params.id).lean();

  if (!currentRequest) {
    throw new ApplicationError('Service request not found', 404);
  }

  const {
    status,
    assignedTo,
    notes,
    actualCost,
    scheduledTime,
    priority,
    completedServiceVariations,
    cancellationReason,
    rating,
    feedback
  } = req.body;

  const scopedHotelId = refToHotelIdString(req.query.hotelId || req.body.hotelId || req.user?.hotelId);
  if (['admin', 'manager'].includes(req.user.role) && !scopedHotelId) {
    throw new ApplicationError('Hotel context required for this update', 400);
  }

  // Permission checks
  const canUpdate =
    (req.user.role === 'admin' && currentRequest.hotelId.toString() === scopedHotelId?.toString()) ||
    ((req.user.role === 'staff' || req.user.role === 'frontdesk' || req.user.role === 'manager') &&
      currentRequest.hotelId.toString() === scopedHotelId?.toString()) ||
    (req.user.role === 'guest' && currentRequest.userId.toString() === req.user._id.toString());

  if (!canUpdate) {
    throw new ApplicationError('You do not have permission to update this request', 403);
  }

  // Staff can only mutate requests assigned to them, except self-claiming unassigned requests.
  if (req.user.role === 'staff') {
    const assignedToStaff = currentRequest.assignedTo && currentRequest.assignedTo.toString() === req.user._id.toString();
    const isClaimingUnassigned =
      !currentRequest.assignedTo &&
      assignedTo &&
      assignedTo.toString() === req.user._id.toString() &&
      (!status || status === 'assigned');

    if (!assignedToStaff && !isClaimingUnassigned) {
      throw new ApplicationError('Staff can only update requests assigned to them', 403);
    }
  }

  const setFields = {};

  // Guests can only cancel their own requests or add feedback to completed ones
  if (req.user.role === 'guest') {
    // Allow guests to add rating/feedback to completed requests
    if (currentRequest.status === 'completed' && (rating !== undefined || feedback !== undefined)) {
      if (rating !== undefined) {
        if (typeof rating !== 'number' || rating < 1 || rating > 5) {
          throw new ApplicationError('Rating must be a number between 1 and 5', 400);
        }
        setFields.rating = rating;
      }
      if (feedback !== undefined) setFields.feedback = feedback;
    } else if (status && status !== 'cancelled') {
      throw new ApplicationError('Guests can only cancel their requests', 403);
    } else if (status === 'cancelled') {
      const guestTransition = validateStatusTransition(GUEST_SERVICE_TRANSITIONS, currentRequest.status, 'cancelled');
      if (!guestTransition.valid) {
        throw new ApplicationError(guestTransition.error, 400);
      }
      setFields.status = 'cancelled';
      if (cancellationReason) setFields.cancellationReason = cancellationReason;
    }
  } else {
    // Staff/admin updates - validate transition if status is changing
    if (status !== undefined) {
      // Allow idempotent status updates for partial progress updates.
      if (status !== currentRequest.status) {
        const staffTransition = validateStatusTransition(GUEST_SERVICE_TRANSITIONS, currentRequest.status, status);
        if (!staffTransition.valid) {
          throw new ApplicationError(staffTransition.error, 400);
        }
      }
      setFields.status = status;
      if (status === 'completed') setFields.completedTime = new Date();
      setFields.statusUpdatedAt = new Date();
    }
    if (assignedTo !== undefined) {
      if (!assignedTo) {
        setFields.assignedTo = null;
      } else {
        const User = mongoose.model('User');
        const assignee = await User.findOne({
          _id: assignedTo,
          hotelId: currentRequest.hotelId,
          role: { $in: ASSIGNABLE_ROLES },
          isActive: true
        }).select('_id').lean();
        if (!assignee) {
          throw new ApplicationError('assignedTo must be an active staff/frontdesk user in the same hotel', 400);
        }
        setFields.assignedTo = assignedTo;
      }
    }
    if (notes !== undefined) setFields.notes = notes;
    if (actualCost !== undefined) setFields.actualCost = actualCost;
    if (scheduledTime !== undefined) setFields.scheduledTime = scheduledTime;
    if (priority !== undefined) setFields.priority = priority;
    if (completedServiceVariations !== undefined) setFields.completedServiceVariations = completedServiceVariations;
  }

  // Atomic update with status guard to prevent concurrent transition conflicts
  const matchQuery = { _id: req.params.id };
  if (status !== undefined) {
    matchQuery.status = currentRequest.status; // Ensure status hasn't changed since read
  }

  const serviceRequest = await GuestService.findOneAndUpdate(
    matchQuery,
    { $set: setFields },
    { new: true, runValidators: true }
  ).populate([
    { path: 'hotelId', select: 'name' },
    { path: 'userId', select: 'name email' },
    { path: 'assignedTo', select: 'name' }
  ]);

  if (!serviceRequest) {
    throw new ApplicationError('Service request was modified concurrently. Please retry.', 409);
  }

  const reqHotelId = (currentRequest.hotelId?._id || currentRequest.hotelId)?.toString();

  // Track intent for staff assignment (LOW priority)
  if (assignedTo !== undefined && setFields.assignedTo &&
      setFields.assignedTo.toString() !== (currentRequest.assignedTo || '').toString()) {
    intentTrack({
      userId: currentRequest.userId.toString(),
      event: 'staff_assigned',
      appType: APP_TYPE,
      intentKey: `hotel:${reqHotelId}:service:${currentRequest.serviceType}`,
      properties: { serviceId: req.params.id, assignedTo: setFields.assignedTo.toString(), hotelId: reqHotelId },
    });
  }

  // Track intent for request completion (HIGH priority)
  if (status === 'completed' && currentRequest.status !== 'completed') {
    intentTrack({
      userId: currentRequest.userId.toString(),
      event: 'request_completed',
      appType: APP_TYPE,
      intentKey: `hotel:${reqHotelId}:service:${currentRequest.serviceType}`,
      properties: { serviceId: req.params.id, hotelId: reqHotelId },
    });
  }

  // Fire in-app notification for guest/staff on status changes
  if (status !== undefined && status !== currentRequest.status) {
    try {
      await serviceNotificationService.notifyStatusChange(serviceRequest, currentRequest.status, status, req.user._id);
    } catch (notifError) {
      logger.warn('Failed to send in-app status change notification', { error: notifError.message });
    }
  }

  // Fire in-app notification for newly assigned staff member
  if (assignedTo && setFields.assignedTo && setFields.assignedTo.toString() !== (currentRequest.assignedTo || '').toString()) {
    try {
      await serviceNotificationService.notifyStaffAssignment(serviceRequest, { _id: setFields.assignedTo });
    } catch (notifError) {
      logger.warn('Failed to send staff assignment notification', { error: notifError.message });
    }

    // Notify previously assigned staff that the request was reassigned away from them
    if (currentRequest.assignedTo && currentRequest.assignedTo.toString() !== setFields.assignedTo.toString()) {
      try {
        await serviceNotificationService.notifyReassignedAway(serviceRequest, currentRequest.assignedTo, req.user._id);
      } catch (notifError) {
        logger.warn('Failed to send reassignment-away notification', { error: notifError.message });
      }
    }
  }

  // Emit realtime update for status/assignment changes
  try {
    if (status !== undefined || assignedTo !== undefined) {
      const previousStatus = currentRequest.status;
      const eventType = status === 'completed' ? 'guest-services:completed'
        : status === 'cancelled' ? 'guest-services:cancelled'
        : status === 'in_progress' ? 'guest-services:in_progress'
        : assignedTo !== undefined ? 'guest-services:assigned'
        : 'guest-services:updated';
      const hotelSafeServiceRequest = buildHotelSafeServicePayload(serviceRequest);

      await websocketService.broadcastToHotel(
        serviceRequest.hotelId?._id || serviceRequest.hotelId,
        eventType,
        { serviceRequest: hotelSafeServiceRequest }
      );
      await websocketService.broadcastToHotel(
        serviceRequest.hotelId?._id || serviceRequest.hotelId,
        'guest-services:updated',
        { serviceRequest: hotelSafeServiceRequest }
      );
      if (status !== undefined) {
        await websocketService.broadcastToHotel(
          serviceRequest.hotelId?._id || serviceRequest.hotelId,
          'guest-services:status_changed',
          { serviceRequest: hotelSafeServiceRequest, status, previousStatus, newStatus: status }
        );
      }

      if (serviceRequest.userId) {
        const userId = serviceRequest.userId?._id || serviceRequest.userId;
        await websocketService.sendToUser(userId.toString(), eventType, { serviceRequest });
        await websocketService.sendToUser(userId.toString(), 'guest-services:updated', { serviceRequest });
        if (status !== undefined) {
          await websocketService.sendToUser(userId.toString(), 'guest-services:status_changed', { serviceRequest, status, previousStatus, newStatus: status });
        }
      }
    }
  } catch (wsError) {
    logger.warn('Failed to send guest-service update notification', { error: wsError.message });
  }

  // Track inventory consumption when inventory request is fulfilled
  if (status === 'completed' && serviceRequest.serviceVariation === 'inventory_request' && serviceRequest.inventoryConsumed?.length > 0) {
    try {
      const guestInventoryService = (await import('../services/guestInventoryService.js')).default;
      const guestId = serviceRequest.userId?._id?.toString() || serviceRequest.userId?.toString();
      const hotelId = (serviceRequest.hotelId?._id || serviceRequest.hotelId)?.toString();
      await guestInventoryService.trackGuestConsumption({
        hotelId,
        guestServiceId: serviceRequest._id,
        guestId,
        bookingId: serviceRequest.bookingId,
        roomId: null,
        staffId: req.user._id,
        consumptions: serviceRequest.inventoryConsumed.map(item => ({
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          chargeToGuest: item.chargeToGuest || false,
          isComplimentary: item.isComplimentary || false,
          notes: item.notes
        }))
      });
    } catch (invErr) {
      logger.warn('Failed to track inventory consumption:', invErr.message);
    }
  }

  res.json({
    status: 'success',
    data: { serviceRequest }
  });
}));

/**
 * @swagger
 * /guest-services/{id}/feedback:
 *   post:
 *     summary: Add feedback to completed service
 *     tags: [Guest Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - rating
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Feedback added successfully
 */
router.post('/:id/feedback', authorizePolicy('guestServices', 'guestAccess'), validate(feedbackSchema), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Service request not found', 404);
  }
  const { rating, feedback } = req.body;
  const scopedHotelId = refToHotelIdString(req.query.hotelId || req.user?.hotelId);
  const feedbackQuery = {
    _id: req.params.id,
    userId: req.user._id,
    status: 'completed'
  };
  if (scopedHotelId) {
    feedbackQuery.hotelId = scopedHotelId;
  }

  const serviceRequest = await GuestService.findOneAndUpdate(
    feedbackQuery,
    { $set: { rating, feedback } },
    { new: true, runValidators: true }
  );

  if (!serviceRequest) {
    // Determine specific error
    const exists = await GuestService.findById(req.params.id).lean();
    if (!exists) {
      throw new ApplicationError('Service request not found', 404);
    }
    if (exists.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You can only rate your own service requests', 403);
    }
    throw new ApplicationError('You can only rate completed services', 400);
  }

  res.json({
    status: 'success',
    message: 'Feedback added successfully',
    data: { serviceRequest }
  });
}));



export default router;