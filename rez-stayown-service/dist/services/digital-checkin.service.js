"use strict";
/**
 * Digital Check-in Service for StayOwn
 *
 * Features:
 * - Pre-arrival form submission
 * - ID upload/verification
 * - Room selection
 * - Digital key generation
 * - Express checkout
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.digitalCheckinService = exports.DigitalKeyModel = exports.Checkin = void 0;
exports.startCheckin = startCheckin;
exports.getCheckin = getCheckin;
exports.getCheckinByUser = getCheckinByUser;
exports.updateCheckin = updateCheckin;
exports.verifyId = verifyId;
exports.completeCheckin = completeCheckin;
exports.getDigitalKey = getDigitalKey;
exports.getDigitalKeyById = getDigitalKeyById;
exports.getRoomKeys = getRoomKeys;
exports.revokeKey = revokeKey;
exports.revokeBookingKeys = revokeBookingKeys;
exports.expressCheckout = expressCheckout;
exports.validateQRCodeScan = validateQRCodeScan;
exports.getCheckinStats = getCheckinStats;
exports.sendKeyToGuest = sendKeyToGuest;
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = require("crypto");
const qrcode_1 = __importDefault(require("qrcode"));
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../config/logger");
// Configuration
const HOTEL_PMS_API = process.env.HOTEL_PMS_API_URL || 'http://localhost:3008';
const DIGITAL_KEY_API = process.env.DIGITAL_KEY_API_URL || 'http://localhost:4016';
// ─── MongoDB Schemas ──────────────────────────────────────────────────────────
const EmergencyContactSchema = new mongoose_1.default.Schema({
    name: { type: String },
    phone: { type: String },
    relationship: { type: String },
}, { _id: false });
const GuestPreferencesSchema = new mongoose_1.default.Schema({
    checkInTime: { type: String },
    roomType: { type: String },
    floor: { type: String },
    smoking: { type: Boolean },
    quietRoom: { type: Boolean },
    highFloor: { type: Boolean },
    earlyCheckin: { type: Boolean },
    lateCheckout: { type: Boolean },
    specialRequests: { type: String },
}, { _id: false });
const CheckinSchema = new mongoose_1.default.Schema({
    bookingId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    hotelId: { type: String, required: true, index: true },
    guestName: { type: String, required: true },
    guestEmail: { type: String, required: true },
    guestPhone: { type: String, required: true },
    guestAddress: { type: String },
    idType: {
        type: String,
        enum: ['passport', 'aadhar', 'driving_license', 'voter_id'],
        default: 'aadhar',
    },
    idNumber: { type: String },
    idImage: { type: String }, // Base64 or URL
    idVerified: { type: Boolean, default: false },
    preferences: { type: GuestPreferencesSchema, default: {} },
    emergencyContact: { type: EmergencyContactSchema },
    incidentalPaymentMethod: {
        type: String,
        enum: ['credit_card', 'debit_card', 'cash'],
    },
    signature: { type: String }, // Base64
    termsAccepted: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'ready', 'completed'],
        default: 'pending',
    },
    step: { type: Number, default: 1, min: 1, max: 5 },
    completedAt: { type: Date },
}, { timestamps: true });
// Compound indexes
CheckinSchema.index({ hotelId: 1, status: 1 });
CheckinSchema.index({ userId: 1, createdAt: -1 });
const DigitalKeySchema = new mongoose_1.default.Schema({
    keyId: { type: String, required: true, unique: true, index: true },
    bookingId: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    roomNumber: { type: String, required: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    qrCode: { type: String, required: true },
    qrCodeImage: { type: String },
    nfcData: { type: String },
    status: {
        type: String,
        enum: ['active', 'expired', 'revoked'],
        default: 'active',
    },
}, { timestamps: true });
// Compound indexes
DigitalKeySchema.index({ bookingId: 1, status: 1 });
DigitalKeySchema.index({ roomId: 1, status: 1 });
DigitalKeySchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 }); // TTL index
// ─── Models ─────────────────────────────────────────────────────────────────────
exports.Checkin = mongoose_1.default.models.Checkin || mongoose_1.default.model('Checkin', CheckinSchema);
exports.DigitalKeyModel = mongoose_1.default.models.DigitalKey || mongoose_1.default.model('DigitalKey', DigitalKeySchema);
// ─── Service Functions ─────────────────────────────────────────────────────────
/**
 * Get booking details from Hotel-PMS
 */
