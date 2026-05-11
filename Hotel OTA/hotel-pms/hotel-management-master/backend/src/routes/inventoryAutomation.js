import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import pmsOtaIntegration from '../services/pmsOtaIntegration.js';
import logger from '../utils/logger.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require authentication + tenant isolation
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * tags:
 *   name: Inventory Automation
 *   description: Automated inventory management during checkout processing
 */

/**
 * @swagger
 * /api/v1/inventory-automation/process-checkout:
 *   post:
 *     summary: Process comprehensive inventory automation for checkout
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - roomId
 *             properties:
 *               bookingId:
 *                 type: string
 *               roomId:
 *                 type: string
 *               options:
 *                 type: object
 *                 properties:
 *                   isAdminBypass:
 *                     type: boolean
 *                   forceRoutineCheck:
 *                     type: boolean
 *                   roomCondition:
 *                     type: string
 *                     enum: [normal, dirty, very_dirty, damaged, unused]
 *     responses:
 *       200:
 *         description: Inventory automation completed successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Booking or room not found
 */
router.post('/process-checkout', authorizePolicy('inventoryAutomation', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { bookingId, roomId, options = {} } = req.body;

  if (!bookingId || !roomId) {
    throw new ApplicationError('Booking ID and Room ID are required', 400);
  }

  // Enforce tenant ownership and booking-room relation before automation.
  const Booking = (await import('../models/Booking.js')).default;
  const Room = (await import('../models/Room.js')).default;
  const [booking, room] = await Promise.all([
    Booking.findOne({ _id: bookingId, hotelId }).lean(),
    Room.findOne({ _id: roomId, hotelId }).lean()
  ]);

  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  const bookingHasRoom = Array.isArray(booking.rooms) && booking.rooms.some((rb) => {
    if (!rb?.roomId) return false;
    const bookingRoomId = rb.roomId?._id ? rb.roomId._id.toString() : rb.roomId.toString();
    return bookingRoomId === roomId.toString();
  });
  if (!bookingHasRoom) {
    throw new ApplicationError('Room does not belong to the booking', 400);
  }

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');
  
  const result = await inventoryAutomationService.processCheckoutInventory(
    bookingId,
    roomId,
    userId,
    {
      hotelId,
      ...options
    }
  );

  res.status(200).json({
    status: 'success',
    message: 'Inventory automation completed successfully',
    data: result
  });

  // PMS→OTA: Emit inventory_updated webhook when inventory changes (fire-and-forget)
  try {
    const Hotel = (await import('../models/Hotel.js')).default;
    const RoomType = (await import('../models/RoomType.js')).default;
    const RoomAvailability = (await import('../models/RoomAvailability.js')).default;

    const hotel = await Hotel.findById(hotelId).lean();
    const roomType = await RoomType.findById(room.roomTypeId).lean();
    const availability = await RoomAvailability.findOne({
      roomType: room.roomTypeId,
      date: { $gte: new Date() }
    }).lean();

    if (hotel && roomType && availability) {
      await pmsOtaIntegration.emitInventoryUpdated(
        hotel,
        roomType,
        new Date(),
        availability.availableRooms || 0,
        result.availableRooms || availability.availableRooms || 0,
        availability.totalRooms || roomType.maxOccupancy || 1,
        availability.sellingRate ? Math.round(availability.sellingRate * 100) : null
      );
    }
  } catch (webhookErr) {
    logger.warn('[PMS→OTA] Inventory updated webhook emission failed (non-blocking):', webhookErr.message);
  }
}));

/**
 * @swagger
 * /api/v1/inventory-automation/assess-room/{roomId}:
 *   get:
 *     summary: Assess room inventory condition
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomCondition
 *         schema:
 *           type: string
 *           enum: [normal, dirty, very_dirty, damaged, unused]
 *     responses:
 *       200:
 *         description: Room inventory assessment completed
 *       404:
 *         description: Room not found
 */
