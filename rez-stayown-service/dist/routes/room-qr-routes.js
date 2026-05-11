"use strict";
/**
 * Room QR API Routes
 *
 * REST API endpoints for Room QR functionality:
 * - POST /api/room-qr/generate - Generate QR for booking
 * - GET /api/room-qr/:bookingId - Get QR details
 * - POST /api/room-qr/:bookingId/send - Resend notification
 * - POST /api/room-qr/validate - Validate token
 * - POST /api/room-qr/charge - Add charge to folio
 * - GET /api/room-qr/:bookingId/bill - Get bill
 * - POST /api/room-qr/:bookingId/checkout - Process checkout
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
const express_1 = require("express");
const room_qr_1 = require("../room-qr");
const rateLimiter_1 = require("../middleware/rateLimiter");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ─── Generate QR ─────────────────────────────────────────────────────────────
/**
 * Generate QR for a booking
 * POST /api/room-qr/generate
 * Requires authentication + rate limiting
 */
router.post('/generate', auth_1.authenticateToken, rateLimiter_1.rateLimiters.qrGenerate, async (req, res) => {
    try {
        const { hotelId, hotelName, hotelSlug, roomId, roomNumber, bookingId, guestId, guestName, guestEmail, guestPhone, checkIn, checkOut } = req.body;
        // Validate required fields
        if (!hotelId || !roomId || !bookingId || !guestId || !guestEmail || !checkIn || !checkOut) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: hotelId, roomId, bookingId, guestId, guestEmail, checkIn, checkOut'
            });
        }
        const config = {
            hotelId,
            hotelName: hotelName || 'Hotel',
            hotelSlug: hotelSlug || 'hotel',
            roomId,
            roomNumber: roomNumber || 'N/A',
            bookingId,
            guestId,
            guestName: guestName || 'Guest',
            guestEmail,
            guestPhone: guestPhone || '',
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut)
        };
        const roomQR = await (0, room_qr_1.generateAndNotifyRoomQR)(config);
        console.log(`[RoomQR API] Generated QR for booking ${bookingId}`);
        res.status(201).json({
            success: true,
            data: {
                id: roomQR._id,
                bookingId: roomQR.bookingId,
                hotelId: roomQR.hotelId,
                roomId: roomQR.roomId,
                roomNumber: roomQR.roomNumber,
                qrUrl: roomQR.qrUrl,
                expiresAt: roomQR.expiresAt,
                notifications: roomQR.notifications,
                createdAt: roomQR.createdAt
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Generate failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate room QR',
            error: error.message
        });
    }
});
// ─── Get QR Details ──────────────────────────────────────────────────────────
/**
 * Get QR details for a booking
 * GET /api/room-qr/:bookingId
 * Requires authentication
 */
router.get('/:bookingId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const roomQR = await (0, room_qr_1.getRoomQRByBookingId)(bookingId);
        if (!roomQR) {
            return res.status(404).json({
                success: false,
                message: 'Room QR not found for this booking'
            });
        }
        res.json({
            success: true,
            data: {
                id: roomQR._id,
                bookingId: roomQR.bookingId,
                hotelId: roomQR.hotelId,
                roomId: roomQR.roomId,
                roomNumber: roomQR.roomNumber,
                guestName: roomQR.guestName,
                guestEmail: roomQR.guestEmail,
                qrUrl: roomQR.qrUrl,
                qrImage: roomQR.qrImage,
                checkIn: roomQR.checkIn,
                checkOut: roomQR.checkOut,
                expiresAt: roomQR.expiresAt,
                isActive: roomQR.isActive,
                useCount: roomQR.useCount,
                lastUsedAt: roomQR.lastUsedAt,
                notifications: roomQR.notifications,
                createdAt: roomQR.createdAt
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Get failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get room QR',
            error: error.message
        });
    }
});
// ─── Resend Notification ─────────────────────────────────────────────────────
/**
 * Resend QR notification
 * POST /api/room-qr/:bookingId/send
 * Requires authentication
 */
