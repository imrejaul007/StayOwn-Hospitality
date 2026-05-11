// -----------------------------------------------------------------------------
// Payment types - mirrors backend/src/models/Payment.js
// -----------------------------------------------------------------------------

export type StripePaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethod = 'card' | 'cash' | 'bank_transfer';

export interface Refund {
  stripeRefundId?: string;
  amount: number;
  reason?: string;
  createdAt?: string;
}

export interface Payment {
  _id: string;
  id?: string;
  bookingId: string;
  hotelId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: StripePaymentStatus;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, string>;
  refunds?: Refund[];
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}
