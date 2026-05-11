import express from 'express';
import dayUseController from '../controllers/dayUseController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import adminAuth from '../middleware/adminAuth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Public routes (authenticated users)
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('dayUse', 'baseAccess'));

// Slot availability and information (accessible to all authenticated users)
router.get('/slots', dayUseController.getSlots);
router.get('/slots/available/:date', dayUseController.getAvailableSlots);
router.get('/slots/:id', dayUseController.getSlotById);
router.get('/slots/:slotId/availability', dayUseController.checkSlotAvailability);

// Booking management (accessible to all authenticated users)
router.post('/bookings', validate(mutationBaselineSchema), dayUseController.createBooking);
router.get('/bookings', dayUseController.getBookings);
router.get('/bookings/:id', dayUseController.getBookingById);
router.put('/bookings/:id', validate(mutationBaselineSchema), dayUseController.updateBooking);
router.post('/bookings/:id/cancel', validate(mutationBaselineSchema), dayUseController.cancelBooking);
router.post('/bookings/:id/notes', validate(mutationBaselineSchema), dayUseController.addBookingNote);

// Check-in/Check-out operations (staff and admin only)
router.use(adminAuth);

router.post('/bookings/:id/checkin', validate(mutationBaselineSchema), dayUseController.checkInBooking);
router.post('/bookings/:id/checkout', validate(mutationBaselineSchema), dayUseController.checkOutBooking);

// Slot management (admin only)
router.post('/slots', validate(mutationBaselineSchema), dayUseController.createSlot);
router.put('/slots/:id', validate(mutationBaselineSchema), dayUseController.updateSlot);
router.delete('/slots/:id', validate(mutationBaselineSchema), dayUseController.deleteSlot);

// Analytics and reporting (admin only)
router.get('/analytics', dayUseController.getAnalytics);
router.get('/analytics/slots/:slotId/performance', dayUseController.getSlotPerformance);
router.get('/analytics/revenue', dayUseController.getRevenueReport);
router.get('/analytics/occupancy/:date', dayUseController.getOccupancyReport);
router.get('/schedule/today', dayUseController.getTodaySchedule);

export default router;
