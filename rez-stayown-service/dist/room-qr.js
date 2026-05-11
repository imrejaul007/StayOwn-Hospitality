"use strict";
/**
 * Room QR Integration Module for StayOwn Hotel Booking
 *
 * Features:
 * 1. Auto-generate Room QR when booking is confirmed
 * 2. Send QR to guest via email/WhatsApp/SMS
 * 3. Track Room QR usage
 * 4. Sync charges to StayOwn folio
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
exports.ServiceCharge = exports.RoomQR = void 0;
exports.generateRoomQR = generateRoomQR;
exports.storeRoomQR = storeRoomQR;
exports.getRoomQRByBookingId = getRoomQRByBookingId;
exports.getRoomQRByToken = getRoomQRByToken;
exports.validateRoomQRToken = validateRoomQRToken;
exports.notifyGuestBooking = notifyGuestBooking;
exports.recordServiceCharge = recordServiceCharge;
exports.syncChargeToFolio = syncChargeToFolio;
exports.getChargesForBooking = getChargesForBooking;
exports.syncAllChargesToFolio = syncAllChargesToFolio;
exports.processRoomCheckout = processRoomCheckout;
exports.getCheckoutBill = getCheckoutBill;
exports.generateAndNotifyRoomQR = generateAndNotifyRoomQR;
exports.resendQRNotification = resendQRNotification;
exports.handleRoomServiceWebhook = handleRoomServiceWebhook;
exports.deactivateRoomQR = deactivateRoomQR;
exports.getHotelQRStats = getHotelQRStats;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const qrcode_1 = __importDefault(require("qrcode"));
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const rez_mind_client_1 = require("./services/rez-mind-client");
// Configuration - FAIL CLOSED if secrets not configured in production
function getJwtSecret() {
    const secret = process.env.ROOM_QR_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CRITICAL: ROOM_QR_JWT_SECRET or JWT_SECRET must be configured in production');
        }
        console.warn('[Security] WARNING: Using fallback JWT secret - DO NOT use in production');
        return 'dev-only-fallback-secret-do-not-use-in-production';
    }
    return secret;
}
const JWT_SECRET = getJwtSecret();
const QR_BASE_URL = process.env.ROOM_QR_BASE_URL || 'https://rez.money/room';
const HOTEL_OTA_API = process.env.HOTEL_OTA_API_URL || 'http://localhost:3008';
// ─── MongoDB Schemas ─────────────────────────────────────────────────────────
const RoomQRSchema = new mongoose_1.default.Schema({
    bookingId: { type: String, required: true, unique: true, index: true },
    hotelId: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    roomNumber: { type: String, required: true },
    guestId: { type: String, required: true },
    guestName: { type: String, required: true },
    guestEmail: { type: String, required: true },
    guestPhone: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    qrPayload: { type: String, required: true },
    qrImage: { type: String, required: true },
    qrUrl: { type: String, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    useCount: { type: Number, default: 0 },
    notifications: {
        emailSent: { type: Boolean, default: false },
        emailSentAt: { type: Date },
        whatsappSent: { type: Boolean, default: false },
        whatsappSentAt: { type: Date },
        smsSent: { type: Boolean, default: false },
        smsSentAt: { type: Date }
    }
}, { timestamps: true });
const ServiceChargeSchema = new mongoose_1.default.Schema({
    bookingId: { type: String, required: true, index: true },
    hotelId: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    unitPricePaise: { type: Number, required: true },
    source: {
        type: String,
        enum: ['minibar', 'room_service', 'laundry', 'restaurant', 'spa', 'transport', 'manual'],
        default: 'manual'
    },
    syncedToFolio: { type: Boolean, default: false },
    syncedAt: { type: Date },
    folioTransactionId: { type: String }
}, { timestamps: true });
// ─── Models ─────────────────────────────────────────────────────────────────
exports.RoomQR = mongoose_1.default.models.RoomQR || mongoose_1.default.model('RoomQR', RoomQRSchema);
exports.ServiceCharge = mongoose_1.default.models.ServiceCharge || mongoose_1.default.model('ServiceCharge', ServiceChargeSchema);
// ─── QR Generation ───────────────────────────────────────────────────────────
/**
 * Generate Room QR for a booking
 */
