import { api } from './api';

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  totalAmount?: number;
  currency?: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  type: string;
  rate?: number;
}

export interface Hotel {
  id: string;
  name: string;
}

export interface GuestByRoomResponse {
  status: string;
  data: {
    guest: Guest;
    booking: Booking;
    room: Room;
  };
}

export interface GuestByBookingResponse {
  status: string;
  data: {
    guest: Guest;
    booking: Booking;
    rooms: Room[];
    hotel: Hotel;
  };
}

export interface GuestSearchResponse {
  status: string;
  results: number;
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
  data: Guest[];
}

export interface GuestBookingsResponse {
  status: string;
  results: number;
  data: Booking[];
}

export interface GuestBillingHistoryResponse {
  status: string;
  results: number;
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
  data: unknown[]; // BillingSession type
}

class GuestLookupService {
  private baseUrl = '/guest-lookup';

  // Get guest by room number
  async getGuestByRoom(roomNumber: string, hotelId: string): Promise<GuestByRoomResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/room/${roomNumber}?hotelId=${hotelId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get guest by booking ID
  async getGuestByBooking(bookingId: string): Promise<GuestByBookingResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/booking/${bookingId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Search guests by name or email
  async searchGuests(
    query: string,
    hotelId: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ): Promise<GuestSearchResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('query', query);
      queryParams.append('hotelId', hotelId);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const url = `${this.baseUrl}/search?${queryParams.toString()}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get guest's active bookings
  async getGuestActiveBookings(guestId: string, hotelId: string): Promise<GuestBookingsResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/${guestId}/bookings?hotelId=${hotelId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get guest's billing history
  async getGuestBillingHistory(
    guestId: string,
    hotelId: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ): Promise<GuestBillingHistoryResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('hotelId', hotelId);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const url = `${this.baseUrl}/${guestId}/billing-history?${queryParams.toString()}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const guestLookupService = new GuestLookupService();
export default guestLookupService;
