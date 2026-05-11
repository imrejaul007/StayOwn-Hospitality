/**
 * Digital Check-in Routes for StayOwn
 *
 * Endpoints:
 * - POST /api/digital-checkin/start - Start check-in process
 * - GET /api/digital-checkin/:bookingId - Get check-in status
 * - PUT /api/digital-checkin/:bookingId - Update check-in data
 * - POST /api/digital-checkin/:bookingId/verify-id - Verify guest ID
 * - POST /api/digital-checkin/:bookingId/complete - Complete check-in and get key
 * - GET /api/digital-checkin/:bookingId/key - Get digital key
 * - POST /api/digital-checkin/:bookingId/key/send - Send key to guest
 * - POST /api/digital-checkin/:bookingId/checkout - Express checkout
 * - POST /api/digital-checkin/qr/validate - Validate QR code scan
 * - GET /api/digital-checkin/stats/:hotelId - Get check-in statistics
 * - GET /api/digital-checkin/user/:userId - Get check-ins by user
 */

import { Router, Request, Response } from 'express';
import {
  startCheckin,
  getCheckin,
  getCheckinByUser,
  updateCheckin,
  verifyId,
  completeCheckin,
  getDigitalKey,
  sendKeyToGuest,
  expressCheckout,
  validateQRCodeScan,
  getCheckinStats,
  revokeKey,
  type CheckinData,
  type DigitalKey,
} from '../services/digital-checkin.service';
import { logger } from '../config/logger';

const router = Router();

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UpdateCheckinBody {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestAddress?: string;
  preferences?: CheckinData['preferences'];
  emergencyContact?: CheckinData['emergencyContact'];
  incidentalPaymentMethod?: CheckinData['incidentalPaymentMethod'];
  signature?: string;
  termsAccepted?: boolean;
}

interface VerifyIdBody {
  idType: CheckinData['idType'];
  idNumber: string;
  idImage?: string;
}

interface RevokeKeyBody {
  keyId: string;
  reason: string;
}

// ─── Routes ─────────────────────────────────────────────────────────────────────

/**
 * Start check-in process
 * POST /api/digital-checkin/start
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { bookingId, userId } = req.body;

    if (!bookingId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and userId are required',
      });
    }

    const checkin = await startCheckin(bookingId, userId);

    logger.info('Check-in started via API', { bookingId, userId });

    res.status(201).json({
      success: true,
      data: {
        checkin,
        message: 'Check-in process started. Please complete all steps.',
      },
    });
  } catch (error: any) {
    logger.error('Failed to start check-in', { error: error.message, bookingId: req.body.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to start check-in process',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get check-in status
 * GET /api/digital-checkin/:bookingId
 */
router.get('/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const checkin = await getCheckin(bookingId);

    if (!checkin) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found for this booking',
      });
    }

    // Get digital key if check-in is completed
    let digitalKey: DigitalKey | null = null;
    if (checkin.status === 'completed') {
      digitalKey = await getDigitalKey(bookingId);
    }

    res.json({
      success: true,
      data: {
        checkin,
        digitalKey,
        progress: {
          currentStep: checkin.step,
          totalSteps: 5,
          isComplete: checkin.status === 'completed',
          steps: {
            1: { done: true, label: 'Started' },
            2: { done: checkin.idVerified, label: 'ID Verification' },
            3: { done: !!checkin.emergencyContact?.name, label: 'Emergency Contact' },
            4: { done: checkin.termsAccepted, label: 'Review & Accept' },
            5: { done: checkin.status === 'completed', label: 'Complete' },
          },
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get check-in', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to get check-in status',
    });
  }
});

/**
 * Update check-in data
 * PUT /api/digital-checkin/:bookingId
 */
router.put('/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const updates = req.body as UpdateCheckinBody;

    const checkin = await getCheckin(bookingId);

    if (!checkin) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found',
      });
    }

    if (checkin.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Check-in already completed. Cannot update.',
      });
    }

    const updated = await updateCheckin(bookingId, updates);

    res.json({
      success: true,
      data: {
        checkin: updated,
        message: `Updated successfully. Now on step ${updated.step}.`,
      },
    });
  } catch (error: any) {
    logger.error('Failed to update check-in', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to update check-in',
    });
  }
});

/**
 * Verify guest ID
 * POST /api/digital-checkin/:bookingId/verify-id
 */
router.post('/:bookingId/verify-id', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { idType, idNumber, idImage } = req.body as VerifyIdBody;

    if (!idType || !idNumber) {
      return res.status(400).json({
        success: false,
        message: 'idType and idNumber are required',
      });
    }

    const validIdTypes = ['passport', 'aadhar', 'driving_license', 'voter_id'];
    if (!validIdTypes.includes(idType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid idType. Must be one of: ${validIdTypes.join(', ')}`,
      });
    }

    const updated = await verifyId(bookingId, idType, idNumber, idImage);

    res.json({
      success: true,
      data: {
        checkin: updated,
        message: updated.idVerified
          ? 'ID verified successfully'
          : 'ID verification pending. Please try again.',
      },
    });
  } catch (error: any) {
    logger.error('Failed to verify ID', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to verify ID',
    });
  }
});

/**
 * Complete check-in and generate digital key
 * POST /api/digital-checkin/:bookingId/complete
 */
router.post('/:bookingId/complete', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const checkin = await getCheckin(bookingId);

    if (!checkin) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found',
      });
    }

    if (checkin.status === 'completed') {
      // Return existing key
      const existingKey = await getDigitalKey(bookingId);
      return res.json({
        success: true,
        data: {
          checkin,
          key: existingKey,
          message: 'Check-in already completed',
        },
      });
    }

    if (checkin.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete check-in. Status: ${checkin.status}. Step: ${checkin.step}/5`,
        data: {
          currentStep: checkin.step,
          missingSteps: getMissingSteps(checkin),
        },
      });
    }

    const key = await completeCheckin(bookingId);

    logger.info('Check-in completed via API', { bookingId, keyId: key.keyId });

    res.json({
      success: true,
      data: {
        checkin: await getCheckin(bookingId),
        key,
        message: `Check-in complete! Your digital key for Room ${key.roomNumber} is ready.`,
      },
    });
  } catch (error: any) {
    logger.error('Failed to complete check-in', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete check-in',
    });
  }
});

