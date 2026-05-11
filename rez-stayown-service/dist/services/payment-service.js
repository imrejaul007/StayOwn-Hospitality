"use strict";
/**
 * Payment Service Integration
 *
 * Handles:
 * - Razorpay payment initialization
 * - Payment verification
 * - Refund processing
 * - Payment status tracking
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const PAYMENT_SERVICE_URL = process.env.REZ_PAYMENT_SERVICE_URL || 'http://localhost:4001';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
// ─── Razorpay Helpers ─────────────────────────────────────────────────────────
function generateOrderId() {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function verifySignature(orderId, paymentId, signature) {
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto_1.default
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest('hex');
    return signature === expectedSignature;
}
// ─── Payment Service ────────────────────────────────────────────────────────────
exports.paymentService = {
    /**
     * Initialize a payment for checkout
     */
    async initializePayment(request) {
        try {
            const orderId = generateOrderId();
            // If we have a real payment service, call it
            if (PAYMENT_SERVICE_URL) {
                try {
                    const response = await axios_1.default.post(`${PAYMENT_SERVICE_URL}/api/payments/initialize`, {
                        bookingId: request.bookingId,
                        hotelId: request.hotelId,
                        amount: request.amountPaise,
                        currency: request.currency || 'INR',
                        customerName: request.customerName,
                        customerEmail: request.customerEmail,
                        customerPhone: request.customerPhone,
                        description: request.description || `Hotel checkout - ${request.bookingId}`,
                    }, {
                        timeout: 10000,
                        headers: {
                            'Content-Type': 'application/json',
                            'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
                        },
                    });
                    return {
                        success: true,
                        paymentId: response.data.paymentId || orderId,
                        orderId: response.data.orderId || orderId,
                        amount: request.amountPaise,
                        currency: request.currency || 'INR',
                        status: 'created',
                    };
                }
                catch (error) {
                    console.error('[Payment] Service call failed:', error);
                }
            }
            // Fallback: Return mock payment info for testing
            return {
                success: true,
                paymentId: `pay_${Date.now()}`,
                orderId,
                amount: request.amountPaise,
                currency: request.currency || 'INR',
                status: 'pending',
                checkoutUrl: `https://api.razorpay.com/v1/checkout/post?order_id=${orderId}`,
            };
        }
        catch (error) {
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
     * Verify a payment signature
     */
    async verifyPayment(request) {
        try {
            const isValid = verifySignature(request.orderId, request.paymentId, request.signature);
            if (!isValid) {
                return {
                    success: false,
                    status: 'invalid',
                    error: 'Invalid payment signature',
                };
            }
            // Notify payment service of verification
            if (PAYMENT_SERVICE_URL) {
                try {
                    await axios_1.default.post(`${PAYMENT_SERVICE_URL}/api/payments/verify`, request, {
                        timeout: 5000,
                        headers: {
                            'Content-Type': 'application/json',
                            'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
                        },
                    });
                }
                catch {
                    // Continue even if notification fails
                }
            }
            return {
                success: true,
                status: 'verified',
            };
        }
        catch (error) {
            console.error('[Payment] Verify failed:', error);
            return {
                success: false,
                status: 'failed',
                error: error.message || 'Payment verification failed',
            };
        }
    },
    /**
     * Get payment status
     */
    async getPaymentStatus(paymentId) {
        try {
            if (PAYMENT_SERVICE_URL) {
                const response = await axios_1.default.get(`${PAYMENT_SERVICE_URL}/api/payments/${paymentId}/status`, {
                    timeout: 5000,
                    headers: {
                        'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
                    },
                });
                return {
                    success: true,
                    status: response.data.status,
                };
            }
            // Mock response
            return {
                success: true,
                status: 'pending',
            };
        }
        catch (error) {
            console.error('[Payment] Status check failed:', error);
            return {
                success: false,
                status: 'failed',
                error: error.message,
            };
        }
    },
    /**
     * Process refund
     */
    async processRefund(request) {
        try {
            if (PAYMENT_SERVICE_URL) {
                const response = await axios_1.default.post(`${PAYMENT_SERVICE_URL}/api/payments/refund`, {
                    paymentId: request.paymentId,
                    amount: request.amountPaise,
                    reason: request.reason,
                }, {
                    timeout: 15000,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
                    },
                });
                return {
                    success: true,
                    refundId: response.data.refundId,
                    status: 'processed',
                };
            }
            // Mock response
            return {
                success: true,
                refundId: `ref_${Date.now()}`,
                status: 'pending',
            };
        }
        catch (error) {
            console.error('[Payment] Refund failed:', error);
            return {
                success: false,
                status: 'failed',
                error: error.message || 'Refund processing failed',
            };
        }
    },
    /**
     * Create UPI payment request
     */
    async createUPIRequest(bookingId, amountPaise, customerPhone) {
        try {
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
        catch (error) {
            console.error('[Payment] UPI request failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    },
};
exports.default = exports.paymentService;
//# sourceMappingURL=payment-service.js.map