// Smart Pricing Engine for Habixo
import { Property, Booking } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const pricingLogger = logger.child({ service: 'PricingService' });

// ── Pricing Multipliers ─────────────────────────────────────────────────────────

export const PRICING_FACTORS = {
  weekdayMultiplier: 1.0,
  weekendMultiplier: 1.2,
  peakSeasonMultiplier: 1.5,
  offSeasonMultiplier: 0.8,
  lastMinuteDiscount: 0.9,
  lastMinuteThresholdDays: 7,
  longStayDiscount: 0.85,
  longStayThresholdNights: 7,
  eventMultiplier: 1.3,
  highDemandMultiplier: 1.25,
  lowDemandMultiplier: 0.9,
  guestExtraPricePerPerson: 50,
  maxGuestsIncluded: 2,
} as const;

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface PriceCalculationInput {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests?: {
    adults: number;
    children?: number;
    infants?: number;
  };
}

export interface DailyPriceBreakdown {
  date: string;
  basePrice: number;
  dayOfWeekMultiplier: number;
  seasonalMultiplier: number;
  demandMultiplier: number;
  eventMultiplier: number;
  finalNightlyPrice: number;
  isWeekend: boolean;
  isPeakSeason: boolean;
  hasEvent: boolean;
}

export interface SmartPriceResult {
  propertyId: string;
  pricing: {
    basePrice: number;
    adjustedPrice: number;
    totalNights: number;
    subtotal: number;
    cleaningFee: number;
    serviceFee: number;
    taxes: number;
    discount: number;
    discountDescription: string;
    total: number;
    currency: string;
    avgNightlyRate: number;
  };
  breakdown: DailyPriceBreakdown[];
  factors: {
    isWeekendStay: boolean;
    isLastMinute: boolean;
    isLongStay: boolean;
    isPeakSeason: boolean;
    hasEvents: boolean;
    demandLevel: 'low' | 'medium' | 'high';
  };
  recommendations: {
    suggestedMinPrice: number;
    suggestedMaxPrice: number;
    competitivePrice: number;
    marketAverage: number;
  };
  metadata: {
    calculatedAt: string;
    pricingVersion: string;
  };
}

export interface HostPricingRules {
  propertyId: string;
  hostId: string;
  customRules: {
    minPrice: number;
    maxPrice: number;
    weekendPremium: number;
    lastMinuteDiscount: number;
    longStayDiscount: number;
    seasonalAdjustments: SeasonalAdjustment[];
    eventPricing: EventPricing[];
    blockedDates: string[];
    customPricing: CustomPricing[];
  };
  autoPricingEnabled: boolean;
  competitorBasedPricing: boolean;
  lastUpdated: string;
}

export interface SeasonalAdjustment {
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
}

export interface EventPricing {
  eventId: string;
  eventName: string;
  startDate: string;
  endDate: string;
  multiplier: number;
  city?: string;
}

export interface CustomPricing {
  date: string;
  price: number;
  reason: string;
}

// ── Helper Functions ───────────────────────────────────────────────────────────

/**
 * Check if a date is a weekend (Friday night or Saturday/Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6;
}

/**
 * Check if a date falls within peak season
 * Peak seasons: Summer (May-June), Holiday (Dec-Jan), Spring Break (Mar-Apr)
 */
function isPeakSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();

  // Summer peak: May 15 - Aug 31
  if (month >= 4 && month <= 7) return true;

  // Holiday peak: Dec 20 - Jan 5
  if (month === 11 && day >= 20) return true;
  if (month === 0 && day <= 5) return true;

  // Spring break: Mar 15 - Apr 15
  if (month === 2 && day >= 15) return true;
  if (month === 3 && day <= 15) return true;

  return false;
}

/**
 * Get day of week multiplier
 */
function getDayOfWeekMultiplier(date: Date): number {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return PRICING_FACTORS.weekendMultiplier;
  }
  return PRICING_FACTORS.weekdayMultiplier;
}

