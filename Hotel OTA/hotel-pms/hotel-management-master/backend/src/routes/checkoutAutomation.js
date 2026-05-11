import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import checkoutAutomationService from '../services/checkoutAutomationService.js';
import CheckoutAutomationConfig from '../models/CheckoutAutomationConfig.js';
import CheckoutAutomationLog from '../models/CheckoutAutomationLog.js';
import Booking from '../models/Booking.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require authentication + tenant isolation
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * tags:
 *   name: Checkout Automation
 *   description: Automatic checkout processing management
 */

/**
 * @swagger
 * /api/v1/checkout-automation/config:
 *   get:
 *     summary: Get checkout automation configuration for hotel
 *     tags: [Checkout Automation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Automation configuration retrieved successfully
 *       404:
 *         description: Configuration not found
 */
router.get('/config', authorizePolicy('checkoutAutomation', 'managerAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  let config = await CheckoutAutomationConfig.findOne({ hotelId }).lean();
  
  if (!config) {
    // Create default configuration
    config = await CheckoutAutomationConfig.createDefault(hotelId, req.user._id);
  }

  res.status(200).json({
    status: 'success',
    data: { config }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-automation/config:
 *   put:
 *     summary: Update checkout automation configuration
 *     tags: [Checkout Automation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *               isLaundryAutomationEnabled:
 *                 type: boolean
 *               isInventoryAutomationEnabled:
 *                 type: boolean
 *               isHousekeepingAutomationEnabled:
 *                 type: boolean
 *               defaultLaundryReturnDays:
 *                 type: number
 *               automaticTaskAssignment:
 *                 type: boolean
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       400:
 *         description: Invalid configuration data
 */
router.put('/config', authorizePolicy('checkoutAutomation', 'managerAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const updateData = req.body;

  const setFields = {};
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      setFields[key] = updateData[key];
    }
  });
  setFields.lastUpdatedBy = userId;

  const config = await CheckoutAutomationConfig.findOneAndUpdate(
    { hotelId },
    { $set: setFields },
    { new: true, runValidators: true, upsert: false }
  );

  if (!config) {
    // Create default config if none exists, then apply update
    const defaultConfig = await CheckoutAutomationConfig.createDefault(hotelId, userId);
    const updatedConfig = await CheckoutAutomationConfig.findOneAndUpdate(
      { hotelId },
      { $set: setFields },
      { new: true, runValidators: true }
    );
    return res.status(200).json({
      status: 'success',
      message: 'Configuration updated successfully',
      data: { config: updatedConfig || defaultConfig }
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Configuration updated successfully',
    data: { config }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-automation/status/{bookingId}:
 *   get:
 *     summary: Get automation status for a booking
 *     tags: [Checkout Automation]
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
 *         description: Automation status retrieved successfully
 *       404:
 *         description: Booking not found
 */
router.get('/status/:bookingId', authorizePolicy('checkoutAutomation', 'staffAccess'), catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const { hotelId } = req.user;

  // Verify booking belongs to hotel
  const booking = await Booking.findOne({ _id: bookingId, hotelId }).lean();
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  const status = await checkoutAutomationService.getAutomationStatus(bookingId, { hotelId });

  res.status(200).json({
    status: 'success',
    data: status
  });
}));

/**
 * @swagger
 * /api/v1/checkout-automation/process/{bookingId}:
 *   post:
 *     summary: Manually trigger checkout automation for a booking
 *     tags: [Checkout Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               forceProcessing:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Automation triggered successfully
 *       400:
 *         description: Invalid request or automation already in progress
 *       404:
 *         description: Booking not found
 */
router.post('/process/:bookingId', authorizePolicy('checkoutAutomation', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const { forceProcessing = false } = req.body;
  const { hotelId, _id: userId } = req.user;

  // Verify booking belongs to hotel and is checked out
  const booking = await Booking.findOne({ _id: bookingId, hotelId }).lean();
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  if (booking.status !== 'checked_out') {
    throw new ApplicationError('Booking must be checked out to trigger automation', 400);
  }

  const result = await checkoutAutomationService.processCheckout(bookingId, {
    processedBy: userId,
    forceProcessing,
    hotelId
  });

  res.status(200).json({
    status: 'success',
    message: result.message,
    data: result
  });
}));

/**
 * @swagger
 * /api/v1/checkout-automation/retry/{bookingId}:
 *   post:
 *     summary: Retry failed automation for a booking
 *     tags: [Checkout Automation]
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
 *         description: Automation retry triggered successfully
 *       404:
 *         description: Booking not found
 */
router.post('/retry/:bookingId', authorizePolicy('checkoutAutomation', 'staffAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const { hotelId, _id: userId } = req.user;

  // Verify booking belongs to hotel
  const booking = await Booking.findOne({ _id: bookingId, hotelId }).lean();
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  const result = await checkoutAutomationService.retryAutomation(bookingId, {
    processedBy: userId,
    hotelId
  });

  res.status(200).json({
    status: 'success',
    message: 'Automation retry triggered successfully',
    data: result
  });
}));

/**
 * @swagger
 * /api/v1/checkout-automation/dashboard:
 *   get:
 *     summary: Get automation dashboard data
 *     tags: [Checkout Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *           default: today
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard', authorizePolicy('checkoutAutomation', 'managerAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { period = 'today' } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // Get automation statistics
  const statistics = await CheckoutAutomationLog.getStatistics(hotelId, {
    start: startDate,
    end: endDate
  });

  // Get recent automation logs — use hotelId directly (denormalized field, falls back to booking join)
  const logBaseFilter = { processedAt: { $gte: startDate, $lte: endDate } };
  // Use hotelId if available on the log, fall back to booking-based filter for legacy data
  const hasHotelIdOnLogs = await CheckoutAutomationLog.findOne({ hotelId }).select('_id').lean();
  if (hasHotelIdOnLogs) {
    logBaseFilter.hotelId = hotelId;
  } else {
    // Legacy fallback: scope via booking IDs (capped for safety)
    const hotelBookingIds = await Booking.find({ hotelId })
      .select('_id')
      .lean()
      .limit(5000);
    logBaseFilter.bookingId = { $in: hotelBookingIds.map(b => b._id) };
  }

  const recentLogs = await CheckoutAutomationLog.find(logBaseFilter)
    .sort({ processedAt: -1 })
    .limit(20)
    .populate('bookingId', 'bookingNumber')
    .populate('roomId', 'roomNumber')
    .populate('initiatedBy', 'name email')
    .lean();

  // Get failed automations scoped to this hotel
  const failedFilter = {
    ...logBaseFilter,
    status: 'failed',
    processedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  };
  const failedAutomations = await CheckoutAutomationLog.find(failedFilter)
    .sort({ processedAt: -1 })
    .limit(10)
    .populate('bookingId', 'bookingNumber')
    .populate('roomId', 'roomNumber')
    .populate('initiatedBy', 'name email')
    .lean();

  // Get pending automations
  const pendingAutomations = await Booking.find({
    hotelId,
    status: 'checked_out',
    automationStatus: { $in: ['pending', 'in_progress'] }
  })
    .select('bookingNumber automationStatus automationTriggeredAt')
    .sort({ automationTriggeredAt: -1 })
    .limit(10).lean();

  res.status(200).json({
    status: 'success',
    data: {
      period,
      dateRange: { start: startDate, end: endDate },
      statistics: statistics[0] || {
        totalAutomations: 0,
        successRate: 0,
        avgProcessingTime: 0,
        statusBreakdown: []
      },
      recentLogs,
      failedAutomations,
      pendingAutomations
    }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-automation/logs:
 *   get:
 *     summary: Get automation logs with filtering
 *     tags: [Checkout Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [started, completed, partial_success, failed, cancelled]
 *       - in: query
 *         name: automationType
 *         schema:
 *           type: string
 *           enum: [checkout_processing, laundry_automation, inventory_automation, housekeeping_automation]
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
 *     responses:
 *       200:
 *         description: Automation logs retrieved successfully
 */
router.get('/logs', authorizePolicy('checkoutAutomation', 'managerAccess'), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const {
    status,
    automationType,
    page = 1,
    limit = 20
  } = req.query;

  const parsedPage = Math.max(1, parseInt(page) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Scope logs to hotel: use hotelId directly if available, fall back to booking join
  const hasHotelIdOnLogs = await CheckoutAutomationLog.findOne({ hotelId }).select('_id').lean();
  const filter = {};
  if (hasHotelIdOnLogs) {
    filter.hotelId = hotelId;
  } else {
    // Legacy fallback
    const hotelBookingIds = await Booking.find({ hotelId })
      .select('_id')
      .lean()
      .limit(5000);
    filter.bookingId = { $in: hotelBookingIds.map(b => b._id) };
  }

  if (status) filter.status = status;
  if (automationType) filter.automationType = automationType;

  const skip = (parsedPage - 1) * parsedLimit;

  const [logs, total] = await Promise.all([
    CheckoutAutomationLog.find(filter)
      .populate('bookingId', 'bookingNumber')
      .populate('roomId', 'roomNumber')
      .populate('initiatedBy', 'name email')
      .sort({ processedAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    CheckoutAutomationLog.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      logs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: total > 0 ? Math.ceil(total / parsedLimit) : 0
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/checkout-automation/toggle:
 *   post:
 *     summary: Toggle automation on/off
 *     tags: [Checkout Automation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *               automationType:
 *                 type: string
 *                 enum: [laundry, inventory, housekeeping]
 *     responses:
 *       200:
 *         description: Automation toggled successfully
 */
router.post('/toggle', authorizePolicy('checkoutAutomation', 'managerAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { enabled, automationType } = req.body;

  // Build the atomic update based on automationType
  const setFields = { lastUpdatedBy: userId };

  if (automationType) {
    // Toggle specific automation type
    const typeFieldMap = {
      laundry: 'isLaundryAutomationEnabled',
      inventory: 'isInventoryAutomationEnabled',
      housekeeping: 'isHousekeepingAutomationEnabled'
    };
    const field = typeFieldMap[automationType];
    if (field) {
      setFields[field] = enabled;
    }
  } else {
    // Toggle all automation
    setFields.isEnabled = enabled;
  }

  let config = await CheckoutAutomationConfig.findOneAndUpdate(
    { hotelId },
    { $set: setFields },
    { new: true, runValidators: true }
  );

  if (!config) {
    config = await CheckoutAutomationConfig.createDefault(hotelId, userId);
    config = await CheckoutAutomationConfig.findOneAndUpdate(
      { hotelId },
      { $set: setFields },
      { new: true, runValidators: true }
    );
  }

  res.status(200).json({
    status: 'success',
    message: `Automation ${enabled ? 'enabled' : 'disabled'} successfully`,
    data: { config }
  });
}));

export default router;
