import { ApiResponse } from '../types/api';
import { api } from './api';

export interface StaffTodayData {
  checkIns: number;
  checkOuts: number;
  pendingHousekeeping: number;
  pendingMaintenance: number;
  pendingGuestServices: number;
  pendingOrders: number;
  occupancyRate: number;
}

export interface RoomStatusData {
  summary: {
    occupied: number;
    vacant_clean: number;
    vacant_dirty: number;
    maintenance: number;
    out_of_order: number;
  };
  needsAttention: Array<{
    _id: string;
    roomNumber: string;
    type: string;
    status: string;
  }>;
  total: number;
}

export interface StaffInventoryData {
  lowStockAlert: {
    count: number;
    items: Array<{
      _id: string;
      name: string;
      currentStock: number;
      threshold: number;
      category: string;
    }>;
  };
  inspectionsDue: {
    count: number;
    rooms: Array<{
      _id: string;
      roomNumber: string;
      daysPastDue: number;
    }>;
  };
}

export interface StaffActivityData {
  checkIns: Array<{
    _id: string;
    bookingNumber: string;
    checkIn: string;
    userId: { name: string };
    rooms: Array<{ roomId: { roomNumber: string } }>;
  }>;
  checkOuts: Array<{
    _id: string;
    bookingNumber?: string;
    checkOut?: string;
    createdAt?: string;
    status?: string;
    userId?: { name: string };
    checkedBy?: { name: string };
    roomId?: { roomNumber: string };
    rooms?: Array<{ roomId?: { roomNumber?: string } }>;
    bookingId?: {
      bookingNumber?: string;
      userId?: { name?: string };
      rooms?: Array<{ roomId?: { roomNumber?: string } }>;
    };
  }>;
  guestServices: Array<{
    _id: string;
    serviceType: string;
    title: string;
    priority: string;
    status: string;
    createdAt: string;
    userId: { name: string };
    bookingId: {
      rooms: Array<{
        roomId: { roomNumber: string };
      }>;
    };
  }>;
}

class StaffDashboardService {
  private baseURL = '/staff-dashboard';

  async getTodayOverview(): Promise<ApiResponse<{ today: StaffTodayData; lastUpdated: string }>> {
    try {
      // Add timestamp to prevent caching issues
      const timestamp = new Date().getTime();
      const response = await api.get(`${this.baseURL}/today?t=${timestamp}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getRoomStatus(): Promise<ApiResponse<RoomStatusData>> {
    try {
      const response = await api.get(`${this.baseURL}/rooms/status`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getInventorySummary(): Promise<ApiResponse<StaffInventoryData>> {
    try {
      const response = await api.get(`${this.baseURL}/inventory/summary`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getRecentActivity(): Promise<ApiResponse<StaffActivityData>> {
    try {
      const response = await api.get(`${this.baseURL}/activity`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Room status update — uses the staff-accessible PATCH /staff-dashboard/rooms/:id/status endpoint.
  // This does NOT require the admin-level 'rooms.createUpdateAccess' RBAC policy,
  // so housekeeping staff can mark rooms clean without needing elevated permissions.
  async updateRoomStatus(roomId: string, status: string): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.patch(`${this.baseURL}/rooms/${roomId}/status`, { status });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Mark room as inspected
  async markRoomInspected(roomId: string): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.patch(`${this.baseURL}/rooms/${roomId}/inspect`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Order inventory item
  async orderInventoryItem(itemId: string, quantity: number = 50): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.post(`${this.baseURL}/inventory/${itemId}/order`, { quantity });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const staffDashboardService = new StaffDashboardService();