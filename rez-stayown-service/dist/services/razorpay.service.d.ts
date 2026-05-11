/**
 * Razorpay Payment Service
 * Handles payment processing for StayOwn bookings
 */
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
export declare function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrder>;
/**
 * Verify payment signature from Razorpay webhook
 */
export declare function verifyPaymentSignature(params: PaymentVerification): boolean;
/**
 * Capture a payment
 */
export declare function capturePayment(paymentId: string, amountPaise: number): Promise<void>;
/**
 * Refund a payment
 */
export declare function refundPayment(paymentId: string, amountPaise?: number): Promise<void>;
/**
 * Get payment details
 */
export declare function getPayment(paymentId: string): Promise<any>;
export {};
//# sourceMappingURL=razorpay.service.d.ts.map