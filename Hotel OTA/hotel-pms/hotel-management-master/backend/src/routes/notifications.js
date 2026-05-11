import express from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import NotificationTemplate from '../models/NotificationTemplate.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import Joi from 'joi';
import { notificationEmitter } from '../services/notificationEmitter.js';
import websocketService from '../services/websocketService.js';
import optimizedNotificationService from '../services/optimizedNotificationService.js';
import rateLimiter from '../services/rateLimiter.js';
import logger from '../utils/logger.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication, tenant isolation, and property access middleware to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('notifications', 'baseAccess'));

// GET /api/v1/notifications - Get user notifications with pagination and filters
router.get('/', catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    priority,
    search,
    unreadOnly = false,
    readOnly = false,
    propertyId
  } = req.query;
  const userId = req.user._id;
  const hotelId = propertyId || req.user.hotelId;

  // Enforce max limit to prevent unbounded queries
  const safeLimit = Math.min(parseInt(limit) || 20, 100);

  // Build query with tenant isolation
  const query = { userId };
  if (hotelId) {
    query.hotelId = hotelId;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (type) {
    query.type = type;
  }

  if (priority) {
    query.priority = priority;
  }

  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { message: { $regex: escaped, $options: 'i' } }
    ];
  }
  
  if (unreadOnly === 'true') {
    query.status = { $in: ['sent', 'delivered'] };
    query.readAt = { $exists: false };
  }

  if (readOnly === 'true') {
    query.readAt = { $exists: true };
  }
  
  // Calculate pagination
  const safePage = Math.max(1, parseInt(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  // Calculate today's start (for todayCount)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get notifications with populated metadata
  const [notifications, total, unreadCount, totalCount, todayCount, urgentCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('metadata.bookingId', 'bookingNumber checkIn checkOut roomNumber')
      .populate('metadata.serviceBookingId', 'bookingDate numberOfPeople serviceId')
      .populate('metadata.paymentId', 'amount currency status')
      .populate('metadata.loyaltyTransactionId', 'points type description')
      .lean(),

    // Get total count for pagination (filtered)
    Notification.countDocuments(query),

    // Get unread count with tenant isolation
    Notification.getUnreadCount(userId, hotelId),

    // Get total count (all notifications for user in this hotel, unfiltered)
    Notification.countDocuments(hotelId ? { userId, hotelId } : { userId }),

    // Get today's count (notifications created today for this user)
    (() => {
      const todayQuery = { userId, createdAt: { $gte: todayStart } };
      if (hotelId) todayQuery.hotelId = hotelId;
      return Notification.countDocuments(todayQuery);
    })(),

    // Get urgent unread count (urgent priority notifications not yet read)
    (() => {
      const urgentQuery = {
        userId,
        priority: 'urgent',
        readAt: { $exists: false }
      };
      if (hotelId) urgentQuery.hotelId = hotelId;
      return Notification.countDocuments(urgentQuery);
    })()
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      notifications,
      pagination: {
        currentPage: safePage,
        totalPages: Math.ceil(total / safeLimit),
        totalItems: total,
        itemsPerPage: safeLimit
      },
      // Top-level aliases expected by the frontend
      totalPages: Math.ceil(total / safeLimit),
      unreadCount,
      totalCount,
      todayCount,
      urgentCount
    }
  });
}));

// GET /api/v1/notifications/unread-count - Get unread notification count
router.get('/unread-count', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const unreadCount = await Notification.getUnreadCount(userId, hotelId);

  res.status(200).json({
    status: 'success',
    data: { unreadCount }
  });
}));

// GET /api/v1/notifications/summary - Get notification summary by category
router.get('/summary', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const userRole = req.user.role;
  const hotelId = req.user.hotelId;

  // Build base match filter with tenant isolation
  const baseMatch = { userId };
  if (hotelId) {
    baseMatch.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  // Get unread count
  const unreadCount = await Notification.getUnreadCount(userId, hotelId);

  // Get priority counts
  const priorityCounts = await Notification.aggregate([
    {
      $match: {
        ...baseMatch,
        readAt: { $exists: false }
      }
    },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);

  const priorityMap = priorityCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, { urgent: 0, high: 0, medium: 0, low: 0 });

  // Get category counts
  const categoryCounts = await Notification.aggregate([
    {
      $match: {
        ...baseMatch,
        readAt: { $exists: false }
      }
    },
    {
      $group: {
        _id: '$metadata.category',
        count: { $sum: 1 }
      }
    }
  ]);

  const categoryMap = categoryCounts.reduce((acc, item) => {
    if (item._id) {
      acc[item._id] = item.count;
    }
    return acc;
  }, {
    booking: 0,
    payment: 0,
    service: 0,
    system: 0,
    ...(userRole === 'staff' && { maintenance: 0, inventory: 0 })
  });

  // Get recent activity
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [todayCount, weekCount, lastNotification] = await Promise.all([
    Notification.countDocuments({
      ...baseMatch,
      createdAt: { $gte: todayStart }
    }),
    Notification.countDocuments({
      ...baseMatch,
      createdAt: { $gte: weekStart }
    }),
    Notification.findOne(baseMatch).sort({ createdAt: -1 }).select('createdAt').lean()
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount,
      priorityCounts: priorityMap,
      categoryCounts: categoryMap,
      recentActivity: {
        todayCount,
        weekCount,
        lastNotification: lastNotification?.createdAt
      }
    }
  });
}));

