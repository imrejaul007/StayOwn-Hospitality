import express from 'express';
import mongoose from 'mongoose';
import Housekeeping from '../models/Housekeeping.js';
import Room from '../models/Room.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import logger from '../utils/logger.js';
import { validateStatusTransition, HOUSEKEEPING_TRANSITIONS } from '../utils/statusTransitions.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import websocketService from '../services/websocketService.js';
import pmsOtaIntegration from '../services/pmsOtaIntegration.js';
import Joi from 'joi';

const router = express.Router();

const createTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  roomId: Joi.string().required(),
  taskType: Joi.string().valid('cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
  assignedToUserId: Joi.string().allow(null).optional(),
  assignedTo: Joi.string().allow(null).optional(),
  estimatedDuration: Joi.number().integer().min(1).max(480).optional(),
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'inspected', 'cancelled').optional()
}).unknown(true);

const updateTaskSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional(),
  roomId: Joi.string().optional(),
  taskType: Joi.string().valid('cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
  assignedToUserId: Joi.string().allow(null).optional(),
  assignedTo: Joi.string().allow(null).optional(),
  estimatedDuration: Joi.number().integer().min(1).max(480).optional(),
  actualDuration: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('pending', 'assigned', 'in_progress', 'completed', 'inspected', 'cancelled').optional(),
  startedAt: Joi.date().allow(null).optional(),
  completedAt: Joi.date().allow(null).optional(),
  roomStatus: Joi.string().valid('dirty', 'clean', 'inspected', 'maintenance_required').optional()
}).unknown(true);

