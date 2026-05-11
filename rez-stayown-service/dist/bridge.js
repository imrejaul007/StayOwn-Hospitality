"use strict";
/**
 * StayOwn Bridge - Integration with Hotel PMS
 *
 * This module handles communication between StayOwn (OTA) and Hotel PMS.
 * Key integrations:
 * 1. Folio sync - charges from Room QR to PMS billing
 * 2. Booking sync - booking creation and updates
 * 3. Room assignment - link Room QR to PMS room data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addChargeToFolio = addChargeToFolio;
exports.getBookingFolio = getBookingFolio;
exports.completeCheckout = completeCheckout;
exports.assignRoomToBooking = assignRoomToBooking;
exports.getRoomDetails = getRoomDetails;
exports.syncBookingToPMS = syncBookingToPMS;
exports.getBookingFromPMS = getBookingFromPMS;
exports.handlePMSWebhook = handlePMSWebhook;
exports.checkPMSHealth = checkPMSHealth;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./config/logger");
// ─── Configuration ─────────────────────────────────────────────────────────────
const PMS_URL = process.env.HOTEL_PMS_URL || process.env.HOTEL_OTA_API || 'http://localhost:3008';
const SERVICE_KEY = process.env.INTERNAL_SERVICE_TOKEN || '';
// ─── Axios Client ───────────────────────────────────────────────────────────────
const createPMSClient = () => {
    return axios_1.default.create({
        baseURL: PMS_URL,
        timeout: 10000,
        headers: {
            'Content-Type': 'application/json',
            'x-service-key': SERVICE_KEY,
        },
    });
};
// ─── Folio Sync ────────────────────────────────────────────────────────────────
/**
 * Add a charge to guest folio in Hotel PMS
 */
async function addChargeToFolio(charge) {
    try {
        const client = createPMSClient();
        logger_1.logger.info('[Bridge] Adding charge to folio', {
            bookingId: charge.bookingId,
            category: charge.category,
            amountPaise: charge.amountPaise,
        });
        const response = await client.post('/v1/room-service/charge', {
            bookingId: charge.bookingId,
            hotelId: charge.hotelId,
            category: charge.category,
            description: charge.description,
            amountPaise: charge.amountPaise,
            quantity: charge.quantity || 1,
            unitPricePaise: charge.unitPricePaise || charge.amountPaise,
            source: charge.source,
        });
        if (response.data?.success) {
            return {
                success: true,
                transactionId: response.data.data?.transactionId,
            };
        }
        return {
            success: false,
            error: response.data?.message || 'Unknown error',
        };
    }
    catch (error) {
        logger_1.logger.error('[Bridge] Failed to add charge to folio', {
            bookingId: charge.bookingId,
            error: error.message,
        });
        return {
            success: false,
            error: error.message,
        };
    }
}
/**
 * Get folio for a booking (charges + payments)
 */
async function getBookingFolio(bookingId) {
    try {
        const client = createPMSClient();
        const response = await client.get(`/v1/room-service/checkout/${bookingId}/bill`);
        if (response.data?.success) {
            return {
                success: true,
                data: response.data.data,
            };
        }
        return {
            success: false,
            error: response.data?.message || 'Failed to get folio',
        };
    }
    catch (error) {
        logger_1.logger.error('[Bridge] Failed to get booking folio', {
            bookingId,
            error: error.message,
        });
        return {
            success: false,
            error: error.message,
        };
    }
}
/**
 * Complete checkout in PMS
 */
async function completeCheckout(bookingId, paymentDetails) {
    try {
        const client = createPMSClient();
        logger_1.logger.info('[Bridge] Completing checkout', { bookingId });
        const response = await client.post(`/v1/staff/checkout/${bookingId}/complete`, {
            bookingId,
            ...(paymentDetails && { payment: paymentDetails }),
        });
        if (response.data?.success) {
            return {
                success: true,
                checkoutId: response.data.data?.checkoutId,
            };
        }
        return {
            success: false,
            error: response.data?.message || 'Checkout failed',
        };
    }
    catch (error) {
        logger_1.logger.error('[Bridge] Failed to complete checkout', {
            bookingId,
            error: error.message,
        });
        return {
            success: false,
            error: error.message,
        };
    }
}
// ─── Room Assignment ───────────────────────────────────────────────────────────
/**
 * Link Room QR to PMS room assignment
 */