// GET /api/v1/notifications/personal-overview - Get personal notification overview
router.get('/personal-overview', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const hotelId = req.user.hotelId;
  const { timeRange = 7 } = req.query;

  // Build base match filter with tenant isolation
  const baseMatch = { userId };
  if (hotelId) {
    baseMatch.hotelId = new mongoose.Types.ObjectId(hotelId);
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));

  // Get basic stats
  const [totalSent, totalRead, urgentCount] = await Promise.all([
    Notification.countDocuments({
      ...baseMatch,
      createdAt: { $gte: startDate }
    }),
    Notification.countDocuments({
      ...baseMatch,
      readAt: { $exists: true },
      createdAt: { $gte: startDate }
    }),
    Notification.countDocuments({
      ...baseMatch,
      priority: 'urgent',
      createdAt: { $gte: startDate }
    })
  ]);

  // Get today's stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todaySent, todayRead] = await Promise.all([
    Notification.countDocuments({
      ...baseMatch,
      createdAt: { $gte: todayStart }
    }),
    Notification.countDocuments({
      ...baseMatch,
      readAt: { $exists: true, $gte: todayStart }
    })
  ]);

  const todayReadRate = todaySent > 0 ? (todayRead / todaySent * 100) : 0;

  // Get weekly trend (simplified)
  const weeklyTrend = await Notification.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        sent: { $sum: 1 },
        read: {
          $sum: {
            $cond: [{ $ne: ['$readAt', null] }, 1, 0]
          }
        },
        urgent: {
          $sum: {
            $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0]
          }
        }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  // Get top categories
  const topCategories = await Notification.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$metadata.category',
        count: { $sum: 1 },
        readCount: {
          $sum: {
            $cond: [{ $ne: ['$readAt', null] }, 1, 0]
          }
        }
      }
    },
    {
      $addFields: {
        readRate: {
          $cond: [
            { $gt: ['$count', 0] },
            { $multiply: [{ $divide: ['$readCount', '$count'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // Calculate average response time (simplified)
  const responseTimeResult = await Notification.aggregate([
    {
      $match: {
        ...baseMatch,
        readAt: { $exists: true },
        createdAt: { $gte: startDate }
      }
    },
    {
      $addFields: {
        responseTime: {
          $divide: [
            { $subtract: ['$readAt', '$createdAt'] },
            1000 * 60 // Convert to minutes
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgResponseTime: { $avg: '$responseTime' }
      }
    }
  ]);

  const averageResponseTime = responseTimeResult[0]?.avgResponseTime || 0;

  res.status(200).json({
    status: 'success',
    data: {
      totalSent,
      totalRead,
      totalUnread: totalSent - totalRead,
      urgentCount,
      todayStats: {
        sent: todaySent,
        read: todayRead,
        readRate: todayReadRate
      },
      weeklyTrend: weeklyTrend.map(day => ({
        date: day._id,
        sent: day.sent,
        read: day.read,
        urgent: day.urgent
      })),
      topCategories: topCategories.map(cat => ({
        category: cat._id || 'uncategorized',
        count: cat.count,
        readRate: cat.readRate
      })),
      averageResponseTime
    }
  });
}));

// Legacy summary endpoint - keeping for backward compatibility
router.get('/summary-legacy', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  // Build base query with tenant isolation
  const baseQuery = { userId };
  if (hotelId) {
    baseQuery.hotelId = hotelId;
  }

  // Get counts by category
  const [bookingCount, paymentCount, serviceCount, systemCount] = await Promise.all([
    Notification.countDocuments({
      ...baseQuery,
      'metadata.category': 'booking',
      readAt: { $exists: false }
    }),
    Notification.countDocuments({
      ...baseQuery,
      'metadata.category': 'payment',
      readAt: { $exists: false }
    }),
    Notification.countDocuments({
      ...baseQuery,
      'metadata.category': 'service',
      readAt: { $exists: false }
    }),
    Notification.countDocuments({
      ...baseQuery,
      'metadata.category': 'system',
      readAt: { $exists: false }
    })
  ]);

  // Get recent notifications
  const recentNotifications = await Notification.find(baseQuery)
    .sort({ createdAt: -1 })
    .limit(5)
    .select('type title message createdAt readAt priority').lean();

  res.status(200).json({
    status: 'success',
    data: {
      summary: {
        booking: bookingCount,
        payment: paymentCount,
        service: serviceCount,
        system: systemCount,
        total: bookingCount + paymentCount + serviceCount + systemCount
      },
      recent: recentNotifications
    }
  });
}));

// GET /api/v1/notifications/preferences - Get user notification preferences
router.get('/preferences', catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  
  // Get user to access hotelId
  const user = await User.findById(userId).lean();
  if (!user) {
    return next(new ApplicationError('User not found', 404));
  }
  
  // For guests, hotelId is optional, so we'll use a default or null
  const hotelId = user.hotelId || null;
  
  // Get or create preferences
  const preferences = await NotificationPreference.getOrCreate(userId, hotelId);
  
  // Update email and SMS from user profile if not set
  if (!preferences.email.address && user.email) {
    preferences.email.address = user.email;
  }
  
  // Only set SMS number if user has a valid phone number
  if (!preferences.sms.number && user.phone && user.phone.trim()) {
    // Validate phone number format before setting
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (phoneRegex.test(user.phone.replace(/\s/g, ''))) {
      preferences.sms.number = user.phone;
    }
  }
  
  if (preferences.isModified()) {
    await preferences.save();
  }
  
  res.status(200).json({
    status: 'success',
    data: { preferences }
  });
}));

// GET /api/v1/notifications/types - Get available notification types for user's role
router.get('/types', catchAsync(async (req, res, next) => {
  // Import notification categories
  const { getNotificationsForRole, getCategoriesForRole } = await import('../config/notificationCategories.js');

  const userRole = req.user.role;
  const roleNotifications = getNotificationsForRole(userRole);
  const categories = getCategoriesForRole(userRole);

  const notificationTypes = Object.entries(roleNotifications).map(([type, config]) => ({
    type,
    label: config.description,
    description: config.description,
    category: config.category,
    priority: config.priority,
    channels: config.channels,
    defaultEnabled: true
  }));

  // If no role-specific types, fall back to generic types
  if (notificationTypes.length === 0) {
    const fallbackTypes = [
      {
        type: 'booking_confirmation',
        label: 'Booking Confirmation',
        description: 'Notifications when your booking is confirmed',
        category: 'booking',
        defaultEnabled: true
      },
    {
      type: 'booking_reminder',
      label: 'Booking Reminder',
      description: 'Reminders about upcoming bookings',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'booking_cancellation',
      label: 'Booking Cancellation',
      description: 'Notifications when bookings are cancelled',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'payment_success',
      label: 'Payment Success',
      description: 'Confirmations for successful payments',
      category: 'payment',
      defaultEnabled: true
    },
    {
      type: 'payment_failed',
      label: 'Payment Failed',
      description: 'Alerts for failed payment attempts',
      category: 'payment',
      defaultEnabled: true
    },
    {
      type: 'loyalty_points',
      label: 'Loyalty Points',
      description: 'Updates about loyalty points earned or redeemed',
      category: 'loyalty',
      defaultEnabled: true
    },
    {
      type: 'service_booking',
      label: 'Service Booking',
      description: 'Confirmations for hotel service bookings',
      category: 'service',
      defaultEnabled: true
    },
    {
      type: 'service_reminder',
      label: 'Service Reminder',
      description: 'Reminders about scheduled services',
      category: 'service',
      defaultEnabled: true
    },
    {
      type: 'promotional',
      label: 'Promotional',
      description: 'Special offers and promotions',
      category: 'promotional',
      defaultEnabled: true
    },
    {
      type: 'system_alert',
      label: 'System Alert',
      description: 'Important system notifications',
      category: 'system',
      defaultEnabled: true
    },
    {
      type: 'welcome',
      label: 'Welcome',
      description: 'Welcome messages and onboarding',
      category: 'system',
      defaultEnabled: true
    },
    {
      type: 'check_in',
      label: 'Check-in',
      description: 'Check-in related notifications',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'check_out',
      label: 'Check-out',
      description: 'Check-out related notifications',
      category: 'booking',
      defaultEnabled: true
    },
    {
      type: 'review_request',
      label: 'Review Request',
      description: 'Requests to review your stay',
      category: 'system',
      defaultEnabled: true
    },
    {
      type: 'special_offer',
      label: 'Special Offer',
      description: 'Exclusive offers and deals',
      category: 'promotional',
      defaultEnabled: true
    }
    ];

    res.status(200).json({
      status: 'success',
      data: {
        notificationTypes: fallbackTypes,
        categories: []
      }
    });
    return;
  }

  res.status(200).json({
    status: 'success',
    data: {
      notificationTypes,
      categories,
      role: userRole,
      totalTypes: notificationTypes.length
    }
  });
}));

// GET /api/v1/notifications/channels - Get available notification channels with role-based defaults
router.get('/channels', catchAsync(async (req, res, next) => {
  // Import notification categories for priority levels
  const { priorityLevels } = await import('../config/notificationCategories.js');

  const channels = [
    {
      id: 'in_app',
      name: 'In-App',
      description: 'Receive notifications within the application',
      icon: 'smartphone',
      defaultEnabled: true,
      supportsQuietHours: false,
      supportsFrequency: false,
      instantDelivery: true,
      supportedPriorities: ['urgent', 'high', 'medium', 'low']
    },
    {
      id: 'push',
      name: 'Push Notifications',
      description: 'Receive notifications on your device',
      icon: 'bell',
      defaultEnabled: true,
      supportsQuietHours: true,
      supportsFrequency: false,
      instantDelivery: true,
      supportedPriorities: ['urgent', 'high', 'medium']
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Receive notifications via email',
      icon: 'mail',
      defaultEnabled: true,
      supportsQuietHours: true,
      supportsFrequency: true,
      instantDelivery: false,
      supportedPriorities: ['urgent', 'high', 'medium', 'low']
    },
    {
      id: 'sms',
      name: 'SMS',
      description: 'Receive notifications via text message',
      icon: 'message-circle',
      defaultEnabled: false,
      supportsQuietHours: true,
      supportsFrequency: false,
      instantDelivery: true,
      supportedPriorities: ['urgent', 'high'],
      requiresPhoneNumber: true
    }
  ];

  // Add role-specific channel recommendations
  const roleChannelRecommendations = {
    admin: ['in_app', 'email', 'sms'],
    manager: ['in_app', 'email', 'sms'],
    staff: ['in_app', 'push'],
    housekeeping: ['in_app', 'push'],
    maintenance: ['in_app', 'push', 'sms'],
    guest: ['in_app', 'email', 'push']
  };

  const userRole = req.user.role;
  const recommendedChannels = roleChannelRecommendations[userRole] || ['in_app', 'email'];

  // Enhance channels with role-specific recommendations
  const enhancedChannels = channels.map(channel => ({
    ...channel,
    recommended: recommendedChannels.includes(channel.id)
  }));

  res.status(200).json({
    status: 'success',
    data: {
      channels: enhancedChannels,
      priorityLevels,
      roleRecommendations: recommendedChannels,
      role: userRole
    }
  });
}));

// GET /api/v1/notifications/:id - Get specific notification
router.get('/:id([0-9a-fA-F]{24})', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const findQuery = { _id: id, userId };
  if (hotelId) {
    findQuery.hotelId = hotelId;
  }

  const notification = await Notification.findOne(findQuery)
    .populate('metadata.bookingId', 'bookingNumber checkIn checkOut roomNumber')
    .populate('metadata.serviceBookingId', 'bookingDate numberOfPeople serviceId')
    .populate('metadata.paymentId', 'amount currency status')
    .populate('metadata.loyaltyTransactionId', 'points type description').lean();

  if (!notification) {
    return next(new ApplicationError('Notification not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { notification }
  });
}));

// PATCH /api/v1/notifications/:id/read - Mark notification as read
router.patch('/:id([0-9a-fA-F]{24})/read', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const findQuery = { _id: id, userId };
  if (hotelId) {
    findQuery.hotelId = hotelId;
  }

  const notification = await Notification.findOne(findQuery);

  if (!notification) {
    return next(new ApplicationError('Notification not found', 404));
  }

  await notification.markAsRead();
  const notificationId = notification._id.toString();

  try {
    const readPayload = {
      type: 'notification_read',
      id: notificationId,
      _id: notificationId,
      notificationId,
      readAt: notification.readAt || new Date().toISOString()
    };
    notificationEmitter.emit(`user:${userId}`, readPayload);
    await websocketService.sendToUser(userId, 'notification:read', readPayload);
  } catch (emitError) {
    logger.warn('Failed to emit notification read event', {
      userId: userId?.toString?.() || String(userId),
      notificationId,
      error: emitError.message
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Notification marked as read'
  });
}));

// POST /api/v1/notifications/mark-read - Mark multiple notifications as read
router.post('/mark-read', validate(schemas.markNotificationsRead), catchAsync(async (req, res, next) => {
  const { notificationIds } = req.body;
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const result = await Notification.markAsRead(userId, notificationIds, hotelId);
  if (result.modifiedCount > 0) {
    try {
      const readPayload = {
        type: 'notification_read',
        notificationIds,
        count: result.modifiedCount
      };
      notificationEmitter.emit(`user:${userId}`, {
        ...readPayload,
        id: notificationIds?.[0]
      });
      await websocketService.sendToUser(userId, 'notifications:bulk-update', {
        ...readPayload,
        action: 'read'
      });
    } catch (emitError) {
      logger.warn('Failed to emit bulk notification read event', {
        userId: userId?.toString?.() || String(userId),
        count: result.modifiedCount,
        error: emitError.message
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    message: `${result.modifiedCount} notifications marked as read`,
    data: { modifiedCount: result.modifiedCount }
  });
}));

// POST /api/v1/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const result = await Notification.markAllAsRead(userId, hotelId);
  if (result.modifiedCount > 0) {
    try {
      const readPayload = {
        type: 'notification_read',
        count: result.modifiedCount,
        markAll: true
      };
      notificationEmitter.emit(`user:${userId}`, readPayload);
      await websocketService.sendToUser(userId, 'notifications:bulk-update', {
        ...readPayload,
        action: 'read'
      });
    } catch (emitError) {
      logger.warn('Failed to emit mark-all notification read event', {
        userId: userId?.toString?.() || String(userId),
        count: result.modifiedCount,
        error: emitError.message
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    message: `${result.modifiedCount} notifications marked as read`,
    data: { modifiedCount: result.modifiedCount }
  });
}));

// DELETE /api/v1/notifications/:id - Delete notification
router.delete('/:id([0-9a-fA-F]{24})', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const deleteQuery = { _id: id, userId };
  if (hotelId) {
    deleteQuery.hotelId = hotelId;
  }

  const notification = await Notification.findOneAndDelete(deleteQuery);
  
  if (!notification) {
    return next(new ApplicationError('Notification not found', 404));
  }

  const notificationId = notification._id.toString();
  try {
    const deletedPayload = {
      type: 'notification_deleted',
      id: notificationId,
      _id: notificationId,
      notificationId
    };
    notificationEmitter.emit(`user:${userId}`, deletedPayload);
    await websocketService.sendToUser(userId, 'notification:deleted', deletedPayload);
  } catch (emitError) {
    logger.warn('Failed to emit notification deleted event', {
      userId: userId?.toString?.() || String(userId),
      notificationId,
      error: emitError.message
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Notification deleted successfully'
  });
}));

// PATCH /api/v1/notifications/preferences - Update notification preferences
router.patch('/preferences', validate(schemas.updateNotificationPreferences), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { channel, settings } = req.body;
  
  const preferences = await NotificationPreference.updateChannelSettings(userId, channel, settings);
  
  res.status(200).json({
    status: 'success',
    message: 'Notification preferences updated successfully',
    data: { preferences }
  });
}));

