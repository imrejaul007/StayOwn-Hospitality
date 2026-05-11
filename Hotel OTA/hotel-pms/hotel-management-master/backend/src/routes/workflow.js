import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { validate } from '../middleware/validation.js';
import WorkflowController from '../controllers/workflowController.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Workflow routes
router.post('/bulk-checkin', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), WorkflowController.bulkCheckIn);
router.post('/bulk-checkout', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), WorkflowController.bulkCheckOut);
router.post('/housekeeping', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), WorkflowController.scheduleHousekeeping);
router.post('/maintenance', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), WorkflowController.requestMaintenance);
router.post('/room-status', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), WorkflowController.updateRoomStatus);

// Analytics routes
router.get('/actions', authenticate, ensureTenantContext, ensurePropertyAccess, WorkflowController.getWorkflowActions);
router.get('/analytics/floor/:floorId', authenticate, ensureTenantContext, ensurePropertyAccess, WorkflowController.getFloorAnalytics);
router.get('/analytics/predictive', authenticate, ensureTenantContext, ensurePropertyAccess, WorkflowController.getPredictiveAnalytics);

// Upgrade Processing routes
router.get('/upgrades/suggestions', authenticate, ensureTenantContext, ensurePropertyAccess, WorkflowController.generateUpgradeSuggestions);
router.post('/upgrades/process', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), WorkflowController.processUpgrade);
router.get('/upgrades/analytics', authenticate, ensureTenantContext, ensurePropertyAccess, WorkflowController.getUpgradeAnalytics);

export default router;
