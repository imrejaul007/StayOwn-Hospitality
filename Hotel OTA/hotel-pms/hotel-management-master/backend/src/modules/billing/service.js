// @ts-check

import { ApplicationError } from '../../middleware/errorHandler.js';
import billingRepository from './repository.js';

/** @typedef {import('../../types/contracts').AuthenticatedUser} AuthenticatedUser */
/** @typedef {import('../../types/contracts').BillingEventInput} BillingEventInput */
/** @typedef {import('../../types/contracts').InvoiceCreateInput} InvoiceCreateInput */
/** @typedef {import('../../types/contracts').InvoicePaymentReconciliation} InvoicePaymentReconciliation */
/** @typedef {import('../../types/contracts').InvoiceUpdateInput} InvoiceUpdateInput */

const getRequestIdempotencyKey = (headers = {}) => (
  headers['idempotency-key'] || headers['x-idempotency-key'] || null
);

const FINAL_INVOICE_STATUSES = ['paid', 'cancelled', 'refunded'];
const PAYMENT_RECONCILE_EVENT_TYPES = ['INVOICE_PAYMENT_ADDED', 'INVOICE_SPLIT_PAID'];
const INVOICE_STATUS_TRANSITIONS = {
  draft: ['issued', 'cancelled'],
  issued: ['partially_paid', 'paid', 'overdue', 'cancelled', 'refunded'],
  partially_paid: ['paid', 'overdue', 'cancelled', 'refunded'],
  overdue: ['paid', 'cancelled', 'refunded'],
  paid: [],
  cancelled: [],
  refunded: []
};

/**
 * @param {BillingEventInput} eventData
 * @returns {Promise<void>}
 */
const recordBillingEvent = async (eventData) => {
  try {
    await billingRepository.appendBillingEvent(eventData);
  } catch (error) {
    // Keep billing flows non-breaking if audit logging fails.
  }
};

const isReconciliationStrictMode = () => process.env.BILLING_RECONCILIATION_ENFORCE === 'true';

/**
 * @param {{
 *   invoice: any,
 *   user?: AuthenticatedUser | null,
 *   reconciliation: InvoicePaymentReconciliation
 * }} params
 * @returns {Promise<void>}
 */
const recordReconciliationMismatchEvent = async ({
  invoice,
  user,
  reconciliation
}) => {
  await recordBillingEvent({
    hotelId: invoice.hotelId,
    invoiceId: invoice._id,
    bookingId: invoice.bookingId,
    eventType: 'BILLING_RECONCILIATION_MISMATCH',
    amount: reconciliation.actualAmountPaid,
    currency: invoice.currency,
    actorUserId: user?._id,
    actorRole: user?.role,
    source: 'system',
    metadata: {
      reconciliation
    }
  });
};

