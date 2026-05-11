import { api } from './api';

export interface ExtraPersonCharge {
  _id?: string;
  totalCharge: number;
  paidAmount?: number;
  isPaid?: boolean;
  status?: string;
}

export interface SettlementTracking {
  status?: string;
  outstandingBalance: number;
  finalAmount?: number;
}

export interface StaffUpcomingBooking {
  _id: string;
  bookingNumber: string;
  userId: {
    name: string;
    email: string;
    phone?: string;
  };
  checkIn: string;
  checkOut: string;
  nights: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  totalAmount: number;
  currency: string;
  rooms?: Array<{
    roomId: {
      _id: string;
      roomNumber: string;
      type: string;
      baseRate: number;
      currentRate: number;
    };
    rate: number;
  }>;
  guestDetails?: {
    adults: number;
    children: number;
    specialRequests?: string;
  };
  hotelId: {
    name: string;
    address?: string;
  };
  /** Extra persons added to the booking (e.g. walk-in additions after initial booking) */
  extraPersons?: Array<{
    _id?: string;
    name?: string;
    isActive: boolean;
  }>;
  /** Per-night charges for extra persons */
  extraPersonCharges?: ExtraPersonCharge[];
  /** Settlement tracking for outstanding balances after checkout */
  settlementTracking?: SettlementTracking;
  createdAt: string;
  updatedAt: string;
}

export interface StaffUpcomingStats {
  todayArrivals: number;
  tomorrowArrivals: number;
  totalUpcoming: number;
}

interface ApiResponse<T> {
  status: string;
  data: T;
  results?: number;
  pagination?: {
    /** Backend returns `page` (not `current`) — matches /bookings/upcoming response shape */
    page: number;
    pages: number;
    total: number;
    limit: number;
  };
  stats?: StaffUpcomingStats;
}

class StaffBookingService {
  async getUpcomingBookings(filters: { days?: number; page?: number; limit?: number } = {}): Promise<ApiResponse<StaffUpcomingBooking[]>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/bookings/upcoming?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookingById(id: string): Promise<ApiResponse<{ booking: StaffUpcomingBooking }>> {
    try {
      const response = await api.get(`/bookings/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const staffBookingService = new StaffBookingService();