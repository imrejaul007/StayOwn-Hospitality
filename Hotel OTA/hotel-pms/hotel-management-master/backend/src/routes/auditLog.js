import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import auditAnalyticsService from '../services/auditAnalytics.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   GET /api/v1/audit-log
 * @desc    Get audit logs with filtering and pagination
 * @access  Private (Admin, Manager)
 */
router.get('/', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const {
      userId,
      propertyId,
      groupId,
      settingType,
      action,
      scope,
      status,
      startDate,
      endDate,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    } = req.query;

    const filters = {
      hotelId: req.user.hotelId,
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
    };

    const pagination = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      sortBy: sortBy || 'timestamp',
      sortOrder: sortOrder || 'desc'
    };

    const result = await auditAnalyticsService.getAuditLogs(filters, pagination);

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Get audit logs error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get audit logs',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/statistics
 * @desc    Get usage statistics
 * @access  Private (Admin, Manager)
 */
router.get('/statistics', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const dateRange = {
      startDate,
      endDate,
      groupBy: groupBy || 'day'
    };

    const statistics = await auditAnalyticsService.getUsageStatistics(dateRange, req.user.hotelId);

    res.status(200).json({
      status: 'success',
      data: statistics
    });
  } catch (error) {
    logger.error('Get statistics error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/heatmap
 * @desc    Get property activity heatmap
 * @access  Private (Admin, Manager)
 */
router.get('/heatmap', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateRange = { startDate, endDate };

    const heatmap = await auditAnalyticsService.getPropertyActivityHeatmap(dateRange, req.user.hotelId);

    res.status(200).json({
      status: 'success',
      data: heatmap
    });
  } catch (error) {
    logger.error('Get heatmap error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get activity heatmap',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/time-savings
 * @desc    Calculate time savings from bulk operations
 * @access  Private (Admin, Manager)
 */
router.get('/time-savings', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateRange = { startDate, endDate };

    const timeSavings = await auditAnalyticsService.calculateTimeSavings(dateRange, req.user.hotelId);

    res.status(200).json({
      status: 'success',
      data: timeSavings
    });
  } catch (error) {
    logger.error('Calculate time savings error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate time savings',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/recent
 * @desc    Get recent activity feed
 * @access  Private (Admin, Manager)
 */
router.get('/recent', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const { limit } = req.query;

    const activity = await auditAnalyticsService.getRecentActivity(
      limit ? parseInt(limit) : 20,
      req.user.hotelId
    );

    res.status(200).json({
      status: 'success',
      data: activity
    });
  } catch (error) {
    logger.error('Get recent activity error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get recent activity',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/export
 * @desc    Export audit log to CSV or JSON
 * @access  Private (Admin, Manager)
 */
router.get('/export', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const {
      userId,
      propertyId,
      groupId,
      settingType,
      action,
      scope,
      status,
      startDate,
      endDate,
      search,
      format
    } = req.query;

    const filters = {
      hotelId: req.user.hotelId,
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
    };

    const exportFormat = format || 'csv';

    const result = await auditAnalyticsService.exportAuditLog(filters, exportFormat);

    // Set appropriate headers
    if (exportFormat === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.data);
    } else if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.data);
    }
  } catch (error) {
    logger.error('Export audit log error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to export audit log',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/user/:userId
 * @desc    Get user activity
 * @access  Private (Admin only)
 */
router.get('/user/:userId', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, skip } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 100,
      skip: skip ? parseInt(skip) : 0
    };

    const activity = await auditAnalyticsService.getUserActivity(userId, options, req.user.hotelId);

    res.status(200).json({
      status: 'success',
      data: activity
    });
  } catch (error) {
    logger.error('Get user activity error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user activity',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/property/:propertyId
 * @desc    Get property activity
 * @access  Private (Admin, Manager)
 */
router.get('/property/:propertyId', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { limit, skip } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 100,
      skip: skip ? parseInt(skip) : 0
    };

    const activity = await auditAnalyticsService.getPropertyActivity(propertyId, options, req.user.hotelId);

    res.status(200).json({
      status: 'success',
      data: activity
    });
  } catch (error) {
    logger.error('Get property activity error:', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to get property activity',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/v1/audit-log/:logId
 * @desc    Get specific audit log entry
 * @access  Private (Admin, Manager)
 */
router.get('/:logId', authenticate, ensureTenantContext, ensurePropertyAccess, authorize('admin'), async (req, res) => {
  try {
    const { logId } = req.params;

    const log = await auditAnalyticsService.getAuditLogById(logId, req.user.hotelId);

    res.status(200).json({
      status: 'success',
      data: log
    });
  } catch (error) {
    logger.error('Get audit log by ID error:', { error: error.message });
    res.status(error.message === 'Audit log not found' ? 404 : 500).json({
      status: 'error',
      message: error.message || 'Failed to get audit log',
      error: error.message
    });
  }
});

export default router;
