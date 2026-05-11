"use strict";
/**
 * WhatsApp Business Routes - REZ Marketing Platform Integration
 *
 * Provides REST API endpoints for sending WhatsApp notifications
 * to hotel guests for StayOwn bookings and services.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_service_1 = require("../services/whatsapp.service");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * POST /api/whatsapp/send
 * Send a WhatsApp template message
 *
 * Body:
 *   - phone: string (E.164 format or raw number)
 *   - template: 'booking_confirmed' | 'checkin_reminder' | 'room_service_ready'
 *   - params: string[] (template parameters)
 *   - countryCode?: string (default: 91 for India)
 */
router.post('/send', auth_1.validateApiKey, async (req, res) => {
    try {
        const { phone, template, params, countryCode } = req.body;
        // Validate required fields
        if (!phone || !template) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: phone, template'
            });
        }
        // Validate template name
        const validTemplates = ['booking_confirmed', 'checkin_reminder', 'room_service_ready'];
        if (!validTemplates.includes(template)) {
            return res.status(400).json({
                success: false,
                error: `Invalid template. Must be one of: ${validTemplates.join(', ')}`
            });
        }
        // Validate params array
        if (!Array.isArray(params)) {
            return res.status(400).json({
                success: false,
                error: 'params must be an array'
            });
        }
        // Format phone number
        const formattedPhone = whatsapp_service_1.whatsappService.formatPhoneNumber(phone, countryCode || '91');
        // Validate E.164 format
        if (!whatsapp_service_1.whatsappService.validatePhoneNumber(formattedPhone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Expected E.164 format (e.g., +919876543210)'
            });
        }
        // Send message
        const result = await whatsapp_service_1.whatsappService.sendMessage(formattedPhone, template, params);
        if (result.success) {
            return res.json({
                success: true,
                message: 'WhatsApp message sent successfully',
                messageId: result.messageId,
                phone: formattedPhone
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: 'Failed to send WhatsApp message',
                details: result.error
            });
        }
    }
    catch (error) {
        console.error('[WhatsApp Routes] Send error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});
/**
 * POST /api/whatsapp/send/booking-confirmation
 * Send booking confirmation notification
 *
 * Body:
 *   - phone: string
 *   - hotelName: string
 *   - guestName: string
 *   - checkIn: string (date/time)
 *   - roomNumber: string
 *   - countryCode?: string
 */
router.post('/send/booking-confirmation', auth_1.validateApiKey, async (req, res) => {
    try {
        const { phone, hotelName, guestName, checkIn, roomNumber, countryCode } = req.body;
        // Validate required fields
        const missingFields = [];
        if (!phone)
            missingFields.push('phone');
        if (!hotelName)
            missingFields.push('hotelName');
        if (!guestName)
            missingFields.push('guestName');
        if (!checkIn)
            missingFields.push('checkIn');
        if (!roomNumber)
            missingFields.push('roomNumber');
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        const formattedPhone = whatsapp_service_1.whatsappService.formatPhoneNumber(phone, countryCode || '91');
        const result = await whatsapp_service_1.whatsappService.sendBookingConfirmation(formattedPhone, {
            hotelName,
            guestName,
            checkIn,
            roomNumber
        });
        return res.json({
            success: result.success,
            message: result.success ? 'Booking confirmation sent' : 'Failed to send',
            messageId: result.messageId,
            error: result.error
        });
    }
    catch (error) {
        console.error('[WhatsApp Routes] Booking confirmation error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/whatsapp/send/checkin-reminder
 * Send check-in reminder with QR code link
 *
 * Body:
 *   - phone: string
 *   - guestName: string
 *   - hotelName: string
 *   - checkInTime: string
 *   - qrUrl: string
 *   - countryCode?: string
 */
router.post('/send/checkin-reminder', auth_1.validateApiKey, async (req, res) => {
    try {
        const { phone, guestName, hotelName, checkInTime, qrUrl, countryCode } = req.body;
        const missingFields = [];
        if (!phone)
            missingFields.push('phone');
        if (!guestName)
            missingFields.push('guestName');
        if (!hotelName)
            missingFields.push('hotelName');
        if (!checkInTime)
            missingFields.push('checkInTime');
        if (!qrUrl)
            missingFields.push('qrUrl');
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        const formattedPhone = whatsapp_service_1.whatsappService.formatPhoneNumber(phone, countryCode || '91');
        const result = await whatsapp_service_1.whatsappService.sendCheckinReminder(formattedPhone, {
            guestName,
            hotelName,
            checkInTime,
            qrUrl
        });
        return res.json({
            success: result.success,
            message: result.success ? 'Check-in reminder sent' : 'Failed to send',
            messageId: result.messageId,
            error: result.error
        });
    }
    catch (error) {
        console.error('[WhatsApp Routes] Checkin reminder error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/whatsapp/send/service-ready
 * Send room service ready notification
 *
 * Body:
 *   - phone: string
 *   - guestName: string
 *   - orderId: string
 *   - countryCode?: string
 */
router.post('/send/service-ready', auth_1.validateApiKey, async (req, res) => {
    try {
        const { phone, guestName, orderId, countryCode } = req.body;
        const missingFields = [];
        if (!phone)
            missingFields.push('phone');
        if (!guestName)
            missingFields.push('guestName');
        if (!orderId)
            missingFields.push('orderId');
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        const formattedPhone = whatsapp_service_1.whatsappService.formatPhoneNumber(phone, countryCode || '91');
        const result = await whatsapp_service_1.whatsappService.sendServiceReady(formattedPhone, {
            guestName,
            orderId
        });
        return res.json({
            success: result.success,
            message: result.success ? 'Service ready notification sent' : 'Failed to send',
            messageId: result.messageId,
            error: result.error
        });
    }
    catch (error) {
        console.error('[WhatsApp Routes] Service ready error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * POST /api/whatsapp/send/bulk
 * Send bulk WhatsApp messages (batch operation)
 *
 * Body:
 *   - messages: Array<{
 *       phone: string,
 *       template: string,
 *       params: string[],
 *       countryCode?: string
 *     }>
 */
router.post('/send/bulk', auth_1.validateApiKey, async (req, res) => {
    try {
        const { messages } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'messages must be a non-empty array'
            });
        }
        // Limit batch size
        const MAX_BATCH_SIZE = 100;
        if (messages.length > MAX_BATCH_SIZE) {
            return res.status(400).json({
                success: false,
                error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} messages`
            });
        }
        const results = [];
        // Process messages sequentially to avoid rate limiting
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const formattedPhone = whatsapp_service_1.whatsappService.formatPhoneNumber(msg.phone, msg.countryCode || '91');
            const result = await whatsapp_service_1.whatsappService.sendMessage(formattedPhone, msg.template, msg.params || []);
            results.push({
                index: i,
                success: result.success,
                messageId: result.messageId,
                error: result.error
            });
            // Small delay between messages to avoid rate limiting
            if (i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        return res.json({
            success: true,
            message: `Processed ${messages.length} messages`,
            summary: {
                total: messages.length,
                successful: successCount,
                failed: failureCount
            },
            results
        });
    }
    catch (error) {
        console.error('[WhatsApp Routes] Bulk send error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * GET /api/whatsapp/templates
 * List available WhatsApp templates
 */
router.get('/templates', auth_1.validateApiKey, (_req, res) => {
    return res.json({
        success: true,
        templates: [
            {
                name: 'booking_confirmed',
                description: 'Booking confirmation with hotel name, guest name, check-in date, and room number',
                parameters: ['hotelName', 'guestName', 'checkIn', 'roomNumber']
            },
            {
                name: 'checkin_reminder',
                description: 'Check-in reminder with guest name, hotel name, time, and QR link',
                parameters: ['guestName', 'hotelName', 'checkInTime', 'qrUrl']
            },
            {
                name: 'room_service_ready',
                description: 'Room service ready notification with guest name and order ID',
                parameters: ['guestName', 'orderId']
            }
        ]
    });
});
/**
 * POST /api/whatsapp/webhook
 * WhatsApp webhook for incoming messages and delivery status
 *
 * This endpoint receives:
 * - Incoming messages from users
 * - Delivery status updates (delivered, read, failed)
 */
router.post('/webhook', async (req, res) => {
    try {
        // Verify webhook signature (Meta webhook verification)
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        // Verify token for webhook setup
        if (mode === 'subscribe') {
            const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
            if (expectedToken && token === expectedToken) {
                console.log('[WhatsApp Webhook] Verified successfully');
                return res.status(200).send(challenge);
            }
            else {
                return res.status(403).json({ error: 'Verification failed' });
            }
        }
        // Handle incoming webhook events
        const { entry } = req.body;
        if (!entry || !entry[0]?.changes) {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }
        for (const change of entry[0].changes) {
            if (change.value?.messages) {
                for (const message of change.value.messages) {
                    console.log('[WhatsApp Webhook] Received message:', {
                        from: message.from,
                        type: message.type,
                        timestamp: message.timestamp
                    });
                    // Log incoming message for analytics
                    // In production, you would store this in a database
                    await handleIncomingMessage(message);
                }
            }
            if (change.value?.statuses) {
                for (const status of change.value.statuses) {
                    console.log('[WhatsApp Webhook] Status update:', {
                        id: status.id,
                        status: status.status,
                        timestamp: status.timestamp
                    });
                    // Update message delivery status
                    await handleStatusUpdate(status);
                }
            }
        }
        return res.status(200).json({ status: 'ok' });
    }
    catch (error) {
        console.error('[WhatsApp Webhook] Error:', error);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
});
/**
 * GET /api/whatsapp/webhook
 * WhatsApp webhook verification endpoint
 */
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe') {
        const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
        if (expectedToken && token === expectedToken) {
            console.log('[WhatsApp Webhook] Webhook verified successfully');
            res.status(200).send(challenge);
        }
        else {
            res.status(403).send('Verification failed');
        }
    }
    else {
        res.status(200).send('WhatsApp webhook endpoint active');
    }
});
/**
 * POST /api/whatsapp/test
 * Test endpoint - send a simple text message (no template)
 */
router.post('/test', auth_1.validateApiKey, async (req, res) => {
    try {
        const { phone, message, countryCode } = req.body;
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing phone or message'
            });
        }
        const formattedPhone = whatsapp_service_1.whatsappService.formatPhoneNumber(phone, countryCode || '91');
        const result = await whatsapp_service_1.whatsappService.sendTextMessage(formattedPhone, message);
        return res.json({
            success: result.success,
            messageId: result.messageId,
            error: result.error
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// Helper functions
async function handleIncomingMessage(message) {
    // Log incoming message
    console.log(`[WhatsApp] Incoming message from ${message.from}:`, message.text?.body || message);
    // In production, you would:
    // 1. Store the message in a database
    // 2. Parse commands (e.g., "CHECKIN", "CHECKOUT", "STATUS")
    // 3. Trigger appropriate actions
    // 4. Send automated responses
    // Example: Respond to "HELP" command
    if (message.text?.body?.toUpperCase() === 'HELP') {
        await whatsapp_service_1.whatsappService.sendTextMessage(message.from, 'Welcome to StayOwn! Available commands:\n' +
            'CHECKIN - Start check-in process\n' +
            'CHECKOUT - Start check-out process\n' +
            'ROOM SERVICE - Order room service\n' +
            'STATUS - View booking status');
    }
}
async function handleStatusUpdate(status) {
    // Log status update
    console.log(`[WhatsApp] Message ${status.id} status: ${status.status}`);
    // In production, you would:
    // 1. Update message status in database
    // 2. Track delivery metrics
    // 3. Handle failures (retry or alert)
}
exports.default = router;
//# sourceMappingURL=whatsapp.routes.js.map