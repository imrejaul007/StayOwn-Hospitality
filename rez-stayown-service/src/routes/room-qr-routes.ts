/**
 * Room QR API Routes
 *
 * REST API endpoints for Room QR functionality:
 * - POST /api/room-qr/generate - Generate QR for booking
 * - GET /api/room-qr/:bookingId - Get QR details
 * - POST /api/room-qr/:bookingId/send - Resend notification
 * - POST /api/room-qr/validate - Validate token
 * - POST /api/room-qr/charge - Add charge to folio
 * - GET /api/room-qr/:bookingId/bill - Get bill
 * - POST /api/room-qr/:bookingId/checkout - Process checkout
 */

import { Router, Request, Response } from 'express';
import logger from './utils/logger';
import {
  generateAndNotifyRoomQR,
  getRoomQRByBookingId,
  resendQRNotification,
  validateRoomQRToken,
  recordServiceCharge,
  getCheckoutBill,
  processRoomCheckout,
  getChargesForBooking,
  getHotelQRStats,
  deactivateRoomQR,
  RoomQRConfig,
  ServiceCharge
} from '../room-qr';
import { rateLimiters } from '../middleware/rateLimiter';
import { authenticateToken, authenticateService } from '../middleware/auth';

const router = Router();

// ─── Type Definitions ────────────────────────────────────────────────────────

interface GenerateQRRequest {
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
  checkIn: string;
  checkOut: string;
}

interface ChargeRequest {
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

// ─── Generate QR ─────────────────────────────────────────────────────────────

/**
 * Generate QR for a booking
 * POST /api/room-qr/generate
 * Requires authentication + rate limiting
 */
router.post('/generate', authenticateToken, rateLimiters.qrGenerate, async (req: Request, res: Response) => {
  try {
    const {
      hotelId,
      hotelName,
      hotelSlug,
      roomId,
      roomNumber,
      bookingId,
      guestId,
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut
    } = req.body as GenerateQRRequest;

    // Validate required fields
    if (!hotelId || !roomId || !bookingId || !guestId || !guestEmail || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: hotelId, roomId, bookingId, guestId, guestEmail, checkIn, checkOut'
      });
    }

    const config: RoomQRConfig = {
      hotelId,
      hotelName: hotelName || 'Hotel',
      hotelSlug: hotelSlug || 'hotel',
      roomId,
      roomNumber: roomNumber || 'N/A',
      bookingId,
      guestId,
      guestName: guestName || 'Guest',
      guestEmail,
      guestPhone: guestPhone || '',
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut)
    };

    const roomQR = await generateAndNotifyRoomQR(config);

    logger.info(`[RoomQR API] Generated QR for booking ${bookingId}`);

    res.status(201).json({
      success: true,
      data: {
        id: roomQR._id,
        bookingId: roomQR.bookingId,
        hotelId: roomQR.hotelId,
        roomId: roomQR.roomId,
        roomNumber: roomQR.roomNumber,
        qrUrl: roomQR.qrUrl,
        expiresAt: roomQR.expiresAt,
        notifications: roomQR.notifications,
        createdAt: roomQR.createdAt
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Generate failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate room QR',
      error: error.message
    });
  }
});

// ─── Get QR Details ──────────────────────────────────────────────────────────

/**
 * Get QR details for a booking
 * GET /api/room-qr/:bookingId
 * Requires authentication
 */
router.get('/:bookingId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const roomQR = await getRoomQRByBookingId(bookingId);

    if (!roomQR) {
      return res.status(404).json({
        success: false,
        message: 'Room QR not found for this booking'
      });
    }

    res.json({
      success: true,
      data: {
        id: roomQR._id,
        bookingId: roomQR.bookingId,
        hotelId: roomQR.hotelId,
        roomId: roomQR.roomId,
        roomNumber: roomQR.roomNumber,
        guestName: roomQR.guestName,
        guestEmail: roomQR.guestEmail,
        qrUrl: roomQR.qrUrl,
        qrImage: roomQR.qrImage,
        checkIn: roomQR.checkIn,
        checkOut: roomQR.checkOut,
        expiresAt: roomQR.expiresAt,
        isActive: roomQR.isActive,
        useCount: roomQR.useCount,
        lastUsedAt: roomQR.lastUsedAt,
        notifications: roomQR.notifications,
        createdAt: roomQR.createdAt
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Get failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room QR',
      error: error.message
    });
  }
});

