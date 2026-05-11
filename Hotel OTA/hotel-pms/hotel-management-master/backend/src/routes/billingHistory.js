import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ensurePropertyAccess, refToHotelIdString } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import logger from '../utils/logger.js';
import financialRateLimiter from '../middleware/financialRateLimiter.js';

const router = express.Router();

const ALLOWED_HISTORY_TYPES = new Set(['all', 'invoice', 'payment', 'refund', 'booking', 'checkout_charges']);
const ALLOWED_PERIODS = new Set(['week', 'month', 'quarter', 'year']);
const ALLOWED_INVOICE_STATUSES = new Set(['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded']);
const ALLOWED_PAYMENT_STATUSES = new Set(['pending', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded']);
const ALLOWED_BOOKING_STATUSES = new Set(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']);
const ALLOWED_CHECKOUT_CHARGE_STATUSES = new Set(['pending', 'paid', 'failed']);
const ALLOWED_BILLING_STATUSES = new Set([
  ...ALLOWED_INVOICE_STATUSES,
  ...ALLOWED_PAYMENT_STATUSES,
  ...ALLOWED_BOOKING_STATUSES,
  ...ALLOWED_CHECKOUT_CHARGE_STATUSES
]);

const parseDateParam = (dateString, fieldName) => {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApplicationError(`Invalid ${fieldName}. Expected a valid date string`, 400);
  }
  return parsed;
};

const parseObjectIdParam = (value, fieldName) => {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApplicationError(`Invalid ${fieldName}. Expected a valid ObjectId`, 400);
  }
  return new mongoose.Types.ObjectId(value);
};

// All routes require rate limiting, authentication, and tenant isolation
router.use(financialRateLimiter);
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Simple test route
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Billing history API is working',
    user: {
      id: req.user._id,
      role: req.user.role
    }
  });
});

/**
 * @swagger
 * /billing-history/user:
 *   get:
 *     summary: Get user's checkout inventory billing history
 *     tags: [Billing History]
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
 *           default: 10
 *     responses:
 *       200:
 *         description: User's checkout inventory billing history
 */
router.get('/user', catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  // Get user with billing history
  const user = await User.findById(req.user._id)
    .select('billingHistory')
    .populate({
      path: 'billingHistory.bookingId',
      select: 'bookingNumber checkIn checkOut'
    })
    .populate({
      path: 'billingHistory.roomId',
      select: 'roomNumber type'
    }).lean();

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  // Sort billing history by date (newest first)
  const billingHistory = user.billingHistory || [];
  const sortedHistory = billingHistory.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  // Apply pagination
  const total = sortedHistory.length;
  const paginatedHistory = sortedHistory.slice(skip, skip + limit);

  // Calculate summary
  const summary = {
    totalCharges: sortedHistory.length,
    totalAmount: sortedHistory.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
    totalPaid: sortedHistory.filter(item => item.paymentStatus === 'paid').length,
    totalPending: sortedHistory.filter(item => item.paymentStatus === 'pending').length
  };

  res.json({
    status: 'success',
    data: {
      billingHistory: paginatedHistory,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: limit > 0 ? Math.ceil(total / limit) : 0
      }
    }
  });
}));

