import type {
  BillingModuleContract,
  BillingRepositoryContract,
  BookingModuleContract,
  BookingRepositoryContract,
  BookingIdempotencyInput,
  BillingEventInput,
  AuthenticatedUser
} from './contracts.js';

const exampleUser: AuthenticatedUser = {
  _id: 'user-1',
  role: 'admin',
  hotelId: 'hotel-1',
  name: 'Phase 4 Verifier'
};

const exampleBookingInput: BookingIdempotencyInput = {
  clientIdempotencyKey: 'booking-key-1',
  userId: exampleUser._id,
  roomIds: ['room-1'],
  checkIn: new Date(),
  checkOut: new Date(),
  totalAmount: 2500
};

const exampleBillingEvent: BillingEventInput = {
  hotelId: 'hotel-1',
  bookingId: 'booking-1',
  invoiceId: 'invoice-1',
  eventType: 'INVOICE_CREATED',
  amount: 2500,
  currency: 'INR',
  actorUserId: exampleUser._id,
  actorRole: exampleUser.role,
  source: 'typecheck',
  metadata: {
    idempotencyKey: exampleBookingInput.clientIdempotencyKey || null
  }
};

const verifiedBookingRepository: BookingRepositoryContract = {
  async findByIdempotencyKey() { return null; },
  async findActiveRoomsByIds() { return []; },
  async findOverlappingBookings() { return []; },
  async findBookingByIdForUpdate() { return null; },
  async findUserByNameInsensitive() { return null; },
  async findBookingByUserDateWindow() { return null; },
  async findRoomById() { return null; }
};

const verifiedBillingRepository: BillingRepositoryContract = {
  async findBookingById() { return null; },
  async findBookingWithHotel() { return null; },
  async findBookingForInvoiceCreation() { return null; },
  async createPaymentRecord() { return null; },
  async findInvoiceById() { return null; },
  async findInvoiceByIdLean() { return null; },
  async createInvoice() { return null; },
  async findOneAndUpdateInvoice() { return null; },
  async generateSupplementaryInvoice() { return null; },
  async generateSettlementInvoice() { return null; },
  async addExtraChargesToInvoice() { return null; },
  async findSettlementByIdWithBooking() { return null; },
  async markPaymentSucceededByIntentId() { return null; },
  async setBookingPaid() { return null; },
  async setExtraPersonChargePaid() { return null; },
  async pushExtraPersonChargeAsPaid() { return null; },
  async appendSettlementPayment() { return null; },
  async setSettlementComputedStatus() { return null; },
  async appendBillingEvent() { return null; },
  async sumInvoiceEventAmounts() { return 0; }
};

const verifiedBookingModule: BookingModuleContract = {
  name: 'booking',
  routes: null,
  service: {
    buildIdempotencyKey: (input: BookingIdempotencyInput) => input.clientIdempotencyKey || 'generated'
  },
  repository: verifiedBookingRepository
};

const verifiedBillingModule: BillingModuleContract = {
  name: 'billing',
  paymentRoutes: null,
  invoiceRoutes: null,
  service: {
    recordEvent: (event: BillingEventInput) => event.eventType
  },
  repository: verifiedBillingRepository
};

void verifiedBookingModule;
void verifiedBookingRepository;
void verifiedBillingModule;
void verifiedBillingRepository;
void exampleBillingEvent;
