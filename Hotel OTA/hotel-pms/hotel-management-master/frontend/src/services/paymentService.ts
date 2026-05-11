import { api } from './api';

interface PaymentIntentData {
  bookingId: string;
  amount?: number;
  currency?: string;
}

interface PaymentIntentResponse {
  status: string;
  data: {
    clientSecret: string;
    paymentIntentId: string;
  };
}

interface RefundData {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}

class PaymentService {
  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentIntentResponse> {
    try {
      const response = await api.post('/payments/intent', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<unknown> {
    try {
      const response = await api.post('/payments/confirm', { paymentIntentId });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createRefund(data: RefundData): Promise<unknown> {
    try {
      const response = await api.post('/payments/refund', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const paymentService = new PaymentService();