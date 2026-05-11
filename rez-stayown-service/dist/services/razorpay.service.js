"use strict";
/**
 * Razorpay Payment Service
 * Handles payment processing for StayOwn bookings
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRazorpayOrder = createRazorpayOrder;
exports.verifyPaymentSignature = verifyPaymentSignature;
exports.capturePayment = capturePayment;
exports.refundPayment = refundPayment;
exports.getPayment = getPayment;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';
/**
 * Create a Razorpay order for booking
 */
async function createRazorpayOrder(params) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured');
    }
    const { amountPaise, bookingId, customerEmail, customerPhone, notes } = params;
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    try {
        const response = await axios_1.default.post(`${RAZORPAY_API_URL}/orders`, {
            amount: amountPaise,
            currency: 'INR',
            receipt: `booking_${bookingId}`,
            notes: {
                bookingId,
                ...notes,
            },
            ...(customerEmail && { email: customerEmail }),
            ...(customerPhone && { contact: customerPhone }),
        }, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        return response.data;
    }
    catch (error) {
        console.error('[Razorpay] Failed to create order:', error.response?.data || error.message);
        throw new Error(`Failed to create payment order: ${error.response?.data?.error?.description || error.message}`);
    }
}
/**
 * Verify payment signature from Razorpay webhook
 */
function verifyPaymentSignature(params) {
    if (!RAZORPAY_WEBHOOK_SECRET) {
        console.error('[Razorpay] Webhook secret not configured');
        return false;
    }
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto_1.default
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
    return expectedSignature === razorpaySignature;
}
/**
 * Capture a payment
 */
async function capturePayment(paymentId, amountPaise) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured');
    }
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    try {
        await axios_1.default.post(`${RAZORPAY_API_URL}/payments/${paymentId}/capture`, { amount: amountPaise }, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
    }
    catch (error) {
        console.error('[Razorpay] Failed to capture payment:', error.response?.data || error.message);
        throw new Error(`Failed to capture payment: ${error.response?.data?.error?.description || error.message}`);
    }
}
/**
 * Refund a payment
 */
async function refundPayment(paymentId, amountPaise) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured');
    }
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    try {
        await axios_1.default.post(`${RAZORPAY_API_URL}/payments/${paymentId}/refund`, amountPaise ? { amount: amountPaise } : {}, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
    }
    catch (error) {
        console.error('[Razorpay] Failed to refund:', error.response?.data || error.message);
        throw new Error(`Failed to process refund: ${error.response?.data?.error?.description || error.message}`);
    }
}
/**
 * Get payment details
 */
async function getPayment(paymentId) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials not configured');
    }
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    try {
        const response = await axios_1.default.get(`${RAZORPAY_API_URL}/payments/${paymentId}`, {
            headers: {
                'Authorization': `Basic ${auth}`,
            },
            timeout: 10000,
        });
        return response.data;
    }
    catch (error) {
        console.error('[Razorpay] Failed to get payment:', error.response?.data || error.message);
        throw new Error(`Failed to get payment: ${error.response?.data?.error?.description || error.message}`);
    }
}
//# sourceMappingURL=razorpay.service.js.map