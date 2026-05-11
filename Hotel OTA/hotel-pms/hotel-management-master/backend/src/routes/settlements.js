import express from 'express';
import Settlement from '../models/Settlement.js';
import Booking from '../models/Booking.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { validate } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import {
  validateSettlementCreation,
  validatePaymentAddition,
  validateAdjustment,
  validateSettlementQuery,
  validateEscalation,
  validateCommunication,
  validateCalculationIntegrity,
  logFinancialOperation,
  handleValidationErrors
} from '../middleware/settlementValidation.js';
import bookingAuditService from '../services/bookingAuditService.js';
import invoiceLifecycleSyncService from '../services/invoiceLifecycleSyncService.js';
import { awardStayCompletionPoints } from '../services/loyaltyAwardService.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Rate limiting for settlement/financial operations
const financialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for financial operations
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many financial requests' } },
});
router.use(financialLimiter);

/**
 * @swagger
 * /settlements:
 *   get:
 *     summary: Get all settlements for hotel (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, partial, completed, overdue, cancelled, refunded]
 *         description: Filter by settlement status
 *       - in: query
 *         name: escalationLevel
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Filter by escalation level
 *       - in: query
 *         name: dueDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by due date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Number of settlements to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *         description: Number of settlements to skip
 *     responses:
 *       200:
 *         description: Settlements retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 */
router.get('/',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validateSettlementQuery,
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { status, escalationLevel, dueDate, limit = 50, offset = 0 } = req.query;

    // Build query
    const query = { hotelId };

    if (status) query.status = status;
    if (escalationLevel !== undefined) query.escalationLevel = parseInt(escalationLevel);
    if (dueDate) {
      const targetDate = new Date(dueDate);
      query.dueDate = {
        $gte: targetDate,
        $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
      };
    }

    const settlements = await Settlement.find(query)
      .populate('bookingId', 'bookingNumber checkIn checkOut status')
      .populate('guestDetails.guestId', 'name email phone')
      .populate('assignedTo', 'name email')
      .sort({ dueDate: 1, escalationLevel: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset)).lean();

    const totalCount = await Settlement.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        settlements,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + settlements.length < totalCount
        }
      }
    });
  })
);

/**
 * @swagger
 * /settlements/overdue:
 *   get:
 *     summary: Get overdue settlements (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gracePeriod
 *         schema:
 *           type: number
 *           default: 0
 *         description: Grace period in days
 *     responses:
 *       200:
 *         description: Overdue settlements retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 */
router.get('/overdue',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { gracePeriod = 0 } = req.query;

    const overdueSettlements = await Settlement.findOverdue(hotelId, parseInt(gracePeriod));

    res.json({
      status: 'success',
      data: {
        overdueSettlements,
        totalOverdue: overdueSettlements.length,
        gracePeriodDays: parseInt(gracePeriod)
      }
    });
  })
);

/**
 * @swagger
 * /settlements/analytics:
 *   get:
 *     summary: Get settlement analytics (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics
 *     responses:
 *       200:
 *         description: Settlement analytics retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 */
router.get('/analytics',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.start = startDate;
    if (endDate) dateRange.end = endDate;

    const analytics = await Settlement.getAnalytics(hotelId, dateRange);

    res.json({
      status: 'success',
      data: {
        analytics: analytics[0] || {
          byStatus: [],
          totalSettlements: 0,
          totalValue: 0,
          totalOutstanding: 0
        },
        dateRange
      }
    });
  })
);

/**
 * @swagger
 * /settlements:
 *   post:
 *     summary: Create settlement from booking (Admin/Staff only)
 *     tags: [Settlements]
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
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: Booking ID
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: Settlement due date
 *               notes:
 *                 type: string
 *                 description: Settlement notes
 *               assignedTo:
 *                 type: string
 *                 description: User ID to assign settlement to
 *     responses:
 *       201:
 *         description: Settlement created successfully
 *       400:
 *         description: Invalid settlement data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Booking not found
 */
