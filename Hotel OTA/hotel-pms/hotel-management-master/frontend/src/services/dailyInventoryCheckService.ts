import { api } from './api';

export interface InventoryCheckItem {
  itemId: string;
  itemName: string;
  category: string;
  currentQuantity: number;
  requiredQuantity: number;
  status: 'sufficient' | 'low' | 'missing' | 'damaged';
  notes?: string;
}

export interface DailyInventoryCheck {
  _id: string;
  hotelId: {
    _id: string;
    name: string;
  };
  roomId: {
    _id: string;
    roomNumber: string;
    type: string;
  };
  checkedBy: {
    _id: string;
    name: string;
    email: string;
  };
  checkDate: string;
  items: InventoryCheckItem[];
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completedAt?: string;
  notes?: string;
  issues: Array<{
    _id: string;
    itemId: string;
    issue: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    resolved: boolean;
    resolvedAt?: string;
    resolvedBy?: {
      _id: string;
      name: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

interface CreateInventoryCheckData {
  roomId: string;
  items: Array<{
    itemId: string;
    currentQuantity: number;
    status?: 'sufficient' | 'low' | 'missing' | 'damaged';
    notes?: string;
  }>;
  notes?: string;
}

interface UpdateInventoryCheckData {
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  items?: InventoryCheckItem[];
  notes?: string;
}

interface InventoryCheckFilters {
  status?: string;
  roomId?: string;
  date?: string;
  page?: number;
  limit?: number;
}

interface ApiResponse<T> {
  status: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class DailyInventoryCheckService {
  async createInventoryCheck(data: CreateInventoryCheckData): Promise<ApiResponse<{ dailyCheck: DailyInventoryCheck }>> {
    try {
      const response = await api.post('/daily-inventory-checks', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getInventoryChecks(filters: InventoryCheckFilters = {}): Promise<ApiResponse<{ dailyChecks: DailyInventoryCheck[] }>> {
    try {
      const params = new URLSearchParams();
    
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/daily-inventory-checks?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getTodayChecks(): Promise<ApiResponse<{ dailyChecks: DailyInventoryCheck[] }>> {
    try {
      const response = await api.get('/daily-inventory-checks/today');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOverdueChecks(): Promise<ApiResponse<{ dailyChecks: DailyInventoryCheck[] }>> {
    try {
      const response = await api.get('/daily-inventory-checks/overdue');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getInventoryCheckById(id: string): Promise<ApiResponse<{ dailyCheck: DailyInventoryCheck }>> {
    try {
      const response = await api.get(`/daily-inventory-checks/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateInventoryCheck(id: string, updates: UpdateInventoryCheckData): Promise<ApiResponse<{ dailyCheck: DailyInventoryCheck }>> {
    try {
      const response = await api.patch(`/daily-inventory-checks/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async completeInventoryCheck(id: string): Promise<ApiResponse<{ dailyCheck: DailyInventoryCheck }>> {
    try {
      const response = await api.patch(`/daily-inventory-checks/${id}/complete`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async addIssue(id: string, itemId: string, issue: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<ApiResponse<{ dailyCheck: DailyInventoryCheck }>> {
    try {
      const response = await api.post(`/daily-inventory-checks/${id}/issues`, {
        itemId,
        issue,
        priority
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const dailyInventoryCheckService = new DailyInventoryCheckService();
