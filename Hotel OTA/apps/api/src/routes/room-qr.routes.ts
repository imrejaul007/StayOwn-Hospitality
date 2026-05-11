import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  captureHotelView,
} from '../services/shared/intent-capture.service';

const router = Router();

const QR_SECRET =
  process.env.ROOM_QR_SECRET ??
  process.env.HOTEL_PMS_QR_SECRET ??
  'dev-hotel-qr-secret-change-in-production';

/**
 * Validate a room QR payload and return room + booking context.
 *
 * QR payload format (Hotel PMS format):
 * {
 *   roomId: string,         // PMS room ID
 *   roomNumber: string,     // "101"
 *   roomType: string,       // "Deluxe"
 *   floor: string,          // "1"
 *   hotelId: string,        // Hotel OTA hotel ID
 *   hotelName: string,
 *   hotelSlug: string,      // URL slug for REZ Now
 *   expiresAt: string,     // ISO date
 *   timestamp: number,
 *   signature: string       // HMAC-SHA256
 * }
 *
 * @route POST /v1/room-qr/validate
 * @access Public (guests scanning QR codes)
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const rawQrData = req.body.qrData ?? req.body.token;

    if (!rawQrData) {
      return res.status(400).json({
        success: false,
        message: 'qrData or token is required',
      });
    }

    let payload: Record<string, unknown>;

    // Parse JSON payload
    try {
      payload = JSON.parse(rawQrData);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR data format',
      });
    }

    // Verify HMAC signature if present
    if (payload.signature) {
      const { signature, ...data } = payload as Record<string, unknown> & { signature?: string };
      const payloadStr = JSON.stringify(data);
      const expectedSig = crypto
        .createHmac('sha256', QR_SECRET)
        .update(payloadStr)
        .digest('hex')
        .slice(0, 16);

      if (signature !== expectedSig) {
        logger.warn('[RoomQR] Invalid QR signature', { received: signature });
        return res.status(401).json({
          success: false,
          message: 'Invalid QR signature',
        });
      }
    }

    // Check expiration
    if (payload.expiresAt) {
      const expiresAt = new Date(payload.expiresAt as string);
      if (expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'QR code has expired',
          expired: true,
        });
      }
    }

    const pmsRoomId = payload.roomId as string;
    const hotelSlug = payload.hotelSlug as string | undefined;
    const roomNumber = payload.roomNumber as string | undefined;
    const roomType = payload.roomType as string | undefined;
    const floor = payload.floor as string | undefined;
    const embeddedBookingId = payload.bookingId as string | undefined;

    if (!pmsRoomId) {
      return res.status(400).json({
        success: false,
        message: 'roomId is required in QR payload',
      });
    }

    // Look up hotel by slug or hotelId from payload
    let hotelId = payload.hotelId as string | undefined;
    let hotel = null;

    if (hotelSlug) {
      hotel = await prisma.hotel.findFirst({
        where: {
          OR: [
            { slug: hotelSlug },
            ...(hotelId ? [{ id: hotelId }] : []),
          ],
        },
        select: { id: true, name: true, slug: true, category: true },
      });
    } else if (hotelId) {
      hotel = await prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { id: true, name: true, slug: true, category: true },
      });
    }

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }

    hotelId = hotel.id;

    // Try to find active booking:
    // 1. First, try embedded bookingId from QR payload
    // 2. Fall back to looking up by hotel + active date range
    let booking = null;

    if (embeddedBookingId) {
      booking = await prisma.booking.findFirst({
        where: {
          id: embeddedBookingId,
          hotelId,
          status: { in: ['confirmed', 'checked_in'] },
        },
        include: {
          user: {
            select: { id: true, fullName: true, phone: true, fcmToken: true },
          },
        },
      });
    }

    // Fallback: find any active booking for this hotel
    if (!booking) {
      const now = new Date();
      booking = await prisma.booking.findFirst({
        where: {
          hotelId,
          status: { in: ['confirmed', 'checked_in'] },
          checkinDate: { lte: now },
          checkoutDate: { gte: now },
        },
        include: {
          user: {
            select: { id: true, fullName: true, phone: true, fcmToken: true },
          },
        },
        orderBy: { checkinDate: 'desc' },
      });
    }

    const roomContext = {
      bookingId: booking?.id ?? '',
      roomId: pmsRoomId,
      roomNumber: roomNumber ?? 'Unknown',
      hotelId,
      hotelName: hotel.name,
      hotelSlug: hotel.slug,
      guestName: booking?.user?.fullName,
      checkIn: booking?.checkinDate?.toISOString(),
      checkOut: booking?.checkoutDate?.toISOString(),
      roomTypeName: roomType ?? 'Standard Room',
      floor: floor ?? '1',
    };

    logger.info('[RoomQR] QR validated', {
      roomId: pmsRoomId,
      bookingId: booking?.id ?? 'none',
      hotelId,
    });

    // RTMN Commerce Memory: Capture guest services intent when QR is scanned
    if (booking?.user?.id) {
      captureHotelView({
        userId: booking.user.id,
        hotelId,
        city: hotel.name,
      }).catch((err) => logger.debug('[IntentCapture] QR scan capture failed', { err }));
    }

    return res.json({
      success: true,
      data: {
        valid: true,
        ...roomContext,
        hasActiveGuest: !!booking,
      },
    });
  } catch (error: any) {
    logger.error('[RoomQR] Validation error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'QR validation failed',
    });
  }
});

export default router;
