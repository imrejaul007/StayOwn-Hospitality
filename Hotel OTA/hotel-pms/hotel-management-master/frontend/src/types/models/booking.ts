// -----------------------------------------------------------------------------
// Booking types - mirrors backend/src/models/Booking.js
// -----------------------------------------------------------------------------

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'modified'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'partially_paid'
  | 'refunded'
  | 'failed';

export type BookingSource =
  | 'direct'
  | 'ota'
  | 'admin'
  | 'guest'
  | 'system'
  | 'api'
  | 'walk_in'
  | 'manual'
  | 'frontdesk';

export type BookingRoomType = 'single' | 'double' | 'suite' | 'deluxe';

export type BookingPaymentMethod =
  | 'cash'
  | 'card'
  | 'upi'
  | 'online_portal'
  | 'corporate';

export type SettlementStatus =
  | 'not_required'
  | 'pending'
  | 'partial'
  | 'completed'
  | 'refund_pending'
  | 'refunded';

export type AdjustmentType =
  | 'extra_person_charge'
  | 'damage_charge'
  | 'minibar_charge'
  | 'service_charge'
  | 'discount'
  | 'refund'
  | 'penalty'
  | 'other';

export type CorporatePaymentMethod =
  | 'corporate_credit'
  | 'direct_billing'
  | 'advance_payment';

export interface BookingRoom {
  roomId: string;
  roomTypeId?: string;
  rate: number;
}

export interface GuestDetails {
  adults: number;
  children: number;
  specialRequests?: string;
}

export interface StatusHistoryEntry {
  status: BookingStatus;
  timestamp: string;
  changedBy: {
    source: BookingSource;
    userId?: string;
    userName?: string;
    channel?: string;
  };
  reason?: string;
  automaticTransition?: boolean;
  validatedTransition?: boolean;
}

export interface LastStatusChange {
  from?: string;
  to?: string;
  timestamp?: string;
  reason?: string;
}

export interface PaymentMethodEntry {
  method: BookingPaymentMethod;
  amount: number;
  reference?: string;
  processedBy?: string;
  processedAt?: string;
  notes?: string;
}

export interface BookingPaymentDetails {
  totalPaid: number;
  remainingAmount: number;
  paymentMethods?: PaymentMethodEntry[];
  collectedAt?: string;
  collectedBy?: string;
}

export interface SettlementAdjustment {
  type: AdjustmentType;
  amount: number;
  description: string;
  appliedAt?: string;
  appliedBy?: {
    userId?: string;
    userName?: string;
    userRole?: 'admin' | 'staff' | 'manager' | 'frontdesk';
  };
  invoiceGenerated?: boolean;
  invoiceId?: string;
}

export interface SettlementHistoryEntry {
  action:
    | 'balance_calculated'
    | 'payment_received'
    | 'refund_processed'
    | 'adjustment_applied'
    | 'settlement_completed';
  amount?: number;
  description?: string;
  timestamp?: string;
  processedBy?: {
    userId?: string;
    userName?: string;
    userRole?: 'admin' | 'staff' | 'manager' | 'frontdesk';
  };
  paymentMethod?: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'refund_to_source';
  reference?: string;
}

export interface SettlementTracking {
  status: SettlementStatus;
  finalAmount?: number;
  adjustments?: SettlementAdjustment[];
  outstandingBalance?: number;
  refundAmount?: number;
  settlementNotes?: string;
  lastUpdated?: string;
  settlementHistory?: SettlementHistoryEntry[];
  escalationLevel?: number;
  dueDate?: string;
}

export interface CorporateBookingDetails {
  corporateCompanyId?: string;
  groupBookingId?: string;
  employeeId?: string;
  department?: string;
  costCenter?: string;
  purchaseOrderNumber?: string;
  approverEmail?: string;
  paymentMethod?: CorporatePaymentMethod;
  billingEmail?: string;
}

export interface GSTDetails {
  gstNumber?: string;
  gstRate?: number;
  gstAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface BookingExtra {
  name?: string;
  price?: number;
  quantity?: number;
}

export interface ExtraPerson {
  personId?: string;
  name: string;
  type: 'adult' | 'child';
  age?: number;
  addedAt?: string;
}

export interface ModificationHistoryEntry {
  modifiedAt: string;
  modifiedBy?: string;
  changes?: Record<string, unknown>;
  reason?: string;
}

export interface Booking {
  _id: string;
  id?: string;
  hotelId: string;
  userId: string;
  bookingNumber?: string;
  rooms: BookingRoom[];
  checkIn: string;
  checkOut: string;
  nights: number;
  status: BookingStatus;
  statusHistory?: StatusHistoryEntry[];
  lastStatusChange?: LastStatusChange;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  currency: string;
  paymentDetails?: BookingPaymentDetails;
  settlementTracking?: SettlementTracking;
  roomType?: BookingRoomType;
  stripePaymentId?: string;
  idempotencyKey?: string;
  reservedUntil?: string;
  guestDetails: GuestDetails;
  corporateBooking?: CorporateBookingDetails;
  gstDetails?: GSTDetails;
  source?: 'direct' | 'walk_in' | 'booking_com' | 'expedia' | 'airbnb';
  extras?: BookingExtra[];
  extraPersons?: ExtraPerson[];
  idVerification?: {
    documentType?: 'passport' | 'national_id' | 'driving_license' | 'aadhaar' | 'voter_id' | 'other';
    documentNumber?: string;
    issuingCountry?: string;
    expiryDate?: string;
    verified?: boolean;
    verifiedBy?: string;
    verifiedAt?: string;
    frontImage?: string;
    backImage?: string;
  };
  ratePlanId?: string;
  ratePlanSnapshot?: {
    cancellationPolicy?: {
      type?: 'flexible' | 'moderate' | 'strict' | 'non_refundable';
      hoursBeforeCheckIn?: number;
      penaltyPercentage?: number;
    };
  };
  modificationHistory?: Array<{
    modifiedAt?: string;
    modifiedBy?: {
      userId?: string;
      userName?: string;
      userRole?: string;
      source?: BookingSource;
    };
    fieldChanges?: Array<{
      field: string;
      oldValue?: unknown;
      newValue?: unknown;
      displayField?: string;
    }>;
    reason?: string;
    changeType?: 'modification' | 'cancellation' | 'status_change' | 'payment' | 'room_change';
  }>;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
