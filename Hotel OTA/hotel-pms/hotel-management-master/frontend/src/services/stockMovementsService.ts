import { api } from './api';

export interface StockMovementFilters {
  page?: number;
  limit?: number;
  transactionType?: string;
  inventoryItemId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface Transaction {
  _id: string;
  inventoryItemId: {
    _id: string;
    name: string;
    category: string;
    unit: string;
    stock?: number;
  };
  transactionType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'REORDER' | 'CONSUMPTION';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  reference?: {
    type: string;
    id?: string;
    description: string;
  };
  location?: {
    from?: unknown;
    to?: unknown;
  };
  performedBy: {
    _id: string;
    name: string;
    role: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
    role: string;
  };
  supplier?: {
    name: string;
    contact: string;
    email: string;
    invoiceNumber: string;
  };
  metadata?: Record<string, unknown>;
  status: 'pending' | 'completed' | 'cancelled';
  timestamps: {
    created: string;
    updated: string;
    completed?: string;
  };
  formattedQuantity?: string;
  transactionValue?: number;
  locationDisplay?: string;
}

export interface TransactionHistoryResponse {
  success: boolean;
  data: {
    transactions: Transaction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface TransactionSummaryResponse {
  success: boolean;
  data: {
    summary: Array<{
      _id: string;
      count: number;
      totalQuantity: number;
      totalValue: number;
      avgQuantity: number;
    }>;
    categoryBreakdown: Array<{
      _id: string;
      transactionCount: number;
      totalQuantity: number;
      totalValue: number;
      inQuantity: number;
      outQuantity: number;
    }>;
    topActiveItems: Array<{
      _id: string;
      itemName: string;
      category: string;
      transactionCount: number;
      totalQuantity: number;
      totalValue: number;
    }>;
    dailyTrends: Array<{
      _id: { date: string };
      transactionCount: number;
      totalValue: number;
      inTransactions: number;
      outTransactions: number;
    }>;
  };
}

export interface ItemStatisticsResponse {
  success: boolean;
  data: {
    item: {
      id: string;
      name: string;
      category: string;
      currentStock: number;
      minStock: number;
      maxStock: number;
      unit: string;
      avgCost: number;
      lastUpdated: string;
    };
    statistics: {
      totalTransactions: number;
      totalInFlow: number;
      totalOutFlow: number;
      totalCost: number;
      netFlow: number;
      avgTransactionValue: number;
      turnoverRate: number;
    };
    usage: {
      byType: Record<string, { count: number; quantity: number; cost: number }>;
      pattern: Array<{
        _id: { year: number; month: number; day: number };
        totalIn: number;
        totalOut: number;
        transactionCount: number;
      }>;
      recentActivity: {
        transactions: number;
        quantity: number;
        cost: number;
      };
    };
    performance: {
      stockoutRisk: 'low' | 'medium' | 'high';
      reorderNeeded: boolean;
      suggestedReorderQuantity: number;
    };
  };
}

export interface LowStockAlert {
  item: {
    id: string;
    name: string;
    category: string;
    currentStock: number;
    minStock: number;
    unit: string;
  };
  alert: {
    severity: 'warning' | 'critical';
    daysUntilStockout: number | null;
    avgDailyConsumption: string;
    reorderSuggested: number;
  };
  usage: Array<{
    _id: { year: number; month: number; day: number };
    totalIn: number;
    totalOut: number;
    transactionCount: number;
  }>;
}

export interface ReorderSuggestion {
  item: {
    id: string;
    name: string;
    category: string;
    currentStock: number;
    minStock: number;
    maxStock: number;
    unit: string;
  };
  currentStock: number;
  minStock: number;
  maxStock: number;
  avgDailyUsage: number;
  daysUntilStockout: number | null;
  suggestedOrderQuantity: number;
  priority: 'warning' | 'critical';
  estimatedCost: number;
  reasoning: {
    leadTimeDays: number;
    safetyStock: number;
    targetStock: number;
    urgency: 'normal' | 'soon' | 'urgent' | 'unknown';
  };
}

export interface AdjustmentData {
  inventoryItemId: string;
  quantity: number;
  reason: string;
  unitCost?: number;
}

export interface TransferData {
  inventoryItemId: string;
  quantity: number;
  fromLocation: {
    building?: string;
    floor?: string;
    room?: string;
    shelf?: string;
  };
  toLocation: {
    building?: string;
    floor?: string;
    room?: string;
    shelf?: string;
  };
  reason?: string;
}

export interface ConsumptionData {
  inventoryItemId: string;
  quantity: number;
  reason: string;
  reference?: {
    type: string;
    id?: string;
    description?: string;
  };
  location?: {
    building?: string;
    floor?: string;
    room?: string;
    shelf?: string;
  };
}

export interface ReconciliationData {
  itemCounts: Array<{
    itemId: string;
    physicalCount: number;
  }>;
  notes?: string;
}

class StockMovementsService {
  /**
   * Get transaction history with filters
   */
  async getTransactionHistory(filters: StockMovementFilters = {}): Promise<TransactionHistoryResponse> {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/stock-movements?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get transaction history for specific item
   */
  async getItemTransactions(itemId: string, options: { limit?: number; startDate?: string; endDate?: string } = {}) {
    try {
      const params = new URLSearchParams();

      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/stock-movements/item/${itemId}?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Create manual stock adjustment
   */
  async createAdjustment(data: AdjustmentData) {
    try {
      const response = await api.post('/stock-movements/adjustment', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Create item transfer between locations
   */
  async createTransfer(data: TransferData) {
    try {
      const response = await api.post('/stock-movements/transfer', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Log consumption transaction
   */
  async logConsumption(data: ConsumptionData) {
    try {
      const response = await api.post('/stock-movements/consumption', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get transaction analytics summary
   */
  async getTransactionSummary(filters: { startDate?: string; endDate?: string; category?: string } = {}): Promise<TransactionSummaryResponse> {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/stock-movements/summary?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Reconcile inventory counts
   */
  async reconcileInventory(data: ReconciliationData) {
    try {
      const response = await api.post('/stock-movements/reconcile', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Export transaction data
   */
  async exportTransactions(filters: StockMovementFilters & { format?: 'csv' | 'json' } = {}) {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/stock-movements/export?${params.toString()}`, {
        responseType: filters.format === 'csv' ? 'text' : 'json'
      });

      if (filters.format === 'csv') {
        return response.data; // Return raw CSV string
      } else {
        return response.data; // Return JSON data
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get auto-reorder suggestions
   */
  async getReorderSuggestions(options: { includeScheduled?: boolean } = {}) {
    try {
      const params = new URLSearchParams();

      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/stock-movements/reorder-suggestions?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(threshold: number = 5) {
    try {
      const response = await api.get(`/stock-movements/low-stock-alerts?threshold=${threshold}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get comprehensive item statistics
   */
  async getItemStatistics(itemId: string, days: number = 30): Promise<ItemStatisticsResponse> {
    try {
      const response = await api.get(`/stock-movements/item-statistics/${itemId}?days=${days}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Bulk create adjustments
   */
  async bulkCreateAdjustments(adjustments: AdjustmentData[]) {
    const promises = adjustments.map(adjustment => this.createAdjustment(adjustment));
    return Promise.all(promises);
  }

  /**
   * Get transaction trends for dashboard
   */
  async getTransactionTrends(days: number = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return this.getTransactionSummary({ startDate, endDate });
  }

  /**
   * Get consumption patterns by operation type
   */
  async getConsumptionPatterns(filters: { startDate?: string; endDate?: string } = {}) {
    const transactionFilters: StockMovementFilters = {
      ...filters,
      transactionType: 'CONSUMPTION',
      limit: 1000 // Get more data for analysis
    };

    return this.getTransactionHistory(transactionFilters);
  }

  /**
   * Get stock movements by category
   */
  async getMovementsByCategory(category: string, filters: StockMovementFilters = {}) {
    // This would need to be implemented on the backend to filter by category
    // For now, we'll get all transactions and filter client-side
    const response = await this.getTransactionHistory(filters);

    if (response.success) {
      const filteredTransactions = response.data.transactions.filter(
        transaction => transaction.inventoryItemId.category === category
      );

      return {
        ...response,
        data: {
          ...response.data,
          transactions: filteredTransactions
        }
      };
    }

    return response;
  }

  /**
   * Get recent activity summary
   */
  async getRecentActivity(hours: number = 24) {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    return this.getTransactionHistory({
      startDate,
      limit: 50,
      sortBy: 'timestamps.created',
      sortOrder: 'desc'
    });
  }

  /**
   * Search transactions by item name or reason
   */
  async searchTransactions(searchTerm: string, filters: StockMovementFilters = {}) {
    // This is handled client-side in the component for now
    // Could be improved with server-side search
    return this.getTransactionHistory({
      ...filters,
      limit: 100 // Get more results for better search
    });
  }
}

export const stockMovementsService = new StockMovementsService();
export default stockMovementsService;