/**
 * @swagger
 * /billing-history:
 *   get:
 *     summary: Get comprehensive billing history (invoices, transactions, refunds)
 *     tags: [Billing History]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, invoice, payment, refund, booking, checkout_charges]
 *           default: all
 *       - in: query
 *         name: status
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
 *       - in: query
 *         name: guestId
 *         schema:
 *           type: string
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comprehensive billing history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [invoice, payment, refund, booking]
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           amount:
 *                             type: number
 *                           status:
 *                             type: string
 *                           description:
 *                             type: string
 *                           bookingId:
 *                             type: string
 *                           guestName:
 *                             type: string
 *                           invoiceNumber:
 *                             type: string
 *                     summary:
 *                       type: object
 *                     pagination:
 *                       type: object
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    type = 'all',
    status,
    startDate,
    endDate,
    guestId,
    search
  } = req.query;

  if (!ALLOWED_HISTORY_TYPES.has(type)) {
    throw new ApplicationError(`Invalid type. Allowed values: ${Array.from(ALLOWED_HISTORY_TYPES).join(', ')}`, 400);
  }
  if (status && !ALLOWED_BILLING_STATUSES.has(status)) {
    throw new ApplicationError(`Invalid status. Allowed values: ${Array.from(ALLOWED_BILLING_STATUSES).join(', ')}`, 400);
  }

  const parsedStartDate = parseDateParam(startDate, 'startDate');
  const parsedEndDate = parseDateParam(endDate, 'endDate');
  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    throw new ApplicationError('Invalid date range. startDate must be less than or equal to endDate', 400);
  }

  // Parse and clamp pagination params to prevent unbounded queries
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  // Tenant isolation: staff use hotelId; guests often have no tenant (ensureTenantContext sets req.tenantId null).
  // For guests, scope by guestId / userId on each record only — no hotel filter on baseQuery.
  const baseQuery = {};
  const targetHotelId = req.tenantId || refToHotelIdString(req.user.hotelId);
  let scopedGuestId = null;

  if (req.user.role === 'guest') {
    scopedGuestId = req.user._id;
  } else {
    if (!targetHotelId) {
      throw new ApplicationError('Hotel ID is required', 400);
    }
    baseQuery.hotelId = new mongoose.Types.ObjectId(targetHotelId);
  }

  // Apply additional filters — operational roles (including frontdesk) can scope to a specific guest
  if (guestId && ['staff', 'admin', 'manager', 'frontdesk'].includes(req.user.role)) {
    scopedGuestId = parseObjectIdParam(guestId, 'guestId');
  }

  // Date range filter
  const dateFilter = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  const skip = (page - 1) * limit;
  let historyItems = [];

  // Fetch enough rows from each sub-collection to cover the requested page even
  // when records are interleaved after the cross-collection sort.  We need at
  // least (skip + limit) rows total across all sources, so each source should
  // provide (skip + limit) rows in the worst case.  Cap at 500 to stay safe.
  const subQueryLimit = Math.min(skip + limit + limit, 500);

  logger.debug('Billing history request', {
    userRole: req.user.role,
    type,
    page,
    limit
  });

  // Fetch invoices
  if (type === 'all' || type === 'invoice') {
    const invoiceQuery = { ...baseQuery };
    if (scopedGuestId) {
      invoiceQuery.guestId = scopedGuestId;
    }
    if (Object.keys(dateFilter).length > 0) {
      invoiceQuery.issueDate = dateFilter;
    }
    if (status) invoiceQuery.status = status;
    if (search) {
      const escapedSearch = escapeRegex(search);
      invoiceQuery.$or = [
        { invoiceNumber: { $regex: escapedSearch, $options: 'i' } },
        { 'items.description': { $regex: escapedSearch, $options: 'i' } },
        { notes: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email')
      .populate('hotelId', 'name')
      .select('invoiceNumber type status totalAmount issueDate items notes bookingId guestId hotelId payments')
      .sort('-issueDate')
      .limit(subQueryLimit).lean();
    
    logger.debug('Invoice query result', { count: invoices.length });

    invoices.forEach(invoice => {
      historyItems.push({
        id: invoice._id,
        type: 'invoice',
        subType: invoice.type,
        date: invoice.issueDate,
        amount: invoice.totalAmount,
        status: invoice.status,
        description: `Invoice ${invoice.invoiceNumber} - ${invoice.type}`,
        bookingId: invoice.bookingId?._id,
        bookingNumber: invoice.bookingId?.bookingNumber,
        guestName: invoice.guestId?.name,
        guestEmail: invoice.guestId?.email,
        hotelName: invoice.hotelId?.name,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
        amountRemaining: invoice.totalAmount - (invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0),
        itemCount: invoice.items?.length || 0
      });
    });
  }

  // Fetch payments from Invoice payments array (since seed data doesn't create separate Payment documents)
  if (type === 'all' || type === 'payment') {
    // Get invoices that have payments
    const invoicePaymentQuery = { ...baseQuery };
    if (scopedGuestId) {
      invoicePaymentQuery.guestId = scopedGuestId;
    }
    if (Object.keys(dateFilter).length > 0) {
      invoicePaymentQuery.issueDate = dateFilter;
    }
    if (search) {
      const escapedSearch = escapeRegex(search);
      invoicePaymentQuery.$or = [
        { invoiceNumber: { $regex: escapedSearch, $options: 'i' } },
        { 'items.description': { $regex: escapedSearch, $options: 'i' } },
        { notes: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const invoicesWithPayments = await Invoice.find({
      ...invoicePaymentQuery,
      'payments.0': { $exists: true }  // Only invoices with payments
    })
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email')
      .populate('hotelId', 'name')
      .select('invoiceNumber totalAmount issueDate payments bookingId guestId hotelId currency')
      .sort('-issueDate')
      .limit(subQueryLimit).lean();
    
    logger.debug('Found invoices with payments', { count: invoicesWithPayments.length });

    invoicesWithPayments.forEach(invoice => {
      invoice.payments.forEach((payment, index) => {
        // Add each payment as a transaction
        historyItems.push({
          id: `${invoice._id}-payment-${index}`,
          type: 'payment',
          subType: 'transaction',
          date: payment.paidAt || invoice.issueDate,
          amount: payment.amount,
          status: 'succeeded', // Payments in invoices are considered successful
          description: `Payment for Invoice ${invoice.invoiceNumber} - ${payment.method}`,
          bookingId: invoice.bookingId?._id,
          bookingNumber: invoice.bookingId?.bookingNumber,
          guestName: invoice.guestId?.name,
          guestEmail: invoice.guestId?.email,
          hotelName: invoice.hotelId?.name,
          paymentMethod: payment.method,
          currency: invoice.currency || 'INR',
          transactionId: payment.transactionId,
          invoiceNumber: invoice.invoiceNumber
        });
      });
    });
  }

  // For refunds, we'll check if there are any refund-type invoices in the seed data
  if (type === 'all' || type === 'refund') {
    const refundInvoices = await Invoice.find({
      ...baseQuery,
      ...(scopedGuestId ? { guestId: scopedGuestId } : {}),
      status: 'refunded'
    })
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email')
      .populate('hotelId', 'name')
      .select('invoiceNumber type status totalAmount issueDate bookingId guestId hotelId currency')
      .sort('-issueDate')
      .limit(subQueryLimit).lean();

    logger.debug('Found refund invoices', { count: refundInvoices.length });

    refundInvoices.forEach(invoice => {
      historyItems.push({
        id: `${invoice._id}-refund`,
        type: 'refund',
        subType: 'refund',
        date: invoice.issueDate,
        amount: invoice.totalAmount,
        status: 'completed',
        description: `Refund for Invoice ${invoice.invoiceNumber}`,
        bookingId: invoice.bookingId?._id,
        bookingNumber: invoice.bookingId?.bookingNumber,
        guestName: invoice.guestId?.name,
        guestEmail: invoice.guestId?.email,
        hotelName: invoice.hotelId?.name,
        currency: invoice.currency || 'INR',
        invoiceNumber: invoice.invoiceNumber,
        refundReason: 'Invoice refund'
      });
    });
  }

  // Include bookings as potential billing items (especially pending ones without invoices)
  if (type === 'all' || type === 'booking') {
    const bookingQuery = { ...baseQuery };
    if (scopedGuestId) {
      bookingQuery.userId = scopedGuestId;
    }
    if (Object.keys(dateFilter).length > 0) {
      bookingQuery.createdAt = dateFilter;
    }
    if (search) {
      const escapedSearch = escapeRegex(search);
      bookingQuery.$or = [
        { bookingNumber: { $regex: escapedSearch, $options: 'i' } },
        { 'guestDetails.specialRequests': { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const bookings = await Booking.find(bookingQuery)
      .populate('userId', 'name email')
      .populate('hotelId', 'name')
      .populate('rooms.roomId', 'roomNumber type')
      .select('bookingNumber status paymentStatus totalAmount checkIn checkOut userId hotelId rooms createdAt currency nights')
      .sort('-createdAt')
      .limit(subQueryLimit).lean();

    logger.debug('Found bookings for billing history', { count: bookings.length });

    bookings.forEach(booking => {
      // Add booking as billing item
      const roomInfo = booking.rooms?.map(r => r.roomId?.roomNumber).join(', ') || 'Room info not available';
      
      historyItems.push({
        id: booking._id,
        type: 'booking',
        subType: booking.paymentStatus,
        date: booking.createdAt,
        amount: booking.totalAmount,
        status: booking.status,
        description: `Room Booking ${booking.bookingNumber} - ${roomInfo}`,
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.userId?.name,
        guestEmail: booking.userId?.email,
        hotelName: booking.hotelId?.name,
        currency: booking.currency || 'INR',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        paymentStatus: booking.paymentStatus,
        roomCount: booking.rooms?.length || 0
      });
    });
  }

  // Include guest checkout inventory charges recorded on User.billingHistory
  // For operational roles (staff/admin/manager/frontdesk), include these entries only when guestId scope is provided.
  const canViewScopedCheckoutCharges =
    req.user.role === 'guest' || (['staff', 'admin', 'manager', 'frontdesk'].includes(req.user.role) && scopedGuestId);
  if (canViewScopedCheckoutCharges && (type === 'all' || type === 'checkout_charges')) {
    const checkoutGuestId = req.user.role === 'guest' ? req.user._id : scopedGuestId;
    const guestLookup = { _id: checkoutGuestId };
    if (targetHotelId && req.user.role !== 'guest') {
      guestLookup.hotelId = new mongoose.Types.ObjectId(targetHotelId);
    }
    const guestUser = await User.findOne(guestLookup)
      .select('name email billingHistory')
      .populate({
        path: 'billingHistory.bookingId',
        select: 'bookingNumber'
      })
      .lean();

    const checkoutCharges = (guestUser?.billingHistory || []).filter(entry => entry?.type === 'checkout_charges');

    checkoutCharges.forEach((entry, index) => {
      if (status && entry.paymentStatus !== status) {
        return;
      }

      const entryDate = entry.createdAt || entry.paidAt;
      if (Object.keys(dateFilter).length > 0 && entryDate) {
        const entryDateObj = new Date(entryDate);
        if (dateFilter.$gte && entryDateObj < dateFilter.$gte) return;
        if (dateFilter.$lte && entryDateObj > dateFilter.$lte) return;
      }

      historyItems.push({
        id: entry._id ? String(entry._id) : `${checkoutGuestId}-checkout-${index}`,
        type: 'checkout_charges',
        subType: entry.type,
        date: entryDate || new Date(),
        amount: entry.totalAmount || 0,
        status: entry.paymentStatus || 'pending',
        description: entry.description || 'Checkout inventory charges',
        bookingId: entry.bookingId?._id || entry.bookingId,
        bookingNumber: entry.bookingId?.bookingNumber,
        guestName: guestUser?.name,
        guestEmail: guestUser?.email,
        paymentMethod: entry.paymentMethod,
        itemCount: Array.isArray(entry.items) ? entry.items.length : 0
      });
    });
  }

  // Apply search filter to consolidated results if needed
  if (search && type === 'all') {
    const searchLower = search.toLowerCase();
    historyItems = historyItems.filter(item => 
      item.description.toLowerCase().includes(searchLower) ||
      item.guestName?.toLowerCase().includes(searchLower) ||
      item.bookingNumber?.toLowerCase().includes(searchLower) ||
      item.invoiceNumber?.toLowerCase().includes(searchLower)
    );
  }

  // Sort by date (newest first)
  historyItems.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Apply pagination
  const total = historyItems.length;
  const paginatedItems = historyItems.slice(skip, skip + limit);

  // Calculate summary statistics
  // Note: historyItems may be capped by subQueryLimit per source collection.
  // If any source hit the cap, the summary is approximate (based on most recent transactions only).
  const summaryMayBeApproximate = historyItems.length >= subQueryLimit;
  const summary = {
    totalTransactions: total,
    totalAmount: historyItems.reduce((sum, item) => sum + (item.type === 'refund' ? -item.amount : item.amount), 0),
    invoiceCount: historyItems.filter(item => item.type === 'invoice').length,
    paymentCount: historyItems.filter(item => item.type === 'payment').length,
    refundCount: historyItems.filter(item => item.type === 'refund').length,
    bookingCount: historyItems.filter(item => item.type === 'booking').length,
    checkoutChargeCount: historyItems.filter(item => item.type === 'checkout_charges').length,
    totalInvoiceAmount: historyItems.filter(item => item.type === 'invoice').reduce((sum, item) => sum + item.amount, 0),
    totalPaymentAmount: historyItems.filter(item => item.type === 'payment').reduce((sum, item) => sum + item.amount, 0),
    totalRefundAmount: historyItems.filter(item => item.type === 'refund').reduce((sum, item) => sum + item.amount, 0),
    totalBookingAmount: historyItems.filter(item => item.type === 'booking').reduce((sum, item) => sum + item.amount, 0),
    totalCheckoutChargeAmount: historyItems.filter(item => item.type === 'checkout_charges').reduce((sum, item) => sum + item.amount, 0),
    ...(summaryMayBeApproximate ? { note: 'Summary based on most recent transactions' } : {})
  };

  logger.debug('Billing history final results', {
    totalHistoryItems: historyItems.length,
    paginatedItems: paginatedItems.length
  });

  res.json({
    status: 'success',
    data: {
      history: paginatedItems,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: limit > 0 ? Math.ceil(total / limit) : 0
      }
    }
  });
}));

/**
 * @swagger
 * /billing-history/stats:
 *   get:
 *     summary: Get billing history statistics and analytics
 *     tags: [Billing History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Billing statistics and analytics
 */