const inspectTaskSchema = Joi.object({
  passed: Joi.boolean().required(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
  failureReasons: Joi.array().items(Joi.object({
    category: Joi.string().valid('cleanliness', 'amenities', 'damage', 'safety', 'other').optional(),
    description: Joi.string().optional(),
    severity: Joi.string().valid('minor', 'major', 'critical').optional()
  })).optional(),
  qaChecklist: Joi.array().items(Joi.object({
    item: Joi.string().optional(),
    passed: Joi.boolean().optional(),
    notes: Joi.string().allow('', null).optional()
  })).optional()
}).unknown(true);

// Allowlists for housekeeping query filter fields — prevent NoSQL operator injection.
const ALLOWED_HK_STATUSES = ['pending', 'assigned', 'in_progress', 'completed', 'inspected', 'cancelled'];
const ALLOWED_HK_TASK_TYPES = ['cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean'];
const ALLOWED_HK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Get housekeeping tasks
router.get('/', authenticate, ensureTenantContext, authorizePolicy('housekeeping', 'staffAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    status,
    roomId,
    assignedToUserId,
    taskType,
    priority,
    search,
    createdDateFrom,
    createdDateTo,
    completedDateFrom,
    completedDateTo,
    estimatedDurationMin,
    estimatedDurationMax,
    page = 1,
    limit = 20
  } = req.query;

  // SECURITY: Validate enum filter params against allowlists to prevent NoSQL operator injection.
  if (status && !ALLOWED_HK_STATUSES.includes(status)) {
    throw new ApplicationError('Invalid status filter value', 400);
  }
  if (taskType && !ALLOWED_HK_TASK_TYPES.includes(taskType)) {
    throw new ApplicationError('Invalid taskType filter value', 400);
  }
  if (priority && !ALLOWED_HK_PRIORITIES.includes(priority)) {
    throw new ApplicationError('Invalid priority filter value', 400);
  }
  // SECURITY: Validate roomId and assignedToUserId as ObjectIds.
  if (roomId && !mongoose.Types.ObjectId.isValid(roomId)) {
    throw new ApplicationError('Invalid roomId filter value', 400);
  }
  if (assignedToUserId && assignedToUserId !== 'unassigned' && !mongoose.Types.ObjectId.isValid(assignedToUserId)) {
    throw new ApplicationError('Invalid assignedToUserId filter value', 400);
  }

  // Admin and manager roles can filter by a specific hotelId query param (multi-property support).
  // Operational staff are always scoped to their own hotel via the JWT token.
  const supervisorRoles = ['admin', 'manager', 'frontdesk'];
  const requestedHotelId = req.query.hotelId;
  // SECURITY: Validate client-supplied hotelId to prevent CastError leakage.
  if (requestedHotelId && !mongoose.Types.ObjectId.isValid(requestedHotelId)) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  let hotelId;
  if (supervisorRoles.includes(req.user.role) && requestedHotelId) {
    hotelId = requestedHotelId;
  } else {
    hotelId = req.user.hotelId;
  }
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  const query = { hotelId };

  if (status) query.status = status;
  if (roomId) query.roomId = roomId;
  if (taskType) query.taskType = taskType;
  if (priority) query.priority = priority;

  // Build $and conditions to safely combine $or clauses
  const andConditions = [];

  // Staff/housekeeping roles only see their own assigned tasks unless a
  // supervisor (admin, manager, frontdesk) is requesting all tasks.
  if (!supervisorRoles.includes(req.user.role) && !assignedToUserId) {
    andConditions.push({
      $or: [
        { assignedToUserId: req.user._id },
        { assignedTo: req.user._id }
      ]
    });
  }

  if (assignedToUserId) {
    if (assignedToUserId === 'unassigned') {
      andConditions.push({
        $or: [
          { assignedToUserId: { $exists: false } },
          { assignedToUserId: null },
          { assignedTo: { $exists: false } },
          { assignedTo: null }
        ]
      });
    } else {
      // Check both field names for backward compatibility
      andConditions.push({
        $or: [
          { assignedToUserId: assignedToUserId },
          { assignedTo: assignedToUserId }
        ]
      });
    }
  }

  if (search) {
    const escapedSearch = escapeRegex(search);
    andConditions.push({
      $or: [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { notes: { $regex: escapedSearch, $options: 'i' } }
      ]
    });
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }
  
  // Date range filters
  if (createdDateFrom || createdDateTo) {
    query.createdAt = {};
    if (createdDateFrom) {
      query.createdAt.$gte = new Date(createdDateFrom);
    }
    if (createdDateTo) {
      query.createdAt.$lte = new Date(createdDateTo + 'T23:59:59.999Z');
    }
  }
  
  if (completedDateFrom || completedDateTo) {
    query.completedAt = {};
    if (completedDateFrom) {
      query.completedAt.$gte = new Date(completedDateFrom);
    }
    if (completedDateTo) {
      query.completedAt.$lte = new Date(completedDateTo + 'T23:59:59.999Z');
    }
  }
  
  // Duration range filters
  if (estimatedDurationMin || estimatedDurationMax) {
    query.estimatedDuration = {};
    if (estimatedDurationMin) {
      query.estimatedDuration.$gte = parseInt(estimatedDurationMin);
    }
    if (estimatedDurationMax) {
      query.estimatedDuration.$lte = parseInt(estimatedDurationMax);
    }
  }

  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const skip = (safePage - 1) * safeLimit;

  const [tasks, total] = await Promise.all([
    Housekeeping.find(query)
      .populate('roomId', 'roomNumber type floor')
      .populate('assignedToUserId', 'name')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Housekeeping.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: tasks.length,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    },
    data: { tasks }
  });
}));

