import userAnalyticsService from '../services/userAnalyticsService.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';
const TENANT_SCOPED_ROLES = ['admin', 'manager', 'staff', 'frontdesk'];

const buildTenantScopedUserFilter = (req, userId) => {
  const baseFilter = { _id: userId };
  if (TENANT_SCOPED_ROLES.includes(req.user.role)) {
    baseFilter.hotelId = req.user.hotelId;
  }
  return baseFilter;
};

const ensureUserBelongsToTenant = async (req, userId) => {
  const scopedUser = await User.findOne(buildTenantScopedUserFilter(req, userId))
    .select('_id')
    .lean();

  if (!scopedUser) {
    throw new ApplicationError('User not found', 404);
  }
};

// Get comprehensive user analytics
export const getUserAnalytics = catchAsync(async (req, res) => {
  const { dateRange, groupBy } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (groupBy) options.groupBy = groupBy;

  const analytics = await userAnalyticsService.getUserAnalytics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analytics
  });
});

// Get user activity metrics
export const getUserActivityMetrics = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const metrics = await userAnalyticsService.getUserActivityMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Get user performance metrics
export const getUserPerformanceMetrics = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const metrics = await userAnalyticsService.getUserPerformanceMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Get user segmentation
export const getUserSegmentation = catchAsync(async (req, res) => {
  const { segmentBy = 'role' } = req.query;
  
  const options = { segmentBy };
  const segmentation = await userAnalyticsService.getUserSegmentation(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: segmentation
  });
});

// Get user engagement metrics
export const getUserEngagementMetrics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const metrics = await userAnalyticsService.getUserEngagementMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Export analytics as CSV
export const exportAnalytics = catchAsync(async (req, res) => {
  const { dateRange, format = 'csv' } = req.query;

  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const analytics = await userAnalyticsService.getUserAnalytics(req.user.hotelId, options);

  if (format === 'csv') {
    const csvHeader = 'Metric,Value\n';
    const csvRows = [
      `Total Users,${analytics.totalUsers || 0}`,
      `Active Users,${analytics.activeUsers || 0}`,
      `Inactive Users,${analytics.inactiveUsers || 0}`,
      `Guests,${analytics.guests || 0}`,
      `Staff,${analytics.staff || 0}`,
      `Admins,${analytics.admins || 0}`,
      `Managers,${analytics.managers || 0}`,
      `Engagement Rate,${analytics.engagementRate || 0}%`,
      `Loyalty Rate,${analytics.loyaltyRate || 0}%`
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="user-analytics.csv"');
    return res.send(csvHeader + csvRows);
  }

  res.json({
    status: 'success',
    data: analytics
  });
});

// Get advanced user list with analytics
export const getAdvancedUserList = catchAsync(async (req, res) => {
  const {
    page: rawPage = '1',
    limit: rawLimit = '20',
    search,
    role,
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    dateRange,
    segmentBy
  } = req.query;

  const parsedPage = Math.max(1, parseInt(rawPage) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(rawLimit) || 20));

  const query = { hotelId: req.user.hotelId };

  // Apply filters
  if (role && role !== 'all') query.role = role;
  if (isActive !== undefined && isActive !== 'all') query.isActive = isActive === 'true';

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
      { phone: { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  // Date range filter
  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      query.createdAt = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const skip = (parsedPage - 1) * parsedLimit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  // Get users with activity data (limit $lookup to recent 100 activities for performance)
  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: 'auditlogs',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$user._id', '$$userId'] } } },
          { $sort: { timestamp: -1 } },
          { $limit: 100 }
        ],
        as: 'activities'
      }
    },
    {
      $addFields: {
        activityCount: { $size: '$activities' },
        lastActivity: { $max: '$activities.timestamp' },
        loginCount: {
          $size: {
            $filter: {
              input: '$activities',
              cond: { $eq: ['$$this.action', 'login'] }
            }
          }
        },
        daysSinceLastActivity: {
          $cond: [
            { $gt: [{ $size: '$activities' }, 0] },
            {
              $divide: [
                { $subtract: [new Date(), { $max: '$activities.timestamp' }] },
                1000 * 60 * 60 * 24
              ]
            },
            null
          ]
        }
      }
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: parsedLimit },
    {
      $project: {
        password: 0,
        passwordResetToken: 0,
        passwordResetExpires: 0
      }
    }
  ];

  const [users, total] = await Promise.all([
    User.aggregate(pipeline),
    User.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: users.length,
    pagination: {
      current: parsedPage,
      pages: Math.ceil(total / parsedLimit),
      total,
      limit: parsedLimit
    },
    data: { users }
  });
});