router.get('/stats', authorize('staff', 'admin', 'manager', 'frontdesk'), catchAsync(async (req, res) => {
  const { period = 'month' } = req.query;
  if (!ALLOWED_PERIODS.has(period)) {
    throw new ApplicationError(`Invalid period. Allowed values: ${Array.from(ALLOWED_PERIODS).join(', ')}`, 400);
  }

  // SECURITY FIX: Always use tenant-scoped hotelId from ensureTenantContext
  const targetHotelId = req.tenantId || refToHotelIdString(req.user.hotelId);

  if (!targetHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Calculate date range based on period
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case 'year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
  }

  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(targetHotelId),
    createdAt: { $gte: startDate, $lte: now }
  };

  // Get invoice statistics
  // NOTE: Uses compound index { hotelId: 1, status: 1, issueDate: -1 } on Invoice
  const invoiceStats = await Invoice.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(targetHotelId),
        issueDate: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: {
          status: '$status',
          type: '$type'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        averageAmount: { $avg: '$totalAmount' }
      }
    }
  ]);

  // Get payment statistics
  // NOTE: Uses compound index { hotelId: 1, status: 1, createdAt: -1 } on Payment
  const paymentStats = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          status: '$status',
          method: '$paymentMethod'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ]);

  // Get daily revenue trend
  const revenueTrend = await Payment.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(targetHotelId),
        status: 'succeeded',
        createdAt: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        revenue: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  // Get refund statistics
  const refundStats = await Payment.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(targetHotelId),
        createdAt: { $gte: startDate, $lte: now },
        'refunds.0': { $exists: true }
      }
    },
    { $unwind: '$refunds' },
    {
      $group: {
        _id: null,
        totalRefunds: { $sum: 1 },
        totalRefundAmount: { $sum: '$refunds.amount' },
        averageRefundAmount: { $avg: '$refunds.amount' }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      period,
      dateRange: {
        startDate,
        endDate: now
      },
      invoices: invoiceStats,
      payments: paymentStats,
      refunds: refundStats[0] || { totalRefunds: 0, totalRefundAmount: 0, averageRefundAmount: 0 },
      revenueTrend
    }
  });
}));

