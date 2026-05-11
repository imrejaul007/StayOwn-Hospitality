import { api } from './api';

export interface CreateReviewRequest {
  hotelId: string;
  bookingId?: string;
  rating: number;
  title: string;
  content: string;
  categories?: {
    cleanliness: number;
    service: number;
    location: number;
    value: number;
    amenities: number;
  };
  visitType?: 'business' | 'leisure' | 'family' | 'couple' | 'solo';
  stayDate?: string;
  images?: string[];
  isAnonymous?: boolean;
}

export interface Review {
  _id: string;
  hotelId: {
    _id: string;
    name: string;
    address?: {
      street: string;
      city: string;
      state: string;
    };
  };
  userId: {
    _id: string;
    name: string;
  };
  bookingId?: {
    _id: string;
    bookingNumber: string;
    checkIn: string;
    checkOut: string;
  };
  rating: number;
  title: string;
  content: string;
  categories?: {
    cleanliness: number;
    service: number;
    location: number;
    value: number;
    amenities: number;
  };
  isVerified: boolean;
  isPublished: boolean;
  helpfulVotes: number;
  reportedCount: number;
  images: string[];
  visitType?: string;
  stayDate?: string;
  guestName?: string;
  roomType?: string;
  source: string;
  language: string;
  moderationStatus: string;
  response?: {
    content: string;
    respondedBy: {
      _id: string;
      name: string;
      role: string;
    };
    respondedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HotelReviewsResponse {
  reviews: Review[];
  summary: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
      [key: number]: number;
    };
    categoryAverages: {
      cleanliness: number;
      service: number;
      location: number;
      value: number;
      amenities: number;
    };
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class ReviewService {
  async createReview(data: CreateReviewRequest): Promise<{ status: string; data: { review: Review } }> {
    try {
      const response = await api.post('/reviews', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getHotelReviews(
    hotelId: string,
    params?: {
      page?: number;
      limit?: number;
      rating?: number;
      sortBy?: 'newest' | 'oldest' | 'highest_rated' | 'lowest_rated' | 'most_helpful';
    }
  ): Promise<HotelReviewsResponse> {
    try {
      const response = await api.get(`/reviews/hotel/${hotelId}`, { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getHotelRatingSummary(hotelId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
    categoryAverages: {
      cleanliness: number;
      service: number;
      location: number;
      value: number;
      amenities: number;
    };
  }> {
    try {
      const response = await api.get(`/reviews/hotel/${hotelId}/summary`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getReview(reviewId: string): Promise<{ status: string; data: { review: Review } }> {
    try {
      const response = await api.get(`/reviews/${reviewId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async markReviewHelpful(reviewId: string): Promise<{ status: string; message: string; data: { helpfulVotes: number } }> {
    try {
      const response = await api.post(`/reviews/${reviewId}/helpful`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async reportReview(reviewId: string, reason: string): Promise<{ status: string; message: string }> {
    try {
      const response = await api.post(`/reviews/${reviewId}/report`, { reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async addResponse(reviewId: string, content: string): Promise<{ status: string; message: string; data: { review: Review } }> {
    try {
      const response = await api.post(`/reviews/${reviewId}/response`, { content });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async moderateReview(
    reviewId: string,
    status: 'approved' | 'rejected' | 'pending',
    notes?: string
  ): Promise<{ status: string; message: string; data: { review: Review } }> {
    try {
      const response = await api.patch(`/reviews/${reviewId}/moderate`, { status, notes });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getPendingReviews(params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    reviews: Review[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const response = await api.get('/reviews/pending', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getMyReviews(params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    reviews: Review[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const response = await api.get('/reviews/user/my-reviews', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const reviewService = new ReviewService();
