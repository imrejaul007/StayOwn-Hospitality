/**
 * Payment Service Integration - RABTUL Integration
 *
 * Delegates all payment operations to the RABTUL Payment Service:
 * - Payment initialization
 * - Payment verification
 * - Refund processing
 * - Payment status tracking
 */

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentInitRequest {
  bookingId: string;
  hotelId: string;
  amountPaise: number;
  currency?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description?: string;
}

export interface PaymentInitResponse {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  status: 'created' | 'pending' | 'failed';
  checkoutUrl?: string;
  error?: string;
}

export interface PaymentVerifyRequest {
  paymentId: string;
  orderId: string;
  signature: string;
}

export interface PaymentVerifyResponse {
  success: boolean;
  status: 'verified' | 'invalid' | 'failed';
  error?: string;
}

export interface RefundRequest {
  paymentId: string;
  amountPaise?: number;
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  status: 'processed' | 'pending' | 'failed';
  error?: string;
}

// ─── RABTUL Payment Service Client ──────────────────────────────────────────────

interface RABTULPaymentResponse {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  refundId?: string;
  error?: string;
  data?: any;
}

async function callRABTULPayment(endpoint: string, body?: any): Promise<RABTULPaymentResponse> {
  if (!PAYMENT_SERVICE_URL) {
    return { success: false, error: 'Payment service URL not configured' };
  }

  try {
    const res = await fetch(`${PAYMENT_SERVICE_URL}/api/payments/${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`[RABTUL Payment] ${endpoint} failed:`, data.error || res.statusText);
      return { success: false, error: data.error || 'Payment service unavailable' };
    }

    return data;
  } catch (error: any) {
    console.error(`[RABTUL Payment] ${endpoint} error:`, error.message);
    return { success: false, error: error.message || 'Payment service unavailable' };
  }
}

// ─── Payment Service ────────────────────────────────────────────────────────────

export const paymentService = {
  /**
   * Initialize a payment for checkout via RABTUL Payment Service
   */
  async initializePayment(
    request: PaymentInitRequest
  ): Promise<PaymentInitResponse> {
    try {
      const response = await callRABTULPayment('initiate', {
        bookingId: request.bookingId,
        hotelId: request.hotelId,
        amount: request.amountPaise,
        currency: request.currency || 'INR',
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        description: request.description || `Hotel checkout - ${request.bookingId}`,
      });

      if (!response.success) {
        return {
          success: false,
          amount: request.amountPaise,
          currency: request.currency || 'INR',
          status: 'failed',
          error: response.error || 'Payment initialization failed',
        };
      }

      return {
        success: true,
        paymentId: response.paymentId,
        orderId: response.orderId,
        amount: response.amount || request.amountPaise,
        currency: response.currency || request.currency || 'INR',
        status: 'created',
        checkoutUrl: response.data?.checkoutUrl,
      };
    } catch (error: any) {
      console.error('[Payment] Initialize failed:', error);
      return {
        success: false,
        amount: request.amountPaise,
        currency: request.currency || 'INR',
        status: 'failed',
        error: error.message || 'Payment initialization failed',
      };
    }
  },

  /**
   * Verify a payment signature via RABTUL Payment Service
   */
  async verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse> {
    try {
      const response = await callRABTULPayment('verify', {
        paymentId: request.paymentId,
        orderId: request.orderId,
        signature: request.signature,
      });

      if (!response.success) {
        return {
          success: false,
          status: 'invalid',
          error: response.error || 'Invalid payment signature',
        };
      }

      return {
        success: true,
        status: 'verified',
      };
    } catch (error: any) {
      console.error('[Payment] Verify failed:', error);
      return {
        success: false,
        status: 'failed',
        error: error.message || 'Payment verification failed',
      };
    }
  },

  /**
   * Get payment status via RABTUL Payment Service
   */
  async getPaymentStatus(paymentId: string): Promise<{
    success: boolean;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    error?: string;
  }> {
    try {
      const response = await callRABTULPayment(`status/${paymentId}`);

      if (!response.success) {
        return {
          success: false,
          status: 'failed',
          error: response.error,
        };
      }

      return {
        success: true,
        status: (response.status as any) || 'pending',
      };
    } catch (error: any) {
      console.error('[Payment] Status check failed:', error);
      return {
        success: false,
        status: 'failed',
        error: error.message,
      };
    }
  },

  /**
   * Process refund via RABTUL Payment Service
   */
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const response = await callRABTULPayment('refund', {
        paymentId: request.paymentId,
        amount: request.amountPaise,
        reason: request.reason,
      });

      if (!response.success) {
        return {
          success: false,
          status: 'failed',
          error: response.error || 'Refund processing failed',
        };
      }

      return {
        success: true,
        refundId: response.refundId,
        status: 'processed',
      };
    } catch (error: any) {
      console.error('[Payment] Refund failed:', error);
      return {
        success: false,
        status: 'failed',
        error: error.message || 'Refund processing failed',
      };
    }
  },

  /**
   * Create UPI payment request via RABTUL Payment Service
   */
  async createUPIRequest(
    bookingId: string,
    amountPaise: number,
    customerPhone: string
  ): Promise<{
    success: boolean;
    upiLink?: string;
    qrCode?: string;
    error?: string;
  }> {
    try {
      const response = await callRABTULPayment('create-upi', {
        bookingId,
        amount: amountPaise,
        customerPhone,
      });

      if (!response.success) {
        // Fallback to local UPI link generation if service unavailable
        const upiId = process.env.HOTEL_UPI_ID || 'hotel@razorpay';
        const amount = (amountPaise / 100).toFixed(2);
        const transactionNote = `Hotel Checkout - ${bookingId}`;

        const upiLink = `upi://pay?pa=${upiId}&pn=Hotel&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

        return {
          success: true,
          upiLink,
          qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`,
        };
      }

      return {
        success: true,
        upiLink: response.data?.upiLink,
        qrCode: response.data?.qrCode,
      };
    } catch (error: any) {
      console.error('[Payment] UPI request failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

export default paymentService;
