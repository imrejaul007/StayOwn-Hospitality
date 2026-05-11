/**
 * Re-export from the canonical reviewService module.
 * This file exists for backward compatibility -- new code should import from reviewService directly.
 */
import { reviewService, Review, HotelReviewsResponse, CreateReviewRequest } from './reviewService';

export type { CreateReviewRequest };

// Re-export the Review type (consumers use this)
export type { Review };

// Alias ReviewSummary from the HotelReviewsResponse shape
export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  categoryAverages: {
    cleanliness?: number;
    service?: number;
    location?: number;
    value?: number;
    amenities?: number;
  };
}

export interface ReviewsResponse {
  reviews: Review[];
  summary: ReviewSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Thin wrapper that delegates to the canonical ReviewService.
 * Preserves the API surface that consumers (ReviewsPage, HomePage, AdminReviewsManagement) expect.
 */
class ReviewsService {
  async getHotelReviews(
    hotelId: string,
    params?: {
      page?: number;
      limit?: number;
      rating?: number;
      sortBy?: 'newest' | 'oldest' | 'highest_rated' | 'lowest_rated' | 'most_helpful';
    }
  ): Promise<ReviewsResponse> {
    const result = await reviewService.getHotelReviews(hotelId, params);
    return result as ReviewsResponse;
  }

  async getHotelRatingSummary(hotelId: string): Promise<ReviewSummary> {
    const result = await reviewService.getHotelRatingSummary(hotelId);
    return result as ReviewSummary;
  }

  async createReview(reviewData: CreateReviewRequest): Promise<Review> {
    const result = await reviewService.createReview(reviewData);
    return result.data.review;
  }

  async getReview(reviewId: string): Promise<Review> {
    const result = await reviewService.getReview(reviewId);
    return result.data.review;
  }

  async addResponse(reviewId: string, content: string): Promise<Review> {
    const result = await reviewService.addResponse(reviewId, content);
    return result.data.review;
  }

  async markHelpful(reviewId: string): Promise<{ helpfulVotes: number }> {
    const result = await reviewService.markReviewHelpful(reviewId);
    return result.data;
  }

  async reportReview(reviewId: string, reason?: string): Promise<void> {
    await reviewService.reportReview(reviewId, reason || '');
  }

  async getUserReviews(params?: { page?: number; limit?: number }): Promise<{
    reviews: Review[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    return reviewService.getMyReviews(params);
  }

  async moderateReview(
    reviewId: string,
    status: 'approved' | 'rejected' | 'pending',
    notes?: string
  ): Promise<Review> {
    const result = await reviewService.moderateReview(reviewId, status, notes);
    return result.data.review;
  }

  async getPendingReviews(params?: { page?: number; limit?: number }): Promise<{
    reviews: Review[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    return reviewService.getPendingReviews(params);
  }
}

export default new ReviewsService();
