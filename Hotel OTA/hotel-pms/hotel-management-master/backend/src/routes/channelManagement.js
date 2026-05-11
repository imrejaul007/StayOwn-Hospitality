import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { Channel } from '../models/ChannelManager.js';
import RoomType from '../models/RoomType.js';
import RoomAvailability from '../models/RoomAvailability.js';
import BookingComService from '../services/channels/bookingComService.js';
// channelSyncMiddleware disabled: constructor instantiates BookingComService which requires external API config
// import { syncMiddleware } from '../middleware/channelSyncMiddleware.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply auth middleware to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('channelManagement', 'baseAccess'));

// Channel services mapping
const channelServices = {
  'booking.com': new BookingComService()
};

/**
 * @swagger
 * /api/channels:
 *   get:
 *     summary: Get all channels for hotel
 *     tags: [Channel Management]
 *     responses:
 *       200:
 *         description: List of channels
 */
router.get('/', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    
    const channels = await Channel.find({ hotelId })
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 50).lean();
    
    res.json({
      success: true,
      channels
    });
    
  } catch (error) {
    logger.error('Failed to fetch channels', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/initialize:
 *   post:
 *     summary: Initialize a new channel
 *     tags: [Channel Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channelType:
 *                 type: string
 *                 enum: [booking.com, expedia, airbnb]
 *               credentials:
 *                 type: object
 *               settings:
 *                 type: object
 */
router.post('/initialize', validate(mutationBaselineSchema), async (req, res) => {
  try {
    const { channelType, credentials, settings } = req.body;
    const hotelId = req.user.hotelId;
    
    if (!channelType || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'Channel type and credentials are required'
      });
    }
    
    const channelService = channelServices[channelType];
    if (!channelService) {
      return res.status(400).json({
        success: false,
        error: `Unsupported channel type: ${channelType}`
      });
    }
    
    const result = await channelService.initializeChannel({
      hotelId,
      credentials,
      settings
    });
    
    res.json(result);
    
  } catch (error) {
    logger.error('Channel initialization failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/{channelId}/test:
 *   post:
 *     summary: Test channel connection
 *     tags: [Channel Management]
 */
router.post('/:channelId/test', validate(mutationBaselineSchema), async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findOne({ channelId }).lean();
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    const channelService = channelServices[channel.category];
    if (!channelService) {
      return res.status(400).json({
        success: false,
        error: `Service not available for ${channel.category}`
      });
    }

    const result = await channelService.testConnection(channel);

    // Update connection status atomically
    const newStatus = result.success ? 'connected' : 'disconnected';
    await Channel.findOneAndUpdate(
      { channelId },
      { $set: { connectionStatus: newStatus } },
      { new: true }
    );

    res.json({
      ...result,
      channelId,
      status: newStatus
    });

  } catch (error) {
    logger.error('Channel test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/{channelId}/mappings:
 *   get:
 *     summary: Get room type mappings for channel
 *     tags: [Channel Management]
 */
router.get('/:channelId/mappings', async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const channel = await Channel.findOne({ channelId })
      .populate('roomMappings.hotelRoomTypeId').lean();
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      channelId,
      channelName: channel.name,
      mappings: channel.roomMappings
    });
    
  } catch (error) {
    logger.error('Failed to fetch mappings', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/{channelId}/mappings:
 *   post:
 *     summary: Create room type mappings
 *     tags: [Channel Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mappings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     hotelRoomTypeId:
 *                       type: string
 *                     channelRoomTypeId:
 *                       type: string
 *                     channelRoomTypeName:
 *                       type: string
 *                     ratePlans:
 *                       type: array
 */
router.post('/:channelId/mappings', validate(mutationBaselineSchema), async (req, res) => {
  try {
    const { channelId } = req.params;
    const { mappings } = req.body;
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({
        success: false,
        error: 'Mappings array is required'
      });
    }
    
    const channel = await Channel.findOne({ channelId }).lean();
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    const channelService = channelServices[channel.category];
    if (!channelService) {
      return res.status(400).json({
        success: false,
        error: `Service not available for ${channel.category}`
      });
    }
    
    const result = await channelService.createRoomMappings(channelId, mappings);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Failed to create mappings', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/{channelId}/sync:
 *   post:
 *     summary: Manual sync rates and availability
 *     tags: [Channel Management]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               roomTypeId:
 *                 type: string
 */
router.post('/:channelId/sync', validate(mutationBaselineSchema), async (req, res) => {
  try {
    const { channelId } = req.params;
    const { startDate, endDate, roomTypeId } = req.body;
    const hotelId = req.user.hotelId;
    
    // Default to next 7 days if no dates provided
    const syncStartDate = startDate ? new Date(startDate) : new Date();
    const syncEndDate = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const channel = await Channel.findOne({ channelId }).lean();
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    const channelService = channelServices[channel.category];
    if (!channelService) {
      return res.status(400).json({
        success: false,
        error: `Service not available for ${channel.category}`
      });
    }
    
    const result = await channelService.syncRatesAndAvailability(
      channelId,
      syncStartDate,
      syncEndDate
    );
    
    res.json(result);
    
  } catch (error) {
    logger.error('Manual sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Temporarily disabled - routes that depend on syncMiddleware
// router.get('/sync/status', ...)
// router.post('/sync/trigger', ...)

/**
 * @swagger
 * /api/channels/{channelId}/metrics:
 *   get:
 *     summary: Get channel performance metrics
 *     tags: [Channel Management]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 */
router.get('/:channelId/metrics', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days
    const metricsStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const metricsEndDate = endDate ? new Date(endDate) : new Date();
    
    const channel = await Channel.findOne({ channelId }).lean();
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    const channelService = channelServices[channel.category];
    if (!channelService) {
      return res.status(400).json({
        success: false,
        error: `Service not available for ${channel.category}`
      });
    }
    
    const metrics = await channelService.getChannelMetrics(
      channelId,
      metricsStartDate,
      metricsEndDate
    );
    
    res.json({
      success: true,
      ...metrics
    });
    
  } catch (error) {
    logger.error('Failed to get channel metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/{channelId}:
 *   put:
 *     summary: Update channel settings
 *     tags: [Channel Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *               credentials:
 *                 type: object
 *               isActive:
 *                 type: boolean
 */
router.put('/:channelId', validate(mutationBaselineSchema), async (req, res) => {
  try {
    const { channelId } = req.params;
    const { settings, credentials, isActive } = req.body;

    // Build atomic update
    const updateOps = {};

    if (settings) {
      // Merge settings by setting individual keys
      Object.keys(settings).forEach(key => {
        updateOps[`settings.${key}`] = settings[key];
      });
    }

    if (credentials) {
      // Merge credentials by setting individual keys
      Object.keys(credentials).forEach(key => {
        updateOps[`credentials.${key}`] = credentials[key];
      });
    }

    if (typeof isActive === 'boolean') {
      updateOps.isActive = isActive;
    }

    const channel = await Channel.findOneAndUpdate(
      { channelId },
      { $set: updateOps },
      { new: true, runValidators: true }
    );

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    res.json({
      success: true,
      message: 'Channel updated successfully',
      channel
    });

  } catch (error) {
    logger.error('Failed to update channel', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/{channelId}:
 *   delete:
 *     summary: Delete channel
 *     tags: [Channel Management]
 */
router.delete('/:channelId', validate(mutationBaselineSchema), async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const channel = await Channel.findOneAndDelete({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      message: `${channel.name} channel deleted successfully`
    });
    
  } catch (error) {
    logger.error('Failed to delete channel', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/channels/room-types:
 *   get:
 *     summary: Get available room types for mapping
 *     tags: [Channel Management]
 */
router.get('/room-types', async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    
    const roomTypes = await RoomType.find({
      hotelId,
      isActive: true
    }).select('_id name code maxOccupancy basePrice legacyType')
      .limit(parseInt(req.query.limit) || 50).lean();
    
    res.json({
      success: true,
      roomTypes
    });
    
  } catch (error) {
    logger.error('Failed to fetch room types', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
