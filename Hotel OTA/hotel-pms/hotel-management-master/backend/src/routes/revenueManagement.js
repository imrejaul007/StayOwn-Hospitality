import express from 'express';
import revenueController from '../controllers/revenueManagementController.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import financialRateLimiter from '../middleware/financialRateLimiter.js';
import { validateFinancial, pricingRuleSchema } from '../middleware/financialValidation.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply rate limiting, authentication and property access to all revenue management routes
router.use(financialRateLimiter);
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Pricing Rules Routes
router.post('/pricing-rules', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), validateFinancial(pricingRuleSchema), revenueController.createPricingRule);
router.get('/pricing-rules', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getPricingRules);
router.put('/pricing-rules/:id', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.updatePricingRule);
router.delete('/pricing-rules/:id', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.deletePricingRule);

// Dynamic Pricing Routes
router.get('/dynamic-rate', authorizePolicy('revenueManagement', 'readAccess'), revenueController.calculateDynamicRate);

// Demand Forecasting Routes
router.post('/demand-forecast', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.generateDemandForecast);
router.get('/demand-forecast', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getDemandForecast);

// Rate Shopping Routes
router.post('/competitor-rates', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.addCompetitorRate);
router.get('/competitor-rates', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getCompetitorRates);
router.put('/competitor-rates', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.updateCompetitorRates);

// Package Management Routes
router.post('/packages', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.createPackage);
router.get('/packages', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getPackages);
router.put('/packages/:id', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.updatePackage);
router.delete('/packages/:id', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.deletePackage);

// Corporate Rates Routes
router.post('/corporate-rates', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.createCorporateRate);
router.get('/corporate-rates', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getCorporateRates);
router.put('/corporate-rates/:id', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.updateCorporateRate);
router.delete('/corporate-rates/:id', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.deleteCorporateRate);

// Revenue Analytics Routes
router.get('/analytics', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getRevenueAnalytics);
router.get('/analytics/summary', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getRevenueSummary);

// Optimization Routes
router.get('/optimization/recommendations', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getOptimizationRecommendations);

// Dashboard Metrics Route
router.get('/dashboard/metrics', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getDashboardMetrics);

// Room Type Rate Management Routes
router.put('/room-type-rates/:id', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.updateRoomTypeRate);
router.post('/room-type-rates/bulk-update', authorizePolicy('revenueManagement', 'manageAccess'), validate(mutationBaselineSchema), revenueController.bulkUpdateRoomTypeRates);

// Room Types for Dynamic Pricing
router.get('/room-types', authorizePolicy('revenueManagement', 'readAccess'), revenueController.getRoomTypesForPricing);

export default router;