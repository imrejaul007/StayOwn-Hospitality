"use strict";
/**
 * Bulk QR Generation Service
 *
 * Generate multiple Room QR codes for:
 * - Multiple bookings
 * - Batch processing
 * - Pre-generated QR codes for walk-in guests
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
exports.generateBulkRoomQRs = generateBulkRoomQRs;
exports.generateWalkinQR = generateWalkinQR;
exports.generateQRTemplate = generateQRTemplate;
const room_qr_1 = require("./room-qr");
const room_qr_2 = require("./room-qr");
/**
 * Generate QR codes for multiple bookings
 */
async function generateBulkRoomQRs(request, onProgress) {
    const results = {
        success: false,
        total: request.bookings.length,
        generated: 0,
        skipped: 0,
        failed: 0,
        results: [],
        errors: [],
    };
    const { skipNotification = false, regenerateExisting = false } = request.options || {};
    for (let i = 0; i < request.bookings.length; i++) {
        const booking = request.bookings[i];
        // Report progress
        if (onProgress) {
            onProgress({
                total: request.bookings.length,
                completed: i,
                failed: results.failed,
                current: booking.bookingId,
                percentage: Math.round((i / request.bookings.length) * 100),
            });
        }
        try {
            // Check if QR already exists
            if (!regenerateExisting) {
                const existingQR = await (0, room_qr_2.getRoomQRByBookingId)(booking.bookingId);
                if (existingQR) {
                    results.skipped += 1;
                    results.results.push({
                        bookingId: booking.bookingId,
                        success: true,
                        qrId: existingQR._id?.toString(),
                    });
                    continue;
                }
            }
            // Generate QR
            const config = {
                hotelId: booking.hotelId,
                hotelName: booking.hotelName,
                hotelSlug: booking.hotelSlug,
                roomId: booking.roomId,
                roomNumber: booking.roomNumber,
                bookingId: booking.bookingId,
                guestId: booking.guestId,
                guestName: booking.guestName,
                guestEmail: booking.guestEmail,
                guestPhone: booking.guestPhone,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
            };
            if (skipNotification) {
                // Generate without notification (for bulk processing)
                const { generateRoomQR, storeRoomQR } = await Promise.resolve().then(() => __importStar(require('./room-qr')));
                const generated = await generateRoomQR(config);
                await storeRoomQR(config, generated);
            }
            else {
                await (0, room_qr_1.generateAndNotifyRoomQR)(config);
            }
            results.generated += 1;
            results.results.push({
                bookingId: booking.bookingId,
                success: true,
            });
        }
        catch (error) {
            results.failed += 1;
            results.errors.push({
                bookingId: booking.bookingId,
                error: error.message || 'Unknown error',
            });
            results.results.push({
                bookingId: booking.bookingId,
                success: false,
                error: error.message || 'Unknown error',
            });
        }
    }
    // Final progress update
    if (onProgress) {
        onProgress({
            total: request.bookings.length,
            completed: request.bookings.length,
            failed: results.failed,
            percentage: 100,
        });
    }
    results.success = results.failed === 0;
    return results;
}
/**
 * Pre-generate QR codes for walk-in guests
 * Creates QR with a temporary booking ID
 */
async function generateWalkinQR(config) {
    const { generateRoomQR, storeRoomQR } = await Promise.resolve().then(() => __importStar(require('./room-qr')));
    const fullConfig = {
        ...config,
        bookingId: `WLK${Date.now()}`,
    };
    const generated = await generateRoomQR(fullConfig);
    return storeRoomQR(fullConfig, generated);
}
async function generateQRTemplate(hotelId) {
    const { generateRoomQR } = await Promise.resolve().then(() => __importStar(require('./room-qr')));
    const templateId = `TPL${Date.now()}`;
    // Generate a template QR (no booking attached)
    const generated = await generateRoomQR({
        hotelId,
        hotelName: '',
        hotelSlug: '',
        roomId: templateId,
        roomNumber: '',
        bookingId: templateId,
        guestId: '',
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        checkIn: new Date(),
        checkOut: new Date(),
    });
    return {
        templateId,
        qrPayload: JSON.stringify(generated.qrPayload),
        qrImage: generated.qrImage,
        expiresAt: generated.expiresAt,
        createdAt: new Date(),
    };
}
//# sourceMappingURL=room-qr-bulk.js.map