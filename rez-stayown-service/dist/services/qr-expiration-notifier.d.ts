/**
 * QR Expiration Notification Service
 *
 * Sends reminders when:
 * - Check-in is approaching (24 hours before)
 * - QR code is about to expire (4 hours before)
 * - QR code has expired
 */
interface QRExpirationStatus {
    bookingId: string;
    hotelName: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: Date;
    checkOut: Date;
    expiresAt: Date;
    hoursUntilExpiry: number;
    status: 'approaching' | 'about_to_expire' | 'expired' | 'ok';
}
export interface NotificationResult {
    bookingId: string;
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
    error?: string;
}
/**
 * Check for QR codes that need expiration notifications
 */
export declare function checkExpiringQRs(): Promise<QRExpirationStatus[]>;
/**
 * Send expiration reminder notifications
 */
export declare function sendExpirationReminders(): Promise<NotificationResult[]>;
/**
 * Send a single expiration notification
 */
export declare function sendExpirationNotification(qr: QRExpirationStatus): Promise<NotificationResult>;
/**
 * Send check-in reminder (24 hours before)
 */
export declare function sendCheckinReminder(bookingId: string): Promise<boolean>;
/**
 * Deactivate expired QR codes
 */
export declare function deactivateExpiredQRs(): Promise<number>;
export {};
//# sourceMappingURL=qr-expiration-notifier.d.ts.map