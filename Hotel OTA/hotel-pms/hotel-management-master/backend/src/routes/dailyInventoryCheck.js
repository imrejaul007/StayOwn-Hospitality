import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { catchAsync } from '../utils/catchAsync.js';
import DailyInventoryCheck from '../models/DailyInventoryCheck.js';
import RoomInventory from '../models/RoomInventory.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import inventoryNotificationService from '../services/inventoryNotificationService.js';
import { validate, schemas } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require authentication
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /daily-inventory-checks:
 *   post:
 *     summary: Create a new daily inventory check
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - items
 *             properties:
 *               roomId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     currentQuantity:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [sufficient, low, missing, damaged]
 *                     notes:
 *                       type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Daily inventory check created successfully
 */
router.post('/', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { roomId, items, notes } = req.body;
  const { hotelId } = req.user;

  // Verify room exists and belongs to hotel
  const room = await Room.findOne({ _id: roomId, hotelId }).lean();
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  // Get inventory items for validation
  const itemIds = items.map(item => item.itemId);
  const inventoryItems = await InventoryItem.find({
    _id: { $in: itemIds },
    hotelId
  }).lean().limit(1000);

  if (inventoryItems.length !== itemIds.length) {
    throw new ApplicationError('Some inventory items not found', 400);
  }

  // Create inventory items array with required data
  const checkItems = items.map(item => {
    const inventoryItem = inventoryItems.find(inv => inv._id.toString() === item.itemId);
    return {
      itemId: item.itemId,
      itemName: inventoryItem.name,
      category: inventoryItem.category,
      currentQuantity: item.currentQuantity,
      requiredQuantity: inventoryItem.stockThreshold || 1,
      status: item.status || 'sufficient',
      notes: item.notes
    };
  });

  const dailyCheck = await DailyInventoryCheck.create({
    hotelId,
    roomId,
    checkedBy: req.user._id,
    items: checkItems,
    notes
  });

  await dailyCheck.populate([
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { dailyCheck }
  });
}));

/**
 * @swagger
 * /daily-inventory-checks:
 *   get:
 *     summary: Get daily inventory checks
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of daily inventory checks
 */
router.get('/', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    roomId,
    date
  } = req.query;

  const { hotelId } = req.user;
  const query = { hotelId };

  // Apply filters
  if (status) query.status = status;
  if (roomId) query.roomId = roomId;
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    query.checkDate = { $gte: startDate, $lt: endDate };
  }

  // Staff can only see their own checks unless admin
  if (req.user.role === 'staff') {
    query.checkedBy = req.user._id;
  }

  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [dailyChecks, total] = await Promise.all([
    DailyInventoryCheck.find(query)
      .populate('roomId', 'roomNumber type')
      .populate('checkedBy', 'name email')
      .sort('-checkDate')
      .skip(skip)
      .limit(parsedLimit),
    DailyInventoryCheck.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      dailyChecks,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: parsedLimit > 0 ? Math.ceil(total / parsedLimit) : 0
      }
    }
  });
}));

/**
 * @swagger
 * /daily-inventory-checks/today:
 *   get:
 *     summary: Get today's inventory checks
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's inventory checks
 */
router.get('/today', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  
  const todayChecks = await DailyInventoryCheck.getTodayChecks(hotelId);
  
  res.json({
    status: 'success',
    data: { dailyChecks: todayChecks }
  });
}));

/**
 * @swagger
 * /daily-inventory-checks/overdue:
 *   get:
 *     summary: Get overdue inventory checks
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue inventory checks
 */
router.get('/overdue', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  
  const overdueChecks = await DailyInventoryCheck.getOverdueChecks(hotelId);
  
  res.json({
    status: 'success',
    data: { dailyChecks: overdueChecks }
  });
}));

/**
 * @swagger
 * /daily-inventory-checks/{id}:
 *   get:
 *     summary: Get specific daily inventory check
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Daily inventory check details
 */
router.get('/:id', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }
  const dailyCheck = await DailyInventoryCheck.findById(req.params.id)
    .populate('roomId', 'roomNumber type')
    .populate('checkedBy', 'name email')
    .populate('items.itemId', 'name category unitPrice').lean();

  if (!dailyCheck) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && dailyCheck.checkedBy._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only view your own inventory checks', 403);
  }

  if (req.user.role === 'staff' && dailyCheck.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only view checks for your hotel', 403);
  }

  res.json({
    status: 'success',
    data: { dailyCheck }
  });
}));

/**
 * @swagger
 * /daily-inventory-checks/{id}:
 *   patch:
 *     summary: Update daily inventory check
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *                 enum: [pending, in_progress, completed, overdue]
 *               items:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Daily inventory check updated successfully
 */
