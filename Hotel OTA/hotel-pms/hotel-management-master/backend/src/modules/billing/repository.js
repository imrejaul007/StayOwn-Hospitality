// @ts-check

import Booking from '../../models/Booking.js';
import Invoice from '../../models/Invoice.js';
import Payment from '../../models/Payment.js';
import BillingEvent from '../../models/BillingEvent.js';

/** @typedef {import('../../types/contracts').BillingRepositoryContract} BillingRepositoryContract */

/** @type {BillingRepositoryContract} */
const billingRepository = {
  async findBookingById(bookingId) {
    return Booking.findById(bookingId).lean();
  },

  async findBookingWithHotel(bookingId) {
    return Booking.findById(bookingId).populate('hotelId').lean();
  },

  async findBookingForInvoiceCreation(bookingId) {
    return Booking.findById(bookingId)
      .populate('userId', 'name email')
      .populate('hotelId', 'name')
      .lean();
  },

  async createPaymentRecord(paymentData) {
    return Payment.create(paymentData);
  },

  async findInvoiceById(invoiceId) {
    return Invoice.findById(invoiceId);
  },

  async findInvoiceByIdLean(invoiceId) {
    return Invoice.findById(invoiceId).lean();
  },

  async createInvoice(invoiceData) {
    return Invoice.create(invoiceData);
  },

  async findOneAndUpdateInvoice(matchQuery, updates) {
    return Invoice.findOneAndUpdate(
      matchQuery,
      { $set: updates },
      { new: true, runValidators: true }
    );
  },

  async generateSupplementaryInvoice(bookingId, extraPersonCharges, userId) {
    return Invoice.generateSupplementaryInvoice(bookingId, extraPersonCharges, userId);
  },

  async generateSettlementInvoice(settlementId, adjustments, userId) {
    return Invoice.generateSettlementInvoice(settlementId, adjustments, userId);
  },

  async addExtraChargesToInvoice(matchQuery, extraPersonCharges) {
    return Invoice.findOneAndUpdate(
      matchQuery,
      {
        $push: {
          extraPersonCharges: { $each: extraPersonCharges }
        }
      },
      { new: true, runValidators: true }
    ).populate([
      { path: 'guestId', select: 'name email phone' },
      { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
      { path: 'hotelId', select: 'name' }
    ]);
  },

  async findSettlementByIdWithBooking(settlementId) {
    const Settlement = (await import('../../models/Settlement.js')).default;
    return Settlement.findById(settlementId)
      .populate({
        path: 'bookingId',
        populate: { path: 'hotelId' }
      })
      .lean();
  },

  async markPaymentSucceededByIntentId(paymentIntentId) {
    return Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      {
        status: 'succeeded',
        processedAt: new Date()
      },
      { new: true }
    );
  },

  async setBookingPaid(bookingId, paymentIntentId) {
    return Booking.findByIdAndUpdate(
      bookingId,
      {
        status: 'confirmed',
        paymentStatus: 'paid',
        stripePaymentId: paymentIntentId
      },
      { new: true }
    );
  },

  async setExtraPersonChargePaid(bookingId, personId, paymentIntentId) {
    return Booking.findOneAndUpdate(
      {
        _id: bookingId,
        'extraPersonCharges.personId': personId
      },
      {
        $set: {
          'extraPersonCharges.$.paymentStatus': 'paid',
          'extraPersonCharges.$.stripePaymentId': paymentIntentId
        }
      },
      { new: true }
    );
  },

  async pushExtraPersonChargeAsPaid(bookingId, charge, currency, paymentIntentId) {
    return Booking.findByIdAndUpdate(
      bookingId,
      {
        $push: {
          extraPersonCharges: {
            personId: charge.personId,
            baseCharge: charge.amount,
            totalCharge: charge.amount,
            currency,
            description: charge.description || 'Extra person charge',
            paymentStatus: 'paid',
            stripePaymentId: paymentIntentId,
            paidAt: new Date()
          }
        }
      },
      { new: true }
    );
  },

  async appendSettlementPayment(settlementId, payment, paymentIntentId) {
    const Settlement = (await import('../../models/Settlement.js')).default;
    return Settlement.findByIdAndUpdate(
      settlementId,
      {
        $push: {
          payments: {
            paymentId: payment._id,
            stripePaymentIntentId: paymentIntentId,
            amount: payment.amount,
            method: 'stripe',
            paidBy: payment.metadata?.get('paidBy'),
            paidAt: new Date()
          }
        }
      },
      { new: true }
    );
  },

  async setSettlementComputedStatus(settlementId, settlement) {
    const Settlement = (await import('../../models/Settlement.js')).default;
    const totalPaid = settlement.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = settlement.finalAmount - totalPaid;

    const statusUpdate = {
      outstandingBalance: Math.max(0, remainingBalance)
    };

    if (remainingBalance <= 0) {
      statusUpdate.status = 'completed';
      statusUpdate.completedAt = new Date();
    } else {
      statusUpdate.status = 'partial';
    }

    return Settlement.findByIdAndUpdate(settlementId, { $set: statusUpdate }, { new: true });
  },

  async appendBillingEvent(eventData) {
    return BillingEvent.create(eventData);
  },

  async sumInvoiceEventAmounts(invoiceId, eventTypes = []) {
    const pipeline = [
      {
        $match: {
          invoiceId,
          eventType: { $in: eventTypes }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ];

    const [result] = await BillingEvent.aggregate(pipeline);
    return result?.total || 0;
  }
};

export default billingRepository;
