"use strict";
/**
 * WhatsApp Business API Integration
 * FIX: Added retry logic with exponential backoff for transient failures
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = void 0;
const axios_1 = __importStar(require("axios"));
const WHATSAPP_API = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
// Timeout configuration (10 seconds default)
const REQUEST_TIMEOUT = 10000;
/**
 * Retry logic with exponential backoff for transient failures
 * Only retries on rate limits (429) and server errors (5xx)
 */
async function withRetry(operation, retries = MAX_RETRIES) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            // Check if we should retry
            if (attempt < retries && isRetryableError(error)) {
                const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                console.log(`[WhatsApp] Retry attempt ${attempt + 1}/${retries} after ${delay}ms`);
                await sleep(delay);
                continue;
            }
            // Don't retry on non-retryable errors
            break;
        }
    }
    throw lastError;
}
/**
 * Check if an error is retryable (rate limit or server error)
 */
function isRetryableError(error) {
    if (error instanceof axios_1.AxiosError) {
        const status = error.response?.status;
        // Retry on rate limit (429) or server errors (5xx)
        return status === 429 || (status !== undefined && status >= 500);
    }
    // Retry on network errors
    return true;
}
/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Pre-approved templates
const TEMPLATES = {
    booking_confirmed: {
        name: 'booking_confirmed',
        language: { code: 'en' },
        components: [
            { type: 'header', parameters: [{ type: 'text', text: '{{1}}' }] }, // Hotel name
            { type: 'body', parameters: [
                    { type: 'text', text: '{{2}}' }, // Guest name
                    { type: 'text', text: '{{3}}' }, // Check-in date
                    { type: 'text', text: '{{4}}' }, // Room number
                ] }
        ]
    },
    checkin_reminder: {
        name: 'checkin_reminder',
        language: { code: 'en' },
        components: [
            { type: 'body', parameters: [
                    { type: 'text', text: '{{1}}' }, // Guest name
                    { type: 'text', text: '{{2}}' }, // Hotel name
                    { type: 'text', text: '{{3}}' }, // Check-in time
                    { type: 'text', text: '{{4}}' }, // QR link
                ] }
        ]
    },
    room_service_ready: {
        name: 'room_service_ready',
        language: { code: 'en' },
        components: [
            { type: 'body', parameters: [
                    { type: 'text', text: '{{1}}' }, // Guest name
                    { type: 'text', text: '{{2}}' }, // Order ID
                ] }
        ]
    }
};
class WhatsAppService {
    /**
     * Send a WhatsApp template message
     * FIX: Added retry logic with exponential backoff for reliability
     */
    async sendMessage(phone, template, params) {
        const templateConfig = TEMPLATES[template];
        if (!WHATSAPP_TOKEN) {
            console.warn('[WhatsApp] WHATSAPP_ACCESS_TOKEN not configured - message not sent');
            return { success: false, error: 'WhatsApp not configured' };
        }
        // Replace template params
        let bodyParams = templateConfig.components.find(c => c.type === 'body')?.parameters || [];
        bodyParams = bodyParams.map((p, i) => ({
            ...p,
            text: params[i] || p.text
        }));
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
                name: templateConfig.name,
                language: templateConfig.language,
                components: templateConfig.components.map((c) => c.type === 'body' ? { ...c, parameters: bodyParams } : c)
            }
        };
        try {
            // Use retry logic for transient failures
            const response = await withRetry(async () => {
                return axios_1.default.post(`${WHATSAPP_API}/messages`, payload, {
                    headers: {
                        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: REQUEST_TIMEOUT
                });
            });
            console.log(`[WhatsApp] Message sent to ${phone}:`, response.data);
            return { success: true, messageId: response.data.messages?.[0]?.id };
        }
        catch (error) {
            console.error('[WhatsApp] Send failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }
    /**
     * Send a raw WhatsApp text message (for testing or simple messages)
     * FIX: Added retry logic with exponential backoff
     */
    async sendTextMessage(phone, message) {
        if (!WHATSAPP_TOKEN) {
            return { success: false, error: 'WhatsApp not configured' };
        }
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message }
        };
        try {
            // Use retry logic for transient failures
            const response = await withRetry(async () => {
                return axios_1.default.post(`${WHATSAPP_API}/messages`, payload, {
                    headers: {
                        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: REQUEST_TIMEOUT
                });
            });
            return { success: true, messageId: response.data.messages?.[0]?.id };
        }
        catch (error) {
            console.error('[WhatsApp] Send text failed:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }
    // Convenience methods
    /**
     * Send booking confirmation message
     */
    async sendBookingConfirmation(phone, data) {
        return this.sendMessage(phone, 'booking_confirmed', [
            data.hotelName,
            data.guestName,
            data.checkIn,
            data.roomNumber
        ]);
    }
    /**
     * Send check-in reminder with QR code
     */
    async sendCheckinReminder(phone, data) {
        return this.sendMessage(phone, 'checkin_reminder', [
            data.guestName,
            data.hotelName,
            data.checkInTime,
            data.qrUrl
        ]);
    }
    /**
     * Send room service ready notification
     */
    async sendServiceReady(phone, data) {
        return this.sendMessage(phone, 'room_service_ready', [
            data.guestName,
            data.orderId
        ]);
    }
    /**
     * Validate phone number format (E.164)
     */
    validatePhoneNumber(phone) {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        return e164Regex.test(phone);
    }
    /**
     * Format phone number to E.164 if needed
     */
    formatPhoneNumber(phone, countryCode = '91') {
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        // If already has country code
        if (digits.startsWith(countryCode)) {
            return `+${digits}`;
        }
        // If starts with 0, remove it and add country code
        if (digits.startsWith('0')) {
            return `+${countryCode}${digits.slice(1)}`;
        }
        // Otherwise just add country code
        return `+${countryCode}${digits}`;
    }
}
exports.whatsappService = new WhatsAppService();
//# sourceMappingURL=whatsapp.service.js.map