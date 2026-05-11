import { api } from './api';

// Base interfaces
export interface InventoryItem {
  _id: string;
  hotelId: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  unitPrice: number;
  replacementPrice?: number;
  guestPrice?: number;
  currentStock: number;
  stockThreshold: number;
  isLowStock: boolean;
  reorderSettings?: {
    autoReorderEnabled: boolean;
    reorderPoint: number;
    reorderQuantity: number;
    preferredSupplier?: {
      name: string;
      email: string;
      leadTime: number;
    };
  };
  supplier?: {
    name: string;
    contact: string;
    email: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  _id: string;
  hotelId: string;
  name: string;
  vendorCode: string;
  contactInfo: {
    email: string;
    phone: string;
    address: Record<string, unknown>;
    primaryContact?: {
      name: string;
      email: string;
      phone: string;
    };
  };
  categories: string[];
  performance: {
    overallRating: number;
    deliveryRating: number;
    qualityRating: number;
    serviceRating: number;
    priceRating: number;
    totalOrders: number;
    onTimeDeliveries: number;
    totalOrderValue: number;
    averageOrderValue: number;
    onTimeDeliveryPercentage: number;
  };
  deliveryInfo: {
    leadTimeDays: number;
    minimumOrderValue: number;
    shippingCost: number;
    freeShippingThreshold: number;
  };
  paymentTerms: {
    paymentDays: number;
    discountTerms?: string;
    currency: string;
  };
  status: 'active' | 'inactive' | 'blacklisted' | 'preferred' | 'pending_approval' | 'suspended';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  _id: string;
  hotelId: string;
  poNumber: string;
  vendorId: string;
  vendorInfo: {
    name: string;
    email: string;
    phone: string;
    address?: string;
  };
  requestedBy: string;
  approvedBy?: string;
  department: string;
  category: string;
  items: PurchaseOrderItem[];
  orderDate: string;
  requiredDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent_to_vendor' | 'confirmed_by_vendor' |
          'in_transit' | 'partially_received' | 'fully_received' | 'completed' | 'cancelled' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  inventoryItemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityPending: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  finalAmount: number;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
}

export interface StockMovement {
  _id: string;
  hotelId: string;
  inventoryItemId: string;
  itemName: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  previousStock: number;
  newStock: number;
  unitPrice?: number;
  totalValue?: number;
  reason: string;
  referenceType?: 'purchase_order' | 'guest_consumption' | 'housekeeping' | 'maintenance' | 'audit' | 'transfer' | 'return';
  referenceId?: string;
  performedBy: string;
  approvedBy?: string;
  location?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
  createdAt: string;
}

export interface InventoryAlert {
  _id: string;
  hotelId: string;
  type: 'LOW_STOCK' | 'REORDER' | 'OVERDUE_DELIVERY' | 'QUALITY_ISSUE' | 'BUDGET_THRESHOLD' | 'EXPIRY_WARNING';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  itemId?: string;
  itemName?: string;
  vendorId?: string;
  purchaseOrderId?: string;
  currentValue?: number;
  thresholdValue?: number;
  actionRequired: boolean;
  actionTaken?: string;
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface ReorderAlert {
  _id: string;
  hotelId: string;
  inventoryItemId: string;
  itemName: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost: number;
  suggestedVendor?: {
    id: string;
    name: string;
    rating: number;
    leadTime: number;
    unitPrice: number;
  };
  autoCreatePO: boolean;
  status: 'pending' | 'approved' | 'po_created' | 'dismissed';
  createdAt: string;
  processedAt?: string;
}

export interface InventoryAnalytics {
  overview: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    reorderAlertsCount: number;
    averageItemValue: number;
    monthlyConsumptionValue: number;
    inventoryTurnoverRatio: number;
  };
  categoryBreakdown: Array<{
    category: string;
    itemCount: number;
    totalValue: number;
    percentage: number;
    averageValue: number;
  }>;
  stockStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
    overstocked: number;
  };
  costAnalysis: {
    monthlyTrend: Array<{
      month: string;
      totalCost: number;
      categoryBreakdown: Array<{
        category: string;
        cost: number;
      }>;
    }>;
    topExpensiveItems: Array<{
      itemName: string;
      unitPrice: number;
      totalValue: number;
      quantity: number;
    }>;
  };
  vendorPerformance: {
    totalVendors: number;
    averageRating: number;
    topPerformers: Array<{
      vendorName: string;
      rating: number;
      orderCount: number;
      totalValue: number;
      onTimeDeliveryRate: number;
    }>;
  };
  reorderInsights: {
    itemsNeedingReorder: number;
    estimatedReorderCost: number;
    urgentItems: number;
    autoReorderEnabled: number;
  };
}

