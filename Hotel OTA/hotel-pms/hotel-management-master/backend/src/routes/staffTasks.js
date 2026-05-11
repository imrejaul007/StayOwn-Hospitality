import express from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import StaffTask from '../models/StaffTask.js';
import Room from '../models/Room.js';
import InventoryItem from '../models/InventoryItem.js';
import inventoryNotificationService from '../services/inventoryNotificationService.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require authentication
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * Get staff member's tasks
 */
router.get('/my-tasks', authorizePolicy('staffTasks', 'staffAccess'), catchAsync(async (req, res) => {
  const {
    status,
    taskType,
    priority,
    dueDate,
  } = req.query;

  // SECURITY: Hard-cap pagination params to prevent unbounded data fetch.
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = Math.max(0, parseInt(req.query.skip) || 0);

  const tasks = await StaffTask.getStaffTasks(req.user._id, {
    hotelId: req.user.hotelId,
    status,
    taskType,
    priority,
    dueDate,
    limit,
    skip
  });

  res.json({
    status: 'success',
    results: tasks.length,
    data: { tasks }
  });
}));

/**
 * Get today's tasks for staff member
 */
router.get('/today', authorizePolicy('staffTasks', 'staffAccess'), catchAsync(async (req, res) => {
  const tasks = await StaffTask.getTodaysTasks(req.user._id, req.user.hotelId);

  res.json({
    status: 'success',
    results: tasks.length,
    data: { tasks }
  });
}));

/**
 * Get overdue tasks for hotel (admin only)
 * MUST be registered before /:taskId to prevent 'overdue' matching the param route
 */
router.get('/overdue', authorizePolicy('staffTasks', 'adminAccess'), catchAsync(async (req, res) => {
  const tasks = await StaffTask.getOverdueTasks(req.user.hotelId);

  res.json({
    status: 'success',
    results: tasks.length,
    data: { tasks }
  });
}));

/**
 * Get task statistics for hotel (admin only)
 * MUST be registered before /:taskId to prevent 'stats' matching the param route
 */
router.get('/stats', authorizePolicy('staffTasks', 'adminAccess'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const stats = await StaffTask.getTaskStats(req.user.hotelId, startDate, endDate);

  res.json({
    status: 'success',
    data: { stats: stats[0] || {} }
  });
}));

/**
 * Get specific task details
 */