/**
 * Get digital key for a booking
 * GET /api/digital-checkin/:bookingId/key
 */
router.get('/:bookingId/key', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const checkin = await getCheckin(bookingId);

    if (!checkin) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found',
      });
    }

    if (checkin.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Check-in not completed. Cannot get key.',
      });
    }

    const key = await getDigitalKey(bookingId);

    if (!key) {
      return res.status(404).json({
        success: false,
        message: 'Digital key not found',
      });
    }

    res.json({
      success: true,
      data: {
        key,
        expiresAt: key.validUntil,
        isExpired: new Date() > key.validUntil,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get digital key', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to get digital key',
    });
  }
});

/**
 * Send digital key to guest
 * POST /api/digital-checkin/:bookingId/key/send
 */
router.post('/:bookingId/key/send', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const sent = await sendKeyToGuest(bookingId);

    if (sent) {
      res.json({
        success: true,
        message: 'Digital key sent to guest',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send digital key',
      });
    }
  } catch (error: any) {
    logger.error('Failed to send digital key', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to send digital key',
    });
  }
});

/**
 * Revoke digital key (admin/hotel staff)
 * POST /api/digital-checkin/key/revoke
 */
router.post('/key/revoke', async (req: Request, res: Response) => {
  try {
    const { keyId, reason } = req.body as RevokeKeyBody;

    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: 'keyId is required',
      });
    }

    const key = await revokeKey(keyId, reason || 'revoked_by_staff');

    res.json({
      success: true,
      data: { key },
      message: 'Digital key revoked successfully',
    });
  } catch (error: any) {
    logger.error('Failed to revoke key', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to revoke key',
    });
  }
});

/**
 * Express checkout
 * POST /api/digital-checkin/:bookingId/checkout
 */
router.post('/:bookingId/checkout', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const result = await expressCheckout(bookingId);

    if (result.success) {
      logger.info('Express checkout via API', { bookingId });
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error: any) {
    logger.error('Failed express checkout', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to process express checkout',
    });
  }
});

/**
 * Validate QR code scan (for staff scanning guest's phone)
 * POST /api/digital-checkin/qr/validate
 */
router.post('/qr/validate', async (req: Request, res: Response) => {
  try {
    const { qrPayload } = req.body;

    if (!qrPayload) {
      return res.status(400).json({
        success: false,
        message: 'qrPayload is required',
      });
    }

    const result = await validateQRCodeScan(qrPayload);

    if (result.valid && result.key) {
      res.json({
        success: true,
        data: {
          valid: true,
          bookingId: result.key.bookingId,
          roomNumber: result.key.roomNumber,
          validUntil: result.key.validUntil,
        },
        message: 'Valid room key',
      });
    } else {
      res.status(400).json({
        success: false,
        data: { valid: false },
        message: result.error || 'Invalid QR code',
      });
    }
  } catch (error: any) {
    logger.error('Failed to validate QR', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
    });
  }
});

/**
 * Get check-in statistics for a hotel
 * GET /api/digital-checkin/stats/:hotelId
 */
router.get('/stats/:hotelId', async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;
    const { period = 'today' } = req.query;

    const validPeriods = ['today', 'week', 'month'];
    const periodValue = validPeriods.includes(period as string) ? period as 'today' | 'week' | 'month' : 'today';

    const stats = await getCheckinStats(hotelId, periodValue);

    res.json({
      success: true,
      data: {
        hotelId,
        period: periodValue,
        stats,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get check-in stats', { error: error.message, hotelId: req.params.hotelId });
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
    });
  }
});

/**
 * Get all check-ins for a user
 * GET /api/digital-checkin/user/:userId
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const checkins = await getCheckinByUser(userId);

    res.json({
      success: true,
      data: {
        userId,
        totalCheckins: checkins.length,
        checkins: checkins.map(c => ({
          bookingId: c.bookingId,
          hotelId: c.hotelId,
          status: c.status,
          step: c.step,
          guestName: c.guestName,
          createdAt: c.createdAt,
          completedAt: c.completedAt,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get user check-ins', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to get check-ins',
    });
  }
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getMissingSteps(checkin: CheckinData): string[] {
  const missing: string[] = [];

  if (!checkin.idVerified) {
    missing.push('Verify ID (Step 2)');
  }
  if (!checkin.emergencyContact?.name) {
    missing.push('Add emergency contact (Step 3)');
  }
  if (!checkin.termsAccepted) {
    missing.push('Accept terms and conditions (Step 4)');
  }

  return missing;
}

export default router;