router.get('/assess-room/:roomId', authorizePolicy('inventoryAutomation', 'staffAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { roomId } = req.params;
  const { roomCondition } = req.query;

  // Verify room belongs to this hotel
  const Room = (await import('../models/Room.js')).default;
  const room = await Room.findOne({ _id: roomId, hotelId }).lean();
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');

  const assessment = await inventoryAutomationService.assessRoomInventory(roomId, {
    roomCondition,
    hotelId
  });

  res.status(200).json({
    status: 'success',
    data: { assessment }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/statistics:
 *   get:
 *     summary: Get inventory automation statistics
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/statistics', authorizePolicy('inventoryAutomation', 'managerAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { startDate, endDate } = req.query;

  const dateRange = {};
  if (startDate) dateRange.startDate = new Date(startDate);
  if (endDate) dateRange.endDate = new Date(endDate);

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');
  
  const statistics = await inventoryAutomationService.getInventoryStatistics(hotelId, dateRange);

  res.status(200).json({
    status: 'success',
    data: { statistics }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/rooms-needing-attention:
 *   get:
 *     summary: Get rooms needing inventory attention
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [clean, dirty, maintenance, inspection_required, damaged, out_of_order]
 *     responses:
 *       200:
 *         description: Rooms retrieved successfully
 */
router.get('/rooms-needing-attention', authorizePolicy('inventoryAutomation', 'staffAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { priority, status, page = 1, limit = 20 } = req.query;

  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Import models
  const RoomInventory = (await import('../models/RoomInventory.js')).default;

  const filter = { hotelId, isActive: true };
  if (status) filter.status = status;

  // Apply priority-based conditionScore filter at the DB level
  if (priority) {
    switch (priority) {
      case 'urgent':
        filter.$or = [
          { conditionScore: { $lt: 30 } },
          { maintenanceRequired: true }
        ];
        break;
      case 'high':
        filter.conditionScore = { $lt: 50 };
        break;
      case 'medium':
        filter.conditionScore = { $lt: 70 };
        break;
      case 'low':
        filter.conditionScore = { $gte: 70 };
        break;
    }
  }

  const skip = (parsedPage - 1) * parsedLimit;

  const [rooms, totalCount] = await Promise.all([
    RoomInventory.find(filter)
      .populate('roomId', 'roomNumber type floor')
      .populate('currentBookingId', 'bookingNumber checkIn checkOut')
      .sort({ lastInspectionDate: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    RoomInventory.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      rooms,
      page: parsedPage,
      limit: parsedLimit,
      totalCount,
      totalPages: totalCount > 0 ? Math.ceil(totalCount / parsedLimit) : 0
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/replacement-items/{roomId}:
 *   get:
 *     summary: Get items needing replacement for a room
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Replacement items retrieved successfully
 *       404:
 *         description: Room not found
 */
router.get('/replacement-items/:roomId', authorizePolicy('inventoryAutomation', 'staffAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { roomId } = req.params;

  // Verify room belongs to this hotel
  const Room = (await import('../models/Room.js')).default;
  const room = await Room.findOne({ _id: roomId, hotelId }).lean();
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  // Import inventory automation service
  const { default: inventoryAutomationService } = await import('../services/inventoryAutomationService.js');

  // First assess the room
  const assessment = await inventoryAutomationService.assessRoomInventory(roomId, {
    hotelId
  });

  // Then identify replacement items
  const replacementItems = await inventoryAutomationService.identifyReplacementItems(
    roomId,
    assessment,
    { hotelId }
  );

  res.status(200).json({
    status: 'success',
    data: {
      assessment: assessment.summary,
      replacementItems
    }
  });
}));

/**
 * @swagger
 * /api/v1/inventory-automation/update-room-status/{roomId}:
 *   put:
 *     summary: Update room inventory status
 *     tags: [Inventory Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [clean, dirty, maintenance, inspection_required, damaged, out_of_order]
 *               maintenanceNotes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     condition:
 *                       type: string
 *                     needsReplacement:
 *                       type: boolean
 *                     replacementReason:
 *                       type: string
 *     responses:
 *       200:
 *         description: Room status updated successfully
 *       404:
 *         description: Room not found
 */
router.put('/update-room-status/:roomId', authorizePolicy('inventoryAutomation', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { roomId } = req.params;
  const { status, maintenanceNotes, items } = req.body;

  // Import models
  const RoomInventory = (await import('../models/RoomInventory.js')).default;
  
  const roomInventory = await RoomInventory.findOne({ roomId, hotelId });
  if (!roomInventory) {
    throw new ApplicationError('Room inventory not found', 404);
  }

  // Update room status
  if (status) {
    roomInventory.status = status;
  }

  if (maintenanceNotes) {
    roomInventory.maintenanceNotes = maintenanceNotes;
    roomInventory.maintenanceRequired = true;
  }

  // Update individual items
  if (items && Array.isArray(items)) {
    for (const itemUpdate of items) {
      const item = roomInventory.items.id(itemUpdate.itemId);
      if (item) {
        if (itemUpdate.condition) item.condition = itemUpdate.condition;
        if (itemUpdate.needsReplacement !== undefined) item.needsReplacement = itemUpdate.needsReplacement;
        if (itemUpdate.replacementReason) item.replacementReason = itemUpdate.replacementReason;
        item.lastCheckedDate = new Date();
        item.checkedBy = userId;
      }
    }
  }

  await roomInventory.save();

  res.status(200).json({
    status: 'success',
    message: 'Room status updated successfully',
    data: { 
      roomId,
      newStatus: roomInventory.status,
      maintenanceRequired: roomInventory.maintenanceRequired
    }
  });
}));

export default router;
