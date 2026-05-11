import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  stripePaymentIntentId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'bank_transfer'],
    default: 'card'
  },
  metadata: {
    type: Map,
    of: String
  },
  refunds: [{
    stripeRefundId: String,
    amount: Number,
    reason: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  failureReason: String,
  processedAt: Date,

  // Soft delete fields for financial record preservation
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes - stripePaymentIntentId already has unique constraint in schema
paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ hotelId: 1, createdAt: -1 });
paymentSchema.index({ hotelId: 1, status: 1 });
paymentSchema.index({ hotelId: 1, status: 1, createdAt: -1 }); // Compound index for billing/revenue aggregation pipelines
paymentSchema.index({ hotelId: 1, bookingId: 1, status: 1 });
// Removed: index on guestId was declared but guestId field doesn't exist in schema
// paymentSchema.index({ guestId: 1, hotelId: 1 });

// Exclude soft-deleted payments from all find queries by default
paymentSchema.pre(/^find/, function(next) {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

export default mongoose.model('Payment', paymentSchema);
