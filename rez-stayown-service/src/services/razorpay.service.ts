import logger from './utils/logger';

/**
 * Razorpay Payment Service - RABTUL Integration
 *
 * Delegates payment operations to the RABTUL Payment Service:
 * - Order creation
 * - Payment capture
 * - Refunds
 * - Payment verification
 */

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface RABTULPaymentResponse {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: string;
  data?: any;
}

async function callRABTULPayment(endpoint: string, body?: any): Promise<RABTULPaymentResponse> {
  const res = await fetch(`${PAYMENT_SERVICE_URL}/api/payments/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`[RABTUL Payment] ${endpoint} failed:`, data.error || res.statusText);
    return { success: false, error: data.error || 'Payment service unavailable' };
  }

  return data;
}

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: 'created' | 'attempted' | 'captured' | 'failed';
  created_at: number;
}

interface CreateOrderParams {
  amountPaise: number;
  bookingId: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
}

interface PaymentVerification {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/**
 * Create a Razorpay order for booking via RABTUL Payment Service
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrder> {
  if (!PAYMENT_SERVICE_URL) {
    throw new Error('Payment service URL not configured');
  }

  const { amountPaise, bookingId, customerEmail, customerPhone, notes } = params;

  const response = await callRABTULPayment('initiate', {
    amount: amountPaise,
    bookingId,
    customerEmail,
    customerPhone,
    notes,
    currency: 'INR',
  });

  if (!response.success) {
    throw new Error(`Failed to create payment order: ${response.error}`);
  }

  return {
    id: response.orderId || `order_${Date.now()}`,
    entity: 'order',
    amount: amountPaise,
    amount_paid: 0,
    amount_due: amountPaise,
    currency: 'INR',
    status: 'created',
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Verify payment signature from Razorpay webhook via RABTUL Payment Service
 */
export async function verifyPaymentSignature(params: PaymentVerification): Promise<boolean> {
  if (!PAYMENT_SERVICE_URL) {
    logger.error('[Razorpay] Payment service URL not configured');
    return false;
  }

  const response = await callRABTULPayment('verify-signature', {
    orderId: params.razorpayOrderId,
    paymentId: params.razorpayPaymentId,
    signature: params.razorpaySignature,
  });

  return response.success;
}

/**
 * Capture a payment via RABTUL Payment Service
 */
export async function capturePayment(paymentId: string, amountPaise: number): Promise<void> {
  if (!PAYMENT_SERVICE_URL) {
    throw new Error('Payment service URL not configured');
  }

  const response = await callRABTULPayment('capture', {
    paymentId,
    amount: amountPaise,
  });

  if (!response.success) {
    throw new Error(`Failed to capture payment: ${response.error}`);
  }
}

/**
 * Refund a payment via RABTUL Payment Service
 */
export async function refundPayment(paymentId: string, amountPaise?: number): Promise<void> {
  if (!PAYMENT_SERVICE_URL) {
    throw new Error('Payment service URL not configured');
  }

  const response = await callRABTULPayment('refund', {
    paymentId,
    amount: amountPaise,
  });

  if (!response.success) {
    throw new Error(`Failed to process refund: ${response.error}`);
  }
}

/**
 * Get payment details via RABTUL Payment Service
 */
export async function getPayment(paymentId: string): Promise<any> {
  if (!PAYMENT_SERVICE_URL) {
    throw new Error('Payment service URL not configured');
  }

  const response = await callRABTULPayment(`status/${paymentId}`);

  if (!response.success) {
    throw new Error(`Failed to get payment: ${response.error}`);
  }

  return response.data;
}