// ─── Resend Notification ─────────────────────────────────────────────────────

/**
 * Resend QR notification
 * POST /api/room-qr/:bookingId/send
 * Requires authentication
 */
router.post('/:bookingId/send', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { channel } = req.body; // 'email', 'whatsapp', 'sms', or 'all'

    const success = await resendQRNotification(bookingId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Room QR not found or notification failed'
      });
    }

    logger.info(`[RoomQR API] Resent notification for booking ${bookingId}`);

    res.json({
      success: true,
      message: `Notification sent via ${channel || 'all channels'}`,
      data: {
        bookingId,
        channel: channel || 'all'
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Resend failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend notification',
      error: error.message
    });
  }
});

// ─── Validate Token ──────────────────────────────────────────────────────────

/**
 * Validate QR token
 * POST /api/room-qr/validate
 * Rate limited: 100 requests per minute
 */
router.post('/validate', rateLimiters.qrValidateHigh, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const validation = await validateRoomQRToken(token);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
        data: validation
      });
    }

    res.json({
      success: true,
      data: validation
    });
  } catch (error: any) {
    console.error('[RoomQR API] Validate failed:', error);
    res.status(500).json({
      success: false,
      message: 'Token validation failed',
      error: error.message
    });
  }
});

// ─── Add Charge ──────────────────────────────────────────────────────────────

/**
 * Add charge to folio
 * POST /api/room-qr/charge
 * Requires authentication + rate limiting
 */
router.post('/charge', authenticateToken, rateLimiters.charge, async (req: Request, res: Response) => {
  try {
    const {
      bookingId,
      hotelId,
      roomId,
      category,
      description,
      amountPaise,
      quantity = 1,
      unitPricePaise,
      source = 'manual'
    } = req.body as ChargeRequest;

    // Validate required fields
    if (!bookingId || !hotelId || !roomId || !category || !description || !amountPaise) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: bookingId, hotelId, roomId, category, description, amountPaise'
      });
    }

    const charge = await recordServiceCharge({
      bookingId,
      hotelId,
      roomId,
      category,
      description,
      amountPaise,
      quantity,
      unitPricePaise: unitPricePaise || amountPaise,
      source: source || 'manual'
    });

    logger.info(`[RoomQR API] Added charge for booking ${bookingId}: ${amountPaise} paise`);

    res.status(201).json({
      success: true,
      data: {
        id: charge._id,
        bookingId: charge.bookingId,
        category: charge.category,
        description: charge.description,
        amountPaise: charge.amountPaise,
        quantity: charge.quantity,
        unitPricePaise: charge.unitPricePaise,
        source: charge.source,
        syncedToFolio: charge.syncedToFolio,
        createdAt: charge.createdAt
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Charge failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add charge',
      error: error.message
    });
  }
});

// ─── Get Charges ─────────────────────────────────────────────────────────────

/**
 * Get charges for a booking
 * GET /api/room-qr/:bookingId/charges
 * Requires authentication
 */
router.get('/:bookingId/charges', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const charges = await getChargesForBooking(bookingId);

    res.json({
      success: true,
      data: {
        bookingId,
        charges: charges.map(c => ({
          id: c._id,
          category: c.category,
          description: c.description,
          amountPaise: c.amountPaise,
          quantity: c.quantity,
          unitPricePaise: c.unitPricePaise,
          source: c.source,
          syncedToFolio: c.syncedToFolio,
          createdAt: c.createdAt
        })),
        totalCharges: charges.length,
        totalAmountPaise: charges.reduce((sum, c) => sum + c.amountPaise, 0)
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Get charges failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get charges',
      error: error.message
    });
  }
});

