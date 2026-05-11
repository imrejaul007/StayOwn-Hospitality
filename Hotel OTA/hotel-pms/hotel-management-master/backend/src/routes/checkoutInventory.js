import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Housekeeping from '../models/Housekeeping.js';
import SupplyRequest from '../models/SupplyRequest.js';
import logger from '../utils/logger.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';
import websocketService from '../services/websocketService.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();
const objectIdSchema = Joi.string().length(24).hex();
const checkoutItemSchema = Joi.object({
  itemName: Joi.string().trim().min(1).max(120).required(),
  category: Joi.string().trim().min(1).max(80).required(),
  quantity: Joi.number().min(1).max(1000).required(),
  unitPrice: Joi.number().min(0).max(1000000).required(),
  status: Joi.string().valid('intact', 'used', 'missing', 'damaged', 'consumed').required(),
  notes: Joi.string().allow('').max(500).optional()
});
const createCheckoutInventorySchema = Joi.object({
  bookingId: objectIdSchema.required(),
  roomId: objectIdSchema.required(),
  items: Joi.array().items(checkoutItemSchema).max(200).required(),
  notes: Joi.string().allow('').max(1000).optional()
}).required();
const updateCheckoutInventorySchema = Joi.object({
  items: Joi.array().items(checkoutItemSchema).max(200).optional(),
  status: Joi.string().valid('pending', 'completed', 'paid').optional(),
  notes: Joi.string().allow('').max(1000).optional()
}).min(1).required();
const paymentCheckoutInventorySchema = Joi.object({
  paymentMethod: Joi.string().valid('cash', 'card', 'upi', 'bank_transfer').required(),
  notes: Joi.string().allow('').max(1000).optional()
}).required();
const emptyBodySchema = Joi.object({}).max(0).optional();

// All routes require authentication
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /api/v1/checkout-inventory/booking/{bookingId}:
 *   get:
 *     summary: Get checkout inventory check by booking ID
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Checkout inventory check for booking
 */
