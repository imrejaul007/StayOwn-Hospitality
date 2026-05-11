import loginAnalyticsService from '../services/loginAnalyticsService.js';
import LoginSession from '../models/LoginSession.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';
import { assertUserCanAccessHotel, refToHotelIdString } from '../middleware/propertyAccess.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parsePagination = (queryPage, queryLimit, fallbackLimit = DEFAULT_LIMIT) => {
  const page = Math.max(parseInt(queryPage, 10) || DEFAULT_PAGE, 1);
  const rawLimit = parseInt(queryLimit, 10) || fallbackLimit;
  const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

const resolveScopedHotelId = async (req) => {
  const requestedHotelId = refToHotelIdString(req.query?.hotelId);
  if (requestedHotelId) {
    await assertUserCanAccessHotel(req.user, requestedHotelId);
    return requestedHotelId;
  }

  if (req.property?._id) {
    return req.property._id.toString();
  }

  const userHotelId = refToHotelIdString(req.user?.hotelId || req.user?.hotel);
  if (!userHotelId) {
    throw new ApplicationError('No property context available for this request', 400);
  }
  return userHotelId;
};

const createLoginActivityAudit = async ({ req, hotelId, recordId, changeType, details }) => {
  await AuditLog.logChange({
    hotelId,
    tableName: 'User',
    recordId,
    changeType,
    userId: req.user?._id,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    source: 'api',
    sourceDetails: {
      apiEndpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    },
    newValues: details,
    metadata: {
      priority: 'high',
      tags: ['login_activity', 'security']
    }
  });
};

// Get comprehensive login analytics
export const getLoginAnalytics = catchAsync(async (req, res) => {
  const { dateRange, groupBy } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (groupBy) options.groupBy = groupBy;

  const analytics = await loginAnalyticsService.getLoginAnalytics(hotelId, options);

  res.json({
    status: 'success',
    data: analytics
  });
});

// Get login patterns and trends
export const getLoginPatterns = catchAsync(async (req, res) => {
  const { dateRange, patternType } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (patternType) options.patternType = patternType;

  const patterns = await loginAnalyticsService.getLoginPatterns(hotelId, options);

  res.json({
    status: 'success',
    data: patterns
  });
});

// Get security metrics and threat analysis
export const getSecurityMetrics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const metrics = await loginAnalyticsService.getSecurityMetrics(hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Get user behavior analysis
export const getUserBehaviorAnalysis = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const analysis = await loginAnalyticsService.getUserBehaviorAnalysis(hotelId, options);

  res.json({
    status: 'success',
    data: analysis
  });
});

// Get compliance reporting
export const getComplianceReport = catchAsync(async (req, res) => {
  const { dateRange, complianceType } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (complianceType) options.complianceType = complianceType;

  const report = await loginAnalyticsService.getComplianceReport(hotelId, options);

  res.json({
    status: 'success',
    data: report
  });
});

// Get active sessions
export const getActiveSessions = catchAsync(async (req, res) => {
  const { userId, minRiskScore } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 50);
  
  const options = {};
  if (userId) options.userId = userId;
  if (minRiskScore) options.minRiskScore = parseInt(minRiskScore);

  const baseQuery = LoginSession.getActiveSessions(hotelId, options);
  const [sessions, total] = await Promise.all([
    baseQuery.clone().skip(skip).limit(limit),
    LoginSession.countDocuments({
      isActive: true,
      hotelId,
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.minRiskScore ? { riskScore: { $gte: options.minRiskScore } } : {})
    })
  ]);

  res.json({
    status: 'success',
    results: sessions.length,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total,
      limit
    },
    data: { sessions }
  });
});

// Get session details
export const getSessionDetails = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const hotelId = await resolveScopedHotelId(req);

  const session = await LoginSession.findOne({
    sessionId,
    hotelId
  }).populate('userId', 'name email role');

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  res.json({
    status: 'success',
    data: { session }
  });
});

