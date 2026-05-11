import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { BookingComConnector } from '../services/bookingComConnector.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Note: OTA routes apply middleware per-route as some need different access levels

// Quick setup endpoint for testing - enable Booking.com integration
router.post('/setup/:hotelId',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'adminAccess'),
  ensurePropertyAccess,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    
    try {
      if (!process.env.OTA_CLIENT_ID || !process.env.OTA_CLIENT_SECRET) {
        throw new ApplicationError(
          'OTA client credentials are not configured. Set OTA_CLIENT_ID and OTA_CLIENT_SECRET before enabling OTA setup.',
          503
        );
      }

      const Hotel = (await import('../models/Hotel.js')).default;

      // Atomic update: set OTA connections
      const hotel = await Hotel.findByIdAndUpdate(
        hotelId,
        {
          $set: {
            otaConnections: {
              bookingCom: {
                isEnabled: true,
                credentials: {
                  clientId: process.env.OTA_CLIENT_ID,
                  clientSecret: process.env.OTA_CLIENT_SECRET,
                  hotelId: 'booking_com_hotel_123'
                },
                lastSync: null
              }
            }
          }
        },
        { new: true }
      );

      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      res.json({
        status: 'success',
        data: {
          message: 'Booking.com integration enabled for demo',
          hotelId: hotelId
        }
      });
    } catch (error) {
      throw new ApplicationError(`Setup failed: ${error.message}`, 500);
    }
  })
);

// Manual sync trigger for Booking.com
router.post('/bookingcom/sync',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'adminAccess'),
  ensurePropertyAccess,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { hotelId } = req.body;
    
    if (!hotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }

    try {
      const connector = new BookingComConnector();
      const result = await connector.syncAvailability(hotelId);

      res.json({
        status: 'success',
        data: {
          message: 'Sync initiated successfully',
          syncId: result.syncId,
          estimatedCompletion: result.estimatedCompletion
        }
      });
    } catch (error) {
      throw new ApplicationError(`Sync failed: ${error.message}`, 500);
    }
  })
);

// Get Booking.com sync status
router.get('/bookingcom/status/:hotelId',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'staffAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;

    try {
      const connector = new BookingComConnector();
      const status = await connector.getSyncStatus(hotelId);

      res.json({
        status: 'success',
        data: status
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get sync status: ${error.message}`, 500);
    }
  })
);

// Get OTA sync history
router.get('/sync-history',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'staffAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { hotelId, page = 1, limit = 10, provider, status } = req.query;

    try {
      const SyncHistory = (await import('../models/SyncHistory.js')).default;
      
      // Build query filters with mandatory tenant isolation
      const resolvedHotelId = hotelId || req.body.hotelId || req.user?.hotelId;
      if (!resolvedHotelId) {
        throw new ApplicationError('Hotel context required', 400);
      }
      const filters = {};
      filters.hotelId = resolvedHotelId;
      if (provider) filters.provider = provider;
      if (status) filters.status = status;

      // Execute paginated query
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [history, total] = await Promise.all([
        SyncHistory.find(filters)
          .sort({ startedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('hotelId', 'name')
          .lean(),
        SyncHistory.countDocuments(filters)
      ]);

      // Transform data for frontend
      const transformedHistory = history.map(record => ({
        id: record._id,
        hotelId: record.hotelId._id,
        hotelName: record.hotelId.name,
        provider: record.provider,
        type: record.type,
        status: record.status,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        roomsUpdated: record.roomsUpdated,
        bookingsReceived: record.bookingsReceived,
        errors: record.errors?.map(err => err.message) || [],
        duration: record.metadata?.duration,
        syncId: record.syncId
      }));

      const pages = Math.ceil(total / parseInt(limit));

      res.json({
        status: 'success',
        data: {
          history: transformedHistory,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            pages: pages
          }
        }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get sync history: ${error.message}`, 500);
    }
  })
);

