import { api } from './api';

export interface WorkflowAction {
  id: string;
  type: 'checkin' | 'checkout' | 'housekeeping' | 'maintenance' | 'status_update';
  roomIds: string[];
  floorId?: number;
  data: unknown;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface BulkCheckInRequest {
  roomIds: string[];
  guestData: {
    name: string;
    email: string;
    phone: string;
    checkInDate: string;
    checkOutDate: string;
    specialRequests?: string;
  };
  paymentMethod: string;
  notes?: string;
}

export interface BulkCheckOutRequest {
  roomIds: string[];
  checkoutTime: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  notes?: string;
}

export interface HousekeepingRequest {
  roomIds: string[];
  floorId?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tasks: string[];
  assignedTo?: string;
  estimatedDuration: number; // in minutes
  specialInstructions?: string;
}

export interface MaintenanceRequest {
  roomIds: string[];
  floorId?: number;
  issueType: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliance' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  estimatedCost?: number;
  vendorId?: string;
  scheduledDate?: string;
}

export interface RoomStatusUpdate {
  roomIds: string[];
  newStatus: 'vacant' | 'occupied' | 'dirty' | 'maintenance' | 'out_of_order' | 'reserved';
  reason?: string;
  notes?: string;
}

class WorkflowService {
  private baseUrl = '/workflow';

  // Bulk Check-in Operations
  async bulkCheckIn(request: BulkCheckInRequest): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post(`${this.baseUrl}/bulk-checkin`, request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Bulk Check-out Operations
  async bulkCheckOut(request: BulkCheckOutRequest): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post(`${this.baseUrl}/bulk-checkout`, request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Housekeeping Operations
  async scheduleHousekeeping(request: HousekeepingRequest): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post(`${this.baseUrl}/housekeeping`, request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Maintenance Operations
  async requestMaintenance(request: MaintenanceRequest): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post(`${this.baseUrl}/maintenance`, request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Room Status Updates
  async updateRoomStatus(request: RoomStatusUpdate): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post(`${this.baseUrl}/room-status`, request);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get Workflow Actions
  async getWorkflowActions(filters?: {
    type?: string;
    status?: string;
    floorId?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ success: boolean; data: WorkflowAction[] }> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        });
      }
    
      const response = await api.get(`${this.baseUrl}/actions?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get Floor Analytics
  async getFloorAnalytics(floorId: number): Promise<{
    success: boolean;
    data: {
      occupancyRate: number;
      averageStayDuration: number;
      revenuePerRoom: number;
      maintenanceRequests: number;
      housekeepingEfficiency: number;
      guestSatisfaction: number;
    };
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/analytics/floor/${floorId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get Predictive Analytics
  async getPredictiveAnalytics(period: '7d' | '30d' | '90d' = '30d'): Promise<{
    success: boolean;
    data: {
      occupancyForecast: Array<{
        date: string;
        predictedOccupancy: number;
        confidence: number;
      }>;
      revenueForecast: Array<{
        date: string;
        predictedRevenue: number;
        confidence: number;
      }>;
      maintenancePredictions: Array<{
        roomId: string;
        issueType: string;
        probability: number;
        estimatedDate: string;
      }>;
    };
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/analytics/predictive?period=${period}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const workflowService = new WorkflowService();
