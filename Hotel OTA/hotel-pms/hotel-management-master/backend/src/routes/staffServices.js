import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import {
  getMyAssignedServices,
  getMyServiceRequests,
  getServiceRequestDetails,
  updateServiceRequestStatus,
  addNotesToRequest,
  getStaffServiceDashboard
} from '../controllers/staffServicesController.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication, tenant context, and staff authorization to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('staffServices', 'staffAccess'));

/**
 * @swagger
 * tags:
 *   name: Staff - Services
 *   description: Staff service management and request handling
 */

// Dashboard
router.get('/dashboard', getStaffServiceDashboard);

// Staff's assigned services
router.get('/my-services', getMyAssignedServices);

// Staff's service requests
router.get('/my-requests', getMyServiceRequests);

// Individual request management
router.route('/requests/:id')
  .get(getServiceRequestDetails)
  .patch(updateServiceRequestStatus);

// Request actions
router.patch('/requests/:id/update-status', validate(mutationBaselineSchema), updateServiceRequestStatus);
router.patch('/requests/:id/add-notes', validate(mutationBaselineSchema), addNotesToRequest);

export default router;