/**
 * Pre-Arrival Routes for StayOwn
 *
 * Endpoints:
 * - GET /api/pre-arrival/:bookingId - Get preferences
 * - PUT /api/pre-arrival/:bookingId - Save preferences
 * - POST /api/pre-arrival/:bookingId/sync - Sync to Room QR
 * - GET /api/pre-arrival/guest/:guestId - Get all guest preferences
 */

import { Router, Request, Response } from 'express';
import {
  getPreArrivalPreferences,
  getPreArrivalByGuest,
  savePreArrivalPreferences,
  deletePreArrivalPreferences,
  syncPreferencesToRoomQR,
  type PreArrivalPreferences,
} from '../pre-arrival';
import { logger } from '../config/logger';

const router = Router();

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PreArrivalInput {
  temperature?: number;
  lighting?: 'bright' | 'dim' | 'dark';
  pillowType?: 'soft' | 'firm' | 'extra';
  dietaryRestrictions?: string[];
  allergies?: string[];
  specialOccasion?: string;
  earlyCheckin?: string;
  lateCheckout?: string;
  roomPreferences?: {
    highFloor?: boolean;
    quietRoom?: boolean;
    smokingRoom?: boolean;
    bedSize?: 'single' | 'double' | 'queen' | 'king';
    viewPreference?: 'city' | 'garden' | 'pool' | 'no_preference';
  };
  transportRequests?: {
    airportPickup?: boolean;
    pickupTime?: string;
    flightNumber?: string;
    passengers?: number;
  };
  notes?: string;
}

// ─── Routes ─────────────────────────────────────────────────────────────────────

/**
 * Get pre-arrival preferences for a booking
 * GET /api/pre-arrival/:bookingId
 */
router.get('/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const preferences = await getPreArrivalPreferences(bookingId);

    if (!preferences) {
      // Return default preferences if none set
      return res.json({
        success: true,
        data: {
          bookingId,
          preferences: {
            temperature: 22,
            lighting: 'dim',
            pillowType: 'soft',
            dietaryRestrictions: [],
            allergies: [],
            roomPreferences: {
              highFloor: false,
              quietRoom: false,
              smokingRoom: false,
              bedSize: 'queen',
              viewPreference: 'no_preference',
            },
            transportRequests: {
              airportPickup: false,
            },
            notes: '',
          },
          isDefault: true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        bookingId,
        preferences,
        isDefault: false,
        syncedToRoomQR: preferences.syncedToRoomQR,
        updatedAt: preferences.updatedAt,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to get preferences',
    });
  }
});

/**
 * Save pre-arrival preferences
 * PUT /api/pre-arrival/:bookingId
 */
router.put('/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { guestId, ...preferences } = req.body as PreArrivalInput & { guestId: string };

    if (!guestId) {
      return res.status(400).json({
        success: false,
        message: 'guestId is required',
      });
    }

    // Validate inputs
    if (preferences.temperature !== undefined) {
      if (preferences.temperature < 16 || preferences.temperature > 30) {
        return res.status(400).json({
          success: false,
          message: 'Temperature must be between 16 and 30',
        });
      }
    }

    const validLighting = ['bright', 'dim', 'dark'];
    if (preferences.lighting && !validLighting.includes(preferences.lighting)) {
      return res.status(400).json({
        success: false,
        message: 'Lighting must be bright, dim, or dark',
      });
    }

    const validPillows = ['soft', 'firm', 'extra'];
    if (preferences.pillowType && !validPillows.includes(preferences.pillowType)) {
      return res.status(400).json({
        success: false,
        message: 'Pillow type must be soft, firm, or extra',
      });
    }

    // Save preferences
    const saved = await savePreArrivalPreferences({
      guestId,
      bookingId,
      ...preferences,
    });

    logger.info('Pre-arrival preferences saved', { bookingId, guestId });

    res.json({
      success: true,
      data: {
        bookingId,
        preferences: saved,
        message: 'Preferences saved successfully',
      },
    });
  } catch (error: any) {
    logger.error('Failed to save pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to save preferences',
    });
  }
});

/**
 * Sync preferences to Room QR
 * POST /api/pre-arrival/:bookingId/sync
 */
router.post('/:bookingId/sync', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const success = await syncPreferencesToRoomQR(bookingId);

    if (success) {
      res.json({
        success: true,
        message: 'Preferences synced to Room QR',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to sync preferences. Room QR may not be available.',
      });
    }
  } catch (error: any) {
    logger.error('Failed to sync pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Sync failed',
    });
  }
});

/**
 * Get all pre-arrival preferences for a guest
 * GET /api/pre-arrival/guest/:guestId
 */
router.get('/guest/:guestId', async (req: Request, res: Response) => {
  try {
    const { guestId } = req.params;

    const preferences = await getPreArrivalByGuest(guestId);

    res.json({
      success: true,
      data: {
        guestId,
        bookings: preferences.map(p => ({
          bookingId: p.bookingId,
          preferences: p,
          syncedToRoomQR: p.syncedToRoomQR,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get guest pre-arrival preferences', { error: error.message, guestId: req.params.guestId });
    res.status(500).json({
      success: false,
      message: 'Failed to get preferences',
    });
  }
});

/**
 * Delete pre-arrival preferences
 * DELETE /api/pre-arrival/:bookingId
 */
router.delete('/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const deleted = await deletePreArrivalPreferences(bookingId);

    if (deleted) {
      res.json({
        success: true,
        message: 'Preferences deleted',
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Preferences not found',
      });
    }
  } catch (error: any) {
    logger.error('Failed to delete pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to delete preferences',
    });
  }
});

/**
 * Get pre-arrival analytics
 * GET /api/pre-arrival/analytics/:hotelId
 */
router.get('/analytics/:hotelId', async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;
    const { period = 'week' } = req.query;

    const { getPreArrivalAnalytics } = await import('../pre-arrival');
    const analytics = await getPreArrivalAnalytics(
      hotelId,
      period as 'week' | 'month'
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error('Failed to get pre-arrival analytics', { error: error.message, hotelId: req.params.hotelId });
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
    });
  }
});

export default router;
