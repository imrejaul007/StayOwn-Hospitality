import { api } from './api';

export interface Department {
  _id: string;
  name: string;
  code: string;
  description?: string;
  departmentType: string;
  parentDepartment?: string;
  level: number;
  hierarchyPath?: string;
  isOperational: boolean;
  isRevenueCenter: boolean;
  isCostCenter: boolean;
  workingHours: {
    isActive: boolean;
    schedule: Array<{
      day: string;
      isWorking: boolean;
      startTime?: string;
      endTime?: string;
      breakStart?: string;
      breakEnd?: string;
    }>;
    timezone: string;
  };
  budget: {
    annual: {
      revenue: number;
      expenses: number;
    };
    monthly: {
      revenue: number;
      expenses: number;
    };
    currency: string;
    budgetYear: number;
  };
  contact: {
    phone?: string;
    extension?: string;
    email?: string;
    location: {
      building?: string;
      floor?: string;
      room?: string;
      address?: string;
    };
  };
  staffing: {
    headOfDepartment?: {
      _id: string;
      name: string;
      email: string;
    };
    totalPositions: number;
    currentStaff: number;
    shifts: Array<{
      name: string;
      startTime: string;
      endTime: string;
      staffRequired: number;
    }>;
  };
  kpis: Array<{
    name: string;
    description?: string;
    targetValue: number;
    currentValue: number;
    unit: string;
    frequency: string;
    isActive: boolean;
  }>;
  permissions: {
    accessLevel: string;
    allowedRoles: string[];
    specialPermissions: Array<{
      action: string;
      roles: string[];
      conditions?: Record<string, unknown>;
    }>;
  };
  settings: {
    autoAssignment: boolean;
    requireApproval: boolean;
    notificationSettings: {
      email: boolean;
      sms: boolean;
      push: boolean;
      internal: boolean;
    };
    integrations: Array<{
      system: string;
      isEnabled: boolean;
      configuration?: Record<string, unknown>;
    }>;
  };
  status: 'active' | 'inactive' | 'suspended' | 'archived';
  hotelId: string;
  analytics: {
    totalTasks: number;
    completedTasks: number;
    avgTaskCompletionTime: number;
    totalRevenue: number;
    totalExpenses: number;
    efficiency: number;
    lastCalculated: Date;
  };
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  auditLog?: Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }>;
}

export interface CreateDepartmentData {
  name: string;
  code: string;
  description?: string;
  departmentType: string;
  parentDepartment?: string;
  isOperational?: boolean;
  isRevenueCenter?: boolean;
  isCostCenter?: boolean;
  workingHours?: {
    isActive?: boolean;
    schedule?: Array<{
      day: string;
      isWorking?: boolean;
      startTime?: string;
      endTime?: string;
      breakStart?: string;
      breakEnd?: string;
    }>;
    timezone?: string;
  };
  budget?: {
    annual?: {
      revenue?: number;
      expenses?: number;
    };
    monthly?: {
      revenue?: number;
      expenses?: number;
    };
    currency?: string;
    budgetYear?: number;
  };
  contact?: {
    phone?: string;
    extension?: string;
    email?: string;
    location?: {
      building?: string;
      floor?: string;
      room?: string;
      address?: string;
    };
  };
  staffing?: {
    headOfDepartment?: string;
    totalPositions?: number;
    shifts?: Array<{
      name: string;
      startTime: string;
      endTime: string;
      staffRequired: number;
    }>;
  };
  kpis?: Array<{
    name: string;
    description?: string;
    targetValue: number;
    currentValue?: number;
    unit: string;
    frequency?: string;
    isActive?: boolean;
  }>;
  permissions?: {
    accessLevel?: string;
    allowedRoles?: string[];
    specialPermissions?: Array<{
      action: string;
      roles: string[];
      conditions?: Record<string, unknown>;
    }>;
  };
  settings?: {
    autoAssignment?: boolean;
    requireApproval?: boolean;
    notificationSettings?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
      internal?: boolean;
    };
    integrations?: Array<{
      system: string;
      isEnabled: boolean;
      configuration?: Record<string, unknown>;
    }>;
  };
}

export interface UpdateDepartmentData extends Partial<CreateDepartmentData> {}

