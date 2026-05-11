import express from 'express';
import mongoose from 'mongoose';
import MaintenanceTask from '../models/MaintenanceTask.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import websocketService from '../services/websocketService.js';
import Joi from 'joi';

const router = express.Router();

const createMaintenanceSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Task title is required',
    'string.max': 'Title cannot exceed 200 characters'
  }),
  description: Joi.string().trim().max(1000).optional().allow(''),
  type: Joi.string().valid('plumbing', 'electrical', 'hvac', 'cleaning', 'carpentry', 'painting', 'appliance', 'safety', 'other').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent', 'emergency').required(),
  category: Joi.string().valid('preventive', 'corrective', 'emergency', 'inspection').default('corrective'),
  roomId: Joi.string().optional().allow(''),
  assignedTo: Joi.string().optional().allow(''),
  hotelId: Joi.string().optional(),
  dueDate: Joi.date().iso().optional(),
  estimatedDuration: Joi.number().min(0).max(9999).optional(),
  estimatedCost: Joi.number().min(0).optional(),
  notes: Joi.string().trim().max(1000).optional().allow(''),
  materials: Joi.array().items(Joi.object({
    name: Joi.string().trim().required(),
    quantity: Joi.number().min(0).required(),
    unitCost: Joi.number().min(0).optional()
  })).optional(),
  roomOutOfOrder: Joi.boolean().optional(),
  vendorRequired: Joi.boolean().optional(),
  isRecurring: Joi.boolean().optional(),
  recurringSchedule: Joi.object({
    frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly'),
    interval: Joi.number().min(1)
  }).optional()
}).unknown(false);

