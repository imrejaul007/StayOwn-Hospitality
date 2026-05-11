/**
 * Room QR Manager - Room-Bound System
 *
 * Key Concept:
 * - Each ROOM has a FIXED QR code (pre-generated)
 * - When GUEST checks in, QR is LINKED to guest
 * - When guest scans QR, system knows ROOM + GUEST
 *
 * Flow:
 * 1. Hotel creates rooms with fixed QR codes
 * 2. Guest checks in to Room 101
 * 3. System links Room 101's QR to guest
 * 4. Guest scans QR101
 * 5. System knows: Room 101 + Guest John Doe
 * 6. All requests go to Room 101's queue
 */
import mongoose from 'mongoose';
export interface RoomQRConfig {
    hotelId: string;
    hotelName: string;
    hotelSlug: string;
    roomId: string;
    roomNumber: string;
    bookingId?: string;
    guestId?: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    checkIn?: Date;
    checkOut?: Date;
}
export interface GeneratedRoomQR {
    roomId: string;
    roomNumber: string;
    token: string;
    qrPayload: string;
    qrImage: string;
    qrUrl: string;
}
export interface RoomQRLink {
    roomId: string;
    bookingId: string;
    guestId: string;
    guestName: string;
    guestPhone: string;
    checkedInAt: Date;
    checkOut: Date;
    expiresAt: Date;
    isActive: boolean;
}
export declare const RoomQRTemplates: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RoomQRLinks: mongoose.Model<any, {}, {}, {}, any, any>;
export declare const RoomServiceRequests: mongoose.Model<any, {}, {}, {}, any, any>;
/**
 * Generate a fixed QR for a room (done during hotel setup)
 */
export declare function generateRoomQRTemplate(config: {
    hotelId: string;
    hotelName: string;
    hotelSlug: string;
    roomId: string;
    roomNumber: string;
    floor?: string;
    roomType?: string;
}): Promise<GeneratedRoomQR>;
/**
 * Link a guest to a room QR (done at check-in)
 */
export declare function linkGuestToRoomQR(config: {
    roomId: string;
    bookingId: string;
    guestId: string;
    guestName: string;
    guestPhone: string;
    checkOut: Date;
}): Promise<{
    success: boolean;
    qrUrl: string;
    expiresAt: Date;
}>;
/**
 * Unlink guest from room QR (done at check-out)
 */
export declare function unlinkGuestFromRoomQR(roomId: string): Promise<{
    success: boolean;
}>;
/**
 * Validate QR scan and get room + guest context
 */
export declare function validateRoomQRScan(token: string): Promise<{
    valid: boolean;
    roomId?: string;
    roomNumber?: string;
    hotelId?: string;
    hotelSlug?: string;
    guestId?: string;
    guestName?: string;
    bookingId?: string;
    canAccess: boolean;
    error?: string;
}>;
/**
 * Create a service request from scanned QR
 */
export declare function createServiceRequest(config: {
    roomId: string;
    requestType: string;
    items?: Array<{
        name: string;
        quantity: number;
        pricePaise: number;
    }>;
    specialInstructions?: string;
}): Promise<{
    requestId: string;
}>;
/**
 * Get active service requests for a room
 */
export declare function getRoomServiceRequests(roomId: string): Promise<any[]>;
/**
 * Bulk generate QRs for all rooms in a hotel
 */
export declare function bulkGenerateRoomQRs(hotelConfig: {
    hotelId: string;
    hotelName: string;
    hotelSlug: string;
    rooms: Array<{
        roomId: string;
        roomNumber: string;
        floor?: string;
        roomType?: string;
    }>;
}): Promise<{
    generated: number;
    failed: number;
}>;
//# sourceMappingURL=room-qr-manager.d.ts.map