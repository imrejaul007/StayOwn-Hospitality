import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import PaymentReconciliation from '../models/PaymentReconciliation.js';
import Decimal from 'decimal.js';
import logger from '../utils/logger.js';

class PaymentReconciliationService {
  async reconcile(hotelId, date, nightAuditId = null) {
    try {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);

      // Get all payments for the date
      const payments = await Payment.find({
        hotelId,
        createdAt: { $gte: dayStart, $lte: dayEnd },
        status: { $in: ['succeeded', 'partially_refunded'] }
      }).lean().limit(1000);

      // Get all active bookings that should have charges for this date
      const activeBookings = await Booking.find({
        hotelId,
        status: { $in: ['checked_in', 'checked_out'] },
        checkIn: { $lte: dayEnd },
        checkOut: { $gte: dayStart }
      }).lean().limit(1000);

      // Match payments to bookings
      const paymentEntries = payments.map(p => ({
        paymentId: p._id,
        bookingId: p.bookingId,
        amount: p.amount,
        method: p.paymentMethod || 'unknown',
        matched: false
      }));

      const chargeEntries = activeBookings.map(b => {
        const nightlyRate = b.totalAmount / Math.max(b.nights || 1, 1);
        return {
          bookingId: b._id,
          amount: nightlyRate,
          description: `Nightly charge - ${b.bookingNumber || b._id}`,
          matched: false
        };
      });

      // Match by bookingId
      for (const payment of paymentEntries) {
        const matchingCharge = chargeEntries.find(
          c => !c.matched && c.bookingId?.toString() === payment.bookingId?.toString()
        );
        if (matchingCharge) {
          payment.matched = true;
          matchingCharge.matched = true;
        }
      }

      const totalPayments = paymentEntries.reduce((sum, p) => new Decimal(sum).plus(p.amount).toNumber(), 0);
      const totalCharges = chargeEntries.reduce((sum, c) => new Decimal(sum).plus(c.amount).toNumber(), 0);
      const matchedAmount = paymentEntries.filter(p => p.matched).reduce((sum, p) => new Decimal(sum).plus(p.amount).toNumber(), 0);

      const reconciliation = await PaymentReconciliation.create({
        hotelId,
        reconciliationDate: dayStart,
        nightAuditId,
        status: paymentEntries.some(p => !p.matched) || chargeEntries.some(c => !c.matched) ? 'requires_review' : 'completed',
        payments: paymentEntries,
        charges: chargeEntries,
        summary: {
          totalPayments,
          totalCharges,
          matchedAmount,
          unmatchedPayments: paymentEntries.filter(p => !p.matched).length,
          unmatchedCharges: chargeEntries.filter(c => !c.matched).length,
          variance: new Decimal(totalPayments).minus(totalCharges).toDecimalPlaces(2).toNumber()
        }
      });

      logger.info('Payment reconciliation completed', {
        hotelId,
        date: dayStart,
        variance: reconciliation.summary.variance
      });

      return reconciliation;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }
}

export default new PaymentReconciliationService();
