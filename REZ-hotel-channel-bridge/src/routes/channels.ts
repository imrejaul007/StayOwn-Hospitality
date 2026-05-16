import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  ChannelConfigSchema,
  RoomMappingSchema,
  InventoryUpdateSchema,
  PricingUpdateSchema,
  BookingImportSchema,
  ChannelType,
  BookingStatus,
  IChannelConfig,
  IRoomMapping
} from '../types/index.js';
import { channelManager } from '../services/channelManager.js';
import { inventorySyncService } from '../services/inventorySync.js';
import { pricingSyncService } from '../services/pricingSync.js';
import { Booking } from '../models/index.js';
import { createModuleLogger } from '../utils/logger.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();
const logger = createModuleLogger('channels');

// Helper function for API responses
const sendResponse = (
  res: Response,
  data: any,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  });
};

const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: any
): void => {
  res.status(statusCode).json({
    success: false,
    error: { code, message, ...(details && { details }) },
    timestamp: new Date().toISOString()
  });
};

// Validation helper
const validate = <T>(schema: any, data: unknown): T => {
  return schema.parse(data);
};

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'rez-hotel-channel-bridge',
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * @route   POST /api/channels
 * @desc    Register a new channel
 * @access  Internal
 */
router.post(
  '/api/channels',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = validate(ChannelConfigSchema, req.body);
      const channel = await channelManager.registerChannel(validated);
      sendResponse(res, channel, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid channel configuration', 400, error.errors);
      } else {
        next(error);
      }
    }
  }
);

/**
 * @route   GET /api/channels
 * @desc    Get all channels or filter by hotel
 * @access  Internal
 */
router.get(
  '/api/channels',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, channelId, isActive } = req.query;

      if (hotelId) {
        const channels = await channelManager.getHotelChannels(hotelId as string);
        sendResponse(res, channels);
      } else if (channelId) {
        const channel = await channelManager.getChannel(channelId as string);
        if (!channel) {
          sendError(res, 'NOT_FOUND', 'Channel not found', 404);
          return;
        }
        sendResponse(res, channel);
      } else {
        sendError(res, 'BAD_REQUEST', 'hotelId or channelId query parameter required', 400);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/channels/:channelId
 * @desc    Get channel by ID
 * @access  Internal
 */
router.get(
  '/api/channels/:channelId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const channel = await channelManager.getChannel(req.params.channelId);
      if (!channel) {
        sendError(res, 'NOT_FOUND', 'Channel not found', 404);
        return;
      }
      sendResponse(res, channel);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/channels/:channelId
 * @desc    Update channel configuration
 * @access  Internal
 */
router.put(
  '/api/channels/:channelId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const channel = await channelManager.updateChannel(
        req.params.channelId,
        req.body
      );
      if (!channel) {
        sendError(res, 'NOT_FOUND', 'Channel not found', 404);
        return;
      }
      sendResponse(res, channel);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/channels/:channelId
 * @desc    Deactivate a channel
 * @access  Internal
 */
router.delete(
  '/api/channels/:channelId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const success = await channelManager.deactivateChannel(req.params.channelId);
      if (!success) {
        sendError(res, 'NOT_FOUND', 'Channel not found', 404);
        return;
      }
      sendResponse(res, { message: 'Channel deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/channels/:channelId/test
 * @desc    Test channel connection
 * @access  Internal
 */
router.post(
  '/api/channels/:channelId/test',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await channelManager.testConnection(req.params.channelId);
      sendResponse(res, result, result.success ? 200 : 503);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/channels/:channelId/stats
 * @desc    Get channel statistics
 * @access  Internal
 */
router.get(
  '/api/channels/:channelId/stats',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await channelManager.getChannelStats(req.params.channelId);
      sendResponse(res, stats);
    } catch (error) {
      next(error);
    }
  }
);

// Room Mappings Routes

/**
 * @route   POST /api/rooms/mappings
 * @desc    Create a room mapping
 * @access  Internal
 */
router.post(
  '/api/rooms/mappings',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = validate(RoomMappingSchema, req.body);
      const mapping = await channelManager.createRoomMapping(validated);
      sendResponse(res, mapping, 201);
    } catch (error: any) {
      if (error instanceof ZodError) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid mapping data', 400, error.errors);
      } else if (error.message.includes('already exists')) {
        sendError(res, 'CONFLICT', error.message, 409);
      } else {
        next(error);
      }
    }
  }
);

/**
 * @route   GET /api/rooms/mappings
 * @desc    Get room mappings
 * @access  Internal
 */
router.get(
  '/api/rooms/mappings',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, channelId } = req.query;

      if (!hotelId) {
        sendError(res, 'BAD_REQUEST', 'hotelId query parameter required', 400);
        return;
      }

      const mappings = await channelManager.getRoomMappings(
        hotelId as string,
        channelId as string | undefined
      );
      sendResponse(res, mappings);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/rooms/mappings/:mappingId
 * @desc    Update room mapping
 * @access  Internal
 */
router.put(
  '/api/rooms/mappings/:mappingId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const mapping = await channelManager.updateRoomMapping(
        req.params.mappingId,
        req.body
      );
      if (!mapping) {
        sendError(res, 'NOT_FOUND', 'Room mapping not found', 404);
        return;
      }
      sendResponse(res, mapping);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/rooms/mappings/:mappingId
 * @desc    Delete room mapping
 * @access  Internal
 */
router.delete(
  '/api/rooms/mappings/:mappingId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const success = await channelManager.deleteRoomMapping(req.params.mappingId);
      if (!success) {
        sendError(res, 'NOT_FOUND', 'Room mapping not found', 404);
        return;
      }
      sendResponse(res, { message: 'Room mapping deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Inventory Routes

/**
 * @route   POST /api/inventory
 * @desc    Update inventory
 * @access  Internal
 */
router.post(
  '/api/inventory',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = validate(InventoryUpdateSchema, req.body);
      await inventorySyncService.updateInventory(validated);
      sendResponse(res, { message: 'Inventory updated successfully' }, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid inventory data', 400, error.errors);
      } else {
        next(error);
      }
    }
  }
);

/**
 * @route   POST /api/inventory/bulk
 * @desc    Bulk update inventory
 * @access  Internal
 */
router.post(
  '/api/inventory/bulk',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const updates = validate(InventoryUpdateSchema.array(), req.body.updates);
      const result = await inventorySyncService.bulkUpdateInventory(updates);
      sendResponse(res, result);
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid inventory data', 400, error.errors);
      } else {
        next(error);
      }
    }
  }
);

