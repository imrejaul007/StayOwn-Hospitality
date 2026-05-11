import mongoose from 'mongoose';

const loyaltyBonusCampaignSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    points: { type: Number, required: true, min: 1 },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    maxTotalAwards: { type: Number, default: 100000, min: 1 },
    maxAwardsPerUser: { type: Number, default: 1, min: 1 },
    totalAwardsCount: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

loyaltyBonusCampaignSchema.index({ hotelId: 1, code: 1 }, { unique: true });
loyaltyBonusCampaignSchema.index({ hotelId: 1, isActive: 1, startsAt: 1, endsAt: 1 });
loyaltyBonusCampaignSchema.index({ hotelId: 1, name: 1 });

export default mongoose.model('LoyaltyBonusCampaign', loyaltyBonusCampaignSchema);
