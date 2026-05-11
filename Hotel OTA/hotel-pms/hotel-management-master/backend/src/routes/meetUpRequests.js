import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import MeetUpRequest from '../models/MeetUpRequest.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import ServiceBooking from '../models/ServiceBooking.js';
import HotelSettings from '../models/HotelSettings.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensurePropertyAccess, refToHotelIdString } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { validateStatusTransition, MEETUP_TRANSITIONS } from '../utils/statusTransitions.js';
import GuestMeetUpBlock from '../models/GuestMeetUpBlock.js';
import GuestMeetUpReport from '../models/GuestMeetUpReport.js';
import {
  maybeAssertGuestMeetUpsEnabled,
  deliverMeetUpGuestNotification,
  broadcastMeetUpUpdate
} from '../services/meetUpGuestPolicyService.js';
import { moderateMeetUpCreateBody } from '../services/meetUpContentModeration.js';
import {
  assertMeetUpNotBlocked,
  getMeetUpBlockedPeerIds,
  assertUnderPendingMeetUpCap,
  assertNotInMeetUpQuietHours
} from '../services/meetUpSafetyService.js';
import { createAndDeliverToHotelOps } from '../services/inAppNotificationDeliveryService.js';
import meetUpSupervisionAlertService from '../services/meetUpSupervisionAlertService.js';
import logger from '../utils/logger.js';

const router = express.Router();

const meetUpWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many meet-up actions. Please try again in an hour.' } },
  keyGenerator: (req) => String(req.user?._id || req.user?.id || req.ip)
});

const meetUpPartnerSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many partner searches. Please try again later.' } },
  keyGenerator: (req) => String(req.user?._id || req.user?.id || req.ip)
});
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

/**
 * Attach computed virtual-equivalent fields to lean meetup documents.
 * Mongoose .lean() strips virtuals; this restores the ones the frontend needs.
 */
function attachVirtuals(doc) {
  if (!doc) return doc;
  const now = new Date();
  const proposedDate = new Date(doc.proposedDate);
  doc.isUpcoming = proposedDate > now && doc.status === 'accepted';
  doc.isPast = proposedDate < now;
  doc.canBeCancelled = doc.status === 'accepted' && proposedDate > now;
  doc.canBeRescheduled = doc.status === 'accepted' && proposedDate > now;
  doc.participantCount = doc.participants?.confirmedParticipants?.length ?? 0;
  doc.hasAvailableSpots = doc.participantCount < (doc.participants?.maxParticipants ?? 2);
  return doc;
}
function attachVirtualsToList(docs) {
  return docs.map(attachVirtuals);
}

/** Booking statuses used to scope guest meet-ups to an active/on-property stay */
const MEETUP_ACTIVE_BOOKING_STATUSES = ['confirmed', 'checked_in', 'pending'];

async function assertGuestHasActiveStayAtHotel(req, hotelIdStr) {
  if (req.user.role !== 'guest' && req.user.role !== 'travel_agent') return;
  const allowed = await Booking.exists({
    userId: req.user._id,
    hotelId: hotelIdStr,
    status: { $in: MEETUP_ACTIVE_BOOKING_STATUSES },
    checkOut: { $gte: new Date() }
  });
  if (!allowed) {
    throw new ApplicationError('No active stay at the requested property', 403);
  }
}

/**
 * Resolve property scope for meet-up partner search.
 * Guests often have no User.hotelId; use active Booking.hotelId when needed.
 */
async function resolveMeetUpScopedHotelIdForPartners(req) {
  const requested = refToHotelIdString(req.query?.hotelId);
  const fromUser = refToHotelIdString(req.user?.hotelId || req.user?.hotel);

  if (requested) {
    await assertGuestHasActiveStayAtHotel(req, requested);
    return requested;
  }

  if (fromUser) return fromUser;

  if (req.user.role === 'guest' || req.user.role === 'travel_agent') {
    const booking = await Booking.findOne({
      userId: req.user._id,
      status: { $in: MEETUP_ACTIVE_BOOKING_STATUSES },
      checkOut: { $gte: new Date() }
    })
      .sort({ checkIn: -1 })
      .select('hotelId')
      .lean();
    if (booking?.hotelId) return refToHotelIdString(booking.hotelId);
  }

  return null;
}

/**
 * Resolve hotel for creating a meet-up (guests: prefer active booking, then profile hotel).
 */
async function resolveMeetUpHotelIdForCreate(req) {
  const bodyHotel = refToHotelIdString(req.body?.hotelId);
  const fromUser = refToHotelIdString(req.user?.hotelId || req.user?.hotel);

  let resolved = null;

  if (req.user.role === 'guest' || req.user.role === 'travel_agent') {
    const booking = await Booking.findOne({
      userId: req.user._id,
      status: { $in: MEETUP_ACTIVE_BOOKING_STATUSES },
      checkOut: { $gte: new Date() }
    })
      .sort({ checkIn: -1 })
      .select('hotelId')
      .lean();
    resolved = (booking?.hotelId && refToHotelIdString(booking.hotelId)) || fromUser;
  } else {
    resolved = fromUser;
  }

  if (!resolved) {
    return null;
  }

  if (bodyHotel && bodyHotel !== resolved) {
    throw new ApplicationError('Invalid hotel context for meet-up request', 403);
  }

  return resolved;
}

// Apply authentication, tenant isolation, and property access to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('meetUpRequests', 'baseAccess'));

