import Razorpay from 'razorpay';
import crypto, { timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { Errors } from '../../utils/errors';
import { prisma } from '../../config/database';

// Lazy-init Razorpay client only when credentials are available
let razorpayClient: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
}

export class PaymentService {
  /**
   * Create a Razorpay order
   */
  static async createOrder(amountPaise: number, bookingRef: string): Promise<{ orderId: string }> {
    if (env.NODE_ENV === 'development' && !env.RAZORPAY_KEY_ID) {
      // Dev mode: return mock order — only when key is also unset
      return { orderId: `order_dev_${Date.now()}` };
    }

    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: bookingRef,
    });

    return { orderId: order.id };
  }

  /**
   * Verify Razorpay payment signature
   */
  static verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
    if (isDev && !env.RAZORPAY_KEY_SECRET) {
      // Dev mode: no Razorpay configured — skip verification
      return true;
    }

    if (!env.RAZORPAY_KEY_SECRET) {
      // HOTEL-OTA-P1 FIX: In production, a missing key secret must throw, not silently pass.
      // Silently passing in production would allow forged payment completions.
      throw new Error('RAZORPAY_KEY_SECRET is not configured. Cannot verify payment signature.');
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Initiate refund
   * BUG-14 FIX: Creates a Refund record in the database for auditability.
   */
  static async initiateRefund(
    paymentId: string,
    amountPaise: number,
    bookingId: string
  ): Promise<{ refundId: string; refundRecordId: string }> {
    // Create refund record in DB first (before calling Razorpay)
    const refundRecord = await prisma.refund.create({
      data: {
        bookingId,
        amountPaise,
        status: 'pending',
      },
    });

    try {
      let razorpayRefundId: string;

      if (env.NODE_ENV === 'development' && !env.RAZORPAY_KEY_ID) {
        razorpayRefundId = `refund_dev_${Date.now()}`;
      } else {
        const refund = await getRazorpay().payments.refund(paymentId, {
          amount: amountPaise,
        });
        razorpayRefundId = refund.id;
      }

      // Update refund record with Razorpay refund ID and mark as processed
      await prisma.refund.update({
        where: { id: refundRecord.id },
        data: {
          razorpayRefundId,
          status: 'processed',
        },
      });

      return { refundId: razorpayRefundId, refundRecordId: refundRecord.id };
    } catch (error) {
      // Mark refund as failed if Razorpay call fails
      await prisma.refund.update({
        where: { id: refundRecord.id },
        data: {
          status: 'failed',
          failureReason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}
