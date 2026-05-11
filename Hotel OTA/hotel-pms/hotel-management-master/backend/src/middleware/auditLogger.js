import SettingsAuditLog from '../models/SettingsAuditLog.js';
import logger from '../utils/logger.js';

/**
 * Audit Logger Middleware
 * Automatically logs all settings changes with comprehensive metadata
 */

class AuditLogger {
  constructor() {
    this.startTimes = new Map();
  }

  /**
   * Log a settings change
   * @param {Object} options - Logging options
   * @returns {Promise<Object>} Created audit log entry
   */
  async logChange(options) {
    try {
      const {
        hotelId,
        userId,
        userName,
        userEmail,
        action = 'update',
        scope = 'single',
        propertyId,
        groupId,
        settingType,
        settingName,
        propertiesAffected = 1,
        affectedPropertyIds = [],
        changesSummary,
        previousValues,
        newValues,
        ipAddress,
        userAgent,
        duration = 0,
        status = 'success',
        errorMessage,
        scheduledFor,
        executedAt,
        metadata = {}
      } = options;

      const auditLog = await SettingsAuditLog.create({
        hotelId,
        userId,
        userName,
        userEmail,
        action,
        scope,
        propertyId,
        groupId,
        settingType,
        settingName,
        propertiesAffected,
        affectedPropertyIds,
        changesSummary,
        previousValues,
        newValues,
        ipAddress,
        userAgent,
        duration,
        status,
        errorMessage,
        scheduledFor,
        executedAt,
        metadata
      });

      logger.info('Settings change logged', {
        auditLogId: auditLog._id,
        userId,
        action,
        settingType,
        propertiesAffected
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to log settings change', {
        error: error.message,
        options
      });
      // Don't throw - we don't want audit logging failures to break the main flow
      return null;
    }
  }

  /**
   * Middleware to capture request metadata
   */
  captureRequestMetadata() {
    return (req, res, next) => {
      // Store start time for duration calculation
      const requestId = `${req.method}:${req.path}:${Date.now()}`;
      this.startTimes.set(requestId, Date.now());

      // Attach metadata to request
      req.auditMetadata = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        requestId,
        startTime: Date.now()
      };

      // Override res.json to capture the response and log it
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Calculate duration
        const duration = Date.now() - req.auditMetadata.startTime;

        // If this was a settings change, log it
        if (req.auditLogData) {
          this.logChange({
            ...req.auditLogData,
            ipAddress: req.auditMetadata.ipAddress,
            userAgent: req.auditMetadata.userAgent,
            duration,
            status: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failed'
          });
        }

        // Clean up
        this.startTimes.delete(requestId);

        return originalJson(body);
      };

      next();
    };
  }

  /**
   * Helper to prepare audit log data from request
   * Call this in your route handlers before making changes
   */
  prepareAuditLog(req, options) {
    req.auditLogData = {
      hotelId: req.user?.hotelId,
      userId: req.user?._id,
      userName: req.user?.name,
      userEmail: req.user?.email,
      ...options
    };
  }

  /**
   * Helper to calculate diff between old and new values
   */
  calculateDiff(oldValues, newValues) {
    const changes = [];

    // Get all unique keys
    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {})
    ]);

    for (const key of allKeys) {
      const oldValue = oldValues?.[key];
      const newValue = newValues?.[key];

      // Skip if values are the same
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        continue;
      }

      changes.push({
        field: key,
        oldValue,
        newValue,
        changed: true
      });
    }

    return changes;
  }

  /**
   * Helper to summarize changes
   */
  summarizeChanges(oldValues, newValues) {
    const diff = this.calculateDiff(oldValues, newValues);

    return {
      totalFieldsChanged: diff.length,
      changedFields: diff.map(d => d.field),
      changes: diff
    };
  }

  /**
   * Log bulk update
   */
  async logBulkUpdate(options) {
    const {
      hotelId,
      userId,
      userName,
      userEmail,
      scope,
      groupId,
      settingType,
      settingName,
      affectedPropertyIds = [],
      settingUpdates,
      ipAddress,
      userAgent,
      duration = 0
    } = options;

    try {
      const auditLog = await this.logChange({
        hotelId,
        userId,
        userName,
        userEmail,
        action: 'update',
        scope,
        propertyId: affectedPropertyIds[0], // Primary property
        groupId,
        settingType,
        settingName,
        propertiesAffected: affectedPropertyIds.length,
        affectedPropertyIds,
        changesSummary: {
          type: 'bulk_update',
          propertiesCount: affectedPropertyIds.length,
          updatedFields: Object.keys(settingUpdates)
        },
        newValues: settingUpdates,
        ipAddress,
        userAgent,
        duration,
        status: 'success'
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to log bulk update', {
        error: error.message,
        settingType,
        propertiesAffected: affectedPropertyIds.length
      });
      return null;
    }
  }

  /**
   * Log rollback action
   */
  async logRollback(options) {
    const {
      hotelId,
      userId,
      userName,
      userEmail,
      originalLogId,
      affectedPropertyIds = [],
      settingType,
      restoredValues,
      ipAddress,
      userAgent
    } = options;

    try {
      const auditLog = await this.logChange({
        hotelId,
        userId,
        userName,
        userEmail,
        action: 'rollback',
        scope: affectedPropertyIds.length > 1 ? 'group' : 'single',
        propertyId: affectedPropertyIds[0],
        settingType,
        propertiesAffected: affectedPropertyIds.length,
        affectedPropertyIds,
        changesSummary: {
          type: 'rollback',
          originalLogId,
          propertiesRolledBack: affectedPropertyIds.length
        },
        newValues: restoredValues,
        ipAddress,
        userAgent,
        status: 'success',
        metadata: {
          originalLogId
        }
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to log rollback', {
        error: error.message,
        settingType
      });
      return null;
    }
  }

  /**
   * Log scheduled update creation
   */
  async logScheduledUpdate(options) {
    const {
      hotelId,
      userId,
      userName,
      userEmail,
      scope,
      propertyId,
      groupId,
      settingType,
      scheduledFor,
      settingUpdates,
      ipAddress,
      userAgent
    } = options;

    try {
      const auditLog = await this.logChange({
        hotelId,
        userId,
        userName,
        userEmail,
        action: 'schedule',
        scope,
        propertyId,
        groupId,
        settingType,
        changesSummary: {
          type: 'scheduled_update',
          scheduledFor,
          updatedFields: Object.keys(settingUpdates)
        },
        newValues: settingUpdates,
        scheduledFor,
        ipAddress,
        userAgent,
        status: 'success'
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to log scheduled update', {
        error: error.message,
        settingType
      });
      return null;
    }
  }

  /**
   * Log scheduled update execution
   */
  async logScheduledExecution(options) {
    const {
      hotelId,
      scheduledUpdateId,
      userId,
      settingType,
      affectedPropertyIds = [],
      status = 'success',
      errorMessage
    } = options;

    try {
      const auditLog = await this.logChange({
        hotelId,
        userId,
        action: 'update',
        scope: affectedPropertyIds.length > 1 ? 'group' : 'single',
        propertyId: affectedPropertyIds[0],
        settingType,
        propertiesAffected: affectedPropertyIds.length,
        affectedPropertyIds,
        changesSummary: {
          type: 'scheduled_execution',
          scheduledUpdateId
        },
        executedAt: new Date(),
        status,
        errorMessage,
        metadata: {
          scheduledUpdateId
        }
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to log scheduled execution', {
        error: error.message,
        scheduledUpdateId
      });
      return null;
    }
  }
}

// Singleton instance
const auditLogger = new AuditLogger();

export default auditLogger;
export { AuditLogger };
