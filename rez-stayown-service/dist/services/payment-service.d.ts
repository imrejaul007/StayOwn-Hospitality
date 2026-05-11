/**
 * Payment Service Integration
 *
 * Handles:
 * - Razorpay payment initialization
 * - Payment verification
 * - Refund processing
 * - Payment status tracking
 */
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
export declare const paymentService: {
    /**
     * Initialize a payment for checkout
     */
    initializePayment(request: PaymentInitRequest): Promise<PaymentInitResponse>;
    /**
     * Verify a payment signature
     */
    verifyPayment(request: PaymentVerifyRequest): Promise<PaymentVerifyResponse>;
    /**
     * Get payment status
     */
    getPaymentStatus(paymentId: string): Promise<{
        success: boolean;
        status: "pending" | "completed" | "failed" | "refunded";
        error?: string;
    }>;
    /**
     * Process refund
     */
    processRefund(request: RefundRequest): Promise<RefundResponse>;
    /**
     * Create UPI payment request
     */
    createUPIRequest(bookingId: string, amountPaise: number, customerPhone: string): Promise<{
        success: boolean;
        upiLink?: string;
        qrCode?: string;
        error?: string;
    }>;
};
export default paymentService;
//# sourceMappingURL=payment-service.d.ts.map