router.get('/:taskId', authorizePolicy('staffTasks', 'staffAccess'), catchAsync(async (req, res) => {
  // SECURITY: Validate taskId is a valid ObjectId before hitting MongoDB to prevent
  // CastError stack-trace leakage and potential injection via malformed IDs.
  if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
    throw new ApplicationError('Task not found', 404);
  }

  const userHotelId = req.user.hotelId?.toString();

  // Scope task lookup to the user's hotel first to prevent cross-tenant IDOR
  const task = await StaffTask.findOne({
    _id: req.params.taskId,
    hotelId: userHotelId
  })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('roomIds', 'roomNumber type floor status')
    .populate('inventoryItems.itemId', 'name category unitPrice stockThreshold')
    .populate('verifiedBy', 'name email').lean();

  // Return 404 (not 403) to avoid leaking existence of cross-hotel tasks
  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  // Staff can only view tasks assigned to them; admins see all tasks in their hotel
  if (req.user.role === 'staff' && task.assignedTo._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Task not found', 404);
  }

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Update task status
 */
router.patch('/:taskId/status', authorizePolicy('staffTasks', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  // SECURITY: Validate taskId is a valid ObjectId to prevent CastError leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
    throw new ApplicationError('Task not found', 404);
  }

  const { status, completionNotes, completionPhotos, completionData } = req.body;
  const userHotelId = req.user.hotelId?.toString();

  // Scope to user's hotel to prevent cross-tenant task manipulation
  const task = await StaffTask.findOne({ _id: req.params.taskId, hotelId: userHotelId });
  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  // Staff can only update tasks assigned to them
  if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Task not found', 404);
  }

  // Validate status transition
  const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ApplicationError('Invalid status', 400);
  }

  // Update task fields
  task.status = status;
  if (completionNotes) task.completionNotes = completionNotes;
  // SECURITY: Validate completion photo URLs — must be strings, no path traversal.
  // Only relative paths or https:// URLs from the same origin are permitted.
  if (Array.isArray(completionPhotos) && completionPhotos.length > 0) {
    const MAX_PHOTOS = 20;
    const validatedPhotos = completionPhotos
      .slice(0, MAX_PHOTOS)
      .filter((url) => {
        if (typeof url !== 'string' || url.length > 2048) return false;
        // Allow relative paths (already-uploaded files) and HTTPS URLs only.
        if (url.startsWith('/uploads/') || url.startsWith('https://')) return true;
        return false;
      });
    task.completionPhotos = validatedPhotos;
  }
  // SECURITY: completionData is spread into an existing object — restrict to known
  // safe scalar fields to prevent prototype pollution and unintended field overwrite.
  if (completionData && typeof completionData === 'object' && !Array.isArray(completionData)) {
    const ALLOWED_COMPLETION_DATA_KEYS = [
      'checklist', 'measurements', 'observations', 'repairsNeeded',
      'partsUsed', 'timeSpent', 'supervisorNotes', 'guestFeedback'
    ];
    const sanitizedCompletionData = {};
    for (const key of ALLOWED_COMPLETION_DATA_KEYS) {
      if (Object.prototype.hasOwnProperty.call(completionData, key)) {
        sanitizedCompletionData[key] = completionData[key];
      }
    }
    task.completionData = { ...task.completionData, ...sanitizedCompletionData };
  }

  // Handle specific status changes
  if (status === 'in_progress' && !task.startedAt) {
    task.startedAt = new Date();
  } else if (status === 'completed') {
    task.completedAt = new Date();

    // Calculate actual duration
    if (task.startedAt) {
      const totalMinutes = Math.floor((task.completedAt.getTime() - task.startedAt.getTime()) / (1000 * 60));
      task.actualDuration = totalMinutes - (task.pausedDuration || 0);
    }

    // Set nextOccurrence before saving so the pre-save hook sees the full state,
    // then create the next recurring task instance after the save completes.
    if (task.isRecurring && task.recurringPattern) {
      const nextDue = new Date(task.dueDate);
      switch (task.recurringPattern) {
        case 'daily':   nextDue.setDate(nextDue.getDate() + 1); break;
        case 'weekly':  nextDue.setDate(nextDue.getDate() + 7); break;
        case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break;
      }
      task.nextOccurrence = nextDue;
    }
  }

  await task.save();

  // Spawn the next recurring task after the original is persisted so there is
  // no double-save race condition on the original document.
  if (status === 'completed' && task.isRecurring) {
    await createRecurringTask(task).catch(err => {
      // Non-fatal: log but do not fail the request
      console.error('Failed to create recurring task:', err.message);
    });
  }

  // Populate for response
  await task.populate([
    { path: 'roomIds', select: 'roomNumber type' },
    { path: 'assignedTo', select: 'name email' }
  ]);

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Update task progress (for partial completion tracking)
 */
router.patch('/:taskId/progress', authorizePolicy('staffTasks', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  // SECURITY: Validate taskId is a valid ObjectId to prevent CastError leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
    throw new ApplicationError('Task not found', 404);
  }

  const { progressData } = req.body;
  const userHotelId = req.user.hotelId?.toString();

  // Do NOT use .lean() here — we need Mongoose document methods (updateProgress)
  const task = await StaffTask.findOne({ _id: req.params.taskId, hotelId: userHotelId });
  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Task not found', 404);
  }

  await task.updateProgress(progressData);

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Add completion photo to task
 */
router.post('/:taskId/photos', authorizePolicy('staffTasks', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  // SECURITY: Validate taskId is a valid ObjectId to prevent CastError leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
    throw new ApplicationError('Task not found', 404);
  }

  const { photoUrl, description } = req.body;

  // SECURITY: Validate photoUrl to prevent path traversal / SSRF via stored URLs.
  if (!photoUrl || typeof photoUrl !== 'string' || photoUrl.length > 2048) {
    throw new ApplicationError('A valid photo URL is required', 400);
  }
  if (!photoUrl.startsWith('/uploads/') && !photoUrl.startsWith('https://')) {
    throw new ApplicationError('Photo URL must be a relative upload path or an HTTPS URL', 400);
  }

  const userHotelId = req.user.hotelId?.toString();

  // Do NOT use .lean() here — we need Mongoose document methods (addCompletionPhoto)
  const task = await StaffTask.findOne({ _id: req.params.taskId, hotelId: userHotelId });
  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Task not found', 404);
  }

  await task.addCompletionPhoto(photoUrl, description);

  res.json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Create new task (admin only)
 */
router.post('/', authorizePolicy('staffTasks', 'adminAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const taskData = {
    ...req.body,
    hotelId: req.user.hotelId,
    createdBy: req.user._id
  };

  // Validate room IDs if provided
  if (taskData.roomIds && taskData.roomIds.length > 0) {
    const rooms = await Room.find({
      _id: { $in: taskData.roomIds },
      hotelId: req.user.hotelId
    }).lean().limit(1000);
    
    if (rooms.length !== taskData.roomIds.length) {
      throw new ApplicationError('Some rooms not found or don\'t belong to your hotel', 400);
    }
  }

  // Validate inventory items if provided
  if (taskData.inventoryItems && taskData.inventoryItems.length > 0) {
    const itemIds = taskData.inventoryItems.map(item => item.itemId);
    const items = await InventoryItem.find({
      _id: { $in: itemIds },
      hotelId: req.user.hotelId
    }).lean().limit(1000);
    
    if (items.length !== itemIds.length) {
      throw new ApplicationError('Some inventory items not found or don\'t belong to your hotel', 400);
    }
  }

  const task = await StaffTask.create(taskData);
  
  await task.populate([
    { path: 'assignedTo', select: 'name email' },
    { path: 'roomIds', select: 'roomNumber type' },
    { path: 'inventoryItems.itemId', select: 'name category' }
  ]);

  // Send notification to assigned staff member
  await inventoryNotificationService.notifyTaskAssignment(task);

  res.status(201).json({
    status: 'success',
    data: { task }
  });
}));