router.patch('/:id', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }
  // Read-only check for permissions
  const existingCheck = await DailyInventoryCheck.findById(req.params.id).lean();

  if (!existingCheck) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }

  // Check permissions
  if (req.user.role === 'staff' && existingCheck.checkedBy.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only update your own inventory checks', 403);
  }

  const { status, items, notes } = req.body;

  // Build atomic update
  const updateFields = {};
  if (status) updateFields.status = status;
  if (items) updateFields.items = items;
  if (notes !== undefined) updateFields.notes = notes;

  // Set completedAt if status is completed
  if (status === 'completed' && !existingCheck.completedAt) {
    updateFields.completedAt = new Date();
  }

  const dailyCheck = await DailyInventoryCheck.findByIdAndUpdate(
    req.params.id,
    { $set: updateFields },
    { new: true, runValidators: true }
  );

  await dailyCheck.populate([
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.json({
    status: 'success',
    data: { dailyCheck }
  });
}));

/**
 * @swagger
 * /daily-inventory-checks/{id}/complete:
 *   patch:
 *     summary: Mark daily inventory check as completed
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Daily inventory check marked as completed
 */
router.patch('/:id/complete', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }
  const existingCheck = await DailyInventoryCheck.findById(req.params.id).lean();

  if (!existingCheck) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }

  // Check permissions
  if (req.user.role === 'staff' && existingCheck.checkedBy.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only complete your own inventory checks', 403);
  }

  // Atomic update instead of calling instance method on lean object
  const dailyCheck = await DailyInventoryCheck.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true, runValidators: true }
  );

  await dailyCheck.populate([
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.json({
    status: 'success',
    data: { dailyCheck }
  });
}));

/**
 * @swagger
 * /daily-inventory-checks/{id}/issues:
 *   post:
 *     summary: Add issue to daily inventory check
 *     tags: [Daily Inventory Checks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *               - issue
 *             properties:
 *               itemId:
 *                 type: string
 *               issue:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *     responses:
 *       200:
 *         description: Issue added successfully
 */
router.post('/:id/issues', authenticate, authorizePolicy('dailyInventoryCheck', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { itemId, issue, priority = 'medium' } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }
  const existingCheck = await DailyInventoryCheck.findById(req.params.id).lean();

  if (!existingCheck) {
    throw new ApplicationError('Daily inventory check not found', 404);
  }

  // Check permissions
  if (req.user.role === 'staff' && existingCheck.checkedBy.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only add issues to your own inventory checks', 403);
  }

  // Atomic update: push issue instead of calling instance method on lean object
  const dailyCheck = await DailyInventoryCheck.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        issues: {
          itemId,
          issue,
          priority,
          reportedBy: req.user._id,
          reportedAt: new Date()
        }
      }
    },
    { new: true, runValidators: true }
  );

  res.json({
    status: 'success',
    data: { dailyCheck }
  });
}));

/**
 * Get daily checks for a room
 */
router.get('/room/:roomId', authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const { startDate, endDate } = req.query;
  const { hotelId } = req.user;

  // Verify room belongs to user's hotel
  const room = await Room.findOne({ _id: roomId, hotelId }).lean();
  if (!room) {
    throw new ApplicationError('Room not found or access denied', 404);
  }

  const checks = await DailyInventoryCheck.getRoomChecks(roomId, startDate, endDate);

  res.status(200).json({
    status: 'success',
    results: checks.length,
    data: {
      checks
    }
  });
}));

/**
 * Get pending replacements for hotel
 */
router.get('/pending-replacements', authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const pendingReplacements = await DailyInventoryCheck.getPendingReplacements(hotelId);

  res.status(200).json({
    status: 'success',
    results: pendingReplacements.length,
    data: {
      pendingReplacements
    }
  });
}));

/**
 * Get guest charges from inventory
 * Used by guest dashboard to show charges
 */
