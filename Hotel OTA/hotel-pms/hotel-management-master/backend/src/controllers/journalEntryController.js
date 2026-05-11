import JournalEntry from '../models/JournalEntry.js';
import ChartOfAccounts from '../models/ChartOfAccounts.js';
import GeneralLedger from '../models/GeneralLedger.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

// Get journal entries with filtering
export const getJournalEntries = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const {
    status,
    entryType,
    startDate,
    endDate = new Date().toISOString(),
    referenceType,
    page = 1,
    limit = 50
  } = req.query;

  let filter = { hotelId };
  
  if (status) filter.status = status;
  if (entryType) filter.entryType = entryType;
  if (referenceType) filter.referenceType = referenceType;
  
  if (startDate) {
    filter.entryDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [entries, totalEntries] = await Promise.all([
    JournalEntry.find(filter)
      .populate('createdBy approvedBy', 'name email')
      .populate('lines.accountId', 'accountCode accountName accountType')
      .sort({ entryDate: -1, entryNumber: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    JournalEntry.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    results: entries.length,
    data: {
      entries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalEntries / parseInt(limit)),
        total: totalEntries,
        limit: parseInt(limit)
      }
    }
  });
});

// Get single journal entry
export const getJournalEntry = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { id } = req.params;

  const entry = await JournalEntry.findOne({ _id: id, hotelId })
    .populate('createdBy approvedBy voidedBy', 'name email')
    .populate('lines.accountId', 'accountCode accountName accountType normalBalance')
    .populate('reversalEntry originalEntry', 'entryNumber description status').lean();

  if (!entry) {
    return res.status(404).json({
      status: 'error',
      message: 'Journal entry not found'
    });
  }

  // Get related general ledger entries if posted
  let ledgerEntries = [];
  if (entry.status === 'Posted') {
    ledgerEntries = await GeneralLedger.find({
      journalEntryId: entry._id
    }).populate('accountId', 'accountCode accountName').lean().limit(1000);
  }

  res.status(200).json({
    status: 'success',
    data: {
      entry,
      ledgerEntries
    }
  });
});

// Create new journal entry
export const createJournalEntry = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  
  // Validate that all accounts exist and belong to hotel
  const accountIds = req.body.lines?.map(line => line.accountId) || [];
  const accounts = await ChartOfAccounts.find({
    _id: { $in: accountIds },
    hotelId,
    isActive: true
  }).lean().limit(1000);

  if (accounts.length !== accountIds.length) {
    return res.status(400).json({
      status: 'error',
      message: 'One or more accounts not found or inactive'
    });
  }

  // Generate entry number if not provided
  let entryNumber = req.body.entryNumber;
  if (!entryNumber) {
    entryNumber = await JournalEntry.generateEntryNumber(hotelId);
  }

  const entryData = {
    ...req.body,
    entryNumber,
    hotelId,
    createdBy: userId
  };

  const entry = await JournalEntry.create(entryData);
  
  await entry.populate('createdBy', 'name email');
  await entry.populate('lines.accountId', 'accountCode accountName accountType');

  logger.info(`Journal entry created: ${entry.entryNumber}`, {
    entryId: entry._id,
    totalDebit: entry.totalDebit,
    totalCredit: entry.totalCredit,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: { entry }
  });
});

// Update journal entry (only drafts can be updated)
export const updateJournalEntry = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const entry = await JournalEntry.findOne({ _id: id, hotelId }).lean();
  
  if (!entry) {
    return res.status(404).json({
      status: 'error',
      message: 'Journal entry not found'
    });
  }

  if (entry.status !== 'Draft') {
    return res.status(400).json({
      status: 'error',
      message: 'Only draft entries can be updated'
    });
  }

  // Validate accounts if lines are being updated
  if (req.body.lines) {
    const accountIds = req.body.lines.map(line => line.accountId);
    const accounts = await ChartOfAccounts.find({
      _id: { $in: accountIds },
      hotelId,
      isActive: true
    }).lean().limit(1000);

    if (accounts.length !== accountIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'One or more accounts not found or inactive'
      });
    }
  }

  const updatedEntry = await JournalEntry.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  ).populate('lines.accountId', 'accountCode accountName accountType');

  logger.info(`Journal entry updated: ${updatedEntry.entryNumber}`, {
    entryId: updatedEntry._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: { entry: updatedEntry }
  });
});

// Post journal entry (create general ledger entries)
export const postJournalEntry = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const entry = await JournalEntry.findOne({ _id: id, hotelId }).lean();
  
  if (!entry) {
    return res.status(404).json({
      status: 'error',
      message: 'Journal entry not found'
    });
  }

  try {
    const postedEntry = await entry.post(userId);
    
    await postedEntry.populate('lines.accountId', 'accountCode accountName accountType');

    logger.info(`Journal entry posted: ${postedEntry.entryNumber}`, {
      entryId: postedEntry._id,
      totalAmount: postedEntry.totalDebit,
      hotelId,
      userId
    });

    res.status(200).json({
      status: 'success',
      message: 'Journal entry posted successfully',
      data: { entry: postedEntry }
    });

  } catch (error) {
    logger.error(`Failed to post journal entry: ${entry.entryNumber}`, error);
    
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Reverse journal entry
export const reverseJournalEntry = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;
  const { reason = 'Manual reversal' } = req.body;

  const entry = await JournalEntry.findOne({ _id: id, hotelId }).lean();
  
  if (!entry) {
    return res.status(404).json({
      status: 'error',
      message: 'Journal entry not found'
    });
  }

  try {
    const reversalEntry = await entry.reverse(userId, reason);
    
    await reversalEntry.populate('lines.accountId', 'accountCode accountName accountType');

    logger.info(`Journal entry reversed: ${entry.entryNumber}`, {
      originalEntryId: entry._id,
      reversalEntryId: reversalEntry._id,
      reason,
      hotelId,
      userId
    });

    res.status(200).json({
      status: 'success',
      message: 'Journal entry reversed successfully',
      data: { 
        originalEntry: entry,
        reversalEntry 
      }
    });

  } catch (error) {
    logger.error(`Failed to reverse journal entry: ${entry.entryNumber}`, error);
    
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Delete journal entry (only drafts)
export const deleteJournalEntry = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const entry = await JournalEntry.findOne({ _id: id, hotelId }).lean();
  
  if (!entry) {
    return res.status(404).json({
      status: 'error',
      message: 'Journal entry not found'
    });
  }

  if (entry.status !== 'Draft') {
    return res.status(400).json({
      status: 'error',
      message: 'Only draft entries can be deleted'
    });
  }

  await JournalEntry.findByIdAndDelete(id);

  logger.info(`Journal entry deleted: ${entry.entryNumber}`, {
    entryId: entry._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Journal entry deleted successfully'
  });
});