async function generateRoomQR(config) {
    try {
        // Calculate expiry (checkOut + 24 hours)
        const expiresAt = new Date(config.checkOut);
        expiresAt.setHours(expiresAt.getHours() + 24);
        // Create JWT token with HMAC
        const tokenPayload = {
            intent: 'room_access',
            hotelId: config.hotelId,
            roomId: config.roomId,
            bookingId: config.bookingId,
            guestId: config.guestId,
            checkIn: config.checkIn.toISOString(),
            checkOut: config.checkOut.toISOString(),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(expiresAt.getTime() / 1000)
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, JWT_SECRET, { algorithm: 'HS256' });
        // Create QR payload
        const qrPayload = {
            intent: 'room_access',
            hotelId: config.hotelId,
            roomId: config.roomId,
            bookingId: config.bookingId,
            guestId: config.guestId,
            token,
            checkIn: config.checkIn.toISOString(),
            checkOut: config.checkOut.toISOString()
        };
        const qrPayloadString = JSON.stringify(qrPayload);
        const qrUrl = `${QR_BASE_URL}/${config.hotelSlug}/${config.roomId}?qr=${encodeURIComponent(qrPayloadString)}`;
        // Generate QR code as base64 PNG
        const qrImage = await qrcode_1.default.toDataURL(qrUrl, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        return {
            qrPayload,
            qrImage,
            qrUrl,
            token,
            expiresAt
        };
    }
    catch (error) {
        console.error('[RoomQR] Failed to generate QR:', error);
        throw new Error('Failed to generate room QR code');
    }
}
// ─── QR Storage ──────────────────────────────────────────────────────────────
/**
 * Store generated QR in database
 */
async function storeRoomQR(config, generatedQR) {
    try {
        // Check if QR already exists for this booking
        const existing = await exports.RoomQR.findOne({ bookingId: config.bookingId });
        if (existing) {
            // Update existing record
            existing.token = generatedQR.token;
            existing.qrPayload = JSON.stringify(generatedQR.qrPayload);
            existing.qrImage = generatedQR.qrImage;
            existing.qrUrl = generatedQR.qrUrl;
            existing.expiresAt = generatedQR.expiresAt;
            existing.isActive = true;
            existing.notifications = {
                emailSent: false,
                whatsappSent: false,
                smsSent: false
            };
            await existing.save();
            return existing;
        }
        // Create new record
        const roomQR = new exports.RoomQR({
            bookingId: config.bookingId,
            hotelId: config.hotelId,
            roomId: config.roomId,
            roomNumber: config.roomNumber,
            guestId: config.guestId,
            guestName: config.guestName,
            guestEmail: config.guestEmail,
            guestPhone: config.guestPhone,
            token: generatedQR.token,
            qrPayload: JSON.stringify(generatedQR.qrPayload),
            qrImage: generatedQR.qrImage,
            qrUrl: generatedQR.qrUrl,
            checkIn: config.checkIn,
            checkOut: config.checkOut,
            expiresAt: generatedQR.expiresAt,
            isActive: true,
            useCount: 0,
            notifications: {
                emailSent: false,
                whatsappSent: false,
                smsSent: false
            }
        });
        await roomQR.save();
        return roomQR;
    }
    catch (error) {
        console.error('[RoomQR] Failed to store QR:', error);
        throw new Error('Failed to store room QR');
    }
}
/**
 * Get QR details for a booking
 */
async function getRoomQRByBookingId(bookingId) {
    return exports.RoomQR.findOne({ bookingId });
}
/**
 * Get QR details by token
 */
async function getRoomQRByToken(token) {
    return exports.RoomQR.findOne({ token });
}
// ─── Token Validation ────────────────────────────────────────────────────────
/**
 * Validate Room QR token
 */
async function validateRoomQRToken(token) {
    try {
        // Find the QR record
        const qrRecord = await exports.RoomQR.findOne({ token });
        if (!qrRecord) {
            return { valid: false, error: 'QR code not found' };
        }
        if (!qrRecord.isActive) {
            return { valid: false, error: 'QR code is no longer active' };
        }
        // Verify JWT signature and expiration
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        }
        catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return { valid: false, error: 'QR code has expired' };
            }
            return { valid: false, error: 'Invalid QR code token' };
        }
        // Check if token matches record
        if (decoded.bookingId !== qrRecord.bookingId) {
            return { valid: false, error: 'Token mismatch' };
        }
        // Update usage statistics
        qrRecord.useCount += 1;
        qrRecord.lastUsedAt = new Date();
        await qrRecord.save();
        // Determine service permissions based on time
        const now = new Date();
        const canUseServices = now >= qrRecord.checkIn && now <= qrRecord.checkOut;
        const canCheckout = now >= qrRecord.checkIn && now <= qrRecord.expiresAt;
        return {
            valid: true,
            hotelId: qrRecord.hotelId,
            roomId: qrRecord.roomId,
            bookingId: qrRecord.bookingId,
            guestId: qrRecord.guestId,
            roomNumber: qrRecord.roomNumber,
            expiresAt: qrRecord.expiresAt,
            canUseServices,
            canCheckout
        };
    }
    catch (error) {
        console.error('[RoomQR] Token validation error:', error);
        return { valid: false, error: 'Validation failed' };
    }
}
// ─── Guest Notification ──────────────────────────────────────────────────────
/**
 * Send QR notification to guest via multiple channels
 */
