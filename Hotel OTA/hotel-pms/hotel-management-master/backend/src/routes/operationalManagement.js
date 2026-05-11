import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { operationalManagementController } from '../controllers/operationalManagementController.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication, authorization, and property access to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(authorizePolicy('operationalManagement', 'modifyAccess'));
router.use(ensurePropertyAccess);

// Operational Management Overview
router.get('/overview', operationalManagementController.getOperationalOverview);

// Counter Routes
router.route('/counters')
  .get(operationalManagementController.getCounters)
  .post(validate(mutationBaselineSchema), operationalManagementController.createCounter);

router.route('/counters/:id')
  .get(operationalManagementController.getCounter)
  .patch(validate(mutationBaselineSchema), operationalManagementController.updateCounter)
  .delete(validate(mutationBaselineSchema), operationalManagementController.deleteCounter);

router.patch('/counters/:id/status', validate(mutationBaselineSchema), operationalManagementController.updateCounterStatus);

// Arrival/Departure Mode Routes
router.route('/arrival-departure-modes')
  .get(operationalManagementController.getArrivalDepartureModes)
  .post(validate(mutationBaselineSchema), operationalManagementController.createArrivalDepartureMode);

router.route('/arrival-departure-modes/:id')
  .get(operationalManagementController.getArrivalDepartureMode)
  .patch(validate(mutationBaselineSchema), operationalManagementController.updateArrivalDepartureMode)
  .delete(validate(mutationBaselineSchema), operationalManagementController.deleteArrivalDepartureMode);

// Lost & Found Routes
router.route('/lost-found')
  .get(operationalManagementController.getLostFoundItems)
  .post(validate(mutationBaselineSchema), operationalManagementController.createLostFoundItem);

router.route('/lost-found/:id')
  .get(operationalManagementController.getLostFoundItem)
  .patch(validate(mutationBaselineSchema), operationalManagementController.updateLostFoundItem);

router.patch('/lost-found/:id/claim', validate(mutationBaselineSchema), operationalManagementController.claimLostFoundItem);
router.patch('/lost-found/:id/dispose', validate(mutationBaselineSchema), operationalManagementController.disposeLostFoundItem);
router.patch('/lost-found/:id/location', validate(mutationBaselineSchema), operationalManagementController.updateLostFoundItemLocation);

// Bulk Operations
router.patch('/counters/bulk-status', validate(mutationBaselineSchema), operationalManagementController.bulkUpdateCounterStatus);
router.patch('/lost-found/bulk-dispose-expired', validate(mutationBaselineSchema), operationalManagementController.bulkDisposeExpiredItems);

// Analytics Routes
router.get('/analytics/counters', operationalManagementController.getCounterAnalytics);
router.get('/analytics/modes', operationalManagementController.getModeAnalytics);
router.get('/analytics/lost-found', operationalManagementController.getLostFoundAnalytics);

// Special Queries
router.get('/lost-found/expired', operationalManagementController.getExpiredLostFoundItems);
router.get('/lost-found/valuable', operationalManagementController.getValuableLostFoundItems);

export default router;
