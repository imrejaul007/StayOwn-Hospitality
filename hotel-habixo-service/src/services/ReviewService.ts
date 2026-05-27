import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document } from 'mongoose';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Booking } from '../models';

const reviewLogger = logger.child({ service: 'ReviewService' });

// ── Review Model ────────────────────────────────────────────────────────────────

export interface IReview extends Document {
  reviewId: string;
  bookingId: string;
  propertyId: string;
  hostId: string;
  guestId: string;
  reviewerType: 'guest' | 'host';
  rating: number;
  ratings: {
    cleanliness: number;
    accuracy: number;
    checkIn: number;
    communication: number;
    location: number;
    value: number;
  };
  comment: string;
  response?: {
    text: string;
    respondedAt: Date;
  };
  verified: boolean;
  helpful: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    reviewId: { type: String, required: true, unique: true },
    bookingId: { type: String, required: true, index: true },
    propertyId: { type: String, required: true, index: true },
    hostId: { type: String, required: true, index: true },
    guestId: { type: String, required: true, index: true },
    reviewerType: {
      type: String,
      required: true,
      enum: ['guest', 'host'],
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    ratings: {
      cleanliness: { type: Number, min: 1, max: 5 },
      accuracy: { type: Number, min: 1, max: 5 },
      checkIn: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      location: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 },
    },
    comment: { type: String, required: true, maxlength: 2000 },
    response: {
      text: { type: String, maxlength: 1000 },
      respondedAt: Date,
    },
    verified: { type: Boolean, default: false },
    helpful: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ReviewSchema.index({ reviewId: 1 }, { unique: true });
ReviewSchema.index({ propertyId: 1, createdAt: -1 });
ReviewSchema.index({ hostId: 1, createdAt: -1 });
ReviewSchema.index({ guestId: 1, createdAt: -1 });
ReviewSchema.index({ bookingId: 1, reviewerType: 1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateReviewInput {
  bookingId: string;
  reviewerType: 'guest' | 'host';
  rating: number;
  ratings?: {
    cleanliness?: number;
    accuracy?: number;
    checkIn?: number;
    communication?: number;
    location?: number;
    value?: number;
  };
  comment: string;
}

export interface ReviewResponseInput {
  reviewId: string;
  hostId: string;
  response: string;
}

export interface ReviewSearchInput {
  propertyId?: string;
  hostId?: string;
  guestId?: string;
  minRating?: number;
  maxRating?: number;
  page?: number;
  limit?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────────

/**
 * Create a new review
 */
export async function createReview(input: CreateReviewInput): Promise<IReview> {
  const { bookingId, reviewerType, rating, ratings, comment } = input;

  // Validate booking exists and is completed
  const booking = await Booking.findOne({ bookingId }).lean();
  if (!booking) {
    throw new NotFoundError('Booking', bookingId);
  }

  if (booking.status !== 'completed') {
    throw new ValidationError('Can only review completed bookings');
  }

  // Check if already reviewed
  const existingReview = await Review.findOne({ bookingId, reviewerType });
  if (existingReview) {
    throw new ConflictError('Review already exists for this booking');
  }

  const reviewId = `REV-${uuidv4().substring(0, 8).toUpperCase()}`;

  // Determine who is being reviewed
  const isGuestReview = reviewerType === 'guest';
  const targetUserId = isGuestReview ? booking.hostId : booking.guestId;

  const review = new Review({
    reviewId,
    bookingId,
    propertyId: booking.propertyId,
    hostId: booking.hostId,
    guestId: booking.guestId,
    reviewerType,
    rating,
    ratings: ratings || {},
    comment,
    verified: true,
  });

  await review.save();
  reviewLogger.info({ reviewId, bookingId, reviewerType }, 'Review created');

  // Update booking with review
  const reviewData = {
    rating,
    comment,
    createdAt: new Date(),
  };

  if (isGuestReview) {
    await Booking.updateOne(
      { bookingId },
      { $set: { guestReview: reviewData } }
    );
  } else {
    await Booking.updateOne(
      { bookingId },
      { $set: { hostReview: reviewData } }
    );
  }

  // Update property rating
  await updatePropertyRating(booking.propertyId);

  return review;
}

/**
 * Update property rating based on all reviews
 */
async function updatePropertyRating(propertyId: string): Promise<void> {
  const result = await Review.aggregate([
    { $match: { propertyId, reviewerType: 'guest' } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    const { avgRating, count } = result[0];
    await mongoose.model('Property').updateOne(
      { propertyId },
      {
        $set: {
          'stats.rating': Math.round(avgRating * 10) / 10,
          'stats.reviewCount': count,
        },
      }
    );
  }
}

/**
 * Get review by ID
 */
export async function getReviewById(reviewId: string): Promise<IReview> {
  const review = await Review.findOne({ reviewId }).lean();
  if (!review) {
    throw new NotFoundError('Review', reviewId);
  }
  return review as unknown as IReview;
}

/**
 * Get reviews for a property
 */
export async function getReviewsForProperty(
  propertyId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{
  reviews: IReview[];
  total: number;
  page: number;
  totalPages: number;
  averageRating: number;
}> {
  const { page = 1, limit = 20 } = options;

  const query = { propertyId };
  const skip = (page - 1) * limit;

  const [reviews, total, avgResult] = await Promise.all([
    Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
    Review.aggregate([
      { $match: { propertyId, reviewerType: 'guest' } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]),
  ]);

  return {
    reviews: reviews as unknown as IReview[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
    averageRating: avgResult[0]?.avgRating || 0,
  };
}

/**
 * Get reviews by a host (reviews received by host)
 */
export async function getReviewsForHost(
  hostId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{
  reviews: IReview[];
  total: number;
  page: number;
  totalPages: number;
  averageRating: number;
}> {
  const { page = 1, limit = 20 } = options;

  const query = { hostId, reviewerType: 'guest' };
  const skip = (page - 1) * limit;

  const [reviews, total, avgResult] = await Promise.all([
    Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
    Review.aggregate([
      { $match: { hostId, reviewerType: 'guest' } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]),
  ]);

  return {
    reviews: reviews as unknown as IReview[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
    averageRating: avgResult[0]?.avgRating || 0,
  };
}

/**
 * Get reviews by guest (reviews written by guest)
 */
export async function getReviewsByGuest(
  guestId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{
  reviews: IReview[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page = 1, limit = 20 } = options;

  const query = { guestId, reviewerType: 'guest' };
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
  ]);

  return {
    reviews: reviews as unknown as IReview[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Host responds to review
 */
export async function respondToReview(input: ReviewResponseInput): Promise<IReview> {
  const { reviewId, hostId, response } = input;

  const review = await Review.findOne({ reviewId, hostId });
  if (!review) {
    throw new NotFoundError('Review', reviewId);
  }

  if (review.response) {
    throw new ConflictError('Response already exists');
  }

  review.response = {
    text: response,
    respondedAt: new Date(),
  };

  await review.save();
  reviewLogger.info({ reviewId, hostId }, 'Review response added');

  return review;
}

/**
 * Mark review as helpful
 */
export async function markReviewHelpful(reviewId: string): Promise<IReview> {
  const review = await Review.findOneAndUpdate(
    { reviewId },
    { $inc: { helpful: 1 } },
    { new: true }
  );

  if (!review) {
    throw new NotFoundError('Review', reviewId);
  }

  return review as unknown as IReview;
}

/**
 * Search reviews
 */
export async function searchReviews(input: ReviewSearchInput): Promise<{
  reviews: IReview[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const {
    propertyId,
    hostId,
    guestId,
    minRating,
    maxRating,
    page = 1,
    limit = 20,
  } = input;

  const query: Record<string, unknown> = {};

  if (propertyId) query.propertyId = propertyId;
  if (hostId) query.hostId = hostId;
  if (guestId) query.guestId = guestId;
  if (minRating || maxRating) {
    query.rating = {};
    if (minRating) (query.rating as Record<string, number>).$gte = minRating;
    if (maxRating) (query.rating as Record<string, number>).$lte = maxRating;
  }

  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Review.countDocuments(query),
  ]);

  return {
    reviews: reviews as unknown as IReview[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
