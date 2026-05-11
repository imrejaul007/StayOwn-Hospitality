import { api } from './api';

export interface GuestIntelligenceParams {
  page?: number;
  limit?: number;
  segment?: string;
  lifecycleStage?: string;
  minLoyaltyScore?: number;
  maxLoyaltyScore?: number;
}

export interface CRMProfileResponse {
  success: boolean;
  data: {
    profiles: CRMProfile[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalResults: number;
      limit: number;
    };
  };
}

export interface CRMProfile {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  } | null;
  personalInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  preferences?: {
    roomType?: string[];
    floor?: string;
    amenities?: string[];
    specialRequests?: string[];
  };
  bookingHistory: {
    totalBookings: number;
    totalRevenue: number;
    averageStayDuration: number;
    cancellationRate: number;
    noShowRate: number;
    favoriteRoomTypes?: string[];
  };
  satisfaction?: {
    averageRating: number;
    totalReviews: number;
  };
  predictions?: {
    churnProbability?: number;
    lifetimeValuePrediction?: number;
    nextBookingProbability?: number;
    upsellProbability?: number;
  };
  rfmAnalysis?: {
    segment?: string;
  };
  behaviorProfile?: {
    bookingPattern?: {
      lengthOfStay?: number;
    };
    engagementLevel?: string;
  };
  lifecycleStage?: {
    stage?: string;
  };
  tags?: string[];
}

export interface CRMAnalyticsResponse {
  success: boolean;
  data: {
    overallMetrics: Record<string, number>;
    segmentDistribution: Array<{ _id: string; count: number; totalSpending: number }>;
    lifecycleDistribution: Array<{ _id: string; count: number }>;
    topCustomers: CRMProfile[];
    recentActivity: unknown[];
  };
}

export interface VIPGuestsResponse {
  status: string;
  results: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    limit: number;
  };
  data: {
    vipGuests: VIPGuestRecord[];
  };
}

export interface VIPGuestRecord {
  _id: string;
  guestId: {
    _id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
  } | null;
  vipLevel: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  status: string;
  benefits?: Record<string, boolean | number>;
  qualificationCriteria?: {
    totalStays?: number;
    totalNights?: number;
    totalSpent?: number;
    averageRating?: number;
  };
  specialRequests?: string[];
}

export interface VIPStatisticsResponse {
  status: string;
  data: Record<string, unknown>;
}

class GuestIntelligenceService {
  /** GET /crm/segments -- paginated CRM guest profiles */
  async getGuestProfiles(params?: GuestIntelligenceParams): Promise<CRMProfileResponse> {
    const response = await api.get('/crm/segments', { params: { limit: 50, ...params } });
    return response.data;
  }

  /** GET /crm/analytics -- segment distribution, lifecycle stats, top customers */
  async getCRMAnalytics(): Promise<CRMAnalyticsResponse> {
    const response = await api.get('/crm/analytics');
    return response.data;
  }

  /** GET /vip -- VIP guest list with tiers */
  async getVIPGuests(params?: { page?: number; limit?: number; vipLevel?: string }): Promise<VIPGuestsResponse> {
    const response = await api.get('/vip', { params: { limit: 50, ...params } });
    return response.data;
  }

  /** GET /vip/statistics -- tier counts, revenue breakdown */
  async getVIPStatistics(): Promise<VIPStatisticsResponse> {
    const response = await api.get('/vip/statistics');
    return response.data;
  }
}

export const guestIntelligenceService = new GuestIntelligenceService();
export default guestIntelligenceService;