// End session
export const endSession = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const hotelId = await resolveScopedHotelId(req);

  const session = await LoginSession.findOne({
    sessionId,
    hotelId
  });

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  if (!session.isActive) {
    throw new ApplicationError('Session is already ended', 400);
  }

  await session.endSession();

  // Log the session end
  await createLoginActivityAudit({
    req,
    hotelId,
    recordId: session._id || session.sessionId,
    changeType: 'security_event',
    details: {
      event: 'session_ended',
      sessionId: session.sessionId,
      targetUserId: session.userId?.toString?.() || String(session.userId)
    }
  });

  res.json({
    status: 'success',
    message: 'Session ended successfully',
    data: { session }
  });
});

// Get suspicious sessions
export const getSuspiciousSessions = catchAsync(async (req, res) => {
  const hotelId = await resolveScopedHotelId(req);
  const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 20);

  const [sessions, total] = await Promise.all([
    LoginSession.detectSuspiciousSessions(hotelId, { skip, limit }),
    LoginSession.countSuspiciousSessions(hotelId)
  ]);

  res.json({
    status: 'success',
    results: sessions.length,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total,
      limit
    },
    data: { sessions }
  });
});

// Update session risk score
export const updateSessionRiskScore = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { riskScore, reason } = req.body;
  const hotelId = await resolveScopedHotelId(req);

  if (riskScore < 0 || riskScore > 100) {
    throw new ApplicationError('Risk score must be between 0 and 100', 400);
  }

  const session = await LoginSession.findOne({
    sessionId,
    hotelId
  });

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  session.riskScore = riskScore;
  if (reason) {
    session.securityFlags.push('manual_review');
  }
  await session.save();

  // Log the risk score update
  await createLoginActivityAudit({
    req,
    hotelId,
    recordId: session._id || session.sessionId,
    changeType: 'security_event',
    details: {
      event: 'risk_score_updated',
      sessionId,
      riskScore,
      reason: reason || 'Manual review'
    }
  });

  res.json({
    status: 'success',
    message: 'Risk score updated successfully',
    data: { session }
  });
});

// Add security flag to session
export const addSecurityFlag = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { flag, reason } = req.body;
  const hotelId = await resolveScopedHotelId(req);

  const validFlags = [
    'suspicious_ip',
    'unusual_location',
    'multiple_devices',
    'rapid_logins',
    'failed_attempts',
    'privilege_escalation',
    'data_breach_attempt',
    'bot_detected',
    'vpn_detected',
    'tor_detected',
    'manual_review'
  ];

  if (!validFlags.includes(flag)) {
    throw new ApplicationError('Invalid security flag', 400);
  }

  const session = await LoginSession.findOne({
    sessionId,
    hotelId
  });

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  await session.addSecurityFlag(flag);

  // Log the security flag addition
  await createLoginActivityAudit({
    req,
    hotelId,
    recordId: session._id || session.sessionId,
    changeType: 'security_event',
    details: {
      event: 'security_flag_added',
      sessionId,
      flag,
      reason: reason || 'Manual review'
    }
  });

  res.json({
    status: 'success',
    message: 'Security flag added successfully',
    data: { session }
  });
});

// Get session history for user
export const getUserSessionHistory = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { dateRange } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 20);

  const query = {
    userId: new mongoose.Types.ObjectId(userId),
    hotelId
  };

  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      query.loginTime = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const [sessions, total] = await Promise.all([
    LoginSession.find(query)
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    LoginSession.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: sessions.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      limit: parseInt(limit)
    },
    data: { sessions }
  });
});