router.post('/:bookingId/send', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { channel } = req.body; // 'email', 'whatsapp', 'sms', or 'all'
        const success = await (0, room_qr_1.resendQRNotification)(bookingId);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Room QR not found or notification failed'
            });
        }
        console.log(`[RoomQR API] Resent notification for booking ${bookingId}`);
        res.json({
            success: true,
            message: `Notification sent via ${channel || 'all channels'}`,
            data: {
                bookingId,
                channel: channel || 'all'
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Resend failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend notification',
            error: error.message
        });
    }
});
// ─── Validate Token ──────────────────────────────────────────────────────────
/**
 * Validate QR token
 * POST /api/room-qr/validate
 * Rate limited: 100 requests per minute
 */
router.post('/validate', rateLimiter_1.rateLimiters.qrValidateHigh, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }
        const validation = await (0, room_qr_1.validateRoomQRToken)(token);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error,
                data: validation
            });
        }
        res.json({
            success: true,
            data: validation
        });
    }
    catch (error) {
        console.error('[RoomQR API] Validate failed:', error);
        res.status(500).json({
            success: false,
            message: 'Token validation failed',
            error: error.message
        });
    }
});
// ─── Add Charge ──────────────────────────────────────────────────────────────
/**
 * Add charge to folio
 * POST /api/room-qr/charge
 * Requires authentication + rate limiting
 */
router.post('/charge', auth_1.authenticateToken, rateLimiter_1.rateLimiters.charge, async (req, res) => {
    try {
        const { bookingId, hotelId, roomId, category, description, amountPaise, quantity = 1, unitPricePaise, source = 'manual' } = req.body;
        // Validate required fields
        if (!bookingId || !hotelId || !roomId || !category || !description || !amountPaise) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: bookingId, hotelId, roomId, category, description, amountPaise'
            });
        }
        const charge = await (0, room_qr_1.recordServiceCharge)({
            bookingId,
            hotelId,
            roomId,
            category,
            description,
            amountPaise,
            quantity,
            unitPricePaise: unitPricePaise || amountPaise,
            source: source || 'manual'
        });
        console.log(`[RoomQR API] Added charge for booking ${bookingId}: ${amountPaise} paise`);
        res.status(201).json({
            success: true,
            data: {
                id: charge._id,
                bookingId: charge.bookingId,
                category: charge.category,
                description: charge.description,
                amountPaise: charge.amountPaise,
                quantity: charge.quantity,
                unitPricePaise: charge.unitPricePaise,
                source: charge.source,
                syncedToFolio: charge.syncedToFolio,
                createdAt: charge.createdAt
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Charge failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add charge',
            error: error.message
        });
    }
});
// ─── Get Charges ─────────────────────────────────────────────────────────────
/**
 * Get charges for a booking
 * GET /api/room-qr/:bookingId/charges
 * Requires authentication
 */
router.get('/:bookingId/charges', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const charges = await (0, room_qr_1.getChargesForBooking)(bookingId);
        res.json({
            success: true,
            data: {
                bookingId,
                charges: charges.map(c => ({
                    id: c._id,
                    category: c.category,
                    description: c.description,
                    amountPaise: c.amountPaise,
                    quantity: c.quantity,
                    unitPricePaise: c.unitPricePaise,
                    source: c.source,
                    syncedToFolio: c.syncedToFolio,
                    createdAt: c.createdAt
                })),
                totalCharges: charges.length,
                totalAmountPaise: charges.reduce((sum, c) => sum + c.amountPaise, 0)
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Get charges failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get charges',
            error: error.message
        });
    }
});
// ─── Get Bill ───────────────────────────────────────────────────────────────
/**
 * Get checkout bill
 * GET /api/room-qr/:bookingId/bill
 * Requires authentication
 */