// ============= ADMIN ROUTES (Place first to avoid conflicts) =============
// Admin/Staff/Frontdesk: Get all meet-up requests across the system
router.get('/admin/all', authorize('admin', 'staff', 'frontdesk'), catchAsync(async (req, res) => {
  const {
    status,
    type,
    hotelId,
    dateFrom,
    dateTo,
    search
  } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  // Mandatory hotel filtering for tenant isolation
  const resolvedHotelId = (hotelId && hotelId !== 'all') ? hotelId : (req.body.hotelId || req.user?.hotelId);
  if (!resolvedHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  let query = {};
  query.hotelId = resolvedHotelId;

  // Filter by status
  if (status && status !== 'all') query.status = status;

  // Filter by type
  if (type && type !== 'all') query.type = type;

  // Filter by date range
  if (dateFrom || dateTo) {
    query.proposedDate = {};
    if (dateFrom) query.proposedDate.$gte = new Date(dateFrom);
    if (dateTo) query.proposedDate.$lte = new Date(dateTo);
  }

  // Search in title, description, or user names
  if (search) {
    const escapedSearch = escapeRegex(search);
    query.$or = [
      { title: { $regex: escapedSearch, $options: 'i' } },
      { description: { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  const meetUps = attachVirtualsToList(await MeetUpRequest.find(query)
    .populate('requesterId', 'name email avatar role')
    .populate('targetUserId', 'name email avatar role')
    .populate('hotelId', 'name address')
    .populate('meetingRoomBooking.roomId', 'number type')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit).lean());

  const total = await MeetUpRequest.countDocuments(query);

  res.json({
    success: true,
    data: {
      meetUps,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + meetUps.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Admin/Staff/Frontdesk: Get system-wide meet-up insights
router.get('/admin/insights', authorize('admin', 'staff', 'frontdesk'), catchAsync(async (req, res) => {
  const { hotelId } = req.query;

  // Mandatory hotel filtering for tenant isolation
  const resolvedInsightsHotelId = (hotelId && hotelId !== 'all') ? hotelId : (req.body.hotelId || req.user?.hotelId);
  if (!resolvedInsightsHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  let baseQuery = {};
  baseQuery.hotelId = resolvedInsightsHotelId;

  // Get various insights
  const [
    totalUsers,
    activeUsers,
    riskMeetUps,
    frequentRequesters,
    underperformingHotels,
    safetyStats
  ] = await Promise.all([
    // Total users who have used meet-up feature
    MeetUpRequest.distinct('requesterId', baseQuery).then(ids => ids.length),

    // Active users (last 30 days)
    MeetUpRequest.distinct('requesterId', {
      ...baseQuery,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).then(ids => ids.length),

    // Potentially risky meet-ups (declined multiple times, safety concerns)
    MeetUpRequest.find({
      ...baseQuery,
      $or: [
        { status: 'declined' },
        { 'safety.verifiedOnly': false, 'safety.publicLocation': false }
      ]
    }).populate('requesterId', 'name email').populate('targetUserId', 'name email').sort({ createdAt: -1 }).limit(50).lean(),

    // Users with excessive requests
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$requesterId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 10 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $project: { userName: { $arrayElemAt: ['$user.name', 0] }, requestCount: '$count' } },
      { $sort: { requestCount: -1 } }
    ]),

    // Hotels with low acceptance rates
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$hotelId',
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }
        }
      },
      {
        $project: {
          total: 1,
          accepted: 1,
          acceptanceRate: { $divide: ['$accepted', '$total'] }
        }
      },
      { $match: { total: { $gt: 5 }, acceptanceRate: { $lt: 0.5 } } },
      { $lookup: { from: 'hotels', localField: '_id', foreignField: '_id', as: 'hotel' } },
      { $project: { hotelName: { $arrayElemAt: ['$hotel.name', 0] }, acceptanceRate: 1, total: 1 } }
    ]),

    // Safety preferences statistics
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          verifiedOnly: { $sum: { $cond: ['$safety.verifiedOnly', 1, 0] } },
          publicLocation: { $sum: { $cond: ['$safety.publicLocation', 1, 0] } },
          hotelStaffPresent: { $sum: { $cond: ['$safety.hotelStaffPresent', 1, 0] } }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    data: {
      userEngagement: {
        totalUsers,
        activeUsers,
        engagementRate: totalUsers > 0 ? (activeUsers / totalUsers * 100) : 0
      },
      riskAssessment: {
        potentiallyRiskyMeetUps: riskMeetUps.length,
        frequentRequesters: frequentRequesters.length,
        riskyMeetUpDetails: riskMeetUps.slice(0, 10) // Limit to 10 for performance
      },
      hotelPerformance: {
        underperformingHotels
      },
      safetyInsights: safetyStats[0] || {
        totalRequests: 0,
        verifiedOnly: 0,
        publicLocation: 0,
        hotelStaffPresent: 0
      }
    }
  });
}));

// Admin/Staff/Frontdesk: Get comprehensive analytics
router.get('/admin/analytics', authorize('admin', 'staff', 'frontdesk'), catchAsync(async (req, res) => {
  const { period = '30d', hotelId } = req.query;

  // Calculate date range based on period
  const periodMap = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365
  };

  const days = periodMap[period] || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Mandatory hotel filtering for tenant isolation
  const resolvedAnalyticsHotelId = (hotelId && hotelId !== 'all') ? hotelId : (req.body.hotelId || req.user?.hotelId);
  if (!resolvedAnalyticsHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  let baseQuery = { createdAt: { $gte: startDate } };
  baseQuery.hotelId = resolvedAnalyticsHotelId;

  // Parallel execution of analytics queries
  const [
    totalRequests,
    statusStats,
    typeStats,
    hotelStats,
    dailyTrends,
    topUsers,
    responseTimeStats,
    completionRate,
    popularLocations,
    peakTimes
  ] = await Promise.all([
    // Total requests in period
    MeetUpRequest.countDocuments(baseQuery),

    // Status breakdown
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Type breakdown
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Hotel breakdown
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$hotelId', count: { $sum: 1 } } },
      { $lookup: { from: 'hotels', localField: '_id', foreignField: '_id', as: 'hotel' } },
      { $project: { hotelName: { $arrayElemAt: ['$hotel.name', 0] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),

    // Daily trends
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          requests: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      },
      { $sort: { '_id': 1 } }
    ]),

    // Top active users
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$requesterId',
          requestsSent: { $sum: 1 }
        }
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $project: { userName: { $arrayElemAt: ['$user.name', 0] }, requestsSent: 1 } },
      { $sort: { requestsSent: -1 } },
      { $limit: 10 }
    ]),

    // Response time statistics
    MeetUpRequest.aggregate([
      {
        $match: {
          ...baseQuery,
          'response.respondedAt': { $exists: true }
        }
      },
      {
        $project: {
          responseTime: {
            $divide: [
              { $subtract: ['$response.respondedAt', '$createdAt'] },
              3600000 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' }
        }
      }
    ]),

    // Completion rate
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          declined: { $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] } }
        }
      }
    ]),

    // Popular locations
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$location.type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),

    // Peak times analysis
    MeetUpRequest.aggregate([
      { $match: baseQuery },
      {
        $project: {
          hour: { $hour: '$createdAt' },
          dayOfWeek: { $dayOfWeek: '$createdAt' }
        }
      },
      {
        $group: {
          _id: { hour: '$hour', dayOfWeek: '$dayOfWeek' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  // Calculate rates
  const completionStats = completionRate[0] || { total: 0, accepted: 0, completed: 0, declined: 0 };
  const acceptanceRate = completionStats.total > 0 ? (completionStats.accepted / completionStats.total * 100) : 0;
  const declineRate = completionStats.total > 0 ? (completionStats.declined / completionStats.total * 100) : 0;
  const completionRatePercent = completionStats.accepted > 0 ? (completionStats.completed / completionStats.accepted * 100) : 0;

  res.json({
    success: true,
    data: {
      summary: {
        totalRequests,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        declineRate: Math.round(declineRate * 100) / 100,
        completionRate: Math.round(completionRatePercent * 100) / 100,
        avgResponseTime: responseTimeStats[0]?.avgResponseTime || 0
      },
      breakdown: {
        status: statusStats,
        type: typeStats,
        hotels: hotelStats,
        locations: popularLocations
      },
      trends: {
        daily: dailyTrends,
        peakTimes: peakTimes
      },
      users: {
        topRequesters: topUsers
      },
      period,
      generatedAt: new Date()
    }
  });
}));

// Admin/Staff/Frontdesk: List guest meet-up reports for a property
router.get('/admin/guest-meetup-reports', authorize('admin', 'staff', 'frontdesk', 'manager'), catchAsync(async (req, res) => {
  const { status } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  // Tenant isolation: require hotelId
  const resolvedHotelId = req.query.hotelId || req.user?.hotelId;
  if (!resolvedHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  const query = { hotelId: resolvedHotelId };
  if (status && status !== 'all') {
    if (!['pending', 'reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status filter' });
    }
    query.status = status;
  }

  const [reports, total] = await Promise.all([
    GuestMeetUpReport.find(query)
      .populate('reporterId', 'name email')
      .populate('reportedUserId', 'name email')
      .populate('meetUpRequestId', 'title status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    GuestMeetUpReport.countDocuments(query)
  ]);

  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  res.json({
    success: true,
    data: {
      reports,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// Admin/Staff/Frontdesk: Force cancel any meet-up request
router.post('/admin/:requestId/force-cancel', authorize('admin', 'staff', 'frontdesk'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  // Tenant isolation: resolve hotel context
  const resolvedCancelHotelId = req.body.hotelId || req.user?.hotelId;
  const existingRequest = await MeetUpRequest.findById(req.params.requestId).lean();

  if (!existingRequest) {
    throw new ApplicationError('Meet-up request not found', 404);
  }

  // Verify the meet-up belongs to the admin's hotel
  if (resolvedCancelHotelId && existingRequest.hotelId?.toString() !== resolvedCancelHotelId.toString()) {
    throw new ApplicationError('Meet-up request not found', 404);
  }

  // Validate status transition
  const transition = validateStatusTransition(MEETUP_TRANSITIONS, existingRequest.status, 'cancelled');
  if (!transition.valid) {
    throw new ApplicationError(transition.error, 400);
  }

  // Atomic update: set status and admin action
  const meetUpRequest = await MeetUpRequest.findByIdAndUpdate(
    req.params.requestId,
    {
      $set: {
        status: 'cancelled',
        adminAction: {
          action: 'force_cancelled',
          adminId: req.user._id,
          reason: reason || 'Cancelled by administrator',
          timestamp: new Date()
        }
      }
    },
    { new: true, runValidators: true }
  );

  // Populate for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email' },
    { path: 'targetUserId', select: 'name email' },
    { path: 'hotelId', select: 'name' }
  ]);

  // Notify both guests about the admin cancellation
  const forceCancelHotelId = meetUpRequest.hotelId?._id || meetUpRequest.hotelId;
  const cancelMessage = 'Your meet-up was cancelled by hotel management.';
  try {
    const requesterId = meetUpRequest.requesterId?._id || meetUpRequest.requesterId;
    if (requesterId) {
      await deliverMeetUpGuestNotification({
        hotelId: forceCancelHotelId,
        recipientId: requesterId,
        type: 'meetup_cancelled',
        title: 'Meet-up cancelled',
        message: cancelMessage,
        meetUpRequestId: meetUpRequest._id
      });
    }
    const targetUserId = meetUpRequest.targetUserId?._id || meetUpRequest.targetUserId;
    if (targetUserId) {
      await deliverMeetUpGuestNotification({
        hotelId: forceCancelHotelId,
        recipientId: targetUserId,
        type: 'meetup_cancelled',
        title: 'Meet-up cancelled',
        message: cancelMessage,
        meetUpRequestId: meetUpRequest._id
      });
    }
  } catch (notifErr) {
    logger.warn('Failed to send force-cancel notifications:', notifErr.message);
  }

  // Auto-resolve any open supervision alert for this meet-up
  try {
    await meetUpSupervisionAlertService.updateAlertOnSupervisionChange(
      req.params.requestId,
      'cancelled',
      req.user._id
    );
  } catch (alertErr) {
    logger.warn('Failed to resolve supervision alert on force-cancel', {
      meetUpId: req.params.requestId,
      error: alertErr.message
    });
  }

  res.json({
    success: true,
    message: 'Meet-up request forcefully cancelled',
    data: meetUpRequest
  });
}));

// ============= USER ROUTES =============
// Get all meet-up requests for the authenticated user
router.get('/', catchAsync(async (req, res) => {
  const { status, type, filter, search } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  // Resolve the scoped hotel for the requesting user.
  // Guests often don't have hotelId on their user record; fall back to their active booking.
  const scopedHotelId = await resolveMeetUpScopedHotelIdForPartners(req);
  if (!scopedHotelId) {
    return res.json({
      success: true,
      data: {
        meetUps: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0, hasNext: false, hasPrev: false }
      }
    });
  }

  let query = {
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id },
      { 'participants.confirmedParticipants.userId': req.user._id }
    ],
    hotelId: scopedHotelId
  };

  if (status) query.status = status;
  if (type) query.type = type;

  // Filter by role (sent vs received)
  if (filter === 'sent') {
    query = { requesterId: req.user._id, hotelId: scopedHotelId };
    if (status) query.status = status;
    if (type) query.type = type;
  } else if (filter === 'received') {
    query = { targetUserId: req.user._id, hotelId: scopedHotelId };
    if (status) query.status = status;
    if (type) query.type = type;
  } else if (filter === 'participating') {
    query = { 'participants.confirmedParticipants.userId': req.user._id, hotelId: scopedHotelId };
    if (status) query.status = status;
    if (type) query.type = type;
  }

  // Text search in title and description
  if (search) {
    const escapedSearch = escapeRegex(search);
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } }
      ]
    });
  }

  const meetUps = attachVirtualsToList(await MeetUpRequest.find(query)
    .populate('requesterId', 'name email avatar')
    .populate('targetUserId', 'name email avatar')
    .populate('hotelId', 'name address')
    .populate('meetingRoomBooking.roomId', 'number type')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit).lean());

  const total = await MeetUpRequest.countDocuments(query);

  res.json({
    success: true,
    data: {
      meetUps,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + meetUps.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Get pending requests (requests sent to the user)
router.get('/pending', catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  // Resolve hotel — guests may not have hotelId on their profile
  const pendingScopedHotelId = await resolveMeetUpScopedHotelIdForPartners(req);
  if (!pendingScopedHotelId) {
    return res.json({
      success: true,
      data: {
        pendingRequests: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0, hasNext: false, hasPrev: false }
      }
    });
  }
  const pendingQuery = {
    targetUserId: req.user._id,
    status: 'pending',
    hotelId: pendingScopedHotelId
  };

  const pendingRequests = attachVirtualsToList(
    await MeetUpRequest.find(pendingQuery)
      .populate('requesterId', 'name email avatar')
      .populate('hotelId', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
  );

  const total = await MeetUpRequest.countDocuments(pendingQuery);

  res.json({
    success: true,
    data: {
      pendingRequests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + pendingRequests.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Get upcoming meet-ups
router.get('/upcoming', catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  // Resolve hotel — guests may not have hotelId on their profile
  const upcomingScopedHotelId = await resolveMeetUpScopedHotelIdForPartners(req);
  if (!upcomingScopedHotelId) {
    return res.json({
      success: true,
      data: {
        upcomingMeetUps: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0, hasNext: false, hasPrev: false }
      }
    });
  }
  const upcomingQuery = {
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id },
      { 'participants.confirmedParticipants.userId': req.user._id }
    ],
    status: 'accepted',
    proposedDate: { $gt: new Date() },
    hotelId: upcomingScopedHotelId
  };

  const upcomingMeetUps = attachVirtualsToList(
    await MeetUpRequest.find(upcomingQuery)
      .populate('requesterId', 'name email avatar')
      .populate('targetUserId', 'name email avatar')
      .populate('hotelId', 'name address')
      .populate('meetingRoomBooking.roomId', 'number type')
      .sort({ proposedDate: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
  );

  const total = await MeetUpRequest.countDocuments(upcomingQuery);

  res.json({
    success: true,
    data: {
      upcomingMeetUps,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + upcomingMeetUps.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Must be registered before /:requestId — otherwise "search" is captured as an id
router.get('/guest/feature-status', catchAsync(async (req, res) => {
  const hotelId = await resolveMeetUpHotelIdForCreate(req);
  if (!hotelId) {
    return res.json({
      success: true,
      data: { meetUpsEnabled: false, hotelId: null, reason: 'no_active_stay' }
    });
  }
  const settings = await HotelSettings.findOne({ hotelId }).select('guestExperience').lean();
  const meetUpsEnabled = settings?.guestExperience?.meetUpsEnabled !== false;
  res.json({
    success: true,
    data: {
      meetUpsEnabled,
      hotelId,
      reason: meetUpsEnabled ? undefined : 'disabled_by_property'
    }
  });
}));

router.get('/search/partners', meetUpPartnerSearchLimiter, catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const scopeHotelId = await resolveMeetUpScopedHotelIdForPartners(req);
  if (!scopeHotelId) {
    throw new ApplicationError(
      'Hotel context required. Book a stay (or sign in with a property-linked account) to find partners.',
      400
    );
  }

  await maybeAssertGuestMeetUpsEnabled(req, scopeHotelId);

  const now = new Date();
  const peerUserIds = await Booking.distinct('userId', {
    hotelId: scopeHotelId,
    userId: { $ne: req.user._id },
    status: { $in: MEETUP_ACTIVE_BOOKING_STATUSES },
    checkOut: { $gte: now }
  });

  const peerIdStrings = [...new Set(
    peerUserIds
      .map((id) => (id && id.toString ? id.toString() : String(id)))
      .filter((id) => id && id !== req.user._id.toString())
  )];

  const blockedPeerIds = await getMeetUpBlockedPeerIds(scopeHotelId, req.user._id);
  const blockedSet = new Set(blockedPeerIds);
  const visiblePeerIds = peerIdStrings.filter((id) => !blockedSet.has(id));

  const userQuery = {
    _id: { $in: visiblePeerIds },
    role: { $in: ['guest', 'travel_agent'] }
  };

  const total = await User.countDocuments(userQuery);
  const users = await User.find(userQuery)
    .select('name avatar')
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: page,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
        totalItems: total,
        hasNext: skip + users.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

router.get('/stats/overview', catchAsync(async (req, res) => {
  // Guests may not have hotelId on their profile; resolve from active booking
  const userHotelId = req.user.hotelId || (await resolveMeetUpScopedHotelIdForPartners(req));
  const stats = await MeetUpRequest.getMeetUpStats(req.user._id, userHotelId);

  const [
    totalRequests,
    pendingRequests,
    acceptedRequests,
    completedRequests,
    upcomingMeetUps
  ] = await Promise.all([
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      hotelId: userHotelId
    }),
    MeetUpRequest.countDocuments({
      targetUserId: req.user._id,
      status: 'pending',
      hotelId: userHotelId
    }),
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'accepted',
      hotelId: userHotelId
    }),
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'completed',
      hotelId: userHotelId
    }),
    MeetUpRequest.countDocuments({
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'accepted',
      proposedDate: { $gt: new Date() },
      hotelId: userHotelId
    })
  ]);

  res.json({
    success: true,
    data: {
      totalRequests,
      pendingRequests,
      acceptedRequests,
      completedRequests,
      upcomingMeetUps,
      statusBreakdown: stats
    }
  });
}));

// Guest safety: list peer user IDs hidden due to block (either direction)
router.get('/my-blocks', catchAsync(async (req, res) => {
  const hotelId = await resolveMeetUpHotelIdForCreate(req);
  if (!hotelId) {
    return res.json({ success: true, data: { blockedUserIds: [], hotelId: null } });
  }
  const blockedUserIds = await getMeetUpBlockedPeerIds(hotelId, req.user._id);
  res.json({ success: true, data: { blockedUserIds, hotelId } });
}));

router.post('/report', meetUpWriteLimiter, validate(schemas.meetUpReport), catchAsync(async (req, res) => {
  const { reportedUserId, meetUpRequestId, reason, details } = req.body;
  if (String(reportedUserId) === String(req.user._id)) {
    throw new ApplicationError('Invalid report', 400);
  }

  const reported = await User.findById(reportedUserId).lean();
  if (!reported || !['guest', 'travel_agent'].includes(reported.role)) {
    throw new ApplicationError('Report target not found', 404);
  }

  const hotelId = await resolveMeetUpHotelIdForCreate(req);
  if (!hotelId) {
    throw new ApplicationError('Hotel context required to submit a report', 400);
  }

  const now = new Date();
  const stayQuery = {
    hotelId,
    status: { $in: MEETUP_ACTIVE_BOOKING_STATUSES },
    checkOut: { $gte: now }
  };
  const [reporterStay, reportedStay] = await Promise.all([
    Booking.exists({ ...stayQuery, userId: req.user._id }),
    Booking.exists({ ...stayQuery, userId: reportedUserId })
  ]);
  if (!reporterStay || !reportedStay) {
    throw new ApplicationError(
      'Reports can only be filed when both you and the reported guest have an active stay at this property',
      403
    );
  }

  if (meetUpRequestId) {
    const mu = await MeetUpRequest.findOne({
      _id: meetUpRequestId,
      hotelId,
      $or: [
        { requesterId: req.user._id, targetUserId: reportedUserId },
        { requesterId: reportedUserId, targetUserId: req.user._id }
      ]
    }).lean();
    if (!mu) {
      throw new ApplicationError('Meet-up context does not match this guest', 400);
    }
  }

  const report = await GuestMeetUpReport.create({
    hotelId,
    reporterId: req.user._id,
    reportedUserId,
    meetUpRequestId: meetUpRequestId || undefined,
    reason,
    details: details || ''
  });

  try {
    await createAndDeliverToHotelOps(hotelId, {
      type: 'system_alert',
      title: 'Guest meet-up report',
      message: `Reason: ${reason}. Reporter: ${req.user?.name || 'Guest'}. Reported: ${reported.name || 'Guest'}.${
        details ? ` Details: ${String(details).slice(0, 200)}` : ''
      }`,
      priority: 'high',
      metadata: {
        category: 'system',
        tags: ['meetup', 'report', String(report._id)]
      }
    });
  } catch (e) {
    logger.warn('meet-up ops alert for report failed', { error: e.message });
  }

  logger.info('meetup.report', {
    hotelId: String(hotelId),
    reportId: String(report._id),
    reporterId: String(req.user._id),
    reportedUserId: String(reportedUserId)
  });

  res.status(201).json({
    success: true,
    message: 'Report submitted. Property staff have been notified.',
    data: { id: report._id }
  });
}));

router.post('/blocks/:targetUserId', meetUpWriteLimiter, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { targetUserId } = req.params;
  if (String(targetUserId) === String(req.user._id)) {
    throw new ApplicationError('Cannot block yourself', 400);
  }
  const other = await User.findById(targetUserId).lean();
  if (!other || !['guest', 'travel_agent'].includes(other.role)) {
    throw new ApplicationError('User not found', 404);
  }
  const hotelId = await resolveMeetUpHotelIdForCreate(req);
  if (!hotelId) {
    throw new ApplicationError('Hotel context required', 400);
  }
  await GuestMeetUpBlock.findOneAndUpdate(
    { hotelId, blockerUserId: req.user._id, blockedUserId: targetUserId },
    { $setOnInsert: { hotelId, blockerUserId: req.user._id, blockedUserId: targetUserId } },
    { upsert: true }
  );
  logger.info('meetup.block', { hotelId: String(hotelId), blocker: String(req.user._id), blocked: String(targetUserId) });
  res.json({ success: true, message: 'Guest blocked for meet-ups at this property' });
}));

router.delete('/blocks/:targetUserId', meetUpWriteLimiter, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { targetUserId } = req.params;
  const hotelId = await resolveMeetUpHotelIdForCreate(req);
  if (!hotelId) {
    throw new ApplicationError('Hotel context required', 400);
  }
  await GuestMeetUpBlock.deleteOne({
    hotelId,
    blockerUserId: req.user._id,
    blockedUserId: targetUserId
  });
  res.json({ success: true, message: 'Block removed' });
}));

// Create a new meet-up request
router.post('/', meetUpWriteLimiter, validate(schemas.createMeetUpRequest), catchAsync(async (req, res) => {
  let body = { ...req.body };

  const targetUser = await User.findById(body.targetUserId).lean();
  if (!targetUser) {
    throw new ApplicationError('Target user not found', 404);
  }

  const resolvedHotelId = await resolveMeetUpHotelIdForCreate(req);
  if (!resolvedHotelId) {
    throw new ApplicationError(
      'Hotel context required. Use an active booking at a property to create meet-ups.',
      400
    );
  }

  const hotel = await Hotel.findById(resolvedHotelId).lean();
  if (!hotel) {
    throw new ApplicationError('Hotel not found', 404);
  }

  await maybeAssertGuestMeetUpsEnabled(req, resolvedHotelId);

  const hotelSettingsDoc = await HotelSettings.getOrCreateForHotel(resolvedHotelId);
  const settingsObj =
    typeof hotelSettingsDoc.toObject === 'function' ? hotelSettingsDoc.toObject() : hotelSettingsDoc;
  await assertNotInMeetUpQuietHours(settingsObj);

  body = moderateMeetUpCreateBody(body, settingsObj.guestExperience || {});

  const {
    targetUserId,
    hotelId,
    type,
    title,
    description,
    proposedDate,
    proposedTime,
    location,
    meetingRoomBooking,
    participants,
    preferences,
    communication,
    activity,
    safety,
    metadata
  } = body;

  await assertUnderPendingMeetUpCap(
    resolvedHotelId,
    req.user._id,
    settingsObj.guestExperience?.maxPendingInvitesPerGuest
  );
  await assertMeetUpNotBlocked(resolvedHotelId, req.user._id, targetUserId);

  // Check if meeting room booking is required and valid
  if (meetingRoomBooking && meetingRoomBooking.isRequired) {
    if (!meetingRoomBooking.roomId) {
      throw new ApplicationError('Meeting room is required', 400);
    }
    
    const room = await Room.findById(meetingRoomBooking.roomId).lean();
    if (!room) {
      throw new ApplicationError('Meeting room not found', 404);
    }
  }
  
  // Check if user is trying to meet with themselves
  if (targetUserId.toString() === req.user._id.toString()) {
    throw new ApplicationError('Cannot create meet-up request with yourself', 400);
  }

  if (!['guest', 'travel_agent'].includes(targetUser.role)) {
    throw new ApplicationError('Meet-up invites are only available to guest accounts', 400);
  }

  const targetHasCoLocatedStay = await Booking.exists({
    userId: targetUserId,
    hotelId: resolvedHotelId,
    status: { $in: MEETUP_ACTIVE_BOOKING_STATUSES },
    checkOut: { $gte: new Date() }
  });
  if (!targetHasCoLocatedStay) {
    throw new ApplicationError(
      'That guest does not have an active stay at this property',
      400
    );
  }
  
  // Check if there's already a pending request between these users
  const existingRequest = await MeetUpRequest.findOne({
    $or: [
      { requesterId: req.user._id, targetUserId },
      { requesterId: targetUserId, targetUserId: req.user._id }
    ],
    status: 'pending'
  }).lean();
  
  if (existingRequest) {
    throw new ApplicationError('A pending meet-up request already exists between these users', 400);
  }
  
  const meetUpRequest = new MeetUpRequest({
    requesterId: req.user._id,
    targetUserId,
    hotelId: resolvedHotelId,
    type,
    title,
    description,
    proposedDate: new Date(proposedDate),
    proposedTime,
    location,
    meetingRoomBooking,
    participants: {
      maxParticipants: participants?.maxParticipants || 2,
      confirmedParticipants: []
    },
    preferences,
    communication,
    activity,
    safety,
    metadata
  });
  
  await meetUpRequest.save();
  
  // Populate references for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email avatar' },
    { path: 'targetUserId', select: 'name email avatar' },
    { path: 'hotelId', select: 'name address' },
    { path: 'meetingRoomBooking.roomId', select: 'number type' }
  ]);

  const requesterName = req.user?.name || 'A guest';
  await deliverMeetUpGuestNotification({
    hotelId: resolvedHotelId,
    recipientId: targetUserId,
    type: 'meetup_invite',
    title: 'New meet-up invite',
    message: `${requesterName} invited you: ${title}`,
    meetUpRequestId: meetUpRequest._id
  });
  await broadcastMeetUpUpdate([targetUserId, req.user._id], {
    action: 'created',
    meetUpRequestId: meetUpRequest._id.toString()
  });
  
  res.status(201).json({
    success: true,
    message: 'Meet-up request created successfully',
    data: meetUpRequest
  });
}));

