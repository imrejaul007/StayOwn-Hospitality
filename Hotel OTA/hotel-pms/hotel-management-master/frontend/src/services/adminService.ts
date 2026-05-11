import { api, normalizeListParams } from './api';
import { HousekeepingTask, InventoryItem, RevenueData, OccupancyData, AdminBooking, BookingFilters, BookingStats } from '../types/admin';

interface ApiResponse<T> {
  status: string;
  data: T;
  results?: number;
  pagination?: {
    current: number;
    page?: number;
    pages: number;
    total: number;
  };
}

class AdminService {
  private pendingDelays: Set<ReturnType<typeof setTimeout>> = new Set();

  private delay(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this.pendingDelays.delete(timer);
        resolve();
      }, ms);
      this.pendingDelays.add(timer);
    });
  }

  destroy(): void {
    this.pendingDelays.forEach(timer => clearTimeout(timer));
    this.pendingDelays.clear();
  }

  // Housekeeping
  async getHousekeepingTasks(filters: Record<string, unknown> = {}): Promise<ApiResponse<{ tasks: HousekeepingTask[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters as { page?: number; limit?: number });
      const params = new URLSearchParams();
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/housekeeping?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createHousekeepingTask(taskData: Partial<HousekeepingTask>): Promise<ApiResponse<{ task: HousekeepingTask }>> {
    try {
      const response = await api.post('/housekeeping', taskData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateHousekeepingTask(id: string, updates: Partial<HousekeepingTask>): Promise<ApiResponse<{ task: HousekeepingTask }>> {
    try {
      const response = await api.patch(`/housekeeping/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getHousekeepingStats(hotelId?: string): Promise<ApiResponse<{ stats: unknown[] }>> {
    try {
      const params = new URLSearchParams();
      if (hotelId) {
        params.append('hotelId', hotelId);
      }
      const queryString = params.toString();
      const url = queryString ? `/housekeeping/stats?${queryString}` : '/housekeeping/stats';
      const response = await api.get(url);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Inventory
  async getInventoryItems(filters: Record<string, unknown> = {}): Promise<ApiResponse<{ items: InventoryItem[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters as { page?: number; limit?: number });
      const params = new URLSearchParams();
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/inventory?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getInventoryStats(hotelId?: string): Promise<ApiResponse<{ stats: { total: number; lowStock: number; outOfStock: number; totalValue: number; categories: Record<string, number> } }>> {
    try {
      const params = new URLSearchParams();
      if (hotelId) {
        params.append('hotelId', hotelId);
      }
      const queryString = params.toString();
      const url = queryString ? `/inventory/stats?${queryString}` : '/inventory/stats';
      const response = await api.get(url);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createInventoryItem(itemData: Partial<InventoryItem>): Promise<ApiResponse<{ item: InventoryItem }>> {
    try {
      const response = await api.post('/inventory', itemData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<ApiResponse<{ item: InventoryItem }>> {
    try {
      const response = await api.patch(`/inventory/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async restockInventoryItem(id: string, payload: { quantity: number; costPerUnit?: number }): Promise<ApiResponse<{ item: InventoryItem }>> {
    try {
      const response = await api.post(`/inventory/${id}/restock`, payload);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async deleteInventoryItem(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await api.delete(`/inventory/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createSupplyRequest(itemId: string, quantity: number, reason?: string): Promise<unknown> {
    try {
      const response = await api.post('/inventory/request', { itemId, quantity, reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async processSupplyRequest(itemId: string, requestId: string, status: string): Promise<unknown> {
    try {
      const response = await api.patch(`/inventory/request/${itemId}/${requestId}`, { status });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Reports
  async getRevenueReport(filters: {
    startDate: string;
    endDate: string;
    groupBy?: string;
    hotelId?: string;
  }): Promise<ApiResponse<{ summary: unknown; breakdown: RevenueData[]; period: unknown }>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/reports/revenue?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOccupancyReport(filters: {
    startDate: string;
    endDate: string;
    hotelId?: string;
  }): Promise<ApiResponse<{ summary: OccupancyData; occupancyByType: unknown; period: unknown }>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/reports/occupancy?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookingsReport(filters: Record<string, unknown> = {}): Promise<unknown> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/reports/bookings?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // OTA Integration
  async syncBookingCom(hotelId: string): Promise<unknown> {
    try {
      const response = await api.post('/ota/bookingcom/sync', { hotelId });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOTASyncStatus(hotelId: string): Promise<unknown> {
    try {
      const response = await api.get(`/ota/bookingcom/status/${hotelId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOTASyncHistory(filters: Record<string, unknown> = {}): Promise<unknown> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/ota/sync-history?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOTAConfig(hotelId: string): Promise<unknown> {
    try {
      const response = await api.get(`/ota/config/${hotelId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateOTAConfig(hotelId: string, provider: string, config: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await api.patch(`/ota/config/${hotelId}`, { provider, config });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOTAStats(hotelId: string): Promise<unknown> {
    try {
      const response = await api.get(`/ota/stats/${hotelId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async setupOTADemo(hotelId: string): Promise<unknown> {
    try {
      const response = await api.post(`/ota/setup/${hotelId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Booking Management
  async getBookings(filters: BookingFilters = {}): Promise<ApiResponse<{ bookings: AdminBooking[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      try {
        // Try admin endpoint first, fallback to regular endpoint if it fails
        try {
          const response = await api.get(`/admin/bookings?${params.toString()}`);
          return response.data;
        } catch (adminError: unknown) {
          const adminAxiosErr = adminError as { response?: { status?: number }; message?: string };

          // Fallback to regular endpoint
          const response = await api.get(`/bookings?${params.toString()}`);
          return response.data;
        }
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
        if (axiosErr.response?.status === 429) {
          // Wait a bit and retry once for rate limit errors
          await this.delay(2000);
          const retryResponse = await api.get(`/bookings?${params.toString()}`);
          return retryResponse.data;
        }
        throw error;
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Bookings for frontdesk - skips admin endpoint to avoid 403 errors
  async getFrontDeskBookings(filters: BookingFilters = {}): Promise<ApiResponse<{ bookings: AdminBooking[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      try {
        // Use regular bookings endpoint directly for frontdesk
        const response = await api.get(`/bookings?${params.toString()}`);
        return response.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
        if (axiosErr.response?.status === 429) {
          // Wait a bit and retry once for rate limit errors
          await this.delay(2000);
          const retryResponse = await api.get(`/bookings?${params.toString()}`);
          return retryResponse.data;
        }
        throw error;
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getUpcomingBookings(filters: { days?: number; page?: number; limit?: number; hotelId?: string } = {}): Promise<ApiResponse<AdminBooking[]> & { stats: { todayArrivals: number; tomorrowArrivals: number; totalUpcoming: number } }> {
    try {
      const normalizedFilters = normalizeListParams(filters);
      const params = new URLSearchParams();
      Object.entries(normalizedFilters).forEach(([key, value]) => {
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

  async getBookingById(id: string): Promise<ApiResponse<{ booking: AdminBooking }>> {
    try {
      const response = await api.get(`/bookings/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateBooking(id: string, updates: Partial<AdminBooking>): Promise<ApiResponse<{ booking: AdminBooking }>> {
    try {
      const response = await api.patch(`/bookings/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async cancelBooking(id: string, reason?: string): Promise<ApiResponse<{ booking: AdminBooking }>> {
    try {
      const response = await api.patch(`/bookings/${id}/cancel`, { reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async checkInBooking(id: string, paymentDetails?: {
    paymentMethods: Array<{
      method: 'cash' | 'card' | 'upi' | 'online_portal' | 'corporate';
      amount: number;
      reference?: string;
      notes?: string;
    }>;
  }): Promise<ApiResponse<{ booking: AdminBooking; digitalKey?: { keyCode: string; keyId: string } | null; balanceInfo?: { totalAmount: number; totalPaid: number; balanceRemaining: number; paymentCollected: boolean } }>> {
    try {
      const response = await api.patch(`/bookings/${id}/check-in`, { paymentDetails });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async checkOutBooking(id: string): Promise<ApiResponse<{ booking: AdminBooking }>> {
    try {
      const response = await api.patch(`/bookings/${id}/check-out`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createBooking(bookingData: {
    hotelId: string;
    userId: string;
    roomIds: string[];
    checkIn: string;
    checkOut: string;
    guestDetails: {
      adults: number;
      children: number;
      specialRequests?: string;
      name?: string;
      email?: string;
      phone?: string;
    };
    totalAmount: number;
    currency?: string;
    paymentStatus?: 'pending' | 'paid' | 'partially_paid';
    status?: 'pending' | 'confirmed' | 'checked_in';
    roomType?: 'single' | 'double' | 'suite' | 'deluxe';
    // Payment information for walk-in bookings (legacy singular fields)
    paymentMethod?: 'cash' | 'card' | 'upi' | 'bank_transfer';
    advanceAmount?: number;
    paymentReference?: string;
    paymentNotes?: string;
    // Payment information for walk-in bookings (new array-based fields)
    paymentMethods?: Array<{ method: string; amount: number; reference?: string; notes?: string }>;
    paidAmount?: number;
    remainingAmount?: number;
    // Additional walk-in fields
    source?: string;
    checkInTime?: string;
    idempotencyKey?: string;
    [key: string]: unknown;
  }): Promise<ApiResponse<{ booking: AdminBooking }>> {
    try {
      const payload = {
        ...bookingData,
        idempotencyKey: `admin-${crypto.randomUUID()}`,
        currency: bookingData.currency || 'INR',
        paymentStatus: bookingData.paymentStatus || 'pending',
        status: bookingData.status || 'pending'
      };

      const response = await api.post('/bookings', payload);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async assignRoomsToBooking(bookingId: string, assignmentData: {
    roomAssignments: { roomType: string; roomNumber: string; }[];
  }): Promise<ApiResponse<{ booking: AdminBooking }>> {
    try {
      const response = await api.patch(`/bookings/${bookingId}/assign-rooms`, assignmentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getAvailableRooms(hotelId: string, checkIn?: string, checkOut?: string): Promise<ApiResponse<{ rooms: unknown[] }>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      params.append('limit', '100'); // Get up to 100 rooms instead of default 10
      if (checkIn) params.append('checkIn', checkIn);
      if (checkOut) params.append('checkOut', checkOut);
    
      const url = `/rooms?${params.toString()}`;
    
      try {
        const response = await api.get(url, {
          headers: {
            'x-admin-request': 'true'
          }
        });
        return response.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      
        if (axiosErr.response?.status === 429) {
          // Wait a bit and retry once for rate limit errors
          await this.delay(2000);
          const retryResponse = await api.get(url, {
            headers: {
              'x-admin-request': 'true'
            }
          });
          return retryResponse.data;
        }
        throw error;
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getUsers(filters: { search?: string; role?: string; hotelId?: string } = {}): Promise<ApiResponse<{ users: unknown[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters as { page?: number; limit?: number });
      const params = new URLSearchParams();
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      // Use /users endpoint instead of /admin/users to support frontdesk and staff roles
      const response = await api.get(`/users?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookingStats(filters: { startDate?: string; endDate?: string; hotelId?: string } = {}): Promise<ApiResponse<{ stats: BookingStats }>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/reports/bookings/stats?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Hotel Management
  async getHotels(filters: Record<string, unknown> = {}): Promise<ApiResponse<{ hotels: unknown[] }>> {
    try {
      const normalizedFilters = normalizeListParams(filters as { page?: number; limit?: number });
      const params = new URLSearchParams();
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/admin/hotels?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // User Management
  async createUser(userData: {
    name: string;
    email: string;
    phone: string;
    role: string;
    password: string;
    preferences?: Record<string, unknown>;
  }): Promise<ApiResponse<{ user: unknown }>> {
    try {
      const response = await api.post('/admin/users', userData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateUser(id: string, updates: Record<string, unknown>): Promise<ApiResponse<{ user: unknown }>> {
    try {
      const response = await api.patch(`/admin/users/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async deleteUser(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await api.delete(`/admin/users/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const adminService = new AdminService();