// PATCH /api/v1/notifications/preferences/:channel/:type - Update specific notification type setting
router.patch('/preferences/:channel/:type', validate(schemas.updateNotificationType), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { channel, type } = req.params;
  const { enabled } = req.body;
  
  const preferences = await NotificationPreference.updateTypeSettings(userId, channel, type, enabled);
  
  res.status(200).json({
    status: 'success',
    message: 'Notification type setting updated successfully',
    data: { preferences }
  });
}));

// POST /api/v1/notifications/send - Admin sends notification to guest(s)
router.post('/send', authorizePolicy('notifications', 'manageAccess'), catchAsync(async (req, res, next) => {
  const { recipientIds, title, message, type, priority, channels } = req.body;

  if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return res.status(400).json({ status: 'error', message: 'At least one recipient is required' });
  }
  if (recipientIds.length > 100) {
    return res.status(400).json({ status: 'error', message: 'Maximum 100 recipients per send' });
  }
  if (!title || !message) {
    return res.status(400).json({ status: 'error', message: 'Title and message are required' });
  }

  const hotelId = req.user.hotelId;
  const notifications = [];

  for (const recipientId of recipientIds) {
    const notification = await Notification.create({
      userId: recipientId,
      hotelId,
      title,
      message,
      type: type || 'admin_message',
      priority: priority || 'medium',
      channels: channels || ['in_app'],
      metadata: {
        sentBy: req.user._id,
        sentByName: req.user.name,
        category: 'system'
      }
    });
    notifications.push(notification);

    // Send real-time notification
    try {
      await websocketService.sendToUser(recipientId.toString(), 'notification:new', notification);
    } catch (emitError) {
      logger.warn('Failed to emit send notification event', {
        recipientId,
        error: emitError.message
      });
    }
  }

  res.json({
    status: 'success',
    message: `Notification sent to ${notifications.length} recipient(s)`,
    data: { count: notifications.length }
  });
}));

