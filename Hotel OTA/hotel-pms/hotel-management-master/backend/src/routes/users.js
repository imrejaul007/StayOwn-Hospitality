import express from 'express';
import Joi from 'joi';
import * as userManagementController from '../controllers/userManagementController.js';
import * as userCreationController from '../controllers/userCreationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(authorizePolicy('users', 'baseAccess'));

// User creation and management routes (admin and manager only)
// Generate password endpoint (must come before :userId routes to avoid conflict)
router.get('/generate-password', authorize('admin', 'manager'), userCreationController.generatePassword);

// Create new user
router.post('/create', authorize('admin', 'manager'), validate(mutationBaselineSchema), userCreationController.createUser);

// Get list of users (frontdesk and staff can view guests for booking creation)
router.get('/', authorize('admin', 'manager', 'staff', 'frontdesk'), ensurePropertyAccess, userCreationController.getUsers);

// Get, update, delete specific user
router.route('/:userId')
  .get(authorize('admin', 'manager'), userCreationController.getUserById)
  .put(authorize('admin', 'manager'), userCreationController.updateUser)
  .delete(authorize('admin', 'manager'), userCreationController.deleteUser);

// User profile routes.
// SECURITY: Guests can only access their OWN profile. Staff/admin/manager/frontdesk can
// access profiles within their hotel. The controller MUST enforce ownership for guest role.
// Use a middleware to enforce this before hitting the controller.
const enforceProfileOwnership = (req, res, next) => {
  const { userId } = req.params;
  const requestingUser = req.user;

  // Guests and travel agents may only access their own profile
  if (['guest', 'travel_agent'].includes(requestingUser.role)) {
    const requestingUserId = requestingUser._id?.toString() || requestingUser.id?.toString();
    if (userId !== requestingUserId) {
      return next(new ApplicationError('You can only access your own profile', 403));
    }
  }
  next();
};

router.route('/:userId/profile')
  .get(enforceProfileOwnership, ensurePropertyAccess, userManagementController.getUserBillingDetails)
  .put(enforceProfileOwnership, ensurePropertyAccess, userManagementController.updateUserProfile);

// User billing details routes.
// SECURITY: Same ownership enforcement — guests can only view/update their own billing info.
router.route('/:userId/billing')
  .get(enforceProfileOwnership, ensurePropertyAccess, userManagementController.getUserBillingDetails)
  .put(enforceProfileOwnership, ensurePropertyAccess, userManagementController.updateUserBillingDetails);

// GST validation utility
router.post('/validate-gst', validate(mutationBaselineSchema), userManagementController.validateGSTNumber);

export default router;