export interface DepartmentFilters {
  status?: 'active' | 'inactive' | 'suspended' | 'archived';
  departmentType?: string;
  includeHierarchy?: boolean;
  page?: number;
  limit?: number;
  populate?: boolean;
  includeStats?: boolean;
}

export interface DepartmentMetrics {
  basic: {
    name: string;
    code: string;
    type: string;
    level: number;
  };
  staffing: {
    totalPositions: number;
    currentStaff: number;
    occupancyRate: string;
  };
  performance: {
    completionRate: string;
    efficiency: number;
    totalTasks: number;
    avgCompletionTime: number;
  };
  financial: {
    totalRevenue: number;
    totalExpenses: number;
    budgetUtilization: string;
  };
  hierarchy: {
    subdepartments: number;
    hasParent: boolean;
    fullPath: string;
  };
}

export interface BulkUpdateItem {
  departmentId: string;
  data: UpdateDepartmentData;
}

class DepartmentService {
  async getDepartments(filters: DepartmentFilters = {}) {
    try {
      const params = new URLSearchParams();
    
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/departments?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getDepartmentById(id: string, options: { populate?: boolean; includeStats?: boolean } = {}) {
    try {
      const params = new URLSearchParams();
    
      if (options.populate) params.append('populate', 'true');
      if (options.includeStats) params.append('includeStats', 'true');

      const response = await api.get(`/departments/${id}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createDepartment(departmentData: CreateDepartmentData) {
    try {
      const response = await api.post('/departments', departmentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateDepartment(id: string, departmentData: UpdateDepartmentData) {
    try {
      const response = await api.put(`/departments/${id}`, departmentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async deleteDepartment(id: string) {
    try {
      const response = await api.delete(`/departments/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getDepartmentHierarchy() {
    try {
      const response = await api.get('/departments/hierarchy');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async searchDepartments(query: string, options: { status?: string; limit?: number } = {}) {
    try {
      const params = new URLSearchParams({ q: query });
    
      if (options.status) params.append('status', options.status);
      if (options.limit) params.append('limit', options.limit.toString());

      const response = await api.get(`/departments/search?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async exportDepartments(format: 'json' | 'csv' = 'json') {
    try {
      const response = await api.get(`/departments/export?format=${format}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getDepartmentSummary() {
    try {
      const response = await api.get('/departments/summary');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async bulkUpdateDepartments(updates: BulkUpdateItem[]) {
    try {
      const response = await api.put('/departments/bulk-update', { updates });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async assignStaff(departmentId: string, staffIds: string[]) {
    try {
      const response = await api.post(`/departments/${departmentId}/assign-staff`, { staffIds });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateAnalytics(departmentId: string, analyticsData: Partial<Department['analytics']>) {
    try {
      const response = await api.put(`/departments/${departmentId}/analytics`, analyticsData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getDepartmentMetrics(departmentId: string, period: '7d' | '30d' | '90d' | '1y' = '30d') {
    try {
      const response = await api.get(`/departments/${departmentId}/metrics?period=${period}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getDepartmentAuditLog(departmentId: string, options: { page?: number; limit?: number } = {}) {
    try {
      const params = new URLSearchParams();
    
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());

      const response = await api.get(`/departments/${departmentId}/audit-log?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateDepartmentKPIs(departmentId: string, kpis: Department['kpis']) {
    try {
      const response = await api.put(`/departments/${departmentId}/kpis`, { kpis });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateDepartmentBudget(departmentId: string, budget: Department['budget']) {
    try {
      const response = await api.put(`/departments/${departmentId}/budget`, { budget });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getDepartmentStaff(departmentId: string, options: { page?: number; limit?: number } = {}) {
    try {
      const params = new URLSearchParams();
    
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());

      const response = await api.get(`/departments/${departmentId}/staff?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateDepartmentStatus(departmentId: string, status: Department['status'], reason?: string) {
    try {
      const response = await api.patch(`/departments/${departmentId}/status`, { status, reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async cloneDepartment(departmentId: string, newName: string, newCode: string) {
    try {
      const response = await api.post(`/departments/${departmentId}/clone`, { newName, newCode });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const departmentService = new DepartmentService();
export default departmentService;