import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { guestManagementController } from '../controllers/guestManagementController.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication and authorization to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('guestManagement', 'managerAccess'));

// Guest Management Overview
router.get('/overview', guestManagementController.getGuestManagementOverview);

// Account Attributes Routes
router.route('/account-attributes')
  .get(guestManagementController.getAccountAttributes)
  .post(guestManagementController.createAccountAttribute);

router.route('/account-attributes/:id')
  .get(guestManagementController.getAccountAttribute)
  .patch(guestManagementController.updateAccountAttribute)
  .delete(guestManagementController.deleteAccountAttribute);

// Guest Types Routes
router.route('/guest-types')
  .get(guestManagementController.getGuestTypes)
  .post(guestManagementController.createGuestType);

router.route('/guest-types/:id')
  .get(guestManagementController.getGuestType)
  .patch(guestManagementController.updateGuestType)
  .delete(guestManagementController.deleteGuestType);

router.post('/guest-types/:id/duplicate', validate(mutationBaselineSchema), guestManagementController.duplicateGuestType);

// Identification Types Routes
router.route('/identification-types')
  .get(guestManagementController.getIdentificationTypes)
  .post(guestManagementController.createIdentificationType);

router.route('/identification-types/:id')
  .get(guestManagementController.getIdentificationType)
  .patch(guestManagementController.updateIdentificationType)
  .delete(guestManagementController.deleteIdentificationType);

// Utility Routes
router.post('/validate', validate(mutationBaselineSchema), guestManagementController.validateGuestData);
router.patch('/display-order', validate(mutationBaselineSchema), guestManagementController.bulkUpdateDisplayOrder);

// Analytics Routes
router.get('/analytics/account-attributes', guestManagementController.getAccountAttributeAnalytics);
router.get('/analytics/guest-types', guestManagementController.getGuestTypeAnalytics);
router.get('/analytics/identification-types', guestManagementController.getIdentificationTypeAnalytics);

export default router;
