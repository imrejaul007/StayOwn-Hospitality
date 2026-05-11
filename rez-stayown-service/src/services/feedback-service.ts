/**
 * Guest Feedback Service
 *
 * Handles post-stay survey collection, service ratings, and text comments
 * for the StayOwn hotel booking platform.
 */

import mongoose from 'mongoose';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceRating {
  category: 'cleanliness' | 'staff' | 'amenities' | 'food' | 'location' | 'value' | 'checkin' | 'checkout';
  rating: number; // 1-5 stars
}

export interface FeedbackInput {
  bookingId: string;
  hotelId: string;
  guestId: string;
  guestName?: string;
  guestEmail?: string;
  // Overall experience rating (1-5 stars)
  overallRating: number;
  // Individual service ratings
  serviceRatings: ServiceRating[];
  // Text feedback
  textComment?: string;
  textLanguage?: 'en' | 'hi' | 'other';
  // NPS-style question
  recommendLikelihood: number; // 0-10 scale (Detractor/Passive/Promoter)
  // Stay details
  stayType: 'business' | 'leisure' | 'family' | 'couple' | 'solo';
  roomType?: string;
  // Metadata
  source: 'post_stay_email' | 'checkout_screen' | 'in_stay' | 'app_survey';
  deviceType?: 'ios' | 'android' | 'web';
  isAnonymous?: boolean;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId?: string;
  thankYouMessage?: string;
  error?: string;
}

export interface FeedbackDocument extends mongoose.Document {
  bookingId: string;
  hotelId: string;
  guestId: string;
  guestName?: string;
  guestEmail?: string;
  overallRating: number;
  serviceRatings: Array<{
    category: string;
    rating: number;
  }>;
  textComment?: string;
  textLanguage?: string;
  recommendLikelihood: number;
  stayType: string;
  roomType?: string;
  source: string;
  deviceType?: string;
  isAnonymous: boolean;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AggregatedRatings {
  hotelId: string;
  period: 'all_time' | '30_days' | '7_days';
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  averageServiceRatings: Record<string, number>;
  npsScore: number;
  recentTrend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}

export interface FeedbackListItem {
  id: string;
  bookingId: string;
  guestName: string;
  overallRating: number;
  textComment?: string;
  recommendLikelihood: number;
  stayType: string;
  serviceRatings: Array<{
    category: string;
    rating: number;
  }>;
  submittedAt: Date;
  isAnonymous: boolean;
}

// ─── MongoDB Schema ─────────────────────────────────────────────────────────────

const ServiceRatingSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['cleanliness', 'staff', 'amenities', 'food', 'location', 'value', 'checkin', 'checkout'],
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
}, { _id: false });

const FeedbackSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    index: true,
  },
  hotelId: {
    type: String,
    required: true,
    index: true,
  },
  guestId: {
    type: String,
    required: true,
    index: true,
  },
  guestName: {
    type: String,
  },
  guestEmail: {
    type: String,
  },
  overallRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true,
  },
  serviceRatings: {
    type: [ServiceRatingSchema],
    default: [],
  },
  textComment: {
    type: String,
    maxlength: 2000,
  },
  textLanguage: {
    type: String,
    enum: ['en', 'hi', 'other'],
    default: 'en',
  },
  recommendLikelihood: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
  },
  stayType: {
    type: String,
    required: true,
    enum: ['business', 'leisure', 'family', 'couple', 'solo'],
  },
  roomType: {
    type: String,
  },
  source: {
    type: String,
    required: true,
    enum: ['post_stay_email', 'checkout_screen', 'in_stay', 'app_survey'],
  },
  deviceType: {
    type: String,
    enum: ['ios', 'android', 'web'],
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

// Compound indexes for common queries
FeedbackSchema.index({ hotelId: 1, submittedAt: -1 });
FeedbackSchema.index({ hotelId: 1, overallRating: -1 });
FeedbackSchema.index({ bookingId: 1 }, { unique: true }); // One feedback per booking

// ─── Model ─────────────────────────────────────────────────────────────────────

export const Feedback = mongoose.models.Feedback || mongoose.model<FeedbackDocument>('Feedback', FeedbackSchema);

// ─── Service Functions ─────────────────────────────────────────────────────────

/**
 * Submit guest feedback
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResponse> {
  try {
    // Check if feedback already exists for this booking
    const existing = await Feedback.findOne({ bookingId: input.bookingId });
    if (existing) {
      // Update existing feedback
      existing.overallRating = input.overallRating;
      existing.serviceRatings = input.serviceRatings;
      existing.textComment = input.textComment;
      existing.textLanguage = input.textLanguage;
      existing.recommendLikelihood = input.recommendLikelihood;
      existing.stayType = input.stayType;
      existing.roomType = input.roomType;
      existing.submittedAt = new Date();
      await existing.save();

      return {
        success: true,
        feedbackId: existing._id.toString(),
        thankYouMessage: 'Thank you for updating your feedback!',
      };
    }

    // Create new feedback
    const feedback = new Feedback({
      bookingId: input.bookingId,
      hotelId: input.hotelId,
      guestId: input.guestId,
      guestName: input.isAnonymous ? undefined : input.guestName,
      guestEmail: input.isAnonymous ? undefined : input.guestEmail,
      overallRating: input.overallRating,
      serviceRatings: input.serviceRatings,
      textComment: input.textComment,
      textLanguage: input.textLanguage,
      recommendLikelihood: input.recommendLikelihood,
      stayType: input.stayType,
      roomType: input.roomType,
      source: input.source,
      deviceType: input.deviceType,
      isAnonymous: input.isAnonymous || false,
      submittedAt: new Date(),
    });

    await feedback.save();

    return {
      success: true,
      feedbackId: feedback._id.toString(),
      thankYouMessage: 'Thank you for your feedback! Your input helps us improve.',
    };
  } catch (error: any) {
    console.error('[FeedbackService] Submit error:', error);

    if (error.code === 11000) {
      return {
        success: false,
        error: 'Feedback already submitted for this booking',
      };
    }

    return {
      success: false,
      error: 'Failed to submit feedback',
    };
  }
}

/**
 * Get feedback for a specific booking
 */
export async function getFeedbackByBookingId(bookingId: string): Promise<FeedbackDocument | null> {
  return Feedback.findOne({ bookingId });
}

/**
 * Get aggregated ratings for a hotel
 */
export async function getHotelRatings(
  hotelId: string,
  period: 'all_time' | '30_days' | '7_days' = 'all_time'
): Promise<AggregatedRatings> {
  let dateFilter: { $gte?: Date } = {};

  if (period === '30_days') {
    dateFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  } else if (period === '7_days') {
    dateFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  }

  const matchStage: Record<string, any> = { hotelId };
  if (Object.keys(dateFilter).length > 0) {
    matchStage.submittedAt = dateFilter;
  }

  // Get all feedback for aggregation
  const feedbackDocs = await Feedback.find(matchStage).lean();

  const totalReviews = feedbackDocs.length;

  if (totalReviews === 0) {
    return {
      hotelId,
      period,
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      averageServiceRatings: {},
      npsScore: 0,
      recentTrend: 'stable',
      lastUpdated: new Date(),
    };
  }

  // Calculate average overall rating
  const totalRating = feedbackDocs.reduce((sum, f) => sum + f.overallRating, 0);
  const averageRating = totalRating / totalReviews;

  // Calculate rating distribution
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  feedbackDocs.forEach(f => {
    const rating = Math.round(f.overallRating);
    const normalizedRating = Math.min(5, Math.max(1, rating)) as 1 | 2 | 3 | 4 | 5;
    ratingDistribution[normalizedRating]++;
  });

  // Calculate NPS score (Net Promoter Score)
  const promoters = feedbackDocs.filter(f => f.recommendLikelihood >= 9).length;
  const detractors = feedbackDocs.filter(f => f.recommendLikelihood <= 6).length;
  const npsScore = Math.round(((promoters - detractors) / totalReviews) * 100);

  // Calculate average service ratings
  const serviceRatingSums: Record<string, { sum: number; count: number }> = {};
  feedbackDocs.forEach(f => {
    f.serviceRatings?.forEach((sr: { category: string; rating: number }) => {
      if (!serviceRatingSums[sr.category]) {
        serviceRatingSums[sr.category] = { sum: 0, count: 0 };
      }
      serviceRatingSums[sr.category].sum += sr.rating;
      serviceRatingSums[sr.category].count++;
    });
  });

  const averageServiceRatings: Record<string, number> = {};
  Object.entries(serviceRatingSums).forEach(([category, data]) => {
    averageServiceRatings[category] = Math.round((data.sum / data.count) * 10) / 10;
  });

  // Calculate recent trend (compare last 7 days vs previous 7 days)
  let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (period === 'all_time' || period === '30_days') {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const recentFeedback = feedbackDocs.filter(f =>
      new Date(f.submittedAt) >= sevenDaysAgo
    );
    const previousFeedback = feedbackDocs.filter(f => {
      const date = new Date(f.submittedAt);
      return date >= fourteenDaysAgo && date < sevenDaysAgo;
    });

    if (recentFeedback.length >= 3 && previousFeedback.length >= 3) {
      const recentAvg = recentFeedback.reduce((s, f) => s + f.overallRating, 0) / recentFeedback.length;
      const previousAvg = previousFeedback.reduce((s, f) => s + f.overallRating, 0) / previousFeedback.length;

      if (recentAvg > previousAvg + 0.2) {
        recentTrend = 'improving';
      } else if (recentAvg < previousAvg - 0.2) {
        recentTrend = 'declining';
      }
    }
  }

  return {
    hotelId,
    period,
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution,
    averageServiceRatings,
    npsScore,
    recentTrend,
    lastUpdated: new Date(),
  };
}

/**
 * Get paginated feedback list for a hotel
 */
export async function getHotelFeedbackList(
  hotelId: string,
  options: {
    page?: number;
    limit?: number;
    minRating?: number;
    sortBy?: 'recent' | 'rating_high' | 'rating_low';
  } = {}
): Promise<{
  feedback: FeedbackListItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const {
    page = 1,
    limit = 10,
    minRating,
    sortBy = 'recent',
  } = options;

  const query: Record<string, any> = { hotelId };

  if (minRating) {
    query.overallRating = { $gte: minRating };
  }

  let sortQuery: Record<string, 1 | -1> = { submittedAt: -1 };
  if (sortBy === 'rating_high') {
    sortQuery = { overallRating: -1, submittedAt: -1 };
  } else if (sortBy === 'rating_low') {
    sortQuery = { overallRating: 1, submittedAt: -1 };
  }

  const skip = (page - 1) * limit;

  const [feedbackDocs, total] = await Promise.all([
    Feedback.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean(),
    Feedback.countDocuments(query),
  ]);

  const feedback: FeedbackListItem[] = feedbackDocs.map(f => ({
    id: (f._id as any)?.toString() || '',
    bookingId: f.bookingId,
    guestName: f.isAnonymous ? 'Anonymous Guest' : (f.guestName || 'Guest'),
    overallRating: f.overallRating,
    textComment: f.textComment,
    recommendLikelihood: f.recommendLikelihood,
    stayType: f.stayType,
    serviceRatings: f.serviceRatings,
    submittedAt: f.submittedAt,
    isAnonymous: f.isAnonymous,
  }));

  return {
    feedback,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get feedback response rate for a hotel
 */
export async function getFeedbackResponseRate(
  hotelId: string,
  totalBookings30Days: number
): Promise<{
  totalBookings: number;
  totalFeedback: number;
  responseRate: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const totalFeedback = await Feedback.countDocuments({
    hotelId,
    submittedAt: { $gte: thirtyDaysAgo },
  });

  const responseRate = totalBookings30Days > 0
    ? Math.round((totalFeedback / totalBookings30Days) * 100)
    : 0;

  return {
    totalBookings: totalBookings30Days,
    totalFeedback,
    responseRate,
  };
}

/**
 * Delete feedback (admin function)
 */
export async function deleteFeedback(feedbackId: string): Promise<boolean> {
  try {
    const result = await Feedback.findByIdAndDelete(feedbackId);
    return !!result;
  } catch {
    return false;
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export const feedbackService = {
  submitFeedback,
  getFeedbackByBookingId,
  getHotelRatings,
  getHotelFeedbackList,
  getFeedbackResponseRate,
  deleteFeedback,
};

export default feedbackService;
