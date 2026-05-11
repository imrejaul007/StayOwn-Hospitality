import express from 'express';
import webOptimizationController from '../controllers/webOptimizationController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('webSettings', 'adminAccess'));

router.post('/:hotelId/ab-tests', validate(mutationBaselineSchema), webOptimizationController.createABTest);
router.get('/:hotelId/ab-tests', webOptimizationController.getABTests);
router.get('/:hotelId/ab-tests/:testId', webOptimizationController.getABTest);
router.put('/:hotelId/ab-tests/:testId', validate(mutationBaselineSchema), webOptimizationController.updateABTest);
router.delete('/:hotelId/ab-tests/:testId', validate(mutationBaselineSchema), webOptimizationController.deleteABTest);
router.post('/:hotelId/ab-tests/:testId/start', validate(mutationBaselineSchema), webOptimizationController.startABTest);
router.post('/:hotelId/ab-tests/:testId/stop', validate(mutationBaselineSchema), webOptimizationController.stopABTest);
router.post('/:hotelId/ab-tests/:testId/record-conversion', validate(mutationBaselineSchema), webOptimizationController.recordABTestConversion);
router.get('/:hotelId/ab-tests/:testId/results', webOptimizationController.getABTestResults);

router.post('/:hotelId/performance/record', validate(mutationBaselineSchema), webOptimizationController.recordPerformanceMetric);
router.get('/:hotelId/performance/report', webOptimizationController.getPerformanceReport);
router.get('/:hotelId/performance/vitals', webOptimizationController.getWebVitals);

router.post('/:hotelId/behavior/record', validate(mutationBaselineSchema), webOptimizationController.recordUserBehavior);
router.get('/:hotelId/behavior/heatmap', webOptimizationController.getHeatmapData);
router.get('/:hotelId/behavior/analytics', webOptimizationController.getUserBehaviorAnalytics);

router.post('/:hotelId/conversion/funnel', validate(mutationBaselineSchema), webOptimizationController.createConversionFunnel);
router.get('/:hotelId/conversion/funnels', webOptimizationController.getConversionFunnels);
router.get('/:hotelId/conversion/funnel/:funnelId/report', webOptimizationController.getConversionFunnelReport);

router.post('/:hotelId/personalization/rules', validate(mutationBaselineSchema), webOptimizationController.createPersonalizationRule);
router.get('/:hotelId/personalization/rules', webOptimizationController.getPersonalizationRules);
router.put('/:hotelId/personalization/rules/:ruleId', validate(mutationBaselineSchema), webOptimizationController.updatePersonalizationRule);
router.delete('/:hotelId/personalization/rules/:ruleId', validate(mutationBaselineSchema), webOptimizationController.deletePersonalizationRule);
router.post('/:hotelId/personalization/execute', validate(mutationBaselineSchema), webOptimizationController.executePersonalization);

router.get('/:hotelId/optimization/report', webOptimizationController.getOptimizationReport);
router.get('/:hotelId/optimization/recommendations', webOptimizationController.getOptimizationRecommendations);

export default router;