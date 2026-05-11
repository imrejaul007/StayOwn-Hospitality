import { api } from './api';
import { availabilityService } from './availabilityService';
import { roomTypeService, type RoomType } from './roomTypeService';

// Enhanced booking interfaces with OTA support
export interface EnhancedBooking {
  _id: string;
  hotelId: string;
  userId: string;
  bookingNumber: string;
  rooms: Array<{
    roomId: string;
    rate: number;
    roomType?: RoomType; // Enhanced with room type info
  }>;
  checkIn: string;
  checkOut: string;
  nights: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  totalAmount: number;
  currency: string;
  roomType?: 'single' | 'double' | 'suite' | 'deluxe'; // Legacy
  guestDetails: {
    adults: number;
    children: number;
    specialRequests?: string;
  };
  
  // OTA Integration fields
  channelBookingId?: string;
  channelReservationId?: string;
  channel?: string;
  source: 'direct' | 'booking_com' | 'expedia' | 'airbnb';
  
  // Channel-specific data
  channelData?: {
    confirmationCode?: string;
    channelCommission?: {
      amount: number;
      percentage: number;
      currency: string;
    };
    paymentMethod?: 'credit_card' | 'bank_transfer' | 'virtual_card' | 'pay_at_hotel';
    channelRate?: number;
    channelCurrency?: string;
    exchangeRate?: number;
    marketingSource?: string;
    bookerCountry?: string;
    bookerLanguage?: string;
  };

  // Modification history
  modifications?: Array<{
    modificationId: string;
    modificationType: 'rate_change' | 'date_change' | 'guest_change' | 'cancellation' | 'amendment';
    modificationDate: string;
    modifiedBy: {
      source: string;
      userId: string;
      channel?: string;
    };
    oldValues: unknown;
    newValues: unknown;
    reason: string;
  }>;

  // Sync status
  syncStatus?: {
    lastSyncedAt?: string;
    syncedToChannels: Array<{
      channel: string;
      syncedAt: string;
      syncStatus: 'pending' | 'success' | 'failed';
      errorMessage?: string;
    }>;
    needsSync: boolean;
  };

  createdAt: string;
  updatedAt: string;
}

export interface CreateEnhancedBookingRequest {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guestDetails: {
    adults: number;
    children?: number;
    specialRequests?: string;
  };
  
  // Room selection - supports both legacy and new approaches
  roomTypeId?: string; // New: using room type ID
  roomType?: string;   // Legacy: room type string
  roomRequests?: number; // Number of rooms requested
  
  // OTA fields
  channel?: string;
  channelBookingId?: string;
  channelReservationId?: string;
  source?: 'direct' | 'booking_com' | 'expedia' | 'airbnb';
  
  // Pricing
  totalAmount?: number;
  currency?: string;
  paymentMethod?: string;
  ratePlanId?: string;
  
  // Additional data
  specialRequests?: string;
  channelData?: Record<string, unknown>;
}

export interface BookingFiltersEnhanced {
  hotelId?: string;
  roomTypeId?: string;
  channel?: string;
  source?: string;
  status?: string;
  checkIn?: string;
  checkOut?: string;
  page?: number;
  limit?: number;
}

export interface BookingAnalytics {
  analytics: Array<{
    _id: string | number;
    totalBookings: number;
    totalRevenue: number;
    totalRooms: number;
    averageRate: number;
    channels?: string[];
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
  groupBy: 'roomType' | 'channel' | 'status';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  results?: number;
  pagination?: {
    current: number;
    pages: number;
    total: number;
  };
  message?: string;
}

class EnhancedBookingService {
  /**
   * Create booking using new OTA-ready system
   */
  async createBooking(bookingData: CreateEnhancedBookingRequest): Promise<ApiResponse<{
    booking: EnhancedBooking;
    roomType?: RoomType;
    reservedRooms: unknown[];
  }>> {
    try {
      const response = await api.post('/bookings/enhanced', bookingData);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to create booking');
    }
  }

  /**
   * Get bookings with enhanced filtering including room types and channels
   */
  async getBookings(filters: BookingFiltersEnhanced = {}): Promise<ApiResponse<EnhancedBooking[]>> {
    try {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/bookings/enhanced?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch bookings');
    }
  }

  /**
   * Update booking with OTA sync support
   */
  async updateBooking(bookingId: string, updates: Partial<CreateEnhancedBookingRequest>): Promise<ApiResponse<EnhancedBooking>> {
    try {
      const response = await api.put(`/bookings/enhanced/${bookingId}`, updates);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update booking');
    }
  }

  /**
   * Cancel booking with inventory release
   */
  async cancelBooking(bookingId: string, reason?: string, refundAmount?: number): Promise<ApiResponse<EnhancedBooking>> {
    try {
      const response = await api.post(`/bookings/enhanced/${bookingId}/cancel`, {
        reason,
        refundAmount,
        source: 'manual'
      });
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to cancel booking');
    }
  }

