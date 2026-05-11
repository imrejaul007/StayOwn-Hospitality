"use strict";
/**
 * Pre-Arrival Service for StayOwn Hotel Booking
 *
 * Features:
 * - Guest sets preferences before arrival
 * - Room temperature, lighting, pillows
 * - Dietary restrictions
 * - Special occasions
 * - Early check-in requests
 * - Sync to Room QR on arrival
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreArrival = void 0;
exports.getPreArrivalPreferences = getPreArrivalPreferences;
exports.getPreArrivalByGuest = getPreArrivalByGuest;
exports.savePreArrivalPreferences = savePreArrivalPreferences;
exports.deletePreArrivalPreferences = deletePreArrivalPreferences;
exports.syncPreferencesToRoomQR = syncPreferencesToRoomQR;
exports.onGuestCheckIn = onGuestCheckIn;
exports.sendPreArrivalReminder = sendPreArrivalReminder;
exports.checkPreArrivalReminders = checkPreArrivalReminders;
exports.getPreArrivalAnalytics = getPreArrivalAnalytics;
const mongoose_1 = __importDefault(require("mongoose"));
const axios_1 = __importDefault(require("axios"));
// Configuration
const HOTEL_OTA_API = process.env.HOTEL_OTA_API_URL || 'http://localhost:3008';
const ROOM_QR_API = process.env.ROOM_QR_API_URL || 'http://localhost:4015';
// ─── MongoDB Schema ───────────────────────────────────────────────────────────
const PreArrivalSchema = new mongoose_1.default.Schema({
    guestId: { type: String, required: true, index: true },
    bookingId: { type: String, required: true, unique: true, index: true },
    temperature: { type: Number, default: 22, min: 16, max: 30 },
    lighting: { type: String, enum: ['bright', 'dim', 'dark'], default: 'dim' },
    pillowType: { type: String, enum: ['soft', 'firm', 'extra'], default: 'soft' },
    dietaryRestrictions: { type: [String], default: [] },
    allergies: { type: [String], default: [] },
    specialOccasion: { type: String },
    earlyCheckin: { type: String },
    lateCheckout: { type: String },
    roomPreferencesJson: { type: String },
    transportRequestsJson: { type: String },
    notes: { type: String },
    syncedToRoomQR: { type: Boolean, default: false },
    syncedAt: { type: Date },
}, { timestamps: true });
// ─── Model ─────────────────────────────────────────────────────────────────────
exports.PreArrival = mongoose_1.default.models.PreArrival || mongoose_1.default.model('PreArrival', PreArrivalSchema);
// ─── Preferences Functions ─────────────────────────────────────────────────────
/**
 * Get pre-arrival preferences for a booking
 */
async function getPreArrivalPreferences(bookingId) {
    try {
        const doc = await exports.PreArrival.findOne({ bookingId });
        if (!doc)
            return null;
        return documentToPreferences(doc);
    }
    catch (error) {
        console.error('[PreArrival] Failed to get preferences:', error);
        return null;
    }
}
/**
 * Get pre-arrival preferences by guest ID
 */
async function getPreArrivalByGuest(guestId) {
    try {
        const docs = await exports.PreArrival.find({ guestId }).sort({ createdAt: -1 });
        return docs.map(documentToPreferences);
    }
    catch (error) {
        console.error('[PreArrival] Failed to get preferences by guest:', error);
        return [];
    }
}
/**
 * Save pre-arrival preferences
 */
