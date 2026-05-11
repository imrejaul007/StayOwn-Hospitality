import express from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext, requireTenantInBulkOps } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate, schemas } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';

// Import controllers
import * as chartOfAccountsController from '../controllers/chartOfAccountsController.js';
import * as generalLedgerController from '../controllers/generalLedgerController.js';
import * as journalEntryController from '../controllers/journalEntryController.js';
import * as bankAccountController from '../controllers/bankAccountController.js';
import * as budgetController from '../controllers/budgetController.js';
import * as financialReportsController from '../controllers/financialReportsController.js';
import FinancialService from '../services/financialService.js';
import logger from '../utils/logger.js';

// Import models (static imports instead of dynamic imports in route handlers)
import FinancialPayment from '../models/FinancialPayment.js';
import FinancialInvoice from '../models/FinancialInvoice.js';
import Hotel from '../models/Hotel.js';
import ChartOfAccounts from '../models/ChartOfAccounts.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

const integrationSettingsSchema = Joi.object({
  enabled: Joi.boolean().optional(),
  apiKey: Joi.string().max(500).optional(),
  apiSecret: Joi.string().max(500).optional(),
  webhookUrl: Joi.string().uri().max(500).optional(),
  syncFrequency: Joi.string().valid('realtime', 'hourly', 'daily', 'manual').optional()
}).unknown(true);

const chartOfAccountsInitSchema = Joi.object({
  template: Joi.string().valid('standard', 'hospitality', 'minimal').optional(),
  currency: Joi.string().length(3).uppercase().optional()
}).unknown(true);

// Rate limiting for financial operations
const financialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for financial operations
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many financial requests' } },
});
router.use(financialLimiter);

