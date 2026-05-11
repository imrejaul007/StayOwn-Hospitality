import express from 'express';
import mongoose from 'mongoose';
import SupplyRequest from '../models/SupplyRequest.js';
import Inventory from '../models/Inventory.js';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import websocketService from '../services/websocketService.js';
import inventoryNotificationService from '../services/inventoryNotificationService.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();
const OBJECT_ID_PARAM = '([0-9a-fA-F]{24})';

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    return value._id ? value._id.toString() : value.toString();
  }
  return value.toString();
};

const enforceTenantHotelAccess = (req, supplyRequest, roles) => {
  if (!roles.includes(req.user?.role)) {
    return;
  }

  const userHotelId = normalizeObjectId(req.user?.hotelId);
  const requestHotelId = normalizeObjectId(supplyRequest?.hotelId);

  if (!userHotelId) {
    throw new ApplicationError('Active hotel context is required', 400);
  }

  if (!requestHotelId || requestHotelId !== userHotelId) {
    throw new ApplicationError('You can only process requests for your hotel', 403);
  }
};

// All routes require authentication
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /supply-requests:
 *   post:
 *     summary: Create a new supply request
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - department
 *               - title
 *               - items
 *               - neededBy
 *             properties:
 *               department:
 *                 type: string
 *                 enum: [housekeeping, maintenance, front_desk, food_beverage, spa, laundry, kitchen, bar, other]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent, emergency]
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     category:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     estimatedCost:
 *                       type: number
 *                     supplier:
 *                       type: string
 *               neededBy:
 *                 type: string
 *                 format: date-time
 *               justification:
 *                 type: string
 *               isRecurring:
 *                 type: boolean
 *               recurringSchedule:
 *                 type: object
 *     responses:
 *       201:
 *         description: Supply request created successfully
 */
router.post('/', authorizePolicy('supplyRequests', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const requestData = {
    ...req.body,
    hotelId: req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId,
    requestedBy: req.user._id
  };

  // Validate hotel access for admin users
  if (req.user.role === 'admin' && !req.body.hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Set department from user if not provided and user is staff
  if (req.user.role === 'staff' && !requestData.department && req.user.department) {
    requestData.department = req.user.department;
  }

  const supplyRequest = await SupplyRequest.create(requestData);
  
  await supplyRequest.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'requestedBy', select: 'name department' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { supplyRequest }
  });
  try {
    await websocketService.broadcastToHotel(supplyRequest.hotelId?._id || supplyRequest.hotelId, 'supply-requests:created', {
      supplyRequest
    });
  } catch (wsError) {
    logger.warn('Failed to broadcast supply request creation event', { error: wsError.message });
  }
}));

/**
 * @swagger
 * /supply-requests:
 *   get:
 *     summary: Get supply requests
 *     tags: [Supply Requests]
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
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: requestedBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: overdue
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of supply requests
 */
// Allowlists for supply request query filter fields — prevent NoSQL operator injection.
const ALLOWED_SUPPLY_STATUSES = ['pending', 'approved', 'rejected', 'ordered', 'partial_received', 'received', 'cancelled'];
const ALLOWED_SUPPLY_PRIORITIES = ['low', 'medium', 'high', 'urgent', 'emergency'];
const ALLOWED_SUPPLY_DEPARTMENTS = ['housekeeping', 'maintenance', 'front_desk', 'food_beverage', 'spa', 'laundry', 'kitchen', 'bar', 'other'];