async function savePreArrivalPreferences(preferences) {
    try {
        const { guestId, bookingId, ...rest } = preferences;
        if (!guestId || !bookingId) {
            throw new Error('guestId and bookingId are required');
        }
        // Parse room preferences if provided
        let roomPreferencesJson;
        if (rest.roomPreferences) {
            roomPreferencesJson = JSON.stringify(rest.roomPreferences);
        }
        // Parse transport requests if provided
        let transportRequestsJson;
        if (rest.transportRequests) {
            transportRequestsJson = JSON.stringify(rest.transportRequests);
        }
        const updateData = {
            temperature: rest.temperature ?? 22,
            lighting: rest.lighting ?? 'dim',
            pillowType: rest.pillowType ?? 'soft',
            dietaryRestrictions: rest.dietaryRestrictions ?? [],
            allergies: rest.allergies ?? [],
            specialOccasion: rest.specialOccasion,
            earlyCheckin: rest.earlyCheckin,
            lateCheckout: rest.lateCheckout,
            roomPreferencesJson,
            transportRequestsJson,
            notes: rest.notes,
            syncedToRoomQR: false, // Reset sync status on update
        };
        const doc = await exports.PreArrival.findOneAndUpdate({ bookingId }, { $set: updateData }, { upsert: true, new: true });
        console.log('[PreArrival] Preferences saved for booking', bookingId);
        return documentToPreferences(doc);
    }
    catch (error) {
        console.error('[PreArrival] Failed to save preferences:', error);
        throw new Error('Failed to save pre-arrival preferences');
    }
}
/**
 * Delete pre-arrival preferences
 */
async function deletePreArrivalPreferences(bookingId) {
    try {
        const result = await exports.PreArrival.deleteOne({ bookingId });
        return result.deletedCount > 0;
    }
    catch (error) {
        console.error('[PreArrival] Failed to delete preferences:', error);
        return false;
    }
}
// ─── Sync to Room QR ──────────────────────────────────────────────────────────
/**
 * Sync pre-arrival preferences to Room QR service
 */
