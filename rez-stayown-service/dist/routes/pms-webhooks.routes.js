"use strict";
/**
 * PMS → StayOwn Webhooks
 *
 * Receives events from Hotel-PMS:
 * - check_in: Room assigned, guest checked in
 * - check_out: Guest checked out
 * - booking_update: Booking details changed
 * - room_status_change: Room status changed
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const room_qr_1 = require("../room-qr");
const room_qr_2 = require("../room-qr");
const router = (0, express_1.Router)();
const WEBHOOK_SECRET = process.env.PMS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || 'dev-webhook-secret';
/**
 * Verify HMAC signature from PMS
 */
function verifySignature(payload, signature) {
    if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'dev-webhook-secret') {
        // Development mode - skip verification
        console.warn('[Webhook] Running in dev mode - skipping signature verification');
        return true;
    }
    const expectedSignature = crypto_1.default
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
    return crypto_1.default.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expectedSignature));
}
/**
 * Check-in Webhook
 * PMS sends this when guest is checked in and room is assigned
 *
 * Body:
 * {
 *   event: 'check_in',
 *   bookingId: string,
 *   roomId: string,
 *   roomNumber: string,
 *   roomType: string,
 *   floor?: string,
 *   guestName: string,
 *   guestEmail: string,
 *   guestPhone: string,
 *   checkInTime: string,
 *   checkOutTime: string
 * }
 */
router.post('/check-in', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const rawBody = JSON.stringify(req.body);
        // Verify signature
        if (!verifySignature(rawBody, signature)) {
            console.warn('[Webhook] Invalid signature');
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook signature',
            });
        }
        const { bookingId, roomId, roomNumber, roomType, floor, guestName, guestEmail, guestPhone, checkInTime, checkOutTime, hotelId, hotelName, hotelSlug, } = req.body;
        console.log('[Webhook] Check-in received:', {
            bookingId,
            roomId,
            roomNumber,
        });
        // Find the booking in our system
        // The bookingId from PMS should match or we need to look it up
        let roomQR = await room_qr_1.RoomQR.findOne({
            $or: [
                { bookingId: bookingId },
                { guestPhone: guestPhone },
            ],
        });
        if (!roomQR) {
            console.log('[Webhook] Booking not found, creating new Room QR');
            // Create Room QR for walk-in or external booking
            const config = {
                hotelId: hotelId || 'H001',
                hotelName: hotelName || 'Hotel',
                hotelSlug: hotelSlug || 'hotel',
                roomId: roomId,
                roomNumber: roomNumber,
                bookingId: bookingId,
                guestId: `GUEST_${Date.now()}`,
                guestName: guestName,
                guestEmail: guestEmail,
                guestPhone: guestPhone,
                checkIn: new Date(checkInTime),
                checkOut: new Date(checkOutTime),
            };
            const qr = await (0, room_qr_1.generateAndNotifyRoomQR)(config);
            roomQR = qr;
        }
        else {
            // Update existing Room QR with room assignment
            roomQR.roomId = roomId;
            roomQR.roomNumber = roomNumber;
            roomQR.isActive = true;
            roomQR.lastUsedAt = undefined;
            roomQR.useCount = 0;
            await roomQR.save();
            // Generate new QR with updated room info
            const config = {
                hotelId: roomQR.hotelId,
                hotelName: roomQR.hotelName,
                hotelSlug: roomQR.hotelSlug || 'hotel',
                roomId: roomId,
                roomNumber: roomNumber,
                bookingId: roomQR.bookingId,
                guestId: roomQR.guestId,
                guestName: roomQR.guestName,
                guestEmail: roomQR.guestEmail,
                guestPhone: roomQR.guestPhone,
                checkIn: new Date(checkInTime),
                checkOut: new Date(checkOutTime),
            };
            // Regenerate QR with new room details
            const { generateRoomQR, storeRoomQR } = await Promise.resolve().then(() => __importStar(require('../room-qr')));
            const generated = await generateRoomQR(config);
            await storeRoomQR(config, generated);
            // Update the record
            roomQR.qrPayload = JSON.stringify(generated.qrPayload);
            roomQR.qrImage = generated.qrImage;
            roomQR.expiresAt = generated.expiresAt;
            await roomQR.save();
            console.log('[Webhook] Room QR updated with room assignment');
        }
        // Send notifications to guest
        if (roomQR) {
            // In production, send actual notifications
            console.log('[Webhook] QR generated, notifications would be sent');
        }
        res.json({
            success: true,
            data: {
                bookingId,
                roomId,
                roomNumber,
                qrGenerated: true,
                qrUrl: roomQR?.qrUrl,
            },
        });
    }
    catch (error) {
        console.error('[Webhook] Check-in error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Webhook processing failed',
        });
    }
});
/**
 * Check-out Webhook
 * PMS sends this when guest checks out
 */
router.post('/check-out', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const rawBody = JSON.stringify(req.body);
        if (!verifySignature(rawBody, signature)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook signature',
            });
        }
        const { bookingId, roomId, checkoutTime } = req.body;
        console.log('[Webhook] Check-out received:', { bookingId, roomId });
        // Deactivate the Room QR
        if (bookingId) {
            await (0, room_qr_2.deactivateRoomQR)(bookingId);
        }
        res.json({
            success: true,
            data: {
                bookingId,
                checkoutProcessed: true,
            },
        });
    }
    catch (error) {
        console.error('[Webhook] Check-out error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Webhook processing failed',
        });
    }
});
/**
 * Booking Update Webhook
 * PMS sends this for any booking changes
 */
router.post('/booking-update', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const rawBody = JSON.stringify(req.body);
        if (!verifySignature(rawBody, signature)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook signature',
            });
        }
        const { bookingId, updateType, data } = req.body;
        console.log('[Webhook] Booking update:', { bookingId, updateType });
        res.json({
            success: true,
            data: { processed: true },
        });
    }
    catch (error) {
        console.error('[Webhook] Booking update error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Webhook processing failed',
        });
    }
});
/**
 * Health check for webhook endpoint
 */
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', webhook: 'stayown' });
});
exports.default = router;
//# sourceMappingURL=pms-webhooks.routes.js.map