// Get a specific meet-up request
router.get('/:requestId', catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const meetUpRequest = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id },
      { 'participants.confirmedParticipants.userId': req.user._id }
    ]
  })
  .populate('requesterId', 'name email avatar')
  .populate('targetUserId', 'name email avatar')
  .populate('hotelId', 'name address')
  .populate('meetingRoomBooking.roomId', 'number type')
  .populate('participants.confirmedParticipants.userId', 'name email avatar').lean();

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found', 404);
  }

  attachVirtuals(meetUpRequest);
  
  res.json({
    success: true,
    data: meetUpRequest
  });
}));

// Accept a meet-up request
router.post('/:requestId/accept', meetUpWriteLimiter, validate(schemas.respondToMeetUpRequest), catchAsync(async (req, res) => {
  const { message } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
    {
      _id: req.params.requestId,
      targetUserId: req.user._id,
      status: 'pending'
    },
    {
      $set: {
        status: 'accepted',
        'response.message': message,
        'response.respondedAt': new Date()
      }
    },
    { new: true, runValidators: true }
  );

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be accepted', 404);
  }

  // Populate references for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email avatar' },
    { path: 'targetUserId', select: 'name email avatar' },
    { path: 'hotelId', select: 'name address' }
  ]);

  const hid = meetUpRequest.hotelId?._id || meetUpRequest.hotelId;
  const requesterRecipient = meetUpRequest.requesterId?._id || meetUpRequest.requesterId;
  const accepterName = req.user?.name || 'A guest';
  await deliverMeetUpGuestNotification({
    hotelId: hid,
    recipientId: requesterRecipient,
    type: 'meetup_accepted',
    title: 'Meet-up accepted',
    message: `${accepterName} accepted: ${meetUpRequest.title}`,
    meetUpRequestId: meetUpRequest._id
  });
  await broadcastMeetUpUpdate([requesterRecipient, req.user._id], {
    action: 'accepted',
    meetUpRequestId: meetUpRequest._id.toString()
  });

  res.json({
    success: true,
    message: 'Meet-up request accepted successfully',
    data: meetUpRequest
  });
}));

