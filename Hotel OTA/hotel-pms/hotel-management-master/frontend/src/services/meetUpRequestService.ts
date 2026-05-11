import { api } from './api';

export interface MeetUpRequest {
  _id: string;
  requesterId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  targetUserId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  hotelId: {
    _id: string;
    name: string;
    address: string;
  };
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  type: 'casual' | 'business' | 'social' | 'networking' | 'activity';
  title: string;
  description: string;
  proposedDate: string;
  proposedTime: {
    start: string;
    end: string;
  };
  location: {
    type: 'hotel_lobby' | 'restaurant' | 'bar' | 'meeting_room' | 'outdoor' | 'other';
    name: string;
    details?: string;
  };
  meetingRoomBooking?: {
    roomId?: {
      _id: string;
      number: string;
      type: string;
    };
    bookingId?: string;
    isRequired: boolean;
  };
  participants: {
    maxParticipants: number;
    confirmedParticipants: Participant[];
  };
  preferences?: {
    interests?: string[];
    languages?: string[];
    ageGroup?: '18-25' | '26-35' | '36-45' | '46-55' | '55+' | 'any';
    gender?: 'male' | 'female' | 'any';
  };
  communication?: {
    preferredMethod: 'in_app' | 'email' | 'phone' | 'whatsapp';
    contactInfo?: {
      email?: string;
      phone?: string;
      whatsapp?: string;
    };
  };
  response?: {
    status: 'pending' | 'accepted' | 'declined';
    message?: string;
    respondedAt?: string;
    alternativeDate?: string;
    alternativeTime?: {
      start: string;
      end: string;
    };
  };
  activity?: {
    type: 'coffee' | 'lunch' | 'dinner' | 'drinks' | 'walk' | 'tour' | 'game' | 'other';
    duration: number;
    cost: number;
    costSharing: boolean;
  };
  safety?: {
    verifiedOnly: boolean;
    publicLocation: boolean;
    hotelStaffPresent: boolean;
  };
  metadata?: {
    tags?: string[];
    category?: 'business' | 'leisure' | 'cultural' | 'sports' | 'food' | 'entertainment';
    difficulty?: 'easy' | 'moderate' | 'challenging';
  };
  isUpcoming: boolean;
  isPast: boolean;
  canBeCancelled: boolean;
  canBeRescheduled: boolean;
  participantCount: number;
  hasAvailableSpots: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  userId: string;
  name: string;
  email: string;
  confirmedAt: string;
}

