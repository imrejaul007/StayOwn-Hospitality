import mongoose, { Schema, Document } from 'mongoose';

export type RevieweeType = 'property' | 'host' | 'guest';

export type ReviewCategory =
  | 'cleanliness'
  | 'accuracy'
  | 'check_in'
  | 'communication'
  | 'location'
  | 'value'
  | 'amenities'
  | 'overall';

export interface IReview extends Document {
  reviewId: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string;
  revieweeType: RevieweeType;
  rating: number;
  comment: string;
  category: ReviewCategory;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    reviewId: { type: String, required: true, unique: true },
    bookingId: { type: String, required: true, index: true },
    reviewerId: { type: String, required: true, index: true },
    revieweeId: { type: String, required: true, index: true },
    revieweeType: {
      type: String,
      required: true,
      enum: ['property', 'host', 'guest'],
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 2000 },
    category: {
      type: String,
      required: true,
      enum: [
        'cleanliness',
        'accuracy',
        'check_in',
        'communication',
        'location',
        'value',
        'amenities',
        'overall',
      ],
    },
  },
  { timestamps: true }
);

// Indexes
ReviewSchema.index({ reviewId: 1 }, { unique: true });
ReviewSchema.index({ bookingId: 1, reviewerId: 1 }, { unique: true });
ReviewSchema.index({ revieweeId: 1, revieweeType: 1 });
ReviewSchema.index({ revieweeId: 1, category: 1, createdAt: -1 });
ReviewSchema.index({ reviewerId: 1, createdAt: -1 });
ReviewSchema.index({ rating: -1, createdAt: -1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
