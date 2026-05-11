import mongoose from 'mongoose';

const billingEventSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },
  settlementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settlement',
    index: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'INVOICE_CREATED',
      'INVOICE_UPDATED',
      'INVOICE_PAYMENT_ADDED',
      'INVOICE_DISCOUNT_ADDED',
      'INVOICE_SPLIT_CONFIGURED',
      'INVOICE_SPLIT_PAID',
      'INVOICE_EXTRA_CHARGES_ADDED',
      'SUPPLEMENTARY_INVOICE_CREATED',
      'SETTLEMENT_INVOICE_CREATED',
      'PAYMENT_INTENT_CREATED',
      'PAYMENT_INTENT_CONFIRMED',
      'BILLING_RECONCILIATION_MISMATCH'
    ],
    index: true
  },
  amount: Number,
  currency: {
    type: String,
    uppercase: true
  },
  actorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  actorRole: String,
  source: {
    type: String,
    default: 'api',
    enum: ['api', 'system', 'webhook']
  },
  idempotencyKey: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

billingEventSchema.index({ hotelId: 1, createdAt: -1 });
billingEventSchema.index({ invoiceId: 1, createdAt: -1 });
billingEventSchema.index({ bookingId: 1, createdAt: -1 });
billingEventSchema.index({ eventType: 1, createdAt: -1 });

const BillingEvent = mongoose.model('BillingEvent', billingEventSchema);
export default BillingEvent;
