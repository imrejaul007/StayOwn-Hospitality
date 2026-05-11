import express from 'express';
import auditTrailController from '../controllers/auditTrailController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All audit trail routes require authentication
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Get all audit logs with filtering and pagination
router.get('/', authorizePolicy('auditTrail', 'adminAccess'), auditTrailController.getAuditLogs);

// Get audit statistics and analytics
router.get('/stats', authorizePolicy('auditTrail', 'adminAccess'), auditTrailController.getAuditStats);

// Get audit trail for specific entity
router.get('/entity/:entityType/:entityId', authorizePolicy('auditTrail', 'staffAccess'), auditTrailController.getEntityAuditTrail);

// Get specific audit log by ID
router.get('/:id', authorizePolicy('auditTrail', 'adminAccess'), auditTrailController.getAuditLogById);

// Create manual audit log entry (admin only)
router.post('/', authorizePolicy('auditTrail', 'adminAccess'), validate(mutationBaselineSchema), auditTrailController.createAuditLog);

// Clean up old audit logs (admin only)
router.delete('/cleanup', authorizePolicy('auditTrail', 'adminAccess'), validate(mutationBaselineSchema), auditTrailController.cleanupAuditLogs);

// Mark audit log as reconciled
router.put('/:id/reconcile', authorizePolicy('auditTrail', 'adminAccess'), validate(mutationBaselineSchema), auditTrailController.reconcileAuditLog);

export default router;
