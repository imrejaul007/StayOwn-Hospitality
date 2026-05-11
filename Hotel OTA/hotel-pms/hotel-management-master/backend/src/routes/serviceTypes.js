import express from 'express';
import Joi from 'joi';
import {
  getServiceTypes,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  addVariation,
  addTemplate,
  calculatePrice,
  getServiceTypeStats
} from '../controllers/serviceTypeController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validateRoles } from '../middleware/roleValidation.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

/**
 * @swagger
 * tags:
 *   name: Admin - Service Types
 *   description: Service type management endpoints for hotel administrators
 */

// Apply authentication middleware to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('serviceTypes', 'baseAccess'));

/**
 * Service Type CRUD Operations
 */

// GET /admin/service-types - Get all service types for a hotel
router.get('/', getServiceTypes);

// GET /admin/service-types/stats - Get service type statistics
router.get('/stats', getServiceTypeStats);

// GET /admin/service-types/:id - Get specific service type
router.get('/:id', getServiceTypeById);

// POST /admin/service-types - Create new service type (Manager+ only)
router.post('/', validateRoles(['admin', 'manager']), validate(mutationBaselineSchema), createServiceType);

// PUT /admin/service-types/:id - Update service type (Manager+ only)
router.put('/:id', validateRoles(['admin', 'manager']), validate(mutationBaselineSchema), updateServiceType);

// DELETE /admin/service-types/:id - Delete service type (Manager+ only)
router.delete('/:id', validateRoles(['admin', 'manager']), validate(mutationBaselineSchema), deleteServiceType);

/**
 * Service Type Variations
 */

// POST /admin/service-types/:id/variations - Add variation to service type
router.post('/:id/variations', validateRoles(['admin', 'manager']), validate(mutationBaselineSchema), addVariation);

/**
 * Service Type Templates
 */

// POST /admin/service-types/:id/templates - Add template to service type
router.post('/:id/templates', validateRoles(['admin', 'manager']), validate(mutationBaselineSchema), addTemplate);

/**
 * Pricing Calculations
 */

// POST /admin/service-types/:type/calculate-price - Calculate price with variations
router.post('/:type/calculate-price', validate(mutationBaselineSchema), calculatePrice);

export default router;