// Get OTA configuration for a hotel
router.get('/config/:hotelId',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'adminAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    
    try {
      // Try to get actual hotel configuration
      const Hotel = (await import('../models/Hotel.js')).default;

      // Initialize OTA connections if they don't exist, atomically
      const hotel = await Hotel.findOneAndUpdate(
        { _id: hotelId, otaConnections: { $exists: false } },
        {
          $set: {
            otaConnections: {
              bookingCom: {
                isEnabled: false,
                credentials: {},
                lastSync: null
              }
            }
          }
        },
        { new: true }
      ) || await Hotel.findById(hotelId).lean();

      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }
      
      const config = {
        bookingCom: {
          enabled: hotel.otaConnections.bookingCom?.isEnabled || false,
          hotelId: hotel.otaConnections.bookingCom?.credentials?.hotelId || '',
          lastSync: hotel.otaConnections.bookingCom?.lastSync || null,
          syncFrequency: '1h', // This could be stored in hotel config
          autoSync: true, // This could be stored in hotel config
          webhookEnabled: true, // This could be stored in hotel config
          webhookUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/api/v1/webhooks/booking-com`
        },
        expedia: {
          enabled: false,
          hotelId: '',
          lastSync: null,
          syncFrequency: '1h',
          autoSync: false,
          webhookEnabled: false,
          webhookUrl: ''
        },
        airbnb: {
          enabled: false,
          hotelId: '',
          lastSync: null,
          syncFrequency: '1h',
          autoSync: false,
          webhookEnabled: false,
          webhookUrl: ''
        }
      };

      res.json({
        status: 'success',
        data: { config }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get OTA configuration: ${error.message}`, 500);
    }
  })
);