async function notifyGuestBooking(hotelId, bookingId, qrData) {
    const promises = [];
    // Send email
    if (qrData.guestEmail) {
        promises.push(sendEmailNotification(qrData));
    }
    // Send WhatsApp
    if (qrData.guestPhone) {
        promises.push(sendWhatsAppNotification(qrData));
    }
    // Send SMS (fallback)
    if (qrData.guestPhone) {
        promises.push(sendSMSNotification(qrData));
    }
    // Wait for all notifications
    await Promise.allSettled(promises);
    // Update notification status in database
    const roomQR = await exports.RoomQR.findOne({ bookingId });
    if (roomQR) {
        const now = new Date();
        roomQR.notifications = {
            emailSent: !!qrData.guestEmail,
            emailSentAt: qrData.guestEmail ? now : undefined,
            whatsappSent: !!qrData.guestPhone,
            whatsappSentAt: qrData.guestPhone ? now : undefined,
            smsSent: !!qrData.guestPhone,
            smsSentAt: qrData.guestPhone ? now : undefined
        };
        await roomQR.save();
    }
}
async function sendEmailNotification(data) {
    try {
        // Dynamic import for email template
        const { generateRoomQREmail } = await Promise.resolve().then(() => __importStar(require('./templates/room-qr-email')));
        const emailHtml = generateRoomQREmail({
            guestName: data.guestName,
            hotelName: data.hotelName,
            roomNumber: data.roomNumber,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            qrImage: data.qrImage,
            qrUrl: data.qrUrl
        });
        // Send via email service (e.g., SendGrid, Resend)
        const emailService = process.env.EMAIL_SERVICE_URL || 'http://localhost:4003';
        await axios_1.default.post(`${emailService}/api/send`, {
            to: data.guestEmail,
            subject: `Your Room QR Code - ${data.hotelName}`,
            html: emailHtml,
            from: `noreply@rez.money`
        }, {
            timeout: 10000
        });
        console.log(`[RoomQR] Email sent to ${data.guestEmail}`);
    }
    catch (error) {
        console.error('[RoomQR] Email notification failed:', error);
        // Don't throw - continue with other notification methods
    }
}
async function sendWhatsAppNotification(data) {
    try {
        const message = `Hello ${data.guestName}!

Welcome to ${data.hotelName}!

Your Room QR Code:
Room: ${data.roomNumber}
Check-in: ${data.checkIn.toLocaleDateString()}
Check-out: ${data.checkOut.toLocaleDateString()}

Scan the QR code in your email or use this link:
${data.qrUrl}

Best regards,
${data.hotelName}`;
        // Send via WhatsApp service
        const whatsappService = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:4004';
        await axios_1.default.post(`${whatsappService}/api/send`, {
            to: data.guestPhone,
            message,
            type: 'text'
        }, {
            timeout: 10000
        });
        console.log(`[RoomQR] WhatsApp sent to ${data.guestPhone}`);
    }
    catch (error) {
        console.error('[RoomQR] WhatsApp notification failed:', error);
    }
}
async function sendSMSNotification(data) {
    try {
        const message = `Your ${data.hotelName} Room QR: ${data.qrUrl} - Room ${data.roomNumber}`;
        // Send via SMS service
        const smsService = process.env.SMS_SERVICE_URL || 'http://localhost:4005';
        await axios_1.default.post(`${smsService}/api/send`, {
            to: data.guestPhone,
            message,
            type: 'text'
        }, {
            timeout: 10000
        });
        console.log(`[RoomQR] SMS sent to ${data.guestPhone}`);
    }
    catch (error) {
        console.error('[RoomQR] SMS notification failed:', error);
    }
}
// ─── Service Charge Sync ─────────────────────────────────────────────────────
/**
 * Record a service charge
 */
