/**
 * PMS → StayOwn Webhooks
 *
 * Receives events from Hotel-PMS:
 * - check_in: Room assigned, guest checked in
 * - check_out: Guest checked out
 * - booking_update: Booking details changed
 * - room_status_change: Room status changed
 */

import { Router, Request, Response } from 'express';
import logger from './utils/logger';
import crypto from 'crypto';
import { generateAndNotifyRoomQR, RoomQR, RoomQRConfig } from '../room-qr';
import { deactivateRoomQR } from '../room-qr';

const router = Router();

const WEBHOOK_SECRET = process.env.PMS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || 'dev-webhook-secret';

/**
 * Verify HMAC signature from PMS
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'dev-webhook-secret') {
    // Development mode - skip verification
    logger.warn('[Webhook] Running in dev mode - skipping signature verification');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expectedSignature)
  );
}

/**
 * Check-in Webhook
 * PMS sends this when guest is checked in and room is assigned
 *
 * Body:
 * {
 *   event: 'check_in',
 *   bookingId: string,
 *   roomId: string,
 *   roomNumber: string,
 *   roomType: string,
 *   floor?: string,
 *   guestName: string,
 *   guestEmail: string,
 *   guestPhone: string,
 *   checkInTime: string,
 *   checkOutTime: string
 * }
 */
router.post('/check-in', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      logger.warn('[Webhook] Invalid signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    const {
      bookingId,
      roomId,
      roomNumber,
      roomType,
      floor,
      guestName,
      guestEmail,
      guestPhone,
      checkInTime,
      checkOutTime,
      hotelId,
      hotelName,
      hotelSlug,
    } = req.body;

    console.log('[Webhook] Check-in received:', {
      bookingId,
      roomId,
      roomNumber,
    });

    // Find the booking in our system
    // The bookingId from PMS should match or we need to look it up
    let roomQR = await RoomQR.findOne({
      $or: [
        { bookingId: bookingId },
        { guestPhone: guestPhone },
      ],
    });

    if (!roomQR) {
      logger.info('[Webhook] Booking not found, creating new Room QR');

      // Create Room QR for walk-in or external booking
      const config: RoomQRConfig = {
        hotelId: hotelId || 'H001',
        hotelName: hotelName || 'Hotel',
        hotelSlug: hotelSlug || 'hotel',
        roomId: roomId,
        roomNumber: roomNumber,
        bookingId: bookingId,
        guestId: `GUEST_${Date.now()}`,
        guestName: guestName,
        guestEmail: guestEmail,
        guestPhone: guestPhone,
        checkIn: new Date(checkInTime),
        checkOut: new Date(checkOutTime),
      };

      const qr = await generateAndNotifyRoomQR(config);
      roomQR = qr;
    } else {
      // Update existing Room QR with room assignment
      roomQR.roomId = roomId;
      roomQR.roomNumber = roomNumber;
      roomQR.isActive = true;
      roomQR.lastUsedAt = undefined;
      roomQR.useCount = 0;
      await roomQR.save();

      // Generate new QR with updated room info
      const config: RoomQRConfig = {
        hotelId: roomQR.hotelId,
        hotelName: roomQR.hotelName,
        hotelSlug: roomQR.hotelSlug || 'hotel',
        roomId: roomId,
        roomNumber: roomNumber,
        bookingId: roomQR.bookingId,
        guestId: roomQR.guestId,
        guestName: roomQR.guestName,
        guestEmail: roomQR.guestEmail,
        guestPhone: roomQR.guestPhone,
        checkIn: new Date(checkInTime),
        checkOut: new Date(checkOutTime),
      };

      // Regenerate QR with new room details
      const { generateRoomQR, storeRoomQR } = await import('../room-qr');
      const generated = await generateRoomQR(config);
      await storeRoomQR(config, generated);

      // Update the record
      roomQR.qrPayload = JSON.stringify(generated.qrPayload);
      roomQR.qrImage = generated.qrImage;
      roomQR.expiresAt = generated.expiresAt;
      await roomQR.save();

      logger.info('[Webhook] Room QR updated with room assignment');
    }

    // Send notifications to guest
    if (roomQR) {
      // In production, send actual notifications
      logger.info('[Webhook] QR generated, notifications would be sent');
    }

    res.json({
      success: true,
      data: {
        bookingId,
        roomId,
        roomNumber,
        qrGenerated: true,
        qrUrl: roomQR?.qrUrl,
      },
    });
  } catch (error: any) {
    console.error('[Webhook] Check-in error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Webhook processing failed',
    });
  }
});

/**
 * Check-out Webhook
 * PMS sends this when guest checks out
 */
router.post('/check-out', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifySignature(rawBody, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    const { bookingId, roomId, checkoutTime } = req.body;

    console.log('[Webhook] Check-out received:', { bookingId, roomId });

    // Deactivate the Room QR
    if (bookingId) {
      await deactivateRoomQR(bookingId);
    }

    res.json({
      success: true,
      data: {
        bookingId,
        checkoutProcessed: true,
      },
    });
  } catch (error: any) {
    console.error('[Webhook] Check-out error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Webhook processing failed',
    });
  }
});

/**
 * Booking Update Webhook
 * PMS sends this for any booking changes
 */
router.post('/booking-update', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifySignature(rawBody, signature)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    const { bookingId, updateType, data } = req.body;

    console.log('[Webhook] Booking update:', { bookingId, updateType });

    res.json({
      success: true,
      data: { processed: true },
    });
  } catch (error: any) {
    console.error('[Webhook] Booking update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Webhook processing failed',
    });
  }
});

/**
 * Health check for webhook endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', webhook: 'stayown' });
});

export default router;