// Decline a meet-up request
router.post('/:requestId/decline', meetUpWriteLimiter, validate(schemas.respondToMeetUpRequest), catchAsync(async (req, res) => {
  const { message } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
    {
      _id: req.params.requestId,
      targetUserId: req.user._id,
      status: 'pending'
    },
    {
      $set: {
        status: 'declined',
        'response.message': message,
        'response.respondedAt': new Date()
      }
    },
    { new: true, runValidators: true }
  );

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be declined', 404);
  }

  // Populate references for response
  await meetUpRequest.populate([
    { path: 'requesterId', select: 'name email avatar' },
    { path: 'targetUserId', select: 'name email avatar' },
    { path: 'hotelId', select: 'name address' }
  ]);

  const hidDecl = meetUpRequest.hotelId?._id || meetUpRequest.hotelId;
  const requesterRecipientDecl = meetUpRequest.requesterId?._id || meetUpRequest.requesterId;
  const declinerName = req.user?.name || 'A guest';
  await deliverMeetUpGuestNotification({
    hotelId: hidDecl,
    recipientId: requesterRecipientDecl,
    type: 'meetup_declined',
    title: 'Meet-up declined',
    message: `${declinerName} declined: ${meetUpRequest.title}`,
    meetUpRequestId: meetUpRequest._id
  });
  await broadcastMeetUpUpdate([requesterRecipientDecl, req.user._id], {
    action: 'declined',
    meetUpRequestId: meetUpRequest._id.toString()
  });

  res.json({
    success: true,
    message: 'Meet-up request declined successfully',
    data: meetUpRequest
  });
}));

