import mongoose from 'mongoose';

const loyaltyRuleVersionSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    version: { type: Number, required: true },
    isActive: { type: Boolean, default: false, index: true },
    rules: {
      pointsPerCurrencyUnit: { type: Number, default: 0.1, min: 0 },
      pointsPerNight: { type: Number, default: 0, min: 0 },
      maxPointsPerStay: { type: Number, default: 50000, min: 1 }
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    activatedAt: Date
  },
  { timestamps: true }
);

loyaltyRuleVersionSchema.index({ hotelId: 1, version: -1 }, { unique: true });
loyaltyRuleVersionSchema.index({ hotelId: 1, isActive: 1, updatedAt: -1 });

export default mongoose.model('LoyaltyRuleVersion', loyaltyRuleVersionSchema);
