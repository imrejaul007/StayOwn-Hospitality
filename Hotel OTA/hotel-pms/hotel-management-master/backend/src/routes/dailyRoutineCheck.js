import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import DailyRoutineCheck from '../models/DailyRoutineCheck.js';
import Room from '../models/Room.js';
import InventoryItem from '../models/InventoryItem.js';
import RoomInventory from '../models/RoomInventory.js';
import DailyRoutineCheckTemplate from '../models/DailyRoutineCheckTemplate.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import StaffAlert from '../models/StaffAlert.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import websocketService from '../services/websocketService.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();
const objectIdSchema = Joi.string().length(24).hex();
const dailyCartItemSchema = Joi.object({
  itemId: objectIdSchema.required(),
  itemName: Joi.string().trim().min(1).max(120).required(),
  category: Joi.string().trim().min(1).max(80).required(),
  inventoryType: Joi.string().valid('fixed', 'daily').optional(),
  action: Joi.string().valid('replace', 'add', 'laundry', 'reuse').required(),
  quantity: Joi.number().integer().min(1).max(1000).optional(),
  unitPrice: Joi.number().min(0).max(1000000).optional(),
  // totalPrice is computed client-side and sent alongside unitPrice/quantity —
  // we allow it here (backend always recomputes it) to avoid a 400 on extra keys.
  totalPrice: Joi.number().min(0).max(1000000000).optional(),
  notes: Joi.string().trim().allow('').max(500).optional()
});
const completeRoomCheckSchema = Joi.object({
  cart: Joi.array().items(dailyCartItemSchema).max(500).optional(),
  notes: Joi.string().trim().allow('').max(2000).optional()
}).required();
const markCheckedSchema = Joi.object({
  notes: Joi.string().trim().allow('').max(1000).optional()
}).optional();
const assignRoomsSchema = Joi.object({
  assignments: Joi.array().items(
    Joi.object({
      roomId: objectIdSchema.required(),
      staffId: objectIdSchema.required()
    })
  ).min(1).max(500).required()
}).required();
const templateItemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  category: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().trim().allow('').max(500).optional(),
  unitPrice: Joi.number().min(0).max(1000000).optional(),
  standardQuantity: Joi.number().integer().min(1).max(1000).optional(),
  checkInstructions: Joi.string().trim().allow('').max(500).optional(),
  expectedCondition: Joi.string().trim().min(1).max(80).optional()
});
const createTemplateSchema = Joi.object({
  roomType: Joi.string().valid('single', 'double', 'suite', 'deluxe').required(),
  fixedInventory: Joi.array().items(templateItemSchema).min(1).max(500).required(),
  dailyInventory: Joi.array().items(templateItemSchema).min(1).max(500).required(),
  estimatedCheckDuration: Joi.number().integer().min(1).max(240).optional()
}).required();
const updateTemplateSchema = Joi.object({
  fixedInventory: Joi.array().items(templateItemSchema).min(1).max(500).optional(),
  dailyInventory: Joi.array().items(templateItemSchema).min(1).max(500).optional(),
  estimatedCheckDuration: Joi.number().integer().min(1).max(240).optional()
}).min(1).required();
const emptyBodySchema = Joi.object({}).max(0).optional();

const getDayRange = (baseDate = new Date()) => {
  const startOfDay = new Date(baseDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return { startOfDay, endOfDay };
};

const isStaffScopedUser = (user) => ['staff', 'housekeeping'].includes(user?.role);
const isAssignmentScopedExecutor = (user) => ['staff', 'housekeeping', 'frontdesk'].includes(user?.role);
const ASSIGNABLE_DAILY_CHECK_ROLES = ['staff', 'housekeeping', 'frontdesk'];

const isDuplicateKeyError = (error) =>
  Boolean(error && (error.code === 11000 || error?.name === 'MongoServerError' && error?.code === 11000));

// All routes require authentication and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /api/v1/daily-routine-check/rooms:
 *   get:
 *     summary: Get rooms that need daily routine check
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, pending, completed, overdue]
 *         description: Filter rooms by check status
 *       - in: query
 *         name: floor
 *         schema:
 *           type: string
 *         description: Filter by floor
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by room type
 *     responses:
 *       200:
 *         description: List of rooms for daily check
 */