// Approve journal entry
export const approveJournalEntry = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;
  const { comments } = req.body;

  // Atomically transition from Draft to Approved
  const entry = await JournalEntry.findOneAndUpdate(
    { _id: id, hotelId, status: 'Draft' },
    {
      $set: {
        status: 'Approved',
        approvedBy: userId,
        approvedAt: new Date()
      }
    },
    { new: true, runValidators: true }
  );

  // Append approval comments to notes if provided (separate atomic op)
  if (entry && comments) {
    await JournalEntry.findOneAndUpdate(
      { _id: id },
      { $set: { notes: (entry.notes || '') + `\nApproval: ${comments}` } },
      { new: true }
    );
  }

  if (!entry) {
    // Distinguish between not found and wrong status
    const existing = await JournalEntry.findOne({ _id: id, hotelId }).lean();
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Journal entry not found'
      });
    }
    return res.status(400).json({
      status: 'error',
      message: 'Only draft entries can be approved'
    });
  }

  const populatedEntry = await JournalEntry.findById(id)
    .populate('approvedBy', 'name email');

  logger.info(`Journal entry approved: ${entry.entryNumber}`, {
    entryId: entry._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Journal entry approved successfully',
    data: { entry: populatedEntry }
  });
});

// Reject journal entry
export const rejectJournalEntry = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({
      status: 'error',
      message: 'Rejection reason is required'
    });
  }

  // Atomically transition from Draft to Rejected
  const entry = await JournalEntry.findOneAndUpdate(
    { _id: id, hotelId, status: 'Draft' },
    {
      $set: {
        status: 'Rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason
      }
    },
    { new: true, runValidators: true }
  );

  if (!entry) {
    const existing = await JournalEntry.findOne({ _id: id, hotelId }).lean();
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Journal entry not found'
      });
    }
    return res.status(400).json({
      status: 'error',
      message: 'Only draft entries can be rejected'
    });
  }

  const populatedEntry = await JournalEntry.findById(id)
    .populate('rejectedBy', 'name email');

  logger.info(`Journal entry rejected: ${entry.entryNumber}`, {
    entryId: entry._id,
    reason,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Journal entry rejected',
    data: { entry: populatedEntry }
  });
});

// Get journal entry templates
export const getJournalTemplates = catchAsync(async (req, res) => {
  const templates = [
    {
      name: 'Revenue Recognition',
      description: 'Record revenue from hotel operations',
      lines: [
        { accountType: 'Asset', description: 'Cash or Accounts Receivable' },
        { accountType: 'Revenue', description: 'Hotel Revenue' }
      ]
    },
    {
      name: 'Expense Payment',
      description: 'Record payment of operating expenses',
      lines: [
        { accountType: 'Expense', description: 'Operating Expense' },
        { accountType: 'Asset', description: 'Cash or Bank Account' }
      ]
    },
    {
      name: 'Asset Purchase',
      description: 'Record purchase of fixed assets',
      lines: [
        { accountType: 'Asset', description: 'Fixed Asset' },
        { accountType: 'Asset', description: 'Cash or Accounts Payable' }
      ]
    },
    {
      name: 'Depreciation',
      description: 'Record depreciation expense',
      lines: [
        { accountType: 'Expense', description: 'Depreciation Expense' },
        { accountType: 'Asset', description: 'Accumulated Depreciation' }
      ]
    },
    {
      name: 'Loan Payment',
      description: 'Record loan principal and interest payment',
      lines: [
        { accountType: 'Liability', description: 'Loan Principal' },
        { accountType: 'Expense', description: 'Interest Expense' },
        { accountType: 'Asset', description: 'Cash' }
      ]
    }
  ];

  res.status(200).json({
    status: 'success',
    data: { templates }
  });
});

// Bulk create journal entries
export const bulkCreateJournalEntries = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Entries array is required'
    });
  }

  const results = {
    created: [],
    errors: []
  };

  for (const entryData of entries) {
    try {
      // Generate entry number
      const entryNumber = await JournalEntry.generateEntryNumber(hotelId);

      const entry = await JournalEntry.create({
        ...entryData,
        entryNumber,
        hotelId,
        createdBy: userId
      });

      results.created.push(entry);

    } catch (error) {
      results.errors.push({
        entry: entryData,
        error: error.message
      });
    }
  }

  logger.info(`Bulk journal entry creation completed`, {
    created: results.created.length,
    errors: results.errors.length,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: results
  });
});

export default {
  getJournalEntries,
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  deleteJournalEntry,
  approveJournalEntry,
  rejectJournalEntry,
  getJournalTemplates,
  bulkCreateJournalEntries
};