// Cancel a meet-up request
router.post('/:requestId/cancel', meetUpWriteLimiter, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
    {
      _id: req.params.requestId,
      requesterId: req.user._id,
      status: { $in: ['pending', 'accepted'] }
    },
    { $set: { status: 'cancelled' } },
    { new: true }
  );

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be cancelled', 404);
  }

  const tid = meetUpRequest.targetUserId?._id || meetUpRequest.targetUserId;
  const hidCan = meetUpRequest.hotelId?._id || meetUpRequest.hotelId;
  const cancellerName = req.user?.name || 'A guest';
  await deliverMeetUpGuestNotification({
    hotelId: hidCan,
    recipientId: tid,
    type: 'meetup_cancelled',
    title: 'Meet-up cancelled',
    message: `${cancellerName} cancelled: ${meetUpRequest.title || 'the meet-up'}`,
    meetUpRequestId: meetUpRequest._id
  });
  await broadcastMeetUpUpdate([tid, req.user._id], {
    action: 'cancelled',
    meetUpRequestId: meetUpRequest._id.toString()
  });

  // Auto-resolve any open supervision alert for this meet-up
  try {
    await meetUpSupervisionAlertService.updateAlertOnSupervisionChange(
      meetUpRequest._id.toString(),
      'cancelled',
      req.user._id
    );
  } catch (alertErr) {
    logger.warn('Failed to resolve supervision alert on cancellation', {
      meetUpId: meetUpRequest._id,
      error: alertErr.message
    });
  }

  res.json({
    success: true,
    message: 'Meet-up request cancelled successfully'
  });
}));