const updateMaintenanceSchema = Joi.object({
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold').optional(),
  assignedTo: Joi.string().optional().allow(''),
  scheduledDate: Joi.date().iso().optional(),
  actualDuration: Joi.number().min(0).optional(),
  actualCost: Joi.number().min(0).optional(),
  completionNotes: Joi.string().trim().max(1000).optional().allow(''),
  materials: Joi.array().optional(),
  images: Joi.array().optional(),
  notes: Joi.string().trim().max(1000).optional().allow(''),
  dueDate: Joi.date().iso().optional().allow(null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent', 'emergency').optional(),
  vendor: Joi.object({
    name: Joi.string().trim(),
    contact: Joi.string().trim().optional().allow(''),
    cost: Joi.number().min(0).optional()
  }).optional(),
  vendorRequired: Joi.boolean().optional()
}).unknown(false);

const assignMaintenanceSchema = Joi.object({
  assignedTo: Joi.string().required().messages({
    'string.empty': 'Staff member ID is required for assignment'
  }),
  scheduledDate: Joi.date().iso().optional(),
  notes: Joi.string().trim().max(1000).optional().allow('')
}).unknown(false);

const MAINTENANCE_STATUS_TRANSITIONS = {
  // pending → in_progress is intentionally allowed so staff can self-start an
  // unassigned task in one step (the model pre-save hook auto-assigns startedDate).
  pending: ['assigned', 'in_progress', 'cancelled', 'on_hold'],
  assigned: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['completed', 'on_hold', 'cancelled'],
  on_hold: ['assigned', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: []
};

// All routes require authentication, tenant context, and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /maintenance:
 *   post:
 *     summary: Create a new maintenance task
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - priority
 *             properties:
 *               roomId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [plumbing, electrical, hvac, cleaning, carpentry, painting, appliance, safety, other]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent, emergency]
 *               category:
 *                 type: string
 *                 enum: [preventive, corrective, emergency, inspection]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               estimatedDuration:
 *                 type: number
 *               estimatedCost:
 *                 type: number
 *               materials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitCost:
 *                       type: number
 *               roomOutOfOrder:
 *                 type: boolean
 *               isRecurring:
 *                 type: boolean
 *               recurringSchedule:
 *                 type: object
 *                 properties:
 *                   frequency:
 *                     type: string
 *                     enum: [daily, weekly, monthly, quarterly, yearly]
 *                   interval:
 *                     type: number
 *     responses:
 *       201:
 *         description: Maintenance task created successfully
 */
router.post('/', authorizePolicy('maintenance', 'staffAccess'), validate(createMaintenanceSchema), catchAsync(async (req, res) => {
  // Validate hotel access for admin users before proceeding
  if (req.user.role === 'admin' && !req.body.hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const scopedHotelId = req.user.role === 'admin'
    ? req.body.hotelId
    : (req.user.hotelId || req.tenantId);

  if (!scopedHotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  const taskData = {
    ...req.body,
    hotelId: scopedHotelId,
    reportedBy: req.user._id
  };

  // If roomId provided, verify it belongs to the hotel
  if (taskData.roomId) {
    // SECURITY: Validate roomId as ObjectId before DB lookup to prevent CastError leakage.
    if (!mongoose.Types.ObjectId.isValid(taskData.roomId)) {
      throw new ApplicationError('Invalid room ID format', 400);
    }
    const room = await Room.findById(taskData.roomId);
    if (!room || room.hotelId.toString() !== taskData.hotelId.toString()) {
      throw new ApplicationError('Invalid room for this hotel', 400);
    }

    // Check for active bookings before taking room out of order
    if (taskData.roomOutOfOrder) {
      const now = new Date();
      const activeBooking = await Booking.findOne({
        hotelId: taskData.hotelId,
        'rooms.roomId': taskData.roomId,
        status: { $in: ['checked_in'] },
        checkIn: { $lte: now },
        checkOut: { $gte: now }
      }).lean();

      if (activeBooking) {
        throw new ApplicationError(
          `Cannot take room out of order: occupied by booking ${activeBooking.bookingNumber || activeBooking._id}`,
          409
        );
      }
    }

    // Always set room status to 'maintenance' when a maintenance task is created
    // for a room, so the room is blocked from bookings and shows correctly on dashboards.
    // Only update if room is not already occupied or out_of_order.
    await Room.findOneAndUpdate(
      { _id: taskData.roomId, status: { $nin: ['occupied', 'out_of_order'] } },
      { $set: { status: 'maintenance' } },
      { new: true }
    );
  }

  const task = await MaintenanceTask.create(taskData);

  await task.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'reportedBy', select: 'name' }
  ]);

  // Broadcast before responding so the event carries the populated task
  try {
    const broadcastHotelId = task.hotelId?._id || task.hotelId;
    await websocketService.broadcastToHotel(broadcastHotelId, 'maintenance:created', { task });
    // Notify dashboards of room status change
    if (taskData.roomId) {
      await websocketService.broadcastToHotel(broadcastHotelId, 'room:status_changed', {
        roomId: taskData.roomId.toString(),
        status: 'maintenance',
        taskId: task._id,
        event: 'maintenance_created'
      });
    }
  } catch (wsError) {
    logger.warn('Failed to broadcast maintenance creation event', { error: wsError.message });
  }

  res.status(201).json({
    status: 'success',
    data: { task }
  });
}));

/**
 * @swagger
 * /maintenance:
 *   get:
 *     summary: Get maintenance tasks
 *     tags: [Maintenance]
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
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of maintenance tasks
 */
// Allowlists for maintenance query filter fields — prevent NoSQL operator injection.
const ALLOWED_MAINTENANCE_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold'];
const ALLOWED_MAINTENANCE_TYPES = ['plumbing', 'electrical', 'hvac', 'cleaning', 'carpentry', 'painting', 'appliance', 'safety', 'other'];
const ALLOWED_MAINTENANCE_PRIORITIES = ['low', 'medium', 'high', 'urgent', 'emergency'];

