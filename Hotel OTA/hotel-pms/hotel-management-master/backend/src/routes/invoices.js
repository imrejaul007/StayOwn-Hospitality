import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import financialRateLimiter from '../middleware/financialRateLimiter.js';
import { validateFinancial, invoiceCreationSchema } from '../middleware/financialValidation.js';
import { verifyHotelOwnership } from '../middleware/idorProtection.js';
import { enforceIdempotency } from '../middleware/idempotency.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import billingService from '../modules/billing/service.js';
import Joi from 'joi';

const router = express.Router();
const idempotentInvoiceMutation = enforceIdempotency({ namespace: 'invoices' });
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require rate limiting, authentication and property access
router.use(financialRateLimiter);
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /invoices:
 *   post:
 *     summary: Create a new invoice
 *     tags: [Invoices]
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
 *               - items
 *               - dueDate
 *             properties:
 *               bookingId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [accommodation, service, additional, refund, cancellation]
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     category:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     taxRate:
 *                       type: number
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               discounts:
 *                 type: array
 *               splitBilling:
 *                 type: object
 *                 properties:
 *                   isEnabled:
 *                     type: boolean
 *                   method:
 *                     type: string
 *                   splits:
 *                     type: array
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invoice created successfully
 */
router.post('/', authorizePolicy('invoices', 'create'), validate(mutationBaselineSchema), idempotentInvoiceMutation, validateFinancial(invoiceCreationSchema), catchAsync(async (req, res) => {
  const {
    bookingId,
    type,
    items,
    dueDate,
    discounts,
    splitBilling,
    notes,
    billingAddress
  } = req.body;

  const invoice = await billingService.createInvoice({
    bookingId,
    type,
    items,
    dueDate,
    discounts,
    splitBilling,
    notes,
    billingAddress,
    user: req.user
  });

  res.status(201).json({
    status: 'success',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: Get invoices
 *     tags: [Invoices]
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
 *         name: guestId
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
 *         description: List of invoices
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    guestId,
    startDate,
    endDate,
    overdue
  } = req.query;

  const query = {};

  // Role-based filtering
  if (req.user.role === 'guest') {
    query.guestId = req.user._id;
  } else if (req.user.role === 'staff') {
    query.hotelId = req.user.hotelId;
  } else if (req.user.role === 'admin' && req.query.hotelId) {
    query.hotelId = req.query.hotelId;
  }

  // Apply filters
  if (status) query.status = status;
  if (type) query.type = type;
  if (guestId && ['staff', 'admin'].includes(req.user.role)) query.guestId = guestId;

  if (startDate || endDate) {
    query.issueDate = {};
    if (startDate) query.issueDate.$gte = new Date(startDate);
    if (endDate) query.issueDate.$lte = new Date(endDate);
  }

  // Filter overdue invoices
  if (overdue === 'true') {
    query.dueDate = { $lt: new Date() };
    query.status = { $in: ['issued', 'partially_paid'] };
  }

  const skip = (page - 1) * limit;
  
  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .populate('hotelId', 'name')
      .populate('bookingId', 'bookingNumber checkIn checkOut')
      .populate('guestId', 'name email')
      .sort('-issueDate')
      .skip(skip)
      .limit(parseInt(limit)),
    Invoice.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /invoices/stats:
 *   get:
 *     summary: Get invoice statistics
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', authorizePolicy('invoices', 'getStats'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [revenueStats, overdueInvoices] = await Promise.all([
    Invoice.getRevenueStats(hotelId, startDate, endDate),
    Invoice.getOverdueInvoices(hotelId)
  ]);

  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    ...(startDate && endDate ? {
      issueDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    } : {})
  };

  const overallStats = await Invoice.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$amountPaid' },
        outstandingAmount: { $sum: '$amountRemaining' },
        draftCount: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        issuedCount: { $sum: { $cond: [{ $eq: ['$status', 'issued'] }, 1, 0] } },
        paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
        overdueCount: {
          $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', new Date()] }, { $in: ['$status', ['issued', 'partially_paid']] }] }, 1, 0] }
        }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      overall: overallStats[0] || {},
      revenue: revenueStats,
      overdue: {
        count: overdueInvoices.length,
        totalAmount: overdueInvoices.reduce((sum, inv) => sum + inv.amountRemaining, 0),
        invoices: overdueInvoices.slice(0, 10)
      }
    }
  });
}));

/**
 * @swagger
 * /invoices/overdue:
 *   get:
 *     summary: Get overdue invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 */
