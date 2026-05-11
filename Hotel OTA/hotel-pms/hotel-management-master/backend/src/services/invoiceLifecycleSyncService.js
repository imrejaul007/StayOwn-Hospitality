import Invoice from '../models/Invoice.js';
import logger from '../utils/logger.js';

const appendInternalNote = (existingNotes = '', nextNote) => {
  const trimmedExisting = (existingNotes || '').trim();
  const trimmedNext = (nextNote || '').trim();

  if (!trimmedNext) {
    return trimmedExisting;
  }

  const combined = trimmedExisting
    ? `${trimmedExisting}\n${trimmedNext}`
    : trimmedNext;

  if (combined.length <= 1000) {
    return combined;
  }

  return combined.slice(combined.length - 1000);
};

const getTotalPaid = (invoice) => (invoice.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);

const invoiceLifecycleSyncService = {
  async syncBookingPaymentStatus({ bookingId, paymentStatus, actorUserId }) {
    const invoice = await Invoice.findOne({
      bookingId,
      status: { $nin: ['cancelled', 'refunded'] }
    });

    if (!invoice) {
      return null;
    }

    const totalPaid = getTotalPaid(invoice);
    let changed = false;

    if (paymentStatus === 'paid' && invoice.status !== 'paid') {
      if (totalPaid < invoice.totalAmount) {
        invoice.payments.push({
          amount: invoice.totalAmount - totalPaid,
          method: 'credit_card',
          paidBy: actorUserId,
          paidAt: new Date(),
          notes: 'Payment status synced from booking update'
        });
      }
      invoice.status = 'paid';
      invoice.paidDate = new Date();
      changed = true;
    }

    if (paymentStatus === 'pending' && ['paid', 'partially_paid'].includes(invoice.status)) {
      invoice.status = 'issued';
      invoice.paidDate = null;
      invoice.payments = [];
      changed = true;
    }

    if (!changed) {
      return invoice;
    }

    invoice.internalNotes = appendInternalNote(
      invoice.internalNotes,
      `[${new Date().toISOString()}] Synced from booking payment status: ${paymentStatus}`
    );

    await invoice.save();
    return invoice;
  },

  async syncBookingCancellationInvoices({ bookingId, refundAmount = 0, reason = '' }) {
    const invoices = await Invoice.find({
      bookingId,
      status: { $nin: ['cancelled', 'refunded'] }
    });

    for (const invoice of invoices) {
      const totalPaid = getTotalPaid(invoice);
      const fullyRefunded = totalPaid > 0 && refundAmount >= totalPaid;

      invoice.status = fullyRefunded ? 'refunded' : 'cancelled';
      if (invoice.status === 'cancelled') {
        invoice.paidDate = null;
      }
      invoice.internalNotes = appendInternalNote(
        invoice.internalNotes,
        `[${new Date().toISOString()}] Booking cancelled. Refund amount: ${refundAmount}. Reason: ${reason || 'Not provided'}`
      );

      await invoice.save();
    }

    return invoices.length;
  },

  async syncInvoiceAfterRefund({ bookingId, refundAmount = 0, reason = '' }) {
    const invoice = await Invoice.findOne({
      bookingId,
      status: { $nin: ['cancelled', 'refunded'] }
    });

    if (!invoice) {
      return null;
    }

    const totalPaid = getTotalPaid(invoice);
    if (totalPaid <= 0) {
      return invoice;
    }

    if (refundAmount >= totalPaid) {
      invoice.status = 'refunded';
    } else {
      invoice.status = 'partially_paid';
    }

    invoice.internalNotes = appendInternalNote(
      invoice.internalNotes,
      `[${new Date().toISOString()}] Refund processed. Amount: ${refundAmount}. Reason: ${reason || 'Not provided'}`
    );

    await invoice.save();
    return invoice;
  },

  async ensureCheckoutInvoice({ booking }) {
    const existingInvoice = await Invoice.findOne({
      bookingId: booking._id,
      type: 'accommodation',
      status: { $ne: 'cancelled' }
    }).lean();

    if (existingInvoice) {
      return { created: false, invoice: existingInvoice };
    }

    const nights = Math.max(booking.nights || 1, 1);
    const unitPrice = booking.totalAmount / nights;

    const invoice = await Invoice.create({
      hotelId: booking.hotelId,
      bookingId: booking._id,
      guestId: booking.userId,
      type: 'accommodation',
      status: booking.paymentStatus === 'paid' ? 'paid' : 'issued',
      issueDate: new Date(),
      dueDate: new Date(),
      items: [{
        description: `Room charges - ${nights} night(s)`,
        quantity: nights,
        unitPrice,
        totalPrice: booking.totalAmount,
        category: 'accommodation',
        taxRate: 0,
        taxAmount: 0
      }],
      subtotal: booking.totalAmount,
      taxAmount: 0,
      totalAmount: booking.totalAmount,
      currency: booking.currency || 'INR',
      notes: `Auto-generated at checkout for booking ${booking.bookingNumber || booking._id}`,
      paidDate: booking.paymentStatus === 'paid' ? new Date() : null
    });

    return { created: true, invoice };
  },

  logSyncFailure(context, error) {
    logger.warn('Invoice lifecycle sync failed', {
      ...context,
      error: error.message
    });
  }
};

export default invoiceLifecycleSyncService;