// Bulk user operations
export const bulkUserOperations = catchAsync(async (req, res) => {
  const { operation, userIds, data } = req.body;

  if (!operation || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ApplicationError('Operation, userIds array, and data are required', 400);
  }

  let result;
  const validUserIds = userIds.map(id => new mongoose.Types.ObjectId(id));

  switch (operation) {
    case 'activate':
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { isActive: true } }
      );
      break;

    case 'deactivate':
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { isActive: false } }
      );
      break;

    case 'updateRole':
      if (!data.role) {
        throw new ApplicationError('Role is required for updateRole operation', 400);
      }
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { role: data.role } }
      );
      break;

    case 'updateHotel':
      if (!data.hotelId) {
        throw new ApplicationError('Hotel ID is required for updateHotel operation', 400);
      }
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { hotelId: new mongoose.Types.ObjectId(data.hotelId) } }
      );
      break;

    case 'delete':
      // Soft delete to be consistent with single-user delete
      result = await User.updateMany(
        { _id: { $in: validUserIds }, hotelId: req.user.hotelId },
        { $set: { isActive: false } }
      );
      break;

    default:
      throw new ApplicationError('Invalid operation', 400);
  }

  res.json({
    status: 'success',
    data: {
      operation,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      deletedCount: result.deletedCount
    }
  });
});

// Import users from CSV/Excel
export const importUsers = catchAsync(async (req, res) => {
  const { usersData } = req.body;

  if (!Array.isArray(usersData) || usersData.length === 0) {
    throw new ApplicationError('Users data array is required', 400);
  }

  const results = {
    created: 0,
    updated: 0,
    errors: []
  };

  // Batch: check which users already exist in a single query
  const emails = usersData
    .filter(u => u.email)
    .map(u => String(u.email).toLowerCase());
  const existingUsers = await User.find({
    email: { $in: emails },
    hotelId: req.user.hotelId
  }).lean();
  const existingByEmail = new Map(existingUsers.map(u => [u.email, u]));

  const updateOps = [];
  const newUsers = [];

  for (const userData of usersData) {
    try {
      if (!userData.email || !userData.name) {
        results.errors.push({
          email: userData.email || 'unknown',
          error: 'Email and name are required'
        });
        continue;
      }

      const normalizedEmail = String(userData.email).toLowerCase();
      const existingUser = existingByEmail.get(normalizedEmail);

      if (existingUser) {
        const updateData = {
          name: userData.name,
          phone: userData.phone,
          role: userData.role || existingUser.role,
          isActive: userData.isActive !== undefined ? userData.isActive : existingUser.isActive
        };

        if (userData.role === 'staff' || userData.role === 'admin') {
          updateData.hotelId = req.user.hotelId;
        }

        updateOps.push({
          updateOne: {
            filter: { _id: existingUser._id, hotelId: req.user.hotelId },
            update: { $set: updateData }
          }
        });
        results.updated++;
      } else {
        // Create new user
        const newUserData = {
          name: userData.name,
          email: normalizedEmail,
          phone: userData.phone,
          password: userData.password || require('crypto').randomBytes(12).toString('base64url'),
          role: userData.role || 'guest',
          isActive: userData.isActive !== undefined ? userData.isActive : true
        };

        if (userData.role === 'staff' || userData.role === 'admin') {
          newUserData.hotelId = req.user.hotelId;
        }

        await User.create(newUserData);
        results.created++;
      }
    } catch (error) {
      results.errors.push({
        email: userData.email,
        error: error.message
      });
    }
  }

  // Batch: execute all updates with bulkWrite
  if (updateOps.length > 0) {
    await User.bulkWrite(updateOps);
  }

  res.json({
    status: 'success',
    data: results
  });
});

// Export users to CSV/Excel
export const exportUsers = catchAsync(async (req, res) => {
  const { format = 'json', filters = {} } = req.query;
  
  const query = { hotelId: req.user.hotelId };

  // Apply filters
  if (filters.role && filters.role !== 'all') query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive === 'true';

  const users = await User.find(query)
    .select('-password -passwordResetToken -passwordResetExpires')
    .populate('hotelId', 'name')
    .sort({ createdAt: -1 }).lean().limit(1000);

  if (format === 'csv') {
    const csvData = convertUsersToCSV(users);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send(csvData);
  } else {
    res.json({
      status: 'success',
      results: users.length,
      data: { users }
    });
  }
});

