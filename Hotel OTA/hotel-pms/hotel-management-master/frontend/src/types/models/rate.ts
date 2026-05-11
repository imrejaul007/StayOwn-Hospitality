// -----------------------------------------------------------------------------
// Rate Management types - mirrors backend/src/models/RateManagement.js
// -----------------------------------------------------------------------------

export type RatePlanType =
  | 'BAR'
  | 'Corporate'
  | 'Package'
  | 'Promotional'
  | 'Group'
  | 'Government'
  | 'Member';

export type CancellationPolicyType =
  | 'flexible'
  | 'moderate'
  | 'strict'
  | 'non_refundable';

export type MealPlan = 'RO' | 'BB' | 'HB' | 'FB' | 'AI';

export type DynamicPricingType =
  | 'occupancy_based'
  | 'demand_based'
  | 'event_based'
  | 'competitor_based';

export type RoomTypeEnum = 'single' | 'double' | 'suite' | 'deluxe';

export type CurrencyRateSource = 'manual' | 'auto_conversion' | 'channel_specific';

// -- Rate Plan ----------------------------------------------------------------

export interface CurrencyRate {
  currency: string;
  rate: number;
  lastUpdated?: string;
  source?: CurrencyRateSource;
}

export interface BaseRate {
  roomType: RoomTypeEnum;
  rate: number;
  currencyRates?: CurrencyRate[];
}

export interface CancellationPolicy {
  type: CancellationPolicyType;
  hoursBeforeCheckIn: number;
  penaltyPercentage: number;
}

export interface ApplicableDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface LengthOfStayDiscount {
  minNights: number;
  discountPercentage: number;
}

export interface RatePlanDiscounts {
  earlyBird?: {
    enabled: boolean;
    daysInAdvance: number;
    discountPercentage: number;
  };
  lastMinute?: {
    enabled: boolean;
    hoursBeforeCheckIn: number;
    discountPercentage: number;
  };
  lengthOfStay?: LengthOfStayDiscount[];
}

export interface RateGuardrails {
  marketSegments?: string[];
  geoRestrictions?: {
    allowedCountries: string[];
    blockedCountries: string[];
  };
  requirePromoCode?: boolean;
  promoCode?: string;
}

export interface RatePlan {
  _id: string;
  id?: string;
  planId: string;
  name: string;
  description?: string;
  type: RatePlanType;
  baseCurrency: string;
  baseRates: BaseRate[];
  validity?: {
    startDate?: string;
    endDate?: string;
  };
  bookingWindow?: {
    minAdvanceBooking: number;
    maxAdvanceBooking: number;
  };
  stayRestrictions?: {
    minNights: number;
    maxNights: number;
    closedToArrival?: string[];
    closedToDeparture?: string[];
  };
  cancellationPolicy?: CancellationPolicy;
  mealPlan?: MealPlan;
  applicableDays?: ApplicableDays;
  discounts?: RatePlanDiscounts;
  restrictions?: RateGuardrails;
  commission?: {
    percentage: number;
    fixed: number;
  };
  priority?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// -- Seasonal Rate ------------------------------------------------------------

export interface RateAdjustment {
  roomType?: RoomTypeEnum;
  adjustmentType: 'percentage' | 'fixed';
  adjustmentValue: number;
}

export interface SeasonalRate {
  _id: string;
  id?: string;
  seasonId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  rateAdjustments: RateAdjustment[];
  applicableRatePlans?: string[];
  priority?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// -- Rate Override ------------------------------------------------------------

export interface RateOverride {
  _id: string;
  id?: string;
  overrideId: string;
  date: string;
  roomType: RoomTypeEnum;
  ratePlanId?: string;
  overrideRate: number;
  currencyRates?: CurrencyRate[];
  baseCurrency: string;
  reason?: string;
  approvedBy?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// -- Dynamic Pricing ----------------------------------------------------------

export interface OccupancyThreshold {
  minOccupancy: number;
  maxOccupancy: number;
  priceAdjustment: number;
}

export interface EventTrigger {
  eventName: string;
  startDate: string;
  endDate: string;
  radius: number;
  priceAdjustment: number;
}

export interface DynamicPricingTriggers {
  occupancyBased?: {
    enabled: boolean;
    thresholds: OccupancyThreshold[];
  };
  demandBased?: {
    enabled: boolean;
    searchVolumeThreshold: number;
    bookingPaceThreshold: number;
    priceAdjustment: number;
  };
  eventBased?: {
    enabled: boolean;
    events: EventTrigger[];
  };
  competitorBased?: {
    enabled: boolean;
    competitors: { hotelId: string; weightage: number }[];
    pricePosition: string;
    adjustmentPercentage: number;
  };
}

export interface DynamicPricingConstraints {
  minRate?: number;
  maxRate?: number;
  maxDailyChange?: number;
  blackoutDates?: string[];
}

export interface DynamicPricing {
  _id: string;
  id?: string;
  ruleId: string;
  name: string;
  type: DynamicPricingType;
  triggers: DynamicPricingTriggers;
  constraints?: DynamicPricingConstraints;
  applicableRooms?: (RoomTypeEnum | 'all')[];
  applicableRatePlans?: string[];
  priority?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