export interface DashboardStats {
  realTimeStats: {
    totalItems: number;
    lowStockItems: number;
    pendingOrders: number;
    totalValue: number;
    monthlyConsumption: number;
    avgCostPerItem: number;
    activeVendors: number;
    reorderAlerts: number;
  };
  recentActivity: StockMovement[];
  criticalAlerts: InventoryAlert[];
  topVendors: Array<{
    id: string;
    name: string;
    overallRating: number;
    totalOrders: number;
    onTimeDeliveryRate: number;
    totalOrderValue: number;
    lastOrderDate: string;
  }>;
  costTrends: Array<{
    period: string;
    totalCost: number;
    categories: Array<{
      name: string;
      cost: number;
      percentage: number;
    }>;
    trend: 'up' | 'down' | 'stable';
    changePercentage: number;
  }>;
}

class UnifiedInventoryService {
  private hotelId: string | null = null;

  constructor() {
    // Get hotel ID from auth or local storage
    this.hotelId = this.getHotelId();
  }

  private getHotelId(): string | null {
    // Implementation would get hotelId from auth context or local storage
    return localStorage.getItem('hotelId') || null;
  }

  private validateHotelId(): void {
    if (!this.hotelId) {
      throw new Error('Hotel ID is required for inventory operations');
    }
  }

  // Dashboard and Analytics Methods
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      this.validateHotelId();