// Get real-time login monitoring
export const getRealTimeMonitoring = catchAsync(async (req, res) => {
  const { timeWindow = 300 } = req.query; // 5 minutes default
  const hotelId = await resolveScopedHotelId(req);

  const timeThreshold = new Date(Date.now() - (timeWindow * 1000));

  const pipeline = [
    {
      $match: {
        hotelId,
        loginTime: { $gte: timeThreshold }
      }
    },
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
      $group: {
        _id: null,
        totalLogins: { $sum: 1 },
        activeSessions: { $sum: { $cond: ['$isActive', 1, 0] } },
        highRiskSessions: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueIPs: { $addToSet: '$ipAddress' },
        recentLogins: {
          $push: {
            userId: '$userId',
            userName: '$user.name',
            userEmail: '$user.email',
            loginTime: '$loginTime',
            ipAddress: '$ipAddress',
            riskScore: '$riskScore',
            securityFlags: '$securityFlags',
            deviceInfo: '$deviceInfo',
            locationInfo: '$locationInfo'
          }
        }
      }
    }
  ];

  const [monitoringData, suspiciousActivities] = await Promise.all([
    LoginSession.aggregate(pipeline),
    AuditLog.find({
      hotelId,
      createdAt: { $gte: timeThreshold },
      changeType: 'security_event',
      'metadata.tags': 'login_activity'
    }).sort({ createdAt: -1 }).limit(10).lean()
  ]);

  const result = monitoringData[0] || {
    totalLogins: 0,
    activeSessions: 0,
    highRiskSessions: 0,
    uniqueUsers: [],
    uniqueIPs: [],
    recentLogins: []
  };

  res.json({
    status: 'success',
    data: {
      ...result,
      uniqueUserCount: result.uniqueUsers.length,
      uniqueIPCount: result.uniqueIPs.length,
      suspiciousActivities,
      timeWindow: parseInt(timeWindow)
    }
  });
});

// Export login analytics
export const exportLoginAnalytics = catchAsync(async (req, res) => {
  const { format = 'json', dateRange } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const analytics = await loginAnalyticsService.getLoginAnalytics(hotelId, options);

  if (format === 'csv') {
    const csvData = convertAnalyticsToCSV(analytics);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=login_analytics.csv');
    res.send(csvData);
  } else {
    res.json({
      status: 'success',
      data: analytics
    });
  }
});

// Get security alerts
export const getSecurityAlerts = catchAsync(async (req, res) => {
  const { severity } = req.query;
  const hotelId = await resolveScopedHotelId(req);
  const { page, limit, skip } = parsePagination(req.query.page, req.query.limit, 50);

  const matchStage = {
    hotelId,
    changeType: 'security_event',
    'metadata.tags': 'login_activity'
  };

  if (severity) {
    matchStage['metadata.priority'] = severity;
  }

  const [alerts, total] = await Promise.all([
    AuditLog.find(matchStage)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(matchStage)
  ]);

  res.json({
    status: 'success',
    results: alerts.length,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total,
      limit
    },
    data: { alerts }
  });
});

// Helper function to convert analytics to CSV
function convertAnalyticsToCSV(analytics) {
  const headers = [
    'Metric',
    'Value',
    'Percentage'
  ];
  
  const rows = [
    ['Total Logins', analytics.totalLogins, '100%'],
    ['Active Sessions', analytics.activeSessions, `${((analytics.activeSessions / analytics.totalLogins) * 100).toFixed(1)}%`],
    ['High Risk Sessions', analytics.highRiskSessions, `${((analytics.highRiskSessions / analytics.totalLogins) * 100).toFixed(1)}%`],
    ['MFA Sessions', analytics.mfaSessions, `${analytics.mfaRate.toFixed(1)}%`],
    ['Unique Users', analytics.uniqueUserCount, `${((analytics.uniqueUserCount / analytics.totalLogins) * 100).toFixed(1)}%`],
    ['Unique IPs', analytics.uniqueIPCount, `${((analytics.uniqueIPCount / analytics.totalLogins) * 100).toFixed(1)}%`]
  ];
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export default {
  getLoginAnalytics,
  getLoginPatterns,
  getSecurityMetrics,
  getUserBehaviorAnalysis,
  getComplianceReport,
  getActiveSessions,
  getSessionDetails,
  endSession,
  getSuspiciousSessions,
  updateSessionRiskScore,
  addSecurityFlag,
  getUserSessionHistory,
  getRealTimeMonitoring,
  exportLoginAnalytics,
  getSecurityAlerts
};
