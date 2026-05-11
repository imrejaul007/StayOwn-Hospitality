import { ApiResponse } from '../types/api';
import { API_CONFIG } from '../config/api';
import { api, normalizeListParams } from './api';

export interface SupplyRequestItem {
  name: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  actualCost?: number;
  supplier?: string;
  brand?: string;
  model?: string;
  specifications?: string;
  isReceived: boolean;
  receivedQuantity: number;
  receivedDate?: string;
  receivedBy?: { _id: string; name: string };
  condition?: 'excellent' | 'good' | 'damaged' | 'defective';
  invoiceNumber?: string;
  warrantyPeriod?: string;
  expiryDate?: string;
}

export interface SupplyRequest {
  _id: string;
  requestNumber: string;
  requestedBy: { _id: string; name: string; email: string; department: string };
  department: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'partial_received' | 'received' | 'cancelled';
  items: SupplyRequestItem[];
  totalEstimatedCost: number;
  totalActualCost: number;
  approvedBy?: { _id: string; name: string };
  approvedAt?: string;
  rejectedReason?: string;
  neededBy: string;
  orderedDate?: string;
  expectedDelivery?: string;
  actualDelivery?: string;
  supplier?: {
    name: string;
    contact: string;
    email: string;
    phone: string;
    address?: string;
  };
  purchaseOrder?: {
    number: string;
    date: string;
    url?: string;
    totalAmount: number;
  };
  delivery?: {
    method: 'pickup' | 'standard' | 'express' | 'same_day' | 'scheduled';
    address?: string;
    instructions?: string;
    trackingNumber?: string;
    carrier?: string;
  };
  budget?: {
    allocated: number;
    remaining: number;
    exceeded: boolean;
  };
  justification?: string;
  notes?: string;
  internalNotes?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: 'quote' | 'specification' | 'image' | 'invoice' | 'receipt' | 'other';
    uploadedBy: { _id: string; name: string };
    uploadedAt: string;
  }>;
  isRecurring: boolean;
  recurringSchedule?: {
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    interval: number;
    nextRequest?: string;
    endDate?: string;
  };
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  // Virtual properties
  isOverdue?: boolean;
  daysUntilNeeded?: number;
  completionPercentage?: number;
}

export interface SupplyRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  ordered: number;
  partialReceived: number;
  received: number;
  cancelled: number;
  totalValue: number;
  overdue: number;
  budgetUtilization: {
    allocated: number;
    spent: number;
    remaining: number;
    utilization: number;
  };
  topCategories: Array<{
    category: string;
    count: number;
    totalCost: number;
  }>;
}

export interface SupplyRequestFilters {
  status?: string;
  department?: string;
  priority?: string;
  requestedBy?: string;
  category?: string;
  approvedBy?: string;
  overdue?: boolean;
  dateFrom?: string;
  dateTo?: string;
  minCost?: number;
  maxCost?: number;
  hotelId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProcessRequestData {
  action: 'approve' | 'reject';
  notes?: string;
  rejectedReason?: string;
  budgetAllocation?: number;
}

export interface OrderRequestData {
  supplier: {
    name: string;
    contact: string;
    email: string;
    phone: string;
    address?: string;
  };
  purchaseOrder: {
    number: string;
    date: string;
    totalAmount: number;
  };
  expectedDelivery?: string;
  delivery?: {
    method: 'pickup' | 'standard' | 'express' | 'same_day' | 'scheduled';
    address?: string;
    instructions?: string;
  };
}

class AdminSupplyRequestsService {
  private basePath = '/supply-requests';

  private async apiRequest<T>(endpoint: string, options: { method?: string; data?: Record<string, unknown>; basePath?: string } = {}): Promise<ApiResponse<T>> {
    try {
      // Properly handle basePath - empty string should override the default
      const basePath = options.basePath !== undefined ? options.basePath : this.basePath;
      const url = `${basePath}${endpoint}`;

      let response;
      const method = (options.method || 'GET').toUpperCase();

      switch (method) {
        case 'POST':
          response = await api.post(url, options.data);
          break;
        case 'PUT':
          response = await api.put(url, options.data);
          break;
        case 'PATCH':
          response = await api.patch(url, options.data);
          break;
        case 'DELETE':
          response = await api.delete(url);
          break;
        default:
          response = await api.get(url);
          break;
      }

      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getRequests(filters: SupplyRequestFilters = {}): Promise<ApiResponse<{ requests: SupplyRequest[]; pagination: { page: number; limit: number; total: number; pages: number } }>> {
    const queryParams = new URLSearchParams();
    const normalizedFilters = normalizeListParams(filters);

    Object.entries(normalizedFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'dateFrom') {
          queryParams.append('startDate', value.toString());
          return;
        }
        if (key === 'dateTo') {
          queryParams.append('endDate', value.toString());
          return;
        }
        if (key === 'sortBy' || key === 'sortOrder') {
          return;
        }
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const endpoint = queryString ? `?${queryString}` : '';

    return this.apiRequest(endpoint);
  }

  async getRequestById(requestId: string): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}`);
  }

  async processRequest(requestId: string, processData: ProcessRequestData): Promise<ApiResponse<SupplyRequest>> {
    const endpoint = processData.action === 'approve' ? '/approve' : '/reject';
    return this.apiRequest(`/${requestId}${endpoint}`, {
      method: 'POST',
      data: processData,
    });
  }

  async approveRequest(requestId: string, notes?: string, budgetAllocation?: number): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}/approve`, {
      method: 'POST',
      data: { notes, budgetAllocation },
    });
  }

