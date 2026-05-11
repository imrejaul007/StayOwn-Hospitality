// -----------------------------------------------------------------------------
// Corporate types - mirrors backend/src/models/CorporateCompany.js
// and backend/src/models/CorporateCredit.js
// -----------------------------------------------------------------------------

export type BillingCycle = 'immediate' | 'weekly' | 'monthly' | 'quarterly';

export type CreditTransactionType =
  | 'debit'
  | 'credit'
  | 'adjustment'
  | 'refund'
  | 'payment';

export type CreditTransactionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'processed'
  | 'cancelled';

export type CreditCategory =
  | 'accommodation'
  | 'services'
  | 'extras'
  | 'taxes'
  | 'fees'
  | 'adjustment';

export type CreditPaymentMethod =
  | 'bank_transfer'
  | 'cheque'
  | 'cash'
  | 'online'
  | 'adjustment';

export type CreditSource = 'booking' | 'manual' | 'system' | 'import';

// -- Corporate Company --------------------------------------------------------

export interface CorporateAddress {
  street: string;
  city: string;
  state: string;
  country?: string;
  zipCode: string;
}

export interface HRContact {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
}

export interface ContractDetails {
  contractNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  discountPercentage?: number;
  specialTerms?: string;
}

export interface CorporateCompanyMetadata {
  createdBy?: string;
  lastModifiedBy?: string;
  notes?: string;
  tags?: string[];
}

export interface CorporateGSTDetails {
  gstNumber: string;
  panNumber?: string;
}

export interface CorporateCompany {
  _id: string;
  id?: string;
  hotelId: string;
  name: string;
  email: string;
  phone?: string;
  gstNumber: string;
  panNumber?: string;
  address: CorporateAddress;
  creditLimit: number;
  availableCredit: number;
  paymentTerms: 15 | 30 | 45 | 60 | 90;
  hrContacts: HRContact[];
  contractDetails?: ContractDetails;
  billingCycle: BillingCycle;
  isActive: boolean;
  metadata?: CorporateCompanyMetadata;
  createdAt: string;
  updatedAt: string;
}

// -- Corporate Credit ---------------------------------------------------------

export interface CreditPaymentDetails {
  paymentMethod?: CreditPaymentMethod;
  paymentReference?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    transactionId?: string;
  };
}

export interface CreditApprovalDetails {
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
}

export interface CreditMetadata {
  createdBy?: string;
  lastModifiedBy?: string;
  source?: CreditSource;
  tags?: string[];
  notes?: string;
}

export interface CorporateCredit {
  _id: string;
  id?: string;
  hotelId: string;
  corporateCompanyId: string;
  bookingId?: string;
  invoiceId?: string;
  groupBookingId?: string;
  transactionType: CreditTransactionType;
  amount: number;
  balance?: number;
  description: string;
  reference?: string;
  transactionDate: string;
  dueDate?: string;
  status: CreditTransactionStatus;
  category?: CreditCategory;
  paymentDetails?: CreditPaymentDetails;
  approvalDetails?: CreditApprovalDetails;
  metadata?: CreditMetadata;
  createdAt: string;
  updatedAt: string;
}