// POST /api/v1/notifications/test - Send test notification
router.post('/test', validate(schemas.sendTestNotification), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { channel, type } = req.body;

  // Get user preferences
  const preferences = await NotificationPreference.findOne({ userId }).lean();
  if (!preferences) {
    return next(new ApplicationError('Notification preferences not found', 404));
  }

  // Check if channel is enabled
  if (!preferences[channel] || !preferences[channel].enabled) {
    return next(new ApplicationError(`${channel} notifications are not enabled`, 400));
  }

  // Create test notification
  const testNotification = new Notification({
    userId,
    hotelId: preferences.hotelId,
    type: type || 'system_alert',
    title: 'Test Notification',
    message: 'This is a test notification to verify your settings.',
    channels: [channel],
    priority: 'medium',
    metadata: {
      category: 'system',
      tags: ['test']
    }
  });

  await testNotification.save();

  // Mark as sent and emit real-time event for in-app delivery
  await testNotification.markAsSent(channel);

  const { deliverInAppNotificationToUser } = await import('../services/inAppNotificationDeliveryService.js');
  await deliverInAppNotificationToUser(testNotification);

  res.status(200).json({
    status: 'success',
    message: 'Test notification sent successfully',
    data: { notification: testNotification }
  });
}));

// POST /api/v1/notifications/subscribe - Subscribe to notification types
router.post('/subscribe', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { subscriptions } = req.body;

  if (!subscriptions || typeof subscriptions !== 'object') {
    throw new ApplicationError('Subscriptions object is required', 400);
  }

  // Get or create preferences
  const preferences = await NotificationPreference.getOrCreate(userId, req.user.hotelId);

  // Update subscription settings
  Object.keys(subscriptions).forEach(channel => {
    if (preferences[channel]) {
      Object.assign(preferences[channel], subscriptions[channel]);
    }
  });

  await preferences.save();

  res.status(200).json({
    status: 'success',
    message: 'Subscriptions updated successfully',
    data: { preferences }
  });
}));

