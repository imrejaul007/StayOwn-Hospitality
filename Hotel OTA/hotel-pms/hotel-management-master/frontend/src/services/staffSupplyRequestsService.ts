import axios from 'axios';

import { API_CONFIG } from '../config/api';
import { api } from './api';

const API_BASE_URL = API_CONFIG.BASE_URL;

export interface SupplyRequestItem {
  name: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  actualCost?: number;
  supplier?: string;
  isReceived?: boolean;
  receivedQuantity?: number;
  condition?: 'excellent' | 'good' | 'damaged' | 'defective';
  invoiceNumber?: string;
  receivedBy?: string;
  receivedAt?: string;
}

export interface SupplyRequest {
  _id: string;
  requestNumber: string;
  title: string;
  description?: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'partial_received' | 'received' | 'cancelled';
  items: SupplyRequestItem[];
  totalEstimatedCost: number;
  totalActualCost: number;
  neededBy: string;
  justification?: string;
  isRecurring?: boolean;
  recurringSchedule?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  requestedBy: {
    _id: string;
    name: string;
    email: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
  };
  approvedAt?: string;
  rejectedReason?: string;
  hotelId: string;
}

export interface CreateSupplyRequestData {
  title: string;
  description?: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  items: Omit<SupplyRequestItem, 'isReceived' | 'receivedQuantity' | 'condition' | 'actualCost' | 'receivedBy' | 'receivedAt'>[];
  neededBy: string;
  justification?: string;
  isRecurring?: boolean;
  recurringSchedule?: Record<string, unknown>;
}

export interface UpdateSupplyRequestData {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  items?: Omit<SupplyRequestItem, 'isReceived' | 'receivedQuantity' | 'condition' | 'actualCost' | 'receivedBy' | 'receivedAt'>[];
  neededBy?: string;
  justification?: string;
  notes?: string;
}

export interface StaffSupplyRequestFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  department?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  overdue?: boolean;
}

export interface SupplyRequestStatsFilters {
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DepartmentBudget {
  department: string;
  monthlyAllocation: number;
  quarterlyAllocation: number;
  yearlyAllocation: number;
  currentSpent: number;
  pendingCommitments: number;
  remainingBudget: number;
  utilizationPercentage: number;
  lastUpdated: string;
}

export interface BudgetAlert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  threshold: number;
  currentUtilization: number;
}

// Request Templates and Categories
export interface RequestTemplate {
  _id: string;
  name: string;
  description: string;
  department: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency';
  items: SupplyRequestItem[];
  estimatedBudget: number;
  isActive: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface RequestCategory {
  _id: string;
  name: string;
  description: string;
  department: string;
  color: string;
  icon: string;
  templates: RequestTemplate[];
  isActive: boolean;
}

export interface Vendor {
  _id: string;
  name: string;
  category: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  rating: number;
  isPreferred: boolean;
  paymentTerms: string;
  deliveryTime: string;
  minOrderValue: number;
  specializations: string[];
  lastOrderDate?: string;
  totalOrderValue: number;
}

export interface VendorStats {
  totalVendors: number;
  preferredVendors: number;
  averageRating: number;
  topCategories: string[];
}

export interface StaffSupplyRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  ordered: number;
  received: number;
  cancelled: number;
  totalValue: number;
  recentRequests: SupplyRequest[];
  budget?: DepartmentBudget;
  budgetAlerts?: BudgetAlert[];
}

class StaffSupplyRequestsService {
  private readonly validItemCategories = new Set([
    'cleaning',
    'toiletries',
    'linens',
    'food',
    'beverage',
    'office',
    'maintenance',
    'technology',
    'furniture',
    'other',
  ]);

  private normalizeItemCategory(category: string | undefined): string {
    const raw = String(category || '').trim().toLowerCase();
    if (!raw) return 'other';
    if (this.validItemCategories.has(raw)) return raw;

    const aliasMap: Record<string, string> = {
      consumables: 'toiletries',
      ingredients: 'food',
      kitchen: 'food',
      stationery: 'office',
      stationary: 'office',
      safety: 'maintenance',
      electronics: 'technology',
      devices: 'technology',
      equipment: 'maintenance',
    };

    return aliasMap[raw] || 'other';
  }