// Get user activity timeline
export const getUserActivityTimeline = catchAsync(async (req, res) => {
  const { userId, dateRange, limit = 50 } = req.query;

  if (!userId) {
    throw new ApplicationError('User ID is required', 400);
  }

  await ensureUserBelongsToTenant(req, userId);

  const matchStage = {
    'user._id': new mongoose.Types.ObjectId(userId)
  };

  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      matchStage.timestamp = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const activities = await AuditLog.find(matchStage)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .populate('user', 'name email role').lean();

  res.json({
    status: 'success',
    results: activities.length,
    data: { activities }
  });
});

// Get user performance report
export const getUserPerformanceReport = catchAsync(async (req, res) => {
  const { userId, dateRange } = req.query;

  if (!userId) {
    throw new ApplicationError('User ID is required', 400);
  }

  await ensureUserBelongsToTenant(req, userId);

  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const matchStage = { 'user._id': new mongoose.Types.ObjectId(userId) };
  if (options.dateRange) {
    matchStage.timestamp = {
      $gte: new Date(options.dateRange.start),
      $lte: new Date(options.dateRange.end)
    };
  }

  const [user, performanceMetrics, activities] = await Promise.all([
    User.findOne(buildTenantScopedUserFilter(req, userId)).select('-password'),
    userAnalyticsService.getUserPerformanceMetrics(req.user.hotelId, { ...options, userId }),
    AuditLog.find(matchStage).sort({ timestamp: -1 }).limit(50).lean()
  ]);

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      user,
      performanceMetrics,
      activityTimeline: activities
    }
  });
});

// Get user health monitoring
export const getUserHealthMonitoring = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const pipeline = [
    {
      $match: {
        hotelId: req.user.hotelId
      }
    },
    {
      $lookup: {
        from: 'auditlogs',
        localField: '_id',
        foreignField: 'user._id',
        as: 'activities'
      }
    },
    {
      $addFields: {
        lastActivity: { $max: '$activities.timestamp' },
        daysSinceLastActivity: {
          $cond: [
            { $gt: [{ $size: '$activities' }, 0] },
            {
              $divide: [
                { $subtract: [new Date(), { $max: '$activities.timestamp' }] },
                1000 * 60 * 60 * 24
              ]
            },
            null
          ]
        },
        activityCount: { $size: '$activities' }
      }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        inactiveUsers: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
        usersWithNoActivity: { $sum: { $cond: [{ $eq: ['$activityCount', 0] }, 1, 0] } },
        usersWithOldActivity: { $sum: { $cond: [{ $gt: ['$daysSinceLastActivity', 30] }, 1, 0] } },
        usersWithRecentActivity: { $sum: { $cond: [{ $lt: ['$daysSinceLastActivity', 7] }, 1, 0] } },
        healthIssues: {
          $push: {
            $cond: [
              {
                $or: [
                  { $eq: ['$isActive', false] },
                  { $eq: ['$activityCount', 0] },
                  { $gt: ['$daysSinceLastActivity', 30] }
                ]
              },
              {
                userId: '$_id',
                name: '$name',
                email: '$email',
                role: '$role',
                isActive: '$isActive',
                activityCount: '$activityCount',
                daysSinceLastActivity: '$daysSinceLastActivity',
                lastActivity: '$lastActivity'
              },
              null
            ]
          }
        }
      }
    }
  ];

  const result = await User.aggregate(pipeline);
  const healthData = result[0] || {
    totalUsers: 0,
    inactiveUsers: 0,
    usersWithNoActivity: 0,
    usersWithOldActivity: 0,
    usersWithRecentActivity: 0,
    healthIssues: []
  };

  // Filter out null values from health issues
  healthData.healthIssues = healthData.healthIssues.filter(issue => issue !== null);

  res.json({
    status: 'success',
    data: healthData
  });
});

