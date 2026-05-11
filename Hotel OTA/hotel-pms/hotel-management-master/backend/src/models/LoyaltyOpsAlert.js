import mongoose from 'mongoose';

const loyaltyOpsAlertSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['reconciliation_stale', 'mismatch_rate_high', 'drift_spike', 'expiry_backlog'],
      required: true,
      index: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    message: { type: String, required: true },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    acknowledgedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    resolvedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    resolvedAt: Date
  },
  { timestamps: true }
);

loyaltyOpsAlertSchema.index({ hotelId: 1, status: 1 });
loyaltyOpsAlertSchema.index({ hotelId: 1, status: 1, createdAt: -1 });

export default mongoose.model('LoyaltyOpsAlert', loyaltyOpsAlertSchema);
