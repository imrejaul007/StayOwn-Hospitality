import mongoose, { Schema, Document } from 'mongoose';

export interface ITrustScore extends Document {
  entityId: string;
  entityType: 'property' | 'host' | 'guest';
  components: {
    reliability: number;
    quality: number;
    behavior: number;
    reviews: number;
  };
  score: number;
  karmaBoost: number;
  finalScore: number;
  stats: {
    reviewCount: number;
    responseRate: number;
    responseTime: string;
    cancellationRate: number;
    totalBookings: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TrustScoreSchema = new Schema<ITrustScore>(
  {
    entityId: { type: String, required: true },
    entityType: {
      type: String,
      required: true,
      enum: ['property', 'host', 'guest'],
    },
    components: {
      reliability: { type: Number, default: 50, min: 0, max: 100 },
      quality: { type: Number, default: 50, min: 0, max: 100 },
      behavior: { type: Number, default: 50, min: 0, max: 100 },
      reviews: { type: Number, default: 50, min: 0, max: 100 },
    },
    score: { type: Number, default: 50, min: 0, max: 100 },
    karmaBoost: { type: Number, default: 0 },
    finalScore: { type: Number, default: 50, min: 0, max: 100 },
    stats: {
      reviewCount: { type: Number, default: 0 },
      responseRate: { type: Number, default: 100, min: 0, max: 100 },
      responseTime: { type: String, default: 'within an hour' },
      cancellationRate: { type: Number, default: 0, min: 0, max: 100 },
      totalBookings: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Indexes
TrustScoreSchema.index({ entityId: 1, entityType: 1 }, { unique: true });
TrustScoreSchema.index({ entityType: 1, finalScore: -1 });
TrustScoreSchema.index({ finalScore: -1 });

// Calculate score from components
TrustScoreSchema.pre('save', function (next) {
  const weights = {
    reliability: 0.3,
    quality: 0.3,
    behavior: 0.2,
    reviews: 0.2,
  };

  this.score = Math.round(
    this.components.reliability * weights.reliability +
    this.components.quality * weights.quality +
    this.components.behavior * weights.behavior +
    this.components.reviews * weights.reviews
  );

  this.finalScore = Math.min(100, Math.round(this.score + this.karmaBoost));
  next();
});

export const TrustScore = mongoose.model<ITrustScore>('TrustScore', TrustScoreSchema);
