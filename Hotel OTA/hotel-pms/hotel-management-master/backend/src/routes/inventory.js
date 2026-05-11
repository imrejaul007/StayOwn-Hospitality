import express from 'express';
import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

const createInventorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  sku: Joi.string().trim().min(1).max(100).required(),
  category: Joi.string().valid('linens', 'toiletries', 'cleaning', 'maintenance', 'food_beverage', 'other').required(),
  quantity: Joi.number().integer().min(0).required(),
  unit: Joi.string().valid('pieces', 'bottles', 'rolls', 'kg', 'liters', 'sets').default('pieces'),
  minimumThreshold: Joi.number().integer().min(0).required(),
  maximumCapacity: Joi.number().integer().min(1).required(),
  costPerUnit: Joi.number().min(0).optional(),
  supplier: Joi.object({
    name: Joi.string().allow('').optional(),
    contact: Joi.string().allow('').optional(),
    email: Joi.string().email({ tlds: false }).allow('').optional()
  }).optional(),
  location: Joi.object({
    building: Joi.string().allow('').optional(),
    floor: Joi.string().allow('').optional(),
    room: Joi.string().allow('').optional(),
    shelf: Joi.string().allow('').optional()
  }).optional()
}).unknown(false);

const supplyRequestSchema = Joi.object({
  itemId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  reason: Joi.string().max(500).allow('').optional()
}).unknown(false);

const updateInventorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  sku: Joi.string().trim().min(1).max(100).optional(),
  category: Joi.string().valid('linens', 'toiletries', 'cleaning', 'maintenance', 'food_beverage', 'other').optional(),
  quantity: Joi.number().integer().min(0).optional(),
  unit: Joi.string().valid('pieces', 'bottles', 'rolls', 'kg', 'liters', 'sets').optional(),
  minimumThreshold: Joi.number().integer().min(0).optional(),
  maximumCapacity: Joi.number().integer().min(1).optional(),
  costPerUnit: Joi.number().min(0).optional(),
  supplier: Joi.object({
    name: Joi.string().allow('').optional(),
    contact: Joi.string().allow('').optional(),
    email: Joi.string().email({ tlds: false }).allow('').optional()
  }).optional(),
  location: Joi.object({
    building: Joi.string().allow('').optional(),
    floor: Joi.string().allow('').optional(),
    room: Joi.string().allow('').optional(),
    shelf: Joi.string().allow('').optional()
  }).optional(),
  lastRestocked: Joi.date().iso().optional(),
  expiryDate: Joi.date().iso().optional()
}).min(1).unknown(false);

const restockInventorySchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
  costPerUnit: Joi.number().min(0).optional()
}).unknown(false);

// Get inventory stats (aggregated across ALL items, not just current page)
router.get('/stats', authenticate, ensureTenantContext, authorizePolicy('inventory', 'readWriteAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  // Admin/manager can pass hotelId query param to view a specific property's stats.
  const supervisorRoles = ['admin', 'manager'];
  const effectiveHotelId = (supervisorRoles.includes(req.user.role) && req.query.hotelId)
    ? req.query.hotelId
    : req.user.hotelId;
  if (!effectiveHotelId) {
    throw new ApplicationError('Hotel context is required', 400);
  }
  const hotelObjectId = new mongoose.Types.ObjectId(effectiveHotelId);
  const query = { isActive: true, hotelId: hotelObjectId };

  const [statsResult] = await Inventory.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        lowStock: {
          $sum: { $cond: [{ $lte: ['$quantity', '$minimumThreshold'] }, 1, 0] }
        },
        outOfStock: {
          $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] }
        },
        totalValue: {
          $sum: { $multiply: [{ $ifNull: ['$costPerUnit', 0] }, '$quantity'] }
        }
      }
    }
  ]);

  const categoryAgg = await Inventory.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);

  const categories = {};
  for (const cat of categoryAgg) {
    categories[cat._id] = cat.count;
  }

  res.json({
    status: 'success',
    data: {
      stats: {
        total: statsResult?.total || 0,
        lowStock: statsResult?.lowStock || 0,
        outOfStock: statsResult?.outOfStock || 0,
        totalValue: statsResult?.totalValue || 0,
        categories
      }
    }
  });
}));

// Get inventory items
router.get('/', authenticate, ensureTenantContext, authorizePolicy('inventory', 'readWriteAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    category,
    lowStock,
    page = 1,
    limit: rawLimit = 10
  } = req.query;

  const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 100);
  const pageNum = Math.max(parseInt(page) || 1, 1);

  // Admin/manager can pass hotelId query param to view a specific property's inventory.
  // Operational staff are always scoped to their own hotel.
  const supervisorRoles = ['admin', 'manager'];
  const effectiveHotelId = (supervisorRoles.includes(req.user.role) && req.query.hotelId)
    ? req.query.hotelId
    : req.user.hotelId;

  if (!effectiveHotelId) {
    throw new ApplicationError('Hotel context is required', 400);
  }
  const query = { isActive: true, hotelId: effectiveHotelId };

  if (category) query.category = category;

  if (lowStock === 'true') {
    query.$expr = { $lte: ['$quantity', '$minimumThreshold'] };
  }

  const skip = (pageNum - 1) * limit;

  const items = await Inventory.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean({ virtuals: true });

  const total = await Inventory.countDocuments(query);
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

  res.json({
    status: 'success',
    results: items.length,
    pagination: {
      page: pageNum,
      limit,
      total,
      pages: totalPages
    },
    data: { items }
  });
}));

