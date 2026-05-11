import { ApiResponse } from '../types/api';
import { api } from './api';

export interface RoomInventoryItem {
  _id: string;
  name: string;
  category: string;
  description: string;
  unitPrice: number;
  quantity: number;
  status: 'available' | 'missing' | 'damaged' | 'needs_cleaning' | 'working';
  lastReplaced?: string;
  lastCleaned?: string;
}

export interface TemplateInventoryItem {
  _id?: string;
  name: string;
  category: string;
  description?: string;
  unitPrice?: number;
  standardQuantity?: number;
  checkInstructions?: string;
  expectedCondition?: string;
}

export interface InventoryTemplate {
  _id?: string;
  roomType: 'single' | 'double' | 'deluxe' | 'suite';
  fixedInventory: TemplateInventoryItem[];
  dailyInventory: TemplateInventoryItem[];
  estimatedCheckDuration?: number;
  isActive?: boolean;
  createdBy?: string;
  lastUpdatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyCheckData {
  _id: string;
  roomNumber: string;
  type: string;
  floor: string;
  checkStatus: 'pending' | 'in_progress' | 'completed' | 'overdue';
  lastChecked: string | null;
  fixedInventory: RoomInventoryItem[];
  dailyInventory: RoomInventoryItem[];
  assignedStaff?: string;
  estimatedDuration: number;
}

export interface AssignedRoomData {
  _id: string;
  roomNumber: string;
  type: string;
  floor: string;
  checkStatus: 'pending' | 'in_progress' | 'completed' | 'overdue';
  lastChecked: string | null;
  estimatedDuration: number;
  fixedInventory?: RoomInventoryItem[];
  dailyInventory?: RoomInventoryItem[];
}

export interface DailyCheckResult {
  roomId: string;
  checkedBy: string;
  checkedAt: string;
  items: Array<{
    itemId: string;
    action: 'replace' | 'add' | 'laundry' | 'reuse';
    quantity: number;
    notes?: string;
  }>;
  totalCost: number;
  status: 'completed';
}

interface DailyCheckFilters {
  filter?: 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';
  floor?: string;
  type?: string;
  assignedStaff?: string;
  assignedToMe?: boolean;
  page?: number;
  limit?: number;
}

class DailyRoutineCheckService {
  private baseURL = '/daily-routine-check';

  /**
   * Get rooms that need daily routine check
   */
  async getRoomsForDailyCheck(filters: DailyCheckFilters = {}): Promise<ApiResponse<{ rooms: DailyCheckData[] }>> {
    try {
      const queryParams = new URLSearchParams();
    
      if (filters.filter) queryParams.append('filter', filters.filter);
      if (filters.floor) queryParams.append('floor', filters.floor);
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.assignedStaff) queryParams.append('assignedStaff', filters.assignedStaff);
      if (filters.assignedToMe !== undefined) queryParams.append('assignedToMe', String(filters.assignedToMe));
      if (filters.page) queryParams.append('page', filters.page.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());

      const response = await api.get(`${this.baseURL}/rooms?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get detailed inventory for a specific room
   */
  async getRoomInventory(roomId: string): Promise<ApiResponse<DailyCheckData>> {
    try {
      const response = await api.get(`${this.baseURL}/rooms/${roomId}/inventory`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Complete daily routine check for a room
   */
  async completeDailyCheck(roomId: string, checkData: { cart: unknown[] }): Promise<ApiResponse<DailyCheckResult>> {
    try {
      const response = await api.post(`${this.baseURL}/rooms/${roomId}/complete`, checkData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get daily check history for a room
   */
  async getRoomCheckHistory(roomId: string, page: number = 1, limit: number = 10): Promise<ApiResponse<{ checks: DailyCheckResult[] }>> {
    try {
      const response = await api.get(`${this.baseURL}/rooms/${roomId}/history?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get daily check summary for staff dashboard
   */
  async getDailyCheckSummary(): Promise<ApiResponse<{
    totalRooms: number;
    pendingChecks: number;
    completedToday: number;
    overdueChecks: number;
    estimatedTimeRemaining: number;
  }>> {
    try {
      const response = await api.get(`${this.baseURL}/summary`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Assign daily checks to staff members
   */
  async assignDailyChecks(assignments: Array<{ roomId: string; staffId: string }>): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await api.post(`${this.baseURL}/assign`, { assignments });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get staff member's assigned rooms for today
   */
  async getMyAssignedRooms(): Promise<ApiResponse<{ rooms: AssignedRoomData[] }>> {
    try {
      const response = await api.get(`${this.baseURL}/my-assignments`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Mark room as checked without detailed inventory
   */
  async markRoomAsChecked(roomId: string, notes?: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await api.post(`${this.baseURL}/rooms/${roomId}/mark-checked`, { notes });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get inventory templates for different room types
   */
  async getInventoryTemplates(): Promise<ApiResponse<{
    templates: InventoryTemplate[];
  }>> {
    try {
      const response = await api.get(`${this.baseURL}/templates`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Create new inventory template for a room type
   */
  async createInventoryTemplate(template: Omit<InventoryTemplate, '_id' | 'isActive' | 'createdBy' | 'lastUpdatedBy' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<{ message: string; template: InventoryTemplate }>> {
    try {
      const response = await api.post(`${this.baseURL}/templates`, template);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Update inventory template for a room type
   */
  async updateInventoryTemplate(roomType: string, template: Partial<Pick<InventoryTemplate, 'fixedInventory' | 'dailyInventory' | 'estimatedCheckDuration'>>): Promise<ApiResponse<{ message: string; template: InventoryTemplate }>> {
    try {
      const response = await api.put(`${this.baseURL}/templates/${roomType}`, template);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Delete inventory template for a room type
   */
  async deleteInventoryTemplate(roomType: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await api.delete(`${this.baseURL}/templates/${roomType}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get daily check statistics for reporting
   */
  async getDailyCheckStats(startDate: string, endDate: string): Promise<ApiResponse<{
    totalChecks: number;
    totalItemsReplaced: number;
    totalItemsAdded: number;
    totalItemsToLaundry: number;
    totalItemsReused: number;
    totalCost: number;
    averageCheckDuration: number;
    roomsByStatus: Record<string, number>;
  }>> {
    try {
      const response = await api.get(`${this.baseURL}/stats?startDate=${startDate}&endDate=${endDate}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const dailyRoutineCheckService = new DailyRoutineCheckService();