router.get('/rooms', authorizePolicy('dailyRoutineCheck', 'staffFrontdeskAccess'), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { filter, floor, type, page = 1, limit = 50, assignedToMe } = req.query;
  const { startOfDay: today, endOfDay: tomorrow } = getDayRange();

  logger.debug('Daily Routine Check - Getting rooms', { hotelId, date: today });

  // Build base query for rooms
  let roomQuery = { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true };
  if (floor) roomQuery.floor = floor;
  if (type) roomQuery.type = type;

  let scopedRoomIds = null;
  const enforceAssignedScope = isStaffScopedUser(req.user) || assignedToMe === 'true';
  if (enforceAssignedScope) {
    const assignedChecks = await DailyRoutineCheck.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      checkedBy: new mongoose.Types.ObjectId(userId),
      checkDate: { $gte: today, $lt: tomorrow }
    }).select('roomId').lean().limit(1000);
    scopedRoomIds = assignedChecks.map((check) => check.roomId);
    if (scopedRoomIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          rooms: [],
          pagination: { page: 1, limit: Math.min(100, Math.max(1, parseInt(limit) || 50)), total: 0, pages: 0 }
        }
      });
    }
    roomQuery._id = { $in: scopedRoomIds };
  }

  // Get all rooms for the hotel
  const rooms = await Room.find(roomQuery).select('roomNumber type floor status').lean().limit(1000);

  const roomIds = rooms.map((room) => room._id);

  // Get today's checks for these rooms
  const todayChecks = await DailyRoutineCheck.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    roomId: { $in: roomIds },
    checkDate: { $gte: today, $lt: tomorrow }
  }).select('roomId status checkedAt').lean().limit(1000);

  // We only need the most recent historical check per room to determine overdue
  // status.  Use an aggregation $group to fetch exactly one doc per roomId instead
  // of pulling thousands of documents and deduplicating in JS.
  const previousChecks = await DailyRoutineCheck.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        roomId: { $in: roomIds.map(id => new mongoose.Types.ObjectId(id)) },
        checkDate: { $lt: today }
      }
    },
    { $sort: { checkDate: -1, createdAt: -1 } },
    {
      $group: {
        _id: '$roomId',
        roomId: { $first: '$roomId' },
        status: { $first: '$status' },
        checkedAt: { $first: '$checkedAt' }
      }
    },
    { $limit: 1000 }
  ]);

  // Create a map of room checks
  const roomCheckMap = new Map();
  todayChecks.forEach(check => {
    roomCheckMap.set(check.roomId.toString(), check);
  });
  const lastHistoricalCheckMap = new Map();
  previousChecks.forEach((check) => {
    const roomKey = check.roomId.toString();
    if (!lastHistoricalCheckMap.has(roomKey)) {
      lastHistoricalCheckMap.set(roomKey, check);
    }
  });

  // Prepare room data with check status
  const roomsWithStatus = rooms.map(room => {
    const check = roomCheckMap.get(room._id.toString());
    let checkStatus = 'pending';
    let lastChecked = null;

    if (check) {
      checkStatus = check.status;
      lastChecked = check.checkedAt;
    }

    // Overdue only when there is a prior uncompleted historical check.
    if (!check) {
      const previousCheck = lastHistoricalCheckMap.get(room._id.toString());
      if (previousCheck && previousCheck.status !== 'completed') {
        checkStatus = 'overdue';
      }
    }

    return {
      _id: room._id,
      roomNumber: room.roomNumber,
      type: room.type,
      floor: room.floor,
      checkStatus,
      lastChecked,
      estimatedDuration: 15 // Default 15 minutes per room
    };
  });

  // Apply filter
  let filteredRooms = roomsWithStatus;
  if (filter && filter !== 'all') {
    filteredRooms = roomsWithStatus.filter(room => room.checkStatus === filter);
  }

  // Apply pagination with safe defaults
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit) || 50));
  const skip = (parsedPage - 1) * parsedLimit;
  const paginatedRooms = filteredRooms.slice(skip, skip + parsedLimit);

  // Batch-fetch all templates and inventories to avoid N+1 queries
  const uniqueRoomTypes = [...new Set(paginatedRooms.map(r => r.type).filter(Boolean))];
  const roomIdsForInventory = paginatedRooms.map(r => r._id).filter(Boolean);

  const [allTemplates, allInventories] = await Promise.all([
    DailyRoutineCheckTemplate.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      roomType: { $in: uniqueRoomTypes }
    }).lean().limit(1000),
    RoomInventory.find({
      roomId: { $in: roomIdsForInventory },
      isActive: true
    }).lean().limit(1000)
  ]);

  const templatesByType = new Map(allTemplates.map(t => [t.roomType, t]));
  const inventoryByRoomId = new Map(allInventories.map(inv => [inv.roomId.toString(), inv]));

  // Build inventory data for each room using pre-fetched data
  const roomsWithInventory = paginatedRooms.map((room) => {
    try {
      const template = templatesByType.get(room.type);

      if (!template) {
        logger.debug('No template found for room', { roomNumber: room.roomNumber, type: room.type });
        return {
          ...room,
          fixedInventory: [],
          dailyInventory: []
        };
      }

      logger.debug('Found template for room', { roomNumber: room.roomNumber, fixedItems: template.fixedInventory.length, dailyItems: template.dailyInventory.length });

      const currentInventory = room._id ? inventoryByRoomId.get(room._id.toString()) : null;

      // Prepare fixed inventory (permanent items)
      const fixedInventory = template.fixedInventory.map(item => ({
        _id: item._id,
        name: item.name,
        category: item.category,
        description: item.description || `${item.name} for ${room.type} room`,
        unitPrice: item.unitPrice || 0,
        quantity: 1,
        status: 'working' // Default status
      }));

      // Prepare daily inventory (consumable items)
      const dailyInventory = template.dailyInventory.map(item => ({
        _id: item._id,
        name: item.name,
        category: item.category,
        description: item.description || `${item.name} for daily use`,
        unitPrice: item.unitPrice || 0,
        quantity: item.standardQuantity || 1,
        status: 'available' // Default status
      }));

      return {
        ...room,
        fixedInventory,
        dailyInventory
      };
    } catch (error) {
      logger.error('Error getting inventory for room', { roomNumber: room.roomNumber, type: room.type, hotelId, error: error.message });
      return {
          ...room,
          fixedInventory: [],
          dailyInventory: []
        };
      }
    });

  res.status(200).json({
    status: 'success',
    data: {
      rooms: roomsWithInventory,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: filteredRooms.length,
        pages: parsedLimit > 0 ? Math.ceil(filteredRooms.length / parsedLimit) : 0
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/rooms/{roomId}/inventory:
 *   get:
 *     summary: Get detailed inventory for a specific room
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room inventory details
 */
router.get('/rooms/:roomId/inventory', authorizePolicy('dailyRoutineCheck', 'staffFrontdeskAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { roomId } = req.params;

  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw new ApplicationError('Room not found', 404);
  }

  // Verify room exists and belongs to hotel
  const room = await Room.findOne({
    _id: roomId,
    hotelId: new mongoose.Types.ObjectId(hotelId)
  }).lean();

  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  // Get room inventory template
  const template = await DailyRoutineCheckTemplate.findOne({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    roomType: room.type
  }).lean();

  if (!template) {
    throw new ApplicationError('No inventory template found for this room type', 404);
  }

  // Get current room inventory status
  const currentInventory = await RoomInventory.findOne({
    roomId: new mongoose.Types.ObjectId(roomId),
    isActive: true
  }).lean();

  // Prepare inventory data
  const fixedInventory = template.fixedInventory.map(item => ({
    _id: item._id,
    name: item.name,
    category: item.category,
    description: item.description || `${item.name} for ${room.type} room`,
    unitPrice: item.unitPrice || 0,
    quantity: 1,
    status: 'working'
  }));

  const dailyInventory = template.dailyInventory.map(item => ({
    _id: item._id,
    name: item.name,
    category: item.category,
    description: item.description || `${item.name} for daily use`,
    unitPrice: item.unitPrice || 0,
    quantity: item.standardQuantity || 1,
    status: 'available'
  }));

  res.status(200).json({
    status: 'success',
    data: {
      _id: room._id,
      roomNumber: room.roomNumber,
      type: room.type,
      floor: room.floor,
      checkStatus: 'pending',
      lastChecked: null,
      fixedInventory,
      dailyInventory,
      estimatedDuration: 15
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/rooms/{roomId}/complete:
 *   post:
 *     summary: Complete daily routine check for a room
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cart:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     action:
 *                       type: string
 *                       enum: [replace, add, laundry, reuse]
 *                     quantity:
 *                       type: number
 *                     notes:
 *                       type: string
 *     responses:
 *       200:
 *         description: Daily check completed successfully
 */
router.post('/rooms/:roomId/complete', authorizePolicy('dailyRoutineCheck', 'staffFrontdeskAccess'), validate(completeRoomCheckSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: checkedBy } = req.user;
  const { roomId } = req.params;
  const { cart, notes } = req.body;

  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw new ApplicationError('Room not found', 404);
  }

  logger.debug('Completing daily check for room', { roomId, checkedBy });

  // Verify room exists and belongs to hotel
  const room = await Room.findOne({
    _id: roomId,
    hotelId: new mongoose.Types.ObjectId(hotelId)
  }).lean();

  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  const { startOfDay: today, endOfDay: tomorrow } = getDayRange();

  if (isAssignmentScopedExecutor(req.user)) {
    const assignment = await DailyRoutineCheck.findOne({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      roomId: new mongoose.Types.ObjectId(roomId),
      checkedBy: new mongoose.Types.ObjectId(checkedBy),
      checkDate: { $gte: today, $lt: tomorrow }
    }).select('_id').lean();
    if (!assignment) {
      throw new ApplicationError('Room is not assigned to you for today', 403);
    }
  }

  // Validate category-action combinations before processing
  const validateCategoryActionCombination = (category, action) => {
    // All items can be added or reused
    if (action === 'add' || action === 'reuse' || action === 'replace') {
      return true;
    }

    // Only bedroom and bathroom items can go to laundry
    if (action === 'laundry') {
      const laundryCategories = ['bedroom', 'bathroom'];
      return laundryCategories.includes(category.toLowerCase());
    }

    return false;
  };

  // Process cart items with validation
  let processedItems = [];
  if (cart && cart.length > 0) {
    // Validate all items first
    const invalidItems = cart.filter(cartItem =>
      !validateCategoryActionCombination(cartItem.category, cartItem.action)
    );

    if (invalidItems.length > 0) {
      const invalidItemsDetails = invalidItems.map(item =>
        `${item.itemName} (${item.category}) cannot have action: ${item.action}`
      ).join(', ');
      throw new ApplicationError(`Invalid category-action combinations: ${invalidItemsDetails}`, 400);
    }

    processedItems = cart.map(cartItem => ({
      itemId: new mongoose.Types.ObjectId(cartItem.itemId),
      itemName: cartItem.itemName,
      category: cartItem.category,
      inventoryType: cartItem.inventoryType || 'daily',
      action: cartItem.action,
      quantity: cartItem.quantity || 1,
      unitPrice: cartItem.unitPrice || 0,
      totalPrice: (cartItem.unitPrice || 0) * (cartItem.quantity || 1),
      notes: cartItem.notes,
      status: cartItem.action === 'reuse' ? 'working' : 'needs_cleaning'
    }));
  }

  const completedAt = new Date();
  const completionData = {
    status: 'completed',
    completedAt,
    checkedAt: completedAt,
    checkedBy: new mongoose.Types.ObjectId(checkedBy),
    notes,
    items: processedItems
  };

  let resultCheck = await DailyRoutineCheck.findOne({
    roomId: new mongoose.Types.ObjectId(roomId),
    hotelId: new mongoose.Types.ObjectId(hotelId),
    checkDate: { $gte: today, $lt: tomorrow }
  });

  if (resultCheck?.status === 'completed') {
    return res.status(200).json({
      status: 'success',
      data: {
        roomId: resultCheck.roomId,
        checkedBy: resultCheck.checkedBy,
        checkedAt: resultCheck.completedAt || resultCheck.checkedAt,
        items: resultCheck.items,
        totalCost: resultCheck.totalCost,
        status: resultCheck.status,
        qualityScore: resultCheck.qualityScore
      }
    });
  }

  if (resultCheck) {
    resultCheck = await DailyRoutineCheck.findByIdAndUpdate(
      resultCheck._id,
      { $set: completionData },
      { new: true }
    );
  } else {
    try {
      const newCheck = new DailyRoutineCheck({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        roomId: new mongoose.Types.ObjectId(roomId),
        checkedBy: new mongoose.Types.ObjectId(checkedBy),
        checkDate: today,
        ...completionData
      });
      await newCheck.save();
      resultCheck = newCheck;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      resultCheck = await DailyRoutineCheck.findOne({
        roomId: new mongoose.Types.ObjectId(roomId),
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkDate: today
      });
      if (resultCheck?.status !== 'completed') {
        resultCheck = await DailyRoutineCheck.findByIdAndUpdate(
          resultCheck._id,
          { $set: completionData },
          { new: true }
        );
      }
    }
  }

  if (!resultCheck) {
    throw new ApplicationError('Unable to complete daily check', 500);
  }

  // Calculate quality score
  await resultCheck.calculateQualityScore();

  try {
    await websocketService.broadcastToHotel(hotelId.toString(), 'daily-routine-check:completed', {
      roomId: resultCheck.roomId,
      checkedBy: resultCheck.checkedBy,
      completedAt: resultCheck.completedAt || resultCheck.checkedAt,
      status: resultCheck.status
    });
  } catch (socketError) {
    logger.warn('Failed to emit websocket event for daily check completion', { roomId, error: socketError.message });
  }

  // Determine whether any items need replacement (maintenance required).
  // If so, keep the room in a non-bookable state until the maintenance is resolved.
  const hasReplaceItems = Array.isArray(cart) && cart.some(item => item.action === 'replace');
  const postCheckRoomStatus = hasReplaceItems ? 'maintenance' : 'vacant';

  // Update Room status after daily check completion.
  // - 'maintenance' when replacement items found (room blocked until fixed)
  // - 'vacant' when everything is fine
  try {
    const roomUpdateFields = { status: postCheckRoomStatus };
    if (!hasReplaceItems) roomUpdateFields.lastCleaned = new Date();
    await Room.findByIdAndUpdate(roomId, roomUpdateFields, { new: true });
    logger.debug('Room status updated after daily check', { roomId, status: postCheckRoomStatus });
    await websocketService.broadcastToHotel(hotelId.toString(), 'daily-routine-check:status_updated', {
      roomId,
      roomStatus: postCheckRoomStatus
    });
    await websocketService.broadcastToHotel(hotelId.toString(), 'room:status_changed', {
      roomId,
      status: postCheckRoomStatus,
      event: 'daily_routine_check_completed'
    });
  } catch (roomErr) {
    logger.warn('Failed to update room status after daily check', { roomId, error: roomErr.message });
  }

  // Create follow-up maintenance tasks for items that need replacement
  // This is the daily-routine-check → housekeeping/maintenance connection.
  if (cart && cart.length > 0) {
    const replaceItems = cart.filter(item => item.action === 'replace');
    if (replaceItems.length > 0) {
      try {
        const itemDescriptions = replaceItems.map(i => `${i.itemName} (x${i.quantity || 1})`).join(', ');
        await MaintenanceRequest.create({
          hotelId: new mongoose.Types.ObjectId(hotelId),
          roomId: new mongoose.Types.ObjectId(roomId),
          issueType: 'other',
          priority: 'medium',
          description: `Daily check replacement required: ${itemDescriptions}`,
          status: 'pending',
          createdBy: new mongoose.Types.ObjectId(checkedBy)
        });
        logger.debug('Maintenance request created for replacement items', { roomId, count: replaceItems.length });

        // Broadcast staff alert so housekeeping/maintenance sees it in real-time
        await websocketService.broadcastToHotel(hotelId.toString(), 'staff-alert:new', {
          alert: {
            type: 'maintenance_required',
            priority: 'medium',
            title: `Room ${room.roomNumber} — replacement needed`,
            message: `Items require replacement after daily check: ${itemDescriptions}`,
            category: 'maintenance',
            status: 'active',
            metadata: { roomNumber: room.roomNumber }
          }
        });
      } catch (maintenanceErr) {
        logger.warn('Failed to create maintenance request for replacement items', {
          roomId,
          error: maintenanceErr.message
        });
      }
    }

    // Create StaffAlert for damaged items so admin dashboard updates immediately
    const damagedItems = cart.filter(item => item.action === 'replace' && item.category);
    if (damagedItems.length > 0) {
      try {
        const itemDescriptions = damagedItems.map(i => i.itemName).join(', ');
        const newAlert = await StaffAlert.create({
          hotelId: hotelId.toString(),
          type: 'room_issue',
          priority: 'high',
          title: `Room ${room.roomNumber} — items need replacement`,
          message: `Daily check flagged items for replacement: ${itemDescriptions}`,
          category: 'maintenance',
          status: 'active',
          createdBy: new mongoose.Types.ObjectId(checkedBy),
          source: { type: 'staff', id: resultCheck._id.toString() },
          metadata: { roomNumber: room.roomNumber }
        });
        await websocketService.broadcastToHotel(hotelId.toString(), 'staff-alert:new', { alert: newAlert });
        logger.debug('StaffAlert created for replacement items from daily check', { roomId, alertId: newAlert._id });
      } catch (alertErr) {
        logger.warn('Failed to create StaffAlert for daily-check replacement items', {
          roomId,
          error: alertErr.message
        });
      }
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      roomId: resultCheck.roomId,
      checkedBy: resultCheck.checkedBy,
      checkedAt: resultCheck.completedAt || resultCheck.checkedAt,
      items: resultCheck.items,
      totalCost: resultCheck.totalCost,
      status: resultCheck.status,
      qualityScore: resultCheck.qualityScore
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/summary:
 *   get:
 *     summary: Get daily check summary for staff dashboard
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily check summary
 */
router.get('/summary', authorizePolicy('dailyRoutineCheck', 'staffFrontdeskAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get total rooms
  const totalRooms = await Room.countDocuments({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  });

  // Get today's checks
  const todayChecks = await DailyRoutineCheck.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    checkDate: { $gte: today, $lt: tomorrow }
  }).lean().limit(1000);

  const pendingChecks = totalRooms - todayChecks.length;
  const completedToday = todayChecks.filter(check => check.status === 'completed').length;
  const overdueChecks = 0; // Calculate based on rooms not checked for multiple days

  // Estimate time remaining (15 minutes per room)
  const estimatedTimeRemaining = pendingChecks * 15;

  res.status(200).json({
    status: 'success',
    data: {
      totalRooms,
      pendingChecks,
      completedToday,
      overdueChecks,
      estimatedTimeRemaining
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/my-assignments:
 *   get:
 *     summary: Get staff member's assigned rooms for today
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assigned rooms for today
 */
router.get('/my-assignments', authorizePolicy('dailyRoutineCheck', 'staffOnlyAccess'), catchAsync(async (req, res) => {
  const { hotelId, _id: staffId } = req.user;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get rooms assigned to this staff member today
  const assignedChecks = await DailyRoutineCheck.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    checkedBy: new mongoose.Types.ObjectId(staffId),
    checkDate: { $gte: today, $lt: tomorrow }
  }).populate('roomId', 'roomNumber type floor').lean().limit(1000);

  const rooms = assignedChecks.map(check => ({
    _id: check.roomId._id,
    roomNumber: check.roomId.roomNumber,
    type: check.roomId.type,
    floor: check.roomId.floor,
    checkStatus: check.status,
    lastChecked: check.checkedAt,
    estimatedDuration: check.estimatedDuration || 15
  }));

  res.status(200).json({
    status: 'success',
    data: { rooms }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/rooms/{roomId}/mark-checked:
 *   post:
 *     summary: Mark room as checked without detailed inventory
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Optional notes about the check
 *     responses:
 *       200:
 *         description: Room marked as checked
 */
router.post('/rooms/:roomId/mark-checked', authorizePolicy('dailyRoutineCheck', 'staffFrontdeskAccess'), validate(markCheckedSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: checkedBy } = req.user;
  const { roomId } = req.params;
  const { notes } = req.body;

  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    throw new ApplicationError('Room not found', 404);
  }

  // Verify room exists and belongs to hotel
  const room = await Room.findOne({
    _id: roomId,
    hotelId: new mongoose.Types.ObjectId(hotelId)
  }).lean();

  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  const { startOfDay: today, endOfDay: tomorrow } = getDayRange();

  if (isAssignmentScopedExecutor(req.user)) {
    const assignment = await DailyRoutineCheck.findOne({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      roomId: new mongoose.Types.ObjectId(roomId),
      checkedBy: new mongoose.Types.ObjectId(checkedBy),
      checkDate: { $gte: today, $lt: tomorrow }
    }).select('_id').lean();
    if (!assignment) {
      throw new ApplicationError('Room is not assigned to you for today', 403);
    }
  }

  const completedAt = new Date();
  const existingCheck = await DailyRoutineCheck.findOne({
    roomId: new mongoose.Types.ObjectId(roomId),
    hotelId: new mongoose.Types.ObjectId(hotelId),
    checkDate: { $gte: today, $lt: tomorrow }
  }).select('_id status').lean();

  let dailyCheck;
  if (existingCheck) {
    dailyCheck = await DailyRoutineCheck.findByIdAndUpdate(
      existingCheck._id,
      {
        $set: {
          status: 'completed',
          completedAt,
          checkedAt: completedAt,
          notes: notes || 'Quick check completed',
          checkedBy: new mongoose.Types.ObjectId(checkedBy)
        }
      },
      { new: true }
    );
  } else {
    try {
      dailyCheck = await DailyRoutineCheck.create({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        roomId: new mongoose.Types.ObjectId(roomId),
        checkDate: today,
        status: 'completed',
        completedAt,
        checkedAt: completedAt,
        notes: notes || 'Quick check completed',
        checkedBy: new mongoose.Types.ObjectId(checkedBy)
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      dailyCheck = await DailyRoutineCheck.findOneAndUpdate(
        {
          roomId: new mongoose.Types.ObjectId(roomId),
          hotelId: new mongoose.Types.ObjectId(hotelId),
          checkDate: today
        },
        {
          $set: {
            status: 'completed',
            completedAt,
            checkedAt: completedAt,
            notes: notes || 'Quick check completed',
            checkedBy: new mongoose.Types.ObjectId(checkedBy)
          }
        },
        { new: true }
      );
    }
  }

  // Update Room status to 'vacant' (clean) after mark-checked, matching the
  // complete endpoint behaviour so room status syncs to Tape Chart / Dashboard.
  try {
    await Room.findByIdAndUpdate(roomId, { status: 'vacant', lastCleaned: new Date() }, { new: true });
    logger.debug('Room status updated to vacant after mark-checked', { roomId });
    await websocketService.broadcastToHotel(hotelId.toString(), 'daily-routine-check:status_updated', {
      roomId,
      roomStatus: 'vacant'
    });
  } catch (roomErr) {
    logger.warn('Failed to update room status after mark-checked', { roomId, error: roomErr.message });
  }

  try {
    await websocketService.broadcastToHotel(hotelId.toString(), 'daily-routine-check:completed', {
      roomId: dailyCheck.roomId,
      checkedBy: dailyCheck.checkedBy,
      completedAt: dailyCheck.completedAt || dailyCheck.checkedAt,
      status: dailyCheck.status
    });
  } catch (socketError) {
    logger.warn('Failed to emit websocket event for quick completion', { roomId, error: socketError.message });
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: `Room ${room.roomNumber} marked as checked`,
      roomId: dailyCheck.roomId,
      checkedAt: dailyCheck.checkedAt || completedAt
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/assign:
 *   post:
 *     summary: Assign daily checks to staff members
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     roomId:
 *                       type: string
 *                     staffId:
 *                       type: string
 *     responses:
 *       200:
 *         description: Assignments created successfully
 */
router.post('/assign', authorizePolicy('dailyRoutineCheck', 'managerFrontdeskAccess'), validate(assignRoomsSchema), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { assignments } = req.body;

  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    throw new ApplicationError('Assignments array is required', 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  logger.debug('Creating daily check assignments', { count: assignments.length });

  const createdAssignments = [];
  const errors = [];

  // Batch-fetch all rooms and existing checks upfront to avoid N+1 queries
  const assignmentRoomIds = assignments.map(a => a.roomId).filter(Boolean);
  const assignmentStaffIds = assignments.map(a => a.staffId).filter(Boolean);
  const validStaffObjectIds = assignmentStaffIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [batchRooms, batchExistingChecks] = await Promise.all([
    Room.find({
      _id: { $in: assignmentRoomIds },
      hotelId: new mongoose.Types.ObjectId(hotelId)
    }).lean().limit(1000),
    DailyRoutineCheck.find({
      roomId: { $in: assignmentRoomIds.map(id => new mongoose.Types.ObjectId(id)) },
      hotelId: new mongoose.Types.ObjectId(hotelId),
      checkDate: { $gte: today, $lt: tomorrow }
    }).limit(1000)
  ]);
  const batchAssignableUsers = validStaffObjectIds.length > 0
    ? await User.find({
        _id: { $in: validStaffObjectIds },
        hotelId: new mongoose.Types.ObjectId(hotelId),
        role: { $in: ASSIGNABLE_DAILY_CHECK_ROLES },
        isActive: true
      }).select('_id role hotelId').lean().limit(1000)
    : [];

  const roomsMap = new Map(batchRooms.map(r => [r._id.toString(), r]));
  const existingChecksMap = new Map(batchExistingChecks.map(c => [c.roomId.toString(), c]));
  const validAssigneesMap = new Map(batchAssignableUsers.map((u) => [u._id.toString(), u]));

  for (const assignment of assignments) {
    try {
      const { roomId, staffId } = assignment;
      const roomIdString = roomId?.toString ? roomId.toString() : roomId;
      const staffIdString = staffId?.toString ? staffId.toString() : staffId;

      // Verify room exists and belongs to hotel (using pre-fetched map)
      const room = roomsMap.get(roomIdString);

      if (!room) {
        errors.push(`Room ${roomId} not found`);
        continue;
      }

      if (!staffIdString || !mongoose.Types.ObjectId.isValid(staffIdString)) {
        errors.push(`Invalid staffId for room ${roomId}`);
        continue;
      }

      const validAssignee = validAssigneesMap.get(staffIdString);
      if (!validAssignee) {
        errors.push(`Staff ${staffId} is not an active assignable user for this hotel`);
        continue;
      }

      // Check if assignment already exists for today (using pre-fetched map)
      const existingCheck = existingChecksMap.get(roomIdString);

      if (existingCheck) {
        // Update existing assignment atomically
        const updated = await DailyRoutineCheck.findByIdAndUpdate(
          existingCheck._id,
          { $set: { checkedBy: new mongoose.Types.ObjectId(staffIdString) } },
          { new: true }
        );
        createdAssignments.push(updated);
        logger.debug('Updated existing assignment for room', { roomNumber: room.roomNumber });
      } else {
        // Create new assignment
        const newCheck = new DailyRoutineCheck({
          hotelId: new mongoose.Types.ObjectId(hotelId),
          roomId: new mongoose.Types.ObjectId(roomId),
          checkedBy: new mongoose.Types.ObjectId(staffIdString),
          checkDate: today,
          status: 'pending'
        });

        await newCheck.save();
        createdAssignments.push(newCheck);
        logger.debug('Created new assignment for room', { roomNumber: room.roomNumber });
      }
    } catch (error) {
      logger.error('Error assigning room', { roomId: assignment.roomId, error: error.message });
      errors.push(`Failed to assign room ${assignment.roomId}: ${error.message}`);
    }
  }

  try {
    await websocketService.broadcastToHotel(hotelId.toString(), 'daily-routine-check:assigned', {
      assignmentsCreated: createdAssignments.length
    });
    for (const assignment of createdAssignments) {
      if (assignment?.checkedBy) {
        await websocketService.sendToUser(assignment.checkedBy.toString(), 'daily-routine-check:assigned', {
          roomId: assignment.roomId,
          assignmentId: assignment._id
        });
      }
    }
  } catch (socketError) {
    logger.warn('Failed to emit websocket event for daily check assignment', { error: socketError.message });
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: `Successfully assigned ${createdAssignments.length} rooms`,
      assignmentsCreated: createdAssignments.length,
      errors: errors.length > 0 ? errors : undefined
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/templates:
 *   get:
 *     summary: Get all inventory templates for room types
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of inventory templates
 */
router.get('/templates', authorizePolicy('dailyRoutineCheck', 'fullAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const templates = await DailyRoutineCheckTemplate.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  }).sort({ roomType: 1 }).lean().limit(1000);

  res.status(200).json({
    status: 'success',
    data: {
      templates: templates.map(template => ({
        roomType: template.roomType,
        fixedInventory: template.fixedInventory,
        dailyInventory: template.dailyInventory,
        estimatedCheckDuration: template.estimatedCheckDuration
      }))
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/templates:
 *   post:
 *     summary: Create new inventory template for a room type
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomType
 *               - fixedInventory
 *               - dailyInventory
 *             properties:
 *               roomType:
 *                 type: string
 *                 enum: [single, double, suite, deluxe]
 *               fixedInventory:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     category:
 *                       type: string
 *                       enum: [electronics, furniture, appliances, fixtures, other]
 *                     description:
 *                       type: string
 *                     unitPrice:
 *                       type: number
 *                     standardQuantity:
 *                       type: number
 *                     checkInstructions:
 *                       type: string
 *                     expectedCondition:
 *                       type: string
 *                       enum: [working, clean, undamaged, functional]
 *               dailyInventory:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     category:
 *                       type: string
 *                       enum: [bathroom, bedroom, kitchen, amenities, other]
 *                     description:
 *                       type: string
 *                     unitPrice:
 *                       type: number
 *                     standardQuantity:
 *                       type: number
 *                     checkInstructions:
 *                       type: string
 *                     expectedCondition:
 *                       type: string
 *                       enum: [clean, fresh, undamaged, adequate]
 *               estimatedCheckDuration:
 *                 type: number
 *                 default: 15
 *     responses:
 *       201:
 *         description: Template created successfully
 *       400:
 *         description: Template already exists for this room type
 */
router.post('/templates', authorizePolicy('dailyRoutineCheck', 'managerFrontdeskAccess'), validate(createTemplateSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: createdBy } = req.user;
  const { roomType, fixedInventory, dailyInventory, estimatedCheckDuration } = req.body;

  // Validate required fields
  if (!roomType || !fixedInventory || !dailyInventory) {
    throw new ApplicationError('Room type, fixed inventory, and daily inventory are required', 400);
  }

  // Check if template already exists
  const existingTemplate = await DailyRoutineCheckTemplate.findOne({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    roomType: roomType,
    isActive: true
  }).lean();

  if (existingTemplate) {
    throw new ApplicationError(`Template already exists for ${roomType} rooms`, 400);
  }

  // Validate inventory items
  const validateInventoryItem = (item, type) => {
    if (!item.name || !item.category) {
      throw new ApplicationError(`${type} inventory item must have name and category`, 400);
    }
  };

  fixedInventory.forEach(item => validateInventoryItem(item, 'Fixed'));
  dailyInventory.forEach(item => validateInventoryItem(item, 'Daily'));

  // Create new template
  const newTemplate = new DailyRoutineCheckTemplate({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    roomType: roomType,
    fixedInventory: fixedInventory.map(item => ({
      name: item.name,
      category: item.category,
      description: item.description || '',
      unitPrice: item.unitPrice || 0,
      standardQuantity: item.standardQuantity || 1,
      checkInstructions: item.checkInstructions || '',
      expectedCondition: item.expectedCondition || 'working'
    })),
    dailyInventory: dailyInventory.map(item => ({
      name: item.name,
      category: item.category,
      description: item.description || '',
      unitPrice: item.unitPrice || 0,
      standardQuantity: item.standardQuantity || 1,
      checkInstructions: item.checkInstructions || '',
      expectedCondition: item.expectedCondition || 'clean'
    })),
    estimatedCheckDuration: estimatedCheckDuration || 15,
    createdBy: new mongoose.Types.ObjectId(createdBy),
    lastUpdatedBy: new mongoose.Types.ObjectId(createdBy),
    isActive: true
  });

  await newTemplate.save();

  res.status(201).json({
    status: 'success',
    data: {
      message: `Template for ${roomType} rooms created successfully`,
      template: newTemplate
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/templates/{roomType}:
 *   put:
 *     summary: Update inventory template for a room type
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomType
 *         required: true
 *         schema:
 *           type: string
 *         description: Room type to update template for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fixedInventory:
 *                 type: array
 *               dailyInventory:
 *                 type: array
 *               estimatedCheckDuration:
 *                 type: number
 *     responses:
 *       200:
 *         description: Template updated successfully
 */
const ALLOWED_ROOM_TYPES = ['single', 'double', 'suite', 'deluxe'];

router.put('/templates/:roomType', authorizePolicy('dailyRoutineCheck', 'managerFrontdeskAccess'), validate(updateTemplateSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: updatedBy } = req.user;
  const { roomType } = req.params;
  const { fixedInventory, dailyInventory, estimatedCheckDuration } = req.body;

  // SECURITY: Allowlist roomType to prevent NoSQL operator injection via path param.
  if (!ALLOWED_ROOM_TYPES.includes(roomType)) {
    throw new ApplicationError('Invalid room type', 400);
  }

  // Validate inventory items if provided
  if (fixedInventory) {
    fixedInventory.forEach(item => {
      if (!item.name || !item.category) {
        throw new ApplicationError('Fixed inventory item must have name and category', 400);
      }
    });
  }

  if (dailyInventory) {
    dailyInventory.forEach(item => {
      if (!item.name || !item.category) {
        throw new ApplicationError('Daily inventory item must have name and category', 400);
      }
    });
  }

  const updateData = {
    lastUpdatedBy: new mongoose.Types.ObjectId(updatedBy)
  };

  if (fixedInventory) updateData.fixedInventory = fixedInventory;
  if (dailyInventory) updateData.dailyInventory = dailyInventory;
  if (estimatedCheckDuration) updateData.estimatedCheckDuration = estimatedCheckDuration;

  const template = await DailyRoutineCheckTemplate.findOneAndUpdate(
    {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      roomType: roomType,
      isActive: true
    },
    updateData,
    { new: true }
  );

  if (!template) {
    throw new ApplicationError('Template not found for this room type', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: `Template for ${roomType} rooms updated successfully`,
      template
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/templates/{roomType}:
 *   delete:
 *     summary: Delete inventory template for a room type
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomType
 *         required: true
 *         schema:
 *           type: string
 *         description: Room type to delete template for
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       404:
 *         description: Template not found
 */
router.delete('/templates/:roomType', authorizePolicy('dailyRoutineCheck', 'managerFrontdeskAccess'), validate(emptyBodySchema), catchAsync(async (req, res) => {
  const { hotelId, _id: updatedBy } = req.user;
  const { roomType } = req.params;

  // SECURITY: Allowlist roomType to prevent NoSQL operator injection via path param.
  if (!ALLOWED_ROOM_TYPES.includes(roomType)) {
    throw new ApplicationError('Invalid room type', 400);
  }

  const template = await DailyRoutineCheckTemplate.findOneAndUpdate(
    {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      roomType: roomType,
      isActive: true
    },
    {
      isActive: false,
      lastUpdatedBy: new mongoose.Types.ObjectId(updatedBy)
    },
    { new: true }
  );

  if (!template) {
    throw new ApplicationError('Template not found for this room type', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: `Template for ${roomType} rooms deleted successfully`
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/admin/overview:
 *   get:
 *     summary: Get admin overview of daily checks
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin overview data
 */
router.get('/admin/overview', authorizePolicy('dailyRoutineCheck', 'managerFrontdeskAccess'), catchAsync(async (req, res) => {
  const hotelId = req.query.hotelId || req.user.hotelId;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get total rooms
  const totalRooms = await Room.countDocuments({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  });

  // Get today's checks with staff details
  const todayChecks = await DailyRoutineCheck.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    checkDate: { $gte: today, $lt: tomorrow }
  }).populate('checkedBy', 'name email')
    .populate('roomId', 'roomNumber type floor').lean().limit(1000);

  // Get staff assignment summary (skip checks with deleted staff/rooms)
  const assignmentSummary = {};
  todayChecks.forEach(check => {
    if (!check.checkedBy?._id || !check.roomId) return;
    const staffId = check.checkedBy._id.toString();
    if (!assignmentSummary[staffId]) {
      assignmentSummary[staffId] = {
        staff: check.checkedBy,
        totalAssigned: 0,
        completed: 0,
        pending: 0,
        rooms: []
      };
    }
    assignmentSummary[staffId].totalAssigned++;
    if (check.status === 'completed') {
      assignmentSummary[staffId].completed++;
    } else {
      assignmentSummary[staffId].pending++;
    }
    assignmentSummary[staffId].rooms.push({
      roomNumber: check.roomId.roomNumber || 'Unknown',
      type: check.roomId.type || 'unknown',
      status: check.status,
      checkedAt: check.checkedAt
    });
  });

  const pendingChecks = totalRooms - todayChecks.length;
  const completedToday = todayChecks.filter(check => check.status === 'completed').length;
  const overdueChecks = todayChecks.filter(check => check.status === 'overdue').length;

  res.status(200).json({
    status: 'success',
    data: {
      totalRooms,
      assignedRooms: todayChecks.length,
      pendingChecks,
      completedToday,
      overdueChecks,
      assignmentSummary: Object.values(assignmentSummary),
      unassignedRooms: pendingChecks
    }
  });
}));

/**
 * @swagger
 * /api/v1/daily-routine-check/admin/unassigned-rooms:
 *   get:
 *     summary: Get unassigned rooms for today
 *     tags: [Daily Routine Check]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unassigned rooms
 */
router.get('/admin/unassigned-rooms', authorizePolicy('dailyRoutineCheck', 'managerFrontdeskAccess'), catchAsync(async (req, res) => {
  const hotelId = req.query.hotelId || req.user.hotelId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all active rooms
  const allRooms = await Room.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  }).lean().limit(1000);

  // Get rooms that have daily check assignments for today
  const assignedRoomIds = await DailyRoutineCheck.distinct('roomId', {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    checkDate: { $gte: today, $lt: tomorrow }
  });

  // Filter out assigned rooms to get unassigned ones
  const unassignedRooms = allRooms.filter(room =>
    !assignedRoomIds.some(assignedId => assignedId.equals(room._id))
  );

  res.status(200).json({
    status: 'success',
    data: {
      rooms: unassignedRooms,
      count: unassignedRooms.length
    }
  });
}));

export default router;