  /**
   * Get booking analytics by room type, channel, or status
   */
  async getBookingAnalytics(params: {
    hotelId: string;
    startDate: string;
    endDate: string;
    groupBy?: 'roomType' | 'channel' | 'status';
  }): Promise<ApiResponse<BookingAnalytics>> {
    try {
      const queryParams = new URLSearchParams({
        hotelId: params.hotelId,
        startDate: params.startDate,
        endDate: params.endDate
      });

      if (params.groupBy) queryParams.append('groupBy', params.groupBy);

      const response = await api.get(`/bookings/enhanced/analytics?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch booking analytics');
    }
  }

  /**
   * Check availability and create booking in one flow
   */
  async checkAvailabilityAndBook(params: {
    hotelId: string;
    checkIn: string;
    checkOut: string;
    roomTypeId?: string;
    roomType?: string;
    guestCount?: number;
    guestDetails: {
      adults: number;
      children?: number;
      specialRequests?: string;
    };
    autoBook?: boolean; // If true, automatically create booking if available
  }): Promise<{
    available: boolean;
    availability?: unknown;
    booking?: EnhancedBooking;
    roomType?: RoomType;
  }> {
    try {
      // First check availability
      const availability = await availabilityService.checkAvailabilitySmart({
        hotelId: params.hotelId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        roomTypeId: params.roomTypeId,
        roomType: params.roomType,
        guestCount: params.guestCount
      });

      if (!availability.available) {
        return {
          available: false,
          availability
        };
      }

      // If autoBook is enabled and rooms are available, create booking
      if (params.autoBook) {
        const bookingData: CreateEnhancedBookingRequest = {
          hotelId: params.hotelId,
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          guestDetails: params.guestDetails,
          roomTypeId: params.roomTypeId,
          roomType: params.roomType,
          roomRequests: params.guestCount || 1
        };

        const bookingResult = await this.createBooking(bookingData);
        
        return {
          available: true,
          availability,
          booking: bookingResult.data.booking,
          roomType: bookingResult.data.roomType
        };
      }

      return {
        available: true,
        availability
      };

    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to check availability and book');
    }
  }

  /**
   * Get available room types for booking
   */
  async getAvailableRoomTypes(params: {
    hotelId: string;
    checkIn: string;
    checkOut: string;
  }): Promise<Array<{
    roomType: RoomType;
    availability: unknown;
    bestRate?: unknown;
  }>> {
    try {
      // Get all active room types for the hotel
      const roomTypes = await roomTypeService.getActiveRoomTypesForBooking(params.hotelId);

      // Check availability for each room type
      const availableRoomTypes = [];

      for (const roomType of roomTypes) {
        try {
          const availability = await availabilityService.checkAvailabilityV2({
            hotelId: params.hotelId,
            roomTypeId: roomType.id,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
            roomsRequested: 1
          });

          if (availability.available) {
            availableRoomTypes.push({
              roomType: await roomTypeService.getRoomType(roomType.id),
              availability
            });
          }
        } catch {
          // Error handled silently
        }
      }

      return availableRoomTypes;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch available room types');
    }
  }

  /**
   * Get booking history with modifications
   */
  async getBookingHistory(bookingId: string): Promise<ApiResponse<{
    booking: EnhancedBooking;
    modifications: unknown[];
    auditTrail: unknown[];
  }>> {
    try {
      const response = await api.get(`/bookings/enhanced/${bookingId}/history`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch booking history');
    }
  }

  /**
   * Sync booking with OTA channels
   */
  async syncBookingWithChannels(bookingId: string, channels?: string[]): Promise<ApiResponse<{
    syncResults: Array<{
      channel: string;
      status: 'success' | 'failed';
      message?: string;
    }>;
  }>> {
    try {
      const response = await api.post(`/bookings/enhanced/${bookingId}/sync`, {
        channels
      });
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to sync booking with channels');
    }
  }

  /**
   * Get channel bookings (bookings from OTAs)
   */
  async getChannelBookings(params: {
    hotelId: string;
    channel?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    needsReconciliation?: boolean;
  }): Promise<ApiResponse<EnhancedBooking[]>> {
    try {
      const queryParams = new URLSearchParams({
        hotelId: params.hotelId
      });

      Object.entries(params).forEach(([key, value]) => {
        if (key !== 'hotelId' && value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.get(`/bookings/enhanced/channels?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch channel bookings');
    }
  }

  /**
   * Handle booking modification from channel
   */
  async handleChannelModification(params: {
    channelBookingId: string;
    channel: string;
    modificationType: 'rate_change' | 'date_change' | 'guest_change' | 'cancellation';
    newValues: unknown;
    reason?: string;
  }): Promise<ApiResponse<EnhancedBooking>> {
    try {
      const response = await api.post('/bookings/enhanced/channel-modification', params);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to handle channel modification');
    }
  }

  /**
   * Get booking dashboard data with OTA metrics
   */
  async getBookingDashboard(params: {
    hotelId: string;
    period?: string; // '7d', '30d', '90d', '1y'
  }): Promise<ApiResponse<{
    totalBookings: number;
    totalRevenue: number;
    averageRate: number;
    occupancyRate: number;
    channelBreakdown: Record<string, {
      bookings: number;
      revenue: number;
      percentage: number;
    }>;
    roomTypeBreakdown: Record<string, {
      bookings: number;
      revenue: number;
      percentage: number;
    }>;
    recentBookings: EnhancedBooking[];
    pendingModifications: number;
    syncIssues: number;
  }>> {
    try {
      const queryParams = new URLSearchParams({
        hotelId: params.hotelId
      });

      if (params.period) queryParams.append('period', params.period);

      const response = await api.get(`/bookings/enhanced/dashboard?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch booking dashboard');
    }
  }

  /**
   * Legacy method compatibility - create booking using old interface
   */
  async createBookingLegacy(bookingData: {
    roomIds: string[];
    checkIn: string;
    checkOut: string;
    guestDetails: Record<string, unknown>;
    totalAmount: number;
  }): Promise<unknown> {
    try {
      const response = await api.post('/bookings', bookingData);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to create booking');
    }
  }
}

export const enhancedBookingService = new EnhancedBookingService();
export default enhancedBookingService;