async function syncPreferencesToRoomQR(bookingId) {
    try {
        const preferences = await getPreArrivalPreferences(bookingId);
        if (!preferences) {
            console.warn('[PreArrival] No preferences to sync for booking', bookingId);
            return false;
        }
        // Call Room QR service to apply preferences
        const response = await axios_1.default.post(`${ROOM_QR_API}/api/room-qr/preferences/sync`, {
            bookingId,
            preferences: {
                temperature: preferences.temperature,
                lighting: preferences.lighting,
                pillowType: preferences.pillowType,
                dietaryRestrictions: preferences.dietaryRestrictions,
                allergies: preferences.allergies,
            },
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
        });
        if (response.status === 200) {
            // Update sync status
            await exports.PreArrival.updateOne({ bookingId }, { syncedToRoomQR: true, syncedAt: new Date() });
            console.log('[PreArrival] Preferences synced to Room QR for booking', bookingId);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('[PreArrival] Failed to sync to Room QR:', error);
        return false;
    }
}
/**
 * Auto-sync preferences when guest checks in
 */
async function onGuestCheckIn(bookingId) {
    try {
        const success = await syncPreferencesToRoomQR(bookingId);
        if (!success) {
            console.warn('[PreArrival] Auto-sync failed for booking', bookingId);
            // Could queue for retry or notify staff
        }
    }
    catch (error) {
        console.error('[PreArrival] Check-in sync error:', error);
    }
}
// ─── Notification Functions ────────────────────────────────────────────────────
/**
 * Send pre-arrival reminder to guest
 */
async function sendPreArrivalReminder(guestId, bookingId, hotelName, checkInDate) {
    try {
        // Calculate days until check-in
        const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        // Only send reminder if check-in is within 7 days
        if (daysUntilCheckIn < 0 || daysUntilCheckIn > 7) {
            return false;
        }
        // Get guest contact info
        const guest = await getGuestInfo(guestId);
        if (!guest)
            return false;
        // Send notification based on channel preference
        const reminderMessage = `Hi ${guest.firstName}! Your stay at ${hotelName} is in ${daysUntilCheckIn} day${daysUntilCheckIn > 1 ? 's' : ''}. Set your room preferences now to make your arrival extra special!`;
        if (guest.email) {
            await sendEmailReminder(guest.email, reminderMessage, hotelName, checkInDate);
        }
        if (guest.phone) {
            await sendSMSReminder(guest.phone, reminderMessage);
        }
        console.log('[PreArrival] Reminder sent for booking', bookingId);
        return true;
    }
    catch (error) {
        console.error('[PreArrival] Failed to send reminder:', error);
        return false;
    }
}
async function getGuestInfo(guestId) {
    // This would fetch from user database
    // For now, return mock data
    return { firstName: 'Guest', email: undefined, phone: undefined };
}
async function sendEmailReminder(email, message, hotelName, checkInDate) {
    // Send via email service
    const emailService = process.env.EMAIL_SERVICE_URL || 'http://localhost:4003';
    try {
        await axios_1.default.post(`${emailService}/api/send`, {
            to: email,
            subject: `Your upcoming stay at ${hotelName} - Set room preferences`,
            message,
            template: 'pre-arrival-reminder',
        }, { timeout: 10000 });
    }
    catch (error) {
        console.error('[PreArrival] Email reminder failed:', error);
    }
}
async function sendSMSReminder(phone, message) {
    // Send via SMS service
    const smsService = process.env.SMS_SERVICE_URL || 'http://localhost:4005';
    try {
        await axios_1.default.post(`${smsService}/api/send`, {
            to: phone,
            message,
            type: 'text',
        }, { timeout: 10000 });
    }
    catch (error) {
        console.error('[PreArrival] SMS reminder failed:', error);
    }
}
// ─── Utility Functions ─────────────────────────────────────────────────────────
function documentToPreferences(doc) {
    let roomPreferences = undefined;
    if (doc.roomPreferencesJson) {
        try {
            roomPreferences = JSON.parse(doc.roomPreferencesJson);
        }
        catch {
            roomPreferences = undefined;
        }
    }
    let transportRequests = undefined;
    if (doc.transportRequestsJson) {
        try {
            transportRequests = JSON.parse(doc.transportRequestsJson);
        }
        catch {
            transportRequests = undefined;
        }
    }
    return {
        guestId: doc.guestId,
        bookingId: doc.bookingId,
        temperature: doc.temperature,
        lighting: doc.lighting,
        pillowType: doc.pillowType,
        dietaryRestrictions: doc.dietaryRestrictions,
        allergies: doc.allergies,
        specialOccasion: doc.specialOccasion,
        earlyCheckin: doc.earlyCheckin,
        lateCheckout: doc.lateCheckout,
        roomPreferences,
        transportRequests,
        notes: doc.notes,
        syncedToRoomQR: doc.syncedToRoomQR,
        syncedAt: doc.syncedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
/**
 * Check if pre-arrival preferences need reminder
 */
async function checkPreArrivalReminders() {
    try {
        // Find bookings with upcoming check-in dates
        // This would typically be called by a cron job
        const now = new Date();
        const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        // Find bookings that need reminders
        // For each, check if preferences are set and send reminder if not
        console.log('[PreArrival] Checking for pending reminders...');
    }
    catch (error) {
        console.error('[PreArrival] Reminder check failed:', error);
    }
}
/**
 * Get pre-arrival analytics
 */
async function getPreArrivalAnalytics(hotelId, period = 'week') {
    try {
        let startDate;
        const now = new Date();
        if (period === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        else {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        // This would aggregate from database
        // For now, return mock data
        return {
            totalBookings: 150,
            preferencesSet: 89,
            conversionRate: 59.3,
            mostRequestedPillow: 'soft',
            avgTemperature: 22,
            specialOccasions: {
                birthday: 12,
                anniversary: 8,
                honeymoon: 5,
                business: 15,
            },
        };
    }
    catch (error) {
        console.error('[PreArrival] Analytics failed:', error);
        return {
            totalBookings: 0,
            preferencesSet: 0,
            conversionRate: 0,
            mostRequestedPillow: 'soft',
            avgTemperature: 22,
            specialOccasions: {},
        };
    }
}
//# sourceMappingURL=pre-arrival.js.map