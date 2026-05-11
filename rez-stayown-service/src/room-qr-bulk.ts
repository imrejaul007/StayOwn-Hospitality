/**
 * Bulk QR Generation Service
 *
 * Generate multiple Room QR codes for:
 * - Multiple bookings
 * - Batch processing
 * - Pre-generated QR codes for walk-in guests
 */

import { RoomQRConfig, RoomQRDocument, generateAndNotifyRoomQR } from './room-qr';
import { getRoomQRByBookingId } from './room-qr';

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
export async function generateBulkRoomQRs(
  request: BulkQRRequest,
  onProgress?: (progress: BulkGenerateProgress) => void
): Promise<BulkQRResult> {
  const results: BulkQRResult = {
    success: false,
    total: request.bookings.length,
    generated: 0,
    skipped: 0,
    failed: 0,
    results: [],
    errors: [],
  };

  const { skipNotification = false, regenerateExisting = false } = request.options || {};

  for (let i = 0; i < request.bookings.length; i++) {
    const booking = request.bookings[i];

    // Report progress
    if (onProgress) {
      onProgress({
        total: request.bookings.length,
        completed: i,
        failed: results.failed,
        current: booking.bookingId,
        percentage: Math.round((i / request.bookings.length) * 100),
      });
    }

    try {
      // Check if QR already exists
      if (!regenerateExisting) {
        const existingQR = await getRoomQRByBookingId(booking.bookingId);
        if (existingQR) {
          results.skipped += 1;
          results.results.push({
            bookingId: booking.bookingId,
            success: true,
            qrId: existingQR._id?.toString(),
          });
          continue;
        }
      }

      // Generate QR
      const config: RoomQRConfig = {
        hotelId: booking.hotelId,
        hotelName: booking.hotelName,
        hotelSlug: booking.hotelSlug,
        roomId: booking.roomId,
        roomNumber: booking.roomNumber,
        bookingId: booking.bookingId,
        guestId: booking.guestId,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        guestPhone: booking.guestPhone,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      };

      if (skipNotification) {
        // Generate without notification (for bulk processing)
        const { generateRoomQR, storeRoomQR } = await import('./room-qr');
        const generated = await generateRoomQR(config);
        await storeRoomQR(config, generated);
      } else {
        await generateAndNotifyRoomQR(config);
      }

      results.generated += 1;
      results.results.push({
        bookingId: booking.bookingId,
        success: true,
      });
    } catch (error: any) {
      results.failed += 1;
      results.errors.push({
        bookingId: booking.bookingId,
        error: error.message || 'Unknown error',
      });
      results.results.push({
        bookingId: booking.bookingId,
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      total: request.bookings.length,
      completed: request.bookings.length,
      failed: results.failed,
      percentage: 100,
    });
  }

  results.success = results.failed === 0;

  return results;
}

/**
 * Pre-generate QR codes for walk-in guests
 * Creates QR with a temporary booking ID
 */
export async function generateWalkinQR(config: Omit<RoomQRConfig, 'bookingId'> & {
  walkinId: string;
}): Promise<RoomQRDocument> {
  const { generateRoomQR, storeRoomQR } = await import('./room-qr');

  const fullConfig: RoomQRConfig = {
    ...config,
    bookingId: `WLK${Date.now()}`,
  };

  const generated = await generateRoomQR(fullConfig);
  return storeRoomQR(fullConfig, generated);
}

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

export async function generateQRTemplate(hotelId: string): Promise<QRTemplate> {
  const { generateRoomQR } = await import('./room-qr');

  const templateId = `TPL${Date.now()}`;

  // Generate a template QR (no booking attached)
  const generated = await generateRoomQR({
    hotelId,
    hotelName: '',
    hotelSlug: '',
    roomId: templateId,
    roomNumber: '',
    bookingId: templateId,
    guestId: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkIn: new Date(),
    checkOut: new Date(),
  });

  return {
    templateId,
    qrPayload: JSON.stringify(generated.qrPayload),
    qrImage: generated.qrImage,
    expiresAt: generated.expiresAt,
    createdAt: new Date(),
  };
}