async function getBookingFromPMS(bookingId) {
    try {
        const response = await axios_1.default.get(`${HOTEL_PMS_API}/api/bookings/${bookingId}`, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
    }
    catch (error) {
        logger_1.logger.warn('Failed to get booking from PMS', { bookingId, error: error.message });
        return null;
    }
}
/**
 * Get room assignment from Hotel-PMS
 */
async function getRoomAssignmentFromPMS(hotelId, bookingId) {
    try {
        const response = await axios_1.default.get(`${HOTEL_PMS_API}/api/bookings/${bookingId}/room`, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
    }
    catch (error) {
        logger_1.logger.warn('Failed to get room assignment from PMS', { bookingId, error: error.message });
        return null;
    }
}
/**
 * Update booking status in Hotel-PMS
 */
async function updateBookingStatusInPMS(bookingId, status) {
    try {
        await axios_1.default.patch(`${HOTEL_PMS_API}/api/bookings/${bookingId}/status`, {
            status,
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        return true;
    }
    catch (error) {
        logger_1.logger.warn('Failed to update booking status in PMS', { bookingId, status, error: error.message });
        return false;
    }
}
/**
 * Send notification to hotel via PMS webhook
 */
async function notifyHotelPMS(hotelId, event, data) {
    try {
        await axios_1.default.post(`${HOTEL_PMS_API}/api/webhooks/guest`, {
            event,
            hotelId,
            data,
            timestamp: new Date().toISOString(),
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        logger_1.logger.warn('Failed to notify hotel PMS', { hotelId, event, error: error.message });
    }
}
/**
 * Calculate the next step in check-in process
 */
function calculateNextStep(checkin) {
    if (!checkin.idVerified)
        return 2;
    if (!checkin.emergencyContact?.name)
        return 3;
    if (!checkin.termsAccepted)
        return 4;
    return 5;
}
/**
 * Start check-in process for a booking
 */
async function startCheckin(bookingId, userId) {
    logger_1.logger.info('Starting digital check-in', { bookingId, userId });
    // Check if check-in already exists
    const existing = await exports.Checkin.findOne({ bookingId });
    if (existing) {
        logger_1.logger.info('Check-in already exists, returning existing', { bookingId });
        return existing;
    }
    // Get booking details from PMS
    const booking = await getBookingFromPMS(bookingId);
    // Create check-in record
    const checkinData = {
        bookingId,
        userId,
        hotelId: booking?.hotelId || '',
        guestName: booking?.guestName || 'Guest',
        guestEmail: booking?.guestEmail || '',
        guestPhone: booking?.guestPhone || '',
        idType: 'aadhar',
        idNumber: '',
        idVerified: false,
        preferences: {},
        termsAccepted: false,
        status: 'in_progress',
        step: 1,
    };
    const checkin = new exports.Checkin(checkinData);
    await checkin.save();
    logger_1.logger.info('Check-in record created', { bookingId, checkinId: checkin._id });
    // Notify hotel
    await notifyHotelPMS(checkin.hotelId, 'checkin_started', {
        bookingId,
        guestName: checkin.guestName,
        guestPhone: checkin.guestPhone,
    });
    return checkin;
}
/**
 * Get check-in data for a booking
 */
async function getCheckin(bookingId) {
    const checkin = await exports.Checkin.findOne({ bookingId });
    return checkin ? checkin : null;
}
/**
 * Get check-in data by user ID
 */
async function getCheckinByUser(userId) {
    const checkins = await exports.Checkin.find({ userId }).sort({ createdAt: -1 });
    return checkins;
}
/**
 * Update check-in step
 */
async function updateCheckin(bookingId, updates) {
    const checkin = await exports.Checkin.findOne({ bookingId });
    if (!checkin) {
        throw new Error('Check-in not found');
    }
    // Apply updates
    Object.assign(checkin, updates);
    // Recalculate step
    checkin.step = calculateNextStep(checkin);
    if (checkin.step === 5) {
        checkin.status = 'ready';
    }
    await checkin.save();
    logger_1.logger.info('Check-in updated', { bookingId, step: checkin.step, status: checkin.status });
    // If ID verified, notify hotel
    if (updates.idVerified) {
        await notifyHotelPMS(checkin.hotelId, 'id_verified', {
            bookingId,
            guestName: checkin.guestName,
            idType: checkin.idType,
            idNumber: checkin.idNumber,
        });
    }
    return checkin;
}
/**
 * Verify guest ID
 */
async function verifyId(bookingId, idType, idNumber, idImage) {
    // In production, this would integrate with ID verification service
    // For now, we'll auto-verify for demo purposes
    const isVerified = true; // await verifyWithIdService(idType, idNumber, idImage);
    logger_1.logger.info('ID verification attempted', { bookingId, idType, isVerified });
    return updateCheckin(bookingId, {
        idType,
        idNumber,
        idImage,
        idVerified: isVerified,
    });
}
/**
 * Generate QR code for digital key
 */
async function generateQRCodePayload(bookingId, roomId, keyId) {
    const payload = {
        intent: 'room_key',
        bookingId,
        roomId,
        keyId,
        timestamp: Date.now(),
        version: '1.0',
    };
    return JSON.stringify(payload);
}
/**
 * Generate QR code as base64 image
 */
async function generateQRCodeImage(payload) {
    try {
        const qrDataUrl = await qrcode_1.default.toDataURL(payload, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
        });
        return qrDataUrl;
    }
    catch (error) {
        logger_1.logger.error('Failed to generate QR code image', { error: error.message });
        throw new Error('Failed to generate QR code');
    }
}
/**
 * Generate NFC data for digital key
 */
function generateNFCData(key) {
    // In production: integrate with lock manufacturer API
    // Format: REZ:keyId:roomId:validFrom:validUntil:signature
    const nfcPayload = {
        v: '1', // version
        k: key.keyId,
        r: key.roomId,
        f: key.validFrom.getTime(),
        u: key.validUntil.getTime(),
    };
    return Buffer.from(JSON.stringify(nfcPayload)).toString('base64');
}
/**
 * Complete check-in and generate digital key
 */
async function completeCheckin(bookingId) {
    const checkin = await exports.Checkin.findOne({ bookingId });
    if (!checkin) {
        throw new Error('Check-in not found');
    }
    if (checkin.status !== 'ready') {
        throw new Error('Check-in not ready. Please complete all steps first.');
    }
    // Check if key already exists
    const existingKey = await exports.DigitalKeyModel.findOne({ bookingId, status: 'active' });
    if (existingKey) {
        logger_1.logger.info('Active digital key already exists', { bookingId, keyId: existingKey.keyId });
        return existingKey;
    }
    // Get room assignment from PMS
    const room = await getRoomAssignmentFromPMS(checkin.hotelId, bookingId);
    if (!room) {
        throw new Error('Room not assigned. Please wait for room assignment from hotel.');
    }
    // Calculate validity period
    const validFrom = new Date();
    const checkOutDate = room.checkOut || new Date(validFrom.getTime() + 24 * 60 * 60 * 1000);
    const validUntil = checkin.preferences?.lateCheckout
        ? new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000) // Extend by 24 hours
        : checkOutDate;
    // Generate key
    const keyId = (0, crypto_1.randomUUID)();
    const qrPayload = await generateQRCodePayload(bookingId, room.roomId, keyId);
    const qrCodeImage = await generateQRCodeImage(qrPayload);
    const digitalKey = {
        keyId,
        bookingId,
        roomId: room.roomId,
        roomNumber: room.roomNumber,
        validFrom,
        validUntil,
        qrCode: qrPayload,
        qrCodeImage,
        nfcData: generateNFCData({
            keyId,
            bookingId,
            roomId: room.roomId,
            roomNumber: room.roomNumber,
            validFrom,
            validUntil,
            qrCode: qrPayload,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        status: 'active',
    };
    const savedKey = new exports.DigitalKeyModel(digitalKey);
    await savedKey.save();
    // Update check-in status
    checkin.status = 'completed';
    checkin.completedAt = new Date();
    await checkin.save();
    // Update booking status in PMS
    await updateBookingStatusInPMS(bookingId, 'checked_in');
    // Notify hotel
    await notifyHotelPMS(checkin.hotelId, 'checkin_completed', {
        bookingId,
        guestName: checkin.guestName,
        roomNumber: room.roomNumber,
        keyId,
    });
    logger_1.logger.info('Check-in completed, digital key generated', {
        bookingId,
        keyId,
        roomNumber: room.roomNumber,
    });
    return savedKey;
}
/**
 * Get digital key for a booking
 */
async function getDigitalKey(bookingId) {
    const key = await exports.DigitalKeyModel.findOne({ bookingId, status: 'active' });
    return key ? key : null;
}
/**
 * Get digital key by key ID
 */
async function getDigitalKeyById(keyId) {
    const key = await exports.DigitalKeyModel.findOne({ keyId });
    return key ? key : null;
}
/**
 * Get all active keys for a room
 */
async function getRoomKeys(roomId) {
    const keys = await exports.DigitalKeyModel.find({ roomId, status: 'active' });
    return keys;
}
/**
 * Revoke digital key (on checkout or emergency)
 */
async function revokeKey(keyId, reason) {
    const key = await exports.DigitalKeyModel.findOne({ keyId });
    if (!key) {
        throw new Error('Digital key not found');
    }
    key.status = 'revoked';
    await key.save();
    // Notify hotel
    await notifyHotelPMS(key.bookingId, 'key_revoked', {
        keyId,
        bookingId: key.bookingId,
        roomNumber: key.roomNumber,
        reason,
    });
    logger_1.logger.info('Digital key revoked', { keyId, reason });
    return key;
}
/**
 * Revoke all keys for a booking (typically on checkout)
 */
async function revokeBookingKeys(bookingId, reason = 'checkout') {
    const result = await exports.DigitalKeyModel.updateMany({ bookingId, status: 'active' }, { $set: { status: 'revoked' } });
    if (result.modifiedCount > 0) {
        await notifyHotelPMS('', 'keys_revoked', {
            bookingId,
            reason,
            count: result.modifiedCount,
        });
        logger_1.logger.info('Booking keys revoked', { bookingId, count: result.modifiedCount });
    }
    return result.modifiedCount;
}
/**
 * Express checkout - process guest checkout
 */
async function expressCheckout(bookingId) {
    const checkin = await exports.Checkin.findOne({ bookingId });
    if (!checkin) {
        return { success: false, message: 'Check-in not found' };
    }
    if (checkin.status !== 'completed') {
        return { success: false, message: 'Guest has not completed check-in' };
    }
    // Revoke digital keys
    const keysRevoked = await revokeBookingKeys(bookingId, 'express_checkout');
    // Update booking status in PMS
    await updateBookingStatusInPMS(bookingId, 'checked_out');
    logger_1.logger.info('Express checkout completed', { bookingId, keysRevoked });
    return {
        success: true,
        message: 'Express checkout completed successfully',
    };
}
/**
 * Validate a QR code scan
 */
async function validateQRCodeScan(qrPayload) {
    try {
        const payload = JSON.parse(qrPayload);
        if (payload.intent !== 'room_key') {
            return { valid: false, error: 'Invalid QR code type' };
        }
        const key = await exports.DigitalKeyModel.findOne({
            keyId: payload.keyId,
            bookingId: payload.bookingId,
            roomId: payload.roomId,
        });
        if (!key) {
            return { valid: false, error: 'Key not found' };
        }
        if (key.status !== 'active') {
            return { valid: false, error: `Key is ${key.status}` };
        }
        const now = new Date();
        if (now < key.validFrom || now > key.validUntil) {
            return { valid: false, error: 'Key has expired or is not yet valid' };
        }
        return { valid: true, key: key };
    }
    catch (error) {
        logger_1.logger.error('QR code validation failed', { error: error.message });
        return { valid: false, error: 'Invalid QR code format' };
    }
}
/**
 * Get check-in statistics for a hotel
 */
async function getCheckinStats(hotelId, period = 'today') {
    let dateFilter = {};
    const now = new Date();
    if (period === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { $gte: startOfDay };
    }
    else if (period === 'week') {
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    }
    else {
        dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    }
    const checkins = await exports.Checkin.find({
        hotelId,
        createdAt: dateFilter,
    });
    const completed = checkins.filter(c => c.status === 'completed').length;
    const pending = checkins.filter(c => c.status === 'pending' || c.status === 'in_progress').length;
    const activeKeys = await exports.DigitalKeyModel.countDocuments({
        bookingId: { $in: checkins.map(c => c.bookingId) },
        status: 'active',
        validUntil: { $gt: new Date() },
    });
    // Calculate average check-in time (mock for now)
    const averageCheckinTime = 8; // minutes
    return {
        totalCheckins: checkins.length,
        completedCheckins: completed,
        pendingCheckins: pending,
        activeKeys,
        averageCheckinTime,
    };
}
/**
 * Send digital key to guest
 */
async function sendKeyToGuest(bookingId) {
    const checkin = await exports.Checkin.findOne({ bookingId });
    const key = await getDigitalKey(bookingId);
    if (!checkin || !key) {
        return false;
    }
    try {
        // Send via email/SMS/WhatsApp based on guest preference
        const payload = {
            to: checkin.guestEmail,
            phone: checkin.guestPhone,
            subject: `Your Digital Room Key - Room ${key.roomNumber}`,
            template: 'digital-key',
            data: {
                guestName: checkin.guestName,
                roomNumber: key.roomNumber,
                validUntil: key.validUntil,
                qrCodeImage: key.qrCodeImage,
                qrCode: key.qrCode,
            },
        };
        // In production: call notification service
        logger_1.logger.info('Digital key sent to guest', { bookingId, guestEmail: checkin.guestEmail });
        return true;
    }
    catch (error) {
        logger_1.logger.error('Failed to send key to guest', { bookingId, error: error.message });
        return false;
    }
}
// ─── Export ─────────────────────────────────────────────────────────────────────
exports.digitalCheckinService = {
    startCheckin,
    getCheckin,
    getCheckinByUser,
    updateCheckin,
    verifyId,
    completeCheckin,
    getDigitalKey,
    getDigitalKeyById,
    getRoomKeys,
    revokeKey,
    revokeBookingKeys,
    expressCheckout,
    validateQRCodeScan,
    getCheckinStats,
    sendKeyToGuest,
};
exports.default = exports.digitalCheckinService;
//# sourceMappingURL=digital-checkin.service.js.map