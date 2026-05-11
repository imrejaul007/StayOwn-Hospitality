import { api } from './api';

export interface RoomTypeAllotment {
  _id: string;
  hotelId: string;
  roomTypeId: {
    _id: string;
    name: string;
    code: string;
  };
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'suspended';
  channels: Array<{
    channelId: string;
    channelName: string;
    isActive: boolean;
    priority: number;
    commission: number;
    markup: number;
    restrictions: {
      minimumStay: number;
      maximumStay: number;
      closedToArrival: boolean;
      closedToDeparture: boolean;
      stopSell: boolean;
    };
  }>;
  defaultSettings: {
    totalInventory: number;
    defaultAllocationMethod: 'percentage' | 'fixed' | 'dynamic';
    overbookingAllowed: boolean;
    overbookingLimit: number;
    releaseWindow: number;
    autoRelease: boolean;
  };
  dailyAllotments: Array<{
    date: string;
    totalInventory: number;
    channelAllotments: Array<{
      channelId: string;
      allocated: number;
      sold: number;
      available: number;
      blocked: number;
      overbooking: number;
      rate: number;
      lastUpdated: string;
    }>;
    freeStock: number;
    totalSold: number;
    occupancyRate: number;
    notes?: string;
    isHoliday: boolean;
    isBlackout: boolean;
  }>;
  performanceMetrics?: Array<{
    period: {
      startDate: string;
      endDate: string;
    };
    channelMetrics: Array<{
      channelId: string;
      totalAllocated: number;
      totalSold: number;
      totalRevenue: number;
      averageRate: number;
      conversionRate: number;
      utilizationRate: number;
      leadTime: number;
      cancellationRate: number;
      noShowRate: number;
      revenuePerAvailableRoom: number;
    }>;
    overallMetrics: {
      totalInventory: number;
      totalSold: number;
      totalRevenue: number;
      averageOccupancyRate: number;
      revenuePerAvailableRoom: number;
      averageDailyRate: number;
    };
  }>;
  analytics?: {
    lastCalculated: string;
    nextCalculation: string;
    calculationFrequency: 'hourly' | 'daily' | 'weekly';
    alerts: Array<{
      type: 'low_occupancy' | 'high_occupancy' | 'channel_underperforming' | 'inventory_imbalance' | 'overbooking_risk';
      threshold: number;
      isActive: boolean;
      frequency: 'immediate' | 'daily' | 'weekly';
    }>;
    recommendations: Array<{
      type: 'increase_allocation' | 'decrease_allocation' | 'adjust_rates' | 'modify_restrictions' | 'update_rules';
      channelId: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      impact: string;
      confidence: number;
      createdAt: string;
    }>;
  };
  overallOccupancyRate?: number;
  createdBy: string;
  updatedBy?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AllotmentFilter {
  page?: number;
  limit?: number;
  status?: 'all' | 'active' | 'inactive' | 'suspended';
  roomTypeId?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateAllotmentData {
  name: string;
  description?: string;
  roomTypeId: string;
  hotelId: string;
  channels?: Array<{
    channelId: string;
    channelName: string;
    isActive: boolean;
    priority: number;
    commission: number;
    markup: number;
    restrictions?: {
      minimumStay: number;
      maximumStay: number;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
      stopSell?: boolean;
    };
  }>;
  defaultSettings: {
    totalInventory: number;
    defaultAllocationMethod?: 'percentage' | 'fixed' | 'dynamic';
    overbookingAllowed?: boolean;
    overbookingLimit?: number;
    releaseWindow?: number;
    autoRelease?: boolean;
  };
}

export interface UpdateAllotmentData extends Partial<CreateAllotmentData> {
  id: string;
}

export interface DashboardData {
  totalAllotments: number;
  totalRoomTypes: number;
  totalChannels: number;
  averageOccupancyRate: number;
  totalRevenue: number;
  topPerformingChannel?: {
    channelId: string;
    channelName: string;
    totalRevenue: number;
    totalSold: number;
    utilizationRate: number;
  };
  lowUtilizationChannels: Array<{
    channelId: string;
    channelName: string;
    utilizationRate: number;
    totalAllocated: number;
  }>;
  recentRecommendations: Array<{
    type: string;
    channelId: string;
    priority: string;
    impact: string;
    confidence: number;
    createdAt: string;
  }>;
}

export interface AllotmentCalendarData {
  date: string;
  roomTypeId: string;
  roomTypeName: string;
  totalRooms: number;
  availableRooms: number;
  occupancyRate: number;
  status: 'available' | 'blocked' | 'sold_out';
}

export interface ChannelAllocation {
  channelId: string;
  date: string;
  allocated?: number;
  sold?: number;
  blocked?: number;
}

export interface BookingData {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  channelId: string;
  rooms?: number;
}

export interface ReleaseData extends BookingData {
  rooms: number;
}

class AllotmentService {
  async getAllotments(params: AllotmentFilter = {}): Promise<{
    allotments: RoomTypeAllotment[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }> {
    try {
      const response = await api.get('/allotments', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getAllotment(id: string): Promise<RoomTypeAllotment> {
    try {
      const response = await api.get(`/allotments/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async createAllotment(data: CreateAllotmentData): Promise<RoomTypeAllotment> {
    try {
      const response = await api.post('/allotments', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateAllotment(id: string, data: UpdateAllotmentData): Promise<RoomTypeAllotment> {
    try {
      const response = await api.put(`/allotments/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteAllotment(id: string): Promise<void> {
    try {
      await api.delete(`/allotments/${id}`);
    } catch (error) {
      throw error;
    }
  }

  async getDashboard(params?: { startDate?: string; endDate?: string; roomTypeId?: string }): Promise<DashboardData> {
    try {
      const response = await api.get('/allotments/dashboard', { params });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async bulkUpdateAllotments(updates: Array<{
    id: string;
    data: UpdateAllotmentData;
  }>): Promise<RoomTypeAllotment[]> {
    try {
      const response = await api.put('/allotments/bulk-update', { updates });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getCalendarData(params: {
    roomTypeId?: string;
    startDate: string;
    endDate: string;
  }): Promise<AllotmentCalendarData[]> {
    try {
      const response = await api.get('/allotments/calendar', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateChannelAllocation(allotmentId: string, data: ChannelAllocation): Promise<void> {
    try {
      await api.post(`/allotments/${allotmentId}/update-allocation`, data);
    } catch (error) {
      throw error;
    }
  }

  async applyAllocationRule(allotmentId: string, ruleId: string, dateRange: {
    startDate: string;
    endDate: string;
  }): Promise<void> {
    try {
      await api.post(`/allotments/${allotmentId}/apply-rule`, {
        ruleId,
        ...dateRange
      });
    } catch (error) {
      throw error;
    }
  }

  async optimizeAllocations(allotmentId: string): Promise<unknown> {
    try {
      const response = await api.post(`/allotments/${allotmentId}/optimize`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async processBooking(data: BookingData): Promise<void> {
    try {
      await api.post('/allotments/bookings/process', data);
    } catch (error) {
      throw error;
    }
  }

  async releaseRooms(data: ReleaseData): Promise<void> {
    try {
      await api.post('/allotments/bookings/release', data);
    } catch (error) {
      throw error;
    }
  }

  async getAvailability(params: {
    roomTypeId: string;
    startDate: string;
    endDate: string;
    channelId?: string;
  }): Promise<unknown> {
    try {
      const response = await api.get('/allotments/availability', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getAnalytics(allotmentId: string, params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<unknown> {
    try {
      const response = await api.get(`/allotments/${allotmentId}/analytics`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getChannelPerformance(allotmentId: string): Promise<unknown> {
    try {
      const response = await api.get(`/allotments/${allotmentId}/channel-performance`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getRecommendations(allotmentId: string): Promise<unknown> {
    try {
      const response = await api.get(`/allotments/${allotmentId}/recommendations`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async exportAllotment(allotmentId: string, params?: {
    format?: 'json' | 'csv';
    startDate?: string;
    endDate?: string;
  }): Promise<unknown> {
    try {
      const response = await api.get(`/allotments/${allotmentId}/export`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default new AllotmentService();