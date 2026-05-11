/**
 * Room QR Integration Module for StayOwn Hotel Booking
 *
 * Features:
 * 1. Auto-generate Room QR when booking is confirmed
 * 2. Send QR to guest via email/WhatsApp/SMS
 * 3. Track Room QR usage
 * 4. Sync charges to StayOwn folio
 */
import mongoose from 'mongoose';
export interface RoomQRConfig {
    hotelId: string;
    hotelName: string;
    hotelSlug: string;
    roomId: string;
    roomNumber: string;
    bookingId: string;
    guestId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: Date;
    checkOut: Date;
}
export interface GeneratedQR {
    qrPayload: QRPpayload;
    qrImage: string;
    qrUrl: string;
    token: string;
    expiresAt: Date;
}
export interface QRPpayload {
    intent: 'room_access';
    hotelId: string;
    roomId: string;
    bookingId: string;
    guestId: string;
    token: string;
    checkIn: string;
    checkOut: string;
}
export interface TokenValidation {
    valid: boolean;
    hotelId?: string;
    roomId?: string;
    bookingId?: string;
    guestId?: string;
    roomNumber?: string;
    expiresAt?: Date;
    canUseServices?: boolean;
    canCheckout?: boolean;
    error?: string;
}
export interface ServiceCharge {
    id: string;
    bookingId: string;
    hotelId: string;
    roomId: string;
    category: 'minibar' | 'laundry' | 'room_service' | 'restaurant' | 'spa' | 'transport' | 'other';
    description: string;
    amountPaise: number;
    quantity: number;
    unitPricePaise: number;
    source: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
    createdAt: Date;
    synced: boolean;
}
export interface ServiceChargeInput {
    bookingId: string;
    hotelId: string;
    roomId: string;
    category: 'minibar' | 'laundry' | 'room_service' | 'restaurant' | 'spa' | 'transport' | 'other';
    description: string;
    amountPaise: number;
    quantity?: number;
    unitPricePaise?: number;
    source?: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
}
export interface CheckoutSummary {
    bookingId: string;
    guestName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    roomCharges: ChargeItem[];
    serviceCharges: ChargeItem[];
    subtotalPaise: number;
    taxesPaise: number;
    totalPaise: number;
    payments: PaymentRecord[];
    balanceDuePaise: number;
    checkoutTime: Date;
}
export interface ChargeItem {
    id: string;
    description: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
    date: Date;
    category: string;
}
export interface PaymentRecord {
    id: string;
    amountPaise: number;
    method: string;
    status: string;
    date: Date;
}
export interface RoomQRDocument extends mongoose.Document {
    bookingId: string;
    hotelId: string;
    roomId: string;
    roomNumber: string;
    guestId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    token: string;
    qrPayload: string;
    qrImage: string;
    qrUrl: string;
    checkIn: Date;
    checkOut: Date;
    expiresAt: Date;
    isActive: boolean;
    lastUsedAt?: Date;
    useCount: number;
    notifications: {
        emailSent: boolean;
        emailSentAt?: Date;
        whatsappSent: boolean;
        whatsappSentAt?: Date;
        smsSent: boolean;
        smsSentAt?: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface ServiceChargeDocument extends mongoose.Document {
    bookingId: string;
    hotelId: string;
    roomId: string;
    category: string;
    description: string;
    amountPaise: number;
    quantity: number;
    unitPricePaise: number;
    source: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
    syncedToFolio: boolean;
    syncedAt?: Date;
    folioTransactionId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RoomQR: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const ServiceCharge: mongoose.Model<any, {}, {}, {}, any, any>;
/**
 * Generate Room QR for a booking
 */
export declare function generateRoomQR(config: RoomQRConfig): Promise<GeneratedQR>;
/**
 * Store generated QR in database
 */
export declare function storeRoomQR(config: RoomQRConfig, generatedQR: GeneratedQR): Promise<RoomQRDocument>;
/**
 * Get QR details for a booking
 */
export declare function getRoomQRByBookingId(bookingId: string): Promise<RoomQRDocument | null>;
/**
 * Get QR details by token
 */
export declare function getRoomQRByToken(token: string): Promise<RoomQRDocument | null>;
/**
 * Validate Room QR token
 */
export declare function validateRoomQRToken(token: string): Promise<TokenValidation>;
/**
 * Send QR notification to guest via multiple channels
 */
export declare function notifyGuestBooking(hotelId: string, bookingId: string, qrData: {
    qrImage: string;
    qrUrl: string;
    hotelName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
}): Promise<void>;
/**
 * Record a service charge
 */
export declare function recordServiceCharge(charge: ServiceChargeInput): Promise<ServiceChargeDocument>;
/**
 * Sync a charge to StayOwn folio via bridge
 */
export declare function syncChargeToFolio(charge: ServiceChargeDocument): Promise<void>;
/**
 * Get all charges for a booking
 */
export declare function getChargesForBooking(bookingId: string): Promise<ServiceChargeDocument[]>;
/**
 * Sync all unsynced charges for a booking
 */
export declare function syncAllChargesToFolio(bookingId: string): Promise<number>;
/**
 * Process room checkout
 */
export declare function processRoomCheckout(bookingId: string): Promise<CheckoutSummary>;
/**
 * Get checkout bill for a booking
 */
export declare function getCheckoutBill(bookingId: string): Promise<CheckoutSummary | null>;
/**
 * Generate and store QR, then notify guest
 * Called when a booking is confirmed
 */
export declare function generateAndNotifyRoomQR(config: RoomQRConfig): Promise<RoomQRDocument>;
/**
 * Resend QR notification for a booking
 */
export declare function resendQRNotification(bookingId: string): Promise<boolean>;
export interface RoomServiceWebhookEvent {
    event: 'request.created' | 'request.completed' | 'charge.added' | 'checkout.requested';
    bookingId: string;
    hotelId: string;
    roomId: string;
    data?: Record<string, any>;
}
/**
 * Handle room service webhook events from Hotel OTA
 */
export declare function handleRoomServiceWebhook(event: RoomServiceWebhookEvent): Promise<void>;
/**
 * Deactivate QR for a booking
 */
export declare function deactivateRoomQR(bookingId: string): Promise<boolean>;
/**
 * Get QR statistics for a hotel
 */
export declare function getHotelQRStats(hotelId: string): Promise<{
    totalQRs: number;
    activeQRs: number;
    totalUses: number;
    averageUses: number;
}>;
//# sourceMappingURL=room-qr.d.ts.map