router.get('/guest-charges/:guestId', authorizePolicy('dailyInventoryCheck', 'guestAccess'), catchAsync(async (req, res) => {
  const { guestId } = req.params;
  const { bookingId } = req.query;

  // Validate guestId format
  if (!mongoose.Types.ObjectId.isValid(guestId)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid guest ID format'
    });
  }

  // Check if user can access this data
  if (req.user.role === 'guest' && req.user._id.toString() !== guestId) {
    return res.status(403).json({
      status: 'fail',
      message: 'You can only access your own charges'
    });
  }

  // Query InventoryTransaction for actual guest charges (not DailyInventoryCheck
  // which tracks staff inspections, not guest-facing charges)
  const chargeQuery = {
    guestId: new mongoose.Types.ObjectId(guestId),
    chargedToGuest: true,
    status: { $in: ['completed', 'approved'] }
  };
  if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
    chargeQuery.bookingId = new mongoose.Types.ObjectId(bookingId);
  }

  const transactions = await InventoryTransaction.find(chargeQuery)
    .populate('roomId', 'roomNumber type')
    .populate('items.itemId', 'name category')
    .sort({ processedAt: -1 })
    .limit(100)
    .lean();

  const formattedCharges = transactions.map(txn => ({
    date: txn.processedAt || txn.createdAt,
    roomNumber: txn.roomId?.roomNumber || 'Unknown',
    items: (txn.items || []).map(item => ({
      name: item.name || item.itemId?.name || 'Unknown',
      category: item.category || item.itemId?.category || 'other',
      reason: item.reason || txn.transactionType || 'charge',
      cost: Number(item.totalCost) || 0
    })),
    totalAmount: Number(txn.guestChargeAmount) || Number(txn.totalAmount) || 0
  }));

  const totalCharges = formattedCharges.reduce((sum, charge) => sum + (charge.totalAmount || 0), 0);

  res.status(200).json({
    status: 'success',
    results: formattedCharges.length,
    data: {
      charges: formattedCharges,
      totalCharges
    }
  });
}));

/**
 * Create daily check template for room
 * Returns a pre-filled template based on room inventory
 */
router.get('/template/:roomId', authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const { hotelId } = req.user;

  // Verify room belongs to user's hotel
  const room = await Room.findOne({ _id: roomId, hotelId }).lean();
  if (!room) {
    throw new ApplicationError('Room not found or access denied', 404);
  }

  // Get room inventory template
  const roomInventory = await RoomInventory.findOne({
    roomId: new mongoose.Types.ObjectId(roomId),
    isActive: true
  }).populate('items.itemId').lean();

  if (!roomInventory) {
    return res.status(404).json({
      status: 'fail',
      message: 'Room inventory not found'
    });
  }

  // Create template with expected quantities
  const template = roomInventory.items.map(item => ({
    itemId: item.itemId._id,
    itemName: item.itemId.name,
    category: item.itemId.category,
    expectedQuantity: item.expectedQuantity,
    actualQuantity: item.currentQuantity,
    condition: item.condition || 'good',
    needsReplacement: false,
    chargeGuest: false,
    replacementCost: item.itemId.guestPrice || item.itemId.replacementPrice,
    notes: ''
  }));

  res.status(200).json({
    status: 'success',
    data: {
      roomNumber: roomInventory.roomId.roomNumber,
      template,
      lastCheck: roomInventory.lastInspectionDate
    }
  });
}));

/**
 * Update daily check corrections
 * Note: This uses PUT to avoid conflict with PATCH /:id above
 */
router.put('/:checkId/corrections', authorizePolicy('dailyInventoryCheck', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { checkId } = req.params;
  const { hotelId } = req.user;
  const { items, notes, status } = req.body;

  // Verify check belongs to user's hotel
  const existingCheck = await DailyInventoryCheck.findOne({ _id: checkId, hotelId }).lean();
  if (!existingCheck) {
    throw new ApplicationError('Daily check not found', 404);
  }

  // Check staff permission
  if (req.user.role === 'staff' && existingCheck.checkedBy.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only update your own inventory checks', 403);
  }

  const updateFields = {};
  if (items) updateFields.items = items;
  if (notes !== undefined) updateFields.notes = notes;
  if (status) updateFields.status = status;

  const dailyCheck = await DailyInventoryCheck.findByIdAndUpdate(
    checkId,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).populate([
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    data: { dailyCheck }
  });
}));

/**
 * Get daily check statistics for dashboard
 */
router.get('/stats', authorizePolicy('dailyInventoryCheck', 'staffAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { period = 'week' } = req.query;

  const startDate = new Date();
  if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'month') {
    startDate.setDate(startDate.getDate() - 30);
  }

  const stats = await DailyInventoryCheck.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalChecks: { $sum: 1 },
        totalCharges: { $sum: '$totalCharges' },
        averageChargesPerCheck: { $avg: '$totalCharges' },
        checksWithIssues: {
          $sum: {
            $cond: [{ $ne: ['$overallStatus', 'excellent'] }, 1, 0]
          }
        }
      }
    }
  ]);

  const pendingReplacements = await DailyInventoryCheck.getPendingReplacements(hotelId);

  res.status(200).json({
    status: 'success',
    data: {
      period,
      stats: stats[0] || {
        totalChecks: 0,
        totalCharges: 0,
        averageChargesPerCheck: 0,
        checksWithIssues: 0
      },
      pendingReplacements: pendingReplacements.length
    }
  });
}));

export default router;