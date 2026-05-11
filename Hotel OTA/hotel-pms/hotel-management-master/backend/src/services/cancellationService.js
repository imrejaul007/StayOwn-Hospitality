import Decimal from 'decimal.js';
import Stripe from 'stripe';
import logger from '../utils/logger.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

class CancellationService {
  /**
   * Calculate refund based on booking's rate plan cancellation policy snapshot
   */
  calculateRefund(booking) {
    const policy = booking.ratePlanSnapshot?.cancellationPolicy;

    // No policy = full refund
    if (!policy || !policy.type) {
      return { refundAmount: booking.totalAmount, penaltyAmount: 0, refundPercentage: 100 };
    }

    if (policy.type === 'non_refundable') {
      return { refundAmount: 0, penaltyAmount: booking.totalAmount, refundPercentage: 0 };
    }

    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);

    // Within free cancellation window
    if (hoursUntilCheckIn >= (policy.hoursBeforeCheckIn || 24)) {
      return { refundAmount: booking.totalAmount, penaltyAmount: 0, refundPercentage: 100 };
    }

    // Outside window -- apply penalty
    const total = new Decimal(booking.totalAmount);
    const penaltyPct = policy.penaltyPercentage || 0;
    const penaltyAmount = total.mul(penaltyPct).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const refundAmount = total.minus(penaltyAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

    return {
      refundAmount,
      penaltyAmount,
      refundPercentage: 100 - penaltyPct
    };
  }

  /**
   * Process a refund via Stripe if applicable
   */
  async processStripeRefund(booking, refundAmount) {
    if (!booking.stripePaymentIntentId || refundAmount <= 0) {
      return null;
    }

    if (!stripe) {
      logger.error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
      throw new Error('Payment processing is not configured. Set STRIPE_SECRET_KEY.');
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Stripe uses cents
        reason: 'requested_by_customer'
      });

      logger.info('Stripe refund processed', {
        bookingId: booking._id,
        refundId: refund.id,
        amount: refundAmount
      });

      return refund;
    } catch (error) {
      logger.error('Stripe refund failed', {
        bookingId: booking._id,
        error: error.message
      });
      throw error;
    }
  }
}

export default new CancellationService();