router.get('/', authorizePolicy('maintenance', 'staffAccess'), catchAsync(async (req, res) => {
  const {
    status,
    type,
    priority,
    assignedTo,
    roomId,
    overdue
  } = req.query;

  // Parse and clamp pagination params to prevent unbounded queries and division by zero
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  // SECURITY: Validate enum filter params against allowlists to prevent NoSQL operator injection.
  if (status && !ALLOWED_MAINTENANCE_STATUSES.includes(status)) {
    throw new ApplicationError('Invalid status filter value', 400);
  }
  if (type && !ALLOWED_MAINTENANCE_TYPES.includes(type)) {
    throw new ApplicationError('Invalid type filter value', 400);
  }
  if (priority && !ALLOWED_MAINTENANCE_PRIORITIES.includes(priority)) {
    throw new ApplicationError('Invalid priority filter value', 400);
  }
  // SECURITY: Validate assignedTo and roomId as ObjectIds before use in query.
  if (assignedTo && !mongoose.Types.ObjectId.isValid(assignedTo)) {
    throw new ApplicationError('Invalid assignedTo filter value', 400);
  }
  if (roomId && !mongoose.Types.ObjectId.isValid(roomId)) {
    throw new ApplicationError('Invalid roomId filter value', 400);
  }

  const query = {};

  // Role-based filtering — always scope by hotelId for tenant isolation
  const operationalStaffRoles = ['staff', 'housekeeping', 'maintenance'];
  if (operationalStaffRoles.includes(req.user.role)) {
    query.hotelId = req.user.hotelId;
    // Apply filters first so we know the requested status before deciding visibility rules
    if (status) query.status = status;
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (roomId) query.roomId = roomId;

    // For overdue filter, accept any non-terminal status within the hotel
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $in: ['pending', 'assigned', 'in_progress'] };
    }

    // Pending tasks are visible to all staff in the hotel (anyone can pick them up).
    // Non-pending tasks are restricted to the assigned staff member.
    const requestedStatus = query.status;
    const isPendingOnlyQuery =
      requestedStatus === 'pending' ||
      (Array.isArray(requestedStatus?.$in) &&
        requestedStatus.$in.every((s) => s === 'pending'));

    if (!isPendingOnlyQuery) {
      // Show tasks assigned to this staff member OR pending tasks (so they always see what they can pick up)
      query.$or = [
        { assignedTo: req.user._id },
        { status: 'pending' }
      ];
    }
    // If querying only pending tasks, no assignedTo filter — any staff can see them
  } else {
    // For admin/manager/frontdesk: use query param or fall back to user's hotelId.
    // SECURITY: Validate the client-supplied hotelId to prevent CastError leakage.
    const rawQueryHotelId = req.query.hotelId;
    if (rawQueryHotelId && !mongoose.Types.ObjectId.isValid(rawQueryHotelId)) {
      throw new ApplicationError('Invalid hotel ID format', 400);
    }
    query.hotelId = rawQueryHotelId || req.user.hotelId;

    // Apply filters
    if (status) query.status = status;
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (roomId) query.roomId = roomId;

    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $in: ['pending', 'assigned', 'in_progress'] };
    }
  }

  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    MaintenanceTask.find(query)
      .populate('hotelId', 'name')
      .populate('roomId', 'roomNumber type floor')
      .populate('assignedTo', 'name')
      .populate('reportedBy', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    MaintenanceTask.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      tasks,
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
 * /maintenance/stats:
 *   get:
 *     summary: Get maintenance statistics
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
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
 *         description: Maintenance statistics
 */
router.get('/stats', authorizePolicy('maintenance', 'staffAccess'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const operationalRoles = ['staff', 'housekeeping', 'maintenance'];
  // SECURITY: Validate client-supplied hotelId to prevent CastError leakage.
  if (!operationalRoles.includes(req.user.role) && req.query.hotelId && !mongoose.Types.ObjectId.isValid(req.query.hotelId)) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  const hotelId = operationalRoles.includes(req.user.role) ? req.user.hotelId : (req.query.hotelId || req.user.hotelId);
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [stats, overdueTasks, upcomingRecurring] = await Promise.all([
    MaintenanceTask.getMaintenanceStats(hotelId, startDate, endDate),
    MaintenanceTask.getOverdueTasks(hotelId),
    MaintenanceTask.getUpcomingRecurringTasks(hotelId, 30)
  ]);

  // Get overall summary
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    ...(startDate && endDate ? {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    } : {})
  };

  const overallStats = await MaintenanceTask.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        avgDuration: {
          $avg: {
            $cond: [
              { $and: [
                { $ne: ['$actualDuration', null] },
                { $gt: ['$actualDuration', 0] }
              ]},
              '$actualDuration',
              null
            ]
          }
        },
        totalCost: { $sum: '$actualCost' },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        assigned: {
          $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        emergencyTasks: {
          $sum: { $cond: [{ $eq: ['$priority', 'emergency'] }, 1, 0] }
        }
      }
    }
  ]);

  const statsData = overallStats[0] || {
    total: 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    avgDuration: 0,
    totalCost: 0
  };

  // Add overdue count to stats
  statsData.overdueCount = overdueTasks.length;

  res.json({
    status: 'success',
    data: {
      ...statsData,
      byType: stats,
      overdueTasks: overdueTasks.length,
      upcomingRecurring: upcomingRecurring.length,
      overdueDetails: overdueTasks.slice(0, 10), // First 10 overdue tasks
      upcomingDetails: upcomingRecurring.slice(0, 10) // First 10 upcoming tasks
    }
  });
}));

