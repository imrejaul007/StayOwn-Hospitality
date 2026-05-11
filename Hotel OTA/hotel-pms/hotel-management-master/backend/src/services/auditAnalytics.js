import SettingsAuditLog from '../models/SettingsAuditLog.js';
import logger from '../utils/logger.js';
import { Parser } from 'json2csv';

class AuditAnalyticsService {
  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(filters = {}, pagination = {}) {
    try {
      const {
        hotelId,
        userId,
        propertyId,
        groupId,
        settingType,
        action,
        scope,
        status,
        startDate,
        endDate,
        search
      } = filters;

      const {
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = pagination;

      const page = Math.max(1, parseInt(pagination.page) || 1);
      const maxLimit = parseInt(pagination.maxLimit) || 100;
      const limit = Math.min(maxLimit, Math.max(1, parseInt(pagination.limit) || 50));

      // Whitelist sortable fields
      const allowedSortFields = ['timestamp', 'action', 'scope', 'settingType', 'status', 'duration'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';

      // Build query
      const query = {};

      if (hotelId) query.hotelId = hotelId;

      if (userId) query.userId = userId;
      if (groupId) query.groupId = groupId;
      if (settingType) query.settingType = settingType;
      if (action) query.action = action;
      if (scope) query.scope = scope;
      if (status) query.status = status;

      // Date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      // Property filter and text search — both use $or, so combine with $and when both present
      const propertyOr = propertyId
        ? [{ propertyId }, { affectedPropertyIds: propertyId }]
        : null;

      const searchOr = search
        ? [
            { userName: { $regex: search, $options: 'i' } },
            { userEmail: { $regex: search, $options: 'i' } },
            { settingName: { $regex: search, $options: 'i' } },
            { settingType: { $regex: search, $options: 'i' } }
          ]
        : null;

      if (propertyOr && searchOr) {
        query.$and = [{ $or: propertyOr }, { $or: searchOr }];
      } else if (propertyOr) {
        query.$or = propertyOr;
      } else if (searchOr) {
        query.$or = searchOr;
      }

      // Execute query
      const skip = (page - 1) * limit;
      const sort = { [safeSortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [logs, totalCount] = await Promise.all([
        SettingsAuditLog.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('userId', 'name email role')
          .populate('propertyId', 'name code')
          .populate('groupId', 'name description')
          .lean(),
        SettingsAuditLog.countDocuments(query)
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 1,
          totalCount
        }
      };
    } catch (error) {
      logger.error('Failed to get audit logs', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStatistics(dateRange = {}, hotelId = null) {
    try {
      const { startDate, endDate, groupBy = 'day' } = dateRange;
      const scopedRange = { ...dateRange, hotelId };

      // Get overall statistics
      const stats = await SettingsAuditLog.getStatistics(scopedRange);

      // Get time series data
      const timeSeries = await this.getTimeSeriesData(startDate, endDate, groupBy, hotelId);

      // Get most active users
      const mostActiveUsers = await SettingsAuditLog.getMostActiveUsers(10, scopedRange);

      // Get most changed settings
      const mostChangedSettings = await SettingsAuditLog.getMostChangedSettings(10, scopedRange);

      // Calculate additional metrics
      const totalChanges = stats.totalChanges[0]?.count || 0;
      const totalPropertiesAffected = stats.totalPropertiesAffected[0]?.total || 0;
      const averageDuration = stats.averageDuration[0]?.avg || 0;

      // Calculate success rate
      const successCount = stats.byStatus?.find(s => s._id === 'success')?.count || 0;
      const successRate = totalChanges > 0 ? (successCount / totalChanges) * 100 : 0;

      return {
        overview: {
          totalChanges,
          totalPropertiesAffected,
          averageDuration: Math.round(averageDuration),
          successRate: successRate.toFixed(2),
          dateRange: {
            startDate: startDate || 'all-time',
            endDate: endDate || 'now'
          }
        },
        byAction: stats.byAction || [],
        byScope: stats.byScope || [],
        bySettingType: stats.bySettingType || [],
        byStatus: stats.byStatus || [],
        timeSeries,
        mostActiveUsers,
        mostChangedSettings
      };
    } catch (error) {
      logger.error('Failed to get usage statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get time series data
   */
  async getTimeSeriesData(startDate, endDate, groupBy = 'day', hotelId = null) {
    try {
      const matchStage = {};
      if (hotelId) matchStage.hotelId = hotelId;

      if (startDate && endDate) {
        matchStage.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // Determine date format based on groupBy
      let dateFormat;
      switch (groupBy) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00';
          break;
        case 'day':
          dateFormat = '%Y-%m-%d';
          break;
        case 'week':
          dateFormat = '%Y-W%V';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
        default:
          dateFormat = '%Y-%m-%d';
      }

      // Consider caching this aggregation result for 5 minutes


      // const cacheKey = `agg:${JSON.stringify(filter || {})}`;


      const timeSeries = await SettingsAuditLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: '$timestamp' } },
              action: '$action'
            },
            count: { $sum: 1 },
            propertiesAffected: { $sum: '$propertiesAffected' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      // Transform data for charting
      const chartData = {};
      timeSeries.forEach(item => {
        const date = item._id.date;
        if (!chartData[date]) {
          chartData[date] = { date, total: 0 };
        }
        chartData[date][item._id.action] = item.count;
        chartData[date].total += item.count;
      });

      return Object.values(chartData);
    } catch (error) {
      logger.error('Failed to get time series data', { error: error.message });
      throw error;
    }
  }

  /**
   * Get property activity heatmap
   */
  async getPropertyActivityHeatmap(dateRange = {}, hotelId = null) {
    try {
      const { startDate, endDate } = dateRange;

      const matchStage = {};
      if (hotelId) matchStage.hotelId = hotelId;

      if (startDate && endDate) {
        matchStage.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // Consider caching this aggregation result for 5 minutes


      // const cacheKey = `agg:${JSON.stringify(filter || {})}`;


      const heatmap = await SettingsAuditLog.aggregate([
        { $match: matchStage },
        { $unwind: { path: '$affectedPropertyIds', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$affectedPropertyIds',
            totalChanges: { $sum: 1 },
            byAction: {
              $push: {
                action: '$action',
                timestamp: '$timestamp'
              }
            },
            lastActivity: { $max: '$timestamp' }
          }
        },
        {
          $lookup: {
            from: 'hotels',
            localField: '_id',
            foreignField: '_id',
            as: 'property'
          }
        },
        { $unwind: { path: '$property', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            propertyId: '$_id',
            propertyName: '$property.name',
            propertyCode: '$property.code',
            totalChanges: 1,
            lastActivity: 1,
            actionBreakdown: {
              $reduce: {
                input: '$byAction',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $cond: [
                        { $eq: ['$$this.action', 'update'] },
                        { update: { $add: [{ $ifNull: ['$$value.update', 0] }, 1] } },
                        {}
                      ]
                    },
                    {
                      $cond: [
                        { $eq: ['$$this.action', 'create'] },
                        { create: { $add: [{ $ifNull: ['$$value.create', 0] }, 1] } },
                        {}
                      ]
                    },
                    {
                      $cond: [
                        { $eq: ['$$this.action', 'delete'] },
                        { delete: { $add: [{ $ifNull: ['$$value.delete', 0] }, 1] } },
                        {}
                      ]
                    },
                    {
                      $cond: [
                        { $eq: ['$$this.action', 'rollback'] },
                        { rollback: { $add: [{ $ifNull: ['$$value.rollback', 0] }, 1] } },
                        {}
                      ]
                    }
                  ]
                }
              }
            }
          }
        },
        { $sort: { totalChanges: -1 } }
      ]);

      return heatmap;
    } catch (error) {
      logger.error('Failed to get property activity heatmap', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId, options = {}, hotelId = null) {
    try {
      const { limit = 100, skip = 0 } = options;

      const logs = await SettingsAuditLog.getLogsByUser(userId, { limit, skip, hotelId });

      const userMatch = { userId };
      if (hotelId) userMatch.hotelId = hotelId;

      const stats = await SettingsAuditLog.aggregate([
        { $match: userMatch },
        {
          $facet: {
            totalChanges: [{ $count: 'count' }],
            byAction: [
              { $group: { _id: '$action', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            byScope: [
              { $group: { _id: '$scope', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            totalPropertiesAffected: [
              { $group: { _id: null, total: { $sum: '$propertiesAffected' } } }
            ],
            firstActivity: [
              { $sort: { timestamp: 1 } },
              { $limit: 1 },
              { $project: { timestamp: 1 } }
            ],
            lastActivity: [
              { $sort: { timestamp: -1 } },
              { $limit: 1 },
              { $project: { timestamp: 1 } }
            ]
          }
        }
      ]);

      return {
        logs,
        statistics: stats[0]
      };
    } catch (error) {
      logger.error('Failed to get user activity', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get property activity
   */
  async getPropertyActivity(propertyId, options = {}, hotelId = null) {
    try {
      const { limit = 100, skip = 0 } = options;

      const logs = await SettingsAuditLog.getLogsByProperty(propertyId, { limit, skip, hotelId });

      const propMatch = {
        $or: [
          { propertyId },
          { affectedPropertyIds: propertyId }
        ]
      };
      if (hotelId) propMatch.hotelId = hotelId;

      const stats = await SettingsAuditLog.aggregate([
        { $match: propMatch },
        {
          $facet: {
            totalChanges: [{ $count: 'count' }],
            byAction: [
              { $group: { _id: '$action', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            bySettingType: [
              { $group: { _id: '$settingType', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            uniqueUsers: [
              { $group: { _id: '$userId' } },
              { $count: 'count' }
            ],
            firstActivity: [
              { $sort: { timestamp: 1 } },
              { $limit: 1 },
              { $project: { timestamp: 1 } }
            ],
            lastActivity: [
              { $sort: { timestamp: -1 } },
              { $limit: 1 },
              { $project: { timestamp: 1 } }
            ]
          }
        }
      ]);

      return {
        logs,
        statistics: stats[0]
      };
    } catch (error) {
      logger.error('Failed to get property activity', { error: error.message, propertyId });
      throw error;
    }
  }

  /**
   * Export audit log to CSV
   */
  async exportAuditLog(filters = {}, format = 'csv') {
    try {
      // Get matching logs with a safe upper bound
      const { logs } = await this.getAuditLogs(filters, { page: 1, limit: 10000, maxLimit: 10000 });

      if (format === 'csv') {
        // Define fields for CSV
        const fields = [
          { label: 'Timestamp', value: 'timestamp' },
          { label: 'User Name', value: 'userName' },
          { label: 'User Email', value: 'userEmail' },
          { label: 'Action', value: 'action' },
          { label: 'Scope', value: 'scope' },
          { label: 'Setting Type', value: 'settingType' },
          { label: 'Setting Name', value: 'settingName' },
          { label: 'Properties Affected', value: 'propertiesAffected' },
          { label: 'Property Name', value: 'propertyId.name' },
          { label: 'Group Name', value: 'groupId.name' },
          { label: 'Status', value: 'status' },
          { label: 'Duration (ms)', value: 'duration' },
          { label: 'IP Address', value: 'ipAddress' }
        ];

        const parser = new Parser({ fields });
        const csv = parser.parse(logs);

        return {
          format: 'csv',
          data: csv,
          filename: `audit-log-${Date.now()}.csv`
        };
      } else if (format === 'json') {
        return {
          format: 'json',
          data: JSON.stringify(logs, null, 2),
          filename: `audit-log-${Date.now()}.json`
        };
      }

      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      logger.error('Failed to export audit log', { error: error.message, filters, format });
      throw error;
    }
  }

  /**
   * Calculate time savings
   * Estimate how much time was saved by bulk operations
   */
  async calculateTimeSavings(dateRange = {}, hotelId = null) {
    try {
      const { startDate, endDate } = dateRange;

      const matchStage = {
        scope: { $in: ['group', 'all'] },
        action: 'update'
      };
      if (hotelId) matchStage.hotelId = hotelId;

      if (startDate && endDate) {
        matchStage.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // Consider caching this aggregation result for 5 minutes


      // const cacheKey = `agg:${JSON.stringify(filter || {})}`;


      const bulkOperations = await SettingsAuditLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalBulkOperations: { $sum: 1 },
            totalPropertiesAffected: { $sum: '$propertiesAffected' },
            averagePropertiesPerOperation: { $avg: '$propertiesAffected' }
          }
        }
      ]);

      if (!bulkOperations.length) {
        return {
          totalBulkOperations: 0,
          totalPropertiesAffected: 0,
          estimatedTimeSaved: 0,
          estimatedManualOperations: 0
        };
      }

      const data = bulkOperations[0];

      // Assume each manual operation takes 2 minutes
      const timePerManualOperation = 2; // minutes
      const manualOperationsAvoided = data.totalPropertiesAffected - data.totalBulkOperations;
      const timeSavedMinutes = manualOperationsAvoided * timePerManualOperation;

      return {
        totalBulkOperations: data.totalBulkOperations,
        totalPropertiesAffected: data.totalPropertiesAffected,
        averagePropertiesPerOperation: Math.round(data.averagePropertiesPerOperation),
        estimatedManualOperations: manualOperationsAvoided,
        estimatedTimeSavedMinutes: timeSavedMinutes,
        estimatedTimeSavedHours: (timeSavedMinutes / 60).toFixed(2),
        estimatedTimeSavedDays: (timeSavedMinutes / (60 * 8)).toFixed(2) // 8-hour work day
      };
    } catch (error) {
      logger.error('Failed to calculate time savings', { error: error.message });
      throw error;
    }
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(limit = 20, hotelId = null) {
    try {
      const query = {};
      if (hotelId) query.hotelId = hotelId;

      const logs = await SettingsAuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .populate('propertyId', 'name')
        .populate('groupId', 'name')
        .lean();

      return logs;
    } catch (error) {
      logger.error('Failed to get recent activity', { error: error.message });
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(logId, hotelId = null) {
    try {
      const query = { _id: logId };
      if (hotelId) query.hotelId = hotelId;

      const log = await SettingsAuditLog.findOne(query)
        .populate('userId', 'name email role')
        .populate('propertyId', 'name code')
        .populate('groupId', 'name description')
        .lean();

      if (!log) {
        throw new Error('Audit log not found');
      }

      return log;
    } catch (error) {
      logger.error('Failed to get audit log by ID', { error: error.message, logId });
      throw error;
    }
  }
}

// Singleton instance
const auditAnalyticsService = new AuditAnalyticsService();

export default auditAnalyticsService;
export { AuditAnalyticsService };
