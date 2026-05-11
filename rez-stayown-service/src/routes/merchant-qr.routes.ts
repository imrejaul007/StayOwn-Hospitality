/**
 * Merchant QR Scanner Routes
 *
 * Endpoints for hotel staff to scan guest QR codes:
 * - POST /api/merchant/scan - Scan and validate QR
 * - POST /api/merchant/checkin - Mark guest checked in via QR
 * - GET /api/merchant/booking/:token - Get booking details
 */

import { Router, Request, Response } from 'express';
import { validateRoomQRToken, getRoomQRByToken, getRoomQRByBookingId } from '../room-qr';
import { authenticateService } from '../middleware/auth';
import { rateLimiters } from '../middleware/rateLimiter';
import axios from 'axios';

const router = Router();

const HOTEL_PMS_URL = process.env.HOTEL_PMS_URL || 'http://localhost:3008';

// ─── Scan QR Code ───────────────────────────────────────────────────────────────

/**
 * Scan and validate a guest QR code
 * POST /api/merchant/scan
 */
router.post('/scan', authenticateService, rateLimiters.qrValidate, async (req: Request, res: Response) => {
  try {
    const { token, action } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'QR token is required',
      });
      return;
    }

    // Validate the token
    const validation = await validateRoomQRToken(token);

    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: validation.error || 'Invalid QR code',
        data: {
          valid: false,
          error: validation.error,
        },
      });
      return;
    }

    // Get full QR details
    const qrRecord = await getRoomQRByToken(token);

    if (!qrRecord) {
      res.status(404).json({
        success: false,
        message: 'QR record not found',
      });
      return;
    }

    // Check time-based permissions
    const now = new Date();
    const isWithinStay = now >= qrRecord.checkIn && now <= qrRecord.checkOut;
    const isWithinGrace = now <= qrRecord.expiresAt;

    res.json({
      success: true,
      data: {
        valid: true,
        bookingId: validation.bookingId,
        hotelId: validation.hotelId,
        roomId: validation.roomId,
        roomNumber: validation.roomNumber,
        guestName: qrRecord.guestName,
        guestEmail: qrRecord.guestEmail,
        checkIn: qrRecord.checkIn,
        checkOut: qrRecord.checkOut,
        canAccessRoom: isWithinStay,
        canCheckout: isWithinGrace,
        isWithinStay,
        expiresAt: qrRecord.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[MerchantQR] Scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scan QR',
    });
  }
});

// ─── Quick Check-in via QR ────────────────────────────────────────────────────

/**
 * Quick check-in using QR token
 * POST /api/merchant/checkin
 */
router.post('/checkin', authenticateService, rateLimiters.general, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const hotelId = req.headers['x-hotel-id'] as string;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'QR token is required',
      });
      return;
    }

    // Validate token
    const validation = await validateRoomQRToken(token);

    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: validation.error || 'Invalid QR code',
      });
      return;
    }

    // Notify PMS of check-in
    try {
      await axios.post(
        `${HOTEL_PMS_URL}/v1/pms/inventory/checkin`,
        {
          bookingId: validation.bookingId,
          hotelId: hotelId || validation.hotelId,
          checkinMethod: 'qr_scan',
          staffId: req.user?.sub || 'unknown',
        },
        {
          timeout: 5000,
          headers: {
            'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
        }
      );
    } catch {
      // PMS notification failed, continue
    }

    res.json({
      success: true,
      message: 'Guest checked in successfully',
      data: {
        bookingId: validation.bookingId,
        roomNumber: validation.roomNumber,
        guestName: validation.bookingId ? (await getRoomQRByBookingId(validation.bookingId))?.guestName : undefined,
      },
    });
  } catch (error: any) {
    console.error('[MerchantQR] Checkin error:', error);
    res.status(500).json({
      success: false,
      message: 'Check-in failed',
    });
  }
});

// ─── Get Booking Details via Token ─────────────────────────────────────────────

/**
 * Get booking details from QR token
 * GET /api/merchant/booking/:token
 */
router.get('/booking/:token', authenticateService, rateLimiters.qrValidate, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const validation = await validateRoomQRToken(token);

    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: validation.error || 'Invalid token',
      });
      return;
    }

    // Get full details from QR record
    const qrRecord = await getRoomQRByToken(token);

    if (!qrRecord) {
      res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
      return;
    }

    // Try to get full booking from PMS
    let bookingDetails = null;
    try {
      const response = await axios.get(
        `${HOTEL_PMS_URL}/v1/bookings/${validation.bookingId}`,
        {
          timeout: 5000,
          headers: {
            'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
          },
        }
      );

      if (response.data?.success) {
        bookingDetails = response.data.data;
      }
    } catch {
      // PMS lookup failed, use QR data
    }

    res.json({
      success: true,
      data: {
        bookingId: validation.bookingId,
        hotelId: validation.hotelId,
        roomId: validation.roomId,
        roomNumber: validation.roomNumber,
        guest: {
          name: qrRecord.guestName,
          email: qrRecord.guestEmail,
          phone: qrRecord.guestPhone,
        },
        dates: {
          checkIn: qrRecord.checkIn,
          checkOut: qrRecord.checkOut,
          expiresAt: qrRecord.expiresAt,
        },
        status: {
          isActive: qrRecord.isActive,
          useCount: qrRecord.useCount,
          lastUsed: qrRecord.lastUsedAt,
        },
        pmsDetails: bookingDetails,
      },
    });
  } catch (error: any) {
    console.error('[MerchantQR] Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get booking details',
    });
  }
});

// ─── Verify Room Access ─────────────────────────────────────────────────────────

/**
 * Verify if guest can access a specific room
 * POST /api/merchant/verify-access
 */
router.post('/verify-access', authenticateService, rateLimiters.qrValidate, async (req: Request, res: Response) => {
  try {
    const { token, roomId } = req.body;

    if (!token || !roomId) {
      res.status(400).json({
        success: false,
        message: 'Token and roomId are required',
      });
      return;
    }

    const validation = await validateRoomQRToken(token);

    if (!validation.valid) {
      res.json({
        success: true,
        data: {
          allowed: false,
          reason: validation.error,
        },
      });
      return;
    }

    // Check if token is for the requested room
    if (validation.roomId !== roomId) {
      res.json({
        success: true,
        data: {
          allowed: false,
          reason: 'Token not valid for this room',
        },
      });
      return;
    }

    // Check time permissions
    const qrRecord = await getRoomQRByToken(token);
    if (!qrRecord) {
      res.json({
        success: true,
        data: {
          allowed: false,
          reason: 'QR record not found',
        },
      });
      return;
    }

    const now = new Date();
    const isWithinStay = now >= qrRecord.checkIn && now <= qrRecord.checkOut;

    res.json({
      success: true,
      data: {
        allowed: isWithinStay && qrRecord.isActive,
        reason: isWithinStay && qrRecord.isActive
          ? 'Access granted'
          : !qrRecord.isActive
          ? 'QR code is no longer active'
          : now < qrRecord.checkIn
          ? 'Check-in time not reached'
          : 'Stay period has ended',
        expiresAt: qrRecord.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[MerchantQR] Verify access error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
    });
  }
});

export default router;