/**
 * @swagger
 * /maintenance/available-staff:
 *   get:
 *     summary: Get available staff members for task assignment
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available staff members
 */
router.get('/available-staff', authorizePolicy('maintenance', 'staffAccess'), catchAsync(async (req, res) => {
  const operationalRoles = ['staff', 'housekeeping', 'maintenance'];
  // SECURITY: Validate client-supplied hotelId to prevent CastError leakage.
  if (!operationalRoles.includes(req.user.role) && req.query.hotelId && !mongoose.Types.ObjectId.isValid(req.query.hotelId)) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  const hotelId = operationalRoles.includes(req.user.role) ? req.user.hotelId : (req.query.hotelId || req.user.hotelId);
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Get staff members (all roles that perform maintenance work) from the same hotel
  const User = mongoose.model('User');
  const staffMembers = await User.find({
    hotelId: hotelId,
    role: { $in: ['staff', 'housekeeping', 'maintenance', 'manager'] },
    isActive: true
  }).select('_id name email department role').lean().limit(200);

  res.json({
    status: 'success',
    data: staffMembers
  });
}));

/**
 * @swagger
 * /maintenance/available-rooms:
 *   get:
 *     summary: Get available rooms for maintenance tasks
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available rooms
 */
router.get('/available-rooms', authorizePolicy('maintenance', 'staffAccess'), catchAsync(async (req, res) => {
  const operationalRoles = ['staff', 'housekeeping', 'maintenance'];
  // SECURITY: Validate client-supplied hotelId to prevent CastError leakage.
  if (!operationalRoles.includes(req.user.role) && req.query.hotelId && !mongoose.Types.ObjectId.isValid(req.query.hotelId)) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  const hotelId = operationalRoles.includes(req.user.role) ? req.user.hotelId : (req.query.hotelId || req.user.hotelId);
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Get rooms from the same hotel
  const Room = mongoose.model('Room');
  logger.debug('Looking for rooms for maintenance', { hotelId });
  const rooms = await Room.find({
    hotelId: hotelId,
    status: { $ne: 'out_of_order' } // Exclude out of order rooms
  }).select('_id roomNumber type floor').lean().limit(500);
  logger.debug('Rooms found for maintenance', { count: rooms.length });
  res.json({
    status: 'success',
    data: rooms
  });
}));

/**
 * @swagger
 * /maintenance/overdue:
 *   get:
 *     summary: Get overdue maintenance tasks
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overdue maintenance tasks
 */