// Create housekeeping task
router.post('/', authenticate, ensureTenantContext, authorizePolicy('housekeeping', 'staffAccess'), ensurePropertyAccess, validate(createTaskSchema), catchAsync(async (req, res) => {
  // Admin/manager may pass an explicit hotelId in the body for multi-property support.
  // Operational staff are always scoped to their own hotel from the JWT.
  const supervisorRoles = ['admin', 'manager'];
  const hotelId = (supervisorRoles.includes(req.user.role) && req.body.hotelId)
    ? req.body.hotelId
    : req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  logger.debug('Received housekeeping task creation request', { hotelId });

  const taskData = {
    ...req.body,
    hotelId
  };

  logger.debug('Final housekeeping task data prepared', { title: taskData.title, roomId: taskData.roomId });

  const task = await Housekeeping.create(taskData);

  await task.populate('roomId', 'roomNumber type');

  logger.debug('Housekeeping task created', { taskId: task._id });

  // Real-time WebSocket notification for new housekeeping task
  try {
    await websocketService.broadcastToHotel(hotelId, 'housekeeping:task_created', {
      task,
      createdBy: req.user?._id
    });
    // Notify assigned staff member if one was specified
    if (taskData.assignedToUserId || taskData.assignedTo) {
      const assigneeId = taskData.assignedToUserId || taskData.assignedTo;
      await websocketService.sendToUser(assigneeId.toString(), 'housekeeping:task_assigned', {
        task,
        assignedToName: req.user?.name
      });
    }
  } catch (wsError) {
    logger.warn('Failed to send housekeeping WebSocket notification', { error: wsError.message });
  }

  res.status(201).json({
    status: 'success',
    data: { task }
  });
}));

// --- Literal routes BEFORE /:id catch-all ---

// Get task statistics
router.get('/stats', authenticate, ensureTenantContext, authorizePolicy('housekeeping', 'staffAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const supervisorRoles = ['admin', 'manager', 'frontdesk'];
  const requestedHotelId = req.query.hotelId;
  // SECURITY: Validate client-supplied hotelId to prevent CastError leakage.
  if (requestedHotelId && !mongoose.Types.ObjectId.isValid(requestedHotelId)) {
    throw new ApplicationError('Invalid hotel ID format', 400);
  }
  const hotelId = (supervisorRoles.includes(req.user.role) && requestedHotelId)
    ? requestedHotelId
    : req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  const stats = await Housekeeping.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: {
          $avg: {
            $cond: [
              { $and: ['$startedAt', '$completedAt'] },
              { $subtract: ['$completedAt', '$startedAt'] },
              null
            ]
          }
        }
      }
    }
  ]);

  // Format average duration from milliseconds to minutes
  const formattedStats = stats.map(stat => ({
    ...stat,
    avgDuration: stat.avgDuration ? Math.round(stat.avgDuration / (1000 * 60)) : null
  }));

  res.json({
    status: 'success',
    data: { stats: formattedStats }
  });
}));

// --- Parameterised routes ---

// Get single housekeeping task
router.get('/:id', authenticate, ensureTenantContext, authorizePolicy('housekeeping', 'staffAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApplicationError('Invalid task ID format', 400);
  }

  const task = await Housekeeping.findOne({ _id: id, hotelId })
    .populate('roomId', 'roomNumber type floor')
    .populate('assignedToUserId', 'name')
    .populate('assignedTo', 'name')
    .lean();

  if (!task) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  res.json({
    status: 'success',
    data: { task }
  });
}));

