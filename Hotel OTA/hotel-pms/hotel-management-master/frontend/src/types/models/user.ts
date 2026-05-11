// -----------------------------------------------------------------------------
// User types - mirrors backend/src/models/User.js
// -----------------------------------------------------------------------------

export type UserRole = 'guest' | 'staff' | 'frontdesk' | 'manager' | 'admin' | 'travel_agent';

export type GuestType = 'normal' | 'corporate';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type BedType = 'single' | 'double' | 'queen' | 'king';

export type OfferCategory = 'room' | 'dining' | 'spa' | 'transport' | 'general';

export type OfferType = 'discount' | 'free_service' | 'upgrade' | 'bonus_points';

export type BillingHistoryType = 'checkout_charges' | 'booking_payment' | 'service_charge' | 'refund';

export type BillingPaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer';

export type BillingPaymentStatus = 'pending' | 'paid' | 'failed';

export type TravelAgentDetailStatus = 'active' | 'inactive' | 'suspended';

export interface UserOfferPreferences {
  favoriteCategories?: OfferCategory[];
  favoriteTypes?: OfferType[];
  priceRangePreference?: {
    min: number;
    max: number;
  };
  notifications?: {
    newOffers: boolean;
    expiringOffers: boolean;
    personalizedRecommendations: boolean;
  };
}

export interface UserPreferences {
  bedType?: BedType;
  floor?: string;
  smokingAllowed?: boolean;
  other?: string;
  offers?: UserOfferPreferences;
}

export interface UserLoyalty {
  points: number;
  tier: LoyaltyTier;
}

export interface BillingAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface UserBillingDetails {
  gstNumber?: string;
  companyName?: string;
  billingAddress?: BillingAddress;
  panNumber?: string;
  billingContactPerson?: string;
  billingEmail?: string;
  billingPhone?: string;
}

export interface CorporateDetails {
  corporateCompanyId?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  costCenter?: string;
  approvalRequired?: boolean;
  approverEmail?: string;
}

export interface TravelAgentDetails {
  travelAgentId?: string;
  agentCode?: string;
  commissionRate?: number;
  bookingLimits?: {
    maxBookingsPerDay: number;
    maxRoomsPerBooking: number;
  };
  specialRatesAccess?: boolean;
  status?: TravelAgentDetailStatus;
}

export interface BillingHistoryItem {
  name: string;
  category?: string;
  status?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
}

export interface BillingHistoryEntry {
  type: BillingHistoryType;
  bookingId?: string;
  roomId?: string;
  description: string;
  items?: BillingHistoryItem[];
  subtotal?: number;
  tax?: number;
  totalAmount: number;
  paymentMethod?: BillingPaymentMethod;
  paymentStatus?: BillingPaymentStatus;
  paidAt?: string;
  checkoutInventoryId?: string;
  createdAt?: string;
}

export interface MultiPropertyAccess {
  enabled: boolean;
  allowedProperties?: string[];
  restrictions?: {
    canCreateProperties: boolean;
    canDeleteProperties: boolean;
    canManageGroups: boolean;
  };
}

export interface User {
  _id: string;
  id?: string;
  salutationId?: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  guestType?: GuestType;
  corporateDetails?: CorporateDetails;
  billingDetails?: UserBillingDetails;
  travelAgentDetails?: TravelAgentDetails;
  hotelId?: string;
  properties?: string[];
  primaryProperty?: string;
  multiPropertyAccess?: MultiPropertyAccess;
  preferences?: UserPreferences;
  loyalty?: UserLoyalty;
  billingHistory?: BillingHistoryEntry[];
  avatar?: string | null;
  timezone?: string;
  language?: string;
  department?: string | null;
  employeeId?: string | null;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

/** User profile is a subset of User used for display/settings screens. */
export interface UserProfile
  extends Pick<
    User,
    | '_id'
    | 'name'
    | 'email'
    | 'phone'
    | 'role'
    | 'avatar'
    | 'timezone'
    | 'language'
    | 'department'
    | 'preferences'
    | 'loyalty'
    | 'isActive'
  > {}
