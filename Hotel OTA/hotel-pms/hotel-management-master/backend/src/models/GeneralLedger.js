import mongoose from 'mongoose';

const generalLedgerSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    required: true
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts',
    required: true
  },
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  debitAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  creditAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  runningBalance: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  baseCurrencyAmount: {
    type: Number,
    required: true
  },
  referenceType: {
    type: String,
    enum: ['Invoice', 'Payment', 'Expense', 'Journal', 'BankTransaction', 'POS', 'Payroll', 'Adjustment'],
    required: true
  },
  referenceId: {
    type: String,
    required: true
  },
  fiscalYear: {
    type: Number,
    required: true
  },
  fiscalPeriod: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  status: {
    type: String,
    enum: ['Posted', 'Pending', 'Void', 'Reversed'],
    default: 'Posted'
  },
  isReconciled: {
    type: Boolean,
    default: false
  },
  reconciledDate: {
    type: Date
  },
  reconciledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  },
  tags: [{
    type: String
  }],
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  voidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  voidedAt: {
    type: Date
  },
  voidReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for performance
generalLedgerSchema.index({ hotelId: 1, transactionDate: -1 });
generalLedgerSchema.index({ hotelId: 1, accountId: 1, transactionDate: -1 });
generalLedgerSchema.index({ journalEntryId: 1 });
generalLedgerSchema.index({ referenceType: 1, referenceId: 1 });
generalLedgerSchema.index({ hotelId: 1, fiscalYear: 1, fiscalPeriod: 1 });
generalLedgerSchema.index({ hotelId: 1, status: 1 });
generalLedgerSchema.index({ hotelId: 1, isReconciled: 1 });

// Virtual for net amount
generalLedgerSchema.virtual('netAmount').get(function() {
  return this.debitAmount - this.creditAmount;
});

// Pre-save middleware to calculate base currency amount
generalLedgerSchema.pre('save', function(next) {
  if (this.debitAmount > 0) {
    this.baseCurrencyAmount = this.debitAmount * this.exchangeRate;
  } else {
    this.baseCurrencyAmount = this.creditAmount * this.exchangeRate;
  }
  
  // Set fiscal year and period from transaction date
  const date = new Date(this.transactionDate);
  this.fiscalYear = date.getFullYear();
  this.fiscalPeriod = date.getMonth() + 1;
  
  next();
});

// Method to calculate running balance
generalLedgerSchema.methods.calculateRunningBalance = async function() {
  try {
    const previousEntry = await this.constructor.findOne({
      accountId: this.accountId,
      transactionDate: { $lt: this.transactionDate },
      status: 'Posted'
    }).sort({ transactionDate: -1, createdAt: -1 });
  
    const previousBalance = previousEntry ? previousEntry.runningBalance : 0;
  
    // Get account to determine normal balance
    const account = await mongoose.model('ChartOfAccounts').findById(this.accountId);
  
    if (account.normalBalance === 'Debit') {
      this.runningBalance = previousBalance + this.debitAmount - this.creditAmount;
    } else {
      this.runningBalance = previousBalance + this.creditAmount - this.debitAmount;
    }
  
    return this.runningBalance;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get trial balance
generalLedgerSchema.statics.getTrialBalance = async function(hotelId, date) {
  try {
    // Temporarily bypass hotel filtering for testing
    const matchFilter = hotelId 
      ? { hotelId: mongoose.Types.ObjectId(hotelId), transactionDate: { $lte: date }, status: 'Posted' }
      : { transactionDate: { $lte: date }, status: 'Posted' };
    
    const pipeline = [
      {
        $match: matchFilter
      },
      {
        $group: {
          _id: '$accountId',
          totalDebits: { $sum: '$debitAmount' },
          totalCredits: { $sum: '$creditAmount' }
        }
      },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: '_id',
          foreignField: '_id',
          as: 'account'
        }
      },
      {
        $unwind: '$account'
      },
      {
        $project: {
          accountCode: '$account.accountCode',
          accountName: '$account.accountName',
          accountType: '$account.accountType',
          debitBalance: {
            $cond: [
              { $gt: [{ $subtract: ['$totalDebits', '$totalCredits'] }, 0] },
              { $subtract: ['$totalDebits', '$totalCredits'] },
              0
            ]
          },
          creditBalance: {
            $cond: [
              { $gt: [{ $subtract: ['$totalCredits', '$totalDebits'] }, 0] },
              { $subtract: ['$totalCredits', '$totalDebits'] },
              0
            ]
          }
        }
      },
      {
        $sort: { accountCode: 1 }
      }
    ];
  
    return this.aggregate(pipeline);
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get account balance
generalLedgerSchema.statics.getAccountBalance = async function(accountId, date = new Date()) {
  try {
    const result = await this.aggregate([
      {
        $match: {
          accountId: mongoose.Types.ObjectId(accountId),
          transactionDate: { $lte: date },
          status: 'Posted'
        }
      },
      {
        $group: {
          _id: null,
          totalDebits: { $sum: '$debitAmount' },
          totalCredits: { $sum: '$creditAmount' }
        }
      }
    ]);
  
    if (result.length === 0) {
      return 0;
    }
  
    const account = await mongoose.model('ChartOfAccounts').findById(accountId);
    const { totalDebits, totalCredits } = result[0];
  
    if (account.normalBalance === 'Debit') {
      return totalDebits - totalCredits;
    } else {
      return totalCredits - totalDebits;
    }
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

/**
 * Verify ledger balance integrity.
 * Compares sum of all posted debits vs credits and checks for imbalances.
 * @param {ObjectId|string} hotelId
 * @param {Object} options - { fiscalYear, fiscalPeriod, tolerance }
 * @returns {Object} { balanced, totalDebits, totalCredits, difference, accounts[] }
 */
generalLedgerSchema.statics.verifyBalance = async function(hotelId, options = {}) {
  try {
    const { fiscalYear, fiscalPeriod, tolerance = 0.01 } = options;

    const matchFilter = { status: 'Posted' };
    if (hotelId) matchFilter.hotelId = new mongoose.Types.ObjectId(hotelId);
    if (fiscalYear) matchFilter.fiscalYear = fiscalYear;
    if (fiscalPeriod) matchFilter.fiscalPeriod = fiscalPeriod;

    // Overall totals
    const [totals] = await this.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalDebits: { $sum: '$debitAmount' },
          totalCredits: { $sum: '$creditAmount' },
          entryCount: { $sum: 1 }
        }
      }
    ]);

    if (!totals) {
      return { balanced: true, totalDebits: 0, totalCredits: 0, difference: 0, entryCount: 0, accounts: [] };
    }

    const difference = Math.abs(totals.totalDebits - totals.totalCredits);
    const balanced = difference < tolerance;

    // Per-account breakdown for debugging imbalances
    const accounts = await this.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$accountId',
          totalDebits: { $sum: '$debitAmount' },
          totalCredits: { $sum: '$creditAmount' },
          entryCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: '_id',
          foreignField: '_id',
          as: 'account'
        }
      },
      { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          accountCode: '$account.accountCode',
          accountName: '$account.accountName',
          accountType: '$account.accountType',
          totalDebits: 1,
          totalCredits: 1,
          netBalance: { $subtract: ['$totalDebits', '$totalCredits'] },
          entryCount: 1
        }
      },
      { $sort: { accountCode: 1 } }
    ]);

    return {
      balanced,
      totalDebits: totals.totalDebits,
      totalCredits: totals.totalCredits,
      difference,
      entryCount: totals.entryCount,
      accounts
    };
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

const GeneralLedger = mongoose.model('GeneralLedger', generalLedgerSchema);

export default GeneralLedger;