router.get('/overdue', authorizePolicy('maintenance', 'staffAccess'), catchAsync(async (req, res) => {
  const operationalRoles = ['staff', 'housekeeping', 'maintenance'];
  // SECURITY: Validate client-supplied hotelId to prevent CastError leakage.
  if (!operationalRoles.includes(req.user.role) && req.query.hotelId && !mongoose.Types.ObjectId.isValid(req.query.hotelId)) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  const hotelId = operationalRoles.includes(req.user.role) ? req.user.hotelId : (req.query.hotelId || req.user.hotelId);
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // For operational staff, only show overdue tasks assigned to them
  const staffFilter = operationalRoles.includes(req.user.role) ? { assignedTo: req.user._id } : {};
  const overdueTasks = await MaintenanceTask.getOverdueTasks(hotelId, staffFilter);

  res.json({
    status: 'success',
    data: {
      tasks: overdueTasks,
      count: overdueTasks.length
    }
  });
}));

/**
 * @swagger
 * /maintenance/recurring/upcoming:
 *   get:
 *     summary: Get upcoming recurring maintenance tasks
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Upcoming recurring maintenance tasks
 */
router.get('/recurring/upcoming', authorizePolicy('maintenance', 'staffAccess'), catchAsync(async (req, res) => {
  const { days = 30 } = req.query;
  const operationalRoles = ['staff', 'housekeeping', 'maintenance'];
  // SECURITY: Validate client-supplied hotelId to prevent CastError leakage.
  if (!operationalRoles.includes(req.user.role) && req.query.hotelId && !mongoose.Types.ObjectId.isValid(req.query.hotelId)) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  const hotelId = operationalRoles.includes(req.user.role) ? req.user.hotelId : (req.query.hotelId || req.user.hotelId);
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // For operational staff, only show upcoming tasks assigned to them
  const staffFilter = operationalRoles.includes(req.user.role) ? { assignedTo: req.user._id } : {};
  const upcomingTasks = await MaintenanceTask.getUpcomingRecurringTasks(hotelId, parseInt(days), staffFilter);

  res.json({
    status: 'success',
    data: {
      tasks: upcomingTasks,
      count: upcomingTasks.length
    }
  });
}));

/**
 * @swagger
 * /maintenance/{id}:
 *   get:
 *     summary: Get specific maintenance task
 *     tags: [Maintenance]
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
 *         description: Maintenance task details
 */
