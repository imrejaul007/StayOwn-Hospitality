import { api, normalizeListParams } from './api';
import { toEntityIdString } from '../utils/entityId';
import { Room, Booking, BookingFilters, CreateBookingRequest } from '../types/booking';

interface ApiResponse<T> {
  status: string;
  data: T;
  results?: number;
  pagination?: {
    page: number;
    current?: number;
    limit: number;
    pages: number;
    total: number;
  };
}

class BookingService {
  async getRooms(filters: BookingFilters & { page?: number; limit?: number } = {}): Promise<ApiResponse<{ rooms: Room[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
    
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/rooms?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getRoomById(id: string): Promise<ApiResponse<{ room: Room }>> {
    try {
      const response = await api.get(`/rooms/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createBooking(bookingData: CreateBookingRequest): Promise<ApiResponse<{ booking: Booking }>> {
    try {
      // Generate a strong idempotency key with booking details
      const generateIdempotencyKey = (): string => {
        const timestamp = Date.now();
        const randomUUID = crypto.randomUUID();
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user._id || user.id || 'anonymous';
      
        // Create a hash from key booking details to make each booking attempt unique
        const bookingDetails = `${bookingData.checkIn}-${bookingData.checkOut}-${bookingData.roomType || 'default'}-${bookingData.roomIds?.join(',') || 'none'}`;
        const detailsHash = btoa(bookingDetails).substring(0, 8); // Simple base64 hash, first 8 chars
      
        return `booking-${userId}-${timestamp}-${detailsHash}-${randomUUID}`;
      };

      // Get the current hotel ID from the bookings route (accessible to all authenticated users)
      let hotelId = bookingData.hotelId;
      if (!hotelId) {
        try {
          const hotelResponse = await api.get('/bookings/current-hotel');
          hotelId = hotelResponse.data.data.hotelId;
        } catch (error) {
          hotelId = null;
        }
      }
    
      // Enforce explicit property context to avoid cross-property leakage.
      if (!hotelId) {
        throw new Error('No property selected for booking');
      }
    

      // Ensure we have the required fields for the backend API
      const enhancedBookingData = {
        ...bookingData,
        // Add required fields if missing
        hotelId: hotelId,
        idempotencyKey: bookingData.idempotencyKey || generateIdempotencyKey(),
        // Ensure roomIds is an array if roomId is provided as a string
        roomIds: bookingData.roomIds || (bookingData.roomId ? [bookingData.roomId] : undefined),
        // Set default currency if not provided
        currency: bookingData.currency || 'INR',
        // Ensure guestDetails has required fields
        guestDetails: {
          adults: 1,
          children: 0,
          ...bookingData.guestDetails
        }
      };

    
      const response = await api.post('/bookings', enhancedBookingData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookings(filters: { status?: string; page?: number; limit?: number; startDate?: string; endDate?: string; hotelId?: string } = {}): Promise<ApiResponse<{ bookings: Booking[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
    
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/bookings?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookingById(id: string): Promise<ApiResponse<{ booking: Booking }>> {
    try {
      const safeId = toEntityIdString(id);
      if (!safeId) {
        throw new Error('Invalid booking id');
      }
      const response = await api.get(`/bookings/${safeId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateBooking(id: string, updates: Partial<Booking>): Promise<ApiResponse<{ booking: Booking }>> {
    try {
      const response = await api.patch(`/bookings/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async cancelBooking(id: string, reason?: string): Promise<ApiResponse<{ booking: Booking }>> {
    try {
      const response = await api.patch(`/bookings/${id}/cancel`, { reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get user's bookings (for guests)
  async getUserBookings(filters: { status?: string; page?: number; limit?: number } = {}): Promise<ApiResponse<{ bookings: Booking[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
    
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/bookings?${params.toString()}`);
      const payload = response.data || {};
      const bookings = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.data?.bookings)
          ? payload.data.bookings
          : [];

      return {
        ...payload,
        data: { bookings },
        pagination: payload.pagination
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Check room availability
  async checkAvailability(roomIds: string[], checkIn: string, checkOut: string): Promise<ApiResponse<{ available: boolean; conflicting?: Booking[] }>> {
    try {
      const response = await api.post('/bookings/check-availability', {
        roomIds,
        checkIn,
        checkOut
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get booking analytics (for dashboard)
  async getBookingStats(period: string = '30d'): Promise<ApiResponse<{
    totalBookings: number;
    totalRevenue: number;
    occupancyRate: number;
    averageStay: number;
    statusBreakdown: Record<string, number>;
  }>> {
    try {
      const response = await api.get(`/reports/bookings/stats?period=${period}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get bookings for a specific room
  async getRoomBookings(roomId: string, filters: {
    status?: string;
    timeFilter?: 'past' | 'future' | 'current' | 'all';
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<{
    bookings: Booking[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
    
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/bookings/room/${roomId}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Booking modification requests
  async createModificationRequest(
    bookingId: string,
    modificationType: 'date_change' | 'room_upgrade' | 'guest_count' | 'early_checkin' | 'late_checkout' | 'cancellation',
    requestedChanges: Record<string, unknown>,
    reason: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.post(`/bookings/${bookingId}/modification-request`, {
        modificationType,
        requestedChanges,
        reason,
        priority
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getModificationRequests(bookingId: string): Promise<ApiResponse<{ modifications: unknown[] }>> {
    try {
      const response = await api.get(`/bookings/${bookingId}/modification-requests`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Admin only - review modification requests
  async reviewModificationRequest(
    bookingId: string,
    requestId: string,
    action: 'approve' | 'reject',
    reviewNotes?: string,
    approvedChanges?: Record<string, unknown>
  ): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.patch(`/bookings/${bookingId}/modification-requests/${requestId}/review`, {
        action,
        reviewNotes,
        approvedChanges
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Booking Conversation methods
  async createConversation(
    bookingId: string,
    subject: string,
    initialMessage: string,
    category: string = 'general_inquiry',
    priority: string = 'normal',
    attachments: unknown[] = []
  ): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.post('/booking-conversations', {
        bookingId,
        subject,
        initialMessage,
        category,
        priority,
        attachments
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getConversations(filters: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    priority?: string;
    bookingId?: string;
  } = {}): Promise<ApiResponse<unknown>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();

      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/booking-conversations?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getConversation(conversationId: string): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.get(`/booking-conversations/${conversationId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async addMessageToConversation(
    conversationId: string,
    content: string,
    messageType: string = 'text',
    attachments: unknown[] = [],
    relatedData: Record<string, unknown> = {}
  ): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.post(`/booking-conversations/${conversationId}/messages`, {
        content,
        messageType,
        attachments,
        relatedData
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async markConversationAsRead(
    conversationId: string,
    messageIds?: string[]
  ): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.patch(`/booking-conversations/${conversationId}/read`, {
        messageIds
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async assignConversation(
    conversationId: string,
    staffUserId: string
  ): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.patch(`/booking-conversations/${conversationId}/assign`, {
        staffUserId
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateConversationStatus(
    conversationId: string,
    status: 'active' | 'resolved' | 'closed' | 'escalated',
    reason?: string
  ): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.patch(`/booking-conversations/${conversationId}/status`, {
        status,
        reason
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getConversationStats(hotelId?: string, startDate?: string, endDate?: string): Promise<ApiResponse<unknown>> {
    try {
      const params = new URLSearchParams();
      if (hotelId) params.append('hotelId', hotelId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/booking-conversations/stats?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const bookingService = new BookingService();