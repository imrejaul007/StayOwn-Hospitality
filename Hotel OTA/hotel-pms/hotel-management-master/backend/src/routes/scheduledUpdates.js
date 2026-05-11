import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import ScheduledUpdatesService from '../services/scheduledUpdates.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import Joi from 'joi';

const router = express.Router();

router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('scheduledUpdates', 'baseAccess'));

const createScheduledUpdateSchema = Joi.object({
  scheduledFor: Joi.date().iso().required(),
  scope: Joi.string().valid('single', 'group', 'all').required(),
  propertyId: Joi.string().optional(),
  groupId: Joi.string().optional(),
  settingType: Joi.string().required(),
  settingUpdates: Joi.object().required(),
  settingName: Joi.string().max(200).optional()
});

const cancelScheduledUpdateSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

const rescheduleScheduledUpdateSchema = Joi.object({
  scheduledFor: Joi.date().iso().required()
});

/**
 * Scheduled Updates Routes
 *
 * Manage scheduled settings updates across properties.
 */

// =============================================================================
// Create Scheduled Update
// =============================================================================

/**
 * POST /api/v1/scheduled-updates
 * Schedule a new settings update
 *
 * Body:
 * {
 *   "scheduledFor": "2025-02-01T10:00:00Z",
 *   "scope": "single" | "group" | "all",
 *   "propertyId": "xxx",
 *   "groupId": "xxx",
 *   "settingType": "booking_rules",
 *   "settingUpdates": { ... },
 *   "settingName": "Check-in/out times"
 * }
 */
router.post('/',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  validate(createScheduledUpdateSchema),
  catchAsync(async (req, res) => {
    const {
      scheduledFor,
      scope,
      propertyId,
      groupId,
      settingType,
      settingUpdates,
      settingName
    } = req.body;

    // Validate required fields
    if (!scheduledFor || !scope || !settingType || !settingUpdates) {
      throw new ApplicationError('Missing required fields: scheduledFor, scope, settingType, settingUpdates', 400);
    }

    const update = await ScheduledUpdatesService.scheduleUpdate({
      scheduledFor,
      scope,
      propertyId,
      groupId,
      settingType,
      settingUpdates,
      settingName,
      userId: req.user._id,
      userName: req.user.name
    });

    res.status(201).json({
      status: 'success',
      message: 'Update scheduled successfully',
      data: { update }
    });
  })
);

// =============================================================================
// Get Scheduled Updates (with filters)
// =============================================================================

/**
 * GET /api/v1/scheduled-updates
 * Get scheduled updates with optional filters
 *
 * Query params:
 * - propertyId: string
 * - groupId: string
 * - status: pending|executing|completed|failed|cancelled
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - userId: string
 * - limit: number (default: 100)
 * - skip: number (default: 0)
 */
router.get('/',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const {
      propertyId,
      groupId,
      status,
      startDate,
      endDate,
      userId,
      limit,
      skip
    } = req.query;

    const result = await ScheduledUpdatesService.getScheduledUpdates({
      propertyId,
      groupId,
      status,
      startDate,
      endDate,
      userId,
      limit: parseInt(limit) || 100,
      skip: parseInt(skip) || 0
    });

    res.json({
      status: 'success',
      data: result
    });
  })
);

// =============================================================================
// Get Specific Scheduled Update
// =============================================================================

/**
 * GET /api/v1/scheduled-updates/:id
 * Get specific scheduled update by ID
 */
router.get('/:id',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const update = await ScheduledUpdatesService.getScheduledUpdate(req.params.id);

    res.json({
      status: 'success',
      data: { update }
    });
  })
);

// =============================================================================
// Cancel Scheduled Update
// =============================================================================

/**
 * DELETE /api/v1/scheduled-updates/:id
 * Cancel a scheduled update
 *
 * Body:
 * {
 *   "reason": "No longer needed"
 * }
 */
router.delete('/:id',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  validate(cancelScheduledUpdateSchema),
  catchAsync(async (req, res) => {
    const { reason } = req.body;

    const update = await ScheduledUpdatesService.cancelScheduledUpdate(
      req.params.id,
      req.user._id,
      reason || 'No reason provided'
    );

    res.json({
      status: 'success',
      message: 'Scheduled update cancelled',
      data: { update }
    });
  })
);

// =============================================================================
// Reschedule Update
// =============================================================================

/**
 * PUT /api/v1/scheduled-updates/:id/reschedule
 * Change the scheduled time for an update
 *
 * Body:
 * {
 *   "scheduledFor": "2025-02-15T10:00:00Z"
 * }
 */
router.put('/:id/reschedule',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  validate(rescheduleScheduledUpdateSchema),
  catchAsync(async (req, res) => {
    const { scheduledFor } = req.body;

    if (!scheduledFor) {
      throw new ApplicationError('scheduledFor is required', 400);
    }

    const update = await ScheduledUpdatesService.rescheduleUpdate(
      req.params.id,
      scheduledFor,
      req.user._id
    );

    res.json({
      status: 'success',
      message: 'Update rescheduled successfully',
      data: { update }
    });
  })
);

// =============================================================================
// Execute Scheduled Update Immediately
// =============================================================================

/**
 * POST /api/v1/scheduled-updates/:id/execute
 * Execute a scheduled update immediately (manual execution)
 */
router.post('/:id/execute',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  validate(Joi.object({})),
  catchAsync(async (req, res) => {
    const result = await ScheduledUpdatesService.executeNow(
      req.params.id,
      req.user._id
    );

    res.json({
      status: 'success',
      message: 'Update executed successfully',
      data: result
    });
  })
);

// =============================================================================
// Get Upcoming Updates
// =============================================================================

/**
 * GET /api/v1/scheduled-updates/upcoming/:hours
 * Get updates scheduled in the next X hours
 *
 * Params:
 * - hours: number (default: 24)
 */
router.get('/upcoming/:hours?',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const hours = parseInt(req.params.hours) || 24;

    const updates = await ScheduledUpdatesService.getUpcomingUpdates(hours);

    res.json({
      status: 'success',
      data: {
        hours,
        count: updates.length,
        updates
      }
    });
  })
);

// =============================================================================
// Get Updates by Property
// =============================================================================

/**
 * GET /api/v1/scheduled-updates/property/:propertyId
 * Get all scheduled updates for a specific property
 *
 * Query params:
 * - status: pending|executing|completed|failed|cancelled
 */
router.get('/property/:propertyId',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const { propertyId } = req.params;
    const { status } = req.query;

    const updates = await ScheduledUpdatesService.getUpdatesByProperty(
      propertyId,
      req.user._id,
      status || null
    );

    res.json({
      status: 'success',
      data: {
        propertyId,
        count: updates.length,
        updates
      }
    });
  })
);

// =============================================================================
// Get Statistics
// =============================================================================

/**
 * GET /api/v1/scheduled-updates/stats/summary
 * Get statistics for scheduled updates
 */
router.get('/stats/summary',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  catchAsync(async (req, res) => {
    const stats = await ScheduledUpdatesService.getStatistics(req.user._id);

    res.json({
      status: 'success',
      data: stats
    });
  })
);

export default router;