router.get('/overdue', authorizePolicy('invoices', 'getOverdue'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const overdueInvoices = await Invoice.getOverdueInvoices(hotelId);

  res.json({
    status: 'success',
    data: {
      invoices: overdueInvoices,
      count: overdueInvoices.length,
      totalAmount: overdueInvoices.reduce((sum, inv) => sum + inv.amountRemaining, 0)
    }
  });
}));

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Get specific invoice
 *     tags: [Invoices]
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
 *         description: Invoice details
 */
router.get('/:id', verifyHotelOwnership('Invoice'), catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Invoice not found', 404);
  }
  const invoice = await Invoice.findById(req.params.id)
    .populate('hotelId', 'name address contact')
    .populate('bookingId', 'bookingNumber checkIn checkOut rooms')
    .populate('guestId', 'name email phone')
    .populate('payments.paidBy', 'name')
    .populate('discounts.appliedBy', 'name')
    .populate('splitBilling.splits.guestId', 'name email').lean();

  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest' && invoice.guestId._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only view your own invoices', 403);
  }

  if (req.user.role === 'staff' && invoice.hotelId._id.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only view invoices for your hotel', 403);
  }

  res.json({
    status: 'success',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}:
 *   patch:
 *     summary: Update invoice
 *     tags: [Invoices]
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
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               items:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice updated successfully
 */
router.patch('/:id', authorizePolicy('invoices', 'update'), validate(mutationBaselineSchema), idempotentInvoiceMutation, verifyHotelOwnership('Invoice'), catchAsync(async (req, res) => {
  const invoice = await billingService.updateInvoice({
    invoiceId: req.params.id,
    body: req.body,
    user: req.user
  });

  res.json({
    status: 'success',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/payments:
 *   post:
 *     summary: Add payment to invoice
 *     tags: [Invoices]
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
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               transactionId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment added successfully
 */
router.post('/:id/payments', authorizePolicy('invoices', 'addPayment'), validate(mutationBaselineSchema), idempotentInvoiceMutation, catchAsync(async (req, res) => {
  const { amount, method, transactionId, notes } = req.body;
  const invoice = await billingService.addInvoicePayment({
    invoiceId: req.params.id,
    amount,
    method,
    transactionId,
    notes,
    user: req.user
  });

  res.json({
    status: 'success',
    message: 'Payment added successfully',
    data: { 
      invoice,
      amountPaid: invoice.amountPaid,
      amountRemaining: invoice.amountRemaining
    }
  });
}));

/**
 * @swagger
 * /invoices/{id}/discounts:
 *   post:
 *     summary: Add discount to invoice
 *     tags: [Invoices]
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
 *               - description
 *               - type
 *               - value
 *             properties:
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [percentage, fixed_amount, loyalty_points]
 *               value:
 *                 type: number
 *     responses:
 *       200:
 *         description: Discount added successfully
 */
router.post('/:id/discounts', authorizePolicy('invoices', 'addDiscount'), validate(mutationBaselineSchema), idempotentInvoiceMutation, catchAsync(async (req, res) => {
  const { description, type, value } = req.body;
  const invoice = await billingService.addInvoiceDiscount({
    invoiceId: req.params.id,
    description,
    type,
    value,
    user: req.user
  });

  res.json({
    status: 'success',
    message: 'Discount added successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/split-billing:
 *   post:
 *     summary: Setup split billing for invoice
 *     tags: [Invoices]
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
 *               - method
 *               - splits
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [equal, percentage, item_based, custom_amount]
 *               splits:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     guestId:
 *                       type: string
 *                     guestName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     percentage:
 *                       type: number
 *     responses:
 *       200:
 *         description: Split billing setup successfully
 */
router.post('/:id/split-billing', authorizePolicy('invoices', 'setupSplitBilling'), validate(mutationBaselineSchema), idempotentInvoiceMutation, catchAsync(async (req, res) => {
  const { method, splits } = req.body;
  const invoice = await billingService.setupInvoiceSplitBilling({
    invoiceId: req.params.id,
    method,
    splits,
    user: req.user
  });

  res.json({
    status: 'success',
    message: 'Split billing setup successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/splits/{splitIndex}/pay:
 *   post:
 *     summary: Mark split as paid
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: splitIndex
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
 *               - amount
 *               - method
 *             properties:
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *               transactionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Split marked as paid successfully
 */
router.post('/:id/splits/:splitIndex/pay', authorizePolicy('invoices', 'paySplit'), validate(mutationBaselineSchema), idempotentInvoiceMutation, catchAsync(async (req, res) => {
  const { amount, method, transactionId } = req.body;
  const { splitIndex } = req.params;
  const invoice = await billingService.markInvoiceSplitPaid({
    invoiceId: req.params.id,
    splitIndex,
    amount,
    method,
    transactionId,
    user: req.user
  });

  res.json({
    status: 'success',
    message: 'Split marked as paid successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/supplementary/extra-person-charges:
 *   post:
 *     summary: Generate supplementary invoice for extra person charges
 *     tags: [Invoices]
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
 *               - extraPersonCharges
 *             properties:
 *               bookingId:
 *                 type: string
 *               extraPersonCharges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     personId:
 *                       type: string
 *                     personName:
 *                       type: string
 *                     description:
 *                       type: string
 *                     baseCharge:
 *                       type: number
 *                     totalCharge:
 *                       type: number
 *                     addedAt:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       201:
 *         description: Supplementary invoice created successfully
 */
router.post('/supplementary/extra-person-charges', authorizePolicy('invoices', 'createSupplementaryExtraPerson'), validate(mutationBaselineSchema), idempotentInvoiceMutation, catchAsync(async (req, res) => {
  const { bookingId, extraPersonCharges } = req.body;
  const invoice = await billingService.createSupplementaryInvoiceForExtraPersonCharges({
    bookingId,
    extraPersonCharges,
    user: req.user
  });

  res.status(201).json({
    status: 'success',
    message: 'Supplementary invoice created successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/supplementary/settlement:
 *   post:
 *     summary: Generate invoice for settlement adjustments
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - settlementId
 *               - adjustments
 *             properties:
 *               settlementId:
 *                 type: string
 *               adjustments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     type:
 *                       type: string
 *                     appliedAt:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       201:
 *         description: Settlement invoice created successfully
 */
router.post('/supplementary/settlement', authorizePolicy('invoices', 'createSupplementarySettlement'), validate(mutationBaselineSchema), idempotentInvoiceMutation, catchAsync(async (req, res) => {
  const { settlementId, adjustments } = req.body;
  const invoice = await billingService.createSupplementaryInvoiceForSettlement({
    settlementId,
    adjustments,
    user: req.user
  });

  res.status(201).json({
    status: 'success',
    message: 'Settlement invoice created successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/add-extra-charges:
 *   put:
 *     summary: Add extra person charges to existing invoice
 *     tags: [Invoices]
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
 *               - extraPersonCharges
 *             properties:
 *               extraPersonCharges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     personId:
 *                       type: string
 *                     personName:
 *                       type: string
 *                     description:
 *                       type: string
 *                     baseCharge:
 *                       type: number
 *                     totalCharge:
 *                       type: number
 *                     addedAt:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       200:
 *         description: Extra charges added to invoice successfully
 */
router.put('/:id/add-extra-charges', authorizePolicy('invoices', 'addExtraCharges'), validate(mutationBaselineSchema), idempotentInvoiceMutation, catchAsync(async (req, res) => {
  const { extraPersonCharges } = req.body;
  const invoice = await billingService.addExtraChargesToInvoice({
    invoiceId: req.params.id,
    extraPersonCharges,
    user: req.user
  });

  res.json({
    status: 'success',
    message: 'Extra charges added to invoice successfully',
    data: { invoice }
  });
}));

/**
 * @swagger
 * /invoices/{id}/download:
 *   get:
 *     summary: Download invoice as PDF
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Invoice not found
 */
router.get('/:id/download', authenticate, catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Invoice not found', 404);
  }
  const invoice = await Invoice.findById(req.params.id)
    .populate('hotelId', 'name address phone email')
    .populate('guestId', 'name email phone')
    .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount').lean();

  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'guest' && invoice.guestId._id.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only download your own invoices', 403);
  } else if (req.user.role === 'staff' && invoice.hotelId._id.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only download invoices for your hotel', 403);
  }

  // For now, generate a simple PDF-like text format
  // In a real implementation, you would use a PDF library like puppeteer or jsPDF
  const invoiceContent = generateInvoicePDF(invoice);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice._id}.pdf"`);
  res.send(invoiceContent);
}));

/**
 * @swagger
 * /invoices/{id}/view:
 *   get:
 *     summary: View invoice in browser
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Authentication token (alternative to bearer auth)
 *     responses:
 *       200:
 *         description: HTML invoice view
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Invoice not found
 */
router.get('/:id/view', catchAsync(async (req, res) => {
  // Authentication via httpOnly cookie (handled by authenticate middleware if present)
  // SECURITY: JWT in query parameters was removed - tokens must not appear in URLs
  const user = req.user;

  if (!user) {
    throw new ApplicationError('Authentication required', 401);
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Invoice not found', 404);
  }
  const invoice = await Invoice.findById(req.params.id)
    .populate('hotelId', 'name address phone email')
    .populate('guestId', 'name email phone')
    .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount').lean();

  if (!invoice) {
    throw new ApplicationError('Invoice not found', 404);
  }

  // Check access permissions
  if (user.role === 'guest' && invoice.guestId._id.toString() !== user._id.toString()) {
    throw new ApplicationError('You can only view your own invoices', 403);
  } else if (user.role === 'staff' && invoice.hotelId._id.toString() !== user.hotelId.toString()) {
    throw new ApplicationError('You can only view invoices for your hotel', 403);
  }

  // Generate HTML invoice view
  const invoiceHTML = generateInvoiceHTML(invoice);

  res.setHeader('Content-Type', 'text/html');
  res.send(invoiceHTML);
}));

// Helper function to generate PDF content (simplified for demo)
function generateInvoicePDF(invoice) {
  return Buffer.from(`
INVOICE

Hotel: ${invoice.hotelId.name}
Invoice ID: ${invoice._id}
Date: ${invoice.issueDate}
Due Date: ${invoice.dueDate}

Bill To:
${invoice.guestId.name}
${invoice.guestId.email}

Booking: ${invoice.bookingId?.bookingNumber || 'N/A'}
Check-in: ${invoice.bookingId?.checkIn ? new Date(invoice.bookingId.checkIn).toLocaleDateString() : 'N/A'}
Check-out: ${invoice.bookingId?.checkOut ? new Date(invoice.bookingId.checkOut).toLocaleDateString() : 'N/A'}
Original Booking Amount: ₹${invoice.bookingId?.totalAmount?.toLocaleString() || 'N/A'}

Items:
${invoice.items.map(item => `${item.description}: ₹${item.totalPrice}`).join('\n')}

Subtotal: ₹${invoice.subtotal}
Tax: ₹${invoice.taxAmount}
Total: ₹${invoice.totalAmount}

Status: ${invoice.status}
  `.trim());
}

// Escape HTML to prevent XSS in invoice views
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper function to generate HTML invoice view
function generateInvoiceHTML(invoice) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice ${invoice._id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f2f2f2; }
        .total-section { text-align: right; margin-top: 20px; }
        .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
        .total-amount { font-weight: bold; font-size: 1.2em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>INVOICE</h1>
        <h2>${escapeHtml(invoice.hotelId.name)}</h2>
    </div>

    <div class="invoice-info">
        <div>
            <strong>Invoice ID:</strong> ${invoice._id}<br>
            <strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}<br>
            <strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}<br>
            <strong>Status:</strong> <span style="text-transform: capitalize;">${invoice.status}</span>
        </div>
        <div>
            <strong>Bill To:</strong><br>
            ${escapeHtml(invoice.guestId.name)}<br>
            ${escapeHtml(invoice.guestId.email)}<br>
            ${escapeHtml(invoice.guestId.phone || '')}
        </div>
    </div>

    ${invoice.bookingId ? `
    <div class="section">
        <strong>Booking Details:</strong><br>
        Booking Number: ${invoice.bookingId.bookingNumber}<br>
        Check-in: ${new Date(invoice.bookingId.checkIn).toLocaleDateString()}<br>
        Check-out: ${new Date(invoice.bookingId.checkOut).toLocaleDateString()}<br>
        <strong>Original Booking Amount:</strong> ₹${invoice.bookingId.totalAmount?.toLocaleString() || 'N/A'}
    </div>
    ` : ''}

    <table class="items-table">
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${invoice.items.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.unitPrice.toLocaleString()}</td>
                    <td>₹${item.totalPrice.toLocaleString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="total-section">
        <div class="total-row">
            <span>Subtotal (Extra Person Charges):</span>
            <span>₹${invoice.subtotal.toLocaleString()}</span>
        </div>
        <div class="total-row">
            <span>Tax (18% GST):</span>
            <span>₹${invoice.taxAmount.toLocaleString()}</span>
        </div>
        <div class="total-row total-amount">
            <span>Total Extra Charges:</span>
            <span>₹${invoice.totalAmount.toLocaleString()}</span>
        </div>
        ${invoice.bookingId?.totalAmount ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #333;">
            <div class="total-row">
                <span>Original Booking Amount:</span>
                <span>₹${invoice.bookingId.totalAmount.toLocaleString()}</span>
            </div>
            <div class="total-row total-amount" style="font-size: 1.3em; background-color: #f0f0f0; padding: 10px; margin-top: 5px;">
                <span><strong>Grand Total (Booking + Extra Charges):</strong></span>
                <span><strong>₹${(invoice.bookingId.totalAmount + invoice.totalAmount).toLocaleString()}</strong></span>
            </div>
        </div>
        ` : ''}
    </div>

    <div style="margin-top: 40px; text-align: center; color: #666;">
        <p>Thank you for your business!</p>
    </div>
</body>
</html>
  `;
}

export default router;