router.get('/booking/:bookingId', authorizePolicy('checkoutInventory', 'staffAccess'), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.bookingId)) {
    throw new ApplicationError('Checkout inventory check not found for this booking', 404);
  }

  const checkoutInventory = await CheckoutInventory.findOne({
    bookingId: req.params.bookingId,
    hotelId: req.user.hotelId
  }).populate([
    {
      path: 'bookingId',
      select: 'bookingNumber checkIn checkOut totalAmount userId',
      populate: { path: 'userId', select: 'name email' }
    },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  if (!checkoutInventory) {
    throw new ApplicationError('Checkout inventory check not found for this booking', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory:
 *   post:
 *     summary: Create a new checkout inventory check
 *     tags: [Checkout Inventory]
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
 *               - items
 *             properties:
 *               bookingId:
 *                 type: string
 *               roomId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemName:
 *                       type: string
 *                     category:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     status:
 *                       type: string
 *                     notes:
 *                       type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Checkout inventory check created successfully
 */
router.post('/', authorizePolicy('checkoutInventory', 'staffAccess'), validate(createCheckoutInventorySchema), catchAsync(async (req, res) => {
  const { bookingId, roomId, items, notes } = req.body;
  const { _id: checkedBy, hotelId } = req.user;

  logger.debug('Creating checkout inventory', { bookingId, roomId, itemsCount: items?.length });

  // Hotel-scoped booking lookup
  const booking = await Booking.findOne({ _id: bookingId, hotelId }).lean();
  if (!booking) {
    logger.debug('Booking not found for checkout inventory', { bookingId });
    throw new ApplicationError('Booking not found', 404);
  }

  logger.debug('Booking found for checkout inventory', { id: booking._id, status: booking.status });

  if (booking.status !== 'checked_in') {
    logger.debug('Invalid booking status for checkout inventory', { status: booking.status });
    throw new ApplicationError('Booking must be checked in to perform inventory check', 400);
  }

  // Duplicate guard: only one checkout inventory per booking+room
  const existing = await CheckoutInventory.findOne({ bookingId, roomId, hotelId }).lean();
  if (existing) {
    throw new ApplicationError('A checkout inventory check already exists for this booking and room', 409);
  }

  // Verify room exists and belongs to the booking
  const room = await Room.findById(roomId).lean();
  if (!room) {
    throw new ApplicationError('Room not found', 404);
  }

  const bookingRoom = booking.rooms.find(r => r.roomId.toString() === roomId);
  if (!bookingRoom) {
    throw new ApplicationError('Room does not belong to this booking', 400);
  }

  // Calculate total price for each item
  const processedItems = items.map(item => ({
    ...item,
    totalPrice: item.quantity * item.unitPrice
  }));

  logger.debug('Creating CheckoutInventory record', { bookingId, roomId, itemsCount: processedItems.length });

  const checkoutInventory = await CheckoutInventory.create({
    hotelId,
    bookingId,
    roomId,
    checkedBy,
    items: processedItems,
    notes
  });

  logger.debug('CheckoutInventory created successfully', { id: checkoutInventory._id });

  await checkoutInventory.populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory:
 *   get:
 *     summary: Get all checkout inventory checks
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *         description: Filter by booking ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of checkout inventory checks
 */
// Allowlists for checkout inventory query filter fields — prevent NoSQL operator injection.
const ALLOWED_CHECKOUT_STATUSES = ['pending', 'completed', 'paid'];
const ALLOWED_CHECKOUT_PAYMENT_STATUSES = ['unpaid', 'paid', 'partial'];

router.get('/', authorizePolicy('checkoutInventory', 'staffAccess'), catchAsync(async (req, res) => {
  const { status, paymentStatus, bookingId } = req.query;
  const { hotelId } = req.user;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 10), 100);

  // SECURITY: Validate enum filter values against allowlists to prevent NoSQL operator injection.
  if (status && !ALLOWED_CHECKOUT_STATUSES.includes(status)) {
    throw new ApplicationError('Invalid status filter value', 400);
  }
  if (paymentStatus && !ALLOWED_CHECKOUT_PAYMENT_STATUSES.includes(paymentStatus)) {
    throw new ApplicationError('Invalid paymentStatus filter value', 400);
  }
  // SECURITY: Validate bookingId as ObjectId before use in query to prevent CastError leakage.
  if (bookingId && !mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new ApplicationError('Invalid bookingId filter value', 400);
  }

  const filter = { hotelId };
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (bookingId) filter.bookingId = bookingId;

  const skip = (page - 1) * limit;

  const [checkoutInventories, total] = await Promise.all([
    CheckoutInventory.find(filter)
      .populate([
        {
          path: 'bookingId',
          select: 'bookingNumber checkIn checkOut totalAmount userId',
          populate: { path: 'userId', select: 'name email' }
        },
        { path: 'roomId', select: 'roomNumber type' },
        { path: 'checkedBy', select: 'name email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    CheckoutInventory.countDocuments(filter)
  ]);

  // hotelId is already enforced on the filter, so bookingId should never be null here.
  // Defensive filter kept for safety.
  const filteredInventories = checkoutInventories.filter(inv => inv.bookingId);

  res.status(200).json({
    status: 'success',
    data: {
      checkoutInventories: filteredInventories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/{id}:
 *   get:
 *     summary: Get checkout inventory check by ID
 *     tags: [Checkout Inventory]
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
 *         description: Checkout inventory check details
 */
router.get('/:id', authorizePolicy('checkoutInventory', 'staffAccess'), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }

  const checkoutInventory = await CheckoutInventory.findById(req.params.id)
    .populate([
      {
        path: 'bookingId',
        select: 'bookingNumber checkIn checkOut totalAmount userId',
        populate: { path: 'userId', select: 'name email' }
      },
      { path: 'roomId', select: 'roomNumber type' },
      { path: 'checkedBy', select: 'name email' }
    ]).lean();

  if (!checkoutInventory) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }

  // Tenant isolation: verify user has access to this hotel's data
  const userHotelId = req.user.hotelId?.toString();
  if (checkoutInventory.hotelId && userHotelId && checkoutInventory.hotelId.toString() !== userHotelId) {
    throw new ApplicationError('Access denied to this checkout inventory', 403);
  }

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/{id}:
 *   patch:
 *     summary: Update checkout inventory check
 *     tags: [Checkout Inventory]
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
 *               items:
 *                 type: array
 *               status:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checkout inventory check updated successfully
 */
router.patch('/:id', authorizePolicy('checkoutInventory', 'staffAccess'), validate(updateCheckoutInventorySchema), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Checkout inventory check not found or access denied', 404);
  }

  const { items, status, notes } = req.body;

  // Only allow updates on pending inventory checks to prevent overwriting completed/paid records
  const checkoutInventory = await CheckoutInventory.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId,
    status: { $in: ['pending'] }
  });

  if (!checkoutInventory) {
    // Determine specific failure reason
    const existing = await CheckoutInventory.findOne({ _id: req.params.id, hotelId: req.user.hotelId }).lean();
    if (!existing) {
      throw new ApplicationError('Checkout inventory check not found or access denied', 404);
    }
    throw new ApplicationError(`Cannot update a checkout inventory with status '${existing.status}'. Only pending records can be modified.`, 400);
  }

  if (items) {
    checkoutInventory.items = items.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice
    }));
  }

  if (status) checkoutInventory.status = status;
  if (notes !== undefined) checkoutInventory.notes = notes;

  // .save() triggers the pre-save hook that recomputes subtotal/tax/totalAmount
  await checkoutInventory.save();

  await checkoutInventory.populate([
    {
      path: 'bookingId',
      select: 'bookingNumber checkIn checkOut totalAmount userId',
      populate: { path: 'userId', select: 'name email' }
    },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/{id}/complete:
 *   post:
 *     summary: Mark checkout inventory as completed (ready for payment)
 *     tags: [Checkout Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Checkout inventory ID
 *     responses:
 *       200:
 *         description: Inventory check marked as completed
 */
router.post('/:id/complete', authorizePolicy('checkoutInventory', 'staffAccess'), validate(emptyBodySchema), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }
  // Atomic update: only update if status is 'pending'
  const checkoutInventory = await CheckoutInventory.findOneAndUpdate(
    { _id: req.params.id, hotelId: req.user.hotelId, status: 'pending' },
    { $set: { status: 'completed' } },
    { new: true, runValidators: true }
  );

  if (!checkoutInventory) {
    // Determine the reason for failure
    const existing = await CheckoutInventory.findById(req.params.id).lean();
    if (!existing) {
      throw new ApplicationError('Checkout inventory check not found', 404);
    }
    throw new ApplicationError('Only pending inventory checks can be marked as completed', 400);
  }

  // NOTE: Room status is intentionally NOT changed here. The room remains 'occupied'
  // until the guest completes payment and physically departs (handled in the /payment
  // endpoint). Marking it 'dirty' at this step would cause it to appear available
  // while the guest is still checked in.

  await checkoutInventory.populate([
    {
      path: 'bookingId',
      select: 'bookingNumber checkIn checkOut totalAmount userId',
      populate: { path: 'userId', select: 'name email' }
    },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory },
    message: 'Inventory check marked as completed. Customer can now proceed to payment.'
  });
}));

/**
 * @swagger
 * /api/v1/checkout-inventory/{id}/payment:
 *   post:
 *     summary: Process payment for checkout inventory
 *     tags: [Checkout Inventory]
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
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, upi, bank_transfer]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment processed successfully
 */
router.post('/:id/payment', authorizePolicy('checkoutInventory', 'staffAccess'), validate(paymentCheckoutInventorySchema), catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Checkout inventory check not found', 404);
  }
  const { paymentMethod, notes } = req.body;

  // Atomic update: require status=completed AND not already paid
  const updateFields = {
    paymentMethod,
    paymentStatus: 'paid',
    status: 'paid',
    paidAt: new Date()
  };
  if (notes) updateFields.notes = notes;

  const checkoutInventory = await CheckoutInventory.findOneAndUpdate(
    {
      _id: req.params.id,
      hotelId: req.user.hotelId,
      status: 'completed',
      paymentStatus: { $ne: 'paid' }
    },
    { $set: updateFields },
    { new: true, runValidators: true }
  );

  if (!checkoutInventory) {
    const existing = await CheckoutInventory.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    }).lean();
    if (!existing) {
      throw new ApplicationError('Checkout inventory check not found', 404);
    }
    if (existing.paymentStatus === 'paid') {
      throw new ApplicationError('Payment already processed', 400);
    }
    throw new ApplicationError('Inventory check must be completed before payment can be processed', 400);
  }

  // Mark room as dirty for housekeeping now that the guest has paid and left.
  // Also clear currentBookingId since the room is no longer occupied.
  if (checkoutInventory.roomId) {
    try {
      const roomId = checkoutInventory.roomId._id || checkoutInventory.roomId;
      const updatedRoom = await Room.findByIdAndUpdate(
        roomId,
        { $set: { status: 'dirty', lastCheckout: new Date() }, $unset: { currentBookingId: '' } },
        { new: true }
      ).lean();
      // Broadcast room status change so StaffRooms and housekeeping dashboards update in real-time
      if (updatedRoom) {
        try {
          websocketService.broadcastToHotel(req.user.hotelId.toString(), 'room:status_changed', {
            roomId: roomId.toString(),
            roomNumber: updatedRoom.roomNumber,
            status: 'dirty',
            reason: 'Guest checkout payment processed'
          });
        } catch (wsErr) {
          logger.warn('Failed to broadcast room status change via WebSocket after payment', { error: wsErr.message });
        }
      }

      // Auto-create housekeeping task for the dirty room if one doesn't already exist.
      // This covers the checkout-via-inventory-payment path (separate from the main
      // booking checkout path which also creates tasks).
      try {
        const existingTask = await Housekeeping.findOne({
          hotelId: req.user.hotelId,
          roomId,
          taskType: 'checkout_clean',
          status: { $in: ['pending', 'assigned', 'in_progress'] }
        }).select('_id').lean();

        if (!existingTask) {
          const roomNumber = updatedRoom?.roomNumber || 'Unknown';
          await Housekeeping.create({
            hotelId: req.user.hotelId,
            roomId,
            taskType: 'checkout_clean',
            type: 'checkout_clean',
            title: `Checkout Cleaning - Room ${roomNumber}`,
            description: `Post-checkout cleaning after inventory payment for booking ${checkoutInventory.bookingId}`,
            priority: 'high',
            status: 'pending',
            estimatedDuration: 30,
            notes: `Auto-created on checkout inventory payment`
          });
          logger.info('Auto-created housekeeping task via checkout inventory payment', { roomId: roomId.toString() });
        }
      } catch (hkErr) {
        logger.warn('Failed to auto-create housekeeping task after checkout payment', { error: hkErr.message });
      }
    } catch (err) {
      logger.warn('Failed to update room status to dirty after checkout payment', { error: err.message });
    }
  }

  // Update booking status to checked out. Only transition from checked_in to avoid
  // overwriting a status already set by the main checkout endpoint.
  const booking = await Booking.findOneAndUpdate(
    { _id: checkoutInventory.bookingId, status: 'checked_in' },
    {
      $set: {
        status: 'checked_out',
        checkOutTime: new Date(),
        'lastStatusChange.from': 'checked_in',
        'lastStatusChange.to': 'checked_out',
        'lastStatusChange.timestamp': new Date(),
        'lastStatusChange.reason': 'Guest checked out via inventory payment'
      }
    },
    { new: true }
  );

  // Auto-revoke all digital keys for this booking on checkout via inventory payment.
  if (booking) {
    try {
      const { default: DigitalKey } = await import('../models/DigitalKey.js');
      const revokedAt = new Date();
      const revokedReason = 'Automatic revocation on checkout (inventory payment)';
      const revokedKeys = await DigitalKey.updateMany(
        { bookingId: checkoutInventory.bookingId, status: 'active' },
        {
          $set: { status: 'revoked', revokedAt, revokedReason },
          $push: {
            accessLogs: {
              action: 'revoked',
              userId: req.user?._id || null,
              timestamp: revokedAt,
              deviceInfo: {},
              metadata: { reason: revokedReason, triggeredBy: 'checkout_inventory_payment' }
            }
          }
        }
      );
      if (revokedKeys.modifiedCount > 0) {
        logger.info(`Revoked ${revokedKeys.modifiedCount} digital keys for booking ${checkoutInventory.bookingId} on inventory checkout`);
        const guestUserId = booking.userId?.toString();
        if (guestUserId) {
          websocketService.sendToUser(guestUserId, 'digital-key:updated', {
            bookingId: checkoutInventory.bookingId,
            action: 'bulk_revoked',
            reason: 'checkout'
          });
        }
      }
    } catch (keyErr) {
      logger.warn('Failed to revoke digital keys on inventory checkout:', keyErr.message);
    }
  }

  // Broadcast booking updated event using the same normalized event name that booking
  // dashboards subscribe to (booking:updated), not the non-standard booking:checked_out.
  if (booking) {
    try {
      websocketService.broadcastToHotel(req.user.hotelId.toString(), 'booking:updated', {
        bookingId: booking._id.toString(),
        status: 'checked_out',
        action: 'checked_out',
        checkoutInventoryId: checkoutInventory._id.toString()
      });
      const guestId = booking.userId?.toString();
      if (guestId) {
        websocketService.sendToUser(guestId, 'booking:updated', {
          bookingId: booking._id,
          status: 'checked_out'
        });
      }
    } catch (wsErr) {
      logger.warn('Failed to broadcast booking checked_out event', { error: wsErr.message });
    }
  }

  // Auto-create a supply request to replace missing/damaged items found during checkout.
  // This ensures the housekeeping/inventory replenishment flow is triggered automatically
  // rather than requiring manual follow-up.
  const replacementItems = checkoutInventory.items.filter(
    item => ['missing', 'damaged'].includes(item.status)
  );
  if (replacementItems.length > 0) {
    try {
      const neededBy = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
      const supplyRequest = await SupplyRequest.create({
        hotelId: checkoutInventory.hotelId,
        requestedBy: req.user._id,
        department: 'housekeeping',
        title: `Replacement items — Checkout Room ${checkoutInventory.roomId}`,
        description: `Items found missing or damaged during guest checkout. Replacement needed for room readiness.`,
        priority: 'high',
        items: replacementItems.map(item => ({
          name: item.itemName,
          category: item.category || 'other',
          quantity: item.quantity,
          unit: 'pieces',
          estimatedCost: item.unitPrice || 0,
          description: `Status at checkout: ${item.status}${item.notes ? ` — ${item.notes}` : ''}`
        })),
        neededBy,
        justification: `Auto-generated on checkout payment. Checkout inventory ID: ${checkoutInventory._id}.`
      });
      logger.debug('Auto-created supply request for checkout replacement items on payment', {
        supplyRequestId: supplyRequest._id,
        itemCount: replacementItems.length
      });
      try {
        websocketService.broadcastToHotel(req.user.hotelId.toString(), 'supply-requests:created', { supplyRequest });
      } catch (wsErr) {
        logger.warn('Failed to broadcast auto-created replacement supply request', { error: wsErr.message });
      }
    } catch (srErr) {
      // Non-fatal — do not block payment completion
      logger.warn('Failed to auto-create supply request for checkout replacement items on payment', { error: srErr.message });
    }
  }

  // Add billing history to user account if user exists
  if (booking && booking.userId) {
    await User.findByIdAndUpdate(booking.userId, {
      $push: {
        billingHistory: {
          type: 'checkout_charges',
          bookingId: checkoutInventory.bookingId,
          roomId: checkoutInventory.roomId,
          description: 'Room checkout inventory charges',
          items: checkoutInventory.items.filter(item => item.totalPrice > 0).map(item => ({
            name: item.itemName,
            category: item.category,
            status: item.status,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes
          })),
          subtotal: checkoutInventory.subtotal,
          tax: checkoutInventory.tax,
          totalAmount: checkoutInventory.totalAmount,
          paymentMethod: checkoutInventory.paymentMethod,
          paymentStatus: checkoutInventory.paymentStatus,
          paidAt: checkoutInventory.paidAt,
          checkoutInventoryId: checkoutInventory._id,
          createdAt: new Date()
        }
      }
    },
      { new: true }
    );
  }

  await checkoutInventory.populate([
    {
      path: 'bookingId',
      select: 'bookingNumber checkIn checkOut totalAmount userId',
      populate: { path: 'userId', select: 'name email' }
    },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);

  res.status(200).json({
    status: 'success',
    data: { checkoutInventory },
    message: 'Payment processed and guest checked out successfully'
  });
}));

export default router;