async function assignRoomToBooking(assignment) {
    try {
        const client = createPMSClient();
        logger_1.logger.info('[Bridge] Assigning room to booking', {
            bookingId: assignment.bookingId,
            roomNumber: assignment.roomNumber,
        });
        const response = await client.post('/v1/hotel/room-assignment', {
            bookingId: assignment.bookingId,
            hotelId: assignment.hotelId,
            roomId: assignment.roomId,
            roomNumber: assignment.roomNumber,
            floorNumber: assignment.floorNumber,
        });
        return {
            success: response.data?.success || false,
            error: response.data?.message,
        };
    }
    catch (error) {
        logger_1.logger.error('[Bridge] Failed to assign room', {
            bookingId: assignment.bookingId,
            error: error.message,
        });
        return {
            success: false,
            error: error.message,
        };
    }
}
/**
 * Get room details from PMS
 */
async function getRoomDetails(hotelId, roomId) {
    try {
        const client = createPMSClient();
        const response = await client.get(`/v1/hotel/rooms/${roomId}`, {
            params: { hotelId },
        });
        if (response.data?.success) {
            return {
                success: true,
                data: response.data.data,
            };
        }
        return {
            success: false,
            error: response.data?.message || 'Room not found',
        };
    }
    catch (error) {
        logger_1.logger.error('[Bridge] Failed to get room details', {
            hotelId,
            roomId,
            error: error.message,
        });
        return {
            success: false,
            error: error.message,
        };
    }
}
// ─── Booking Sync ──────────────────────────────────────────────────────────────
/**
 * Sync booking status from StayOwn to PMS
 */
async function syncBookingToPMS(booking) {
    try {
        const client = createPMSClient();
        logger_1.logger.info('[Bridge] Syncing booking to PMS', {
            stayownBookingId: booking.bookingId,
            status: booking.status,
        });
        const response = await client.post('/v1/bookings/sync', {
            source: 'stayown',
            bookingId: booking.bookingId,
            propertyId: booking.propertyId,
            roomTypeId: booking.roomTypeId,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            guestName: booking.guestName,
            guestEmail: booking.guestEmail,
            guestPhone: booking.guestPhone,
            status: booking.status,
        });
        if (response.data?.success) {
            return {
                success: true,
                pmsBookingId: response.data.data?.pmsBookingId,
            };
        }
        return {
            success: false,
            error: response.data?.message || 'Sync failed',
        };
    }
    catch (error) {
        logger_1.logger.error('[Bridge] Failed to sync booking', {
            stayownBookingId: booking.bookingId,
            error: error.message,
        });
        return {
            success: false,
            error: error.message,
        };
    }
}
/**
 * Get booking from PMS
 */
async function getBookingFromPMS(bookingId) {
    try {
        const client = createPMSClient();
        const response = await client.get(`/v1/bookings/${bookingId}`);
        if (response.data?.success) {
            return {
                success: true,
                data: response.data.data,
            };
        }
        return {
            success: false,
            error: response.data?.message || 'Booking not found',
        };
    }
    catch (error) {
        logger_1.logger.error('[Bridge] Failed to get booking from PMS', {
            bookingId,
            error: error.message,
        });
        return {
            success: false,
            error: error.message,
        };
    }
}
// ─── Webhook Forwarding ─────────────────────────────────────────────────────────
/**
 * Forward webhook from PMS to StayOwn handlers
 */
async function handlePMSWebhook(event, data) {
    logger_1.logger.info('[Bridge] Received PMS webhook', { event });
    switch (event) {
        case 'guest.checkin':
            logger_1.logger.info('[Bridge] Guest checked in', { bookingId: data.bookingId });
            // Could trigger Room QR activation here
            break;
        case 'guest.checkout':
            logger_1.logger.info('[Bridge] Guest checking out', { bookingId: data.bookingId });
            // Could trigger checkout process
            break;
        case 'reservation.cancelled':
            logger_1.logger.info('[Bridge] Reservation cancelled', { bookingId: data.bookingId });
            // Could deactivate Room QR
            break;
        default:
            logger_1.logger.warn('[Bridge] Unknown PMS webhook event', { event });
    }
}
// ─── Health Check ──────────────────────────────────────────────────────────────
/**
 * Check PMS connectivity
 */
async function checkPMSHealth() {
    const start = Date.now();
    try {
        const client = createPMSClient();
        await client.get('/health');
        return {
            connected: true,
            latencyMs: Date.now() - start,
        };
    }
    catch (error) {
        return {
            connected: false,
            error: error.message,
        };
    }
}
//# sourceMappingURL=bridge.js.map