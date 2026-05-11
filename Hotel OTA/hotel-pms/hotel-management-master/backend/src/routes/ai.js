import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';

const router = express.Router();

// Protect all AI routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

const notImplementedResponse = (req, res) => {
  res.status(501).json({
    status: 'error',
    message: 'AI features require ML service integration. Not available in current deployment.',
    data: null
  });
};

/**
 * @swagger
 * /api/v1/ai/dashboard:
 *   get:
 *     summary: Get AI dashboard data
 *     tags: [AI Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       501:
 *         description: AI features not available
 */
router.get('/dashboard', notImplementedResponse);

/**
 * @swagger
 * /api/v1/ai/insights:
 *   get:
 *     summary: Get AI insights
 *     tags: [AI Analytics]
 */
router.get('/insights', notImplementedResponse);

/**
 * @swagger
 * /api/v1/ai/forecast/demand:
 *   get:
 *     summary: Get demand forecast
 *     tags: [AI Analytics]
 */
router.get('/forecast/demand', notImplementedResponse);

/**
 * @swagger
 * /api/v1/ai/forecast/revenue:
 *   get:
 *     summary: Get revenue forecast
 *     tags: [AI Analytics]
 */
router.get('/forecast/revenue', notImplementedResponse);

/**
 * @swagger
 * /api/v1/ai/pricing/recommendations:
 *   get:
 *     summary: Get pricing recommendations
 *     tags: [AI Analytics]
 */
router.get('/pricing/recommendations', notImplementedResponse);

/**
 * @swagger
 * /api/v1/ai/model/health:
 *   get:
 *     summary: Get AI model health status
 *     tags: [AI Analytics]
 */
router.get('/model/health', notImplementedResponse);

export default router;