async function recordServiceCharge(charge) {
    try {
        const serviceCharge = new exports.ServiceCharge({
            bookingId: charge.bookingId,
            hotelId: charge.hotelId,
            roomId: charge.roomId,
            category: charge.category,
            description: charge.description,
            amountPaise: charge.amountPaise,
            quantity: charge.quantity || 1,
            unitPricePaise: charge.unitPricePaise || charge.amountPaise,
            source: charge.source || 'manual',
            syncedToFolio: false
        });
        await serviceCharge.save();
        // Try to sync to StayOwn folio immediately
        await syncChargeToFolio(serviceCharge);
        // Emit service_ordered event to REZ Mind
        rez_mind_client_1.rezMindClient.sendEvent({
            eventType: 'service_ordered',
            source: 'stayown',
            data: {
                bookingId: charge.bookingId,
                hotelId: charge.hotelId,
                roomId: charge.roomId,
                category: charge.category,
                description: charge.description,
                amountPaise: charge.amountPaise,
                quantity: charge.quantity || 1,
                source: charge.source || 'manual',
            },
            timestamp: new Date(),
        });
        return serviceCharge;
    }
    catch (error) {
        console.error('[RoomQR] Failed to record service charge:', error);
        throw new Error('Failed to record service charge');
    }
}
/**
 * Sync a charge to StayOwn folio via bridge
 */
async function syncChargeToFolio(charge) {
    if (charge.syncedToFolio) {
        return; // Already synced
    }
    try {
        // Dynamic import to avoid circular dependency
        const { addChargeToFolio } = await Promise.resolve().then(() => __importStar(require('./bridge')));
        const result = await addChargeToFolio({
            bookingId: charge.bookingId,
            hotelId: charge.hotelId,
            category: charge.category,
            description: charge.description,
            amountPaise: charge.amountPaise,
            quantity: charge.quantity,
            unitPricePaise: charge.unitPricePaise,
            source: charge.source
        });
        if (result.success) {
            // Update sync status
            charge.syncedToFolio = true;
            charge.syncedAt = new Date();
            if (result.transactionId) {
                charge.folioTransactionId = result.transactionId;
            }
            await charge.save();
            console.log(`[RoomQR] Charge ${charge.id} synced to folio${result.transactionId ? ` (txn: ${result.transactionId})` : ''}`);
        }
        else {
            console.error(`[RoomQR] Failed to sync charge ${charge.id}: ${result.error}`);
            // Don't throw - will retry on checkout
        }
    }
    catch (error) {
        console.error(`[RoomQR] Failed to sync charge ${charge.id} to folio:`, error);
        // Don't throw - will retry on checkout
    }
}
/**
 * Get all charges for a booking
 */