const billingService = {
  /**
   * @param {import('../../types/contracts').ObjectIdLike} invoiceId
   * @param {number} actualAmountPaid
   * @param {number} pendingAmount
   * @returns {Promise<InvoicePaymentReconciliation>}
   */
  async buildInvoicePaymentReconciliation(invoiceId, actualAmountPaid, pendingAmount) {
    const alreadyTrackedPaidAmount = await billingRepository.sumInvoiceEventAmounts(
      invoiceId,
      PAYMENT_RECONCILE_EVENT_TYPES
    );
    const expectedAmountPaid = alreadyTrackedPaidAmount + pendingAmount;
    const isAligned = Math.abs(expectedAmountPaid - actualAmountPaid) < 0.01;

    return {
      expectedAmountPaid,
      actualAmountPaid,
      isAligned
    };
  },

  /**
   * @param {InvoicePaymentReconciliation} reconciliation
   * @returns {InvoicePaymentReconciliation & { policyMode: 'strict' | 'observe' }}
   */
  assertReconciliationPolicy(reconciliation) {
    const strictMode = isReconciliationStrictMode();
    if (!reconciliation.isAligned && strictMode) {
      throw new ApplicationError(
        'Invoice payment reconciliation mismatch detected. Please retry or contact support.',
        409
      );
    }

    return {
      ...reconciliation,
      policyMode: strictMode ? 'strict' : 'observe'
    };
  },

  /**
   * @param {InvoiceCreateInput} params
   * @returns {Promise<any>}
   */
  async createInvoice({
    bookingId,
    type,
    items,
    dueDate,
    discounts,
    splitBilling,
    notes,
    billingAddress,
    user
  }) {
    const booking = await billingRepository.findBookingForInvoiceCreation(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    const hotelId = user.role === 'staff' ? user.hotelId : booking.hotelId._id;
    if (user.role === 'staff' && booking.hotelId._id.toString() !== hotelId.toString()) {
      throw new ApplicationError('You can only create invoices for your hotel', 403);
    }

    const invoiceData = {
      hotelId,
      bookingId,
      guestId: booking.userId._id,
      type: type || 'accommodation',
      items: items.map((item) => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice,
        taxAmount: ((item.quantity * item.unitPrice) * (item.taxRate || 0)) / 100
      })),
      dueDate: new Date(dueDate),
      notes,
      billingAddress
    };

    const invoice = await billingRepository.createInvoice(invoiceData);

    if (discounts && discounts.length > 0) {
      for (const discount of discounts) {
        await invoice.addDiscount(
          discount.description,
          discount.type,
          discount.value,
          user._id
        );
      }
    }

    if (splitBilling && splitBilling.isEnabled) {
      await invoice.setupSplitBilling(splitBilling.method, splitBilling.splits);
    }

    await invoice.populate([
      { path: 'hotelId', select: 'name address contact' },
      { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
      { path: 'guestId', select: 'name email phone' }
    ]);

    await recordBillingEvent({
      hotelId: invoice.hotelId?._id || invoice.hotelId,
      invoiceId: invoice._id,
      bookingId: invoice.bookingId?._id || invoice.bookingId,
      eventType: 'INVOICE_CREATED',
      amount: invoice.totalAmount,
      currency: invoice.currency,
      actorUserId: user._id,
      actorRole: user.role,
      source: 'api',
      metadata: {
        invoiceType: invoice.type,
        status: invoice.status
      }
    });

    return invoice;
  },

  /**
   * @param {InvoiceUpdateInput} params
   * @returns {Promise<any>}
   */
  async updateInvoice({
    invoiceId,
    body,
    user
  }) {
    const allowedUpdates = ['status', 'dueDate', 'items', 'notes', 'internalNotes'];
    const updates = {};

    Object.keys(body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = body[key];
      }
    });

    const existingInvoice = await billingRepository.findInvoiceByIdLean(invoiceId);
    if (!existingInvoice) {
      throw new ApplicationError('Invoice not found', 404);
    }
    if (user.role === 'staff' && existingInvoice.hotelId.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('You can only update invoices for your hotel', 403);
    }

    if (FINAL_INVOICE_STATUSES.includes(existingInvoice.status)) {
      throw new ApplicationError('Cannot modify finalized invoices', 400);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'status') && updates.status !== existingInvoice.status) {
      const allowedNextStatuses = INVOICE_STATUS_TRANSITIONS[existingInvoice.status] || [];
      if (!allowedNextStatuses.includes(updates.status)) {
        throw new ApplicationError(
          `Invalid invoice status transition from ${existingInvoice.status} to ${updates.status}`,
          400
        );
      }
    }

    const matchQuery = { _id: invoiceId, status: existingInvoice.status };
    if (user.role === 'staff') {
      matchQuery.hotelId = user.hotelId;
    }

    const invoice = await billingRepository.findOneAndUpdateInvoice(matchQuery, updates);
    if (!invoice) {
      throw new ApplicationError('Invoice update conflict. Please reload and try again.', 409);
    }

    if (updates.items && invoice) {
      invoice.calculateTotals();
      await invoice.save();
    }

    if (invoice) {
      await recordBillingEvent({
        hotelId: invoice.hotelId,
        invoiceId: invoice._id,
        bookingId: invoice.bookingId,
        eventType: 'INVOICE_UPDATED',
        amount: invoice.totalAmount,
        currency: invoice.currency,
        actorUserId: user._id,
        actorRole: user.role,
        source: 'api',
        metadata: {
          updatedFields: Object.keys(updates)
        }
      });
    }

    return invoice;
  },

  async createBookingPaymentIntent({
    bookingId,
    currency = 'INR',
    requestHeaders,
    requestUserId,
    createPaymentIntent
  }) {
    const booking = await billingRepository.findBookingById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    if (booking.userId.toString() !== requestUserId.toString()) {
      throw new ApplicationError('You do not have permission to pay for this booking', 403);
    }

    if (booking.status === 'cancelled') {
      throw new ApplicationError('Cannot pay for a cancelled booking', 400);
    }

    if (booking.paymentStatus === 'paid') {
      throw new ApplicationError('Booking has already been paid', 400);
    }

    const paymentAmountInSmallestUnit = Math.round(booking.totalAmount * 100);
    const idempotencyKey = getRequestIdempotencyKey(requestHeaders || {});
    const stripeOptions = idempotencyKey ? { idempotencyKey } : {};

    const paymentIntent = await createPaymentIntent({
      amount: paymentAmountInSmallestUnit,
      currency: currency.toLowerCase(),
      metadata: {
        bookingId: bookingId,
        userId: requestUserId.toString(),
        bookingNumber: booking.bookingNumber
      },
      automatic_payment_methods: {
        enabled: true
      }
    }, stripeOptions);

    await billingRepository.createPaymentRecord({
      bookingId,
      hotelId: booking.hotelId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentAmountInSmallestUnit / 100,
      currency: currency.toUpperCase(),
      status: 'pending'
    });

    await recordBillingEvent({
      hotelId: booking.hotelId,
      bookingId: booking._id || bookingId,
      eventType: 'PAYMENT_INTENT_CREATED',
      amount: paymentAmountInSmallestUnit / 100,
      currency: currency,
      actorUserId: requestUserId,
      source: 'api',
      idempotencyKey,
      metadata: {
        paymentIntentId: paymentIntent.id
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  },

  async confirmPaymentIntent({
    paymentIntentId,
    retrievePaymentIntent
  }) {
    if (!paymentIntentId) {
      throw new ApplicationError('Payment Intent ID is required', 400);
    }

    const paymentIntent = await retrievePaymentIntent(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      throw new ApplicationError('Payment has not been completed', 400);
    }

    const payment = await billingRepository.markPaymentSucceededByIntentId(paymentIntentId);
    if (!payment) {
      await recordBillingEvent({
        hotelId: paymentIntent.metadata?.hotelId || null,
        bookingId: paymentIntent.metadata?.bookingId || null,
        eventType: 'PAYMENT_INTENT_CONFIRMED',
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        source: 'system',
        metadata: {
          paymentIntentId: paymentIntent.id,
          paymentType: paymentIntent.metadata?.paymentType || 'booking',
          status: paymentIntent.status
        }
      });

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        paymentType: paymentIntent.metadata?.paymentType || 'booking'
      };
    }

    const paymentType = payment.metadata?.get('paymentType');
    if (paymentType === 'extra_person_charges') {
      const chargeDetails = payment.metadata?.get('chargeDetails');
      if (chargeDetails) {
        const charges = JSON.parse(chargeDetails);
        for (const charge of charges) {
          const updatedBooking = await billingRepository.setExtraPersonChargePaid(
            payment.bookingId,
            charge.personId,
            paymentIntentId
          );

          if (!updatedBooking) {
            await billingRepository.pushExtraPersonChargeAsPaid(
              payment.bookingId,
              charge,
              payment.currency,
              paymentIntentId
            );
          }
        }
      }
    } else if (paymentType === 'settlement') {
      const settlementId = payment.metadata?.get('settlementId');
      if (settlementId) {
        const settlement = await billingRepository.appendSettlementPayment(settlementId, payment, paymentIntentId);
        if (settlement) {
          await billingRepository.setSettlementComputedStatus(settlementId, settlement);
        }
      }
    } else {
      await billingRepository.setBookingPaid(payment.bookingId, paymentIntentId);
    }

    await recordBillingEvent({
      hotelId: payment.hotelId,
      bookingId: payment.bookingId,
      paymentId: payment._id,
      settlementId: payment.metadata?.get('settlementId') || null,
      eventType: 'PAYMENT_INTENT_CONFIRMED',
      amount: payment.amount,
      currency: payment.currency,
      source: 'system',
      metadata: {
        paymentIntentId,
        paymentType
      }
    });

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      paymentType: paymentIntent.metadata?.paymentType || 'booking'
    };
  },

  async addInvoicePayment({
    invoiceId,
    amount,
    method,
    transactionId,
    notes,
    user
  }) {
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new ApplicationError('Invoice not found', 404);
    }

    if (user.role === 'staff' && invoice.hotelId.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('You can only add payments to invoices for your hotel', 403);
    }

    if (amount <= 0 || amount > invoice.amountRemaining) {
      throw new ApplicationError('Invalid payment amount', 400);
    }

    await invoice.addPayment(amount, method, user._id, transactionId, notes);
    await invoice.populate([{ path: 'payments.paidBy', select: 'name' }]);
    const reconciliation = await this.buildInvoicePaymentReconciliation(
      invoice._id,
      invoice.amountPaid,
      amount
    );
    const reconciliationWithPolicy = this.assertReconciliationPolicy(reconciliation);
    if (!reconciliationWithPolicy.isAligned) {
      await recordReconciliationMismatchEvent({
        invoice,
        user,
        reconciliation: reconciliationWithPolicy
      });
    }

    await recordBillingEvent({
      hotelId: invoice.hotelId,
      invoiceId: invoice._id,
      bookingId: invoice.bookingId,
      eventType: 'INVOICE_PAYMENT_ADDED',
      amount,
      currency: invoice.currency,
      actorUserId: user._id,
      actorRole: user.role,
      source: 'api',
      metadata: {
        method,
        transactionId,
        reconciliation: reconciliationWithPolicy
      }
    });

    return invoice;
  },

  async addInvoiceDiscount({
    invoiceId,
    description,
    type,
    value,
    user
  }) {
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new ApplicationError('Invoice not found', 404);
    }

    if (user.role === 'staff' && invoice.hotelId.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('You can only add discounts to invoices for your hotel', 403);
    }

    if (invoice.status === 'paid') {
      throw new ApplicationError('Cannot add discounts to paid invoices', 400);
    }

    await invoice.addDiscount(description, type, value, user._id);

    await recordBillingEvent({
      hotelId: invoice.hotelId,
      invoiceId: invoice._id,
      bookingId: invoice.bookingId,
      eventType: 'INVOICE_DISCOUNT_ADDED',
      currency: invoice.currency,
      actorUserId: user._id,
      actorRole: user.role,
      source: 'api',
      metadata: {
        description,
        discountType: type,
        value
      }
    });

    return invoice;
  },

  async setupInvoiceSplitBilling({
    invoiceId,
    method,
    splits,
    user
  }) {
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new ApplicationError('Invoice not found', 404);
    }

    if (user.role === 'staff' && invoice.hotelId.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('You can only setup split billing for invoices for your hotel', 403);
    }

    if (invoice.status === 'paid') {
      throw new ApplicationError('Cannot setup split billing for paid invoices', 400);
    }

    await invoice.setupSplitBilling(method, splits);

    await recordBillingEvent({
      hotelId: invoice.hotelId,
      invoiceId: invoice._id,
      bookingId: invoice.bookingId,
      eventType: 'INVOICE_SPLIT_CONFIGURED',
      amount: invoice.totalAmount,
      currency: invoice.currency,
      actorUserId: user._id,
      actorRole: user.role,
      source: 'api',
      metadata: {
        method,
        splitCount: Array.isArray(splits) ? splits.length : 0
      }
    });

    return invoice;
  },

  async markInvoiceSplitPaid({
    invoiceId,
    splitIndex,
    amount,
    method,
    transactionId,
    user
  }) {
    const invoice = await billingRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new ApplicationError('Invoice not found', 404);
    }

    if (user.role === 'guest') {
      const split = invoice.splitBilling.splits[parseInt(splitIndex, 10)];
      if (!split || split.guestId.toString() !== user._id.toString()) {
        throw new ApplicationError('You can only pay your own split', 403);
      }
    } else if (user.role === 'staff' && invoice.hotelId.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('You can only manage splits for invoices for your hotel', 403);
    }

    await invoice.markSplitPaid(parseInt(splitIndex, 10), amount, method, transactionId);
    const reconciliation = await this.buildInvoicePaymentReconciliation(
      invoice._id,
      invoice.amountPaid,
      amount
    );
    const reconciliationWithPolicy = this.assertReconciliationPolicy(reconciliation);
    if (!reconciliationWithPolicy.isAligned) {
      await recordReconciliationMismatchEvent({
        invoice,
        user,
        reconciliation: reconciliationWithPolicy
      });
    }

    await recordBillingEvent({
      hotelId: invoice.hotelId,
      invoiceId: invoice._id,
      bookingId: invoice.bookingId,
      eventType: 'INVOICE_SPLIT_PAID',
      amount,
      currency: invoice.currency,
      actorUserId: user._id,
      actorRole: user.role,
      source: 'api',
      metadata: {
        splitIndex: parseInt(splitIndex, 10),
        method,
        transactionId,
        reconciliation: reconciliationWithPolicy
      }
    });

    return invoice;
  },

  async createSupplementaryInvoiceForExtraPersonCharges({
    bookingId,
    extraPersonCharges,
    user
  }) {
    if (!bookingId || !extraPersonCharges || extraPersonCharges.length === 0) {
      throw new ApplicationError('Booking ID and extra person charges are required', 400);
    }

    const booking = await billingRepository.findBookingWithHotel(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    if (user.role === 'staff' && booking.hotelId._id.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('You can only create invoices for your hotel', 403);
    }

    const invoice = await billingRepository.generateSupplementaryInvoice(bookingId, extraPersonCharges, user._id);
    await invoice.populate([
      { path: 'guestId', select: 'name email phone' },
      { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
      { path: 'hotelId', select: 'name' }
    ]);

    await recordBillingEvent({
      hotelId: invoice.hotelId?._id || invoice.hotelId,
      invoiceId: invoice._id,
      bookingId: invoice.bookingId?._id || invoice.bookingId,
      eventType: 'SUPPLEMENTARY_INVOICE_CREATED',
      amount: invoice.totalAmount,
      currency: invoice.currency,
      actorUserId: user._id,
      actorRole: user.role,
      source: 'api',
      metadata: {
        reason: 'extra_person_charges',
        itemsCount: Array.isArray(extraPersonCharges) ? extraPersonCharges.length : 0
      }
    });

    return invoice;
  },

  async createSupplementaryInvoiceForSettlement({
    settlementId,
    adjustments,
    user
  }) {
    if (!settlementId || !adjustments || adjustments.length === 0) {
      throw new ApplicationError('Settlement ID and adjustments are required', 400);
    }

    const settlement = await billingRepository.findSettlementByIdWithBooking(settlementId);
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    if (user.role === 'staff' && settlement.bookingId.hotelId._id.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('You can only create invoices for your hotel', 403);
    }

    const invoice = await billingRepository.generateSettlementInvoice(settlementId, adjustments, user._id);
    await invoice.populate([
      { path: 'guestId', select: 'name email phone' },
      { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
      { path: 'hotelId', select: 'name' }
    ]);

    await recordBillingEvent({
      hotelId: invoice.hotelId?._id || invoice.hotelId,
      invoiceId: invoice._id,
      bookingId: invoice.bookingId?._id || invoice.bookingId,
      settlementId,
      eventType: 'SETTLEMENT_INVOICE_CREATED',
      amount: invoice.totalAmount,
      currency: invoice.currency,
      actorUserId: user._id,
      actorRole: user.role,
      source: 'api',
      metadata: {
        adjustmentsCount: Array.isArray(adjustments) ? adjustments.length : 0
      }
    });

    return invoice;
  },

  async addExtraChargesToInvoice({
    invoiceId,
    extraPersonCharges,
    user
  }) {
    if (!extraPersonCharges || extraPersonCharges.length === 0) {
      throw new ApplicationError('Extra person charges are required', 400);
    }

    const matchQuery = { _id: invoiceId, status: { $ne: 'paid' } };
    if (user.role === 'staff') {
      matchQuery.hotelId = user.hotelId;
    }

    const invoice = await billingRepository.addExtraChargesToInvoice(matchQuery, extraPersonCharges);
    if (!invoice) {
      const exists = await billingRepository.findInvoiceByIdLean(invoiceId);
      if (!exists) {
        throw new ApplicationError('Invoice not found', 404);
      }
      if (user.role === 'staff' && exists.hotelId.toString() !== user.hotelId.toString()) {
        throw new ApplicationError('You can only modify invoices for your hotel', 403);
      }
      if (exists.status === 'paid') {
        throw new ApplicationError('Cannot modify paid invoices', 400);
      }
    }

    if (invoice) {
      await recordBillingEvent({
        hotelId: invoice.hotelId,
        invoiceId: invoice._id,
        bookingId: invoice.bookingId,
        eventType: 'INVOICE_EXTRA_CHARGES_ADDED',
        amount: invoice.totalAmount,
        currency: invoice.currency,
        actorUserId: user._id,
        actorRole: user.role,
        source: 'api',
        metadata: {
          chargesCount: Array.isArray(extraPersonCharges) ? extraPersonCharges.length : 0
        }
      });
    }

    return invoice;
  }
};

export default billingService;