// SSE notification stream - DEPRECATED
// All real-time notifications now use Socket.IO at /ws/notifications
router.get('/stream',
  authenticate,
  (req, res) => {
    res.status(410).json({
      status: 'deprecated',
      message: 'SSE notification stream has been deprecated. Use Socket.IO at /ws/notifications for real-time notifications.',
      alternative: '/ws/notifications'
    });
  }
);

// DELETE /api/v1/notifications/bulk - Delete multiple notifications
router.delete('/bulk', validate(schemas.deleteNotifications), catchAsync(async (req, res, next) => {
  const { notificationIds } = req.body;
  const userId = req.user._id;
  const hotelId = req.user.hotelId;

  const deleteQuery = {
    _id: { $in: notificationIds },
    userId
  };
  if (hotelId) {
    deleteQuery.hotelId = hotelId;
  }

  const result = await Notification.deleteMany(deleteQuery);
  if (result.deletedCount > 0) {
    try {
      const deletedPayload = {
        type: 'notification_deleted',
        notificationIds,
        count: result.deletedCount
      };
      notificationEmitter.emit(`user:${userId}`, {
        ...deletedPayload,
        id: notificationIds?.[0]
      });
      await websocketService.sendToUser(userId, 'notifications:bulk-update', {
        ...deletedPayload,
        action: 'deleted'
      });
    } catch (emitError) {
      logger.warn('Failed to emit bulk notification deleted event', {
        userId: userId?.toString?.() || String(userId),
        count: result.deletedCount,
        error: emitError.message
      });
    }
  }

  res.status(200).json({
    status: 'success',
    message: `${result.deletedCount} notifications deleted successfully`,
    data: { deletedCount: result.deletedCount }
  });
}));