// Update OTA configuration
router.patch('/config/:hotelId',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'adminAccess'),
  ensurePropertyAccess,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const { provider, config } = req.body;

    if (!provider || !config) {
      throw new ApplicationError('Provider and configuration are required', 400);
    }

    try {
      const Hotel = (await import('../models/Hotel.js')).default;

      // Build atomic update for the specific provider
      const updateFields = {};

      if (provider === 'bookingCom') {
        updateFields[`otaConnections.bookingCom.isEnabled`] = config.enabled || false;
        updateFields[`otaConnections.bookingCom.credentials`] = {
          clientId: config.clientId || '',
          clientSecret: config.clientSecret || '',
          hotelId: config.hotelId || ''
        };
      }
      // Add other providers as needed

      const hotel = await Hotel.findByIdAndUpdate(
        hotelId,
        { $set: updateFields },
        { new: true }
      );

      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      res.json({
        status: 'success',
        data: {
          message: `${provider} configuration updated successfully`,
          config: hotel.otaConnections[provider]
        }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to update OTA configuration: ${error.message}`, 500);
    }
  })
);

// Get OTA statistics
router.get('/stats/:hotelId',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'staffAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    
    try {
      const SyncHistory = (await import('../models/SyncHistory.js')).default;
      const Hotel = (await import('../models/Hotel.js')).default;

      // Get hotel and check active providers
      const hotel = await Hotel.findById(hotelId).lean();
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      const activeProviders = [];
      const totalProviders = 3; // booking.com, expedia, airbnb
      
      if (hotel.otaConnections?.bookingCom?.isEnabled) activeProviders.push('booking_com');
      if (hotel.otaConnections?.expedia?.isEnabled) activeProviders.push('expedia');
      if (hotel.otaConnections?.airbnb?.isEnabled) activeProviders.push('airbnb');

      // Calculate real statistics from sync history
      const [
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        lastSync,
        avgDuration,
        todayBookings,
        weekBookings,
        monthBookings,
        totalRoomsUpdated
      ] = await Promise.all([
        SyncHistory.countDocuments({ hotelId: hotel._id }),
        SyncHistory.countDocuments({ hotelId: hotel._id, status: 'completed' }),
        SyncHistory.countDocuments({ hotelId: hotel._id, status: 'failed' }),
        SyncHistory.findOne({ hotelId: hotel._id }).sort({ startedAt: -1 }).select('startedAt'),
        SyncHistory.aggregate([
          { $match: { hotelId: hotel._id, status: 'completed', 'metadata.duration': { $exists: true } } },
          { $group: { _id: null, avgDuration: { $avg: '$metadata.duration' } } }
        ]),
        SyncHistory.aggregate([
          { 
            $match: { 
              hotelId: hotel._id, 
              startedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            } 
          },
          { $group: { _id: null, total: { $sum: '$bookingsReceived' } } }
        ]),
        SyncHistory.aggregate([
          { 
            $match: { 
              hotelId: hotel._id, 
              startedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            } 
          },
          { $group: { _id: null, total: { $sum: '$bookingsReceived' } } }
        ]),
        SyncHistory.aggregate([
          { 
            $match: { 
              hotelId: hotel._id, 
              startedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            } 
          },
          { $group: { _id: null, total: { $sum: '$bookingsReceived' } } }
        ]),
        SyncHistory.aggregate([
          { $match: { hotelId: hotel._id, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$roomsUpdated' } } }
        ])
      ]);

      const stats = {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        lastSync: lastSync?.startedAt || null,
        averageSyncTime: Math.round((avgDuration[0]?.avgDuration || 0) / 1000), // Convert to seconds
        providersActive: activeProviders.length,
        totalProviders,
        roomsSynced: totalRoomsUpdated[0]?.total || 0,
        bookingsReceived: {
          today: todayBookings[0]?.total || 0,
          thisWeek: weekBookings[0]?.total || 0,
          thisMonth: monthBookings[0]?.total || 0
        },
        syncFrequency: {
          bookingCom: hotel.otaConnections?.bookingCom?.isEnabled ? '1h' : 'disabled',
          expedia: hotel.otaConnections?.expedia?.isEnabled ? '1h' : 'disabled',
          airbnb: hotel.otaConnections?.airbnb?.isEnabled ? '1h' : 'disabled'
        }
      };

      res.json({
        status: 'success',
        data: { stats }
      });
    } catch (error) {
      throw new ApplicationError(`Failed to get OTA statistics: ${error.message}`, 500);
    }
  })
);

// ── REZ OTA connection management ────────────────────────────────────────────

/**
 * PUT /ota/rez/setup/:hotelId
 * Link a PMS hotel to its Hotel OTA counterpart.
 * Body: { ota_hotel_id: string, enabled: boolean }
 */
router.put('/rez/setup/:hotelId',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'adminAccess'),
  ensurePropertyAccess,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { hotelId } = req.params;
    const { ota_hotel_id, enabled = true } = req.body;

    if (!ota_hotel_id) throw new ApplicationError('ota_hotel_id is required', 400);

    const Hotel = (await import('../models/Hotel.js')).default;
    const hotel = await Hotel.findByIdAndUpdate(
      hotelId,
      {
        $set: {
          'otaConnections.rezOta.hotelId': ota_hotel_id,
          'otaConnections.rezOta.isEnabled': enabled,
          'otaConnections.rezOta.lastSync': null,
        }
      },
      { new: true }
    );
    if (!hotel) throw new ApplicationError('Hotel not found', 404);

    res.json({
      status: 'success',
      data: {
        hotel_id: hotelId,
        ota_hotel_id,
        enabled,
        message: enabled
          ? 'Hotel linked to REZ OTA — booking sync and brand coin award active'
          : 'REZ OTA connection saved but disabled',
      }
    });
  })
);

/**
 * GET /ota/rez/status/:hotelId
 * Check REZ OTA connection status for a hotel.
 */
router.get('/rez/status/:hotelId',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'adminAccess'),
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const Hotel = (await import('../models/Hotel.js')).default;
    const hotel = await Hotel.findById(req.params.hotelId).lean();
    if (!hotel) throw new ApplicationError('Hotel not found', 404);

    const rezOta = hotel.otaConnections?.rezOta || {};
    res.json({
      status: 'success',
      data: {
        connected: !!rezOta.hotelId && rezOta.isEnabled,
        ota_hotel_id: rezOta.hotelId || null,
        enabled: rezOta.isEnabled || false,
        last_sync: rezOta.lastSync || null,
      }
    });
  })
);

/**
 * GET /ota/rez/bookings
 * Proxy: fetches recent bookings from REZ Hotel OTA for the authenticated hotel.
 * Requires the hotel to have a REZ OTA connection configured (otaConnections.rezOta).
 */
router.get('/rez/bookings',
  authenticate, ensureTenantContext,
  authorizePolicy('ota', 'adminAccess'),
  catchAsync(async (req, res) => {
    const Hotel = (await import('../models/Hotel.js')).default;
    const hotelId = req.user?.hotelId || req.query.hotel_id;
    if (!hotelId) {
      return res.status(400).json({ status: 'error', message: 'hotel_id required' });
    }

    const hotel = await Hotel.findById(hotelId).lean();
    if (!hotel) return res.status(404).json({ status: 'error', message: 'Hotel not found' });

    const rezOta = hotel.otaConnections?.rezOta || {};
    if (!rezOta.hotelId || !rezOta.isEnabled) {
      return res.json({ status: 'success', data: { bookings: [], message: 'REZ OTA not connected' } });
    }

    const OTA_BASE = process.env.HOTEL_OTA_API_URL || 'https://hotel-ota-api.onrender.com';
    const OTA_TOKEN = process.env.REZ_OTA_INTERNAL_TOKEN || '';
    const { status, page = 1, per_page = 30 } = req.query;

    const params = new URLSearchParams({ hotel_id: rezOta.hotelId, page, per_page });
    if (status) params.set('status', status);

    const response = await fetch(
      `${OTA_BASE}/v1/hotel/bookings?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${OTA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      const err = await response.text().catch(() => `HTTP ${response.status}`);
      return res.status(502).json({ status: 'error', message: `OTA API error: ${err.slice(0, 200)}` });
    }

    const data = await response.json();
    res.json({ status: 'success', data });
  })
);

export default router;