// Create inventory item
router.post('/', authenticate, ensureTenantContext, authorizePolicy('inventory', 'manageAccess'), ensurePropertyAccess, validate(createInventorySchema), catchAsync(async (req, res) => {
  const itemData = {
    ...req.body,
    hotelId: req.user.hotelId
  };

  const item = await Inventory.create(itemData);

  res.status(201).json({
    status: 'success',
    data: { item }
  });
}));

// Update inventory item
router.patch('/:id', authenticate, ensureTenantContext, authorizePolicy('inventory', 'readWriteAccess'), ensurePropertyAccess, validate(updateInventorySchema), catchAsync(async (req, res) => {
  const item = await Inventory.findOneAndUpdate(
    { _id: req.params.id, hotelId: req.user.hotelId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new ApplicationError('Inventory item not found', 404);
  }

  res.json({
    status: 'success',
    data: { item }
  });
}));

// Restock inventory item atomically
router.post('/:id/restock', authenticate, ensureTenantContext, authorizePolicy('inventory', 'readWriteAccess'), ensurePropertyAccess, validate(restockInventorySchema), catchAsync(async (req, res) => {
  const { quantity, costPerUnit } = req.body;

  const update = {
    $inc: { quantity },
    $set: { lastRestocked: new Date() }
  };

  if (typeof costPerUnit === 'number') {
    update.$set.costPerUnit = costPerUnit;
  }

  const item = await Inventory.findOneAndUpdate(
    { _id: req.params.id, hotelId: req.user.hotelId, isActive: true },
    update,
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new ApplicationError('Inventory item not found', 404);
  }

  res.json({
    status: 'success',
    data: { item }
  });
}));

// Delete inventory item (soft delete)
router.delete('/:id', authenticate, ensureTenantContext, authorizePolicy('inventory', 'manageAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const item = await Inventory.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!item) {
    throw new ApplicationError('Inventory item not found', 404);
  }

  item.isActive = false;
  await item.save();

  res.json({
    status: 'success',
    data: { message: 'Inventory item deleted successfully' }
  });
}));

// Create supply request
router.post('/request', authenticate, ensureTenantContext, authorizePolicy('inventory', 'requestAccess'), ensurePropertyAccess, validate(supplyRequestSchema), catchAsync(async (req, res) => {
  const { itemId, quantity, reason } = req.body;

  // Validate quantity is a positive number
  const parsedQty = Number(quantity);
  if (!Number.isFinite(parsedQty) || parsedQty < 1) {
    throw new ApplicationError('Quantity must be a positive number (minimum 1)', 400);
  }

  // Check item exists and verify stock availability
  const existingItem = await Inventory.findOne({ _id: itemId, hotelId: req.user.hotelId, isActive: true }).lean();
  if (!existingItem) {
    throw new ApplicationError('Inventory item not found', 404);
  }

  if (existingItem.quantity < parsedQty) {
    throw new ApplicationError(
      `Insufficient stock. Available: ${existingItem.quantity} ${existingItem.unit || 'units'}, Requested: ${parsedQty}`,
      400
    );
  }

  const item = await Inventory.findOneAndUpdate(
    { _id: itemId, hotelId: req.user.hotelId },
    {
      $push: {
        requests: {
          userId: req.user._id,
          quantity: parsedQty,
          reason,
          status: 'pending'
        }
      }
    },
    { new: true, runValidators: true }
  );

  if (!item) {
    throw new ApplicationError('Inventory item not found', 404);
  }

  res.status(201).json({
    status: 'success',
    data: {
      item,
      message: 'Supply request submitted successfully'
    }
  });
}));

// Approve/reject supply request
router.patch('/request/:itemId/:requestId',
  authenticate,
  ensureTenantContext,
  authorizePolicy('inventory', 'manageAccess'),
  ensurePropertyAccess,
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { itemId, requestId } = req.params;
    const { status } = req.body; // 'approved', 'rejected', 'fulfilled'

    // Validate status value
    const validStatuses = ['approved', 'rejected', 'fulfilled'];
    if (!validStatuses.includes(status)) {
      throw new ApplicationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // First, read to get request quantity if we need to fulfill
    const existingItem = await Inventory.findOne({ _id: itemId, hotelId: req.user.hotelId }).lean();

    if (!existingItem) {
      throw new ApplicationError('Inventory item not found', 404);
    }

    const request = existingItem.requests && existingItem.requests.find(
      r => r._id.toString() === requestId
    );

    if (!request) {
      throw new ApplicationError('Request not found', 404);
    }

    // Prevent processing already-processed requests
    if (request.status !== 'pending' && request.status !== 'approved') {
      throw new ApplicationError(`Request has already been ${request.status}`, 400);
    }

    // Build atomic update
    const updateOps = {
      $set: {
        'requests.$[req].status': status,
        'requests.$[req].approvedBy': req.user._id,
        'requests.$[req].processedAt': new Date()
      }
    };

    // If fulfilled, atomically deduct inventory quantity (supply was taken from stock)
    if (status === 'fulfilled') {
      // Verify sufficient stock before deducting
      if (existingItem.quantity < request.quantity) {
        throw new ApplicationError(
          `Insufficient stock to fulfill. Available: ${existingItem.quantity}, Requested: ${request.quantity}`,
          400
        );
      }
      updateOps.$inc = { quantity: -request.quantity };
    }

    const item = await Inventory.findOneAndUpdate(
      { _id: itemId, hotelId: req.user.hotelId },
      updateOps,
      {
        new: true,
        runValidators: true,
        arrayFilters: [{ 'req._id': requestId }]
      }
    );

    res.json({
      status: 'success',
      data: { item }
    });
  })
);

export default router;
