import { api } from './api';

export interface BillingSession {
  _id: string;
  sessionId: string;
  hotelId: string;
  guestName: string;
  roomNumber: string;
  bookingId?: string;
  bookingNumber?: string;
  items: Array<{
    itemId: string;
    name: string;
    category: string;
    price: number;
    outlet: string;
    quantity: number;
    discount: number;
    tax: number;
    timestamp: Date;
  }>;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'card' | 'room_charge' | 'corporate' | 'split';
  status: 'draft' | 'paid' | 'room_charged' | 'void';
  splitPayments?: Array<{
    method: string;
    amount: number;
  }>;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  paidAt?: Date;
  updatedAt: Date;
}

export interface CreateBillingSessionRequest {
  guestName: string;
  roomNumber: string;
  bookingNumber?: string;
  hotelId: string;
}

export interface AddItemRequest {
  item: {
    id: string;
    name: string;
    category: string;
    price: number;
    outlet: string;
  };
}

export interface UpdateItemRequest {
  quantity: number;
}

export interface CheckoutRequest {
  paymentMethod: 'cash' | 'card' | 'room_charge' | 'corporate' | 'split';
  splitPayments?: Array<{
    method: string;
    amount: number;
  }>;
  notes?: string;
}

export interface VoidRequest {
  reason?: string;
}

export interface BillingSessionResponse {
  status: string;
  data: {
    billingSession: BillingSession;
  };
}

export interface BillingSessionsResponse {
  status: string;
  results: number;
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
  data: BillingSession[];
}

class BillingSessionService {
  private baseUrl = '/billing-sessions';

  // Create a new billing session
  async createSession(data: CreateBillingSessionRequest): Promise<BillingSessionResponse> {
    try {
      const response = await api.post(this.baseUrl, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get billing session by ID
  async getSession(id: string): Promise<BillingSessionResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update billing session
  async updateSession(id: string, data: Partial<BillingSession>): Promise<BillingSessionResponse> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Delete billing session
  async deleteSession(id: string): Promise<{ status: string; message: string }> {
    try {
      const response = await api.delete(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Add item to billing session
  async addItem(sessionId: string, data: AddItemRequest): Promise<BillingSessionResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/${sessionId}/items`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update item quantity in billing session
  async updateItem(sessionId: string, itemId: string, data: UpdateItemRequest): Promise<BillingSessionResponse> {
    try {
      const response = await api.put(`${this.baseUrl}/${sessionId}/items/${itemId}`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Remove item from billing session
  async removeItem(sessionId: string, itemId: string): Promise<BillingSessionResponse> {
    try {
      const response = await api.delete(`${this.baseUrl}/${sessionId}/items/${itemId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Checkout billing session
  async checkoutSession(sessionId: string, data: CheckoutRequest): Promise<BillingSessionResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/${sessionId}/checkout`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Void billing session
  async voidSession(sessionId: string, data: VoidRequest): Promise<BillingSessionResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/${sessionId}/void`, data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get all billing sessions for a hotel
  async getHotelSessions(
    hotelId: string,
    params?: {
      status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<BillingSessionsResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const url = `${this.baseUrl}/hotel/${hotelId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const billingSessionService = new BillingSessionService();
export default billingSessionService;
