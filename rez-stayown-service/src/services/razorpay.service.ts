/**
 * Razorpay Payment Service
 * Handles payment processing for StayOwn bookings
 */

import axios from 'axios';
import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

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
 * Create a Razorpay order for booking
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrder> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }

  const { amountPaise, bookingId, customerEmail, customerPhone, notes } = params;

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    const response = await axios.post<RazorpayOrder>(
      `${RAZORPAY_API_URL}/orders`,
      {
        amount: amountPaise,
        currency: 'INR',
        receipt: `booking_${bookingId}`,
        notes: {
          bookingId,
          ...notes,
        },
        ...(customerEmail && { email: customerEmail }),
        ...(customerPhone && { contact: customerPhone }),
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('[Razorpay] Failed to create order:', error.response?.data || error.message);
    throw new Error(`Failed to create payment order: ${error.response?.data?.error?.description || error.message}`);
  }
}

/**
 * Verify payment signature from Razorpay webhook
 */
export function verifyPaymentSignature(params: PaymentVerification): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.error('[Razorpay] Webhook secret not configured');
    return false;
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return expectedSignature === razorpaySignature;
}

/**
 * Capture a payment
 */
export async function capturePayment(paymentId: string, amountPaise: number): Promise<void> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    await axios.post(
      `${RAZORPAY_API_URL}/payments/${paymentId}/capture`,
      { amount: amountPaise },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error: any) {
    console.error('[Razorpay] Failed to capture payment:', error.response?.data || error.message);
    throw new Error(`Failed to capture payment: ${error.response?.data?.error?.description || error.message}`);
  }
}

/**
 * Refund a payment
 */
export async function refundPayment(paymentId: string, amountPaise?: number): Promise<void> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    await axios.post(
      `${RAZORPAY_API_URL}/payments/${paymentId}/refund`,
      amountPaise ? { amount: amountPaise } : {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error: any) {
    console.error('[Razorpay] Failed to refund:', error.response?.data || error.message);
    throw new Error(`Failed to process refund: ${error.response?.data?.error?.description || error.message}`);
  }
}

/**
 * Get payment details
 */
export async function getPayment(paymentId: string): Promise<any> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  try {
    const response = await axios.get(
      `${RAZORPAY_API_URL}/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[Razorpay] Failed to get payment:', error.response?.data || error.message);
    throw new Error(`Failed to get payment: ${error.response?.data?.error?.description || error.message}`);
  }
}
