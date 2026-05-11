import { api } from './api';

export interface POSStats {
  todaysSales: number;
  todaysOrders: number;
  activeOrders: number;
  averageOrderValue: number;
}

export interface POSOutlet {
  _id: string;
  outletId: string;
  name: string;
  type: string;
  location: string;
  isActive: boolean;
  operatingHours: {
    [key: string]: {
      open: string;
      close: string;
      closed: boolean;
    };
  };
  taxSettings: {
    defaultTaxRate: number;
    serviceTaxRate: number;
    gstRate: number;
  };
  paymentMethods: string[];
  settings: {
    allowRoomCharges: boolean;
    requireSignature: boolean;
    printReceipts: boolean;
    allowDiscounts: boolean;
    maxDiscountPercent: number;
  };
}

export interface POSOrder {
  _id: string;
  orderId: string;
  orderNumber: string;
  outlet: {
    _id: string;
    name: string;
    type: string;
  };
  type: string;
  status: string;
  customer: {
    guest?: {
      _id: string;
      name: string;
      email: string;
    };
    roomNumber?: string;
    walkIn?: {
      name: string;
      phone: string;
      email?: string;
    };
  };
  items: Array<{
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    modifiers?: Array<{
      name: string;
      option: string;
      price: number;
    }>;
    specialInstructions?: string;
    status: string;
  }>;
  subtotal: number;
  discounts?: Array<{
    type: string;
    description: string;
    amount: number;
    percentage: number;
  }>;
  taxes: {
    serviceTax: number;
    gst: number;
    otherTaxes: number;
    totalTax: number;
  };
  totalAmount: number;
  payment: {
    method: string;
    status: string;
    paidAmount?: number;
    changeGiven?: number;
    paymentDetails?: {
      transactionId?: string;
      cardLast4?: string;
      authCode?: string;
      roomChargeReference?: string;
    };
  };
  staff: {
    server?: {
      _id: string;
      name: string;
    };
    cashier?: {
      _id: string;
      name: string;
    };
  };
  tableNumber?: string;
  deliveryDetails?: {
    address: string;
    deliveryTime?: Date;
    deliveryFee?: number;
  };
  specialRequests?: string;
  orderTime: Date;
  preparedTime?: Date;
  servedTime?: Date;
  completedTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class POSService {
  private baseURL = '/pos';

  // Dashboard
  async getDashboardStats(): Promise<POSStats> {
    try {
      const response = await api.get(`${this.baseURL}/dashboard/stats`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch dashboard stats');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Outlets
  async getOutlets(): Promise<POSOutlet[]> {
    try {
      const response = await api.get(`${this.baseURL}/outlets`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch outlets');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createOutlet(outletData: Partial<POSOutlet>): Promise<POSOutlet> {
    try {
      const response = await api.post(`${this.baseURL}/outlets`, outletData);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to create outlet');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateOutlet(id: string, outletData: Partial<POSOutlet>): Promise<POSOutlet> {
    try {
      const response = await api.put(`${this.baseURL}/outlets/${id}`, outletData);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to update outlet');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Orders
  async getOrders(params?: {
    outlet?: string;
    status?: string;
    date?: string;
    limit?: number;
  }): Promise<POSOrder[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.outlet) searchParams.append('outlet', params.outlet);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.date) searchParams.append('date', params.date);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
    
      const response = await api.get(`${this.baseURL}/orders?${searchParams}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch orders');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createOrder(orderData: Partial<POSOrder>): Promise<POSOrder> {
    try {
      const response = await api.post(`${this.baseURL}/orders`, orderData);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to create order');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateOrderStatus(id: string, status: string): Promise<POSOrder> {
    try {
      const response = await api.put(`${this.baseURL}/orders/${id}/status`, { status });
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to update order status');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async processPayment(id: string, paymentData: {
    paymentMethod: string;
    amount: number;
    paymentDetails?: Record<string, unknown>;
  }): Promise<POSOrder> {
    try {
      const response = await api.put(`${this.baseURL}/orders/${id}/payment`, paymentData);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to process payment');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Menus
  async getMenusByOutlet(outletId: string): Promise<unknown[]> {
    try {
      const response = await api.get(`${this.baseURL}/menus/outlet/${outletId}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch menus');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createMenu(menuData: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await api.post(`${this.baseURL}/menus`, menuData);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to create menu');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async addMenuItem(menuId: string, itemData: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await api.post(`${this.baseURL}/menus/${menuId}/items`, itemData);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to add menu item');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Reports
  async getSalesReport(params?: {
    outlet?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<unknown[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.outlet) searchParams.append('outlet', params.outlet);
      if (params?.startDate) searchParams.append('startDate', params.startDate);
      if (params?.endDate) searchParams.append('endDate', params.endDate);
    
      const response = await api.get(`${this.baseURL}/reports/sales?${searchParams}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch sales report');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const posService = new POSService();
export default POSService;