/**
 * Get all tasks for hotel (admin only)
 */
router.get('/', authorizePolicy('staffTasks', 'adminAccess'), catchAsync(async (req, res) => {
  const {
    assignedTo,
    status,
    taskType,
    priority,
    startDate,
    endDate,
  } = req.query;

  // SECURITY: Allowlist sort fields to prevent NoSQL injection via unsanitized sort param.
  const ALLOWED_SORT_FIELDS = ['createdAt', '-createdAt', 'dueDate', '-dueDate', 'priority', '-priority', 'status', '-status'];
  const rawSortBy = req.query.sortBy || '-createdAt';
  const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : '-createdAt';

  // SECURITY: Hard-cap pagination to prevent unbounded queries on large datasets.
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = Math.max(0, parseInt(req.query.skip) || 0);

  let query = { hotelId: req.user.hotelId };

  // SECURITY: Validate assignedTo as ObjectId to prevent NoSQL operator injection.
  if (assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      throw new ApplicationError('Invalid assignedTo filter value', 400);
    }
    query.assignedTo = assignedTo;
  }
  if (status) query.status = status;
  if (taskType) query.taskType = taskType;
  if (priority) query.priority = priority;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const [tasks, total] = await Promise.all([
    StaffTask.find(query)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('roomIds', 'roomNumber type')
      .sort(sortBy)
      .limit(limit)
      .skip(skip)
      .lean(),
    StaffTask.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: tasks.length,
    totalCount: total,
    data: { tasks }
  });
}));

/**
 * Delete task (admin only)
 */
