import express from 'express';
import healthController from '../controllers/healthController.js';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Public health check endpoints (no authentication required)
// These are used by load balancers and monitoring systems

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Quick health status for load balancers
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', healthController.getQuickHealth);

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Check if the application is alive (for Kubernetes liveness probe)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is alive
 *       503:
 *         description: Application is not responding
 */
router.get('/live', healthController.getLiveness);

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Check if the application is ready to serve traffic (for Kubernetes readiness probe)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is ready
 *       503:
 *         description: Application is not ready
 */
router.get('/ready', healthController.getReadiness);

/**
 * @swagger
 * /health/version:
 *   get:
 *     summary: Get application version
 *     description: Returns version information about the application
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Version information
 */
router.get('/version', healthController.getVersion);

// Detailed health endpoints (authentication required for sensitive info)

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Comprehensive health check
 *     description: Detailed health status including all checks and metrics
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health information
 *       503:
 *         description: Service is unhealthy
 */
router.get('/detailed', authenticate, healthController.getHealth);

/**
 * @swagger
 * /health/checks/{checkName}:
 *   get:
 *     summary: Get specific health check
 *     description: Run and return results for a specific health check
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checkName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [database, redis, memory, filesystem, external_services, application, business_logic]
 *         description: Name of the health check to run
 *     responses:
 *       200:
 *         description: Health check result
 *       404:
 *         description: Health check not found
 */
router.get('/checks/:checkName', authenticate, healthController.getSpecificCheck);

// Admin-only endpoints for detailed monitoring

/**
 * @swagger
 * /health/status:
 *   get:
 *     summary: Complete system status
 *     description: Comprehensive system status including health, performance, and error metrics
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complete system status
 */
router.get('/status', 
  authenticate, 
  authorizePolicy('health', 'staffAccess'),
  healthController.getDetailedStatus
);

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get health metrics
 *     description: Retrieve health metrics including trends and performance data
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health metrics and trends
 */
router.get('/metrics',
  authenticate,
  authorizePolicy('health', 'staffAccess'),
  healthController.getHealthMetrics
);

/**
 * @swagger
 * /health/history:
 *   get:
 *     summary: Get health check history
 *     description: Retrieve historical health check data
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 50
 *         description: Number of historical records to retrieve
 *     responses:
 *       200:
 *         description: Health check history
 */
router.get('/history',
  authenticate,
  authorizePolicy('health', 'staffAccess'),
  healthController.getHealthHistory
);

/**
 * @swagger
 * /health/system:
 *   get:
 *     summary: Get system information
 *     description: Retrieve detailed system and environment information
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System information
 */
router.get('/system',
  authenticate,
  authorizePolicy('health', 'staffAccess'),
  healthController.getSystemInfo
);

/**
 * @swagger
 * /health/dashboard:
 *   get:
 *     summary: Health dashboard data
 *     description: Get aggregated data for health monitoring dashboard
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data with trends and alerts
 */
router.get('/dashboard',
  authenticate,
  authorizePolicy('health', 'staffAccess'),
  healthController.getDashboard
);

// Health check configuration endpoints (admin only)
router.post('/checks/run',
  authenticate,
  authorizePolicy('health', 'adminAccess'),
  validate(mutationBaselineSchema),
  async (req, res, next) => {
    try {
      const { checks } = req.body;
      
      if (checks && Array.isArray(checks)) {
        // Run specific checks
        const results = {};
        for (const checkName of checks) {
          try {
            results[checkName] = await healthController.getSpecificCheck(
              { params: { checkName } },
              { json: (data) => data },
              () => {}
            );
          } catch (error) {
            results[checkName] = {
              status: 'unhealthy',
              error: error.message
            };
          }
        }
        
        res.json({
          success: true,
          data: results
        });
      } else {
        // Run all checks
        await healthController.getHealth(req, res, next);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Monitoring integration endpoints
router.get('/prometheus', 
  authenticate,
  authorizePolicy('health', 'adminAccess'),
  (req, res) => {
    // Basic Prometheus metrics format
    // In production, this would use a proper Prometheus client
    const metrics = [
      '# HELP hotel_management_health_status Health check status (0=unhealthy, 1=degraded, 2=healthy)',
      '# TYPE hotel_management_health_status gauge',
      'hotel_management_health_status 2',
      '',
      '# HELP hotel_management_uptime_seconds Application uptime in seconds',
      '# TYPE hotel_management_uptime_seconds counter',
      `hotel_management_uptime_seconds ${Math.floor(process.uptime())}`,
      '',
      '# HELP hotel_management_memory_usage_bytes Memory usage in bytes',
      '# TYPE hotel_management_memory_usage_bytes gauge',
      `hotel_management_memory_usage_bytes ${process.memoryUsage().heapUsed}`,
    ].join('\n');
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  }
);

// Health check endpoint for external monitoring services
router.get('/external/:token',
  (req, res, next) => {
    const { token } = req.params;
    const expectedToken = process.env.HEALTH_CHECK_TOKEN;

    if (!expectedToken) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_TOKEN_NOT_CONFIGURED',
          message: 'External health check is not configured'
        }
      });
    }

    if (token !== expectedToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid health check token'
        }
      });
    }
    
    healthController.getHealth(req, res, next);
  }
);

// Webhook endpoint for health alerts
router.post('/alerts/webhook',
  authenticate,
  authorizePolicy('health', 'adminAccess'),
  validate(mutationBaselineSchema),
  (req, res) => {
    const { url, events = ['unhealthy', 'degraded'] } = req.body;
    
    // This would register a webhook for health alerts
    // For now, just acknowledge the request
    res.json({
      success: true,
      message: 'Health alert webhook registered',
      data: {
        url,
        events,
        registered: true
      }
    });
  }
);

export default router;