// TEMPLATE MANAGEMENT ROUTES

// GET /api/v1/notifications/templates - Get all templates for hotel
router.get('/templates', catchAsync(async (req, res, next) => {
  const { category, type, search, limit = 20, page = 1 } = req.query;
  const hotelId = req.user.hotelId;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  const query = {
    hotelId,
    'metadata.isActive': true
  };

  if (category) {
    query.category = category;
  }

  if (type) {
    query.type = type;
  }

  let templates;

  if (search) {
    templates = await NotificationTemplate.search(hotelId, search)
      .skip(skip)
      .limit(parseInt(limit));
  } else {
    templates = await NotificationTemplate.find(query)
      .sort({ 'usage.timesUsed': -1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('metadata.createdBy', 'firstName lastName email')
      .populate('metadata.updatedBy', 'firstName lastName email').lean();
  }

  const total = await NotificationTemplate.countDocuments(query);

  res.status(200).json({
    status: 'success',
    data: {
      templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// GET /api/v1/notifications/templates/:id - Get specific template
router.get('/templates/:id', catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  })
    .populate('metadata.createdBy', 'firstName lastName email')
    .populate('metadata.updatedBy', 'firstName lastName email');

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

// POST /api/v1/notifications/templates - Create new template
router.post('/templates', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  // Check if user has admin role for template creation
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to create templates', 403);
  }

  const templateData = {
    ...req.body,
    hotelId,
    metadata: {
      createdBy: userId,
      isSystem: false
    }
  };

  const template = new NotificationTemplate(templateData);
  await template.save();

  await template.populate('metadata.createdBy', 'firstName lastName email');

  res.status(201).json({
    status: 'success',
    message: 'Template created successfully',
    data: { template }
  });
}));

// PATCH /api/v1/notifications/templates/:id - Update template
router.patch('/templates/:id', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to update templates', 403);
  }

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  });

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Don't allow updating system templates
  if (template.metadata.isSystem && req.user.role !== 'admin') {
    throw new ApplicationError('Cannot modify system templates', 403);
  }

  // Update template
  const updateData = {
    ...req.body,
    metadata: {
      ...template.metadata,
      updatedBy: userId,
      version: template.metadata.version + 1
    }
  };

  Object.assign(template, updateData);
  await template.save();

  await template.populate('metadata.updatedBy', 'firstName lastName email');

  res.status(200).json({
    status: 'success',
    message: 'Template updated successfully',
    data: { template }
  });
}));

