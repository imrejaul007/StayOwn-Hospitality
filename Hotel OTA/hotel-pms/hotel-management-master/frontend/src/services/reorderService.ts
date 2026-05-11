import { api } from './api';
import { ReorderAlert, InventoryItem } from '../types/admin';

export interface ReorderConfiguration {
  autoReorderEnabled: boolean;
  reorderPoint?: number;
  reorderQuantity?: number;
  preferredSupplier?: {
    name?: string;
    contact?: string;
    email?: string;
    leadTime?: number;
  };
}

export interface ReorderRequest {
  action: 'approve' | 'reject';
  quantity?: number;
  supplier?: string;
  actualCost?: number;
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface ReorderStats {
  activeAlerts: number;
  totalItemsWithReorder: number;
  itemsNeedingReorder: number;
  statsByPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  alertStats: Array<{
    _id: string;
    count: number;
    averageUrgency: number;
  }>;
  recentHistory: Array<{
    itemId: string;
    itemName: string;
    itemCategory: string;
    date: string;
    quantity: number;
    supplier: string;
    status: string;
    estimatedCost?: number;
    actualCost?: number;
  }>;
  lastCheck: string;
}

export interface BulkConfiguration {
  items: Array<{
    itemId: string;
    autoReorderEnabled: boolean;
    reorderPoint?: number;
    reorderQuantity?: number;
    preferredSupplier?: {
      name?: string;
      contact?: string;
      email?: string;
      leadTime?: number;
    };
  }>;
}

class ReorderService {
  private baseURL = '/api/v1/reorder';

  /**
   * Get all reorder alerts for the current hotel
   */
  async getAlerts(filters?: {
    status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    alertType?: 'low_stock' | 'critical_stock' | 'reorder_needed';
  }): Promise<{
    alerts: ReorderAlert[];
    summary: {
      total: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
    };
  }> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.alertType) params.append('alertType', filters.alertType);

      const response = await api.get(`${this.baseURL}/alerts?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Configure reorder settings for an inventory item
   */
  async configureReorder(itemId: string, configuration: ReorderConfiguration): Promise<{
    item: {
      _id: string;
      name: string;
      reorderSettings: ReorderConfiguration;
    };
  }> {
    try {
      const response = await api.post(`${this.baseURL}/configure/${itemId}`, configuration);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Manually trigger reorder point check
   */
  async triggerCheck(): Promise<{
    summary: {
      hotelsChecked: number;
      totalItemsChecked: number;
      totalAlertsCreated: number;
      totalNotificationsSent: number;
      checkTime: string;
    };
  }> {
    try {
      const response = await api.post(`${this.baseURL}/check`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process a reorder request (approve or reject)
   */
  async processReorderRequest(alertId: string, request: ReorderRequest): Promise<{
    action: string;
    alertId: string;
  }> {
    try {
      const response = await api.post(`${this.baseURL}/approve/${alertId}`, request);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Acknowledge a reorder alert
   */
  async acknowledgeAlert(alertId: string, notes?: string): Promise<{
    alert: ReorderAlert;
  }> {
    try {
      const response = await api.post(`${this.baseURL}/acknowledge/${alertId}`, { notes });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Dismiss a reorder alert
   */
  async dismissAlert(alertId: string, reason?: string): Promise<{
    alert: ReorderAlert;
  }> {
    try {
      const response = await api.post(`${this.baseURL}/dismiss/${alertId}`, { reason });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get reorder history
   */
  async getHistory(filters?: {
    itemId?: string;
    status?: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled' | 'rejected';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    history: Array<{
      itemId: string;
      itemName: string;
      itemCategory: string;
      date: string;
      quantity: number;
      supplier: string;
      status: string;
      estimatedCost?: number;
      actualCost?: number;
      approvedBy?: string;
      orderDate?: string;
      expectedDeliveryDate?: string;
      actualDeliveryDate?: string;
      notes?: string;
    }>;
    total: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (filters?.itemId) params.append('itemId', filters.itemId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await api.get(`${this.baseURL}/history?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get comprehensive reorder statistics
   */
  async getStats(): Promise<{ stats: ReorderStats }> {
    try {
      const response = await api.get(`${this.baseURL}/stats`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get items that currently need reordering
   */
  async getItemsNeedingReorder(): Promise<{
    items: InventoryItem[];
    total: number;
  }> {
    try {
      const response = await api.get(`${this.baseURL}/items-needing-reorder`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk configure reorder settings for multiple items
   */
  async bulkConfigure(configuration: BulkConfiguration): Promise<{
    success: Array<{ itemId: string; itemName: string }>;
    failed: Array<{ itemId: string; error: string }>;
  }> {
    try {
      const response = await api.post(`${this.baseURL}/bulk-configure`, configuration);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get alert priority color for UI display
   */
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Get status color for UI display
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Get urgency level display text
   */
  getUrgencyText(urgencyScore: number): string {
    if (urgencyScore >= 90) return 'Critical';
    if (urgencyScore >= 70) return 'High';
    if (urgencyScore >= 40) return 'Medium';
    return 'Low';
  }

  /**
   * Calculate estimated delivery date based on lead time
   */
  calculateExpectedDelivery(leadTimeDays: number): Date {
    const today = new Date();
    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + leadTimeDays);
    return deliveryDate;
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Format relative time for display
   */
  formatRelativeTime(date: string): string {
    const now = new Date();
    const targetDate = new Date(date);
    const diffInHours = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} months ago`;
  }
}

export const reorderService = new ReorderService();
export default reorderService;