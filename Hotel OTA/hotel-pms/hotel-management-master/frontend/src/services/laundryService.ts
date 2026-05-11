import { api } from './api';

export interface LaundryTransaction {
  _id: string;
  hotelId: string;
  roomId: {
    _id: string;
    roomNumber: string;
    type: string;
  };
  itemId: {
    _id: string;
    name: string;
    category: string;
  };
  bookingId?: string;
  transactionType: 'send_to_laundry' | 'return_from_laundry' | 'lost' | 'damaged';
  quantity: number;
  status: 'pending' | 'in_laundry' | 'cleaning' | 'ready' | 'returned' | 'lost' | 'damaged';
  sentDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  cost: number;
  totalCost: number;
  notes?: string;
  specialInstructions?: string;
  processedBy: {
    _id: string;
    name: string;
  };
  returnedBy?: {
    _id: string;
    name: string;
  };
  laundryService?: {
    name?: string;
    contact?: {
      phone?: string;
      email?: string;
    };
    pickupDate?: string;
    deliveryDate?: string;
  };
  qualityCheck?: {
    inspectedBy?: string;
    inspectionDate?: string;
    quality: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
    issues?: string[];
    photos?: string[];
  };
  trackingNumber: string;
  isUrgent: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata: {
    createdBy: {
      _id: string;
      name: string;
    };
    lastModifiedBy?: {
      _id: string;
      name: string;
    };
    source: 'daily_check' | 'checkout_inspection' | 'guest_request' | 'maintenance' | 'manual';
  };
  daysOverdue: number;
  isOverdue: boolean;
  daysInLaundry: number;
  createdAt: string;
  updatedAt: string;
}

export interface LaundryItem {
  itemId: string;
  quantity: number;
  notes?: string;
  specialInstructions?: string;
}

export interface SendToLaundryRequest {
  roomId: string;
  items: LaundryItem[];
  expectedReturnDate: string;
  notes?: string;
  specialInstructions?: string;
  isUrgent?: boolean;
}

export interface LaundryDashboard {
  statusSummary: Array<{
    _id: string;
    count: number;
    totalQuantity: number;
    totalCost: number;
  }>;
  overdueItems: LaundryTransaction[];
  recentTransactions: LaundryTransaction[];
  totalOverdue: number;
  statistics: {
    totalTransactions: number;
    totalCost: number;
    averageProcessingTime: number;
  };
}

export interface LaundryStatistics {
  statusStatistics: Array<{
    _id: string;
    count: number;
    totalQuantity: number;
    totalCost: number;
    averageCost: number;
  }>;
  categoryStatistics: Array<{
    _id: string;
    count: number;
    totalQuantity: number;
    totalCost: number;
  }>;
  dateRange: {
    start?: string;
    end?: string;
  };
}

class LaundryService {
  /**
   * Send items to laundry
   */
  async sendItemsToLaundry(data: SendToLaundryRequest): Promise<{
    success: boolean;
    transactions: LaundryTransaction[];
    totalItems: number;
    totalCost: number;
  }> {
    try {
      const response = await api.post('/laundry/send-items', data);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Mark items as in laundry
   */
  async markItemsAsInLaundry(transactionId: string): Promise<LaundryTransaction> {
    try {
      const response = await api.put(`/laundry/${transactionId}/mark-in-laundry`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Mark items as cleaning
   */
  async markItemsAsCleaning(transactionId: string): Promise<LaundryTransaction> {
    try {
      const response = await api.put(`/laundry/${transactionId}/mark-cleaning`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Mark items as ready for return
   */
  async markItemsAsReady(transactionId: string): Promise<LaundryTransaction> {
    try {
      const response = await api.put(`/laundry/${transactionId}/mark-ready`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Return items from laundry
   */
  async returnItemsFromLaundry(
    transactionId: string,
    quality: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' = 'good',
    issues: string[] = [],
    photos: string[] = []
  ): Promise<LaundryTransaction> {
    try {
      const response = await api.put(`/laundry/${transactionId}/return-items`, {
        quality,
        issues,
        photos
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Mark items as lost
   */
  async markItemsAsLost(transactionId: string, notes?: string): Promise<LaundryTransaction> {
    try {
      const response = await api.put(`/laundry/${transactionId}/mark-lost`, { notes });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Mark items as damaged
   */
  async markItemsAsDamaged(transactionId: string, notes?: string): Promise<LaundryTransaction> {
    try {
      const response = await api.put(`/laundry/${transactionId}/mark-damaged`, { notes });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get laundry dashboard data
   */
  async getLaundryDashboard(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LaundryDashboard> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const response = await api.get(`/laundry/dashboard?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get laundry status
   */
  async getLaundryStatus(filters?: {
    roomId?: string;
    status?: string;
    itemId?: string;
  }): Promise<LaundryTransaction[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.roomId) params.append('roomId', filters.roomId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.itemId) params.append('itemId', filters.itemId);

      const response = await api.get(`/laundry/status?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get overdue laundry items
   */
  async getOverdueItems(): Promise<LaundryTransaction[]> {
    try {
      const response = await api.get('/laundry/overdue');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get laundry statistics
   */
  async getLaundryStatistics(dateRange?: {
    startDate?: string;
    endDate?: string;
  }): Promise<LaundryStatistics> {
    try {
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

      const response = await api.get(`/laundry/statistics?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get all laundry transactions
   */
  async getAllLaundryTransactions(params?: {
    page?: number;
    limit?: number;
    status?: string;
    roomId?: string;
    sort?: string;
  }): Promise<{
    data: LaundryTransaction[];
    total: number;
    page: number;
    pages: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.roomId) queryParams.append('roomId', params.roomId);
      if (params?.sort) queryParams.append('sort', params.sort);

      const response = await api.get(`/laundry?${queryParams.toString()}`);
      return {
        data: response.data.data,
        total: response.data.results,
        page: params?.page || 1,
        pages: Math.ceil(response.data.results / (params?.limit || 10))
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get laundry transaction by ID
   */
  async getLaundryTransaction(transactionId: string): Promise<LaundryTransaction> {
    try {
      const response = await api.get(`/laundry/${transactionId}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get status color for UI
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'in_laundry':
        return 'bg-blue-500';
      case 'cleaning':
        return 'bg-purple-500';
      case 'ready':
        return 'bg-green-500';
      case 'returned':
        return 'bg-emerald-500';
      case 'lost':
        return 'bg-red-500';
      case 'damaged':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  }

  /**
   * Get status text for UI
   */
  getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in_laundry':
        return 'In Laundry';
      case 'cleaning':
        return 'Cleaning';
      case 'ready':
        return 'Ready';
      case 'returned':
        return 'Returned';
      case 'lost':
        return 'Lost';
      case 'damaged':
        return 'Damaged';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get priority color for UI
   */
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  }

  /**
   * Get quality color for UI
   */
  getQualityColor(quality: string): string {
    switch (quality) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'fair':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-orange-500';
      case 'damaged':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Format date for display
   */
  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format date and time for display
   */
  formatDateTime(date: string | Date): string {
    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export default new LaundryService();