/**
 * @route   GET /api/inventory
 * @desc    Get inventory for date range
 * @access  Internal
 */
router.get(
  '/api/inventory',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, startDate, endDate, roomMappingId } = req.query;

      if (!hotelId || !startDate || !endDate) {
        sendError(
          res,
          'BAD_REQUEST',
          'hotelId, startDate, and endDate query parameters required',
          400
        );
        return;
      }

      const inventory = await inventorySyncService.getInventory(
        hotelId as string,
        startDate as string,
        endDate as string,
        roomMappingId as string | undefined
      );
      sendResponse(res, inventory);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/inventory/sync/:channelId
 * @desc    Sync inventory to channel
 * @access  Internal
 */
router.post(
  '/api/inventory/sync/:channelId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, startDate, endDate } = req.body;

      if (!hotelId || !startDate || !endDate) {
        sendError(res, 'BAD_REQUEST', 'hotelId, startDate, and endDate required', 400);
        return;
      }

      const result = await inventorySyncService.syncToChannel(
        hotelId,
        req.params.channelId,
        startDate,
        endDate
      );
      sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/inventory/sync/status
 * @desc    Get inventory sync status
 * @access  Internal
 */
router.get(
  '/api/inventory/sync/status',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId } = req.query;

      if (!hotelId) {
        sendError(res, 'BAD_REQUEST', 'hotelId query parameter required', 400);
        return;
      }

      const status = await inventorySyncService.getSyncStatus(hotelId as string);
      sendResponse(res, status);
    } catch (error) {
      next(error);
    }
  }
);

// Pricing Routes

/**
 * @route   POST /api/pricing
 * @desc    Update pricing
 * @access  Internal
 */
router.post(
  '/api/pricing',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = validate(PricingUpdateSchema, req.body);
      await pricingSyncService.updatePricing(validated);
      sendResponse(res, { message: 'Pricing updated successfully' }, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid pricing data', 400, error.errors);
      } else {
        next(error);
      }
    }
  }
);

/**
 * @route   POST /api/pricing/bulk
 * @desc    Bulk update pricing
 * @access  Internal
 */
router.post(
  '/api/pricing/bulk',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const updates = validate(PricingUpdateSchema.array(), req.body.updates);
      const result = await pricingSyncService.bulkUpdatePricing(updates);
      sendResponse(res, result);
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid pricing data', 400, error.errors);
      } else {
        next(error);
      }
    }
  }
);

/**
 * @route   GET /api/pricing
 * @desc    Get pricing for date range
 * @access  Internal
 */
