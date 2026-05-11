// -----------------------------------------------------------------------------
// Travel Agent types - mirrors backend/src/models/TravelAgent.js
// and backend/src/models/TravelAgentBooking.js
// -----------------------------------------------------------------------------

export type TravelAgentStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'pending_approval';

export type BusinessType = 'domestic' | 'international' | 'both';

export type AgentPaymentMethod = 'bank_transfer' | 'cheque' | 'online' | 'cash';

export type CommissionPaymentStatus = 'pending' | 'paid' | 'processing' | 'cancelled';

export type TravelAgentBookingStatus =
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'modified';

export type TABookingPaymentMethod =
  | 'credit_card'
  | 'bank_transfer'
  | 'cash'
  | 'cheque'
  | 'agent_credit';

export type TABookingPaymentStatus =
  | 'pending'
  | 'paid'
  | 'partial'
  | 'failed'
  | 'refunded';

export type TABookingSource = 'direct' | 'online' | 'phone' | 'email' | 'walk_in';

export type Seasonality = 'peak' | 'high' | 'low' | 'off';

// -- Travel Agent -------------------------------------------------------------

export interface TravelAgentAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface BusinessDetails {
  licenseNumber?: string;
  gstNumber?: string;
  establishedYear?: number;
  businessType?: BusinessType;
}

export interface RoomTypeCommissionRate {
  roomTypeId: string;
  commissionRate: number;
}

export interface SeasonalCommissionRate {
  season: Seasonality;
  commissionRate: number;
  validFrom?: string;
  validTo?: string;
}

export interface CommissionStructure {
  defaultRate: number;
  roomTypeRates?: RoomTypeCommissionRate[];
  seasonalRates?: SeasonalCommissionRate[];
}

export interface AgentBookingLimits {
  maxBookingsPerDay: number;
  maxRoomsPerBooking: number;
  maxAdvanceBookingDays: number;
}

export interface AgentPaymentTerms {
  creditLimit: number;
  paymentDueDays: number;
  preferredPaymentMethod: AgentPaymentMethod;
}

export interface AgentPerformanceMetrics {
  totalBookings: number;
  totalRevenue: number;
  totalCommissionEarned: number;
  averageBookingValue: number;
  lastBookingDate?: string;
}

export interface TravelAgent {
  _id: string;
  id?: string;
  userId: string;
  agentCode: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address?: TravelAgentAddress;
  businessDetails?: BusinessDetails;
  commissionStructure: CommissionStructure;
  bookingLimits?: AgentBookingLimits;
  paymentTerms?: AgentPaymentTerms;
  status: TravelAgentStatus;
  performanceMetrics?: AgentPerformanceMetrics;
  specialRatesAccess?: boolean;
  notes?: string;
  hotelId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// -- Travel Agent Booking -----------------------------------------------------

export interface TAGuestDetails {
  primaryGuest: {
    name: string;
    email: string;
    phone: string;
  };
  totalGuests: number;
  totalRooms: number;
}

export interface TABookingRoomType {
  roomTypeId: string;
  roomTypeName: string;
  quantity: number;
  ratePerNight: number;
  specialRate?: number;
  totalAmount: number;
}

export interface TABookingDetails {
  checkIn: string;
  checkOut: string;
  nights: number;
  roomTypes: TABookingRoomType[];
}

export interface TAPricing {
  subtotal: number;
  taxes: number;
  fees: number;
  discounts: number;
  totalAmount: number;
  specialRateDiscount: number;
}

export interface TACommission {
  rate: number;
  amount: number;
  bonusRate?: number;
  bonusAmount?: number;
  totalCommission?: number;
  paymentStatus: CommissionPaymentStatus;
  paymentDate?: string;
  paymentReference?: string;
}

export interface TAPaymentDetails {
  method: TABookingPaymentMethod;
  status: TABookingPaymentStatus;
  paidAmount: number;
  pendingAmount?: number;
  paymentDate?: string;
}

export interface TASpecialConditions {
  earlyCheckin?: boolean;
  lateCheckout?: boolean;
  roomUpgrade?: boolean;
  specialRequests?: string;
}

export interface TAPerformance {
  bookingSource?: TABookingSource;
  leadTime?: number;
  seasonality?: Seasonality;
}

export interface TravelAgentBooking {
  _id: string;
  id?: string;
  bookingId: string;
  travelAgentId: string;
  agentCode: string;
  hotelId: string;
  guestDetails: TAGuestDetails;
  bookingDetails: TABookingDetails;
  pricing: TAPricing;
  commission: TACommission;
  bookingStatus: TravelAgentBookingStatus;
  paymentDetails: TAPaymentDetails;
  specialConditions?: TASpecialConditions;
  performance?: TAPerformance;
  notes?: string;
  isActive: boolean;
  confirmationNumber?: string;
  createdAt: string;
  updatedAt: string;
}
