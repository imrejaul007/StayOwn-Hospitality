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
    roomPreferencesJson?: string;
    transportRequestsJson?: string;
    notes?: string;
    syncedToRoomQR: boolean;
    syncedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PreArrival: mongoose.Model<any, {}, {}, {}, any, any>;
/**
 * Get pre-arrival preferences for a booking
 */
export declare function getPreArrivalPreferences(bookingId: string): Promise<PreArrivalPreferences | null>;
/**
 * Get pre-arrival preferences by guest ID
 */
export declare function getPreArrivalByGuest(guestId: string): Promise<PreArrivalPreferences[]>;
/**
 * Save pre-arrival preferences
 */
export declare function savePreArrivalPreferences(preferences: Partial<PreArrivalPreferences>): Promise<PreArrivalPreferences>;
/**
 * Delete pre-arrival preferences
 */
export declare function deletePreArrivalPreferences(bookingId: string): Promise<boolean>;
/**
 * Sync pre-arrival preferences to Room QR service
 */
export declare function syncPreferencesToRoomQR(bookingId: string): Promise<boolean>;
/**
 * Auto-sync preferences when guest checks in
 */
export declare function onGuestCheckIn(bookingId: string): Promise<void>;
/**
 * Send pre-arrival reminder to guest
 */
export declare function sendPreArrivalReminder(guestId: string, bookingId: string, hotelName: string, checkInDate: Date): Promise<boolean>;
/**
 * Check if pre-arrival preferences need reminder
 */
export declare function checkPreArrivalReminders(): Promise<void>;
/**
 * Get pre-arrival analytics
 */
export declare function getPreArrivalAnalytics(hotelId: string, period?: 'week' | 'month'): Promise<{
    totalBookings: number;
    preferencesSet: number;
    conversionRate: number;
    mostRequestedPillow: string;
    avgTemperature: number;
    specialOccasions: Record<string, number>;
}>;
//# sourceMappingURL=pre-arrival.d.ts.map