router.get(
  '/api/pricing',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, startDate, endDate, roomMappingId } = req.query;

      if (!hotelId || !startDate || !endDate) {
        sendError(
          res,
          'BAD_REQUEST',
          'hotelId, startDate, and endDate query parameters required',
          400
        );
        return;
      }

      const pricing = await pricingSyncService.getPricing(
        hotelId as string,
        startDate as string,
        endDate as string,
        roomMappingId as string | undefined
      );
      sendResponse(res, pricing);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/pricing/calculate
 * @desc    Calculate stay price
 * @access  Internal
 */
router.get(
  '/api/pricing/calculate',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, roomMappingId, checkIn, checkOut, ratePlanId } = req.query;

      if (!hotelId || !roomMappingId || !checkIn || !checkOut || !ratePlanId) {
        sendError(
          res,
          'BAD_REQUEST',
          'hotelId, roomMappingId, checkIn, checkOut, and ratePlanId required',
          400
        );
        return;
      }

      const calculation = await pricingSyncService.calculateStayPrice(
        hotelId as string,
        roomMappingId as string,
        checkIn as string,
        checkOut as string,
        ratePlanId as string
      );
      sendResponse(res, calculation);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/pricing/sync/:channelId
 * @desc    Sync pricing to channel
 * @access  Internal
 */
router.post(
  '/api/pricing/sync/:channelId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, startDate, endDate } = req.body;

      if (!hotelId || !startDate || !endDate) {
        sendError(res, 'BAD_REQUEST', 'hotelId, startDate, and endDate required', 400);
        return;
      }

      const result = await pricingSyncService.syncToChannel(
        hotelId,
        req.params.channelId,
        startDate,
        endDate
      );
      sendResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
);

// Booking Routes

/**
 * @route   POST /api/bookings/import
 * @desc    Import booking from channel
 * @access  Internal
 */
router.post(
  '/api/bookings/import',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validated = validate(BookingImportSchema, req.body);

      // Check for existing booking
      const existing = await Booking.findOne({
        channelId: validated.channelId,
        externalBookingId: validated.externalBookingId
      });

      if (existing) {
        sendError(res, 'CONFLICT', 'Booking already exists', 409);
        return;
      }

      const booking = new Booking({
        ...validated,
        bookingId: uuidv4(),
        checkIn: new Date(validated.checkIn),
        checkOut: new Date(validated.checkOut),
        lastSyncedAt: new Date()
      });

      await booking.save();

      logger.info('Imported booking', {
        bookingId: booking.bookingId,
        channelId: validated.channelId,
        externalBookingId: validated.externalBookingId
      });

      sendResponse(res, booking.toObject(), 201);
    } catch (error) {
      if (error instanceof ZodError) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid booking data', 400, error.errors);
      } else {
        next(error);
      }
    }
  }
);

/**
 * @route   GET /api/bookings
 * @desc    Get bookings
 * @access  Internal
 */
router.get(
  '/api/bookings',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hotelId, channelId, status, startDate, endDate, page = '1', limit = '20' } = req.query;

      const query: Record<string, any> = {};
      if (hotelId) query.hotelId = hotelId;
      if (channelId) query.channelId = channelId;
      if (status) query.status = status;

      if (startDate || endDate) {
        query.checkIn = {};
        if (startDate) (query.checkIn as any).$gte = new Date(startDate as string);
        if (endDate) (query.checkIn as any).$lte = new Date(endDate as string);
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [bookings, total] = await Promise.all([
        Booking.find(query).skip(skip).limit(limitNum).sort({ checkIn: -1 }),
        Booking.countDocuments(query)
      ]);

      sendResponse(res, {
        bookings: bookings.map(b => b.toObject()),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/bookings/:bookingId
 * @desc    Get booking by ID
 * @access  Internal
 */
router.get(
  '/api/bookings/:bookingId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const booking = await Booking.findOne({ bookingId: req.params.bookingId });
      if (!booking) {
        sendError(res, 'NOT_FOUND', 'Booking not found', 404);
        return;
      }
      sendResponse(res, booking.toObject());
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/bookings/:bookingId/status
 * @desc    Update booking status
 * @access  Internal
 */
router.patch(
  '/api/bookings/:bookingId/status',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;

      if (!Object.values(BookingStatus).includes(status)) {
        sendError(
          res,
          'VALIDATION_ERROR',
          `Invalid status. Must be one of: ${Object.values(BookingStatus).join(', ')}`,
          400
        );
        return;
      }

      const booking = await Booking.findOneAndUpdate(
        { bookingId: req.params.bookingId },
        { $set: { status, lastSyncedAt: new Date() } },
        { new: true }
      );

      if (!booking) {
        sendError(res, 'NOT_FOUND', 'Booking not found', 404);
        return;
      }

      sendResponse(res, booking.toObject());
    } catch (error) {
      next(error);
    }
  }
);

export default router;
