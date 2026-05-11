import { api } from './api';

export interface Reason {
  _id: string;
  name: string;
  code: string;
  description?: string;
  category: string;
  subcategory?: string;
  isActive: boolean;
  requiresApproval: boolean;
  requiresManagerApproval: boolean;
  requiresComments: boolean;
  requiresDocumentation: boolean;
  allowsRefund: boolean;
  maxRefundPercentage: number;
  allowsDiscount: boolean;
  maxDiscountPercentage: number;
  allowsComp: boolean;
  hasFinancialImpact: boolean;
  autoApply: boolean;
  notifyGuest: boolean;
  notifyManagement: boolean;
  createTask: boolean;
  taskTemplate?: string;
  canUseAfterCheckIn: boolean;
  canUseAfterCheckOut: boolean;
  canUseBeforeArrival: boolean;
  hoursBeforeArrival: number;
  hoursAfterCheckOut: number;
  applicableDepartments?: Array<{
    _id: string;
    name: string;
    code: string;
  }>;
  allowedRoles: string[];
  restrictedRoles: string[];
  integrations: {
    pms: {
      enabled: boolean;
      code?: string;
      mapping?: Record<string, unknown>;
    };
    accounting: {
      enabled: boolean;
      code?: string;
      glAccount?: string;
    };
    reporting: {
      enabled: boolean;
      category?: string;
      tags?: string[];
    };
  };
  templates: {
    guestNotification: {
      email: {
        subject?: string;
        body?: string;
      };
      sms: {
        message?: string;
      };
    };
    internalNotification: {
      subject?: string;
      message?: string;
    };
    documentation: {
      required?: string[];
      optional?: string[];
    };
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  escalationRules: Array<{
    condition: string;
    timeLimit: number;
    escalateTo: string[];
    action: string;
  }>;
  usage: {
    totalUsed: number;
    lastUsed?: Date;
    avgFrequencyPerMonth: number;
    avgFinancialImpact: number;
    commonPatterns: string[];
  };
  complianceFlags: string[];
  retentionPeriod: number;
  hotelId: string;
  isSystemReason: boolean;
  systemCategory?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  usageLog?: Array<{
    usedBy: string;
    usedAt: Date;
    context: string;
    entityId: string;
    entityType: string;
    financialImpact?: {
      amount: number;
      currency: string;
      type: string;
    };
    notes?: string;
    approvedBy?: string;
  }>;
}

export interface CreateReasonData {
  name: string;
  code: string;
  description?: string;
  category: string;
  subcategory?: string;
  isActive?: boolean;
  requiresApproval?: boolean;
  requiresManagerApproval?: boolean;
  requiresComments?: boolean;
  requiresDocumentation?: boolean;
  allowsRefund?: boolean;
  maxRefundPercentage?: number;
  allowsDiscount?: boolean;
  maxDiscountPercentage?: number;
  allowsComp?: boolean;
  hasFinancialImpact?: boolean;
  autoApply?: boolean;
  notifyGuest?: boolean;
  notifyManagement?: boolean;
  createTask?: boolean;
  taskTemplate?: string;
  canUseAfterCheckIn?: boolean;
  canUseAfterCheckOut?: boolean;
  canUseBeforeArrival?: boolean;
  hoursBeforeArrival?: number;
  hoursAfterCheckOut?: number;
  applicableDepartments?: string[];
  allowedRoles?: string[];
  restrictedRoles?: string[];
  integrations?: {
    pms?: {
      enabled?: boolean;
      code?: string;
      mapping?: Record<string, unknown>;
    };
    accounting?: {
      enabled?: boolean;
      code?: string;
      glAccount?: string;
    };
    reporting?: {
      enabled?: boolean;
      category?: string;
      tags?: string[];
    };
  };
  templates?: {
    guestNotification?: {
      email?: {
        subject?: string;
        body?: string;
      };
      sms?: {
        message?: string;
      };
    };
    internalNotification?: {
      subject?: string;
      message?: string;
    };
    documentation?: {
      required?: string[];
      optional?: string[];
    };
  };
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  escalationRules?: Array<{
    condition: string;
    timeLimit: number;
    escalateTo: string[];
    action: string;
  }>;
  complianceFlags?: string[];
  retentionPeriod?: number;
}

export interface UpdateReasonData extends Partial<CreateReasonData> {}

export interface ReasonFilters {
  category?: string;
  isActive?: boolean;
  userRole?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReasonValidation {
  valid: boolean;
  reason?: string;
  approvalRequired?: string;
  requiresComments?: boolean;
  requiresDocumentation?: boolean;
  allowsRefund?: boolean;
  maxRefundPercentage?: number;
  allowsDiscount?: boolean;
  maxDiscountPercentage?: number;
}

export interface ReasonUsageData {
  context: 'booking' | 'cancellation' | 'modification' | 'billing' | 'maintenance' | 'complaint' | 'other';
  entityId: string;
  entityType: string;
  financialImpact?: {
    amount: number;
    currency: string;
    type: 'refund' | 'discount' | 'comp' | 'charge' | 'adjustment';
  };
  notes?: string;
  approvedBy?: string;
}

export interface BulkUpdateItem {
  reasonId: string;
  data: UpdateReasonData;
}

export interface ReasonStats {
  categoryBreakdown: Array<{
    _id: string;
    count: number;
    activeCount: number;
    totalUsage: number;
    avgFinancialImpact: number;
  }>;
  overall: {
    total: number;
    active: number;
    inactive: number;
    systemReasons: number;
    totalUsage: number;
    avgUsagePerReason: string;
    categoriesUsed: number;
    lastActivity: Date;
  };
  generatedAt: Date;
}

export interface ReasonAnalytics {
  period: string;
  totalReasons: number;
  activeReasons: number;
  mostUsed: Array<{
    name: string;
    code: string;
    category: string;
    totalUsed: number;
    lastUsed?: Date;
    avgFinancialImpact: number;
  }>;
  usageByCategory: {
    [category: string]: {
      count: number;
      totalUsage: number;
      avgFinancialImpact: number;
    };
  };
  trendsOverTime: unknown[];
}

class ReasonService {
  async getReasons(filters: ReasonFilters = {}) {
    try {
      const params = new URLSearchParams();
    
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/reasons?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getReasonById(id: string, options: { populate?: boolean; includeUsageLog?: boolean } = {}) {
    try {
      const params = new URLSearchParams();
    
      if (options.populate) params.append('populate', 'true');
      if (options.includeUsageLog) params.append('includeUsageLog', 'true');

      const response = await api.get(`/reasons/${id}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createReason(reasonData: CreateReasonData) {
    try {
      const response = await api.post('/reasons', reasonData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateReason(id: string, reasonData: UpdateReasonData) {
    try {
      const response = await api.put(`/reasons/${id}`, reasonData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async deleteReason(id: string) {
    try {
      const response = await api.delete(`/reasons/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getReasonsByCategory(category: string, options: { includeInactive?: boolean } = {}) {
    try {
      const params = new URLSearchParams();
      if (options.includeInactive) params.append('includeInactive', 'true');

      const response = await api.get(`/reasons/category/${category}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getReasonsByRole(role: string, options: { category?: string; includeInactive?: boolean } = {}) {
    try {
      const params = new URLSearchParams();
    
      if (options.category) params.append('category', options.category);
      if (options.includeInactive) params.append('includeInactive', 'true');

      const response = await api.get(`/reasons/role/${role}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getMostUsedReasons(limit = 10) {
    try {
      const response = await api.get(`/reasons/most-used?limit=${limit}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async logReasonUsage(reasonId: string, usageData: ReasonUsageData) {
    try {
      const response = await api.post(`/reasons/${reasonId}/log-usage`, usageData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async searchReasons(query: string, options: { category?: string; userRole?: string; limit?: number } = {}) {
    try {
      const params = new URLSearchParams({ q: query });
    
      if (options.category) params.append('category', options.category);
      if (options.userRole) params.append('userRole', options.userRole);
      if (options.limit) params.append('limit', options.limit.toString());

      const response = await api.get(`/reasons/search?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async bulkUpdateReasons(updates: BulkUpdateItem[]) {
    try {
      const response = await api.put('/reasons/bulk-update', { updates });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async bulkCreateReasons(reasons: CreateReasonData[]) {
    try {
      const response = await api.post('/reasons/bulk-create', { reasons });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async exportReasons(format: 'json' | 'csv' = 'json') {
    try {
      const response = await api.get(`/reasons/export?format=${format}`);
    
      if (format === 'csv') {
        // Handle CSV download
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'reasons.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return { success: true, message: 'Export started' };
      }
    
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getReasonStats(): Promise<{ success: boolean; data: ReasonStats }> {
    try {
      const response = await api.get('/reasons/stats');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getUsageAnalytics(period: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<{ success: boolean; data: ReasonAnalytics }> {
    try {
      const response = await api.get(`/reasons/analytics?period=${period}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async validateReasonUsage(reasonId: string, context: string, amount = 0): Promise<{ success: boolean; data: ReasonValidation }> {
    try {
      const params = new URLSearchParams({ context });
      if (amount > 0) params.append('amount', amount.toString());

      const response = await api.get(`/reasons/${reasonId}/validate?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getReasonCategories() {
    try {
      const response = await api.get('/reasons/categories');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getUserRoles() {
    try {
      const response = await api.get('/reasons/roles');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async cloneReason(reasonId: string, newName: string, newCode: string) {
    try {
      const response = await api.post(`/reasons/${reasonId}/clone`, { newName, newCode });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateReasonStatus(reasonId: string, isActive: boolean, reason?: string) {
    try {
      const response = await api.patch(`/reasons/${reasonId}/status`, { isActive, reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Helper methods for frontend
  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      'cancellation': '#f44336',
      'no_show': '#e91e63',
      'modification': '#9c27b0',
      'discount': '#673ab7',
      'comp': '#3f51b5',
      'refund': '#2196f3',
      'upgrade': '#00bcd4',
      'downgrade': '#009688',
      'early_checkout': '#4caf50',
      'late_checkout': '#8bc34a',
      'damage': '#cddc39',
      'complaint': '#ffeb3b',
      'maintenance': '#ffc107',
      'overbooking': '#ff9800',
      'group_booking': '#ff5722',
      'vip': '#795548',
      'loyalty': '#607d8b',
      'package': '#9e9e9e',
      'seasonal': '#03a9f4',
      'promotional': '#e91e63',
      'operational': '#607d8b',
      'other': '#9e9e9e'
    };
    return colors[category] || colors.other;
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'cancellation': 'cancel',
      'no_show': 'person_off',
      'modification': 'edit',
      'discount': 'local_offer',
      'comp': 'card_giftcard',
      'refund': 'account_balance_wallet',
      'upgrade': 'upgrade',
      'downgrade': 'downgrade',
      'early_checkout': 'logout',
      'late_checkout': 'schedule',
      'damage': 'broken_image',
      'complaint': 'report_problem',
      'maintenance': 'build',
      'overbooking': 'people',
      'group_booking': 'groups',
      'vip': 'star',
      'loyalty': 'loyalty',
      'package': 'inventory',
      'seasonal': 'wb_sunny',
      'promotional': 'campaign',
      'operational': 'settings',
      'other': 'help_outline'
    };
    return icons[category] || icons.other;
  }

  formatCategoryName(category: string): string {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getPriorityColor(priority: string): 'success' | 'info' | 'warning' | 'error' {
    const colors: { [key: string]: 'success' | 'info' | 'warning' | 'error' } = {
      'low': 'success',
      'medium': 'info',
      'high': 'warning',
      'urgent': 'error'
    };
    return colors[priority] || 'info';
  }

  isFinanciallyImpactful(reason: Reason): boolean {
    return reason.hasFinancialImpact || 
           reason.allowsRefund || 
           reason.allowsDiscount || 
           reason.allowsComp;
  }

  getFinancialImpactLevel(reason: Reason): 'none' | 'low' | 'medium' | 'high' {
    if (!this.isFinanciallyImpactful(reason)) return 'none';
    
    if (reason.maxRefundPercentage >= 75 || reason.maxDiscountPercentage >= 50) {
      return 'high';
    }
    
    if (reason.maxRefundPercentage >= 25 || reason.maxDiscountPercentage >= 25) {
      return 'medium';
    }
    
    return 'low';
  }
}

export const reasonService = new ReasonService();
export default reasonService;