import mongoose from 'mongoose';

const mismatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    cachedPoints: {
      type: Number,
      required: true
    },
    ledgerPoints: {
      type: Number,
      required: true
    },
    delta: {
      type: Number,
      required: true
    },
    tier: String
  },
  { _id: false }
);

const loyaltyReconciliationRunSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      required: true
    },
    mode: {
      type: String,
      enum: ['full', 'single_user'],
      default: 'full'
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date,
    totalUsersChecked: {
      type: Number,
      default: 0
    },
    mismatchCount: {
      type: Number,
      default: 0
    },
    repairedCount: {
      type: Number,
      default: 0
    },
    largestDelta: {
      type: Number,
      default: 0
    },
    mismatches: {
      type: [mismatchSchema],
      default: []
    },
    error: String
  },
  {
    timestamps: true
  }
);

loyaltyReconciliationRunSchema.index({ hotelId: 1, createdAt: -1 });
loyaltyReconciliationRunSchema.index({ hotelId: 1, status: 1 });
loyaltyReconciliationRunSchema.index({ hotelId: 1, status: 1, createdAt: -1 });

export default mongoose.model('LoyaltyReconciliationRun', loyaltyReconciliationRunSchema);