// DELETE /api/v1/notifications/templates/:id - Delete (deactivate) template
router.delete('/templates/:id', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;

  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to delete templates', 403);
  }

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  });

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Don't allow deleting system templates
  if (template.metadata.isSystem && req.user.role !== 'admin') {
    throw new ApplicationError('Cannot delete system templates', 403);
  }

  // Soft delete by marking as inactive
  template.metadata.isActive = false;
  await template.save();

  res.status(200).json({
    status: 'success',
    message: 'Template deleted successfully'
  });
}));

// POST /api/v1/notifications/templates/:id/preview - Preview template with variables
router.post('/templates/:id/preview', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { variables = {} } = req.body;
  const hotelId = req.user.hotelId;

  const template = await NotificationTemplate.findOne({
    _id: id,
    hotelId,
    'metadata.isActive': true
  });

  if (!template) {
    throw new ApplicationError('Template not found', 404);
  }

  // Validate variables
  const validationErrors = template.validateVariables(variables);
  if (validationErrors.length > 0) {
    throw new ApplicationError('Variable validation failed', 400, { errors: validationErrors });
  }

  // Generate preview
  const preview = template.populateTemplate(variables);

  res.status(200).json({
    status: 'success',
    data: {
      preview,
      template: {
        name: template.name,
        description: template.description,
        variables: template.variables
      }
    }
  });
}));

// GET /api/v1/notifications/templates/categories/:category - Get templates by category
router.get('/templates/categories/:category', catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const hotelId = req.user.hotelId;

  const templates = await NotificationTemplate.getByCategory(hotelId, category);

  res.status(200).json({
    status: 'success',
    data: { templates }
  });
}));

// GET /api/v1/notifications/templates/types/:type - Get template by type
router.get('/templates/types/:type', catchAsync(async (req, res, next) => {
  const { type } = req.params;
  const hotelId = req.user.hotelId;

  const template = await NotificationTemplate.getByType(hotelId, type);

  if (!template) {
    throw new ApplicationError('No template found for this type', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { template }
  });
}));

// GET /api/v1/notifications/templates/analytics/performance - Get template performance stats
router.get('/templates/analytics/performance', catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view analytics', 403);
  }

  const performanceStats = await NotificationTemplate.getPerformanceStats(hotelId);

  // Get most used templates
  const mostUsed = await NotificationTemplate.getMostUsed(hotelId, 10);

  res.status(200).json({
    status: 'success',
    data: {
      performanceStats,
      mostUsed
    }
  });
}));

// POST /api/v1/notifications/templates/initialize - Initialize default templates for hotel
router.post('/templates/initialize', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  // Check permissions - only admin can initialize
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to initialize templates', 403);
  }

  // Check if templates already exist
  const existingCount = await NotificationTemplate.countDocuments({
    hotelId,
    'metadata.isActive': true
  });

  if (existingCount > 0) {
    throw new ApplicationError('Templates already initialized for this hotel', 400);
  }

  // Create default templates
  const templates = await NotificationTemplate.createDefaultTemplates(hotelId, userId);

  res.status(201).json({
    status: 'success',
    message: `${templates.length} default templates created successfully`,
    data: { templates }
  });
}));

// MONITORING AND PERFORMANCE ROUTES

// GET /api/v1/notifications/monitoring/health - Get system health status
router.get('/monitoring/health', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view monitoring data', 403);
  }

  const healthStatus = await optimizedNotificationService.getHealthStatus();

  res.status(200).json({
    status: 'success',
    data: healthStatus
  });
}));

