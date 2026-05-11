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
import mongoose from 'mongoose';
export interface GuestPreferences {
    checkInTime?: string;
    roomType?: string;
    floor?: string;
    smoking?: boolean;
    quietRoom?: boolean;
    highFloor?: boolean;
    earlyCheckin?: boolean;
    lateCheckout?: boolean;
    specialRequests?: string;
}
export interface EmergencyContact {
    name: string;
    phone: string;
    relationship: string;
}
export interface CheckinData {
    bookingId: string;
    userId: string;
    hotelId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestAddress?: string;
    idType: 'passport' | 'aadhar' | 'driving_license' | 'voter_id';
    idNumber: string;
    idImage?: string;
    idVerified: boolean;
    preferences: GuestPreferences;
    emergencyContact?: EmergencyContact;
    incidentalPaymentMethod?: 'credit_card' | 'debit_card' | 'cash';
    signature?: string;
    termsAccepted: boolean;
    status: 'pending' | 'in_progress' | 'ready' | 'completed';
    step: number;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface DigitalKey {
    keyId: string;
    bookingId: string;
    roomId: string;
    roomNumber: string;
    validFrom: Date;
    validUntil: Date;
    qrCode: string;
    qrCodeImage?: string;
    nfcData?: string;
    status: 'active' | 'expired' | 'revoked';
    createdAt: Date;
    updatedAt: Date;
}
export interface BookingInfo {
    bookingId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    hotelId: string;
    hotelName?: string;
    checkIn: Date;
    checkOut: Date;
    roomType?: string;
}
export interface RoomAssignment {
    roomId: string;
    roomNumber: string;
    floor?: string;
    checkIn: Date;
    checkOut: Date;
}
export declare const Checkin: mongoose.Model<any, {}, {}, {}, any, any, any>;
export declare const DigitalKeyModel: mongoose.Model<any, {}, {}, {}, any, any, any>;
/**
 * Start check-in process for a booking
 */
export declare function startCheckin(bookingId: string, userId: string): Promise<CheckinData>;
/**
 * Get check-in data for a booking
 */
export declare function getCheckin(bookingId: string): Promise<CheckinData | null>;
/**
 * Get check-in data by user ID
 */
export declare function getCheckinByUser(userId: string): Promise<CheckinData[]>;
/**
 * Update check-in step
 */
export declare function updateCheckin(bookingId: string, updates: Partial<CheckinData>): Promise<CheckinData>;
/**
 * Verify guest ID
 */
export declare function verifyId(bookingId: string, idType: CheckinData['idType'], idNumber: string, idImage?: string): Promise<CheckinData>;
/**
 * Complete check-in and generate digital key
 */
export declare function completeCheckin(bookingId: string): Promise<DigitalKey>;
/**
 * Get digital key for a booking
 */
export declare function getDigitalKey(bookingId: string): Promise<DigitalKey | null>;
/**
 * Get digital key by key ID
 */
export declare function getDigitalKeyById(keyId: string): Promise<DigitalKey | null>;
/**
 * Get all active keys for a room
 */
export declare function getRoomKeys(roomId: string): Promise<DigitalKey[]>;
/**
 * Revoke digital key (on checkout or emergency)
 */
export declare function revokeKey(keyId: string, reason: string): Promise<DigitalKey>;
/**
 * Revoke all keys for a booking (typically on checkout)
 */
export declare function revokeBookingKeys(bookingId: string, reason?: string): Promise<number>;
/**
 * Express checkout - process guest checkout
 */
export declare function expressCheckout(bookingId: string): Promise<{
    success: boolean;
    message: string;
    charges?: any;
}>;
/**
 * Validate a QR code scan
 */
export declare function validateQRCodeScan(qrPayload: string): Promise<{
    valid: boolean;
    key?: DigitalKey;
    error?: string;
}>;
/**
 * Get check-in statistics for a hotel
 */
export declare function getCheckinStats(hotelId: string, period?: 'today' | 'week' | 'month'): Promise<{
    totalCheckins: number;
    completedCheckins: number;
    pendingCheckins: number;
    activeKeys: number;
    averageCheckinTime: number;
}>;
/**
 * Send digital key to guest
 */
export declare function sendKeyToGuest(bookingId: string): Promise<boolean>;
export declare const digitalCheckinService: {
    startCheckin: typeof startCheckin;
    getCheckin: typeof getCheckin;
    getCheckinByUser: typeof getCheckinByUser;
    updateCheckin: typeof updateCheckin;
    verifyId: typeof verifyId;
    completeCheckin: typeof completeCheckin;
    getDigitalKey: typeof getDigitalKey;
    getDigitalKeyById: typeof getDigitalKeyById;
    getRoomKeys: typeof getRoomKeys;
    revokeKey: typeof revokeKey;
    revokeBookingKeys: typeof revokeBookingKeys;
    expressCheckout: typeof expressCheckout;
    validateQRCodeScan: typeof validateQRCodeScan;
    getCheckinStats: typeof getCheckinStats;
    sendKeyToGuest: typeof sendKeyToGuest;
};
export default digitalCheckinService;
//# sourceMappingURL=digital-checkin.service.d.ts.map