async function getChargesForBooking(bookingId) {
    return exports.ServiceCharge.find({ bookingId }).sort({ createdAt: -1 });
}
/**
 * Sync all unsynced charges for a booking
 */
async function syncAllChargesToFolio(bookingId) {
    const unsyncedCharges = await exports.ServiceCharge.find({
        bookingId,
        syncedToFolio: false
    });
    let syncedCount = 0;
    for (const charge of unsyncedCharges) {
        try {
            await syncChargeToFolio(charge);
            syncedCount++;
        }
        catch (error) {
            console.error(`[RoomQR] Failed to sync charge ${charge.id}:`, error);
        }
    }
    return syncedCount;
}
// ─── Checkout Integration ────────────────────────────────────────────────────
/**
 * Process room checkout
 */
async function processRoomCheckout(bookingId) {
    try {
        // Get booking details
        const roomQR = await exports.RoomQR.findOne({ bookingId });
        if (!roomQR) {
            throw new Error('Room QR not found for this booking');
        }
        // Sync all pending charges
        await syncAllChargesToFolio(bookingId);
        // Get all charges
        const charges = await exports.ServiceCharge.find({ bookingId }).sort({ createdAt: 1 });
        // Group charges by category
        const roomCharges = [];
        const serviceCharges = [];
        for (const charge of charges) {
            const item = {
                id: charge.id,
                description: charge.description,
                quantity: charge.quantity,
                unitPricePaise: charge.unitPricePaise,
                totalPaise: charge.amountPaise,
                date: charge.createdAt,
                category: charge.category
            };
            if (charge.category === 'room') {
                roomCharges.push(item);
            }
            else {
                serviceCharges.push(item);
            }
        }
        // Calculate totals
        const roomSubtotal = roomCharges.reduce((sum, item) => sum + item.totalPaise, 0);
        const serviceSubtotal = serviceCharges.reduce((sum, item) => sum + item.totalPaise, 0);
        const subtotalPaise = roomSubtotal + serviceSubtotal;
        const taxesPaise = Math.round(subtotalPaise * 0.18); // 18% GST
        const totalPaise = subtotalPaise + taxesPaise;
        // Get payments (would come from payment service)
        const payments = [];
        // Deactivate the QR code
        roomQR.isActive = false;
        await roomQR.save();
        const checkoutSummary = {
            bookingId,
            guestName: roomQR.guestName,
            roomNumber: roomQR.roomNumber,
            checkIn: roomQR.checkIn,
            checkOut: roomQR.checkOut,
            roomCharges,
            serviceCharges,
            subtotalPaise,
            taxesPaise,
            totalPaise,
            payments,
            balanceDuePaise: Math.max(0, totalPaise - payments.reduce((sum, p) => sum + p.amountPaise, 0)),
            checkoutTime: new Date()
        };
        // Emit checkout_completed event to REZ Mind
        rez_mind_client_1.rezMindClient.sendEvent({
            eventType: 'checkout_completed',
            source: 'stayown',
            userId: roomQR.guestId,
            data: {
                bookingId,
                hotelId: roomQR.hotelId,
                roomId: roomQR.roomId,
                roomNumber: roomQR.roomNumber,
                checkIn: roomQR.checkIn.toISOString(),
                checkOut: roomQR.checkOut.toISOString(),
                roomChargesPaise: roomSubtotal,
                serviceChargesPaise: serviceSubtotal,
                taxesPaise,
                totalPaise,
                balanceDuePaise: checkoutSummary.balanceDuePaise,
            },
            timestamp: new Date(),
        });
        return checkoutSummary;
    }
    catch (error) {
        console.error('[RoomQR] Checkout processing failed:', error);
        throw new Error('Failed to process checkout');
    }
}
/**
 * Get checkout bill for a booking
 */
