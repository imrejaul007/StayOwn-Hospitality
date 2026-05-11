import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Cancellation & Refund Service
 * Handles the complete cancellation workflow:
 * 1. Validate cancellation is allowed
 * 2. Calculate refund based on cancellation policy
 * 3. Process refund via payment provider
 * 4. Release room inventory
 * 5. Send notifications
 */
class CancellationRefundService {
  constructor({ Booking, Payment, RoomAvailability, stripe }) {
    this.Booking = Booking;
    this.Payment = Payment;
    this.RoomAvailability = RoomAvailability;
    this.stripe = stripe;
  }

  /**
   * Cancel a booking and process refund.
   * @param {string} bookingId
   * @param {string} hotelId
   * @param {object} options - { reason, cancelledBy, skipRefund }
   */
  async cancelBooking(bookingId, hotelId, options = {}) {
    const { reason = 'Guest requested', cancelledBy = 'system', skipRefund = false } = options;

    const session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        try {
          // 1. Fetch and validate booking
          const booking = await this.Booking.findOne({ _id: bookingId, hotelId }).session(session);
          if (!booking) throw new Error('Booking not found');

          const allowedStatuses = ['pending', 'confirmed'];
          if (!allowedStatuses.includes(booking.status)) {
            throw new Error(`Cannot cancel booking in "${booking.status}" status. Only pending/confirmed bookings can be cancelled.`);
          }

          // 2. Calculate refund amount
          const refundCalc = this.calculateRefund(booking);

          // 3. Update booking status
          booking.status = 'cancelled';
          booking.cancellationReason = reason;
          booking.cancelledBy = cancelledBy;
          booking.cancelledAt = new Date();
          booking.refundAmount = refundCalc.refundAmount;
          booking.cancellationFee = refundCalc.cancellationFee;
          await booking.save({ session });

          // 4. Release room inventory
          await this.releaseRoomInventory(booking, session);

          // 5. Process refund (if applicable)
          let refundResult = null;
          if (!skipRefund && refundCalc.refundAmount > 0) {
            refundResult = await this.processRefund(booking, refundCalc.refundAmount);
          }

          result = {
            success: true,
            bookingId: booking._id,
            previousStatus: 'confirmed',
            newStatus: 'cancelled',
            refund: {
              originalAmount: refundCalc.originalAmount,
              refundAmount: refundCalc.refundAmount,
              cancellationFee: refundCalc.cancellationFee,
              refundPercentage: refundCalc.refundPercentage,
              policy: refundCalc.policyApplied,
              stripeRefundId: refundResult?.id || null,
            },
            roomsReleased: true,
          };
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });
    } finally {
      session.endSession();
    }

    return result;
  }

  /**
   * Calculate refund based on cancellation policy.
   * Policy:
   *   - 48+ hours before check-in: 100% refund
   *   - 24-48 hours: 50% refund
   *   - <24 hours: No refund (or 1 night penalty)
   */
  calculateRefund(booking) {
    const originalAmount = booking.totalAmount || booking.amount || 0;
    const checkInDate = new Date(booking.checkIn || booking.checkInDate);
    const now = new Date();
    const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);

    let refundPercentage;
    let policyApplied;

    if (booking.paymentStatus === 'unpaid' || booking.paymentStatus === 'pending') {
      return { originalAmount, refundAmount: 0, cancellationFee: 0, refundPercentage: 0, policyApplied: 'no_payment_received' };
    }

    if (hoursUntilCheckIn >= 48) {
      refundPercentage = 100;
      policyApplied = 'full_refund_48h';
    } else if (hoursUntilCheckIn >= 24) {
      refundPercentage = 50;
      policyApplied = 'partial_refund_24h';
    } else {
      refundPercentage = 0;
      policyApplied = 'no_refund_late';
    }

    const refundAmount = Math.round((originalAmount * refundPercentage / 100) * 100) / 100;
    const cancellationFee = Math.round((originalAmount - refundAmount) * 100) / 100;

    return { originalAmount, refundAmount, cancellationFee, refundPercentage, policyApplied };
  }

  /**
   * Release room inventory for cancelled dates.
   */
  async releaseRoomInventory(booking, session) {
    try {
      if (!booking.room && !booking.rooms) return;

      const roomIds = booking.rooms || (booking.room ? [booking.room] : []);
      const checkIn = new Date(booking.checkIn || booking.checkInDate);
      const checkOut = new Date(booking.checkOut || booking.checkOutDate);

      // Generate all dates in the range
      const dates = [];
      const current = new Date(checkIn);
      while (current < checkOut) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      if (this.RoomAvailability && dates.length > 0) {
        await this.RoomAvailability.updateMany(
          {
            room: { $in: roomIds },
            date: { $in: dates },
            bookingId: booking._id,
          },
          { $set: { status: 'available', bookingId: null } },
          { session }
        );
      }
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Process refund via Stripe.
   */
  async processRefund(booking, refundAmount) {
    if (!this.stripe) {
      logger.warn('[CancellationRefund] Stripe not configured, skipping payment refund');
      return null;
    }

    const payment = await this.Payment.findOne({
      bookingId: booking._id,
      status: { $in: ['paid', 'completed'] },
      stripePaymentIntentId: { $exists: true },
    });

    if (!payment || !payment.stripePaymentIntentId) {
      logger.warn('[CancellationRefund] No Stripe payment found for booking, skipping refund');
      return null;
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Stripe uses cents
        reason: 'requested_by_customer',
      });

      // Update payment record
      payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
      payment.refundStatus = refundAmount >= payment.amount ? 'fully_refunded' : 'partially_refunded';
      payment.lastRefundId = refund.id;
      await payment.save();

      return refund;
    } catch (err) {
      logger.error('[CancellationRefund] Stripe refund failed:', err.message);
      throw new Error(`Refund failed: ${err.message}`);
    }
  }
}

export { CancellationRefundService };