// Update housekeeping task
router.patch('/:id', authenticate, ensureTenantContext, authorizePolicy('housekeeping', 'staffAccess'), ensurePropertyAccess, validate(updateTaskSchema), catchAsync(async (req, res) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  const updateData = req.body;

  logger.debug('Updating housekeeping task', { id });

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.debug('Invalid ObjectId format for housekeeping task', { id });
    throw new ApplicationError('Invalid task ID format', 400);
  }

  const existingTask = await Housekeeping.findOne({ _id: id, hotelId })
    .select('status startedAt assignedToUserId assignedTo').lean();
  if (!existingTask) {
    logger.debug('Housekeeping task not found', { id });
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  if (updateData.status && updateData.status !== existingTask.status) {
    const transition = validateStatusTransition(HOUSEKEEPING_TRANSITIONS, existingTask.status, updateData.status);
    if (!transition.valid) {
      throw new ApplicationError(transition.error, 400);
    }
  }

  // If task is being started, set startedAt and self-assign if unassigned
  if (updateData.status === 'in_progress') {
    if (!updateData.startedAt) {
      updateData.startedAt = new Date();
    }
    // Self-assign to current user when picking up an unassigned/pending task
    const isUnassigned = !existingTask.assignedToUserId && !existingTask.assignedTo;
    if (isUnassigned && !updateData.assignedToUserId && !updateData.assignedTo) {
      updateData.assignedToUserId = req.user._id;
      updateData.assignedTo = req.user._id;
    }
  }

  // If task is being completed, set completedAt and calculate actualDuration
  if (updateData.status === 'completed') {
    if (!updateData.completedAt) {
      updateData.completedAt = new Date();
    }
    // Calculate actualDuration from startedAt (prefer the existing value if already set)
    const startedAt = updateData.startedAt || existingTask.startedAt;
    if (startedAt && !updateData.actualDuration) {
      updateData.actualDuration = Math.round(
        (new Date(updateData.completedAt).getTime() - new Date(startedAt).getTime()) / (1000 * 60)
      );
    }
  }

  // If inspection failed and task is sent back to assigned, clear completedAt/actualDuration
  // so that the next completion cycle computes a fresh duration.
  if (updateData.status === 'assigned' && existingTask.status === 'completed') {
    updateData.completedAt = null;
    updateData.actualDuration = null;
  }

  const task = await Housekeeping.findOneAndUpdate(
    { _id: id, hotelId },
    updateData,
    { new: true, runValidators: true }
  ).populate('roomId assignedToUserId assignedTo');

  if (!task) {
    logger.debug('Housekeeping task not found', { id });
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  // When task is completed, mark room as actively being cleaned / pending QA.
  // Room should only become ready ('vacant') after inspection passes.
  if (updateData.status === 'completed' && task.roomId) {
    const roomId = task.roomId._id || task.roomId;
    await Room.findByIdAndUpdate(roomId, {
      $set: { status: 'cleaning', lastCleaned: new Date() }
    });
    logger.info('Room marked cleaning, pending QA inspection', {
      taskId: task._id,
      roomId: roomId.toString()
    });
  }

  logger.debug('Housekeeping task updated', { taskId: task._id });

  // Real-time WebSocket notification for housekeeping task update
  try {
    const eventName = updateData.status
      ? 'housekeeping:status_changed'
      : 'housekeeping:task_updated';
    await websocketService.broadcastToHotel(hotelId, eventName, {
      task,
      status: updateData.status,
      updatedBy: req.user?._id
    });

    // If task is completed, also broadcast normalized room status change
    if (updateData.status === 'completed' && task.roomId) {
      await websocketService.broadcastToHotel(hotelId, 'room:status_changed', {
        roomId: task.roomId._id || task.roomId,
        status: 'cleaning',
        taskId: task._id,
        event: 'housekeeping_completed'
      });
    }

    // Notify assigned staff member if assignment changed
    if (updateData.assignedToUserId || updateData.assignedTo) {
      const assigneeId = updateData.assignedToUserId || updateData.assignedTo;
      await websocketService.sendToUser(assigneeId.toString(), 'housekeeping:task_assigned', {
        task,
        assignedToName: req.user?.name
      });
    }
  } catch (wsError) {
    logger.warn('Failed to send housekeeping update WebSocket notification', { error: wsError.message });
  }

  res.json({
    status: 'success',
    data: { task }
  });

  // PMS→OTA: Emit housekeeping_status webhook (fire-and-forget)
  if (updateData.status && updateData.status !== existingTask.status) {
    try {
      const hotel = await mongoose.model('Hotel').findById(hotelId).lean();
      const room = await Room.findById(task.roomId?._id || task.roomId).lean();

      if (hotel && room) {
        await pmsOtaIntegration.emitHousekeepingStatus(
          hotel,
          room,
          existingTask.status,
          updateData.status,
          req.user,
          updateData.notes
        );
      }
    } catch (webhookErr) {
      logger.warn('[PMS→OTA] Housekeeping status webhook emission failed (non-blocking):', webhookErr.message);
    }
  }
}));