/**
 * @swagger
 * /billing-history/export:
 *   get:
 *     summary: Export billing history data
 *     tags: [Billing History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel, pdf]
 *           default: csv
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
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, invoice, payment, refund]
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export data or download link
 */
router.get('/export', authorize('staff', 'admin', 'manager', 'frontdesk'), catchAsync(async (req, res) => {
  const { format = 'csv', startDate, endDate, type = 'all' } = req.query;
  if (!['csv', 'excel', 'pdf'].includes(format)) {
    throw new ApplicationError('Invalid format. Allowed values: csv, excel, pdf', 400);
  }
  // Accept booking and checkout_charges in addition to the original set so the
  // frontend BillingHistory filter (which can select any type) can export them.
  if (!['all', 'invoice', 'payment', 'refund', 'booking', 'checkout_charges'].includes(type)) {
    throw new ApplicationError('Invalid type. Allowed values: all, invoice, payment, refund, booking, checkout_charges', 400);
  }
  const parsedStartDate = parseDateParam(startDate, 'startDate');
  const parsedEndDate = parseDateParam(endDate, 'endDate');
  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    throw new ApplicationError('Invalid date range. startDate must be less than or equal to endDate', 400);
  }
  const exportLimit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 500));

  // SECURITY FIX: Always use tenant-scoped hotelId from ensureTenantContext
  const targetHotelId = req.tenantId || refToHotelIdString(req.user.hotelId);

  if (!targetHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const baseQuery = { hotelId: new mongoose.Types.ObjectId(targetHotelId) };

  const dateFilter = {};
  if (parsedStartDate) dateFilter.$gte = parsedStartDate;
  if (parsedEndDate) dateFilter.$lte = parsedEndDate;

  let exportData = [];

  // Fetch data based on type
  if (type === 'all' || type === 'invoice') {
    const invoiceQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      invoiceQuery.issueDate = dateFilter;
    }

    const invoices = await Invoice.find(invoiceQuery)
      .populate('bookingId', 'bookingNumber')
      .populate('guestId', 'name email phone')
      .populate('hotelId', 'name')
      .sort('-issueDate')
      .limit(exportLimit).lean();

    invoices.forEach(invoice => {
      exportData.push({
        type: 'Invoice',
        date: invoice.issueDate,
        invoiceNumber: invoice.invoiceNumber,
        bookingNumber: invoice.bookingId?.bookingNumber,
        guestName: invoice.guestId?.name,
        guestEmail: invoice.guestId?.email,
        amount: invoice.totalAmount,
        status: invoice.status,
        currency: invoice.currency,
        hotelName: invoice.hotelId?.name
      });
    });
  }

  if (type === 'all' || type === 'payment') {
    const paymentQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      paymentQuery.createdAt = dateFilter;
    }

    const payments = await Payment.find(paymentQuery)
      .populate({
        path: 'bookingId',
        select: 'bookingNumber userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('hotelId', 'name')
      .sort('-createdAt')
      .limit(exportLimit).lean();

    payments.forEach(payment => {
      exportData.push({
        type: 'Payment',
        date: payment.createdAt,
        transactionId: payment.stripePaymentIntentId,
        bookingNumber: payment.bookingId?.bookingNumber,
        guestName: payment.bookingId?.userId?.name,
        guestEmail: payment.bookingId?.userId?.email,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        currency: payment.currency,
        hotelName: payment.hotelId?.name
      });

      // Add refunds
      payment.refunds?.forEach(refund => {
        exportData.push({
          type: 'Refund',
          date: refund.createdAt,
          refundId: refund.stripeRefundId,
          originalTransactionId: payment.stripePaymentIntentId,
          bookingNumber: payment.bookingId?.bookingNumber,
          guestName: payment.bookingId?.userId?.name,
          guestEmail: payment.bookingId?.userId?.email,
          amount: refund.amount,
          status: 'completed',
          reason: refund.reason,
          currency: payment.currency,
          hotelName: payment.hotelId?.name
        });
      });
    });
  }

  // Export bookings
  if (type === 'all' || type === 'booking') {
    const bookingExportQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      bookingExportQuery.createdAt = dateFilter;
    }

    const bookings = await Booking.find(bookingExportQuery)
      .populate('userId', 'name email')
      .populate('hotelId', 'name')
      .select('bookingNumber status paymentStatus totalAmount checkIn checkOut userId hotelId createdAt currency')
      .sort('-createdAt')
      .limit(exportLimit).lean();

    bookings.forEach(booking => {
      exportData.push({
        type: 'Booking',
        date: booking.createdAt,
        bookingNumber: booking.bookingNumber,
        guestName: booking.userId?.name,
        guestEmail: booking.userId?.email,
        amount: booking.totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        currency: booking.currency || 'INR',
        hotelName: booking.hotelId?.name
      });
    });
  }

  // Sort by date
  exportData.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({
    status: 'success',
    data: {
      format,
      totalRecords: exportData.length,
      exportData,
      generatedAt: new Date()
    }
  });
}));

export default router;