// Complete a meet-up request
router.post('/:requestId/complete', meetUpWriteLimiter, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
    {
      _id: req.params.requestId,
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'accepted'
    },
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true }
  );

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot be completed', 404);
  }

  const hidCmp = meetUpRequest.hotelId?._id || meetUpRequest.hotelId;

  const myId = req.user._id.toString();
  const reqId = meetUpRequest.requesterId?.toString?.() || String(meetUpRequest.requesterId);
  const otherId = reqId === myId
    ? (meetUpRequest.targetUserId?.toString?.() || String(meetUpRequest.targetUserId))
    : reqId;
  await deliverMeetUpGuestNotification({
    hotelId: hidCmp,
    recipientId: otherId,
    type: 'meetup_completed',
    title: 'Meet-up completed',
    message: `${req.user?.name || 'A guest'} marked completed: ${meetUpRequest.title}`,
    meetUpRequestId: meetUpRequest._id
  });
  await broadcastMeetUpUpdate([otherId, req.user._id], {
    action: 'completed',
    meetUpRequestId: meetUpRequest._id.toString()
  });

  res.json({
    success: true,
    message: 'Meet-up request marked as completed'
  });
}));

// Add participant to a meet-up
router.post('/:requestId/participants', meetUpWriteLimiter, validate(schemas.addParticipant), catchAsync(async (req, res) => {
  const { userId, name, email } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const prePart = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id }
    ],
    status: 'accepted'
  })
    .select('hotelId')
    .lean();
  if (!prePart) {
    throw new ApplicationError('Meet-up request not found or cannot add participants', 404);
  }
  await maybeAssertGuestMeetUpsEnabled(req, prePart.hotelId);

  const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
    {
      _id: req.params.requestId,
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'accepted'
    },
    {
      $push: {
        'participants.confirmedParticipants': {
          userId,
          name,
          email,
          joinedAt: new Date()
        }
      }
    },
    { new: true }
  );

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot add participants', 404);
  }

  res.json({
    success: true,
    message: 'Participant added successfully'
  });
}));