/**
 * Calculate days until check-in for last-minute detection
 */
function getDaysUntilCheckIn(checkIn: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = checkIn.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get local events for a city (placeholder - would integrate with event APIs)
 */
async function getLocalEvents(city: string, startDate: Date, endDate: Date): Promise<{
  eventName: string;
  eventDate: Date;
  impact: 'high' | 'medium' | 'low';
}[]> {
  // In production, this would call event APIs like Eventbrite, Meetup, etc.
  // For now, return empty array - events would be cached/looked up
  return [];
}

/**
 * Get competitor pricing (placeholder - would integrate with pricing APIs)
 */
async function getCompetitorPricing(
  location: { lat: number; lng: number },
  dates: Date[]
): Promise<{ avgPrice: number; minPrice: number; maxPrice: number }> {
  // In production, this would aggregate pricing from similar properties
  // using scraped data or third-party pricing APIs
  return {
    avgPrice: 0,
    minPrice: 0,
    maxPrice: 0,
  };
}

/**
 * Calculate historical booking rate for a property
 */
async function getHistoricalBookingRate(propertyId: string): Promise<{
  rate: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  sampleSize: number;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const bookings = await Booking.countDocuments({
    propertyId,
    createdAt: { $gte: thirtyDaysAgo },
  });

  // Assume 30 possible booking windows in 30 days
  const bookingRate = Math.min(bookings / 30, 1);

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (bookingRate > 0.7) trend = 'increasing';
  else if (bookingRate < 0.3) trend = 'decreasing';

  return {
    rate: bookingRate,
    trend,
    sampleSize: bookings,
  };
}

/**
 * Calculate demand level based on booking rate and season
 */
function calculateDemandLevel(
  bookingRate: number,
  isPeakSeason: boolean,
  hasEvents: boolean
): 'low' | 'medium' | 'high' {
  if (hasEvents || (isPeakSeason && bookingRate > 0.5)) return 'high';
  if (bookingRate > 0.6) return 'high';
  if (bookingRate < 0.3 && !isPeakSeason) return 'low';
  return 'medium';
}

/**
 * Get demand multiplier
 */
function getDemandMultiplier(demandLevel: 'low' | 'medium' | 'high'): number {
  switch (demandLevel) {
    case 'high':
      return PRICING_FACTORS.highDemandMultiplier;
    case 'low':
      return PRICING_FACTORS.lowDemandMultiplier;
    default:
      return 1.0;
  }
}

// ── Main Smart Pricing Functions ───────────────────────────────────────────────

/**
 * Calculate smart price for a property and date range
 */
export async function calculateSmartPrice(
  propertyId: string,
  dates: { checkIn: string; checkOut: string },
  guests?: { adults: number; children?: number; infants?: number }
): Promise<SmartPriceResult> {
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  const checkInDate = new Date(dates.checkIn);
  const checkOutDate = new Date(dates.checkOut);
  const totalGuests = (guests?.adults || 1) + (guests?.children || 0);

  // Generate date range
  const dateRange: Date[] = [];
  const currentDate = new Date(checkInDate);
  while (currentDate < checkOutDate) {
    dateRange.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const totalNights = dateRange.length;
  const daysUntilCheckIn = getDaysUntilCheckIn(checkInDate);

  // Get contextual data
  const [events, competitorData, bookingRateData] = await Promise.all([
    getLocalEvents(property.location.city, checkInDate, checkOutDate),
    getCompetitorPricing(property.location, dateRange),
    getHistoricalBookingRate(propertyId),
  ]);

  const hasEvents = events.length > 0;
  const isLastMinute = daysUntilCheckIn <= PRICING_FACTORS.lastMinuteThresholdDays;
  const isLongStay = totalNights >= PRICING_FACTORS.longStayThresholdNights;
  const hasEventToday = (date: Date) =>
    events.some((e) => e.eventDate.toDateString() === date.toDateString());

  // Calculate daily breakdown
  const breakdown: DailyPriceBreakdown[] = [];
  let subtotal = 0;

  for (const date of dateRange) {
    const isWeekendDay = isWeekend(date);
    const isPeak = isPeakSeason(date);
    const eventData = hasEventToday(date);
    const dayOfWeekMultiplier = getDayOfWeekMultiplier(date);

    let seasonalMultiplier = 1.0;
    if (isPeak) {
      seasonalMultiplier = PRICING_FACTORS.peakSeasonMultiplier;
    } else if (date.getMonth() >= 9 || date.getMonth() <= 1) {
      // Off season: Oct-Feb
      seasonalMultiplier = PRICING_FACTORS.offSeasonMultiplier;
    }

    let demandMultiplier = getDemandMultiplier(
      calculateDemandLevel(bookingRateData.rate, isPeak, hasEvents)
    );

    let eventMultiplier = 1.0;
    if (eventData) {
      const event = events.find((e) => e.eventDate.toDateString() === date.toDateString());
      if (event) {
        eventMultiplier = event.impact === 'high' ? 1.4 : event.impact === 'medium' ? 1.2 : 1.1;
      }
    }

    // Guest count adjustment
    let guestMultiplier = 1.0;
    if (totalGuests > PRICING_FACTORS.maxGuestsIncluded) {
      const extraGuests = totalGuests - PRICING_FACTORS.maxGuestsIncluded;
      guestMultiplier =
        1 + (extraGuests * PRICING_FACTORS.guestExtraPricePerPerson) / property.pricing.basePrice;
    }

    const finalNightlyPrice = Math.round(
      property.pricing.basePrice *
        dayOfWeekMultiplier *
        seasonalMultiplier *
        demandMultiplier *
        eventMultiplier *
        guestMultiplier
    );

    breakdown.push({
      date: date.toISOString().split('T')[0],
      basePrice: property.pricing.basePrice,
      dayOfWeekMultiplier,
      seasonalMultiplier,
      demandMultiplier,
      eventMultiplier,
      finalNightlyPrice,
      isWeekend: isWeekendDay,
      isPeakSeason: isPeak,
      hasEvent: eventData,
    });

    subtotal += finalNightlyPrice;
  }

  // Calculate adjustments
  let adjustedSubtotal = subtotal;

  // Last minute discount
  let lastMinuteDiscountAmount = 0;
  if (isLastMinute) {
    lastMinuteDiscountAmount = adjustedSubtotal * (1 - PRICING_FACTORS.lastMinuteDiscount);
    adjustedSubtotal *= PRICING_FACTORS.lastMinuteDiscount;
  }

  // Long stay discount
  let longStayDiscountAmount = 0;
  let discountDescription = '';
  if (isLongStay) {
    longStayDiscountAmount = adjustedSubtotal * (1 - PRICING_FACTORS.longStayDiscount);
    adjustedSubtotal *= PRICING_FACTORS.longStayDiscount;
    discountDescription = `Long stay discount (${totalNights} nights)`;
  }

  const totalDiscount = lastMinuteDiscountAmount + longStayDiscountAmount;

  // Apply host's custom pricing rules if available
  // In production, this would fetch from a HostPricingRules collection

  const cleaningFee = property.pricing.cleaningFee || 0;
  const serviceFee = adjustedSubtotal * 0.03; // 3% service fee
  const taxes = (adjustedSubtotal + serviceFee) * 0.18; // 18% GST
  const total = adjustedSubtotal + cleaningFee + serviceFee + taxes;

  // Calculate recommendations
  const avgNightlyRate = Math.round(adjustedSubtotal / totalNights);
  const competitivePrice = competitorData.avgPrice > 0
    ? Math.round((property.pricing.basePrice + competitorData.avgPrice) / 2)
    : property.pricing.basePrice;

  const suggestedMinPrice = Math.round(property.pricing.basePrice * 0.8);
  const suggestedMaxPrice = Math.round(property.pricing.basePrice * 1.5);

  const isWeekendStay = dateRange.some((d) => isWeekend(d));

  pricingLogger.info(
    { propertyId, totalNights, total, avgNightlyRate },
    'Smart price calculated'
  );

  return {
    propertyId,
    pricing: {
      basePrice: property.pricing.basePrice,
      adjustedPrice: avgNightlyRate,
      totalNights,
      subtotal: adjustedSubtotal,
      cleaningFee,
      serviceFee,
      taxes,
      discount: totalDiscount,
      discountDescription: discountDescription || 'No discount applied',
      total,
      currency: property.pricing.currency || 'INR',
      avgNightlyRate,
    },
    breakdown,
    factors: {
      isWeekendStay,
      isLastMinute,
      isLongStay,
      isPeakSeason: dateRange.some((d) => isPeakSeason(d)),
      hasEvents,
      demandLevel: calculateDemandLevel(bookingRateData.rate, isPeakSeason(checkInDate), hasEvents),
    },
    recommendations: {
      suggestedMinPrice,
      suggestedMaxPrice,
      competitivePrice,
      marketAverage: competitorData.avgPrice,
    },
    metadata: {
      calculatedAt: new Date().toISOString(),
      pricingVersion: '1.0.0',
    },
  };
}

/**
 * Get AI-recommended price with additional intelligence
 */
export async function getAIRecommendedPrice(
  propertyId: string,
  dates: { checkIn: string; checkOut: string },
  guests?: { adults: number; children?: number; infants?: number }
): Promise<{
  recommendedPrice: number;
  confidence: number;
  factors: string[];
  optimalPricing: {
    conservative: number;
    recommended: number;
    aggressive: number;
  };
  insights: {
    marketPosition: string;
    demandForecast: string;
    revenueOpportunity: string;
  };
}> {
  const smartPrice = await calculateSmartPrice(propertyId, dates, guests);

  const {
    pricing,
    factors,
    recommendations,
  } = smartPrice;

  // Calculate confidence based on data availability
  let confidence = 0.7; // Base confidence
  if (recommendations.marketAverage > 0) confidence += 0.1;
  if (factors.hasEvents) confidence += 0.1;
  if (factors.isPeakSeason) confidence += 0.1;
  confidence = Math.min(confidence, 0.95);

  // Build factors explanation
  const pricingFactors: string[] = [];
  if (factors.isWeekendStay) pricingFactors.push('Weekend pricing applied');
  if (factors.isLastMinute) pricingFactors.push('Last-minute availability');
  if (factors.isLongStay) pricingFactors.push('Long stay discount');
  if (factors.isPeakSeason) pricingFactors.push('Peak season rates');
  if (factors.hasEvents) pricingFactors.push('Local events nearby');
  pricingFactors.push(`${factors.demandLevel} demand detected`);

  // Calculate optimal pricing tiers
  const baseRecommended = recommendations.competitivePrice || pricing.avgNightlyRate;

  const optimalPricing = {
    conservative: Math.round(baseRecommended * 0.9), // 10% below recommended
    recommended: baseRecommended,
    aggressive: Math.round(baseRecommended * 1.15), // 15% above recommended
  };

  // Generate insights
  let marketPosition = 'competitive';
  if (pricing.avgNightlyRate < recommendations.marketAverage * 0.9) {
    marketPosition = 'underpriced - opportunity to increase';
  } else if (pricing.avgNightlyRate > recommendations.marketAverage * 1.1) {
    marketPosition = 'premium positioning';
  }

  let demandForecast = 'Stable demand expected';
  if (factors.demandLevel === 'high') {
    demandForecast = 'High demand period - consider maximizing revenue';
  } else if (factors.demandLevel === 'low') {
    demandForecast = 'Lower demand - consider promotional pricing';
  }

  const revenueOpportunity =
    factors.demandLevel === 'high' && factors.isPeakSeason
      ? 'Excellent opportunity for peak pricing'
      : factors.demandLevel === 'high'
      ? 'Good demand period - competitive pricing recommended'
      : 'Normal demand - focus on occupancy';

  pricingLogger.info(
    { propertyId, recommendedPrice: baseRecommended, confidence },
    'AI price recommendation generated'
  );

  return {
    recommendedPrice: baseRecommended,
    confidence,
    factors: pricingFactors,
    optimalPricing,
    insights: {
      marketPosition,
      demandForecast,
      revenueOpportunity,
    },
  };
}

/**
 * Update host pricing rules
 */
export async function updateHostPricingRules(
  propertyId: string,
  hostId: string,
  rules: Partial<HostPricingRules['customRules']>,
  options?: {
    autoPricingEnabled?: boolean;
    competitorBasedPricing?: boolean;
  }
): Promise<HostPricingRules> {
  const property = await Property.findOne({ propertyId, hostId });
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  // In production, this would upsert into a HostPricingRules collection
  // For now, we return the expected structure
  const updatedRules: HostPricingRules = {
    propertyId,
    hostId,
    customRules: {
      minPrice: rules.minPrice ?? property.pricing.basePrice * 0.5,
      maxPrice: rules.maxPrice ?? property.pricing.basePrice * 3,
      weekendPremium: rules.weekendPremium ?? PRICING_FACTORS.weekendMultiplier,
      lastMinuteDiscount: rules.lastMinuteDiscount ?? PRICING_FACTORS.lastMinuteDiscount,
      longStayDiscount: rules.longStayDiscount ?? PRICING_FACTORS.longStayDiscount,
      seasonalAdjustments: rules.seasonalAdjustments ?? [],
      eventPricing: rules.eventPricing ?? [],
      blockedDates: rules.blockedDates ?? [],
      customPricing: rules.customPricing ?? [],
    },
    autoPricingEnabled: options?.autoPricingEnabled ?? false,
    competitorBasedPricing: options?.competitorBasedPricing ?? false,
    lastUpdated: new Date().toISOString(),
  };

  pricingLogger.info({ propertyId, hostId }, 'Host pricing rules updated');

  return updatedRules;
}

/**
 * Learn from market data - update pricing based on booking patterns
 */
export async function learnFromMarket(propertyId: string): Promise<{
  analyzed: boolean;
  insights: {
    bookingPatterns: string[];
    optimalPricingChanges: string[];
    marketTrends: string[];
  };
  updatedAt: string;
}> {
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  const insights: {
    bookingPatterns: string[];
    optimalPricingChanges: string[];
    marketTrends: string[];
  } = {
    bookingPatterns: [],
    optimalPricingChanges: [],
    marketTrends: [],
  };

  // Analyze last 90 days of bookings
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentBookings = await Booking.find({
    propertyId,
    createdAt: { $gte: ninetyDaysAgo },
    status: { $in: ['confirmed', 'completed'] },
  }).lean();

  if (recentBookings.length === 0) {
    insights.bookingPatterns.push('No recent booking data available');
    return {
      analyzed: true,
      insights,
      updatedAt: new Date().toISOString(),
    };
  }

  // Analyze booking lead time
  const leadTimes = recentBookings.map((b) => {
    const checkIn = new Date(b.checkIn);
    const created = new Date(b.createdAt);
    return Math.ceil((checkIn.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  });

  const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
  insights.bookingPatterns.push(
    `Average booking lead time: ${Math.round(avgLeadTime)} days`
  );

  // Analyze booking rate by day of week
  const weekdayBookings = recentBookings.filter((b) => {
    const day = new Date(b.checkIn).getDay();
    return day !== 0 && day !== 6;
  }).length;

  const weekendBookings = recentBookings.length - weekdayBookings;
  const weekdayRate = weekdayBookings / 5;
  const weekendRate = weekendBookings / 2;

  insights.bookingPatterns.push(
    `Weekday booking rate: ${weekdayRate.toFixed(1)}/day, Weekend booking rate: ${weekendRate.toFixed(1)}/day`
  );

  if (weekendRate > weekdayRate * 1.5) {
    insights.optimalPricingChanges.push(
      'Strong weekend demand detected - consider increasing weekend premium'
    );
  }

  // Analyze conversion by pricing
  const basePrice = property.pricing.basePrice;
  const recentBookingPrices = recentBookings.map((b) =>
    (b.pricing as { subtotal: number }).subtotal / b.totalNights
  );

  if (recentBookingPrices.length > 0) {
    const avgActualPrice =
      recentBookingPrices.reduce((a, b) => a + b, 0) / recentBookingPrices.length;
    const priceEfficiency = avgActualPrice / basePrice;

    insights.bookingPatterns.push(
      `Average realized price: ${Math.round(avgActualPrice)} (${(priceEfficiency * 100).toFixed(0)}% of base)`
    );

    if (priceEfficiency < 0.9) {
      insights.optimalPricingChanges.push(
        'Realized prices below base - consider reducing base price or improving listing'
      );
    } else if (priceEfficiency > 1.1) {
      insights.optimalPricingChanges.push(
        'Strong pricing power - base price may be too low'
      );
    }
  }

  // Market trend analysis
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const last30Days = recentBookings.filter(
    (b) => new Date(b.createdAt) >= thirtyDaysAgo
  ).length;

  const prev30Days = recentBookings.filter(
    (b) => new Date(b.createdAt) >= sixtyDaysAgo && new Date(b.createdAt) < thirtyDaysAgo
  ).length;

  if (last30Days > prev30Days * 1.2) {
    insights.marketTrends.push('Booking velocity increasing - demand is growing');
  } else if (last30Days < prev30Days * 0.8) {
    insights.marketTrends.push('Booking velocity decreasing - monitor market conditions');
  } else {
    insights.marketTrends.push('Booking velocity stable');
  }

  // Occupancy analysis
  const occupancyRate = recentBookings.length / 90; // Approximate
  insights.bookingPatterns.push(`Estimated occupancy rate: ${(occupancyRate * 100).toFixed(0)}%`);

  if (occupancyRate < 0.4) {
    insights.optimalPricingChanges.push('Low occupancy - consider competitive pricing or promotions');
  } else if (occupancyRate > 0.8) {
    insights.optimalPricingChanges.push('High occupancy - room for price increases');
  }

  pricingLogger.info(
    { propertyId, bookingCount: recentBookings.length },
    'Market learning completed'
  );

  return {
    analyzed: true,
    insights,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get pricing estimate (simplified version)
 */
export async function getPricingEstimate(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  guests?: { adults: number; children?: number; infants?: number }
): Promise<{
  estimate: {
    nightlyRate: number;
    totalNights: number;
    subtotal: number;
    cleaningFee: number;
    serviceFee: number;
    taxes: number;
    total: number;
    currency: string;
  };
  validUntil: string;
}> {
  const smartPrice = await calculateSmartPrice(propertyId, { checkIn, checkOut }, guests);

  // Estimate valid for 15 minutes
  const validUntil = new Date();
  validUntil.setMinutes(validUntil.getMinutes() + 15);

  return {
    estimate: {
      nightlyRate: smartPrice.pricing.avgNightlyRate,
      totalNights: smartPrice.pricing.totalNights,
      subtotal: smartPrice.pricing.subtotal,
      cleaningFee: smartPrice.pricing.cleaningFee,
      serviceFee: smartPrice.pricing.serviceFee,
      taxes: smartPrice.pricing.taxes,
      total: smartPrice.pricing.total,
      currency: smartPrice.pricing.currency,
    },
    validUntil: validUntil.toISOString(),
  };
}
