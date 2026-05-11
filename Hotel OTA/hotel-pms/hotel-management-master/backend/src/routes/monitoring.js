import express from 'express';
import Joi from 'joi';
import auth from '../middleware/auth.js';
import performanceMonitor from '../services/performanceMonitor.js';
import cacheService from '../services/cacheService.js';
import { validate } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

/**
 * @route   GET /api/v1/monitoring/metrics
 * @desc    Get performance metrics (admin only)
 * @access  Private (Admin/Manager)
 */
router.get('/metrics', auth, async (req, res) => {
  try {
    // Check if user is admin or manager
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin or Manager role required.'
      });
    }

    const metrics = performanceMonitor.getMetrics();

    res.json({
      status: 'success',
      data: {
        metrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching metrics', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/monitoring/stats
 * @desc    Get global performance statistics
 * @access  Private (Admin/Manager)
 */
router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const stats = performanceMonitor.getStats();

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/monitoring/slow-queries
 * @desc    Get slow queries
 * @access  Private (Admin/Manager)
 */
router.get('/slow-queries', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const slowQueries = performanceMonitor.getSlowQueries(limit);

    res.json({
      status: 'success',
      data: {
        slowQueries,
        count: slowQueries.length,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/monitoring/top-slow
 * @desc    Get top slowest operations
 * @access  Private (Admin/Manager)
 */
router.get('/top-slow', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const topSlow = performanceMonitor.getTopSlowOperations(limit);

    res.json({
      status: 'success',
      data: {
        operations: topSlow,
        count: topSlow.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/monitoring/high-errors
 * @desc    Get operations with high error rates
 * @access  Private (Admin/Manager)
 */
router.get('/high-errors', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const threshold = parseInt(req.query.threshold) || 5;
    const highErrors = performanceMonitor.getHighErrorOperations(threshold);

    res.json({
      status: 'success',
      data: {
        operations: highErrors,
        threshold: `${threshold}%`,
        count: highErrors.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/monitoring/report
 * @desc    Get comprehensive performance report
 * @access  Private (Admin/Manager)
 */
router.get('/report', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const report = performanceMonitor.getReport();

    res.json({
      status: 'success',
      data: report
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/monitoring/cache-stats
 * @desc    Get cache statistics
 * @access  Private (Admin/Manager)
 */
router.get('/cache-stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const cacheStats = cacheService.getStats();

    res.json({
      status: 'success',
      data: {
        cache: cacheStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/monitoring/metrics/reset
 * @desc    Reset performance metrics
 * @access  Private (Admin only)
 */
router.post('/metrics/reset', auth, validate(mutationBaselineSchema), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin role required.'
      });
    }

    performanceMonitor.reset();
    cacheService.resetStats();

    res.json({
      status: 'success',
      message: 'Performance metrics reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/monitoring/cache/flush
 * @desc    Flush all cache
 * @access  Private (Admin only)
 */
router.post('/cache/flush', auth, validate(mutationBaselineSchema), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin role required.'
      });
    }

    const result = await cacheService.flushAll();

    if (result) {
      res.json({
        status: 'success',
        message: 'Cache flushed successfully'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to flush cache'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/monitoring/cache/invalidate-property/:propertyId
 * @desc    Invalidate cache for a specific property
 * @access  Private (Admin/Manager)
 */
router.post('/cache/invalidate-property/:propertyId', auth, validate(mutationBaselineSchema), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const { propertyId } = req.params;
    const deletedCount = await cacheService.invalidateProperty(propertyId);

    res.json({
      status: 'success',
      message: `Invalidated ${deletedCount} cache entries for property ${propertyId}`,
      data: {
        propertyId,
        deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/v1/monitoring/cache/invalidate-group/:groupId
 * @desc    Invalidate cache for a property group
 * @access  Private (Admin/Manager)
 */
router.post('/cache/invalidate-group/:groupId', auth, validate(mutationBaselineSchema), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const { groupId } = req.params;
    const deletedCount = await cacheService.invalidateGroup(groupId);

    res.json({
      status: 'success',
      message: `Invalidated ${deletedCount} cache entries for group ${groupId}`,
      data: {
        groupId,
        deletedCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/v1/monitoring/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cacheService.getStats()
  };

  res.json({
    status: 'success',
    data: health
  });
});

export default router;
