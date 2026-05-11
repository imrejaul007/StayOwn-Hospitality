import express from 'express';
import Joi from 'joi';
import { catchAsync } from '../utils/catchAsync.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { CancellationRefundService } from '../services/cancellationRefundService.js';
import { validate } from '../middleware/validation.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import Stripe from 'stripe';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Initialize (Stripe only if configured)
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch { /* Stripe not available */ }

const cancellationService = new CancellationRefundService({
  Booking,
  Payment,
  RoomAvailability: null, // Will use if model exists
  stripe,
});

// Cancel a booking with automatic refund
router.post(
  '/:bookingId/cancel',
  authenticate, ensureTenantContext,
  authorizePolicy('cancellations', 'baseAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const hotelId = req.user.hotelId || req.user.hotel;
    const { reason, skipRefund } = req.body;

    const result = await cancellationService.cancelBooking(bookingId, hotelId, {
      reason,
      cancelledBy: req.user._id || req.user.id,
      skipRefund,
    });

    res.status(200).json({
      status: 'success',
      data: result,
      message: 'Booking cancelled successfully',
    });
  })
);

// Preview cancellation (calculate refund without executing)
router.get(
  '/:bookingId/cancel-preview',
  authenticate, ensureTenantContext,
  catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const hotelId = req.user.hotelId || req.user.hotel;

    const booking = await Booking.findOne({ _id: bookingId, hotelId }).lean();
    if (!booking) throw new ApplicationError('Booking not found', 404);

    const refundCalc = cancellationService.calculateRefund(booking);

    res.status(200).json({
      status: 'success',
      data: {
        bookingId,
        currentStatus: booking.status,
        canCancel: ['pending', 'confirmed'].includes(booking.status),
        refund: refundCalc,
      },
    });
  })
);

export default router;