// GET /api/v1/notifications/monitoring/performance - Get performance metrics
router.get('/monitoring/performance', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view performance data', 403);
  }

  const hotelId = req.user.hotelId;

  // Get various performance metrics
  const [volumeData, successRateData, channelData, recentActivity] = await Promise.all([
    // Volume data - last 24 hours
    Notification.aggregate([
      {
        $match: {
          hotelId,
          createdAt: {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%H:00',
              date: '$createdAt'
            }
          },
          sent: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'read']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          time: '$_id',
          sent: 1,
          delivered: 1
        }
      },
      { $sort: { time: 1 } }
    ]),

    // Success rate data - last 7 days
    Notification.aggregate([
      {
        $match: {
          hotelId,
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          total: { $sum: 1 },
          successful: {
            $sum: {
              $cond: [
                { $in: ['$status', ['delivered', 'read']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          time: '$_id',
          rate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$successful', '$total'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { time: 1 } }
    ]),

    // Channel distribution - last 7 days
    Notification.aggregate([
      {
        $match: {
          hotelId,
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $unwind: '$channels'
      },
      {
        $group: {
          _id: '$channels',
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          name: '$_id',
          value: 1,
          _id: 0
        }
      }
    ]),

    // Recent activity - last 50 notifications
    Notification.find({ hotelId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('type status channels metadata.templateName createdAt')
      .lean()
  ]);

  // Format recent activity
  const formattedActivity = recentActivity.map(notification => ({
    type: notification.type,
    status: notification.status,
    template: notification.metadata?.templateName || 'Unknown',
    channel: notification.channels?.[0] || 'unknown',
    timestamp: notification.createdAt
  }));

  res.status(200).json({
    status: 'success',
    data: {
      volumeData,
      successRateData,
      channelData,
      recentActivity: formattedActivity
    }
  });
}));

// GET /api/v1/notifications/monitoring/rate-limits - Get rate limit status
router.get('/monitoring/rate-limits', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view rate limit data', 403);
  }

  const hotelId = req.user.hotelId;
  const userId = req.user._id;

  const rateLimitStatus = await rateLimiter.getRateLimitStatus(hotelId, userId);

  res.status(200).json({
    status: 'success',
    data: rateLimitStatus
  });
}));

// POST /api/v1/notifications/monitoring/rate-limits/reset - Reset rate limits
router.post('/monitoring/rate-limits/reset', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  // Check permissions - only admin can reset rate limits
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to reset rate limits', 403);
  }

  const { type, identifier } = req.body;

  if (!type || !identifier) {
    throw new ApplicationError('Type and identifier are required', 400);
  }

  const success = await rateLimiter.resetRateLimits(type, identifier);

  if (!success) {
    throw new ApplicationError('Failed to reset rate limits', 500);
  }

  res.status(200).json({
    status: 'success',
    message: 'Rate limits reset successfully'
  });
}));

// GET /api/v1/notifications/monitoring/metrics - Get detailed metrics
router.get('/monitoring/metrics', catchAsync(async (req, res, next) => {
  // Check permissions
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApplicationError('Insufficient permissions to view metrics', 403);
  }

  const hotelId = req.user.hotelId;
  const { timeframe = '24h' } = req.query;

  let startDate;
  switch (timeframe) {
    case '1h':
      startDate = new Date(Date.now() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  const metrics = await Notification.aggregate([
    {
      $match: {
        hotelId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $facet: {
        // Total counts by status
        statusCounts: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ],

        // Counts by priority
        priorityCounts: [
          {
            $group: {
              _id: '$priority',
              count: { $sum: 1 }
            }
          }
        ],

        // Counts by type
        typeCounts: [
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],

        // Average response time
        responseTime: [
          {
            $match: {
              readAt: { $exists: true }
            }
          },
          {
            $addFields: {
              responseTime: {
                $divide: [
                  { $subtract: ['$readAt', '$createdAt'] },
                  1000 * 60 // Convert to minutes
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
        ]
      }
    }
  ]);

  // Get service statistics
  const serviceStats = optimizedNotificationService.getStatistics();

  // Get rate limiter metrics
  const rateLimiterMetrics = await rateLimiter.getMetrics();

  res.status(200).json({
    status: 'success',
    data: {
      timeframe,
      startDate,
      aggregations: metrics[0] || {},
      service: serviceStats,
      rateLimiter: rateLimiterMetrics
    }
  });
}));

// POST /api/v1/notifications/monitoring/cleanup - Trigger cleanup
router.post('/monitoring/cleanup', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  // Check permissions - only admin can trigger cleanup
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to trigger cleanup', 403);
  }

  const result = await optimizedNotificationService.cleanup();

  res.status(200).json({
    status: 'success',
    message: 'Cleanup completed successfully',
    data: result
  });
}));

// POST /api/v1/notifications/monitoring/flush-queue - Force flush notification queue
router.post('/monitoring/flush-queue', validate(mutationBaselineSchema), catchAsync(async (req, res, next) => {
  // Check permissions - only admin can flush queue
  if (req.user.role !== 'admin') {
    throw new ApplicationError('Insufficient permissions to flush queue', 403);
  }

  await optimizedNotificationService.flushQueue();

  res.status(200).json({
    status: 'success',
    message: 'Notification queue flushed successfully'
  });
}));

export default router;
