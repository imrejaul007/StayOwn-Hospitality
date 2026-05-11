import { api } from './api';

export interface InventoryRecord {
  _id: string;
  hotelId: string;
  roomTypeId: {
    _id: string;
    name: string;
    code: string;
    basePrice: number;
  };
  date: string;
  totalRooms: number;
  availableRooms: number;
  soldRooms: number;
  blockedRooms: number;
  baseRate: number;
  sellingRate: number;
  currency: string;
  stopSellFlag?: boolean;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  minimumStay?: number;
  maximumStay?: number;
  needsSync: boolean;
  lastModified: string;
  channelInventory?: Array<{
    channel: string;
    availableRooms: number;
    rate: number;
    restrictions?: {
      stopSell?: boolean;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
      minimumStay?: number;
      maximumStay?: number;
    };
  }>;
  reservations?: Array<{
    bookingId: string;
    roomsReserved: number;
    source: string;
  }>;
  channelSpecific?: Record<string, unknown>; // Added when filtering by channel
}

export interface InventoryUpdate {
  hotelId: string;
  roomTypeId: string;
  date: string;
  availableRooms?: number;
  baseRate?: number;
  sellingRate?: number;
  restrictions?: {
    stopSellFlag?: boolean;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
    minimumStay?: number;
    maximumStay?: number;
  };
  channel?: string;
}

export interface BulkInventoryUpdate {
  hotelId: string;
  roomTypeId: string;
  updates: Array<{
    date: string;
    availableRooms?: number;
    baseRate?: number;
    sellingRate?: number;
    restrictions?: {
      stopSellFlag?: boolean;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
      minimumStay?: number;
      maximumStay?: number;
    };
  }>;
  channel?: string;
}

export interface BulkUpdateResult {
  totalUpdates: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    date: string;
    status: 'success' | 'failed';
    inventoryId?: string;
    error?: string;
  }>;
}

export interface StopSellRequest {
  hotelId: string;
  roomTypeId: string;
  startDate: string;
  endDate: string;
  stopSell?: boolean;
  channel?: string;
  reason?: string;
}

export interface CalendarData {
  year: number;
  month: number;
  calendar: {
    [date: string]: {
      [roomTypeCode: string]: {
        totalRooms: number;
        availableRooms: number;
        soldRooms: number;
        blockedRooms: number;
        baseRate: number;
        sellingRate: number;
        stopSellFlag: boolean;
        closedToArrival: boolean;
        closedToDeparture: boolean;
        minimumStay?: number;
        maximumStay?: number;
        occupancyRate: string;
      };
    };
  };
}