router.get('/:id([0-9a-fA-F]{24})', authorizePolicy('maintenance', 'staffAccess'), catchAsync(async (req, res) => {
  const taskQuery = { _id: req.params.id };

  // Always scope by hotelId for tenant isolation — admins are still scoped if hotelId is set
  if (req.user.hotelId) {
    taskQuery.hotelId = req.user.hotelId;
  }

  // Operational staff can only view tasks assigned to them
  const operationalStaffRoles = ['staff', 'housekeeping', 'maintenance'];
  if (operationalStaffRoles.includes(req.user.role)) {
    // Allow viewing if task is assigned to them OR if task is unassigned (so they can pick it up)
    taskQuery.$or = [
      { assignedTo: req.user._id },
      { assignedTo: { $exists: false } },
      { assignedTo: null }
    ];
  }

  const task = await MaintenanceTask.findOne(taskQuery)
    .populate('hotelId', 'name contact')
    .populate('roomId', 'roomNumber type floor amenities')
    .populate('assignedTo', 'name email phone')
    .populate('reportedBy', 'name email').lean();

  if (!task) {
    throw new ApplicationError('Maintenance task not found', 404);
  }

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * @swagger
 * /maintenance/{id}:
 *   patch:
 *     summary: Update maintenance task
 *     tags: [Maintenance]
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
 *               assignedTo:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               actualDuration:
 *                 type: number
 *               actualCost:
 *                 type: number
 *               completionNotes:
 *                 type: string
 *               materials:
 *                 type: array
 *               images:
 *                 type: array
 *     responses:
 *       200:
 *         description: Task updated successfully
 */
router.patch('/:id([0-9a-fA-F]{24})', authorizePolicy('maintenance', 'staffAccess'), validate(updateMaintenanceSchema), catchAsync(async (req, res) => {
  const { id } = req.params;
  logger.debug('Updating maintenance task', { id });

  // SECURITY: Scope the initial lookup by hotelId to prevent cross-tenant information
  // disclosure (a bare findById leaks task existence to users in other hotels via
  // the difference between a 404 "not found" and a 403 "access denied" response).
  const hotelScopeFilter = req.user.hotelId
    ? { _id: id, hotelId: req.user.hotelId }
    : { _id: id };
  const existingTask = await MaintenanceTask.findOne(hotelScopeFilter).lean();

  if (!existingTask) {
    logger.debug('Maintenance task not found', { id });
    throw new ApplicationError('Maintenance task not found', 404);
  }

  logger.debug('Maintenance task found', { taskId: existingTask._id, currentStatus: existingTask.status });

  // Check access permissions
  const operationalStaffRoles = ['staff', 'housekeeping', 'maintenance'];
  const isOperationalStaff = operationalStaffRoles.includes(req.user.role);
  if (isOperationalStaff && existingTask.assignedTo && existingTask.assignedTo.toString() !== req.user._id.toString()) {
    logger.debug('Permission denied - maintenance task assigned to another user', { taskId: id });
    throw new ApplicationError('You can only update tasks assigned to you', 403);
  }

  const allowedUpdates = [
    'status', 'assignedTo', 'scheduledDate', 'actualDuration', 'actualCost',
    'completionNotes', 'materials', 'images', 'notes', 'dueDate', 'priority',
    'vendor', 'vendorRequired'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  logger.debug('Applying maintenance task updates', { taskId: id, updateKeys: Object.keys(updates) });

  // Special handling for status updates
  if (updates.status) {
    if (updates.status !== existingTask.status) {
      // Allow operational staff to self-assign-and-start a pending task in one step:
      // pending -> in_progress is shortcut for (pending -> assigned -> in_progress)
      const isPendingToInProgress =
        existingTask.status === 'pending' && updates.status === 'in_progress';

      if (isPendingToInProgress) {
        // Validate the intermediate transitions both exist
        const pendingAllowed = MAINTENANCE_STATUS_TRANSITIONS['pending'] || [];
        const assignedAllowed = MAINTENANCE_STATUS_TRANSITIONS['assigned'] || [];
        if (!pendingAllowed.includes('assigned') || !assignedAllowed.includes('in_progress')) {
          throw new ApplicationError(
            'Invalid transition: "pending" -> "in_progress". Intermediate step not allowed.',
            400
          );
        }
        // Self-assign if no assignee provided
        if (!updates.assignedTo && !existingTask.assignedTo) {
          updates.assignedTo = req.user._id;
        }
      } else {
        const allowedTransitions = MAINTENANCE_STATUS_TRANSITIONS[existingTask.status] || [];
        if (!allowedTransitions.includes(updates.status)) {
          throw new ApplicationError(
            `Invalid transition: "${existingTask.status}" -> "${updates.status}". Allowed: ${allowedTransitions.join(', ') || 'none'}`,
            400
          );
        }
      }
    }
    if (updates.status === 'assigned' && !(updates.assignedTo || existingTask.assignedTo)) {
      throw new ApplicationError('Assigned tasks must have an assignee', 400);
    }
    updates.updatedAt = new Date();
    if (updates.status === 'in_progress' && !existingTask.startedDate) {
      updates.startedDate = new Date();
      updates.assignedTo = updates.assignedTo || existingTask.assignedTo || req.user._id;
    } else if (updates.status === 'completed' && !existingTask.completedDate) {
      updates.completedDate = new Date();
      // Auto-calculate actualDuration from startedDate when completing via API
      // (findByIdAndUpdate bypasses pre-save hooks, so we do it explicitly here)
      const startedAt = existingTask.startedDate || updates.startedDate;
      if (startedAt && !updates.actualDuration) {
        updates.actualDuration = Math.round(
          (updates.completedDate.getTime() - new Date(startedAt).getTime()) / (1000 * 60)
        );
      }
    }
    logger.debug('Maintenance task status changed', { from: existingTask.status, to: updates.status });
  }

  // When completing a task linked to a room, wrap both writes in a transaction
  // to atomically update the task and restore the room status.
  let task;
  let roomStatusAfterCompletion = null;
  if (updates.status === 'completed' && existingTask.roomId) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        task = await MaintenanceTask.findByIdAndUpdate(
          id,
          { $set: updates },
          { new: true, runValidators: true, session }
        );
        // Restore room to 'vacant' only if it is currently in 'maintenance' status.
        // This covers both roomOutOfOrder tasks and regular maintenance tasks.
        const updatedRoom = await Room.findOneAndUpdate(
          { _id: task.roomId, status: 'maintenance' },
          { $set: { status: 'vacant' } },
          { session, new: true }
        );
        if (updatedRoom) {
          roomStatusAfterCompletion = 'vacant';
        }
      });
    } finally {
      session.endSession();
    }
    logger.debug('Maintenance task and room status updated atomically');
  } else {
    task = await MaintenanceTask.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
  }
  logger.debug('Maintenance task saved successfully');

  await task.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'assignedTo', select: 'name' }
  ]);

  logger.debug('Maintenance task update completed', { taskId: task._id, newStatus: task.status });

  // Broadcast before responding so the event carries the populated task
  try {
    const broadcastHotelId = task.hotelId?._id || task.hotelId;
    await websocketService.broadcastToHotel(broadcastHotelId, 'maintenance:updated', { task });
    if (updates.status) {
      await websocketService.broadcastToHotel(broadcastHotelId, 'maintenance:status_changed', {
        task,
        status: updates.status
      });
    }
    // Broadcast room status change when maintenance completes and room is restored
    if (roomStatusAfterCompletion && existingTask.roomId) {
      await websocketService.broadcastToHotel(broadcastHotelId, 'room:status_changed', {
        roomId: existingTask.roomId.toString(),
        status: roomStatusAfterCompletion,
        taskId: task._id,
        event: 'maintenance_completed'
      });
    }
  } catch (wsError) {
    logger.warn('Failed to broadcast maintenance update event', { error: wsError.message });
  }

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * @swagger
 * /maintenance/{id}/assign:
 *   post:
 *     summary: Assign maintenance task to staff member
 *     tags: [Maintenance]
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
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task assigned successfully
 */