  private clampLimit(limit: number): number {
    return Math.min(100, Math.max(1, limit));
  }

  private getCookieValue(name: string): string | null {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const parts = document.cookie.split(';');
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=');
      if (k === name) {
        const raw = rest.join('=');
        if (!raw) return null;
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
    }
    return null;
  }

  private getAuthHeaders() {
    const csrfToken = this.getCookieValue('csrfToken');
    return {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    };
  }

  private getRequestConfig() {
    return {
      withCredentials: true,
      headers: this.getAuthHeaders(),
    };
  }

  async getMyRequests(filters: StaffSupplyRequestFilters = {}) {
    try {
      const params = new URLSearchParams();
      const normalizedFilters = { ...filters };

      if (normalizedFilters.limit !== undefined) {
        normalizedFilters.limit = this.clampLimit(normalizedFilters.limit);
      }

      // Add filters to params
      Object.entries(normalizedFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await axios.get(
        `${API_BASE_URL}/supply-requests?${params.toString()}`,
        this.getRequestConfig()
      );

      return {
        success: true,
        data: {
          requests: response.data.data.requests || [],
          pagination: response.data.data.pagination || { total: 0, pages: 0, page: 1, limit: 20 }
        }
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch supply requests');
    }
  }

  async getMyStats(filters: SupplyRequestStatsFilters = {}) {
    try {
      const params = new URLSearchParams();
      const startDate = filters.startDate || filters.dateFrom;
      const endDate = filters.endDate || filters.dateTo;

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const queryString = params.toString();
      const response = await axios.get(
        `${API_BASE_URL}/supply-requests/stats${queryString ? `?${queryString}` : ''}`,
        this.getRequestConfig()
      );

      return {
        success: true,
        data: response.data.data
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch stats');
    }
  }

  async createRequest(requestData: CreateSupplyRequestData) {
    try {
      const normalizedPayload: CreateSupplyRequestData = {
        ...requestData,
        items: (requestData.items || []).map((item) => ({
          ...item,
          category: this.normalizeItemCategory(item.category),
        })),
      };
      const response = await api.post('/supply-requests', normalizedPayload);

      return {
        success: true,
        data: response.data.data.supplyRequest,
        message: 'Supply request created successfully'
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to create supply request');
    }
  }

  async getRequestDetails(requestId: string) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/supply-requests/${requestId}`,
        this.getRequestConfig()
      );

      return {
        success: true,
        data: response.data.data.supplyRequest
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch request details');
    }
  }

  async updateRequest(requestId: string, updateData: UpdateSupplyRequestData) {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/supply-requests/${requestId}`,
        updateData,
        this.getRequestConfig()
      );

      return {
        success: true,
        data: response.data.data.supplyRequest,
        message: 'Supply request updated successfully'
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update supply request');
    }
  }

  async cancelRequest(requestId: string, reason?: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/supply-requests/${requestId}/cancel`,
        { reason: reason || 'Cancelled by staff member' },
        this.getRequestConfig()
      );

      return {
        success: true,
        data: response.data.data.supplyRequest,
        message: 'Supply request cancelled successfully'
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to cancel supply request');
    }
  }

  async uploadAttachment(requestId: string, file: File, description?: string) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (description) {
        formData.append('description', description);
      }

      const response = await axios.post(
        `${API_BASE_URL}/supply-requests/${requestId}/attachments`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(this.getCookieValue('csrfToken') ? { 'X-CSRF-Token': this.getCookieValue('csrfToken') as string } : {}),
          }
        }
      );

      return {
        success: true,
        data: response.data.data,
        message: 'Attachment uploaded successfully'
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to upload attachment');
    }
  }

  async getOverdueRequests() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/supply-requests/overdue`,
        this.getRequestConfig()
      );

      return {
        success: true,
        data: {
          requests: response.data.data.requests || [],
          count: response.data.data.pagination?.total ?? response.data.data.count ?? 0,
          pagination: response.data.data.pagination
        }
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch overdue requests');
    }
  }

  async getRecentRequests(limit: number = 5) {
    try {
      const safeLimit = this.clampLimit(limit);
      const response = await this.getMyRequests({
        limit: safeLimit,
        page: 1
      });

      return {
        success: true,
        data: response.data.requests.slice(0, safeLimit)
      };
    } catch (error: unknown) {
      throw new Error('Failed to fetch recent requests');
    }
  }

  async getDepartmentRequests(department: string, limit: number = 10) {
    try {
      const safeLimit = this.clampLimit(limit);
      const response = await this.getMyRequests({
        department,
        limit: safeLimit,
        page: 1
      });

      return {
        success: true,
        data: response.data.requests
      };
    } catch (error: unknown) {
      throw new Error('Failed to fetch department requests');
    }
  }

  // Helper method to get user's department
  private getUserDepartment(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.department || 'housekeeping';
  }

  // Budget Management Methods
  async getDepartmentBudget(department?: string) {
    try {
      // Get user's department if not provided
      const targetDepartment = department || this.getUserDepartment();

      const response = await axios.get(
        `${API_BASE_URL}/department-budget/${targetDepartment}`,
        this.getRequestConfig()
      );

      // Transform backend data to frontend interface
      const budgetData = response.data.data;
      const transformedBudget: DepartmentBudget = {
        department: budgetData.department,
        monthlyAllocation: budgetData.allocations.supply_requests,
        quarterlyAllocation: budgetData.allocations.supply_requests * 3,
        yearlyAllocation: budgetData.allocations.supply_requests * 12,
        currentSpent: budgetData.spent.supply_requests,
        pendingCommitments: budgetData.commitments.pending_approvals,
        remainingBudget: budgetData.availableBudget,
        utilizationPercentage: budgetData.utilizationPercentage,
        lastUpdated: budgetData.updatedAt || new Date().toISOString()
      };

      return {
        success: true,
        data: transformedBudget
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch department budget');
    }
  }

  async getBudgetAlerts() {
    try {
      const budget = await this.getDepartmentBudget();
      const alerts: BudgetAlert[] = [];

      if (budget.data.utilizationPercentage > 90) {
        alerts.push({
          type: 'critical',
          message: 'Budget utilization critical - Over 90% spent',
          threshold: 90,
          currentUtilization: budget.data.utilizationPercentage
        });
      } else if (budget.data.utilizationPercentage > 75) {
        alerts.push({
          type: 'warning',
          message: 'Budget utilization high - Over 75% spent',
          threshold: 75,
          currentUtilization: budget.data.utilizationPercentage
        });
      }

      if (budget.data.remainingBudget < 5000) {
        alerts.push({
          type: 'warning',
          message: `Low remaining budget: ${this.formatCurrency(budget.data.remainingBudget)}`,
          threshold: 5000,
          currentUtilization: budget.data.utilizationPercentage
        });
      }

      return {
        success: true,
        data: alerts
      };
    } catch (error: unknown) {
      return {
        success: true,
        data: []
      };
    }
  }

  async checkBudgetAvailability(requestAmount: number) {
    try {
      const budget = await this.getDepartmentBudget();
      const available = budget.data.remainingBudget;
      const wouldExceed = (requestAmount > available);

      return {
        success: true,
        data: {
          available,
          requestAmount,
          wouldExceed,
          utilizationAfter: ((budget.data.currentSpent + budget.data.pendingCommitments + requestAmount) / budget.data.monthlyAllocation) * 100
        }
      };
    } catch (error: unknown) {
      return {
        success: false,
        data: null
      };
    }
  }

  // Vendor Management Methods
  async getVendors(category?: string) {
    try {
      const params = new URLSearchParams();
      if (category) {
        params.append('category', category);
      }

      const response = await axios.get(
        `${API_BASE_URL}/vendors${params.toString() ? '?' + params.toString() : ''}`,
        this.getRequestConfig()
      );

      // Transform backend vendor data to frontend interface
      const vendorsData = response.data.data.vendors || response.data.data || [];
      const transformedVendors: Vendor[] = vendorsData.map((vendor: Record<string, unknown>) => ({
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
        contactPerson: vendor.contactPerson,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address?.fullAddress ||
                [vendor.address?.street, vendor.address?.city, vendor.address?.state, vendor.address?.country]
                .filter(Boolean).join(', ') || 'Address not available',
        rating: vendor.rating || vendor.performance?.qualityRating || 0,
        isPreferred: vendor.isPreferred || false,
        paymentTerms: vendor.paymentTerms || 'Net 30',
        deliveryTime: vendor.deliveryTime || '3-5 days',
        minOrderValue: vendor.minOrderValue || 0,
        specializations: vendor.specializations || [vendor.category],
        lastOrderDate: vendor.lastOrderDate,
        totalOrderValue: vendor.totalOrderValue || 0
      }));

      return {
        success: true,
        data: transformedVendors
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch vendors');
    }
  }

  async getPreferredVendors() {
    try {
      const vendors = await this.getVendors();
      return {
        success: true,
        data: vendors.data.filter((v: Vendor) => v.isPreferred)
      };
    } catch (error: unknown) {
      return {
        success: false,
        data: []
      };
    }
  }

  async getVendorsByCategory(category: string) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/vendors/by-category/${category}`,
        this.getRequestConfig()
      );

      // Transform backend vendor data to frontend interface
      const vendorsData = response.data.data || [];
      const transformedVendors: Vendor[] = vendorsData.map((vendor: Record<string, unknown>) => ({
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
        contactPerson: vendor.contactPerson,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address?.fullAddress ||
                [vendor.address?.street, vendor.address?.city, vendor.address?.state, vendor.address?.country]
                .filter(Boolean).join(', ') || 'Address not available',
        rating: vendor.rating || vendor.performance?.qualityRating || 0,
        isPreferred: vendor.isPreferred || false,
        paymentTerms: vendor.paymentTerms || 'Net 30',
        deliveryTime: vendor.deliveryTime || '3-5 days',
        minOrderValue: vendor.minOrderValue || 0,
        specializations: vendor.specializations || [vendor.category],
        lastOrderDate: vendor.lastOrderDate,
        totalOrderValue: vendor.totalOrderValue || 0
      }));

      return {
        success: true,
        data: transformedVendors
      };
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch vendors by category');
    }
  }

  // Utility methods for validation
  validateRequestData(data: CreateSupplyRequestData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.title || data.title.trim().length < 3) {
      errors.push('Title must be at least 3 characters long');
    }

    if (!data.department) {
      errors.push('Department is required');
    }

    if (!data.neededBy) {
      errors.push('Needed by date is required');
    } else {
      const neededByDate = new Date(data.neededBy);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (neededByDate < today) {
        errors.push('Needed by date cannot be in the past');
      }
    }

    if (!data.items || data.items.length === 0) {
      errors.push('At least one item is required');
    } else {
      data.items.forEach((item, index) => {
        if (!item.name || item.name.trim().length < 2) {
          errors.push(`Item ${index + 1}: Name must be at least 2 characters long`);
        }
        if (!item.category) {
          errors.push(`Item ${index + 1}: Category is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        if (!item.estimatedCost || item.estimatedCost <= 0) {
          errors.push(`Item ${index + 1}: Estimated cost must be greater than 0`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Calculate totals
  calculateTotalCost(items: SupplyRequestItem[]): number {
    return items.reduce((total, item) => {
      return total + (item.estimatedCost * item.quantity);
    }, 0);
  }

  // Format department name for display
  formatDepartmentName(department: string): string {
    return department
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Format currency for display
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Get priority color class
  getPriorityColorClass(priority: string): string {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
      emergency: 'bg-red-200 text-red-900'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  }

  // Get status color class
  getStatusColorClass(status: string): string {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      ordered: 'bg-purple-100 text-purple-800',
      partial_received: 'bg-orange-100 text-orange-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  // Check if request is overdue
  isOverdue(neededBy: string, status: string): boolean {
    const neededByDate = new Date(neededBy);
    const today = new Date();
    return neededByDate < today && !['received', 'cancelled'].includes(status);
  }

  // Check if request can be edited
  canEdit(request: SupplyRequest, currentUserId: string): boolean {
    return request.status === 'pending' &&
           request.requestedBy._id === currentUserId;
  }

  // Check if request can be cancelled
  canCancel(request: SupplyRequest, currentUserId: string): boolean {
    return request.status === 'pending' &&
           request.requestedBy._id === currentUserId;
  }

  // Template and Category Management
  async getRequestTemplates(department?: string) {
    // Fallback mock templates used when the backend endpoint is unavailable
    const mockTemplates: RequestTemplate[] = [
        {
          _id: 'template_1',
          name: 'Room Cleaning Supplies',
          description: 'Standard supplies for daily room cleaning',
          department: 'housekeeping',
          category: 'cleaning',
          priority: 'medium',
          estimatedBudget: 2500,
          isActive: true,
          useCount: 45,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['daily', 'cleaning', 'rooms'],
          items: [
            {
              name: 'All-purpose cleaner',
              category: 'cleaning',
              quantity: 6,
              unit: 'bottles',
              estimatedCost: 120,
              supplier: 'CleanPro Supplies'
            },
            {
              name: 'Toilet paper rolls',
              category: 'consumables',
              quantity: 50,
              unit: 'rolls',
              estimatedCost: 1200,
              supplier: 'Hotel Essentials Ltd'
            },
            {
              name: 'Towels (bath)',
              category: 'linens',
              quantity: 20,
              unit: 'pieces',
              estimatedCost: 800,
              supplier: 'Hotel Essentials Ltd'
            },
            {
              name: 'Vacuum cleaner bags',
              category: 'cleaning',
              quantity: 10,
              unit: 'boxes',
              estimatedCost: 400,
              supplier: 'Maintenance Masters'
            }
          ]
        },
        {
          _id: 'template_2',
          name: 'Kitchen Essentials',
          description: 'Essential items for kitchen operations',
          department: 'food_beverage',
          category: 'kitchen',
          priority: 'high',
          estimatedBudget: 4500,
          isActive: true,
          useCount: 32,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['kitchen', 'food', 'essentials'],
          items: [
            {
              name: 'Disposable gloves',
              category: 'safety',
              quantity: 20,
              unit: 'boxes',
              estimatedCost: 800,
              supplier: 'Hotel Essentials Ltd'
            },
            {
              name: 'Cooking oil',
              category: 'ingredients',
              quantity: 10,
              unit: 'bottles',
              estimatedCost: 1500,
              supplier: 'Kitchen Supplies Co'
            },
            {
              name: 'Paper napkins',
              category: 'consumables',
              quantity: 100,
              unit: 'packs',
              estimatedCost: 1200,
              supplier: 'Hotel Essentials Ltd'
            },
            {
              name: 'Sanitizer spray',
              category: 'cleaning',
              quantity: 8,
              unit: 'bottles',
              estimatedCost: 480,
              supplier: 'CleanPro Supplies'
            }
          ]
        },
        {
          _id: 'template_3',
          name: 'Office Supplies',
          description: 'Basic office supplies for front desk',
          department: 'front_desk',
          category: 'office',
          priority: 'low',
          estimatedBudget: 1800,
          isActive: true,
          useCount: 28,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['office', 'stationery', 'desk'],
          items: [
            {
              name: 'Printer paper',
              category: 'stationery',
              quantity: 5,
              unit: 'reams',
              estimatedCost: 750,
              supplier: 'Office Depot'
            },
            {
              name: 'Ink cartridges',
              category: 'electronics',
              quantity: 4,
              unit: 'pieces',
              estimatedCost: 800,
              supplier: 'Office Depot'
            },
            {
              name: 'Sticky notes',
              category: 'stationery',
              quantity: 20,
              unit: 'pads',
              estimatedCost: 200,
              supplier: 'Office Depot'
            }
          ]
        },
        {
          _id: 'template_4',
          name: 'Maintenance Tools',
          description: 'Basic tools for routine maintenance',
          department: 'maintenance',
          category: 'tools',
          priority: 'medium',
          estimatedBudget: 3200,
          isActive: true,
          useCount: 18,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: ['tools', 'maintenance', 'repair'],
          items: [
            {
              name: 'Screwdriver set',
              category: 'tools',
              quantity: 2,
              unit: 'sets',
              estimatedCost: 800,
              supplier: 'Maintenance Masters'
            },
            {
              name: 'Electrical tape',
              category: 'supplies',
              quantity: 10,
              unit: 'rolls',
              estimatedCost: 300,
              supplier: 'Maintenance Masters'
            },
            {
              name: 'Light bulbs (LED)',
              category: 'electrical',
              quantity: 30,
              unit: 'pieces',
              estimatedCost: 1500,
              supplier: 'Electrical Solutions'
            },
            {
              name: 'Lubricant spray',
              category: 'chemicals',
              quantity: 6,
              unit: 'cans',
              estimatedCost: 600,
              supplier: 'Maintenance Masters'
            }
          ]
        }
      ];

    try {
      const params = new URLSearchParams();
      if (department) {
        params.append('department', department);
      }

      const response = await axios.get(
        `${API_BASE_URL}/request-templates?${params.toString()}`,
        this.getRequestConfig()
      );

      // Use the real API response when available
      const apiTemplates: RequestTemplate[] = response.data?.data?.templates || response.data?.data || [];
      if (apiTemplates.length > 0) {
        return { success: true, data: apiTemplates };
      }

      // Fall back to mocks when the backend has no templates configured
      const filteredTemplates = department
        ? mockTemplates.filter(t => t.department === department)
        : mockTemplates;
      return { success: true, data: filteredTemplates };
    } catch {
      // Backend endpoint not yet implemented — return mock templates gracefully
      const filteredTemplates = department
        ? mockTemplates.filter(t => t.department === department)
        : mockTemplates;
      return { success: true, data: filteredTemplates };
    }
  }

  async getRequestCategories(department?: string) {
    try {
      // Mock categories for demo
      const mockCategories: RequestCategory[] = [
        {
          _id: 'cat_1',
          name: 'Cleaning Supplies',
          description: 'All cleaning related items',
          department: 'housekeeping',
          color: 'bg-green-500',
          icon: 'Sparkles',
          isActive: true,
          templates: []
        },
        {
          _id: 'cat_2',
          name: 'Kitchen Essentials',
          description: 'Food and beverage supplies',
          department: 'food_beverage',
          color: 'bg-orange-500',
          icon: 'ChefHat',
          isActive: true,
          templates: []
        },
        {
          _id: 'cat_3',
          name: 'Office Supplies',
          description: 'Stationery and office equipment',
          department: 'front_desk',
          color: 'bg-blue-500',
          icon: 'FileText',
          isActive: true,
          templates: []
        },
        {
          _id: 'cat_4',
          name: 'Maintenance Tools',
          description: 'Tools and repair supplies',
          department: 'maintenance',
          color: 'bg-purple-500',
          icon: 'Wrench',
          isActive: true,
          templates: []
        }
      ];

      const filteredCategories = department
        ? mockCategories.filter(c => c.department === department)
        : mockCategories;

      return {
        success: true,
        data: filteredCategories
      };
    } catch (error: unknown) {
      throw new Error('Failed to fetch request categories');
    }
  }

  async createRequestFromTemplate(templateId: string, modifications?: Partial<CreateSupplyRequestData>) {
    try {
      const templatesResponse = await this.getRequestTemplates();
      const template = templatesResponse.data.find(t => t._id === templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      const requestData: CreateSupplyRequestData = {
        title: modifications?.title || template.name,
        description: modifications?.description || template.description,
        department: modifications?.department || template.department,
        priority: modifications?.priority || template.priority,
        neededBy: modifications?.neededBy || '',
        justification: modifications?.justification || `Created from template: ${template.name}`,
        items: modifications?.items || template.items
      };

      return await this.createRequest(requestData);
    } catch (error: unknown) {
      throw new Error('Failed to create request from template');
    }
  }

  // Cost Optimization Features
  async getCostOptimizationSuggestions(items: SupplyRequestItem[]) {
    try {
      // Mock cost optimization suggestions
      const suggestions = [];
      let totalSavings = 0;

      // Bulk discount suggestions
      const quantityThresholds = { 10: 0.05, 25: 0.10, 50: 0.15 };
      for (const item of items) {
        for (const [threshold, discount] of Object.entries(quantityThresholds)) {
          if (item.quantity >= parseInt(threshold)) {
            const savings = item.estimatedCost * item.quantity * discount;
            totalSavings += savings;
            suggestions.push({
              type: 'bulk_discount',
              item: item.name,
              message: `${(discount * 100).toFixed(0)}% bulk discount available for ${item.name}`,
              savings: savings,
              action: `Order ${threshold}+ units for discount`
            });
            break;
          }
        }
      }

      // Alternative vendor suggestions
      const vendorsResponse = await this.getVendors();
      const vendors = vendorsResponse.data;

      items.forEach(item => {
        const alternativeVendors = vendors.filter(v =>
          v.category.toLowerCase().includes(item.category.toLowerCase()) &&
          v.name !== item.supplier
        );

        if (alternativeVendors.length > 0) {
          const potentialSavings = item.estimatedCost * item.quantity * 0.12; // Mock 12% savings
          totalSavings += potentialSavings;
          suggestions.push({
            type: 'vendor_alternative',
            item: item.name,
            message: `Consider ${alternativeVendors[0].name} for potentially lower prices`,
            savings: potentialSavings,
            action: 'Compare vendor quotes'
          });
        }
      });

      // Bundle suggestions
      const itemCategories = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, SupplyRequestItem[]>);

      Object.entries(itemCategories).forEach(([category, categoryItems]) => {
        if (categoryItems.length >= 3) {
          const bundleSavings = categoryItems.reduce((sum, item) =>
            sum + (item.estimatedCost * item.quantity * 0.08), 0); // Mock 8% bundle savings
          totalSavings += bundleSavings;
          suggestions.push({
            type: 'bundle_discount',
            item: `${category} items`,
            message: `Bundle ${categoryItems.length} ${category} items for package discount`,
            savings: bundleSavings,
            action: 'Request bundle pricing'
          });
        }
      });

      // Seasonal recommendations
      const currentMonth = new Date().getMonth();
      if ([11, 0, 1].includes(currentMonth)) { // Winter months
        suggestions.push({
          type: 'seasonal',
          item: 'Heating supplies',
          message: 'Winter season - consider stocking heating supplies early',
          savings: 0,
          action: 'Plan ahead for seasonal needs'
        });
      }

      return {
        success: true,
        data: {
          suggestions,
          totalPotentialSavings: totalSavings,
          optimizationScore: Math.min(95, 60 + (suggestions.length * 8))
        }
      };
    } catch (error: unknown) {
      throw new Error('Failed to get optimization suggestions');
    }
  }

  async getVendorComparison(itemName: string, category: string) {
    try {
      // Mock vendor comparison data
      const vendors = [
        {
          name: 'CleanPro Supplies',
          price: 45.00,
          rating: 4.5,
          deliveryTime: '2-3 days',
          bulkDiscount: '10% off 25+ units',
          minimumOrder: 100
        },
        {
          name: 'Hotel Essentials Ltd',
          price: 52.00,
          rating: 4.8,
          deliveryTime: '1-2 days',
          bulkDiscount: '15% off 50+ units',
          minimumOrder: 50
        },
        {
          name: 'Budget Supplies Co',
          price: 38.00,
          rating: 4.1,
          deliveryTime: '5-7 days',
          bulkDiscount: '5% off 20+ units',
          minimumOrder: 200
        }
      ];

      return {
        success: true,
        data: {
          item: itemName,
          category,
          vendors: vendors.sort((a, b) => a.price - b.price),
          recommendations: {
            bestPrice: vendors[2],
            bestRating: vendors[1],
            fastestDelivery: vendors[1]
          }
        }
      };
    } catch (error: unknown) {
      throw new Error('Failed to get vendor comparison');
    }
  }

  async getBulkOrderingSuggestions() {
    try {
      // Mock bulk ordering suggestions based on historical data
      const suggestions = [
        {
          category: 'cleaning',
          items: ['All-purpose cleaner', 'Toilet paper', 'Hand sanitizer'],
          recommendedQuantity: 100,
          currentPrice: 2400,
          bulkPrice: 2040,
          savings: 360,
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          supplier: 'CleanPro Supplies'
        },
        {
          category: 'linens',
          items: ['Bath towels', 'Bed sheets', 'Pillowcases'],
          recommendedQuantity: 50,
          currentPrice: 1800,
          bulkPrice: 1530,
          savings: 270,
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          supplier: 'Hotel Essentials Ltd'
        }
      ];

      return {
        success: true,
        data: suggestions.map(s => ({
          ...s,
          savingsPercentage: ((s.savings / s.currentPrice) * 100).toFixed(1)
        }))
      };
    } catch (error: unknown) {
      throw new Error('Failed to get bulk ordering suggestions');
    }
  }
}

export const staffSupplyRequestsService = new StaffSupplyRequestsService();
export default staffSupplyRequestsService;