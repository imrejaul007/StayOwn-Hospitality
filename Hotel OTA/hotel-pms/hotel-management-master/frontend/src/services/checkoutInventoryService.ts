import { api } from './api';

export interface CheckoutInventoryItem {
  itemName: string;
  category: 'bathroom' | 'bedroom' | 'kitchen' | 'electronics' | 'furniture' | 'other';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: 'used' | 'damaged' | 'missing' | 'intact';
  notes?: string;
}

export interface CheckoutInventory {
  _id: string;
  bookingId: {
    _id: string;
    bookingNumber: string;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    userId?: {
      _id: string;
      name: string;
      email: string;
    };
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
  items: CheckoutInventoryItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: 'pending' | 'completed' | 'paid';
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer';
  paymentStatus: 'pending' | 'paid' | 'failed';
  notes?: string;
  checkedAt: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateCheckoutInventoryData {
  bookingId: string;
  roomId: string;
  items: Array<{
    itemName: string;
    category: string;
    quantity: number;
    unitPrice: number;
    status: string;
    notes?: string;
  }>;
  notes?: string;
}

interface UpdateCheckoutInventoryData {
  items?: CheckoutInventoryItem[];
  status?: string;
  notes?: string;
}

interface PaymentData {
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer';
  notes?: string;
}

interface CheckoutInventoryFilters {
  status?: string;
  paymentStatus?: string;
  bookingId?: string;
  page?: number;
  limit?: number;
}

// Note: the backend wraps pagination inside `data` (not at the top level of the response).
// Shape: { status, data: { checkoutInventories: [...], pagination: { page, limit, total, pages } } }
interface ApiResponse<T> {
  status: string;
  data: T & { pagination?: { page: number; limit: number; total: number; pages: number } };
}

class CheckoutInventoryService {
  async createCheckoutInventory(data: CreateCheckoutInventoryData): Promise<ApiResponse<{ checkoutInventory: CheckoutInventory }>> {
    try {
      const response = await api.post('/checkout-inventory', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCheckoutInventories(filters: CheckoutInventoryFilters = {}): Promise<ApiResponse<{ checkoutInventories: CheckoutInventory[] }>> {
    try {
      const params = new URLSearchParams();
    
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/checkout-inventory?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCheckoutInventoryById(id: string): Promise<ApiResponse<{ checkoutInventory: CheckoutInventory }>> {
    try {
      const response = await api.get(`/checkout-inventory/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCheckoutInventoryByBooking(bookingId: string): Promise<ApiResponse<{ checkoutInventory: CheckoutInventory }>> {
    try {
      const response = await api.get(`/checkout-inventory/booking/${bookingId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateCheckoutInventory(id: string, updates: UpdateCheckoutInventoryData): Promise<ApiResponse<{ checkoutInventory: CheckoutInventory }>> {
    try {
      const response = await api.patch(`/checkout-inventory/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async processPayment(id: string, paymentData: PaymentData): Promise<ApiResponse<{ checkoutInventory: CheckoutInventory }>> {
    try {
      const response = await api.post(`/checkout-inventory/${id}/payment`, paymentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async completeInventoryCheck(id: string): Promise<ApiResponse<{ checkoutInventory: CheckoutInventory }>> {
    try {
      const response = await api.post(`/checkout-inventory/${id}/complete`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const checkoutInventoryService = new CheckoutInventoryService();
