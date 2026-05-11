import mongoose from 'mongoose';

const paymentReconciliationSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.ObjectId, ref: 'Hotel', required: true },
  reconciliationDate: { type: Date, required: true },
  nightAuditId: { type: mongoose.Schema.ObjectId, ref: 'NightAudit' },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'requires_review'],
    default: 'pending'
  },
  payments: [{
    paymentId: { type: mongoose.Schema.ObjectId, ref: 'Payment' },
    bookingId: { type: mongoose.Schema.ObjectId, ref: 'Booking' },
    amount: Number,
    method: String,
    matched: { type: Boolean, default: false }
  }],
  charges: [{
    bookingId: { type: mongoose.Schema.ObjectId, ref: 'Booking' },
    amount: Number,
    description: String,
    matched: { type: Boolean, default: false }
  }],
  summary: {
    totalPayments: { type: Number, default: 0 },
    totalCharges: { type: Number, default: 0 },
    matchedAmount: { type: Number, default: 0 },
    unmatchedPayments: { type: Number, default: 0 },
    unmatchedCharges: { type: Number, default: 0 },
    variance: { type: Number, default: 0 }
  }
}, { timestamps: true });

paymentReconciliationSchema.index({ hotelId: 1, reconciliationDate: -1 });

export default mongoose.model('PaymentReconciliation', paymentReconciliationSchema);