export interface MeetUpRequestsResponse {
  meetUps: MeetUpRequest[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface MeetUpStats {
  totalRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  completedRequests: number;
  upcomingMeetUps: number;
  statusBreakdown: Array<{
    _id: string;
    count: number;
  }>;
}

export interface CreateMeetUpRequest {
  targetUserId: string;
  hotelId: string;
  type: 'casual' | 'business' | 'social' | 'networking' | 'activity';
  title: string;
  description: string;
  proposedDate: string;
  proposedTime: {
    start: string;
    end: string;
  };
  location: {
    type: 'hotel_lobby' | 'restaurant' | 'bar' | 'meeting_room' | 'outdoor' | 'other';
    name: string;
    details?: string;
  };
  meetingRoomBooking?: {
    roomId?: string;
    isRequired?: boolean;
  };
  participants?: {
    maxParticipants?: number;
  };
  preferences?: {
    interests?: string[];
    languages?: string[];
    ageGroup?: '18-25' | '26-35' | '36-45' | '46-55' | '55+' | 'any';
    gender?: 'male' | 'female' | 'any';
  };
  communication?: {
    preferredMethod?: 'in_app' | 'email' | 'phone' | 'whatsapp';
    contactInfo?: {
      email?: string;
      phone?: string;
      whatsapp?: string;
    };
  };
  activity?: {
    type?: 'coffee' | 'lunch' | 'dinner' | 'drinks' | 'walk' | 'tour' | 'game' | 'other';
    duration?: number;
    cost?: number;
    costSharing?: boolean;
  };
  safety?: {
    verifiedOnly?: boolean;
    publicLocation?: boolean;
    hotelStaffPresent?: boolean;
  };
  metadata?: {
    tags?: string[];
    category?: 'business' | 'leisure' | 'cultural' | 'sports' | 'food' | 'entertainment';
    difficulty?: 'easy' | 'moderate' | 'challenging';
  };
}

export interface RespondToMeetUpRequest {
  message?: string;
}

export interface AddParticipant {
  userId: string;
  name: string;
  email: string;
}

export interface SuggestAlternative {
  date: string;
  time: {
    start: string;
    end: string;
  };
}

export interface PotentialPartner {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  interests?: string[];
  languages?: string[];
  ageGroup?: string;
  gender?: string;
}

export interface AdminAnalytics {
  summary: {
    totalRequests: number;
    acceptanceRate: number;
    declineRate: number;
    completionRate: number;
    avgResponseTime: number;
  };
  breakdown: {
    status: Array<{ _id: string; count: number }>;
    type: Array<{ _id: string; count: number }>;
    hotels: Array<{ _id: string; hotelName: string; count: number }>;
    locations: Array<{ _id: string; count: number }>;
  };
  trends: {
    daily: Array<{
      _id: string;
      requests: number;
      accepted: number;
      completed: number;
    }>;
    peakTimes: Array<{
      _id: { hour: number; dayOfWeek: number };
      count: number;
    }>;
  };
  users: {
    topRequesters: Array<{
      _id: string;
      userName: string;
      requestsSent: number;
    }>;
  };
  period: string;
  generatedAt: string;
}

export interface AdminInsights {
  userEngagement: {
    totalUsers: number;
    activeUsers: number;
    engagementRate: number;
  };
  riskAssessment: {
    potentiallyRiskyMeetUps: number;
    frequentRequesters: number;
    riskyMeetUpDetails: MeetUpRequest[];
  };
  hotelPerformance: {
    underperformingHotels: Array<{
      _id: string;
      hotelName: string;
      acceptanceRate: number;
      total: number;
    }>;
  };
  safetyInsights: {
    totalRequests: number;
    verifiedOnly: number;
    publicLocation: number;
    hotelStaffPresent: number;
  };
}

export interface MeetUpGuestFeatureStatus {
  meetUpsEnabled: boolean;
  hotelId: string | null;
  reason?: 'no_active_stay' | 'disabled_by_property';
}

export type MeetUpReportReason = 'harassment' | 'spam' | 'inappropriate' | 'safety' | 'other';

export interface SubmitMeetUpReportBody {
  reportedUserId: string;
  meetUpRequestId?: string | null;
  reason: MeetUpReportReason;
  details?: string;
}

export interface GuestMeetUpReportRow {
  _id: string;
  hotelId: string;
  reporterId?: { _id: string; name?: string; email?: string };
  reportedUserId?: { _id: string; name?: string; email?: string };
  meetUpRequestId?: { _id: string; title?: string; status?: string } | null;
  reason: MeetUpReportReason;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
}

export interface HotelGuestExperienceSettings {
  meetUpsEnabled: boolean;
  meetUpsEmailNotify?: boolean;
  maxPendingInvitesPerGuest?: number;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  blockUrlsInMeetUpText?: boolean;
  profanityAction?: 'none' | 'block' | 'sanitize';
}

class MeetUpRequestService {
  async getGuestFeatureStatus(): Promise<MeetUpGuestFeatureStatus> {
    const response = await api.get('/meet-up-requests/guest/feature-status');
    return response.data.data;
  }

  async getMyMeetUpBlocks(): Promise<{ blockedUserIds: string[]; hotelId: string | null }> {
    const response = await api.get('/meet-up-requests/my-blocks');
    return response.data.data;
  }

  async submitMeetUpReport(body: SubmitMeetUpReportBody): Promise<{ id: string }> {
    const response = await api.post('/meet-up-requests/report', body);
    return response.data.data;
  }

  async blockMeetUpPeer(targetUserId: string): Promise<void> {
    await api.post(`/meet-up-requests/blocks/${targetUserId}`, {});
  }

  async unblockMeetUpPeer(targetUserId: string): Promise<void> {
    await api.delete(`/meet-up-requests/blocks/${targetUserId}`);
  }

  async getAdminGuestMeetupReports(params: {
    hotelId?: string;
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{
    reports: GuestMeetUpReportRow[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const response = await api.get('/meet-up-requests/admin/guest-meetup-reports', { params });
    return response.data.data;
  }

  async getMeetUpRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    filter?: string;
    search?: string;
  }): Promise<MeetUpRequestsResponse> {
    try {
      const response = await api.get('/meet-up-requests', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getPendingRequests(params?: {
    page?: number;
    limit?: number;
  }): Promise<MeetUpRequestsResponse> {
    try {
      const response = await api.get('/meet-up-requests/pending', { params });
      const data = response.data.data;
      return {
        meetUps: data.pendingRequests || [],
        pagination: data.pagination
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getUpcomingMeetUps(params?: {
    page?: number;
    limit?: number;
  }): Promise<MeetUpRequestsResponse> {
    try {
      const response = await api.get('/meet-up-requests/upcoming', { params });
      const data = response.data.data;
      return {
        meetUps: data.upcomingMeetUps || [],
        pagination: data.pagination
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createMeetUpRequest(request: CreateMeetUpRequest): Promise<{
    message: string;
    data: MeetUpRequest;
  }> {
    try {
      const response = await api.post('/meet-up-requests', request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getMeetUpRequest(requestId: string): Promise<MeetUpRequest> {
    try {
      const response = await api.get(`/meet-up-requests/${requestId}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async acceptMeetUpRequest(requestId: string, data: RespondToMeetUpRequest): Promise<{
    message: string;
    data: MeetUpRequest;
  }> {
    try {
      const response = await api.post(`/meet-up-requests/${requestId}/accept`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async declineMeetUpRequest(requestId: string, data: RespondToMeetUpRequest): Promise<{
    message: string;
    data: MeetUpRequest;
  }> {
    try {
      const response = await api.post(`/meet-up-requests/${requestId}/decline`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async cancelMeetUpRequest(requestId: string): Promise<{ message: string }> {
    try {
      const response = await api.post(`/meet-up-requests/${requestId}/cancel`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async completeMeetUpRequest(requestId: string): Promise<{ message: string }> {
    try {
      const response = await api.post(`/meet-up-requests/${requestId}/complete`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async addParticipant(requestId: string, data: AddParticipant): Promise<{ message: string }> {
    try {
      const response = await api.post(`/meet-up-requests/${requestId}/participants`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async removeParticipant(requestId: string, userId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`/meet-up-requests/${requestId}/participants/${userId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async suggestAlternative(requestId: string, data: SuggestAlternative): Promise<{ message: string }> {
    try {
      const response = await api.post(`/meet-up-requests/${requestId}/suggest-alternative`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async searchPartners(params?: {
    page?: number;
    limit?: number;
    interests?: string;
    languages?: string;
    ageGroup?: string;
    gender?: string;
    hotelId?: string;
  }): Promise<{
    users: PotentialPartner[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const response = await api.get('/meet-up-requests/search/partners', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getStats(): Promise<MeetUpStats> {
    try {
      const response = await api.get('/meet-up-requests/stats/overview');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Admin-specific methods
  async getAdminAllMeetUps(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    hotelId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<MeetUpRequestsResponse> {
    try {
      const response = await api.get('/meet-up-requests/admin/all', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getAdminAnalytics(params?: {
    period?: string;
    hotelId?: string;
  }): Promise<AdminAnalytics> {
    try {
      const response = await api.get('/meet-up-requests/admin/analytics', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async adminForceCancel(requestId: string, reason?: string): Promise<{
    message: string;
    data: MeetUpRequest;
  }> {
    try {
      const response = await api.post(`/meet-up-requests/admin/${requestId}/force-cancel`, { reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getAdminInsights(params?: {
    hotelId?: string;
  }): Promise<AdminInsights> {
    try {
      const response = await api.get('/meet-up-requests/admin/insights', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Utility functions
  getMeetUpTypeInfo(type: string): { label: string; color: string; icon: string; description: string } {
    const types = {
      casual: {
        label: 'Casual Meet-up',
        color: 'bg-blue-100 text-blue-800',
        icon: '☕',
        description: 'Informal social gathering'
      },
      business: {
        label: 'Business Meeting',
        color: 'bg-gray-100 text-gray-800',
        icon: '💼',
        description: 'Professional networking or business discussion'
      },
      social: {
        label: 'Social Event',
        color: 'bg-purple-100 text-purple-800',
        icon: '🎉',
        description: 'Social gathering or celebration'
      },
      networking: {
        label: 'Networking',
        color: 'bg-green-100 text-green-800',
        icon: '🤝',
        description: 'Professional networking opportunity'
      },
      activity: {
        label: 'Activity',
        color: 'bg-orange-100 text-orange-800',
        icon: '🎯',
        description: 'Shared activity or experience'
      }
    };
    return types[type as keyof typeof types] || types.casual;
  }

  getStatusInfo(status: string): { label: string; color: string; description: string } {
    const statuses = {
      pending: {
        label: 'Pending',
        color: 'bg-yellow-100 text-yellow-800',
        description: 'Waiting for response'
      },
      accepted: {
        label: 'Accepted',
        color: 'bg-green-100 text-green-800',
        description: 'Meet-up confirmed'
      },
      declined: {
        label: 'Declined',
        color: 'bg-red-100 text-red-800',
        description: 'Request declined'
      },
      cancelled: {
        label: 'Cancelled',
        color: 'bg-gray-100 text-gray-800',
        description: 'Meet-up cancelled'
      },
      completed: {
        label: 'Completed',
        color: 'bg-blue-100 text-blue-800',
        description: 'Meet-up completed'
      }
    };
    return statuses[status as keyof typeof statuses] || statuses.pending;
  }

  getLocationTypeInfo(type: string): { label: string; color: string; icon: string } {
    const locations = {
      hotel_lobby: {
        label: 'Hotel Lobby',
        color: 'bg-indigo-100 text-indigo-800',
        icon: '🏨'
      },
      restaurant: {
        label: 'Restaurant',
        color: 'bg-red-100 text-red-800',
        icon: '🍽️'
      },
      bar: {
        label: 'Bar',
        color: 'bg-amber-100 text-amber-800',
        icon: '🍺'
      },
      meeting_room: {
        label: 'Meeting Room',
        color: 'bg-gray-100 text-gray-800',
        icon: '🏢'
      },
      outdoor: {
        label: 'Outdoor',
        color: 'bg-green-100 text-green-800',
        icon: '🌳'
      },
      other: {
        label: 'Other',
        color: 'bg-purple-100 text-purple-800',
        icon: '📍'
      }
    };
    return locations[type as keyof typeof locations] || locations.other;
  }

  getActivityTypeInfo(type: string): { label: string; color: string; icon: string } {
    const activities = {
      coffee: {
        label: 'Coffee',
        color: 'bg-amber-100 text-amber-800',
        icon: '☕'
      },
      lunch: {
        label: 'Lunch',
        color: 'bg-orange-100 text-orange-800',
        icon: '🍽️'
      },
      dinner: {
        label: 'Dinner',
        color: 'bg-red-100 text-red-800',
        icon: '🍴'
      },
      drinks: {
        label: 'Drinks',
        color: 'bg-purple-100 text-purple-800',
        icon: '🍸'
      },
      walk: {
        label: 'Walk',
        color: 'bg-green-100 text-green-800',
        icon: '🚶'
      },
      tour: {
        label: 'Tour',
        color: 'bg-blue-100 text-blue-800',
        icon: '🗺️'
      },
      game: {
        label: 'Game',
        color: 'bg-pink-100 text-pink-800',
        icon: '🎮'
      },
      other: {
        label: 'Other',
        color: 'bg-gray-100 text-gray-800',
        icon: '🎯'
      }
    };
    return activities[type as keyof typeof activities] || activities.other;
  }

  formatTimeRange(start: string, end: string): string {
    return `${start} - ${end}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string, time: { start: string; end: string }): string {
    const date = this.formatDate(dateString);
    const timeRange = this.formatTimeRange(time.start, time.end);
    return `${date} at ${timeRange}`;
  }

  getTimeUntil(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = date.getTime() - now.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} from now`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} from now`;
    } else {
      return 'Today';
    }
  }

  canUserRespond(meetUp: MeetUpRequest, userId: string): boolean {
    return meetUp.targetUserId._id === userId && meetUp.status === 'pending';
  }

  canUserCancel(meetUp: MeetUpRequest, userId: string): boolean {
    return meetUp.requesterId._id === userId && meetUp.canBeCancelled;
  }

  canUserComplete(meetUp: MeetUpRequest, userId: string): boolean {
    return (
      (meetUp.requesterId._id === userId || meetUp.targetUserId._id === userId) &&
      meetUp.status === 'accepted'
    );
  }

  isUserParticipant(meetUp: MeetUpRequest, userId: string): boolean {
    return meetUp.participants.confirmedParticipants.some(p => p.userId === userId);
  }

  getParticipantCount(meetUp: MeetUpRequest): string {
    return `${meetUp.participantCount}/${meetUp.participants.maxParticipants}`;
  }

  getSafetyLevel(meetUp: MeetUpRequest): { level: 'high' | 'medium' | 'low'; color: string; description: string } {
    const { safety } = meetUp;
    if (!safety) return { level: 'medium', color: 'bg-yellow-100 text-yellow-800', description: 'Standard safety' };

    let score = 0;
    if (safety.publicLocation) score += 2;
    if (safety.hotelStaffPresent) score += 2;
    if (safety.verifiedOnly) score += 1;

    if (score >= 4) {
      return { level: 'high', color: 'bg-green-100 text-green-800', description: 'High safety level' };
    } else if (score >= 2) {
      return { level: 'medium', color: 'bg-yellow-100 text-yellow-800', description: 'Medium safety level' };
    } else {
      return { level: 'low', color: 'bg-red-100 text-red-800', description: 'Low safety level' };
    }
  }
}

export const meetUpRequestService = new MeetUpRequestService();
