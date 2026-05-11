// -----------------------------------------------------------------------------
// Financial types - mirrors backend/src/models/JournalEntry.js
// and backend/src/models/ChartOfAccounts.js
// -----------------------------------------------------------------------------

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export type AccountSubType =
  | 'Current Asset'
  | 'Fixed Asset'
  | 'Other Asset'
  | 'Current Liability'
  | 'Long-term Liability'
  | 'Owner Equity'
  | 'Retained Earnings'
  | 'Operating Revenue'
  | 'Other Revenue'
  | 'Operating Expense'
  | 'Cost of Goods Sold'
  | 'Other Expense';

export type NormalBalance = 'Debit' | 'Credit';

export type JournalEntryType =
  | 'Manual'
  | 'Automatic'
  | 'Adjusting'
  | 'Closing'
  | 'Reversing'
  | 'Opening';

export type JournalEntryStatus =
  | 'Draft'
  | 'Posted'
  | 'Approved'
  | 'Rejected'
  | 'Void'
  | 'Reversed';

export type ReferenceType =
  | 'Invoice'
  | 'Payment'
  | 'Expense'
  | 'BankTransaction'
  | 'POS'
  | 'Payroll'
  | 'Manual'
  | 'SystemGenerated';

export type RecurringFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';

// -- Chart of Accounts --------------------------------------------------------

export interface AccountMetadata {
  bankAccountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  swiftCode?: string;
  branchName?: string;
}

export interface ChartOfAccount {
  _id: string;
  id?: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: AccountSubType;
  parentAccount?: string | null;
  description?: string;
  normalBalance: NormalBalance;
  currentBalance: number;
  currency: string;
  isActive: boolean;
  isSystemAccount: boolean;
  taxCode?: string | null;
  hotelId: string;
  createdBy: string;
  updatedBy?: string;
  metadata?: AccountMetadata;
  createdAt: string;
  updatedAt: string;
}

// -- Journal Entry Line -------------------------------------------------------

export interface JournalEntryLine {
  _id?: string;
  accountId: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  currency?: string;
  exchangeRate?: number;
  taxCode?: string;
  department?: string;
  project?: string;
  costCenter?: string;
}

// -- Journal Entry ------------------------------------------------------------

export interface JournalEntryAttachment {
  fileName: string;
  fileUrl: string;
  uploadedAt?: string;
}

export interface JournalEntry {
  _id: string;
  id?: string;
  entryNumber: string;
  entryDate: string;
  entryType: JournalEntryType;
  description: string;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  referenceType: ReferenceType;
  referenceId?: string;
  referenceNumber?: string;
  status: JournalEntryStatus;
  postedDate?: string;
  fiscalYear: number;
  fiscalPeriod: number;
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency | null;
  nextRecurringDate?: string;
  reversalEntry?: string;
  originalEntry?: string;
  attachments?: JournalEntryAttachment[];
  notes?: string;
  tags?: string[];
  hotelId: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}