// === DASHBOARD ===
router.get('/dashboard', authenticate, (req, res, next) => {
  // Preserve the client-selected propertyId before tenantIsolation overwrites it
  req._selectedPropertyId = req.query.hotelId || null;
  next();
}, ensureTenantContext, ensurePropertyAccess, authorize('admin', 'manager', 'frontdesk'), async (req, res) => {
  try {
    const financialService = new FinancialService();
    const period = req.query.period || 'all';
    const customStartDate = req.query.startDate || null;
    const customEndDate = req.query.endDate || null;

    // Use the property selector value (saved before middleware), fall back to user's hotelId
    const rawHotelId = req._selectedPropertyId || req.query.hotelId || req.user?.hotelId;
    if (rawHotelId && !mongoose.Types.ObjectId.isValid(rawHotelId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid hotel ID format' });
    }
    const hotelId = rawHotelId ? new mongoose.Types.ObjectId(rawHotelId) : null;

    logger.debug('Dashboard API called', { period, hotelId: hotelId?.toString(), customStartDate, customEndDate });

    const dashboard = await financialService.generateFinancialDashboard(period, hotelId, customStartDate, customEndDate);
    logger.debug('Dashboard generated');
    
    res.json({ success: true, data: dashboard });
  } catch (error) {
    logger.error('Dashboard API error', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Apply authentication and property access to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// === INTEGRATION SETTINGS ===
router.put('/integrations/:integrationId/settings', authorize('admin', 'manager'), validate(integrationSettingsSchema), async (req, res) => {
  try {
    const { integrationId } = req.params;
    const hotelId = req.user?.hotelId;
    const settings = req.body;

    // Store integration settings in hotel config
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Hotel not found' });
    }

    // Save to hotel's integrationSettings (or create the field)
    if (!hotel.integrationSettings) {
      hotel.integrationSettings = {};
    }
    hotel.integrationSettings[integrationId] = {
      ...settings,
      updatedAt: new Date(),
      updatedBy: req.user?._id
    };
    hotel.markModified('integrationSettings');
    await hotel.save();

    res.json({
      success: true,
      data: hotel.integrationSettings[integrationId],
      message: 'Integration settings saved successfully'
    });
  } catch (error) {
    logger.error('Failed to save integration settings', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// === CHART OF ACCOUNTS ROUTES ===
router.post('/chart-of-accounts/initialize', authorize('admin', 'manager'), validate(chartOfAccountsInitSchema), async (req, res) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(400).json({ success: false, message: 'Hotel ID required' });

    const existing = await ChartOfAccounts.countDocuments({ hotelId });
    if (existing > 0) {
      return res.json({ success: true, message: 'Accounts already exist', count: existing });
    }

    const defaultAccounts = [
      { code: '1001', name: 'Cash - Operating Account', type: 'Asset', subType: 'Current Asset', category: 'current_assets', normalBalance: 'Debit' },
      { code: '1002', name: 'Petty Cash', type: 'Asset', subType: 'Current Asset', category: 'current_assets', normalBalance: 'Debit' },
      { code: '1100', name: 'Accounts Receivable', type: 'Asset', subType: 'Current Asset', category: 'current_assets', normalBalance: 'Debit' },
      { code: '1200', name: 'Inventory', type: 'Asset', subType: 'Current Asset', category: 'current_assets', normalBalance: 'Debit' },
      { code: '1500', name: 'Property & Equipment', type: 'Asset', subType: 'Fixed Asset', category: 'fixed_assets', normalBalance: 'Debit' },
      { code: '2000', name: 'Accounts Payable', type: 'Liability', subType: 'Current Liability', category: 'current_liabilities', normalBalance: 'Credit' },
      { code: '2100', name: 'Sales Tax Payable (GST)', type: 'Liability', subType: 'Current Liability', category: 'current_liabilities', normalBalance: 'Credit' },
      { code: '2500', name: 'Long-term Debt', type: 'Liability', subType: 'Long-term Liability', category: 'long_term_liabilities', normalBalance: 'Credit' },
      { code: '3000', name: 'Owner Capital', type: 'Equity', subType: 'Owner Equity', category: 'equity', normalBalance: 'Credit' },
      { code: '3100', name: 'Retained Earnings', type: 'Equity', subType: 'Retained Earnings', category: 'equity', normalBalance: 'Credit' },
      { code: '4000', name: 'Room Revenue', type: 'Revenue', subType: 'Operating Revenue', category: 'revenue', normalBalance: 'Credit' },
      { code: '4100', name: 'Food & Beverage Revenue', type: 'Revenue', subType: 'Operating Revenue', category: 'revenue', normalBalance: 'Credit' },
      { code: '4200', name: 'Other Revenue', type: 'Revenue', subType: 'Other Revenue', category: 'revenue', normalBalance: 'Credit' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'Expense', subType: 'Cost of Goods Sold', category: 'cost_of_goods_sold', normalBalance: 'Debit' },
      { code: '6000', name: 'Salaries & Wages', type: 'Expense', subType: 'Operating Expense', category: 'operating_expenses', normalBalance: 'Debit' },
      { code: '6100', name: 'Utilities', type: 'Expense', subType: 'Operating Expense', category: 'operating_expenses', normalBalance: 'Debit' },
      { code: '6200', name: 'Marketing & Advertising', type: 'Expense', subType: 'Operating Expense', category: 'operating_expenses', normalBalance: 'Debit' },
      { code: '6300', name: 'Administrative Expenses', type: 'Expense', subType: 'Operating Expense', category: 'operating_expenses', normalBalance: 'Debit' },
    ];

    const docs = defaultAccounts.map(acc => ({
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type,
      accountSubType: acc.subType,
      category: acc.category,
      normalBalance: acc.normalBalance,
      hotelId,
      isActive: true,
      currentBalance: 0,
      createdBy: req.user?._id
    }));

    await ChartOfAccounts.insertMany(docs);
    res.json({ success: true, message: 'Default accounts created', count: docs.length });
  } catch (error) {
    logger.error('Failed to initialize chart of accounts', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

router.route('/chart-of-accounts')
  .get(authorize('admin', 'manager'), chartOfAccountsController.getAccounts)
  .post(authorize('admin', 'manager'), chartOfAccountsController.createAccount);

router.get('/chart-of-accounts/tree', authorize('admin', 'manager'), chartOfAccountsController.getAccountTree);
router.get('/chart-of-accounts/flattened', authorize('admin', 'manager'), chartOfAccountsController.getFlattenedAccounts);
router.post('/chart-of-accounts/bulk-import', authorizePolicy('financial', 'chartBulkImport'), validate(mutationBaselineSchema), requireTenantInBulkOps, chartOfAccountsController.bulkImportAccounts);

router.route('/chart-of-accounts/:id')
  .get(authorize('admin', 'manager'), chartOfAccountsController.getAccount)
  .patch(authorize('admin', 'manager'), chartOfAccountsController.updateAccount)
  .delete(authorize('admin'), chartOfAccountsController.deleteAccount);

router.get('/chart-of-accounts/:id/activity', authorize('admin', 'manager'), chartOfAccountsController.getAccountActivity);

// === GENERAL LEDGER ROUTES ===
router.get('/general-ledger', authorize('admin', 'manager'), generalLedgerController.getLedgerEntries);
router.get('/general-ledger/trial-balance', authorize('admin', 'manager'), generalLedgerController.getTrialBalance);
router.get('/general-ledger/financial-statements', authorize('admin', 'manager'), generalLedgerController.getFinancialStatements);
router.get('/general-ledger/aging-report', authorize('admin', 'manager'), generalLedgerController.getAgingReport);
router.get('/general-ledger/export', authorize('admin', 'manager'), generalLedgerController.exportLedger);
router.get('/general-ledger/account/:accountId', authorize('admin', 'manager'), generalLedgerController.getAccountLedger);
router.get('/general-ledger/verify-balance', authorize('admin', 'manager'), generalLedgerController.verifyBalance);

// === JOURNAL ENTRY ROUTES ===
router.route('/journal-entries')
  .get(authorize('admin', 'manager'), journalEntryController.getJournalEntries)
  .post(authorize('admin', 'manager'), journalEntryController.createJournalEntry);

router.get('/journal-entries/templates', authorize('admin', 'manager'), journalEntryController.getJournalTemplates);
router.post('/journal-entries/bulk-create', authorizePolicy('financial', 'journalBulkCreate'), validate(mutationBaselineSchema), requireTenantInBulkOps, journalEntryController.bulkCreateJournalEntries);

router.route('/journal-entries/:id')
  .get(authorize('admin', 'manager'), journalEntryController.getJournalEntry)
  .patch(authorize('admin', 'manager'), journalEntryController.updateJournalEntry)
  .delete(authorize('admin'), journalEntryController.deleteJournalEntry);

router.post('/journal-entries/:id/post', authorizePolicy('financial', 'journalLifecycle'), validate(mutationBaselineSchema), journalEntryController.postJournalEntry);
router.post('/journal-entries/:id/reverse', authorizePolicy('financial', 'journalLifecycle'), validate(mutationBaselineSchema), journalEntryController.reverseJournalEntry);
router.post('/journal-entries/:id/approve', authorizePolicy('financial', 'journalLifecycle'), validate(mutationBaselineSchema), journalEntryController.approveJournalEntry);
router.post('/journal-entries/:id/reject', authorizePolicy('financial', 'journalLifecycle'), validate(mutationBaselineSchema), journalEntryController.rejectJournalEntry);

// === BANK ACCOUNT ROUTES ===
router.route('/bank-accounts')
  .get(authorize('admin', 'manager'), bankAccountController.getBankAccounts)
  .post(authorize('admin', 'manager'), bankAccountController.createBankAccount);

router.get('/bank-accounts/cash-position', authorize('admin', 'manager'), bankAccountController.getCashPosition);
router.get('/bank-accounts/balances', authorize('admin', 'manager'), bankAccountController.getAccountBalances);

router.route('/bank-accounts/:id')
  .get(authorize('admin', 'manager'), bankAccountController.getBankAccount)
  .patch(authorize('admin', 'manager'), bankAccountController.updateBankAccount)
  .delete(authorize('admin'), bankAccountController.deactivateBankAccount);

router.get('/bank-accounts/:id/transactions', authorize('admin', 'manager'), bankAccountController.getTransactions);
router.post('/bank-accounts/:id/transactions', authorizePolicy('financial', 'bankTransactionCreate'), validate(mutationBaselineSchema), bankAccountController.addTransaction);
router.post('/bank-accounts/:id/reconcile', authorizePolicy('financial', 'bankReconcileImport'), validate(mutationBaselineSchema), bankAccountController.reconcileAccount);
router.post('/bank-accounts/:id/import-statement', authorizePolicy('financial', 'bankReconcileImport'), validate(mutationBaselineSchema), bankAccountController.importStatement);

// === BUDGET ROUTES ===
router.route('/budgets')
  .get(authorize('admin', 'manager'), budgetController.getBudgets)
  .post(authorize('admin', 'manager'), budgetController.createBudget);

router.get('/budgets/summary', authorize('admin', 'manager'), budgetController.getBudgetSummary);
router.get('/budgets/statistics', authorize('admin', 'manager'), budgetController.getBudgetStatistics);
router.get('/budgets/templates', authorize('admin', 'manager'), budgetController.getBudgetTemplates);
router.get('/budgets/vs-actual', authorize('admin', 'manager'), budgetController.getBudgetVsActual);
router.get('/budgets/forecast', authorize('admin', 'manager'), budgetController.generateForecast);

router.route('/budgets/:id')
  .get(authorize('admin', 'manager'), budgetController.getBudget)
  .patch(authorize('admin', 'manager'), budgetController.updateBudget)
  .delete(authorize('admin'), budgetController.deleteBudget);

router.post('/budgets/:id/submit-review', authorizePolicy('financial', 'budgetSubmitRevise'), validate(mutationBaselineSchema), budgetController.submitForReview);
router.post('/budgets/:id/approve', authorizePolicy('financial', 'budgetApprove'), validate(mutationBaselineSchema), budgetController.approveBudget);
router.post('/budgets/:id/revise', authorizePolicy('financial', 'budgetSubmitRevise'), validate(mutationBaselineSchema), budgetController.createRevision);

// === INVOICES ===
router.route('/invoices')
  .get(authorize('admin', 'manager'), async (req, res) => {
    try {
      const hotelId = req.user.hotelId;
      if (!hotelId) {
        return res.status(400).json({ status: 'error', message: 'Hotel context required' });
      }
      const invoiceFilter = {};
      invoiceFilter.hotelId = hotelId;
      const invoices = await FinancialInvoice.find(invoiceFilter)
        .populate('customer.guestId', 'name email')
        .populate('bookingReference', 'bookingNumber')
        .sort({ createdAt: -1 }).lean().limit(1000);
      
      res.status(200).json({
        status: 'success',
        data: {
          invoices
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error', 
        message: error.message
      });
    }
  })
  .post(authorize('admin', 'staff', 'manager'), async (req, res) => {
    try {
      const { customer, lineItems } = req.body;
      if (!customer?.name) {
        return res.status(400).json({ status: 'error', message: 'Customer name is required' });
      }

      const invoiceData = {
        ...req.body,
        hotelId: req.user?.hotelId,
        createdBy: req.user?.id,
        invoiceNumber: await FinancialInvoice.generateInvoiceNumber(req.user?.hotelId)
      };
      
      const invoice = new FinancialInvoice(invoiceData);
      await invoice.save();
      
      res.status(201).json({
        status: 'success',
        data: invoice
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

// Helper function for payment statistics calculation
async function calculatePaymentStatistics(FinancialPayment, query = {}) {
  try {
    const aggregationPipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          completedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
          },
          pendingPayments: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, 1, 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, '$amount', 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] }
          },
          failedAmount: {
            $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, '$amount', 0] }
          }
        }
      }
    ];

    const [stats] = await FinancialPayment.aggregate(aggregationPipeline);

    return stats || {
      totalPayments: 0,
      totalAmount: 0,
      completedPayments: 0,
      completedAmount: 0,
      pendingPayments: 0,
      pendingAmount: 0,
      failedPayments: 0,
      failedAmount: 0
    };
  } catch (error) {
    logger.error('Error calculating payment statistics', { error: error.message });
    throw error;
  }
}

// === PAYMENTS ===
router.route('/payments')
  .get(authorize('admin', 'manager'), async (req, res) => {
    try {
      // Build query filters with tenant isolation
      const hotelId = req.user.hotelId;
      if (!hotelId) {
        return res.status(400).json({ status: 'error', message: 'Hotel context required' });
      }
      let query = {};
      query.hotelId = hotelId;
      if (req.query.status) query.status = req.query.status;
      if (req.query.method) query.method = req.query.method;
      if (req.query.type) query.type = req.query.type;

      // Date range filtering
      if (req.query.startDate || req.query.endDate) {
        query.date = {};
        if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
        if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
      }

      const payments = await FinancialPayment.find(query)
        .populate('customer.guestId', 'name email')
        .populate('invoice', 'invoiceNumber totalAmount')
        .populate('bankAccount', 'accountName')
        .sort({ createdAt: -1 }).lean().limit(1000);

      // Calculate statistics if requested
      let statistics = null;
      if (req.query.includeStats === 'true') {
        statistics = await calculatePaymentStatistics(FinancialPayment, query);
      }

      const response = { status: 'success', data: payments };
      if (statistics) response.statistics = statistics;

      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  })
  .post(authorize('admin', 'staff', 'manager'), async (req, res) => {
    try {
      const { amount, method, type } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ status: 'error', message: 'Valid payment amount is required' });
      }
      if (!method) {
        return res.status(400).json({ status: 'error', message: 'Payment method is required' });
      }

      const paymentData = {
        ...req.body,
        hotelId: req.user?.hotelId,
        createdBy: req.user?.id
      };

      const payment = new FinancialPayment(paymentData);
      await payment.save();
      
      // Process the payment
      const result = await payment.process(req.user?.id);
      
      res.status(201).json({
        status: 'success',
        data: payment,
        processing: result
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

// === PAYMENT STATISTICS ===
router.get('/payments/statistics', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Build query filters with tenant isolation
    const hotelId = req.user.hotelId;
    if (!hotelId) {
      return res.status(400).json({ status: 'error', message: 'Hotel context required' });
    }
    let query = {};
    query.hotelId = hotelId;
    if (req.query.status) query.status = req.query.status;
    if (req.query.method) query.method = req.query.method;
    if (req.query.type) query.type = req.query.type;

    // Date range filtering
    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
    }

    const statistics = await calculatePaymentStatistics(FinancialPayment, query);

    res.status(200).json({
      status: 'success',
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// === FINANCIAL REPORTS ===
router.get('/reports/trial-balance', authorize('admin', 'manager', 'frontdesk'), async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      data: { accounts: [] }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// === FINANCIAL REPORTS ROUTES ===
router.get('/reports/income-statement', authorize('admin', 'manager', 'frontdesk'), financialReportsController.getIncomeStatement);
router.get('/reports/balance-sheet', authorize('admin', 'manager', 'frontdesk'), financialReportsController.getBalanceSheet);
router.get('/reports/cash-flow', authorize('admin', 'manager', 'frontdesk'), financialReportsController.getCashFlowStatement);
router.get('/reports/financial-ratios', authorize('admin', 'manager', 'frontdesk'), financialReportsController.getFinancialRatios);
router.get('/reports/comprehensive', authorize('admin', 'manager', 'frontdesk'), financialReportsController.getComprehensiveFinancialStatement);

export default router;