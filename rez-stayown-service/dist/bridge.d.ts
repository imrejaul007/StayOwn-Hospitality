/**
 * StayOwn Bridge - Integration with Hotel PMS
 *
 * This module handles communication between StayOwn (OTA) and Hotel PMS.
 * Key integrations:
 * 1. Folio sync - charges from Room QR to PMS billing
 * 2. Booking sync - booking creation and updates
 * 3. Room assignment - link Room QR to PMS room data
 */
export interface FolioCharge {
    bookingId: string;
    hotelId: string;
    category: 'minibar' | 'laundry' | 'room_service' | 'restaurant' | 'spa' | 'transport' | 'other';
    description: string;
    amountPaise: number;
    quantity?: number;
    unitPricePaise?: number;
    source: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
}
export interface FolioChargeResult {
    success: boolean;
    transactionId?: string;
    error?: string;
}
export interface RoomAssignment {
    bookingId: string;
    hotelId: string;
    roomId: string;
    roomNumber: string;
    floorNumber?: string;
}
export interface PMSBooking {
    bookingId: string;
    pmsBookingId: string;
    propertyId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
}
/**
 * Add a charge to guest folio in Hotel PMS
 */
export declare function addChargeToFolio(charge: FolioCharge): Promise<FolioChargeResult>;
/**
 * Get folio for a booking (charges + payments)
 */
export declare function getBookingFolio(bookingId: string): Promise<{
    success: boolean;
    data?: {
        bookingId: string;
        roomCharges: any[];
        serviceCharges: any[];
        payments: any[];
        totalCharges: number;
        totalPayments: number;
        balanceDue: number;
    };
    error?: string;
}>;
/**
 * Complete checkout in PMS
 */
export declare function completeCheckout(bookingId: string, paymentDetails?: {
    method: 'upi' | 'card' | 'cash' | 'wallet';
    amountPaise: number;
    transactionId?: string;
}): Promise<{
    success: boolean;
    checkoutId?: string;
    error?: string;
}>;
/**
 * Link Room QR to PMS room assignment
 */
export declare function assignRoomToBooking(assignment: RoomAssignment): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get room details from PMS
 */
export declare function getRoomDetails(hotelId: string, roomId: string): Promise<{
    success: boolean;
    data?: {
        roomId: string;
        roomNumber: string;
        floorNumber: string;
        roomType: string;
        status: string;
        amenities: string[];
    };
    error?: string;
}>;
/**
 * Sync booking status from StayOwn to PMS
 */
export declare function syncBookingToPMS(booking: PMSBooking): Promise<{
    success: boolean;
    pmsBookingId?: string;
    error?: string;
}>;
/**
 * Get booking from PMS
 */
export declare function getBookingFromPMS(bookingId: string): Promise<{
    success: boolean;
    data?: PMSBooking;
    error?: string;
}>;
/**
 * Forward webhook from PMS to StayOwn handlers
 */
export declare function handlePMSWebhook(event: string, data: Record<string, unknown>): Promise<void>;
/**
 * Check PMS connectivity
 */
export declare function checkPMSHealth(): Promise<{
    connected: boolean;
    latencyMs?: number;
    error?: string;
}>;
//# sourceMappingURL=bridge.d.ts.map