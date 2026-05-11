import express from 'express';
import {
  createRate,
  distributeRate,
  getRates,
  getRateById,
  updateRate,
  deleteRate,
  calculateRate,
  resolveConflict,
  getConflicts,
  getRateAnalytics,
  syncRates,
  previewRateDistribution,
  getRateHistory,
  exportRates,
  getGroupDashboard,
  validateRate,
  duplicateRate,
  updateRateStatus
} from '../controllers/centralizedRateController.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true);

// Apply authentication to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('centralizedRates', 'baseAccess'));

// Rate CRUD operations
router.post('/', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), createRate);
router.get('/', getRates);
router.get('/:rateId', getRateById);
router.put('/:rateId', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), updateRate);
router.delete('/:rateId', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), deleteRate);

// Rate operations
router.post('/:rateId/distribute', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), distributeRate);
router.post('/:rateId/calculate', validate(mutationBaselineSchema), calculateRate);
router.get('/:rateId/validate', validateRate);
router.post('/:rateId/duplicate', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), duplicateRate);
router.patch('/:rateId/status', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), updateRateStatus);

// Distribution and sync
router.post('/:rateId/preview-distribution', validate(mutationBaselineSchema), previewRateDistribution);
router.post('/group/:groupId/sync', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), syncRates);

// Analytics and reporting
router.get('/:rateId/analytics', getRateAnalytics);
router.get('/:rateId/history', getRateHistory);
router.get('/group/:groupId/dashboard', getGroupDashboard);
router.get('/export', authorizePolicy('centralizedRates', 'manageAccess'), exportRates);

// Conflict management
router.get('/conflicts', getConflicts);
router.post('/conflicts/:conflictId/resolve', authorizePolicy('centralizedRates', 'manageAccess'), validate(mutationBaselineSchema), resolveConflict);

export default router;
