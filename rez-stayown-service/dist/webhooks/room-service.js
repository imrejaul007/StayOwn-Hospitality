"use strict";
/**
 * Room Service Webhook Service
 *
 * Listens for room service events from Hotel OTA and syncs to StayOwn folio.
 *
 * Events:
 * - request.created - New service request
 * - request.completed - Service completed (triggers charge)
 * - charge.added - Direct charge (minibar, etc.)
 * - checkout.requested - Guest requests checkout
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWebhook = processWebhook;
exports.registerWebhook = registerWebhook;
exports.retryWebhook = retryWebhook;
exports.processWebhookQueue = processWebhookQueue;
exports.transformRoomServiceEvent = transformRoomServiceEvent;
exports.webhookHealthCheck = webhookHealthCheck;
exports.logWebhookEvent = logWebhookEvent;
const axios_1 = __importDefault(require("axios"));
const room_qr_1 = require("../room-qr");
const WEBHOOK_SECRET = process.env.ROOM_QR_WEBHOOK_SECRET || 'webhook-secret-change-in-production';
const HOTEL_OTA_API = process.env.HOTEL_OTA_API_URL || 'http://localhost:3008';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
/**
 * Process incoming webhook from Hotel OTA
 */
async function processWebhook(payload, signature) {
    // Verify signature
    if (!verifyWebhookSignature(payload, signature)) {
        console.error('[RoomService Webhook] Invalid signature');
        return { success: false, error: 'Invalid signature' };
    }
    try {
        await (0, room_qr_1.handleRoomServiceWebhook)(payload);
        console.log(`[RoomService Webhook] Processed event: ${payload.event}`);
        return { success: true };
    }
    catch (error) {
        console.error('[RoomService Webhook] Processing failed:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Verify webhook signature (HMAC-SHA256)
 */
function verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payloadString)
        .digest('hex');
    return signature === expectedSignature;
}
/**
 * Register webhook with Hotel OTA
 */
async function registerWebhook() {
    try {
        const webhookUrl = `${process.env.STAYOWN_SERVICE_URL || 'http://localhost:4015'}/api/room-qr/webhook`;
        const response = await axios_1.default.post(`${HOTEL_OTA_API}/v1/webhooks`, {
            url: webhookUrl,
            events: ['request.created', 'request.completed', 'charge.added', 'checkout.requested'],
            secret: WEBHOOK_SECRET,
            description: 'StayOwn Room Service Sync'
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.data.success) {
            console.log('[RoomService Webhook] Registered with Hotel OTA');
            return true;
        }
        console.error('[RoomService Webhook] Registration failed:', response.data.message);
        return false;
    }
    catch (error) {
        console.error('[RoomService Webhook] Registration error:', error.message);
        return false;
    }
}
/**
 * Retry failed webhook processing
 */
async function retryWebhook(payload, maxRetries = RETRY_ATTEMPTS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await (0, room_qr_1.handleRoomServiceWebhook)(payload);
            console.log(`[RoomService Webhook] Retry ${attempt} succeeded`);
            return true;
        }
        catch (error) {
            console.error(`[RoomService Webhook] Retry ${attempt} failed:`, error.message);
            if (attempt < maxRetries) {
                await sleep(RETRY_DELAY_MS * attempt);
            }
        }
    }
    return false;
}
/**
 * Handle webhook queue processing (for background jobs)
 */
async function processWebhookQueue() {
    // In production, this would process a queue of failed webhooks
    // For now, just log that the service is running
    console.log('[RoomService Webhook] Queue processor running');
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Event transformer - converts Hotel OTA events to StayOwn format
 */
function transformRoomServiceEvent(hotelOtaEvent) {
    return {
        event: hotelOtaEvent.type,
        bookingId: hotelOtaEvent.bookingId,
        hotelId: hotelOtaEvent.hotelId,
        roomId: hotelOtaEvent.roomId,
        data: {
            serviceType: hotelOtaEvent.serviceType,
            description: hotelOtaEvent.description,
            totalAmountPaise: hotelOtaEvent.totalAmountPaise,
            quantity: hotelOtaEvent.quantity,
            unitPricePaise: hotelOtaEvent.unitPricePaise,
            category: hotelOtaEvent.category || hotelOtaEvent.serviceType,
            source: hotelOtaEvent.source,
            ...hotelOtaEvent.data
        }
    };
}
/**
 * Webhook health check
 */
async function webhookHealthCheck() {
    try {
        // In production, check database for registered webhooks
        return {
            status: 'healthy',
            lastCheck: new Date(),
            registeredHotels: 0 // Would query database
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            lastCheck: new Date(),
            registeredHotels: 0
        };
    }
}
/**
 * Event logging for audit trail
 */
async function logWebhookEvent(event, result, error) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event: event.event,
        bookingId: event.bookingId,
        hotelId: event.hotelId,
        roomId: event.roomId,
        result,
        error: error || null,
        payload: JSON.stringify(event.data)
    };
    console.log('[RoomService Webhook]', JSON.stringify(logEntry));
    // In production, store in database for audit trail
    // await WebhookLog.create(logEntry);
}
//# sourceMappingURL=room-service.js.map