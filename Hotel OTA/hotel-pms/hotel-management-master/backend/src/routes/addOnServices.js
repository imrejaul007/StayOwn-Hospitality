import express from 'express';
import addOnController from '../controllers/addOnController.js';
import { authenticate } from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Public routes (accessible by authenticated users)
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Get services with filtering and pagination
router.get('/', addOnController.getServices);

// Get service categories
router.get('/categories', addOnController.getCategories);

// Get featured services
router.get('/featured', addOnController.getFeaturedServices);

// Get upsell recommendations
router.get('/upsell-recommendations', addOnController.getUpsellRecommendations);

// Get service by ID
router.get('/:id', addOnController.getServiceById);

// Check service availability
router.get('/:serviceId/availability', addOnController.checkAvailability);

// Get service pricing
router.get('/:serviceId/pricing', addOnController.getServicePricing);

// Book a service
router.post('/:serviceId/book', authorizePolicy('addOnServices', 'bookService'), validate(mutationBaselineSchema), addOnController.bookService);

// Get service analytics (for service owners)
router.get('/:serviceId/analytics', addOnController.getServiceAnalytics);

// Service Inclusions routes
router.get('/inclusions/list', addOnController.getInclusions);
router.get('/inclusions/package/:packageId', addOnController.getPackageInclusions);
router.post('/inclusions/:id/redeem', authorizePolicy('addOnServices', 'redeemInclusion'), validate(mutationBaselineSchema), addOnController.processRedemption);

// Admin-only routes
router.use(adminAuth);

// Service Management
router.post('/', authorizePolicy('addOnServices', 'createService'), validate(mutationBaselineSchema), addOnController.createService);
router.put('/:id', authorizePolicy('addOnServices', 'updateService'), validate(mutationBaselineSchema), addOnController.updateService);
router.delete('/:id', authorizePolicy('addOnServices', 'deleteService'), validate(mutationBaselineSchema), addOnController.deleteService);

// Bulk operations
router.post('/bulk', authorizePolicy('addOnServices', 'bulkCreateServices'), validate(mutationBaselineSchema), addOnController.bulkCreateServices);

// Service Inclusions Management
router.post('/inclusions', authorizePolicy('addOnServices', 'createInclusion'), validate(mutationBaselineSchema), addOnController.createInclusion);
router.put('/inclusions/:id', authorizePolicy('addOnServices', 'updateInclusion'), validate(mutationBaselineSchema), addOnController.updateInclusion);

export default router;