router.post('/:id([0-9a-fA-F]{24})/assign', authorizePolicy('maintenance', 'staffAccess'), validate(assignMaintenanceSchema), catchAsync(async (req, res) => {
  const { assignedTo, scheduledDate, notes } = req.body;

  // SECURITY: Scope by hotelId to prevent cross-tenant information disclosure
  const hotelScopeFilter = req.user.hotelId
    ? { _id: req.params.id, hotelId: req.user.hotelId }
    : { _id: req.params.id };
  const existingTask = await MaintenanceTask.findOne(hotelScopeFilter).lean();

  if (!existingTask) {
    throw new ApplicationError('Maintenance task not found', 404);
  }

  // Atomic update: assign task and set notes in one operation
  const updateFields = {
    assignedTo,
    status: 'assigned'
  };
  if (scheduledDate) updateFields.scheduledDate = scheduledDate;
  if (notes) updateFields.notes = notes;

  const task = await MaintenanceTask.findByIdAndUpdate(
    req.params.id,
    { $set: updateFields },
    { new: true, runValidators: true }
  );

  await task.populate([
    { path: 'assignedTo', select: 'name email' }
  ]);

  try {
    await websocketService.broadcastToHotel(task.hotelId?._id || task.hotelId, 'maintenance:updated', { task });
    await websocketService.broadcastToHotel(task.hotelId?._id || task.hotelId, 'maintenance:status_changed', {
      task,
      status: 'assigned'
    });
  } catch (wsError) {
    logger.warn('Failed to broadcast maintenance assignment event', { error: wsError.message });
  }

  res.json({
    status: 'success',
    message: 'Task assigned successfully',
    data: { task }
  });
}));

export default router;