// Update user billing details
export const updateUserBillingDetails = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const billingData = req.body;

  // Find user - guests can update their own billing, staff/admin can update any in their hotel
  let user;
  if (req.user.role === 'guest' && req.user._id.toString() !== userId) {
    throw new ApplicationError('You can only update your own billing details', 403);
  }

  if (req.user.role === 'guest') {
    user = await User.findOne({ _id: userId, hotelId: req.user.hotelId });
  } else {
    user = await User.findOne(buildTenantScopedUserFilter(req, userId));
  }

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  // Validate GST number if provided
  if (billingData.gstNumber && user.validateGSTNumber && !user.validateGSTNumber(billingData.gstNumber)) {
    throw new ApplicationError('Invalid GST number format', 400);
  }

  // Update billing details
  if (user.updateBillingDetails) {
    user.updateBillingDetails(billingData);
  } else {
    if (billingData) user.billingDetails = { ...user.billingDetails, ...billingData };
  }
  await user.save();

  res.json({
    status: 'success',
    message: 'Billing details updated successfully',
    data: {
      billingDetails: user.billingDetails,
      guestType: user.guestType
    }
  });
});

// Get user billing details
export const getUserBillingDetails = catchAsync(async (req, res) => {
  const { userId } = req.params;

  // Check permissions
  if (req.user.role === 'guest' && req.user._id.toString() !== userId) {
    throw new ApplicationError('You can only access your own billing details', 403);
  }

  let user;
  if (req.user.role === 'guest') {
    user = await User.findOne({ _id: userId, hotelId: req.user.hotelId }).select('name email billingDetails guestType');
  } else {
    user = await User.findOne(buildTenantScopedUserFilter(req, userId)).select('name email billingDetails guestType role');
  }

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        guestType: user.guestType,
        billingDetails: user.billingDetails,
        hasCompleteBillingInfo: user.hasCompleteBillingInfo ? user.hasCompleteBillingInfo() : false,
        formattedBillingAddress: user.getFormattedBillingAddress ? user.getFormattedBillingAddress() : ''
      }
    }
  });
});

// Update user profile (name, email, phone, guestType)
export const updateUserProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { name, email, phone, guestType } = req.body;

  // Check permissions
  if (req.user.role === 'guest' && req.user._id.toString() !== userId) {
    throw new ApplicationError('You can only update your own profile', 403);
  }

  let user;
  if (req.user.role === 'guest') {
    user = await User.findOne({ _id: userId, hotelId: req.user.hotelId });
  } else {
    user = await User.findOne(buildTenantScopedUserFilter(req, userId));
  }

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  // Update allowed fields
  if (name) user.name = name;
  if (email && email !== user.email) {
    // Check if email already exists
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      throw new ApplicationError('Email already exists', 400);
    }
    user.email = email;
  }
  if (phone) user.phone = phone;
  if (guestType) user.guestType = guestType;

  await user.save();

  res.json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        guestType: user.guestType
      }
    }
  });
});

// Validate GST number
export const validateGSTNumber = catchAsync(async (req, res) => {
  const { gstNumber } = req.body;

  if (!gstNumber) {
    throw new ApplicationError('GST number is required', 400);
  }

  const user = new User();
  const isValid = user.validateGSTNumber(gstNumber);

  res.json({
    status: 'success',
    data: {
      gstNumber,
      isValid,
      format: '22AAAAA0000A1Z5'
    }
  });
});

// Helper function to convert users to CSV
function convertUsersToCSV(users) {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Role',
    'Hotel',
    'Active',
    'Guest Type',
    'GST Number',
    'Company Name',
    'Created At',
    'Last Login'
  ];

  const rows = users.map(user => [
    user.name,
    user.email,
    user.phone || '',
    user.role,
    user.hotelId?.name || '',
    user.isActive ? 'Yes' : 'No',
    user.guestType || 'normal',
    user.billingDetails?.gstNumber || '',
    user.billingDetails?.companyName || '',
    user.createdAt.toISOString(),
    user.lastLogin ? user.lastLogin.toISOString() : ''
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export default {
  getUserAnalytics,
  getUserActivityMetrics,
  getUserPerformanceMetrics,
  getUserSegmentation,
  getUserEngagementMetrics,
  exportAnalytics,
  getAdvancedUserList,
  bulkUserOperations,
  importUsers,
  exportUsers,
  getUserActivityTimeline,
  getUserPerformanceReport,
  getUserHealthMonitoring,
  updateUserBillingDetails,
  getUserBillingDetails,
  updateUserProfile,
  validateGSTNumber
};
