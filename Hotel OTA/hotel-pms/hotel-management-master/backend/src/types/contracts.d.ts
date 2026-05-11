export type ObjectIdLike = string | { toString(): string };

export interface AuthenticatedUser {
  _id: ObjectIdLike;
  role: 'guest' | 'staff' | 'frontdesk' | 'manager' | 'admin' | 'travel_agent' | string;
  hotelId?: ObjectIdLike | null;
  name?: string;
}

export interface BookingIdempotencyInput {
  clientIdempotencyKey?: string | null;
  userId?: ObjectIdLike | null;
  roomIds?: ObjectIdLike[] | null;
  checkIn?: string | Date | null;
  checkOut?: string | Date | null;
  totalAmount?: number | null;
}

export interface ResolveRoomsAndRatesInput {
  roomIds?: ObjectIdLike[] | null;
  hotelId?: ObjectIdLike | null;
  checkInDate: Date;
  checkOutDate: Date;
  session?: unknown;
}

export interface BookingCreationPreparationInput extends BookingIdempotencyInput {
  requestedUserId: ObjectIdLike;
  hotelId?: ObjectIdLike | null;
  checkIn: string | Date;
  checkOut: string | Date;
  totalAmount?: number | null;
  session?: unknown;
}

export interface SettlementAdjustmentInput {
  type: string;
  amount: number;
  description: string;
}

export interface SettlementPaymentMethodInput {
  method: string;
  amount: number;
  reference?: string;
  notes?: string;
}

export interface SettlementPaymentInput {
  paymentMethods: SettlementPaymentMethodInput[];
  amount?: number;
}

export interface BookingUpdateBody {
  [key: string]: unknown;
  guestDetails?: unknown;
}

export interface RoomAssignmentLookupInput {
  bookingId?: ObjectIdLike | null;
  guestName?: string | null;
  checkIn?: string | Date | null;
  checkOut?: string | Date | null;
}

export interface InvoiceLineItemInput {
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  [key: string]: unknown;
}

export interface InvoiceDiscountInput {
  description: string;
  type: string;
  value: number;
}

export interface SplitBillingInput {
  isEnabled: boolean;
  method: string;
  splits: unknown[];
}

export interface InvoiceCreateInput {
  bookingId: ObjectIdLike;
  type?: string;
  items: InvoiceLineItemInput[];
  dueDate: string | Date;
  discounts?: InvoiceDiscountInput[];
  splitBilling?: SplitBillingInput | null;
  notes?: string;
  billingAddress?: unknown;
  user: AuthenticatedUser;
}

export interface InvoiceUpdateInput {
  invoiceId: ObjectIdLike;
  body: Record<string, unknown>;
  user: AuthenticatedUser;
}

export interface BillingEventInput {
  hotelId: ObjectIdLike;
  invoiceId?: ObjectIdLike;
  bookingId?: ObjectIdLike;
  eventType: string;
  amount?: number;
  currency?: string;
  actorUserId?: ObjectIdLike;
  actorRole?: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface InvoicePaymentReconciliation {
  expectedAmountPaid: number;
  actualAmountPaid: number;
  isAligned: boolean;
}

export interface BookingRepositoryContract {
  findByIdempotencyKey(idempotencyKey: string): Promise<any>;
  findActiveRoomsByIds(roomIds: ObjectIdLike[], hotelId?: ObjectIdLike | null): Promise<any[]>;
  findOverlappingBookings(
    roomIds: ObjectIdLike[],
    checkInDate: Date,
    checkOutDate: Date,
    options?: Record<string, unknown>
  ): Promise<any[]>;
  findBookingByIdForUpdate(bookingId: ObjectIdLike): Promise<any>;
  findUserByNameInsensitive(name: string): Promise<any>;
  findBookingByUserDateWindow(userId: ObjectIdLike, checkInDate: Date, checkOutDate: Date): Promise<any>;
  findRoomById(roomId: ObjectIdLike): Promise<any>;
}

export interface BillingRepositoryContract {
  findBookingById(bookingId: ObjectIdLike): Promise<any>;
  findBookingWithHotel(bookingId: ObjectIdLike): Promise<any>;
  findBookingForInvoiceCreation(bookingId: ObjectIdLike): Promise<any>;
  createPaymentRecord(paymentData: Record<string, unknown>): Promise<any>;
  findInvoiceById(invoiceId: ObjectIdLike): Promise<any>;
  findInvoiceByIdLean(invoiceId: ObjectIdLike): Promise<any>;
  createInvoice(invoiceData: Record<string, unknown>): Promise<any>;
  findOneAndUpdateInvoice(matchQuery: Record<string, unknown>, updates: Record<string, unknown>): Promise<any>;
  generateSupplementaryInvoice(bookingId: ObjectIdLike, extraPersonCharges: unknown[], userId: ObjectIdLike): Promise<any>;
  generateSettlementInvoice(settlementId: ObjectIdLike, adjustments: unknown[], userId: ObjectIdLike): Promise<any>;
  addExtraChargesToInvoice(matchQuery: Record<string, unknown>, extraPersonCharges: unknown[]): Promise<any>;
  findSettlementByIdWithBooking(settlementId: ObjectIdLike): Promise<any>;
  markPaymentSucceededByIntentId(paymentIntentId: string): Promise<any>;
  setBookingPaid(bookingId: ObjectIdLike, paymentIntentId: string): Promise<any>;
  setExtraPersonChargePaid(bookingId: ObjectIdLike, personId: ObjectIdLike, paymentIntentId: string): Promise<any>;
  pushExtraPersonChargeAsPaid(
    bookingId: ObjectIdLike,
    charge: Record<string, any>,
    currency: string,
    paymentIntentId: string
  ): Promise<any>;
  appendSettlementPayment(settlementId: ObjectIdLike, payment: any, paymentIntentId: string): Promise<any>;
  setSettlementComputedStatus(settlementId: ObjectIdLike, settlement: any): Promise<any>;
  appendBillingEvent(eventData: BillingEventInput): Promise<any>;
  sumInvoiceEventAmounts(invoiceId: ObjectIdLike, eventTypes?: string[]): Promise<number>;
}

export interface BookingModuleContract {
  name: 'booking';
  routes: unknown;
  service: unknown;
  repository: unknown;
}

export interface BillingModuleContract {
  name: 'billing';
  paymentRoutes: unknown;
  invoiceRoutes: unknown;
  service: unknown;
  repository: unknown;
}