async function getCheckoutBill(bookingId) {
    try {
        const roomQR = await exports.RoomQR.findOne({ bookingId });
        if (!roomQR) {
            return null;
        }
        const charges = await exports.ServiceCharge.find({ bookingId }).sort({ createdAt: 1 });
        const roomCharges = [];
        const serviceCharges = [];
        for (const charge of charges) {
            const item = {
                id: charge.id,
                description: charge.description,
                quantity: charge.quantity,
                unitPricePaise: charge.unitPricePaise,
                totalPaise: charge.amountPaise,
                date: charge.createdAt,
                category: charge.category
            };
            if (charge.category === 'room') {
                roomCharges.push(item);
            }
            else {
                serviceCharges.push(item);
            }
        }
        const roomSubtotal = roomCharges.reduce((sum, item) => sum + item.totalPaise, 0);
        const serviceSubtotal = serviceCharges.reduce((sum, item) => sum + item.totalPaise, 0);
        const subtotalPaise = roomSubtotal + serviceSubtotal;
        const taxesPaise = Math.round(subtotalPaise * 0.18);
        const totalPaise = subtotalPaise + taxesPaise;
        return {
            bookingId,
            guestName: roomQR.guestName,
            roomNumber: roomQR.roomNumber,
            checkIn: roomQR.checkIn,
            checkOut: roomQR.checkOut,
            roomCharges,
            serviceCharges,
            subtotalPaise,
            taxesPaise,
            totalPaise,
            payments: [],
            balanceDuePaise: totalPaise,
            checkoutTime: new Date()
        };
    }
    catch (error) {
        console.error('[RoomQR] Failed to get checkout bill:', error);
        return null;
    }
}
// ─── Full QR Generation Pipeline ─────────────────────────────────────────────
/**
 * Generate and store QR, then notify guest
 * Called when a booking is confirmed
 */
async function generateAndNotifyRoomQR(config) {
    // 1. Generate QR
    const generatedQR = await generateRoomQR(config);
    // 2. Store in database
    const roomQR = await storeRoomQR(config, generatedQR);
    // 3. Notify guest
    await notifyGuestBooking(config.hotelId, config.bookingId, {
        qrImage: generatedQR.qrImage,
        qrUrl: generatedQR.qrUrl,
        hotelName: config.hotelName,
        roomNumber: config.roomNumber,
        checkIn: config.checkIn,
        checkOut: config.checkOut,
        guestName: config.guestName,
        guestEmail: config.guestEmail,
        guestPhone: config.guestPhone
    });
    // 4. Emit room_qr_generated event to REZ Mind
    rez_mind_client_1.rezMindClient.sendEvent({
        eventType: 'room_qr_generated',
        source: 'stayown',
        userId: config.guestId,
        data: {
            bookingId: config.bookingId,
            hotelId: config.hotelId,
            roomId: config.roomId,
            roomNumber: config.roomNumber,
            checkIn: config.checkIn.toISOString(),
            checkOut: config.checkOut.toISOString(),
        },
        timestamp: new Date(),
    });
    console.log(`[RoomQR] Generated and notified for booking ${config.bookingId}`);
    return roomQR;
}
/**
 * Resend QR notification for a booking
 */
