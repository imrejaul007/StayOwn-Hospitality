import express from 'express';
import Joi from 'joi';
import {
  getTravelDashboardOverview,
  getTravelAnalytics,
  getPendingCommissions,
  getTravelAgentRates,
  exportTravelData,
  getAdvancedBookingTrends,
  getRevenueForecastAnalytics,
  getCommissionProjections,
  getAllPerformanceMetrics,
  getTimeSeriesAnalytics,
  createComprehensiveExport
} from '../controllers/adminTravelDashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

logger.debug('Travel dashboard routes loading with FRONTDESK permission enabled');

// Apply authentication to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('adminTravelDashboard', 'baseAccess'));

// Apply authorization - admin, manager, staff, and frontdesk can access travel dashboard
logger.debug('Travel dashboard routes: authorize middleware set for admin, manager, staff, frontdesk');
router.use(authorize('admin', 'manager', 'staff', 'frontdesk'));
router.use(ensurePropertyAccess);

// Travel dashboard routes
router.get('/', getTravelDashboardOverview);
router.get('/overview', getTravelDashboardOverview); // Alias for frontend compatibility
router.get('/agents', getTravelDashboardOverview); // Alias for frontend compatibility
router.get('/analytics', getTravelAnalytics);
router.get('/pending-commissions', getPendingCommissions);
router.get('/rates', getTravelAgentRates);
router.get('/export', exportTravelData);

// Advanced analytics routes
router.get('/analytics/trends', getAdvancedBookingTrends);
router.get('/analytics/forecast', getRevenueForecastAnalytics);
router.get('/analytics/commission-projections', getCommissionProjections);
router.get('/analytics/performance', getAllPerformanceMetrics);
router.get('/analytics/time-series', getTimeSeriesAnalytics);

// Advanced export routes
router.post('/export/comprehensive', validate(mutationBaselineSchema), createComprehensiveExport);

export default router;