  async rejectRequest(requestId: string, reason: string, notes?: string): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}/reject`, {
      method: 'POST',
      data: { reason, notes },
    });
  }

  async orderRequest(requestId: string, orderData: OrderRequestData): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}/order`, {
      method: 'POST',
      data: orderData,
    });
  }

  async receiveItem(requestId: string, itemIndex: number, receivedData: {
    receivedQuantity: number;
    condition?: 'excellent' | 'good' | 'damaged' | 'defective';
    notes?: string;
    actualCost?: number;
    invoiceNumber?: string;
  }): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}/items/${itemIndex}/receive`, {
      method: 'POST',
      data: receivedData,
    });
  }

  async getStats(filters?: { dateFrom?: string; dateTo?: string; department?: string; hotelId?: string }): Promise<ApiResponse<SupplyRequestStats>> {
    const queryParams = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'dateFrom') {
            queryParams.append('startDate', value.toString());
            return;
          }
          if (key === 'dateTo') {
            queryParams.append('endDate', value.toString());
            return;
          }
          queryParams.append(key, value.toString());
        }
      });
    }

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/stats?${queryString}` : '/stats';

    return this.apiRequest(endpoint);
  }

  async getPendingApprovals(): Promise<ApiResponse<{ requests: SupplyRequest[]; count: number }>> {
    return this.apiRequest('/pending-approvals');
  }

  async getOverdueRequests(): Promise<ApiResponse<SupplyRequest[]>> {
    return this.apiRequest('/overdue');
  }

  async getDepartmentStats(hotelId?: string, startDate?: string, endDate?: string): Promise<ApiResponse<unknown>> {
    const queryParams = new URLSearchParams();
    if (hotelId) queryParams.append('hotelId', hotelId);
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/department-stats?${queryString}` : '/department-stats';

    return this.apiRequest(endpoint);
  }

  async getBudgetUtilization(department?: string, period: 'month' | 'quarter' | 'year' = 'month'): Promise<ApiResponse<unknown>> {
    const queryParams = new URLSearchParams();
    if (department) queryParams.append('department', department);
    queryParams.append('period', period);

    return this.apiRequest(`/budget-utilization?${queryParams.toString()}`);
  }

  // Add internal notes to a request
  async addInternalNotes(requestId: string, notes: string): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}/notes`, {
      method: 'POST',
      data: { internalNotes: notes },
    });
  }

  // Update request priority (admin only)
  async updatePriority(requestId: string, priority: string): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}/priority`, {
      method: 'PATCH',
      data: { priority },
    });
  }

  // Cancel request
  async cancelRequest(requestId: string, reason: string): Promise<ApiResponse<SupplyRequest>> {
    return this.apiRequest(`/${requestId}/cancel`, {
      method: 'POST',
      data: { reason },
    });
  }

  // Bulk operations
  async bulkApprove(requestIds: string[], notes?: string): Promise<ApiResponse<{ approved: number; failed: number }>> {
    return this.apiRequest('/bulk/approve', {
      method: 'POST',
      data: { requestIds, notes },
    });
  }

  async bulkReject(requestIds: string[], reason: string): Promise<ApiResponse<{ rejected: number; failed: number }>> {
    return this.apiRequest('/bulk/reject', {
      method: 'POST',
      data: { requestIds, reason },
    });
  }

  // Export requests data for reporting
  async exportRequests(filters?: SupplyRequestFilters, format: 'csv' | 'excel' = 'csv'): Promise<Blob> {
    try {
      const queryParams = new URLSearchParams();

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, value.toString());
          }
        });
      }

      queryParams.append('format', format);

      const response = await api.get(`${this.basePath}/export?${queryParams.toString()}`, {
        responseType: 'blob',
      });

      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Upload attachment to a request
  async uploadAttachment(requestId: string, file: File, type: 'quote' | 'specification' | 'image' | 'invoice' | 'receipt' | 'other'): Promise<ApiResponse<{ url: string; filename: string }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await api.post(`${this.basePath}/${requestId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Delete attachment
  async deleteAttachment(requestId: string, attachmentId: string): Promise<ApiResponse<void>> {
    return this.apiRequest(`/${requestId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }
}

export const adminSupplyRequestsService = new AdminSupplyRequestsService();