async function resendQRNotification(bookingId) {
    try {
        const roomQR = await exports.RoomQR.findOne({ bookingId });
        if (!roomQR) {
            throw new Error('Room QR not found');
        }
        const qrPayload = JSON.parse(roomQR.qrPayload);
        await notifyGuestBooking(roomQR.hotelId, bookingId, {
            qrImage: roomQR.qrImage,
            qrUrl: roomQR.qrUrl,
            hotelName: '',
            roomNumber: roomQR.roomNumber,
            checkIn: roomQR.checkIn,
            checkOut: roomQR.checkOut,
            guestName: roomQR.guestName,
            guestEmail: roomQR.guestEmail,
            guestPhone: roomQR.guestPhone
        });
        return true;
    }
    catch (error) {
        console.error(`[RoomQR] Failed to resend notification for ${bookingId}:`, error);
        return false;
    }
}
/**
 * Handle room service webhook events from Hotel OTA
 */
async function handleRoomServiceWebhook(event) {
    console.log(`[RoomQR] Webhook received: ${event.event} for booking ${event.bookingId}`);
    switch (event.event) {
        case 'request.created':
            // Log new service request
            console.log(`[RoomQR] New ${event.data?.serviceType || 'unknown'} request for booking ${event.bookingId}`);
            break;
        case 'request.completed':
            // Record the charge when service is completed
            if (event.data && event.data.totalAmountPaise > 0) {
                await recordServiceCharge({
                    bookingId: event.bookingId,
                    hotelId: event.hotelId,
                    roomId: event.roomId,
                    category: event.data.serviceType || 'other',
                    description: event.data.description || `${event.data.serviceType || 'service'} service`,
                    amountPaise: event.data.totalAmountPaise,
                    quantity: 1,
                    unitPricePaise: event.data.totalAmountPaise,
                    source: 'room_service'
                });
                console.log(`[RoomQR] Recorded charge for completed service: ${event.data.totalAmountPaise} paise`);
            }
            break;
        case 'charge.added':
            // Directly record minibar or other charges
            if (event.data && event.data.amountPaise > 0) {
                await recordServiceCharge({
                    bookingId: event.bookingId,
                    hotelId: event.hotelId,
                    roomId: event.roomId,
                    category: event.data.category || 'other',
                    description: event.data.description || 'Service charge',
                    amountPaise: event.data.amountPaise,
                    quantity: event.data.quantity || 1,
                    unitPricePaise: event.data.unitPricePaise || event.data.amountPaise,
                    source: event.data.source || 'manual'
                });
                console.log(`[RoomQR] Recorded charge: ${event.data.amountPaise} paise`);
            }
            break;
        case 'checkout.requested':
            // Process checkout
            const summary = await processRoomCheckout(event.bookingId);
            console.log(`[RoomQR] Checkout processed. Total: ${summary.totalPaise} paise`);
            break;
    }
}
// ─── Utility Functions ──────────────────────────────────────────────────────
/**
 * Deactivate QR for a booking
 */
async function deactivateRoomQR(bookingId) {
    try {
        const result = await exports.RoomQR.updateOne({ bookingId }, { isActive: false });
        return result.modifiedCount > 0;
    }
    catch (error) {
        console.error('[RoomQR] Failed to deactivate QR:', error);
        return false;
    }
}
/**
 * Get QR statistics for a hotel
 */
async function getHotelQRStats(hotelId) {
    const stats = await exports.RoomQR.aggregate([
        { $match: { hotelId } },
        {
            $group: {
                _id: null,
                totalQRs: { $sum: 1 },
                activeQRs: { $sum: { $cond: ['$isActive', 1, 0] } },
                totalUses: { $sum: '$useCount' }
            }
        }
    ]);
    if (stats.length === 0) {
        return { totalQRs: 0, activeQRs: 0, totalUses: 0, averageUses: 0 };
    }
    return {
        totalQRs: stats[0].totalQRs,
        activeQRs: stats[0].activeQRs,
        totalUses: stats[0].totalUses,
        averageUses: stats[0].totalQRs > 0 ? stats[0].totalUses / stats[0].totalQRs : 0
    };
}
//# sourceMappingURL=room-qr.js.map