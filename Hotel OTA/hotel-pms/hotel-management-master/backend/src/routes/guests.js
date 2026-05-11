import express from 'express';
import Joi from 'joi';
import * as guestController from '../controllers/guestController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext, requireTenantInBulkOps } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Middleware: enforce guest self-service ownership — guests can only access their own profile
const enforceGuestOwnership = (req, res, next) => {
  if (req.user.role === 'guest') {
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Guests can only access their own profile'
      });
    }
  }
  next();
};

// Apply authentication and property access to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('guests', 'baseAccess'));

// Helper: admin/staff authorization
const staffAuth = authorize('admin', 'manager', 'staff', 'frontdesk');

// --- Named routes MUST come before /:id param catch-all ---
// Admin/Staff list and management routes
router.route('/')
  .get(staffAuth, guestController.getAllGuests)
  .post(staffAuth, guestController.createGuest);

router.route('/analytics')
  .get(staffAuth, guestController.getGuestAnalytics);

router.route('/search')
  .post(staffAuth, guestController.searchGuests);

router.route('/export')
  .get(staffAuth, guestController.exportGuests);

router.route('/bulk-update')
  .patch(staffAuth, requireTenantInBulkOps, guestController.bulkUpdateGuests);

// --- /:id routes come AFTER named routes ---
// Guest self-service: guests can only view/update their own profile
router.get('/:id', enforceGuestOwnership, guestController.getGuest);
router.get('/:id/bookings', enforceGuestOwnership, guestController.getGuest);
router.patch('/:id', enforceGuestOwnership, validate(mutationBaselineSchema), guestController.updateGuest);

// Admin/Staff delete (only staff+ can delete guests)
router.delete('/:id', staffAuth, guestController.deleteGuest);

export default router;