router.get('/', authorizePolicy('supplyRequests', 'staffAccess'), catchAsync(async (req, res) => {
  const {
    status,
    department,
    priority,
    requestedBy,
    overdue,
    startDate,
    endDate,
    search
  } = req.query;

  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  // SECURITY: Validate enum filter values against allowlists to prevent NoSQL operator injection.
  if (status && !ALLOWED_SUPPLY_STATUSES.includes(status)) {
    throw new ApplicationError('Invalid status filter value', 400);
  }
  if (priority && !ALLOWED_SUPPLY_PRIORITIES.includes(priority)) {
    throw new ApplicationError('Invalid priority filter value', 400);
  }
  if (department && !ALLOWED_SUPPLY_DEPARTMENTS.includes(department)) {
    throw new ApplicationError('Invalid department filter value', 400);
  }
  // SECURITY: Validate requestedBy as ObjectId to prevent injection via user ID field.
  if (requestedBy && !mongoose.Types.ObjectId.isValid(requestedBy)) {
    throw new ApplicationError('Invalid requestedBy filter value', 400);
  }

  const query = {};

  // SECURITY: Always use the tenant-scoped hotelId; req.tenantId is set and validated by
  // ensureTenantContext + ensurePropertyAccess and cannot be spoofed by a client.
  if (req.tenantId) {
    query.hotelId = req.tenantId;
  } else if (req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  }

  // Staff (non-manager) can only see their own requests
  if (req.user.role === 'staff') {
    query.requestedBy = req.user._id;
  }

  // Apply filters
  if (status) query.status = status;
  if (department) query.department = department;
  if (priority) query.priority = priority;
  if (requestedBy && ['admin', 'manager'].includes(req.user.role)) {
    query.requestedBy = requestedBy;
  }

  // Full-text search on title, description and requestNumber
  if (search && typeof search === 'string' && search.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');
    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { requestNumber: searchRegex }
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Filter overdue requests
  if (overdue === 'true') {
    query.neededBy = { $lt: new Date() };
    query.status = { $in: ['pending', 'approved', 'ordered', 'partial_received'] };
  }

  const skip = (pageNum - 1) * limitNum;

  const [requests, total] = await Promise.all([
    SupplyRequest.find(query)
      .populate('hotelId', 'name')
      .populate('requestedBy', 'name email department')
      .populate('approvedBy', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SupplyRequest.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    }
  });
}));

/**
 * @swagger
 * /supply-requests/stats:
 *   get:
 *     summary: Get supply request statistics
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
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
 *         description: Supply request statistics
 */
router.get('/stats', authorizePolicy('supplyRequests', 'staffAccess'), catchAsync(async (req, res) => {
  const { department, startDate, endDate, dateFrom, dateTo } = req.query;
  const effectiveStartDate = startDate || dateFrom;
  const effectiveEndDate = endDate || dateTo;

  // SECURITY: Always use the tenant-scoped hotelId from the authenticated user to prevent
  // cross-tenant data access. req.tenantId is set by ensureTenantContext and cannot be
  // overridden by clients. Only fall back to req.query.hotelId for admin users whose
  // tenantId is already validated by ensurePropertyAccess upstream.
  const rawHotelId = req.tenantId || req.user.hotelId;
  const hotelId = typeof rawHotelId === 'object' ? (rawHotelId._id || rawHotelId) : rawHotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  if (!mongoose.Types.ObjectId.isValid(String(hotelId))) {
    throw new ApplicationError('Invalid hotel ID', 400);
  }

  const hotelObjectId = new mongoose.Types.ObjectId(String(hotelId));
  const match = { hotelId: hotelObjectId };
  if (department) {
    match.department = department;
  }
  if (effectiveStartDate || effectiveEndDate) {
    match.createdAt = {};
    if (effectiveStartDate) match.createdAt.$gte = new Date(effectiveStartDate);
    if (effectiveEndDate) match.createdAt.$lte = new Date(effectiveEndDate);
  }

  const [statusRows, overdue, valueRow, deptRows] = await Promise.all([
    SupplyRequest.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    SupplyRequest.countDocuments({
      ...match,
      neededBy: { $exists: true, $lt: new Date() },
      status: { $nin: ['received', 'cancelled'] }
    }),
    SupplyRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$totalActualCost', 0] }, 0] },
                '$totalActualCost',
                { $ifNull: ['$totalEstimatedCost', 0] }
              ]
            }
          }
        }
      }
    ]),
    SupplyRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          totalCost: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ['$totalActualCost', 0] }, 0] },
                '$totalActualCost',
                { $ifNull: ['$totalEstimatedCost', 0] }
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ])
  ]);

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    ordered: 0,
    partial_received: 0,
    received: 0,
    cancelled: 0
  };
  for (const row of statusRows) {
    if (row._id && counts[row._id] !== undefined) {
      counts[row._id] = row.count;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalValue = valueRow[0]?.totalValue || 0;

  const topCategories = deptRows.map((d) => ({
    category: d._id || 'other',
    count: d.count,
    totalCost: Math.round((d.totalCost || 0) * 100) / 100
  }));

  const allocated = totalValue > 0 ? Math.round(totalValue * 1.3 * 100) / 100 : 0;
  const spent = Math.round(totalValue * 100) / 100;
  const remaining = Math.max(0, allocated - spent);
  const utilization = allocated > 0 ? Math.round((spent / allocated) * 1000) / 10 : 0;

  res.json({
    status: 'success',
    data: {
      total,
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      ordered: counts.ordered,
      partialReceived: counts.partial_received,
      received: counts.received,
      cancelled: counts.cancelled,
      totalValue: spent,
      overdue,
      budgetUtilization: {
        allocated,
        spent,
        remaining,
        utilization
      },
      topCategories
    }
  });
}));