// Delete housekeeping task — restricted to supervisors (admin/manager/frontdesk)
router.delete('/:id', authenticate, ensureTenantContext, authorizePolicy('housekeeping', 'inspectAccess'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const { id } = req.params;
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApplicationError('Invalid task ID format', 400);
  }

  const task = await Housekeeping.findOneAndDelete({ _id: id, hotelId });

  if (!task) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  logger.debug('Housekeeping task deleted', { taskId: id });

  res.json({
    status: 'success',
    data: null
  });
}));

// Inspect a completed housekeeping task (QA workflow)
router.post('/:id/inspect', authenticate, ensureTenantContext, authorizePolicy('housekeeping', 'inspectAccess'), ensurePropertyAccess, validate(inspectTaskSchema), catchAsync(async (req, res) => {
  const hotelId = req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 403);
  }

  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  const task = await Housekeeping.findOne({ _id: req.params.id, hotelId });

  if (!task) {
    throw new ApplicationError('Housekeeping task not found', 404);
  }

  const { passed, rating, notes, failureReasons, qaChecklist } = req.body;

  // Determine target status based on inspection result
  const targetStatus = passed ? 'inspected' : 'assigned';
  const transition = validateStatusTransition(HOUSEKEEPING_TRANSITIONS, task.status, targetStatus);
  if (!transition.valid) {
    throw new ApplicationError(transition.error, 400);
  }

  task.inspection = {
    inspectedBy: req.user._id,
    inspectedAt: new Date(),
    passed,
    rating,
    notes,
    failureReasons: failureReasons || [],
    qaChecklist: qaChecklist || []
  };

  if (passed) {
    task.status = 'inspected';
    task.roomStatus = 'clean';
  } else {
    task.status = 'assigned';
    task.roomStatus = 'dirty';
    task.reinspectionCount = (task.reinspectionCount || 0) + 1;
  }

  await task.save();

  // Persist room state in Room model
  if (task.roomId) {
    const roomId = task.roomId._id || task.roomId;
    const roomStatus = passed ? 'vacant' : 'dirty';
    await Room.findByIdAndUpdate(roomId, { $set: { status: roomStatus } });
    logger.info(`Room status updated to ${roomStatus} after inspection`, {
      taskId: task._id, roomId: roomId.toString(), passed
    });
  }

  await task.populate([
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'inspection.inspectedBy', select: 'name' }
  ]);

  // Real-time WebSocket notification for inspection result
  try {
    await websocketService.broadcastToHotel(hotelId, 'housekeeping:status_changed', {
      task,
      status: task.status,
      inspectionPassed: passed,
      inspectedBy: req.user?._id
    });

    // Notify assigned staff member about inspection result
    const assigneeId = task.assignedToUserId || task.assignedTo;
    if (assigneeId) {
      await websocketService.sendToUser(assigneeId.toString(), 'housekeeping:task_updated', {
        task,
        inspectionPassed: passed,
        message: passed ? 'Room inspection passed' : 'Room inspection failed - re-cleaning required'
      });
    }

    // Broadcast room status change for both pass/fail with normalized room statuses.
    if (task.roomId) {
      await websocketService.broadcastToHotel(hotelId, 'room:status_changed', {
        roomId: task.roomId._id || task.roomId,
        status: passed ? 'vacant' : 'dirty',
        taskId: task._id,
        event: passed ? 'inspection_passed' : 'inspection_failed'
      });
    }
  } catch (wsError) {
    logger.warn('Failed to send housekeeping inspection WebSocket notification', { error: wsError.message });
  }

  res.json({
    status: 'success',
    data: { task }
  });
}));

export default router;