export interface InventorySummary {
  summary: {
    totalInventoryDays: number;
    totalRoomNights: number;
    totalAvailable: number;
    totalSold: number;
    totalBlocked: number;
    averageRate: number;
    occupancyRate: string;
    availabilityRate: string;
    stopSellDays: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface CreateInventoryRange {
  hotelId: string;
  roomTypeId: string;
  startDate: string;
  endDate: string;
  baseRate?: number;
  createMode?: 'skip_existing' | 'overwrite';
}

export interface CreateRangeResult {
  recordsCreated: number;
  roomTypeId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalRooms: number;
  baseRate: number;
}

class InventoryService {
  /**
   * Get inventory for a specific date range
   */
  async getInventory(params: {
    hotelId: string;
    roomTypeId?: string;
    startDate: string;
    endDate: string;
    channel?: string;
  }): Promise<InventoryRecord[]> {
    try {
      const queryParams = new URLSearchParams({
        hotelId: params.hotelId,
        startDate: params.startDate,
        endDate: params.endDate
      });

      if (params.roomTypeId) queryParams.append('roomTypeId', params.roomTypeId);
      if (params.channel) queryParams.append('channel', params.channel);

      const response = await api.get(`/inventory-management?${queryParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch inventory');
    }
  }

  /**
   * Update inventory for a specific date
   */
  async updateInventory(updateData: InventoryUpdate): Promise<InventoryRecord> {
    try {
      const response = await api.post('/inventory-management/update', updateData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update inventory');
    }
  }

  /**
   * Bulk update inventory for multiple dates
   */
  async bulkUpdateInventory(bulkData: BulkInventoryUpdate): Promise<BulkUpdateResult> {
    try {
      const response = await api.post('/inventory-management/bulk-update', bulkData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to bulk update inventory');
    }
  }

  /**
   * Set stop sell for a date range
   */
  async setStopSell(stopSellData: StopSellRequest): Promise<{
    updatedRecords: number;
    stopSell: boolean;
    dateRange: { startDate: string; endDate: string };
  }> {
    try {
      const response = await api.post('/inventory-management/stop-sell', stopSellData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to set stop sell');
    }
  }

  /**
   * Get inventory calendar view for a month
   */
  async getInventoryCalendar(params: {
    hotelId: string;
    roomTypeId?: string;
    year: number;
    month: number;
  }): Promise<CalendarData> {
    try {
      const queryParams = new URLSearchParams({
        hotelId: params.hotelId,
        year: params.year.toString(),
        month: params.month.toString()
      });

      if (params.roomTypeId) queryParams.append('roomTypeId', params.roomTypeId);

      const response = await api.get(`/inventory-management/calendar?${queryParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch inventory calendar');
    }
  }

  /**
   * Get inventory summary statistics
   */
  async getInventorySummary(params: {
    hotelId: string;
    roomTypeId?: string;
    startDate: string;
    endDate: string;
  }): Promise<InventorySummary> {
    try {
      const queryParams = new URLSearchParams({
        hotelId: params.hotelId,
        startDate: params.startDate,
        endDate: params.endDate
      });

      if (params.roomTypeId) queryParams.append('roomTypeId', params.roomTypeId);

      const response = await api.get(`/inventory-management/summary?${queryParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch inventory summary');
    }
  }

  /**
   * Create inventory for a date range
   */
  async createInventoryRange(rangeData: CreateInventoryRange): Promise<CreateRangeResult> {
    try {
      const response = await api.post('/inventory-management/create-range', rangeData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to create inventory range');
    }
  }

  /**
   * Get inventory status for specific room type and date
   */
  async getInventoryStatus(params: {
    hotelId: string;
    roomTypeId: string;
    date: string;
  }): Promise<InventoryRecord | null> {
    try {
      const inventory = await this.getInventory({
        hotelId: params.hotelId,
        roomTypeId: params.roomTypeId,
        startDate: params.date,
        endDate: params.date
      });

      return inventory.length > 0 ? inventory[0] : null;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch inventory status');
    }
  }

  /**
   * Check if rooms are available for a specific date and room type
   */
  async checkAvailability(params: {
    hotelId: string;
    roomTypeId: string;
    date: string;
    roomsNeeded: number;
  }): Promise<{
    available: boolean;
    availableRooms: number;
    roomsNeeded: number;
    canAccommodate: boolean;
  }> {
    try {
      const inventory = await this.getInventoryStatus({
        hotelId: params.hotelId,
        roomTypeId: params.roomTypeId,
        date: params.date
      });

      if (!inventory) {
        return {
          available: false,
          availableRooms: 0,
          roomsNeeded: params.roomsNeeded,
          canAccommodate: false
        };
      }

      const canAccommodate = inventory.availableRooms >= params.roomsNeeded;

      return {
        available: inventory.availableRooms > 0,
        availableRooms: inventory.availableRooms,
        roomsNeeded: params.roomsNeeded,
        canAccommodate
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to check inventory availability');
    }
  }

  /**
   * Get occupancy data for a date range
   */
  async getOccupancyData(params: {
    hotelId: string;
    roomTypeId?: string;
    startDate: string;
    endDate: string;
  }): Promise<{
    averageOccupancy: number;
    peakOccupancy: number;
    lowOccupancy: number;
    totalRoomNights: number;
    occupiedRoomNights: number;
    dailyOccupancy: Array<{
      date: string;
      occupancyRate: number;
      totalRooms: number;
      occupiedRooms: number;
    }>;
  }> {
    try {
      const inventory = await this.getInventory({
        hotelId: params.hotelId,
        roomTypeId: params.roomTypeId,
        startDate: params.startDate,
        endDate: params.endDate
      });

      const dailyOccupancy = inventory.map(record => {
        const occupiedRooms = record.soldRooms + record.blockedRooms;
        const occupancyRate = record.totalRooms > 0 ? 
          (occupiedRooms / record.totalRooms) * 100 : 0;

        return {
          date: record.date,
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          totalRooms: record.totalRooms,
          occupiedRooms
        };
      });

      const totalRoomNights = inventory.reduce((sum, record) => sum + record.totalRooms, 0);
      const occupiedRoomNights = inventory.reduce((sum, record) => 
        sum + record.soldRooms + record.blockedRooms, 0);
      
      const averageOccupancy = totalRoomNights > 0 ? 
        (occupiedRoomNights / totalRoomNights) * 100 : 0;

      const occupancyRates = dailyOccupancy.map(d => d.occupancyRate);
      const peakOccupancy = Math.max(...occupancyRates);
      const lowOccupancy = Math.min(...occupancyRates);

      return {
        averageOccupancy: Math.round(averageOccupancy * 100) / 100,
        peakOccupancy,
        lowOccupancy,
        totalRoomNights,
        occupiedRoomNights,
        dailyOccupancy
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to calculate occupancy data');
    }
  }

  /**
   * Get revenue data from inventory
   */
  async getRevenueData(params: {
    hotelId: string;
    roomTypeId?: string;
    startDate: string;
    endDate: string;
  }): Promise<{
    totalRevenue: number;
    averageRate: number;
    revPAR: number; // Revenue per available room
    dailyRevenue: Array<{
      date: string;
      revenue: number;
      averageRate: number;
      roomsSold: number;
    }>;
  }> {
    try {
      const inventory = await this.getInventory({
        hotelId: params.hotelId,
        roomTypeId: params.roomTypeId,
        startDate: params.startDate,
        endDate: params.endDate
      });

      const dailyRevenue = inventory.map(record => {
        const revenue = record.soldRooms * record.sellingRate;
        return {
          date: record.date,
          revenue,
          averageRate: record.sellingRate,
          roomsSold: record.soldRooms
        };
      });

      const totalRevenue = dailyRevenue.reduce((sum, day) => sum + day.revenue, 0);
      const totalRoomsSold = dailyRevenue.reduce((sum, day) => sum + day.roomsSold, 0);
      const totalRooms = inventory.reduce((sum, record) => sum + record.totalRooms, 0);

      const averageRate = totalRoomsSold > 0 ? totalRevenue / totalRoomsSold : 0;
      const revPAR = totalRooms > 0 ? totalRevenue / totalRooms : 0;

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageRate: Math.round(averageRate * 100) / 100,
        revPAR: Math.round(revPAR * 100) / 100,
        dailyRevenue
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to calculate revenue data');
    }
  }

  /**
   * Utility method to update rates across a date range
   */
  async updateRatesForDateRange(params: {
    hotelId: string;
    roomTypeId: string;
    startDate: string;
    endDate: string;
    baseRate?: number;
    sellingRate?: number;
    channel?: string;
  }): Promise<BulkUpdateResult> {
    try {
      // Generate updates for each date in the range
      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);
      const updates = [];

      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const update: Record<string, unknown> = {
          date: date.toISOString().split('T')[0]
        };

        if (params.baseRate !== undefined) update.baseRate = params.baseRate;
        if (params.sellingRate !== undefined) update.sellingRate = params.sellingRate;

        updates.push(update);
      }

      return await this.bulkUpdateInventory({
        hotelId: params.hotelId,
        roomTypeId: params.roomTypeId,
        updates,
        channel: params.channel
      });
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update rates for date range');
    }
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;