router.post('/',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  validateSettlementCreation,
  logFinancialOperation('settlement_creation'),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { bookingId, dueDate, notes, assignedTo } = req.body;

    // Find booking
    const booking = await Booking.findById(bookingId).populate('userId', 'name email phone');
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if booking belongs to hotel
    if (booking.hotelId.toString() !== hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }

    // Check if settlement already exists
    const existingSettlement = await Settlement.findOne({ bookingId }).lean();
    if (existingSettlement) {
      throw new ApplicationError('Settlement already exists for this booking', 400);
    }

    // Calculate settlement data from booking
    const settlementTracking = booking.calculateSettlement();
    await booking.save();

    // Create settlement
    const settlementData = {
      hotelId,
      bookingId,
      originalAmount: booking.totalAmount,
      adjustments: settlementTracking.adjustments || [],
      finalAmount: settlementTracking.finalAmount || booking.totalAmount,
      totalPaid: booking.paymentDetails?.totalPaid || 0,
      guestDetails: {
        guestId: booking.userId?._id,
        guestName: booking.userId?.name || 'Unknown',
        guestEmail: booking.userId?.email,
        guestPhone: booking.userId?.phone
      },
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        roomNumbers: booking.rooms.map(r => r.roomNumber || 'TBD'),
        nights: booking.nights,
        guestCount: {
          adults: booking.guestDetails.adults,
          children: booking.guestDetails.children,
          extraPersons: booking.extraPersons?.length || 0
        }
      },
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      notes,
      assignedTo,
      createdBy: req.user._id
    };

    const settlement = new Settlement(settlementData);
    await settlement.save();

    // Populate response data
    await settlement.populate('assignedTo', 'name email');
    await settlement.populate('bookingId', 'bookingNumber checkIn checkOut status');

    res.status(201).json({
      status: 'success',
      data: {
        settlement,
        message: 'Settlement created successfully'
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}:
 *   get:
 *     summary: Get settlement details (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *     responses:
 *       200:
 *         description: Settlement details retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.get('/:id',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;

    const settlement = await Settlement.findOne({ _id: id, hotelId })
      .populate('bookingId', 'bookingNumber checkIn checkOut status rooms')
      .populate('guestDetails.guestId', 'name email phone')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('lastUpdatedBy', 'name email').lean();

    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        settlement
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/payment:
 *   post:
 *     summary: Add payment to settlement (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 description: Payment amount
 *               method:
 *                 type: string
 *                 enum: [cash, card, upi, bank_transfer, online_portal, refund_to_source]
 *                 description: Payment method
 *               reference:
 *                 type: string
 *                 description: Payment reference
 *               notes:
 *                 type: string
 *                 description: Payment notes
 *     responses:
 *       200:
 *         description: Payment added successfully
 *       400:
 *         description: Invalid payment data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.post('/:id/payment',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  validatePaymentAddition,
  validateCalculationIntegrity,
  logFinancialOperation('payment_addition'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;
    const { amount, method, reference, notes } = req.body;

    if (!amount || amount <= 0 || !method) {
      throw new ApplicationError('Valid amount and payment method are required', 400);
    }

    const settlement = await Settlement.findOne({ _id: id, hotelId });
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    const linkedBooking = await Booking.findById(settlement.bookingId);
    const linkedBookingBeforePayment = linkedBooking
      ? bookingAuditService.buildSnapshot(linkedBooking)
      : null;

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const payment = settlement.addPayment({ amount, method, reference, notes }, userContext);
    settlement.lastUpdatedBy = req.user._id;

    await settlement.save();

    if (linkedBooking) {
      try {
        linkedBooking.processSettlementPayment({
          amount,
          method,
          reference,
          notes: notes || `Settlement payment mirrored from settlement ${settlement.settlementNumber || settlement._id}`
        }, userContext);

        await linkedBooking.save();

        try {
          await invoiceLifecycleSyncService.syncBookingPaymentStatus({
            bookingId: linkedBooking._id,
            paymentStatus: linkedBooking.paymentStatus,
            actorUserId: req.user._id
          });
        } catch (invoiceSyncError) {
          invoiceLifecycleSyncService.logSyncFailure(
            { bookingId: linkedBooking._id, flow: 'settlement-route-payment' },
            invoiceSyncError
          );
        }

        await bookingAuditService.logBookingMutation({
          booking: linkedBooking,
          changeType: 'update',
          user: req.user,
          req,
          oldValues: linkedBookingBeforePayment,
          newValues: bookingAuditService.buildSnapshot(linkedBooking),
          metadata: {
            priority: 'high',
            tags: ['settlement_payment_sync'],
            settlementId: settlement._id.toString(),
            settlementNumber: settlement.settlementNumber || null,
            settlementPaymentAmount: amount
          }
        });

        await awardStayCompletionPoints(linkedBooking).catch((error) => {
          // Non-blocking for settlement flows.
          // Award service is idempotent and skips non-checkout states.
          logger.warn('Settlement loyalty award skipped', {
            bookingId: linkedBooking._id,
            error: error.message
          });
        });
      } catch (bookingSyncError) {
        throw new ApplicationError(
          `Settlement payment saved but booking synchronization failed: ${bookingSyncError.message}`,
          409
        );
      }
    }

    res.json({
      status: 'success',
      data: {
        payment,
        updatedSettlement: settlement,
        message: 'Payment added successfully'
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/escalate:
 *   post:
 *     summary: Escalate settlement (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
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
 *                 description: Escalation reason
 *     responses:
 *       200:
 *         description: Settlement escalated successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.post('/:id/escalate',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  validateEscalation,
  logFinancialOperation('settlement_escalation'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;
    const { reason } = req.body;

    if (!reason) {
      throw new ApplicationError('Escalation reason is required', 400);
    }

    const settlement = await Settlement.findOne({ _id: id, hotelId });
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const newEscalationLevel = settlement.escalate(reason, userContext);
    settlement.lastUpdatedBy = req.user._id;

    await settlement.save();

    res.json({
      status: 'success',
      data: {
        newEscalationLevel,
        escalationAction: settlement.getEscalationAction(newEscalationLevel),
        updatedSettlement: settlement,
        message: `Settlement escalated to level ${newEscalationLevel}`
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/communication:
 *   post:
 *     summary: Add communication to settlement (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - message
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, sms, phone_call, letter, in_person]
 *                 description: Communication type
 *               subject:
 *                 type: string
 *                 description: Communication subject
 *               message:
 *                 type: string
 *                 description: Communication message
 *               direction:
 *                 type: string
 *                 enum: [outbound, inbound]
 *                 default: outbound
 *                 description: Communication direction
 *     responses:
 *       200:
 *         description: Communication added successfully
 *       400:
 *         description: Invalid communication data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.post('/:id/communication',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  validateCommunication,
  logFinancialOperation('communication_addition'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;
    const { type, subject, message, direction = 'outbound' } = req.body;

    if (!type || !message) {
      throw new ApplicationError('Communication type and message are required', 400);
    }

    const settlement = await Settlement.findOne({ _id: id, hotelId });
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const communication = settlement.addCommunication(
      { type, subject, message, direction },
      userContext
    );

    settlement.lastUpdatedBy = req.user._id;
    await settlement.save();

    res.json({
      status: 'success',
      data: {
        communication,
        message: 'Communication added successfully'
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/dispute:
 *   post:
 *     summary: Add dispute to settlement (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - description
 *               - raisedBy
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [charge_dispute, service_complaint, billing_error, damage_claim, other]
 *                 description: Dispute type
 *               amount:
 *                 type: number
 *                 description: Disputed amount
 *               description:
 *                 type: string
 *                 description: Dispute description
 *               raisedBy:
 *                 type: string
 *                 enum: [guest, hotel]
 *                 description: Who raised the dispute
 *     responses:
 *       200:
 *         description: Dispute added successfully
 *       400:
 *         description: Invalid dispute data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.post('/:id/dispute',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;
    const { type, amount, description, raisedBy } = req.body;

    if (!type || !description || !raisedBy) {
      throw new ApplicationError('Dispute type, description, and raisedBy are required', 400);
    }

    const dispute = {
      type,
      amount,
      description,
      raisedBy
    };

    const settlement = await Settlement.findOneAndUpdate(
      { _id: id, hotelId },
      {
        $push: { disputes: dispute },
        $set: { lastUpdatedBy: req.user._id }
      },
      { new: true, runValidators: true }
    );

    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        dispute: settlement.disputes[settlement.disputes.length - 1],
        message: 'Dispute added successfully'
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/dispute/{disputeId}/resolve:
 *   post:
 *     summary: Resolve dispute (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *       - in: path
 *         name: disputeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dispute ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Dispute resolution
 *     responses:
 *       200:
 *         description: Dispute resolved successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement or dispute not found
 */
router.post('/:id/dispute/:disputeId/resolve',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { id, disputeId } = req.params;
    const hotelId = req.user.hotelId;
    const { resolution } = req.body;

    if (!resolution) {
      throw new ApplicationError('Resolution is required', 400);
    }

    const settlement = await Settlement.findOne({ _id: id, hotelId });
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const resolvedDispute = settlement.resolveDispute(disputeId, resolution, userContext);
    settlement.lastUpdatedBy = req.user._id;

    await settlement.save();

    res.json({
      status: 'success',
      data: {
        resolvedDispute,
        message: 'Dispute resolved successfully'
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/validate:
 *   post:
 *     summary: Validate settlement calculations (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *     responses:
 *       200:
 *         description: Validation completed
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.post('/:id/validate',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  logFinancialOperation('calculation_validation'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;

    const settlement = await Settlement.findOne({ _id: id, hotelId });
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    // Perform comprehensive validation (requires Mongoose document for instance methods)
    const validationResult = settlement.validateCalculations();
    const businessRulesResult = settlement.validateBusinessRules();

    res.json({
      status: 'success',
      data: {
        settlementNumber: settlement.settlementNumber,
        calculationValidation: validationResult,
        businessRulesValidation: businessRulesResult,
        validationStatus: settlement.getValidationStatus(),
        auditTrail: settlement.getCalculationAuditTrail()
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/adjustment:
 *   post:
 *     summary: Add adjustment to settlement (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [extra_person_charge, damage_charge, minibar_charge, service_charge, discount, refund, penalty, cancellation_fee, other]
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [room_charge, food_beverage, amenities, services, damages, penalties, credits]
 *               taxable:
 *                 type: boolean
 *               taxAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Adjustment added successfully
 *       400:
 *         description: Invalid adjustment data
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.post('/:id/adjustment',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  validate(mutationBaselineSchema),
  validateAdjustment,
  validateCalculationIntegrity,
  logFinancialOperation('adjustment_addition'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const settlement = req.adjustmentValidation.settlement;

    const userContext = {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    };

    const adjustment = settlement.addAdjustment(req.body, userContext);
    settlement.lastUpdatedBy = req.user._id;

    await settlement.save();

    res.json({
      status: 'success',
      data: {
        adjustment,
        updatedSettlement: settlement,
        requiresApproval: req.adjustmentValidation.requiresApproval,
        message: 'Adjustment added successfully'
      }
    });
  })
);

/**
 * @swagger
 * /settlements/{id}/late-fee:
 *   get:
 *     summary: Calculate late fee for settlement (Admin/Staff only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Settlement ID
 *       - in: query
 *         name: asOfDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Calculate late fee as of this date (defaults to today)
 *     responses:
 *       200:
 *         description: Late fee calculated successfully
 *       403:
 *         description: Access denied - admin/staff only
 *       404:
 *         description: Settlement not found
 */
router.get('/:id/late-fee',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'staffAccess'),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;
    const { asOfDate } = req.query;

    const settlement = await Settlement.findOne({ _id: id, hotelId });
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    const lateFeeCalculation = settlement.calculateLateFee(asOfDate ? new Date(asOfDate) : new Date());

    res.json({
      status: 'success',
      data: {
        settlementNumber: settlement.settlementNumber,
        lateFeeCalculation,
        outstandingBalance: settlement.outstandingBalance,
        dueDate: settlement.dueDate,
        currentDate: asOfDate || new Date()
      }
    });
  })
);

/**
 * @swagger
 * /settlements/validation-statistics:
 *   get:
 *     summary: Get calculation validation statistics (Admin only)
 *     tags: [Settlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Validation statistics retrieved successfully
 *       403:
 *         description: Access denied - admin only
 */
router.get('/validation-statistics',
  authenticate,
  ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('settlements', 'adminAccess'),
  validateSettlementQuery,
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.start = startDate;
    if (endDate) dateRange.end = endDate;

    const statistics = await Settlement.getValidationStatistics(hotelId, dateRange);
    const settlementsWithErrors = await Settlement.findWithCalculationErrors(hotelId);

    res.json({
      status: 'success',
      data: {
        statistics,
        settlementsWithErrors,
        dateRange
      }
    });
  })
);

// Add error handling middleware
router.use(handleValidationErrors);

export default router;
