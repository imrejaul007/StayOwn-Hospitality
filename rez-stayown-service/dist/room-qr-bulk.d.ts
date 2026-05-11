/**
 * Bulk QR Generation Service
 *
 * Generate multiple Room QR codes for:
 * - Multiple bookings
 * - Batch processing
 * - Pre-generated QR codes for walk-in guests
 */
import { RoomQRConfig, RoomQRDocument } from './room-qr';
export interface BulkQRRequest {
    bookings: Array<{
        bookingId: string;
        hotelId: string;
        hotelName: string;
        hotelSlug: string;
        roomId: string;
        roomNumber: string;
        guestId: string;
        guestName: string;
        guestEmail: string;
        guestPhone: string;
        checkIn: Date;
        checkOut: Date;
    }>;
    options?: {
        skipNotification?: boolean;
        regenerateExisting?: boolean;
    };
}
export interface BulkQRResult {
    success: boolean;
    total: number;
    generated: number;
    skipped: number;
    failed: number;
    results: Array<{
        bookingId: string;
        success: boolean;
        qrId?: string;
        error?: string;
    }>;
    errors: Array<{
        bookingId: string;
        error: string;
    }>;
}
export interface BulkGenerateProgress {
    total: number;
    completed: number;
    failed: number;
    current?: string;
    percentage: number;
}
/**
 * Generate QR codes for multiple bookings
 */
export declare function generateBulkRoomQRs(request: BulkQRRequest, onProgress?: (progress: BulkGenerateProgress) => void): Promise<BulkQRResult>;
/**
 * Pre-generate QR codes for walk-in guests
 * Creates QR with a temporary booking ID
 */
export declare function generateWalkinQR(config: Omit<RoomQRConfig, 'bookingId'> & {
    walkinId: string;
}): Promise<RoomQRDocument>;
/**
 * Generate QR template for offline use
 * Creates QR data that can be printed and assigned later
 */
export interface QRTemplate {
    templateId: string;
    qrPayload: string;
    qrImage: string;
    expiresAt: Date;
    createdAt: Date;
}
export declare function generateQRTemplate(hotelId: string): Promise<QRTemplate>;
//# sourceMappingURL=room-qr-bulk.d.ts.map