router.delete('/:taskId', authorizePolicy('staffTasks', 'adminAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  // SECURITY: Validate taskId is a valid ObjectId to prevent CastError leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.taskId)) {
    throw new ApplicationError('Task not found', 404);
  }

  const task = await StaffTask.findOne({
    _id: req.params.taskId,
    hotelId: req.user.hotelId
  }).lean();

  if (!task) {
    throw new ApplicationError('Task not found', 404);
  }

  // Don't allow deletion of completed tasks with important data
  if (task.status === 'completed' && task.completionData) {
    throw new ApplicationError('Cannot delete completed tasks with completion data', 400);
  }

  await StaffTask.findByIdAndDelete(req.params.taskId);

  res.status(204).json({
    status: 'success',
    data: null
  });
}));

/**
 * Create daily inventory check tasks for all rooms
 */
router.post('/create-daily-inventory-checks', authorizePolicy('staffTasks', 'adminAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { assignedTo, dueDate = new Date() } = req.body;

  if (!assignedTo) {
    throw new ApplicationError('Staff member must be assigned', 400);
  }

  // SECURITY: Validate assignedTo as a valid ObjectId before using it in DB writes
  // to prevent CastError leakage and potential injection via malformed IDs.
  if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
    throw new ApplicationError('Invalid staff member ID', 400);
  }

  // Get all active rooms
  const rooms = await Room.find({
    hotelId: req.user.hotelId,
    isActive: true,
    status: { $nin: ['out_of_order', 'maintenance'] }
  }).lean().limit(1000);

  if (rooms.length === 0) {
    throw new ApplicationError('No available rooms for inventory checks', 400);
  }

  // Create tasks for each room or batch them
  const tasks = [];
  const roomsPerTask = 5; // Adjust based on workload
  
  for (let i = 0; i < rooms.length; i += roomsPerTask) {
    const roomBatch = rooms.slice(i, i + roomsPerTask);
    
    const task = await StaffTask.create({
      hotelId: req.user.hotelId,
      assignedTo,
      createdBy: req.user._id,
      taskType: 'daily_inventory_check',
      title: `Daily Inventory Check - Rooms ${roomBatch.map(r => r.roomNumber).join(', ')}`,
      description: `Perform daily inventory check for rooms: ${roomBatch.map(r => r.roomNumber).join(', ')}`,
      priority: 'medium',
      dueDate: new Date(dueDate),
      roomIds: roomBatch.map(r => r._id),
      estimatedDuration: roomBatch.length * 15, // 15 minutes per room
      isRecurring: true,
      recurringPattern: 'daily'
    });

    tasks.push(task);
  }

  // Populate tasks for response
  const populatedTasks = await StaffTask.find({
    _id: { $in: tasks.map(t => t._id) }
  })
  .populate('assignedTo', 'name email')
  .populate('roomIds', 'roomNumber type').lean().limit(1000);

  res.status(201).json({
    status: 'success',
    results: tasks.length,
    data: { tasks: populatedTasks }
  });
}));

// Helper function to create the next instance of a recurring task.
// The caller is responsible for setting originalTask.nextOccurrence before
// the first save; this function only creates the new document.
async function createRecurringTask(originalTask) {
  if (!originalTask.isRecurring || !originalTask.recurringPattern) return;

  // nextOccurrence was already computed and saved by the caller; use it
  // directly so we don't re-derive and risk a different value.
  const nextDue = originalTask.nextOccurrence || (() => {
    const d = new Date(originalTask.dueDate);
    switch (originalTask.recurringPattern) {
      case 'daily':   d.setDate(d.getDate() + 1); break;
      case 'weekly':  d.setDate(d.getDate() + 7); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
    }
    return d;
  })();

  const newTask = await StaffTask.create({
    hotelId: originalTask.hotelId,
    assignedTo: originalTask.assignedTo,
    createdBy: originalTask.createdBy,
    taskType: originalTask.taskType,
    title: originalTask.title,
    description: originalTask.description,
    priority: originalTask.priority,
    dueDate: nextDue,
    roomIds: originalTask.roomIds,
    inventoryItems: originalTask.inventoryItems,
    estimatedDuration: originalTask.estimatedDuration,
    isRecurring: originalTask.isRecurring,
    recurringPattern: originalTask.recurringPattern,
    tags: originalTask.tags
  });

  return newTask;
}

export default router;