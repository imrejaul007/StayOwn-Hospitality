/**
 * Room QR Email Template
 *
 * HTML email template for sending room QR codes to guests
 */
export interface RoomQREmailData {
    guestName: string;
    hotelName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    qrImage: string;
    qrUrl: string;
}
export declare function generateRoomQREmail(data: RoomQREmailData): string;
/**
 * Generate a plain text version of the email
 */
export declare function generateRoomQRTextEmail(data: RoomQREmailData): string;
/**
 * Generate WhatsApp message for Room QR
 */
export declare function generateWhatsAppMessage(data: RoomQREmailData): string;
//# sourceMappingURL=room-qr-email.d.ts.map