      try {
        const response = await api.get(`/inventory/dashboard/stats?hotelId=${this.hotelId}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch dashboard statistics'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getInventoryAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
  }): Promise<InventoryAnalytics> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          ...params
        });

        const response = await api.get(`/inventory/analytics?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch inventory analytics'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Inventory Item Management
  async getInventoryItems(params?: {
    category?: string;
    searchTerm?: string;
    lowStockOnly?: boolean;
    status?: 'active' | 'inactive' | 'all';
    sortBy?: 'name' | 'stock' | 'value' | 'category';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{
    items: InventoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    this.validateHotelId();

    try {
      const queryParams = new URLSearchParams({
        hotelId: this.hotelId!,
        ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
      });

      const response = await api.get(`/inventory/items?${queryParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch inventory items'));
    }
  }

  async getInventoryItem(itemId: string): Promise<InventoryItem> {
    try {
      this.validateHotelId();

      try {
        const response = await api.get(`/inventory/items/${itemId}?hotelId=${this.hotelId}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch inventory item'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createInventoryItem(itemData: Partial<InventoryItem>): Promise<InventoryItem> {
    try {
      this.validateHotelId();

      try {
        const response = await api.post('/inventory/items', {
          ...itemData,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to create inventory item'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateInventoryItem(itemId: string, updateData: Partial<InventoryItem>): Promise<InventoryItem> {
    try {
      this.validateHotelId();

      try {
        const response = await api.patch(`/inventory/items/${itemId}`, {
          ...updateData,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to update inventory item'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async deleteInventoryItem(itemId: string): Promise<{ success: boolean }> {
    try {
      this.validateHotelId();

      try {
        await api.delete(`/inventory/items/${itemId}?hotelId=${this.hotelId}`);
        return { success: true };
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to delete inventory item'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Stock Movement Methods
  async getStockMovements(params?: {
    itemId?: string;
    movementType?: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
    startDate?: string;
    endDate?: string;
    performedBy?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    movements: StockMovement[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
        });

        const response = await api.get(`/inventory/movements?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch stock movements'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createStockMovement(movementData: {
    inventoryItemId: string;
    movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
    quantity: number;
    unitPrice?: number;
    reason: string;
    referenceType?: string;
    referenceId?: string;
    location?: string;
    batchNumber?: string;
    expiryDate?: string;
    notes?: string;
  }): Promise<StockMovement> {
    try {
      this.validateHotelId();

      try {
        const response = await api.post('/inventory/movements', {
          ...movementData,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to create stock movement'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Vendor Management Methods
  async getVendors(params?: {
    category?: string;
    status?: string;
    rating?: number;
    searchTerm?: string;
    sortBy?: 'name' | 'rating' | 'orders' | 'value';
    sortOrder?: 'asc' | 'desc';
  }): Promise<Vendor[]> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
        });

        const response = await api.get(`/vendors?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch vendors'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getVendorsByCategory(category: string): Promise<Vendor[]> {
    try {
      this.validateHotelId();

      try {
        const response = await api.get(`/vendors/category/${category}?hotelId=${this.hotelId}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch vendors by category'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getTopPerformingVendors(limit: number = 10): Promise<Vendor[]> {
    try {
      this.validateHotelId();

      try {
        const response = await api.get(`/vendors/top-performers?hotelId=${this.hotelId}&limit=${limit}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch top performing vendors'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Purchase Order Methods
  async getPurchaseOrders(params?: {
    status?: string;
    vendorId?: string;
    department?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    orders: PurchaseOrder[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
        });

        const response = await api.get(`/purchase-orders?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch purchase orders'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createPurchaseOrder(orderData: {
    vendorId: string;
    department: string;
    category: string;
    items: Array<{
      inventoryItemId: string;
      quantityOrdered: number;
      unitPrice: number;
      urgency?: string;
      notes?: string;
    }>;
    requiredDate: string;
    expectedDeliveryDate: string;
    priority?: string;
    notes?: string;
  }): Promise<PurchaseOrder> {
    this.validateHotelId();

    try {
      const response = await api.post('/purchase-orders', {
        ...orderData,
        hotelId: this.hotelId
      });
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to create purchase order'));
    }
  }

  async updatePurchaseOrderStatus(orderId: string, status: string, notes?: string): Promise<PurchaseOrder> {
    try {
      this.validateHotelId();

      try {
        const response = await api.patch(`/purchase-orders/${orderId}/status`, {
          status,
          notes,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to update purchase order status'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Alert Management Methods
  async getInventoryAlerts(params?: {
    type?: string;
    severity?: string;
    status?: string;
    assignedTo?: string;
    actionRequired?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    alerts: InventoryAlert[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
        });

        const response = await api.get(`/inventory/alerts?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch inventory alerts'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async acknowledgeAlert(alertId: string, actionTaken?: string): Promise<InventoryAlert> {
    try {
      this.validateHotelId();

      try {
        const response = await api.patch(`/inventory/alerts/${alertId}/acknowledge`, {
          actionTaken,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to acknowledge alert'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async resolveAlert(alertId: string, resolution: string): Promise<InventoryAlert> {
    try {
      this.validateHotelId();

      try {
        const response = await api.patch(`/inventory/alerts/${alertId}/resolve`, {
          resolution,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to resolve alert'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Reorder Management Methods
  async getReorderAlerts(params?: {
    urgencyLevel?: string;
    status?: string;
    autoCreatePO?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    alerts: ReorderAlert[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          ...Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
        });

        const response = await api.get(`/inventory/reorder-alerts?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to fetch reorder alerts'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async processReorderAlert(alertId: string, action: 'approve' | 'dismiss' | 'create_po', data?: Record<string, unknown>): Promise<{
    success: boolean;
    purchaseOrderId?: string;
    message: string;
  }> {
    try {
      this.validateHotelId();

      try {
        const response = await api.post(`/inventory/reorder-alerts/${alertId}/process`, {
          action,
          data,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to process reorder alert'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Batch Operations
  async bulkUpdateStock(updates: Array<{
    itemId: string;
    movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reason: string;
    notes?: string;
  }>): Promise<{
    success: boolean;
    results: Array<{
      itemId: string;
      success: boolean;
      error?: string;
      movementId?: string;
    }>;
  }> {
    try {
      this.validateHotelId();

      try {
        const response = await api.post('/inventory/bulk-update-stock', {
          updates,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to bulk update stock'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async generateLowStockReport(format: 'pdf' | 'csv' | 'excel' = 'pdf'): Promise<{
    downloadUrl: string;
    fileName: string;
  }> {
    try {
      this.validateHotelId();

      try {
        const response = await api.post('/inventory/reports/low-stock', {
          format,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to generate low stock report'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Integration Methods
  async syncWithHousekeeping(roomId: string, consumedItems: Array<{
    itemId: string;
    quantity: number;
  }>): Promise<{
    success: boolean;
    movementsCreated: number;
  }> {
    try {
      this.validateHotelId();

      try {
        const response = await api.post('/inventory/sync/housekeeping', {
          roomId,
          consumedItems,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to sync with housekeeping'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async syncWithMaintenance(taskId: string, usedSupplies: Array<{
    itemId: string;
    quantity: number;
  }>): Promise<{
    success: boolean;
    movementsCreated: number;
  }> {
    try {
      this.validateHotelId();

      try {
        const response = await api.post('/inventory/sync/maintenance', {
          taskId,
          usedSupplies,
          hotelId: this.hotelId
        });
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to sync with maintenance'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Search and Filter Methods
  async searchInventory(searchTerm: string, filters?: {
    category?: string;
    minStock?: number;
    maxStock?: number;
    priceRange?: { min: number; max: number };
  }): Promise<InventoryItem[]> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          searchTerm,
          ...Object.fromEntries(Object.entries(filters || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
        });

        const response = await api.get(`/inventory/search?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to search inventory'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Real-time Updates (polling-based since no WebSocket)
  async pollForUpdates(lastUpdateTime?: string): Promise<{
    hasUpdates: boolean;
    alerts: InventoryAlert[];
    reorderAlerts: ReorderAlert[];
    recentMovements: StockMovement[];
    lastUpdateTime: string;
  }> {
    try {
      this.validateHotelId();

      try {
        const queryParams = new URLSearchParams({
          hotelId: this.hotelId!,
          ...(lastUpdateTime && { lastUpdateTime })
        });

        const response = await api.get(`/inventory/poll-updates?${queryParams.toString()}`);
        return response.data.data;
      } catch (error: unknown) {
        const axiosErr = error as { response?: { data?: { message?: string } } };
        throw new Error(axiosErr.response?.data?.message || (error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Failed to poll for updates'));
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const unifiedInventoryService = new UnifiedInventoryService();
export default unifiedInventoryService;