router.get('/:bookingId/bill', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const bill = await (0, room_qr_1.getCheckoutBill)(bookingId);
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found for this booking'
            });
        }
        res.json({
            success: true,
            data: {
                bookingId: bill.bookingId,
                guestName: bill.guestName,
                roomNumber: bill.roomNumber,
                checkIn: bill.checkIn,
                checkOut: bill.checkOut,
                roomCharges: bill.roomCharges,
                serviceCharges: bill.serviceCharges,
                subtotalPaise: bill.subtotalPaise,
                taxesPaise: bill.taxesPaise,
                totalPaise: bill.totalPaise,
                balanceDuePaise: bill.balanceDuePaise
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Get bill failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bill',
            error: error.message
        });
    }
});
// ─── Process Checkout ───────────────────────────────────────────────────────
/**
 * Process checkout
 * POST /api/room-qr/:bookingId/checkout
 * Requires authentication + rate limiting
 */
router.post('/:bookingId/checkout', auth_1.authenticateToken, rateLimiter_1.rateLimiters.checkout, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const summary = await (0, room_qr_1.processRoomCheckout)(bookingId);
        console.log(`[RoomQR API] Processed checkout for booking ${bookingId}`);
        res.json({
            success: true,
            data: {
                bookingId: summary.bookingId,
                guestName: summary.guestName,
                roomNumber: summary.roomNumber,
                checkIn: summary.checkIn,
                checkOut: summary.checkOut,
                roomCharges: summary.roomCharges,
                serviceCharges: summary.serviceCharges,
                subtotalPaise: summary.subtotalPaise,
                taxesPaise: summary.taxesPaise,
                totalPaise: summary.totalPaise,
                payments: summary.payments,
                balanceDuePaise: summary.balanceDuePaise,
                checkoutTime: summary.checkoutTime
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Checkout failed:', error);
        res.status(500).json({
            success: false,
            message: 'Checkout processing failed',
            error: error.message
        });
    }
});
// ─── Deactivate QR ──────────────────────────────────────────────────────────
/**
 * Deactivate QR code
 * POST /api/room-qr/:bookingId/deactivate
 * Requires authentication
 */
router.post('/:bookingId/deactivate', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const success = await (0, room_qr_1.deactivateRoomQR)(bookingId);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Room QR not found'
            });
        }
        console.log(`[RoomQR API] Deactivated QR for booking ${bookingId}`);
        res.json({
            success: true,
            message: 'QR code deactivated',
            data: { bookingId }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Deactivate failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate QR',
            error: error.message
        });
    }
});
// ─── Hotel Stats ────────────────────────────────────────────────────────────
/**
 * Get QR statistics for a hotel
 * GET /api/room-qr/hotel/:hotelId/stats
 * Requires authentication
 */
router.get('/hotel/:hotelId/stats', auth_1.authenticateToken, async (req, res) => {
    try {
        const { hotelId } = req.params;
        const stats = await (0, room_qr_1.getHotelQRStats)(hotelId);
        res.json({
            success: true,
            data: {
                hotelId,
                ...stats
            }
        });
    }
    catch (error) {
        console.error('[RoomQR API] Stats failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get stats',
            error: error.message
        });
    }
});
// ─── Webhook Handler ────────────────────────────────────────────────────────
/**
 * Handle room service webhook events
 * POST /api/room-qr/webhook
 * Requires service authentication via authenticateService middleware
 */
router.post('/webhook', auth_1.authenticateService, async (req, res) => {
    try {
        const { event, bookingId, hotelId, roomId, data } = req.body;
        // Additional webhook secret verification for extra security
        const webhookSecret = req.headers['x-webhook-secret'];
        const expectedSecret = process.env.ROOM_QR_WEBHOOK_SECRET;
        if (expectedSecret && webhookSecret !== expectedSecret) {
            return res.status(401).json({
                success: false,
                message: 'Invalid webhook secret'
            });
        }
        // Import webhook handler
        const { handleRoomServiceWebhook } = await Promise.resolve().then(() => __importStar(require('../room-qr')));
        await handleRoomServiceWebhook({
            event,
            bookingId,
            hotelId,
            roomId,
            data
        });
        res.json({
            success: true,
            message: 'Webhook processed'
        });
    }
    catch (error) {
        console.error('[RoomQR API] Webhook failed:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=room-qr-routes.js.map