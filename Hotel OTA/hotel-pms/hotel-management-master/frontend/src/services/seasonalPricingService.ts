import { api } from './api';

export interface Season {
  _id?: string;
  seasonId?: string;
  name: string;
  description?: string;
  type: 'peak' | 'high' | 'shoulder' | 'low' | 'off' | 'custom';
  startDate: string;
  endDate: string;
  isRecurring?: boolean;
  recurringPattern?: {
    type: 'yearly' | 'monthly' | 'weekly';
    interval: number;
  };
  rateAdjustments: Array<{
    roomType: string;
    adjustmentType: 'percentage' | 'fixed' | 'absolute';
    adjustmentValue: number;
    currency?: string;
  }>;
  applicableRatePlans?: string[];
  restrictions?: {
    minLength?: number;
    maxLength?: number;
    closedToArrival?: string[];
    closedToDeparture?: string[];
    dayOfWeekRestrictions?: {
      [key: string]: boolean;
    };
  };
  bookingWindow?: {
    minAdvanceBooking?: number;
    maxAdvanceBooking?: number;
  };
  priority?: number;
  tags?: string[];
  color?: string;
  isActive?: boolean;
}

export interface SpecialPeriod {
  _id?: string;
  periodId?: string;
  name: string;
  description?: string;
  type: string;
  startDate: string;
  endDate: string;
  isRecurring?: boolean;
  recurringPattern?: {
    type: 'yearly' | 'monthly' | 'weekly';
    interval: number;
    endRecurrence?: string;
  };
  rateOverrides: Array<{
    roomType: string;
    overrideType: 'percentage' | 'fixed' | 'absolute' | 'block';
    overrideValue: number;
    currency?: string;
  }>;
  restrictions?: {
    bookingRestriction?: string;
    minLength?: number;
    maxLength?: number;
    mustStayThrough?: boolean;
  };
  applicableRatePlans?: string[];
  eventDetails?: {
    eventName?: string;
    venue?: string;
    organizer?: string;
    expectedAttendees?: number;
    impactRadius?: number;
  };
  demand?: {
    level?: string;
    expectedOccupancy?: number;
    competitorImpact?: string;
  };
  priority?: number;
  tags?: string[];
  color?: string;
  alerts?: {
    emailNotification?: boolean;
    daysBeforeAlert?: number;
    recipients?: string[];
  };
  isActive?: boolean;
}

export interface SeasonalAdjustment {
  totalAdjustment: number;
  appliedAdjustments: Array<{
    type: 'season' | 'special_period';
    name: string;
    adjustmentType?: string;
    overrideType?: string;
    adjustmentValue?: number;
    overrideValue?: number;
    calculatedAmount: number;
    priority: number;
    periodType?: string;
  }>;
  hasSeasonalPricing: boolean;
  hasSpecialPeriodPricing: boolean;
  date: string;
}

export interface BookingAvailability {
  allowed: boolean;
  reason?: string;
  blockingPeriod?: {
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    restriction: string;
  };
  warning?: string;
}

export interface PricingCalendarEntry {
  date: string;
  adjustment: SeasonalAdjustment;
  bookingAllowed: boolean;
  restrictions?: Record<string, unknown>;
}

export interface SeasonalAnalytics {
  totalSeasons: number;
  totalSpecialPeriods: number;
  seasonsByType: { [key: string]: number };
  specialPeriodsByType: { [key: string]: number };
  averageAdjustment: number;
  peakDates: unknown[];
  blackoutDates: Array<{
    name: string;
    startDate: string;
    endDate: string;
  }>;
}

class SeasonalPricingService {
  // Season Management
  async createSeason(seasonData: Partial<Season>) {
    const response = await api.post('/seasonal-pricing/seasons', seasonData);
    return response.data;
  }

  async getSeasons(params?: { year?: number; type?: string; isActive?: boolean }) {
    const response = await api.get('/seasonal-pricing/seasons', { params });
    return response.data;
  }

  async getSeasonById(id: string) {
    const response = await api.get(`/seasonal-pricing/seasons/${id}`);
    return response.data;
  }

  async updateSeason(id: string, updateData: Partial<Season>) {
    const response = await api.put(`/seasonal-pricing/seasons/${id}`, updateData);
    return response.data;
  }

  async deleteSeason(id: string) {
    const response = await api.delete(`/seasonal-pricing/seasons/${id}`);
    return response.data;
  }

  // Special Period Management
  async createSpecialPeriod(periodData: Partial<SpecialPeriod>) {
    const response = await api.post('/seasonal-pricing/special-periods', periodData);
    return response.data;
  }

  async getSpecialPeriods(params?: { year?: number; type?: string; isActive?: boolean }) {
    const response = await api.get('/seasonal-pricing/special-periods', { params });
    return response.data;
  }

  async getSpecialPeriodById(id: string) {
    const response = await api.get(`/seasonal-pricing/special-periods/${id}`);
    return response.data;
  }

  async updateSpecialPeriod(id: string, updateData: Partial<SpecialPeriod>) {
    const response = await api.put(`/seasonal-pricing/special-periods/${id}`, updateData);
    return response.data;
  }

  async deleteSpecialPeriod(id: string) {
    const response = await api.delete(`/seasonal-pricing/special-periods/${id}`);
    return response.data;
  }

  async bulkCreateSpecialPeriods(periods: Partial<SpecialPeriod>[]) {
    const response = await api.post('/seasonal-pricing/special-periods/bulk', { periods });
    return response.data;
  }

  // Pricing Calculations
  async getSeasonalAdjustment(roomType: string, date: string, ratePlanId?: string): Promise<{ data: SeasonalAdjustment }> {
    const response = await api.get('/seasonal-pricing/adjustment', {
      params: { roomType, date, ratePlanId }
    });
    return response.data;
  }

  async checkBookingAvailability(arrivalDate: string, departureDate: string, roomType: string): Promise<{ data: BookingAvailability }> {
    const response = await api.get('/seasonal-pricing/availability', {
      params: { arrivalDate, departureDate, roomType }
    });
    return response.data;
  }

  async getPricingCalendar(startDate: string, endDate: string, roomType: string = 'all'): Promise<{ data: PricingCalendarEntry[] }> {
    const response = await api.get('/seasonal-pricing/calendar', {
      params: { startDate, endDate, roomType }
    });
    return response.data;
  }

  // Date Range Queries
  async getSeasonsByDateRange(startDate: string, endDate: string, includeInactive: boolean = false) {
    const response = await api.get('/seasonal-pricing/seasons/date-range', {
      params: { startDate, endDate, includeInactive }
    });
    return response.data;
  }

  async getSpecialPeriodsByDateRange(startDate: string, endDate: string, includeInactive: boolean = false) {
    const response = await api.get('/seasonal-pricing/special-periods/date-range', {
      params: { startDate, endDate, includeInactive }
    });
    return response.data;
  }

  // Analytics
  async getSeasonalAnalytics(startDate: string, endDate: string): Promise<{ data: SeasonalAnalytics }> {
    const response = await api.get('/seasonal-pricing/analytics', {
      params: { startDate, endDate }
    });
    return response.data;
  }

  // Alerts
  async getUpcomingAlerts(days: number = 30) {
    const response = await api.get('/seasonal-pricing/alerts/upcoming', {
      params: { days }
    });
    return response.data;
  }
}

export const seasonalPricingService = new SeasonalPricingService();
