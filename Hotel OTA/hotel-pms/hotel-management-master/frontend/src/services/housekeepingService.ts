import { ApiResponse } from '../types/api';
import { api, normalizeListParams } from './api';

export interface HousekeepingTask {
  _id: string;
  title: string;
  description: string;
  taskType: 'cleaning' | 'maintenance' | 'inspection' | 'deep_clean' | 'checkout_clean';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'inspected' | 'cancelled';
  roomId: {
    _id: string;
    roomNumber: string;
    type: string;
    floor?: string;
  };
  assignedToUserId?: string | { _id: string; name: string };
  assignedTo?: string | { _id: string; name: string };
  estimatedDuration: number;
  startedAt?: string;
  completedAt?: string;
  actualDuration?: number;
  notes?: string;
  supplies?: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  createdAt: string;
}

export interface HousekeepingListResponse {
  status: string;
  results: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  data: {
    tasks: HousekeepingTask[];
  };
}

export type HousekeepingTaskStatus =
  'pending' |
  'assigned' |
  'in_progress' |
  'completed' |
  'inspected' |
  'cancelled';

class HousekeepingService {
  private baseURL = '/housekeeping';

  async getTasks(assignedToUserId?: string, page?: number, limit?: number): Promise<HousekeepingListResponse> {
    try {
      const normalizedParams = normalizeListParams({ page, limit });
      const queryParams = new URLSearchParams();
      if (assignedToUserId) {
        queryParams.append('assignedToUserId', assignedToUserId);
      }
      queryParams.append('page', normalizedParams.page.toString());
      queryParams.append('limit', normalizedParams.limit.toString());

      const endpoint = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await api.get(`${this.baseURL}${endpoint}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /** Supervisor/frontdesk list with optional filters. Does NOT filter by assignedToUserId
   *  so the backend returns all hotel tasks (requires supervisor role). */
  async getTasksFiltered(params: {
    status?: string;
    priority?: string;
    taskType?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<HousekeepingListResponse> {
    try {
      const normalizedParams = normalizeListParams(params);
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.append('status', params.status);
      if (params.priority) queryParams.append('priority', params.priority);
      if (params.taskType) queryParams.append('taskType', params.taskType);
      if (params.search) queryParams.append('search', params.search);
      queryParams.append('page', normalizedParams.page.toString());
      queryParams.append('limit', normalizedParams.limit.toString());

      const response = await api.get(`${this.baseURL}?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /** Get housekeeping statistics (aggregated counts by status). */
  async getStats(): Promise<ApiResponse<{ stats: Array<{ _id: string; count: number; avgDuration: number | null }> }>> {
    try {
      const response = await api.get(`${this.baseURL}/stats`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /** Inspect a completed task (QA workflow). */
  async inspectTask(taskId: string, inspection: {
    passed: boolean;
    rating?: number;
    notes?: string;
  }): Promise<ApiResponse<{ task: HousekeepingTask }>> {
    try {
      const response = await api.post(`${this.baseURL}/${taskId}/inspect`, inspection);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateTaskStatus(taskId: string, status: HousekeepingTaskStatus): Promise<ApiResponse<{ task: HousekeepingTask }>> {
    try {
      const response = await api.patch(`${this.baseURL}/${taskId}`, { status });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async completeTask(taskId: string, completionData: {
    status: HousekeepingTaskStatus;
    notes?: string;
    completedAt?: string;
  }): Promise<ApiResponse<{ task: HousekeepingTask }>> {
    try {
      const response = await api.patch(`${this.baseURL}/${taskId}`, completionData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const housekeepingService = new HousekeepingService();
