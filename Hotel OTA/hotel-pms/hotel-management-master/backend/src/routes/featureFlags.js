import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { catchAsync } from '../utils/catchAsync.js';
import featureFlagService from '../services/featureFlagService.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

router.use(authenticate);
router.use(ensureTenantContext);

// Get all feature flags
router.get('/', catchAsync(async (req, res) => {
  const flags = await featureFlagService.getAll();
  res.json({ status: 'success', data: { flags } });
}));

// Check specific flag
router.get('/:flagName', catchAsync(async (req, res) => {
  const hotelId = req.query.hotelId || req.user.hotelId;
  const enabled = await featureFlagService.isEnabled(req.params.flagName, hotelId);
  res.json({ status: 'success', data: { flag: req.params.flagName, enabled } });
}));

// Toggle flag (admin only)
router.post('/:flagName', authorizePolicy('featureFlags', 'adminAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { enabled, hotelId } = req.body;
  if (enabled) {
    await featureFlagService.enable(req.params.flagName, hotelId);
  } else {
    await featureFlagService.disable(req.params.flagName, hotelId);
  }
  res.json({ status: 'success', message: `Flag ${req.params.flagName} ${enabled ? 'enabled' : 'disabled'}` });
}));

export default router;
