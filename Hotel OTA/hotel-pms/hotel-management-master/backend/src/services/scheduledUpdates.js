import ScheduledUpdate from '../models/ScheduledUpdate.js';
import { SettingsInheritanceService } from './settingsInheritance.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Scheduled Updates Service
 *
 * Manages scheduled settings updates across properties.
 */
export class ScheduledUpdatesService {
  /**
   * Schedule new update
   */
  static async scheduleUpdate({
      scheduledFor,
      scope,
      propertyId,
      groupId,
      settingType,
      settingUpdates,
      userId,
      userName,
      settingName
  }) {
    try {
      // Validate scheduled time is in future
      if (new Date(scheduledFor) <= new Date()) {
        throw new ApplicationError('Scheduled time must be in the future', 400);
      }

      // Validate scope
      if (!['single', 'group', 'all'].includes(scope)) {
        throw new ApplicationError('Invalid scope', 400);
      }

      // Create scheduled update
      const scheduledUpdate = new ScheduledUpdate({
        scheduledFor,
        scope,
        propertyId,
        groupId,
        settingType,
        settingName: settingName || settingType,
        settingUpdates,
        createdBy: userId,
        createdByName: userName
      });

      await scheduledUpdate.save();

      // Log audit (will be handled by audit middleware if available)
      // await auditLogger.logScheduledUpdate(userId, scheduledUpdate);

      return scheduledUpdate;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get scheduled updates with filters
   */
  static async getScheduledUpdates({
      propertyId,
      groupId,
      status,
      startDate,
      endDate,
      userId,
      limit = 100,
      skip = 0
  }) {
    try {
    const query = {};

    if (propertyId) query.propertyId = propertyId;
    if (groupId) query.groupId = groupId;
    if (status) query.status = status;
    if (userId) query.createdBy = userId;

    if (startDate || endDate) {
      query.scheduledFor = {};
      if (startDate) query.scheduledFor.$gte = new Date(startDate);
      if (endDate) query.scheduledFor.$lte = new Date(endDate);
    }

    const [updates, total] = await Promise.all([
      ScheduledUpdate.find(query)
        .populate('createdBy', 'name email')
        .populate('propertyId', 'name code')
        .populate('groupId', 'name')
        .populate('cancelledBy', 'name email')
        .sort({ scheduledFor: 1 })
        .limit(limit)
        .skip(skip),
      ScheduledUpdate.countDocuments(query)
    ]);

    return {
      updates,
      total,
      limit,
      skip,
      hasMore: total > skip + limit
    };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get specific scheduled update
   */
  static async getScheduledUpdate(updateId) {
    try {
      const update = await ScheduledUpdate.findById(updateId)
        .populate('createdBy', 'name email')
        .populate('propertyId', 'name code')
        .populate('groupId', 'name')
        .populate('cancelledBy', 'name email').lean();

      if (!update) {
        throw new ApplicationError('Scheduled update not found', 404);
      }

      return update;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Cancel scheduled update
   */
  static async cancelScheduledUpdate(updateId, userId, reason) {
    try {
      const update = await ScheduledUpdate.findById(updateId).lean();

      if (!update) {
        throw new ApplicationError('Scheduled update not found', 404);
      }

      await update.cancel(userId, reason);

      // Log audit (will be handled by audit middleware if available)
      // await auditLogger.logCancelledScheduledUpdate(userId, update, reason);

      return update;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Reschedule update (change scheduled time)
   */
  static async rescheduleUpdate(updateId, newScheduledFor, userId) {
    try {
      const update = await ScheduledUpdate.findById(updateId).lean();

      if (!update) {
        throw new ApplicationError('Scheduled update not found', 404);
      }

      if (update.status !== 'pending') {
        throw new ApplicationError(`Cannot reschedule update with status: ${update.status}`, 400);
      }

      if (new Date(newScheduledFor) <= new Date()) {
        throw new ApplicationError('New scheduled time must be in the future', 400);
      }

      const oldScheduledFor = update.scheduledFor;
      await update.reschedule(newScheduledFor);

      // Log audit (will be handled by audit middleware if available)
      // await auditLogger.logRescheduledUpdate(userId, update, oldScheduledFor, newScheduledFor);

      return update;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Execute scheduled update manually
   */
  static async executeNow(updateId, userId) {
    try {
      const update = await ScheduledUpdate.findById(updateId);

      if (!update) {
        throw new ApplicationError('Scheduled update not found', 404);
      }

      if (update.status !== 'pending') {
        throw new ApplicationError(`Cannot execute update with status: ${update.status}`, 400);
      }

      // Mark as manual execution
      update.executedBy = userId.toString();

      const result = await update.execute(SettingsInheritanceService);

      // Log audit (will be handled by audit middleware if available)
      // await auditLogger.logManualExecution(userId, update, result);

      return result;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Process due updates (called by cron job)
   */
  static async processDueUpdates() {
    try {
      const dueUpdates = await ScheduledUpdate.getDueUpdates();

      logger.debug(`[Scheduled Updates] Processing ${dueUpdates.length} due updates...`);

      const results = await Promise.allSettled(
        dueUpdates.map(update => update.execute(SettingsInheritanceService))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.debug(`[Scheduled Updates] Processed: ${succeeded} succeeded, ${failed} failed`);

      return {
        total: dueUpdates.length,
        succeeded,
        failed,
        results: results.map((r, i) => ({
          updateId: dueUpdates[i]._id,
          status: r.status === 'fulfilled' ? 'success' : 'failed',
          error: r.status === 'rejected' ? r.reason.message : null
        }))
      };
    } catch (error) {
      if (error?.name === 'MongoExpiredSessionError' || error?.message?.includes('session that has ended')) {
        logger.warn('[Scheduled Updates] Skipping run due to ended MongoDB session during shutdown/restart');
        return {
          total: 0,
          succeeded: 0,
          failed: 0,
          results: []
        };
      }
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get upcoming updates (next 24 hours)
   */
  static async getUpcomingUpdates(hours = 24) {
    try {
      return await ScheduledUpdate.getUpcomingUpdates(hours);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get updates by property
   */
  static async getUpdatesByProperty(propertyId, userId, status = null) {
    try {
      return await ScheduledUpdate.getByProperty(propertyId, { userId, status });
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get statistics for scheduled updates
   */
  static async getStatistics(userId) {
    try {
      const now = new Date();

      const [pending, completed, failed, cancelled, upcoming] = await Promise.all([
        ScheduledUpdate.countDocuments({ createdBy: userId, status: 'pending' }),
        ScheduledUpdate.countDocuments({ createdBy: userId, status: 'completed' }),
        ScheduledUpdate.countDocuments({ createdBy: userId, status: 'failed' }),
        ScheduledUpdate.countDocuments({ createdBy: userId, status: 'cancelled' }),
        ScheduledUpdate.countDocuments({
          createdBy: userId,
          status: 'pending',
          scheduledFor: { $gte: now, $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
        })
      ]);

      return {
        pending,
        completed,
        failed,
        cancelled,
        upcoming,
        total: pending + completed + failed + cancelled
      };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }
}

export default ScheduledUpdatesService;