// Remove participant from a meet-up
router.delete('/:requestId/participants/:userId', meetUpWriteLimiter, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const preRm = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    $or: [
      { requesterId: req.user._id },
      { targetUserId: req.user._id }
    ],
    status: 'accepted'
  })
    .select('hotelId')
    .lean();
  if (preRm) {
    await maybeAssertGuestMeetUpsEnabled(req, preRm.hotelId);
  }

  const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
    {
      _id: req.params.requestId,
      $or: [
        { requesterId: req.user._id },
        { targetUserId: req.user._id }
      ],
      status: 'accepted'
    },
    {
      $pull: {
        'participants.confirmedParticipants': { userId: req.params.userId }
      }
    },
    { new: true }
  );

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot remove participants', 404);
  }

  res.json({
    success: true,
    message: 'Participant removed successfully'
  });
}));

// Suggest alternative time/date
router.post('/:requestId/suggest-alternative', meetUpWriteLimiter, validate(schemas.suggestAlternative), catchAsync(async (req, res) => {
  const { date, time } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    throw new ApplicationError('Meet-up request not found', 404);
  }
  const preAlt = await MeetUpRequest.findOne({
    _id: req.params.requestId,
    targetUserId: req.user._id,
    status: 'pending'
  })
    .select('hotelId')
    .lean();
  if (!preAlt) {
    throw new ApplicationError('Meet-up request not found or cannot suggest alternative', 404);
  }
  await maybeAssertGuestMeetUpsEnabled(req, preAlt.hotelId);

  const meetUpRequest = await MeetUpRequest.findOneAndUpdate(
    {
      _id: req.params.requestId,
      targetUserId: req.user._id,
      status: 'pending'
    },
    {
      $set: {
        'alternativeSuggestion.date': new Date(date),
        'alternativeSuggestion.time': time,
        'alternativeSuggestion.suggestedBy': req.user._id,
        'alternativeSuggestion.suggestedAt': new Date()
      }
    },
    { new: true }
  );

  if (!meetUpRequest) {
    throw new ApplicationError('Meet-up request not found or cannot suggest alternative', 404);
  }

  res.json({
    success: true,
    message: 'Alternative time suggested successfully'
  });
}));


export default router;