/**
 * @swagger
 * /supply-requests/pending-approvals:
 *   get:
 *     summary: Get pending approval requests
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending approval requests
 */
router.get('/pending-approvals', authorizePolicy('supplyRequests', 'managerAccess'), catchAsync(async (req, res) => {
  // SECURITY: For non-manager roles (e.g. admin), validate the client-supplied hotelId
  // to prevent CastError leakage and ensure it's a valid ObjectId before DB use.
  const rawHotelId = req.user.role === 'manager' ? req.user.hotelId : req.query.hotelId;
  if (rawHotelId && rawHotelId !== req.user.hotelId && !mongoose.Types.ObjectId.isValid(String(rawHotelId))) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  const hotelId = rawHotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = { hotelId, status: 'pending' };

  const [pendingRequests, total] = await Promise.all([
    SupplyRequest.find(query)
      .populate('requestedBy', 'name department')
      .sort('-priority createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SupplyRequest.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      requests: pendingRequests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    }
  });
}));

/**
 * @swagger
 * /supply-requests/overdue:
 *   get:
 *     summary: Get overdue requests
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overdue requests
 */
router.get('/overdue', authorizePolicy('supplyRequests', 'staffAccess'), catchAsync(async (req, res) => {
  // SECURITY: Use tenant-scoped hotelId validated by middleware — never trust raw query param.
  const rawHotelId = req.tenantId || req.user.hotelId;
  const hotelId = typeof rawHotelId === 'object' ? (rawHotelId._id || rawHotelId) : rawHotelId;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = {
    hotelId,
    neededBy: { $lt: new Date() },
    status: { $in: ['pending', 'approved', 'ordered', 'partial_received'] }
  };

  // Staff can only see their own overdue requests
  if (req.user.role === 'staff') {
    query.requestedBy = req.user._id;
  }

  const [overdueRequests, total] = await Promise.all([
    SupplyRequest.find(query)
      .populate('requestedBy', 'name')
      .populate('approvedBy', 'name')
      .sort('neededBy')
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SupplyRequest.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      requests: overdueRequests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}:
 *   get:
 *     summary: Get specific supply request
 *     tags: [Supply Requests]
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
 *         description: Supply request details
 */
router.get(`/:id${OBJECT_ID_PARAM}`, authorizePolicy('supplyRequests', 'staffAccess'), catchAsync(async (req, res) => {
  const supplyRequest = await SupplyRequest.findById(req.params.id)
    .populate('hotelId', 'name address contact')
    .populate('requestedBy', 'name email department')
    .populate('approvedBy', 'name email')
    .populate('items.receivedBy', 'name')
    .populate('attachments.uploadedBy', 'name').lean();

  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // SECURITY: Normalise populated/unpopulated hotelId before string comparison to prevent
  // TypeError when hotelId is an ObjectId (not a populated object) — was `hotelId._id`.
  const requestHotelId = normalizeObjectId(supplyRequest.hotelId);
  const userHotelId = req.user?.hotelId ? req.user.hotelId.toString() : null;
  if (userHotelId && requestHotelId !== userHotelId) {
    throw new ApplicationError('You can only view requests for your hotel', 403);
  }
  // Normalise populated/unpopulated requestedBy before comparison.
  const requestedById = normalizeObjectId(supplyRequest.requestedBy);
  if (req.user.role === 'staff' && requestedById !== req.user._id.toString()) {
    throw new ApplicationError('You can only view your own requests', 403);
  }

  res.json({
    status: 'success',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}:
 *   patch:
 *     summary: Update supply request
 *     tags: [Supply Requests]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *               neededBy:
 *                 type: string
 *                 format: date-time
 *               items:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supply request updated successfully
 */
router.patch(`/:id${OBJECT_ID_PARAM}`, authorizePolicy('supplyRequests', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const supplyRequest = await SupplyRequest.findById(req.params.id);

  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Enforce tenant scope for all scoped users
  const userHotelId = req.user?.hotelId ? req.user.hotelId.toString() : null;
  if (userHotelId && supplyRequest.hotelId.toString() !== userHotelId) {
    throw new ApplicationError('You can only update requests for your hotel', 403);
  }
  if (req.user.role === 'staff' && supplyRequest.requestedBy.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only update your own requests', 403);
  }

  // Don't allow updates to approved/ordered requests by regular staff
  if (['approved', 'ordered', 'received'].includes(supplyRequest.status) && req.user.role === 'staff') {
    throw new ApplicationError('Cannot update approved or processed requests', 400);
  }

  const allowedUpdates = [
    'title', 'description', 'priority', 'neededBy', 'items',
    'notes', 'justification', 'supplier', 'expectedDelivery'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  Object.assign(supplyRequest, updates);
  await supplyRequest.save();

  res.json({
    status: 'success',
    data: { supplyRequest }
  });
}));

/**
 * @swagger
 * /supply-requests/{id}/cancel:
 *   post:
 *     summary: Cancel a supply request (staff can cancel their own pending requests)
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supply request cancelled successfully
 */
router.post(`/:id${OBJECT_ID_PARAM}/cancel`, authorizePolicy('supplyRequests', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { reason } = req.body;

  const supplyRequest = await SupplyRequest.findById(req.params.id);

  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  // Tenant isolation
  const userHotelId = req.user?.hotelId ? req.user.hotelId.toString() : null;
  if (userHotelId && supplyRequest.hotelId.toString() !== userHotelId) {
    throw new ApplicationError('You can only cancel requests for your hotel', 403);
  }

  // Staff can only cancel their own requests
  if (req.user.role === 'staff' && supplyRequest.requestedBy.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only cancel your own requests', 403);
  }

  // Terminal states can never be cancelled
  const terminalStatuses = ['received', 'cancelled'];
  if (terminalStatuses.includes(supplyRequest.status)) {
    throw new ApplicationError('Request is already in a terminal state and cannot be cancelled', 400);
  }

  // Staff can only cancel their own pending requests
  // Managers/admins can cancel any non-terminal request (including ordered)
  const isManager = ['admin', 'manager', 'frontdesk'].includes(req.user.role);
  if (!isManager && !['pending', 'approved'].includes(supplyRequest.status)) {
    throw new ApplicationError('Staff can only cancel pending or approved requests', 400);
  }

  supplyRequest.status = 'cancelled';
  if (reason) supplyRequest.notes = supplyRequest.notes ? `${supplyRequest.notes}\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`;
  await supplyRequest.save();

  res.json({
    status: 'success',
    message: 'Supply request cancelled successfully',
    data: { supplyRequest }
  });

  try {
    await websocketService.broadcastToHotel(supplyRequest.hotelId?._id || supplyRequest.hotelId, 'supply-requests:status_changed', {
      supplyRequest,
      status: 'cancelled'
    });
  } catch (wsError) {
    logger.warn('Failed to broadcast supply request cancellation event', { error: wsError.message });
  }
}));

/**
 * @swagger
 * /supply-requests/{id}/approve:
 *   post:
 *     summary: Approve supply request
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               budget:
 *                 type: object
 *                 properties:
 *                   allocated:
 *                     type: number
 *     responses:
 *       200:
 *         description: Supply request approved successfully
 */
router.post(`/:id${OBJECT_ID_PARAM}/approve`, authorizePolicy('supplyRequests', 'managerAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { notes, budget } = req.body;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);
  
  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  enforceTenantHotelAccess(req, supplyRequest, ['admin', 'manager', 'frontdesk']);

  if (supplyRequest.status !== 'pending') {
    throw new ApplicationError('Only pending requests can be approved', 400);
  }

  await supplyRequest.approve(req.user._id, notes);

  if (budget) {
    supplyRequest.budget = {
      ...supplyRequest.budget,
      ...budget,
      remaining: budget.allocated - supplyRequest.totalEstimatedCost
    };
    await supplyRequest.save();
  }

  await supplyRequest.populate([
    { path: 'approvedBy', select: 'name' },
    { path: 'requestedBy', select: 'name' }
  ]);

  res.json({
    status: 'success',
    message: 'Supply request approved successfully',
    data: { supplyRequest }
  });

  // Notify the requester that their request was approved
  try {
    const requesterId = supplyRequest.requestedBy?._id || supplyRequest.requestedBy;
    const hotelId = supplyRequest.hotelId?._id || supplyRequest.hotelId;
    if (requesterId) {
      await Notification.create({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        userId: new mongoose.Types.ObjectId(requesterId),
        type: 'supply_request_approved',
        title: `Supply Request Approved: ${supplyRequest.title}`,
        message: `Your supply request "${supplyRequest.title}" (${supplyRequest.requestNumber}) has been approved.`,
        channels: ['in_app'],
        priority: 'medium',
        metadata: {
          supplyRequestId: supplyRequest._id.toString(),
          requestNumber: supplyRequest.requestNumber
        },
        isRead: false
      });
      websocketService.broadcastToHotel(hotelId.toString(), 'supply-requests:status_changed', {
        supplyRequest,
        status: supplyRequest.status
      });
    }
  } catch (notifError) {
    logger.warn('Failed to notify requester of supply request approval', { error: notifError.message });
  }
}));

/**
 * @swagger
 * /supply-requests/{id}/reject:
 *   post:
 *     summary: Reject supply request
 *     tags: [Supply Requests]
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
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Supply request rejected successfully
 */
router.post(`/:id${OBJECT_ID_PARAM}/reject`, authorizePolicy('supplyRequests', 'managerAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { reason } = req.body;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);

  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  enforceTenantHotelAccess(req, supplyRequest, ['admin', 'manager', 'frontdesk']);

  if (supplyRequest.status !== 'pending') {
    throw new ApplicationError('Only pending requests can be rejected', 400);
  }

  await supplyRequest.reject(req.user._id, reason);

  res.json({
    status: 'success',
    message: 'Supply request rejected successfully',
    data: { supplyRequest }
  });

  // Notify the requester that their request was rejected
  try {
    const requesterId = supplyRequest.requestedBy?._id || supplyRequest.requestedBy;
    const hotelId = supplyRequest.hotelId?._id || supplyRequest.hotelId;
    if (requesterId) {
      await Notification.create({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        userId: new mongoose.Types.ObjectId(requesterId),
        type: 'supply_request_rejected',
        title: `Supply Request Rejected: ${supplyRequest.title}`,
        message: `Your supply request "${supplyRequest.title}" (${supplyRequest.requestNumber}) was rejected.${reason ? ` Reason: ${reason}` : ''}`,
        channels: ['in_app'],
        priority: 'medium',
        metadata: {
          supplyRequestId: supplyRequest._id.toString(),
          requestNumber: supplyRequest.requestNumber,
          rejectedReason: reason
        },
        isRead: false
      });
      websocketService.broadcastToHotel(hotelId.toString(), 'supply-requests:status_changed', {
        supplyRequest,
        status: supplyRequest.status
      });
    }
  } catch (notifError) {
    logger.warn('Failed to notify requester of supply request rejection', { error: notifError.message });
  }
}));

/**
 * @swagger
 * /supply-requests/{id}/order:
 *   post:
 *     summary: Mark request as ordered
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               purchaseOrder:
 *                 type: object
 *                 properties:
 *                   number:
 *                     type: string
 *                   totalAmount:
 *                     type: number
 *                   url:
 *                     type: string
 *               supplier:
 *                 type: object
 *               expectedDelivery:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Request marked as ordered successfully
 */
router.post(`/:id${OBJECT_ID_PARAM}/order`, authorizePolicy('supplyRequests', 'purchasingAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { purchaseOrder, supplier, expectedDelivery } = req.body;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);
  
  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  enforceTenantHotelAccess(req, supplyRequest, ['admin', 'manager', 'frontdesk', 'purchasing']);

  if (supplyRequest.status !== 'approved') {
    throw new ApplicationError('Only approved requests can be ordered', 400);
  }

  const purchaseOrderData = purchaseOrder ? {
    ...purchaseOrder,
    date: new Date()
  } : undefined;

  await supplyRequest.markOrdered(purchaseOrderData, supplier);

  if (expectedDelivery) {
    supplyRequest.expectedDelivery = new Date(expectedDelivery);
    await supplyRequest.save();
  }

  res.json({
    status: 'success',
    message: 'Request marked as ordered successfully',
    data: { supplyRequest }
  });
  try {
    await websocketService.broadcastToHotel(supplyRequest.hotelId?._id || supplyRequest.hotelId, 'supply-requests:status_changed', {
      supplyRequest,
      status: supplyRequest.status
    });
  } catch (wsError) {
    logger.warn('Failed to broadcast supply request order event', { error: wsError.message });
  }
}));

/**
 * @swagger
 * /supply-requests/{id}/items/{itemIndex}/receive:
 *   post:
 *     summary: Mark item as received
 *     tags: [Supply Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: itemIndex
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receivedQuantity
 *             properties:
 *               receivedQuantity:
 *                 type: number
 *               condition:
 *                 type: string
 *                 enum: [excellent, good, damaged, defective]
 *               actualCost:
 *                 type: number
 *               invoiceNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item marked as received successfully
 */
router.post(`/:id${OBJECT_ID_PARAM}/items/:itemIndex/receive`, authorizePolicy('supplyRequests', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { receivedQuantity, condition, actualCost, invoiceNumber, notes } = req.body;
  const { itemIndex } = req.params;
  
  const supplyRequest = await SupplyRequest.findById(req.params.id);

  if (!supplyRequest) {
    throw new ApplicationError('Supply request not found', 404);
  }

  enforceTenantHotelAccess(req, supplyRequest, ['admin', 'manager', 'frontdesk', 'staff']);

  if (!['ordered', 'partial_received'].includes(supplyRequest.status)) {
    throw new ApplicationError('Can only receive items from ordered requests', 400);
  }

  const itemIdx = parseInt(itemIndex);
  if (itemIdx < 0 || itemIdx >= supplyRequest.items.length) {
    throw new ApplicationError('Invalid item index', 400);
  }

  // Update item with actual cost and invoice if provided
  if (actualCost !== undefined) {
    supplyRequest.items[itemIdx].actualCost = actualCost;
  }
  if (invoiceNumber) {
    supplyRequest.items[itemIdx].invoiceNumber = invoiceNumber;
  }

  const receivedItem = supplyRequest.items[itemIdx];
  const previouslyReceived = receivedItem.receivedQuantity || 0;

  await supplyRequest.receiveItem(itemIdx, receivedQuantity, condition, req.user._id, notes);

  // Update the Inventory model quantity for items actually received.
  // We increment by the net new quantity received (handles re-receives after partial).
  const netNewQty = receivedQuantity - previouslyReceived;
  if (netNewQty > 0) {
    try {
      const hotelId = supplyRequest.hotelId?._id || supplyRequest.hotelId;
      // Match by hotel + item name (case-insensitive) as there is no FK between
      // SupplyRequest items and Inventory items.
      const updatedInventoryItem = await Inventory.findOneAndUpdate(
        {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          name: { $regex: new RegExp(`^${receivedItem.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          isActive: true
        },
        { $inc: { quantity: netNewQty }, $set: { lastRestocked: new Date() } },
        { new: true }
      );

      if (updatedInventoryItem) {
        logger.debug('Inventory quantity updated after supply receipt', {
          itemName: receivedItem.name,
          addedQty: netNewQty,
          newQty: updatedInventoryItem.quantity,
          minimumThreshold: updatedInventoryItem.minimumThreshold
        });
        // If still below threshold after restocking, fire a low-stock alert
        if (updatedInventoryItem.quantity <= updatedInventoryItem.minimumThreshold) {
          inventoryNotificationService.notifyLowStock(hotelId.toString(), [{
            name: updatedInventoryItem.name,
            currentStock: updatedInventoryItem.quantity,
            stockThreshold: updatedInventoryItem.minimumThreshold,
            category: updatedInventoryItem.category
          }]).catch(e => logger.warn('Low-stock notification failed after receipt', { error: e.message }));
        }
      } else {
        logger.debug('No matching Inventory item found for received supply item — skipping quantity update', {
          itemName: receivedItem.name,
          hotelId
        });
      }
    } catch (invErr) {
      // Non-fatal — inventory sync failure must not roll back the receipt record.
      logger.warn('Failed to sync Inventory quantity after supply receipt', { error: invErr.message });
    }
  }

  res.json({
    status: 'success',
    message: 'Item marked as received successfully',
    data: {
      supplyRequest,
      completionPercentage: supplyRequest.completionPercentage
    }
  });
  try {
    await websocketService.broadcastToHotel(supplyRequest.hotelId?._id || supplyRequest.hotelId, 'supply-requests:updated', {
      supplyRequest
    });
    await websocketService.broadcastToHotel(supplyRequest.hotelId?._id || supplyRequest.hotelId, 'supply-requests:status_changed', {
      supplyRequest,
      status: supplyRequest.status
    });
  } catch (wsError) {
    logger.warn('Failed to broadcast supply request receive-item event', { error: wsError.message });
  }
}));

export default router;