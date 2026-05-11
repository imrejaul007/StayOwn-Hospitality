"use strict";
/**
 * Pre-Arrival Routes for StayOwn
 *
 * Endpoints:
 * - GET /api/pre-arrival/:bookingId - Get preferences
 * - PUT /api/pre-arrival/:bookingId - Save preferences
 * - POST /api/pre-arrival/:bookingId/sync - Sync to Room QR
 * - GET /api/pre-arrival/guest/:guestId - Get all guest preferences
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pre_arrival_1 = require("../pre-arrival");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
// ─── Routes ─────────────────────────────────────────────────────────────────────
/**
 * Get pre-arrival preferences for a booking
 * GET /api/pre-arrival/:bookingId
 */
router.get('/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const preferences = await (0, pre_arrival_1.getPreArrivalPreferences)(bookingId);
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
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
router.put('/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { guestId, ...preferences } = req.body;
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
        const saved = await (0, pre_arrival_1.savePreArrivalPreferences)({
            guestId,
            bookingId,
            ...preferences,
        });
        logger_1.logger.info('Pre-arrival preferences saved', { bookingId, guestId });
        res.json({
            success: true,
            data: {
                bookingId,
                preferences: saved,
                message: 'Preferences saved successfully',
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to save pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
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
router.post('/:bookingId/sync', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const success = await (0, pre_arrival_1.syncPreferencesToRoomQR)(bookingId);
        if (success) {
            res.json({
                success: true,
                message: 'Preferences synced to Room QR',
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: 'Failed to sync preferences. Room QR may not be available.',
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to sync pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
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
router.get('/guest/:guestId', async (req, res) => {
    try {
        const { guestId } = req.params;
        const preferences = await (0, pre_arrival_1.getPreArrivalByGuest)(guestId);
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get guest pre-arrival preferences', { error: error.message, guestId: req.params.guestId });
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
router.delete('/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const deleted = await (0, pre_arrival_1.deletePreArrivalPreferences)(bookingId);
        if (deleted) {
            res.json({
                success: true,
                message: 'Preferences deleted',
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'Preferences not found',
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to delete pre-arrival preferences', { error: error.message, bookingId: req.params.bookingId });
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
router.get('/analytics/:hotelId', async (req, res) => {
    try {
        const { hotelId } = req.params;
        const { period = 'week' } = req.query;
        const { getPreArrivalAnalytics } = await Promise.resolve().then(() => __importStar(require('../pre-arrival')));
        const analytics = await getPreArrivalAnalytics(hotelId, period);
        res.json({
            success: true,
            data: analytics,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get pre-arrival analytics', { error: error.message, hotelId: req.params.hotelId });
        res.status(500).json({
            success: false,
            message: 'Failed to get analytics',
        });
    }
});
exports.default = router;
//# sourceMappingURL=pre-arrival.routes.js.map