// ─── Get Bill ───────────────────────────────────────────────────────────────

/**
 * Get checkout bill
 * GET /api/room-qr/:bookingId/bill
 * Requires authentication
 */
router.get('/:bookingId/bill', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const bill = await getCheckoutBill(bookingId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found for this booking'
      });
    }

    res.json({
      success: true,
      data: {
        bookingId: bill.bookingId,
        guestName: bill.guestName,
        roomNumber: bill.roomNumber,
        checkIn: bill.checkIn,
        checkOut: bill.checkOut,
        roomCharges: bill.roomCharges,
        serviceCharges: bill.serviceCharges,
        subtotalPaise: bill.subtotalPaise,
        taxesPaise: bill.taxesPaise,
        totalPaise: bill.totalPaise,
        balanceDuePaise: bill.balanceDuePaise
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Get bill failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bill',
      error: error.message
    });
  }
});

// ─── Process Checkout ───────────────────────────────────────────────────────

/**
 * Process checkout
 * POST /api/room-qr/:bookingId/checkout
 * Requires authentication + rate limiting
 */
router.post('/:bookingId/checkout', authenticateToken, rateLimiters.checkout, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const summary = await processRoomCheckout(bookingId);

    logger.info(`[RoomQR API] Processed checkout for booking ${bookingId}`);

    res.json({
      success: true,
      data: {
        bookingId: summary.bookingId,
        guestName: summary.guestName,
        roomNumber: summary.roomNumber,
        checkIn: summary.checkIn,
        checkOut: summary.checkOut,
        roomCharges: summary.roomCharges,
        serviceCharges: summary.serviceCharges,
        subtotalPaise: summary.subtotalPaise,
        taxesPaise: summary.taxesPaise,
        totalPaise: summary.totalPaise,
        payments: summary.payments,
        balanceDuePaise: summary.balanceDuePaise,
        checkoutTime: summary.checkoutTime
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Checkout failed:', error);
    res.status(500).json({
      success: false,
      message: 'Checkout processing failed',
      error: error.message
    });
  }
});

// ─── Deactivate QR ──────────────────────────────────────────────────────────

/**
 * Deactivate QR code
 * POST /api/room-qr/:bookingId/deactivate
 * Requires authentication
 */
router.post('/:bookingId/deactivate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const success = await deactivateRoomQR(bookingId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Room QR not found'
      });
    }

    logger.info(`[RoomQR API] Deactivated QR for booking ${bookingId}`);

    res.json({
      success: true,
      message: 'QR code deactivated',
      data: { bookingId }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Deactivate failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate QR',
      error: error.message
    });
  }
});

// ─── Hotel Stats ────────────────────────────────────────────────────────────

/**
 * Get QR statistics for a hotel
 * GET /api/room-qr/hotel/:hotelId/stats
 * Requires authentication
 */
router.get('/hotel/:hotelId/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;

    const stats = await getHotelQRStats(hotelId);

    res.json({
      success: true,
      data: {
        hotelId,
        ...stats
      }
    });
  } catch (error: any) {
    console.error('[RoomQR API] Stats failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
});

// ─── Webhook Handler ────────────────────────────────────────────────────────

/**
 * Handle room service webhook events
 * POST /api/room-qr/webhook
 * Requires service authentication via authenticateService middleware
 */
router.post('/webhook', authenticateService, async (req: Request, res: Response) => {
  try {
    const { event, bookingId, hotelId, roomId, data } = req.body;

    // Additional webhook secret verification for extra security
    const webhookSecret = req.headers['x-webhook-secret'] as string;
    const expectedSecret = process.env.ROOM_QR_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook secret'
      });
    }

    // Import webhook handler
    const { handleRoomServiceWebhook } = await import('../room-qr');

    await handleRoomServiceWebhook({
      event,
      bookingId,
      hotelId,
      roomId,
      data
    });

    res.json({
      success: true,
      message: 'Webhook processed'
    });
  } catch (error: any) {
    console.error('[RoomQR API] Webhook failed:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

export default router;
