/**
 * Room QR Manager Routes
 *
 * Handles room-bound QR system:
 * - GET /api/room-qr/template/:roomId - Get room QR template
 * - POST /api/room-qr/link - Link guest to room QR (check-in)
 * - POST /api/room-qr/unlink - Unlink guest from room QR (check-out)
 * - POST /api/room-qr/validate - Validate QR scan
 * - POST /api/room-qr/request - Create service request
 * - GET /api/room-qr/requests/:roomId - Get room requests
 * - POST /api/room-qr/bulk-generate - Bulk generate QRs for hotel
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  generateRoomQRTemplate,
  linkGuestToRoomQR,
  unlinkGuestFromRoomQR,
  validateRoomQRScan,
  createServiceRequest,
  getRoomServiceRequests,
  bulkGenerateRoomQRs,
  RoomQRTemplates,
} from '../room-qr-manager';

const router = Router();

const WEBHOOK_SECRET = process.env.PMS_WEBHOOK_SECRET || 'dev-webhook-secret';

/**
 * Generate QR for a room (during hotel setup)
 * POST /api/room-qr/template
 */
router.post('/template', async (req: Request, res: Response) => {
  try {
    const { hotelId, hotelName, hotelSlug, roomId, roomNumber, floor, roomType } = req.body;

    if (!hotelId || !roomId || !roomNumber) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const qr = await generateRoomQRTemplate({
      hotelId,
      hotelName: hotelName || 'Hotel',
      hotelSlug: hotelSlug || 'hotel',
      roomId,
      roomNumber,
      floor,
      roomType,
    });

    // Save to database
    await RoomQRTemplates.findOneAndUpdate(
      { roomId },
      {
        roomId,
        roomNumber,
        floor,
        roomType,
        hotelId,
        hotelName: hotelName || 'Hotel',
        hotelSlug: hotelSlug || 'hotel',
        token: qr.token,
        qrPayload: qr.qrPayload,
        qrImage: qr.qrImage,
        qrUrl: qr.qrUrl,
        isActive: false,
        useCount: 0,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: {
        roomId,
        roomNumber,
        qrUrl: qr.qrUrl,
        qrImage: qr.qrImage,
      },
    });
  } catch (error: any) {
    console.error('[RoomQR] Template error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Link guest to room QR (check-in)
 * POST /api/webhooks/pms/check-in (from PMS)
 */
router.post('/link', async (req: Request, res: Response) => {
  try {
    // Verify signature
    const signature = req.headers['x-webhook-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (process.env.NODE_ENV === 'production') {
      const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
      if (signature !== expected) {
        res.status(401).json({ success: false, message: 'Invalid signature' });
        return;
      }
    }

    const {
      roomId,
      bookingId,
      guestId,
      guestName,
      guestPhone,
      checkOut,
      hotelId,
      hotelName,
      hotelSlug,
    } = req.body;

    if (!roomId || !guestName) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const result = await linkGuestToRoomQR({
      roomId,
      bookingId: bookingId || `BK_${Date.now()}`,
      guestId: guestId || `G_${Date.now()}`,
      guestName,
      guestPhone: guestPhone || '',
      checkOut: new Date(checkOut),
    });

    res.json({
      success: true,
      data: {
        roomId,
        linked: true,
        qrUrl: result.qrUrl,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[RoomQR] Link error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Unlink guest from room QR (check-out)
 * POST /api/webhooks/pms/check-out
 */
router.post('/unlink', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.body;

    const result = await unlinkGuestFromRoomQR(roomId);

    res.json({
      success: result.success,
      data: { roomId, unlinked: result.success },
    });
  } catch (error: any) {
    console.error('[RoomQR] Unlink error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Validate QR scan and get room + guest context
 * POST /api/room-qr/validate
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: 'Token required' });
      return;
    }

    const result = await validateRoomQRScan(token);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[RoomQR] Validate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Create service request from QR scan
 * POST /api/room-qr/request
 */
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { roomId, requestType, items, specialInstructions } = req.body;

    if (!roomId || !requestType) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const result = await createServiceRequest({
      roomId,
      requestType,
      items,
      specialInstructions,
    });

    res.status(201).json({
      success: true,
      data: { requestId: result.requestId },
    });
  } catch (error: any) {
    console.error('[RoomQR] Request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get service requests for a room
 * GET /api/room-qr/requests/:roomId
 */
router.get('/requests/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const requests = await getRoomServiceRequests(roomId);

    res.json({
      success: true,
      data: { requests },
    });
  } catch (error: any) {
    console.error('[RoomQR] Requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Bulk generate QRs for all rooms in a hotel
 * POST /api/room-qr/bulk-generate
 */
router.post('/bulk-generate', async (req: Request, res: Response) => {
  try {
    const { hotelId, hotelName, hotelSlug, rooms } = req.body;

    if (!hotelId || !rooms?.length) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    const result = await bulkGenerateRoomQRs({
      hotelId,
      hotelName: hotelName || 'Hotel',
      hotelSlug: hotelSlug || 'hotel',
      rooms,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[RoomQR] Bulk generate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get all rooms with QR status for a hotel
 * GET /api/room-qr/hotel/:hotelId
 */
router.get('/hotel/:hotelId', async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;

    const rooms = await RoomQRTemplates.find({ hotelId });

    res.json({
      success: true,
      data: {
        hotelId,
        totalRooms: rooms.length,
        activeRooms: rooms.filter(r => r.isActive).length,
        rooms: rooms.map(r => ({
          roomId: r.roomId,
          roomNumber: r.roomNumber,
          floor: r.floor,
          roomType: r.roomType,
          isActive: r.isActive,
          guestName: r.currentLink?.guestName,
          checkOut: r.currentLink?.checkOut,
          useCount: r.useCount,
        })),
      },
    });
  } catch (error: any) {
    console.error('[RoomQR] Hotel rooms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
