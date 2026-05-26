import logger from './utils/logger';

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

import mongoose from 'mongoose';
import axios from 'axios';

// Configuration
const HOTEL_OTA_API = process.env.HOTEL_OTA_API_URL || 'http://localhost:3008';
const ROOM_QR_API = process.env.ROOM_QR_API_URL || 'http://localhost:4015';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface PreArrivalPreferences {
  guestId: string;
  bookingId: string;
  temperature: number;
  lighting: 'bright' | 'dim' | 'dark';
  pillowType: 'soft' | 'firm' | 'extra';
  dietaryRestrictions: string[];
  allergies: string[];
  specialOccasion?: string;
  earlyCheckin?: string;
  lateCheckout?: string;
  roomPreferences?: {
    highFloor?: boolean;
    quietRoom?: boolean;
    smokingRoom?: boolean;
    bedSize?: 'single' | 'double' | 'queen' | 'king';
    viewPreference?: 'city' | 'garden' | 'pool' | 'no_preference';
  };
  transportRequests?: {
    airportPickup?: boolean;
    pickupTime?: string;
    flightNumber?: string;
    passengers?: number;
  };
  notes?: string;
  syncedToRoomQR: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreArrivalDocument extends mongoose.Document {
  guestId: string;
  bookingId: string;
  temperature: number;
  lighting: 'bright' | 'dim' | 'dark';
  pillowType: 'soft' | 'firm' | 'extra';
  dietaryRestrictions: string[];
  allergies: string[];
  specialOccasion?: string;
  earlyCheckin?: string;
  lateCheckout?: string;
  roomPreferencesJson?: string; // JSON stringified room preferences
  transportRequestsJson?: string; // JSON stringified transport requests
  notes?: string;
  syncedToRoomQR: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── MongoDB Schema ───────────────────────────────────────────────────────────

const PreArrivalSchema = new mongoose.Schema({
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

export const PreArrival = mongoose.models.PreArrival || mongoose.model<PreArrivalDocument>('PreArrival', PreArrivalSchema);

// ─── Preferences Functions ─────────────────────────────────────────────────────

/**
 * Get pre-arrival preferences for a booking
 */
export async function getPreArrivalPreferences(bookingId: string): Promise<PreArrivalPreferences | null> {
  try {
    const doc = await PreArrival.findOne({ bookingId });
    if (!doc) return null;
    return documentToPreferences(doc);
  } catch (error) {
    console.error('[PreArrival] Failed to get preferences:', error);
    return null;
  }
}

/**
 * Get pre-arrival preferences by guest ID
 */
export async function getPreArrivalByGuest(guestId: string): Promise<PreArrivalPreferences[]> {
  try {
    const docs = await PreArrival.find({ guestId }).sort({ createdAt: -1 });
    return docs.map(documentToPreferences);
  } catch (error) {
    console.error('[PreArrival] Failed to get preferences by guest:', error);
    return [];
  }
}

/**
 * Save pre-arrival preferences
 */
export async function savePreArrivalPreferences(preferences: Partial<PreArrivalPreferences>): Promise<PreArrivalPreferences> {
  try {
    const { guestId, bookingId, ...rest } = preferences;

    if (!guestId || !bookingId) {
      throw new Error('guestId and bookingId are required');
    }

    // Parse room preferences if provided
    let roomPreferencesJson: string | undefined;
    if (rest.roomPreferences) {
      roomPreferencesJson = JSON.stringify(rest.roomPreferences);
    }

    // Parse transport requests if provided
    let transportRequestsJson: string | undefined;
    if (rest.transportRequests) {
      transportRequestsJson = JSON.stringify(rest.transportRequests);
    }

    const updateData: any = {
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

    const doc = await PreArrival.findOneAndUpdate(
      { bookingId },
      { $set: updateData },
      { upsert: true, new: true }
    );

    console.log('[PreArrival] Preferences saved for booking', bookingId);
    return documentToPreferences(doc);
  } catch (error) {
    console.error('[PreArrival] Failed to save preferences:', error);
    throw new Error('Failed to save pre-arrival preferences');
  }
}

/**
 * Delete pre-arrival preferences
 */
export async function deletePreArrivalPreferences(bookingId: string): Promise<boolean> {
  try {
    const result = await PreArrival.deleteOne({ bookingId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('[PreArrival] Failed to delete preferences:', error);
    return false;
  }
}

// ─── Sync to Room QR ──────────────────────────────────────────────────────────

/**
 * Sync pre-arrival preferences to Room QR service
 */
export async function syncPreferencesToRoomQR(bookingId: string): Promise<boolean> {
  try {
    const preferences = await getPreArrivalPreferences(bookingId);
    if (!preferences) {
      console.warn('[PreArrival] No preferences to sync for booking', bookingId);
      return false;
    }

    // Call Room QR service to apply preferences
    const response = await axios.post(
      `${ROOM_QR_API}/api/room-qr/preferences/sync`,
      {
        bookingId,
        preferences: {
          temperature: preferences.temperature,
          lighting: preferences.lighting,
          pillowType: preferences.pillowType,
          dietaryRestrictions: preferences.dietaryRestrictions,
          allergies: preferences.allergies,
        },
      },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.status === 200) {
      // Update sync status
      await PreArrival.updateOne(
        { bookingId },
        { syncedToRoomQR: true, syncedAt: new Date() }
      );
      console.log('[PreArrival] Preferences synced to Room QR for booking', bookingId);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[PreArrival] Failed to sync to Room QR:', error);
    return false;
  }
}

/**
 * Auto-sync preferences when guest checks in
 */
export async function onGuestCheckIn(bookingId: string): Promise<void> {
  try {
    const success = await syncPreferencesToRoomQR(bookingId);
    if (!success) {
      console.warn('[PreArrival] Auto-sync failed for booking', bookingId);
      // Could queue for retry or notify staff
    }
  } catch (error) {
    console.error('[PreArrival] Check-in sync error:', error);
  }
}

// ─── Notification Functions ────────────────────────────────────────────────────

/**
 * Send pre-arrival reminder to guest
 */
export async function sendPreArrivalReminder(
  guestId: string,
  bookingId: string,
  hotelName: string,
  checkInDate: Date
): Promise<boolean> {
  try {
    // Calculate days until check-in
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Only send reminder if check-in is within 7 days
    if (daysUntilCheckIn < 0 || daysUntilCheckIn > 7) {
      return false;
    }

    // Get guest contact info
    const guest = await getGuestInfo(guestId);
    if (!guest) return false;

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
  } catch (error) {
    console.error('[PreArrival] Failed to send reminder:', error);
    return false;
  }
}

async function getGuestInfo(guestId: string): Promise<{ firstName: string; email?: string; phone?: string } | null> {
  // This would fetch from user database
  // For now, return mock data
  return { firstName: 'Guest', email: undefined, phone: undefined };
}

async function sendEmailReminder(email: string, message: string, hotelName: string, checkInDate: Date): Promise<void> {
  // Send via email service
  const emailService = process.env.EMAIL_SERVICE_URL || 'http://localhost:4003';
  try {
    await axios.post(`${emailService}/api/send`, {
      to: email,
      subject: `Your upcoming stay at ${hotelName} - Set room preferences`,
      message,
      template: 'pre-arrival-reminder',
    }, { timeout: 10000 });
  } catch (error) {
    console.error('[PreArrival] Email reminder failed:', error);
  }
}

async function sendSMSReminder(phone: string, message: string): Promise<void> {
  // Send via SMS service
  const smsService = process.env.SMS_SERVICE_URL || 'http://localhost:4005';
  try {
    await axios.post(`${smsService}/api/send`, {
      to: phone,
      message,
      type: 'text',
    }, { timeout: 10000 });
  } catch (error) {
    console.error('[PreArrival] SMS reminder failed:', error);
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

function documentToPreferences(doc: PreArrivalDocument): PreArrivalPreferences {
  let roomPreferences: PreArrivalPreferences['roomPreferences'] = undefined;
  if (doc.roomPreferencesJson) {
    try {
      roomPreferences = JSON.parse(doc.roomPreferencesJson);
    } catch {
      roomPreferences = undefined;
    }
  }

  let transportRequests: PreArrivalPreferences['transportRequests'] = undefined;
  if (doc.transportRequestsJson) {
    try {
      transportRequests = JSON.parse(doc.transportRequestsJson);
    } catch {
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
export async function checkPreArrivalReminders(): Promise<void> {
  try {
    // Find bookings with upcoming check-in dates
    // This would typically be called by a cron job
    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find bookings that need reminders
    // For each, check if preferences are set and send reminder if not
    logger.info('[PreArrival] Checking for pending reminders...');
  } catch (error) {
    console.error('[PreArrival] Reminder check failed:', error);
  }
}

/**
 * Get pre-arrival analytics
 */
export async function getPreArrivalAnalytics(hotelId: string, period: 'week' | 'month' = 'week'): Promise<{
  totalBookings: number;
  preferencesSet: number;
  conversionRate: number;
  mostRequestedPillow: string;
  avgTemperature: number;
  specialOccasions: Record<string, number>;
}> {
  try {
    let startDate: Date;
    const now = new Date();

    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
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
  } catch (error) {
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
