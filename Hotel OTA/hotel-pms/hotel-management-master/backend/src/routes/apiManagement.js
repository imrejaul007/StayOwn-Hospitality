import express from 'express';
import apiManagementController from '../controllers/apiManagementController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { validate, schemas } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Rate limiting for API management operations
const apiManagementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API management requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// router.use(apiManagementRateLimit); // Disabled to prevent crashes

// API Keys Management
router.route('/api-keys')
  .get(authorizePolicy('apiManagement', 'manageAccess'), apiManagementController.getAPIKeys)
  .post(authorizePolicy('apiManagement', 'adminAccess'), validate(mutationBaselineSchema), validate(schemas.createAPIKey), apiManagementController.createAPIKey);

router.route('/api-keys/:id')
  .get(authorizePolicy('apiManagement', 'manageAccess'), apiManagementController.getAPIKeyById)
  .put(authorizePolicy('apiManagement', 'adminAccess'), validate(mutationBaselineSchema), validate(schemas.updateAPIKey), apiManagementController.updateAPIKey)
  .delete(authorizePolicy('apiManagement', 'adminAccess'), validate(mutationBaselineSchema), apiManagementController.deleteAPIKey);

router.patch('/api-keys/:id/toggle', 
  authorizePolicy('apiManagement', 'adminAccess'),
  validate(mutationBaselineSchema),
  apiManagementController.toggleAPIKeyStatus
);

// Webhook Management
router.route('/webhooks')
  .get(authorizePolicy('apiManagement', 'manageAccess'), apiManagementController.getWebhooks)
  .post(authorizePolicy('apiManagement', 'adminAccess'), validate(mutationBaselineSchema), validate(schemas.createWebhook), apiManagementController.createWebhook);

router.route('/webhooks/:id')
  .get(authorizePolicy('apiManagement', 'manageAccess'), apiManagementController.getWebhookById)
  .put(authorizePolicy('apiManagement', 'adminAccess'), validate(mutationBaselineSchema), validate(schemas.updateWebhook), apiManagementController.updateWebhook)
  .delete(authorizePolicy('apiManagement', 'adminAccess'), validate(mutationBaselineSchema), apiManagementController.deleteWebhook);

router.post('/webhooks/:id/test', 
  authorizePolicy('apiManagement', 'adminAccess'),
  validate(mutationBaselineSchema),
  apiManagementController.testWebhook
);

router.post('/webhooks/:id/regenerate-secret', 
  authorizePolicy('apiManagement', 'adminAccess'),
  validate(mutationBaselineSchema),
  apiManagementController.regenerateWebhookSecret
);

// API Endpoints Catalog
router.get('/endpoints',
  authorizePolicy('apiManagement', 'manageAccess'),
  apiManagementController.getAllEndpoints
);

// Metrics and Analytics
router.get('/metrics',
  authorizePolicy('apiManagement', 'manageAccess'),
  apiManagementController.getMetrics
);

router.get('/metrics/endpoints',
  authorizePolicy('apiManagement', 'manageAccess'),
  apiManagementController.getTopEndpoints
);

router.get('/metrics/endpoints/:endpoint', 
  authorizePolicy('apiManagement', 'manageAccess'),
  apiManagementController.getEndpointMetrics
);

router.get('/metrics/api-keys', 
  authorizePolicy('apiManagement', 'manageAccess'),
  apiManagementController.getAPIKeyUsage
);

router.get('/metrics/webhooks', 
  authorizePolicy('apiManagement', 'manageAccess'),
  apiManagementController.getWebhookStats
);

// Export functionality
router.get('/export/logs',
  authorizePolicy('apiManagement', 'adminAccess'),
  apiManagementController.exportLogs
);

// API Documentation
router.get('/documentation',
  authorizePolicy('apiManagement', 'manageAccess'),
  apiManagementController.getAPIDocumentation
);

export default router;