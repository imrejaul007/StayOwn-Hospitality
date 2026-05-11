import { api } from './api';

// Enhanced interfaces for multi-currency rate management
export interface CurrencyRate {
  currency: string;
  rate: number;
  lastUpdated: string;
  source: 'manual' | 'auto_conversion' | 'channel_specific';
}

export interface BaseRate {
  roomType: string;
  rate: number;
  currencyRates: CurrencyRate[];
  convertedRate?: number;
  originalRate?: number;
  conversionRate?: number;
  source?: string;
  channelRate?: number;
  commission?: number;
  isOverridden?: boolean;
  overrideReason?: string;
}

export interface ConvertedRatePlan {
  _id: string;
  planId: string;
  name: string;
  description?: string;
  type: 'BAR' | 'Corporate' | 'Package' | 'Promotional' | 'Group' | 'Government' | 'Member';
  baseCurrency: string;
  convertedCurrency: string;
  conversionRate: number;
  baseRates: BaseRate[];
  validity?: {
    startDate: string;
    endDate: string;
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
  cancellationPolicy?: {
    type: 'flexible' | 'moderate' | 'strict' | 'non_refundable';
    hoursBeforeCheckIn: number;
    penaltyPercentage: number;
  };
  mealPlan?: 'RO' | 'BB' | 'HB' | 'FB' | 'AI';
  commission?: {
    percentage: number;
    fixed: number;
  };
  priority: number;
  isActive: boolean;
  convertedAt: string;
  exchangeRateProvider?: string;
  hasOverrides?: boolean;
  overrideCount?: number;
  channelSpecific?: boolean;
  channel?: string;
}

export interface ConversionRatesResponse {
  rates: Record<string, {
    rate: number | null;
    symbol: string;
    lastUpdated: string;
    source: string;
    error?: string;
  }>;
  metadata: {
    baseCurrency: string;
    lastUpdated: string;
    provider: string;
  };
}

export interface RateComparisonData {
  ratePlan: {
    planId: string;
    name: string;
    type: string;
    baseCurrency: string;
  };
  currencies: Array<{
    currency: string;
    available: boolean;
    conversionRate?: number;
    baseRates?: Array<{
      roomType: string;
      originalRate: number;
      convertedRate: number;
      source: string;
    }>;
    convertedAt?: string;
    error?: string;
  }>;
  comparisonDate: string;
}

export interface RateHistoryEntry {
  date: string;
  rates: Array<{
    roomType: string;
    baseRate: number;
    displayRate: number;
    isOverridden: boolean;
    overrideReason?: string;
  }>;
}

export interface RateHistory {
  ratePlan: {
    planId: string;
    name: string;
    baseCurrency: string;
  };
  displayCurrency: string;
  dateRange: {
    start: string;
    end: string;
  };
  history: RateHistoryEntry[];
}

export interface UpdateCurrencyRateRequest {
  targetCurrency: string;
  forceUpdate?: boolean;
}

export interface BatchUpdateRequest {
  ratePlanIds: string[];
  targetCurrencies: string[];
  forceUpdate?: boolean;
}

export interface AvailableRatesOptions {
  currency?: string;
  date?: string;
  roomType?: string;
  includePackages?: boolean;
  includePromotional?: boolean;
}

export interface ChannelRatesOptions extends AvailableRatesOptions {
  channel: string;
}

class MultiCurrencyRateService {
  private readonly baseUrl = '/currencies';

  /**
   * Get available rates for a hotel in specific currency
   */
  async getAvailableRatesInCurrency(
    hotelId: string, 
    options: AvailableRatesOptions = {}
  ): Promise<{ 
    data: ConvertedRatePlan[]; 
    meta: { currency: string; date: string; hotelId: string; count: number } 
  }> {
    try {
      const params = new URLSearchParams();
      
      if (options.currency) params.append('currency', options.currency);
      if (options.date) params.append('date', options.date);
      if (options.roomType) params.append('roomType', options.roomType);
      if (options.includePackages !== undefined) params.append('includePackages', options.includePackages.toString());
      if (options.includePromotional !== undefined) params.append('includePromotional', options.includePromotional.toString());

      const response = await api.get(`${this.baseUrl}/${hotelId}/available-rates?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch available rates in currency');
    }
  }

  /**
   * Convert specific rate plan to target currency
   */
  async convertRatePlan(
    ratePlanId: string, 
    targetCurrency: string, 
    date?: string
  ): Promise<{ 
    data: ConvertedRatePlan; 
    meta: { ratePlanId: string; targetCurrency: string; date: string } 
  }> {
    try {
      const params = new URLSearchParams();
      params.append('targetCurrency', targetCurrency);
      if (date) params.append('date', date);

      const response = await api.get(`${this.baseUrl}/${ratePlanId}/convert?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to convert rate plan');
    }
  }

  /**
   * Get conversion rates for multiple currencies
   */
  async getConversionRates(
    baseCurrency: string, 
    targetCurrencies: string[]
  ): Promise<{ 
    data: ConversionRatesResponse; 
    meta: { baseCurrency: string; targetCurrencies: string[]; timestamp: string } 
  }> {
    try {
      const params = new URLSearchParams();
      params.append('baseCurrency', baseCurrency);
      params.append('targetCurrencies', targetCurrencies.join(','));

      const response = await api.get(`${this.baseUrl}/conversion-rates?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch conversion rates');
    }
  }

  /**
   * Update currency rates for rate plan
   */
  async updateRatePlanCurrency(
    ratePlanId: string, 
    request: UpdateCurrencyRateRequest
  ): Promise<{ data: unknown; message: string }> {
    try {
      const response = await api.put(`${this.baseUrl}/${ratePlanId}/currency`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update rate plan currency');
    }
  }

  /**
   * Batch update multiple rate plans with currency rates
   */
  async batchUpdateCurrencyRates(
    request: BatchUpdateRequest
  ): Promise<{ data: unknown; message: string }> {
    try {
      const response = await api.post(`${this.baseUrl}/batch-update-currencies`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to batch update currency rates');
    }
  }

  /**
   * Get rate comparison across multiple currencies
   */
  async getRateComparison(
    ratePlanId: string, 
    currencies: string[], 
    date?: string
  ): Promise<{ 
    data: RateComparisonData; 
    meta: { ratePlanId: string; currencies: string[]; date: string } 
  }> {
    try {
      const params = new URLSearchParams();
      params.append('currencies', currencies.join(','));
      if (date) params.append('date', date);

      const response = await api.get(`${this.baseUrl}/${ratePlanId}/comparison?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to get rate comparison');
    }
  }

  /**
   * Get rate history with currency tracking
   */
  async getRateHistory(
    ratePlanId: string,
    startDate: string,
    endDate: string,
    currency = 'USD',
    roomType?: string
  ): Promise<{ 
    data: RateHistory; 
    meta: { ratePlanId: string; currency: string; totalDays: number; overrideCount: number } 
  }> {
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      params.append('currency', currency);
      if (roomType) params.append('roomType', roomType);

      const response = await api.get(`${this.baseUrl}/${ratePlanId}/history?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to get rate history');
    }
  }

  /**
   * Get channel-specific rates with currency conversion
   */
  async getChannelRates(
    hotelId: string, 
    options: ChannelRatesOptions
  ): Promise<{ 
    data: ConvertedRatePlan[]; 
    meta: { hotelId: string; channel: string; currency: string; date: string; count: number } 
  }> {
    try {
      const params = new URLSearchParams();
      params.append('channel', options.channel);
      
      if (options.currency) params.append('currency', options.currency);
      if (options.date) params.append('date', options.date);
      if (options.roomType) params.append('roomType', options.roomType);

      const response = await api.get(`${this.baseUrl}/${hotelId}/channel-rates?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch channel rates');
    }
  }

  /**
   * Helper methods for formatting and display
   */

  /**
   * Format rate amount with currency symbol
   */
  formatRateAmount(
    amount: number, 
    currency: string, 
    conversionRates?: ConversionRatesResponse
  ): string {
    const currencyInfo = conversionRates?.rates[currency];
    const symbol = currencyInfo?.symbol || currency;
    
    return `${symbol} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  /**
   * Get best available rate for room type
   */
  getBestRateForRoomType(
    ratePlans: ConvertedRatePlan[], 
    roomType: string
  ): { ratePlan: ConvertedRatePlan; baseRate: BaseRate } | null {
    let bestRate: number | null = null;
    let bestPlan: ConvertedRatePlan | null = null;
    let bestBaseRate: BaseRate | null = null;

    for (const plan of ratePlans) {
      const baseRate = plan.baseRates.find(br => br.roomType === roomType);
      if (!baseRate) continue;

      const rate = baseRate.convertedRate || baseRate.rate;
      if (bestRate === null || rate < bestRate) {
        bestRate = rate;
        bestPlan = plan;
        bestBaseRate = baseRate;
      }
    }

    return bestPlan && bestBaseRate ? { ratePlan: bestPlan, baseRate: bestBaseRate } : null;
  }

  /**
   * Filter rate plans by availability and criteria
   */
  filterRatePlans(
    ratePlans: ConvertedRatePlan[],
    criteria: {
      availableOnly?: boolean;
      maxPrice?: number;
      currency?: string;
      roomType?: string;
      planTypes?: string[];
      excludeNonRefundable?: boolean;
    } = {}
  ): ConvertedRatePlan[] {
    return ratePlans.filter(plan => {
      // Filter by plan types
      if (criteria.planTypes && !criteria.planTypes.includes(plan.type)) {
        return false;
      }

      // Filter by cancellation policy
      if (criteria.excludeNonRefundable && plan.cancellationPolicy?.type === 'non_refundable') {
        return false;
      }

      // Filter by room type and price
      if (criteria.roomType || criteria.maxPrice !== undefined) {
        const hasMatchingRate = plan.baseRates.some(baseRate => {
          if (criteria.roomType && baseRate.roomType !== criteria.roomType) {
            return false;
          }

          if (criteria.maxPrice !== undefined) {
            const rate = baseRate.convertedRate || baseRate.rate;
            if (rate > criteria.maxPrice) {
              return false;
            }
          }

          return true;
        });

        if (!hasMatchingRate) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate savings compared to base rate
   */
  calculateSavings(
    currentRate: number,
    compareRate: number,
    currency?: string
  ): { amount: number; percentage: number; hasSavings: boolean } {
    const savings = compareRate - currentRate;
    const percentage = compareRate > 0 ? (savings / compareRate) * 100 : 0;
    
    return {
      amount: Math.abs(savings),
      percentage: Math.abs(percentage),
      hasSavings: savings < 0
    };
  }

  /**
   * Group rate plans by type or currency
   */
  groupRatePlans(
    ratePlans: ConvertedRatePlan[],
    groupBy: 'type' | 'currency' | 'mealPlan' = 'type'
  ): Record<string, ConvertedRatePlan[]> {
    return ratePlans.reduce((groups, plan) => {
      let key: string;
      
      switch (groupBy) {
        case 'type':
          key = plan.type;
          break;
        case 'currency':
          key = plan.convertedCurrency;
          break;
        case 'mealPlan':
          key = plan.mealPlan || 'RO';
          break;
        default:
          key = 'default';
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(plan);
      
      return groups;
    }, {} as Record<string, ConvertedRatePlan[]>);
  }

  /**
   * Check if rate plan is valid for given dates
   */
  isRatePlanValid(
    ratePlan: ConvertedRatePlan,
    checkInDate: string,
    checkOutDate: string
  ): boolean {
    if (!ratePlan.validity) return true;
    
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    if (ratePlan.validity.startDate) {
      const validStart = new Date(ratePlan.validity.startDate);
      if (checkIn < validStart) return false;
    }
    
    if (ratePlan.validity.endDate) {
      const validEnd = new Date(ratePlan.validity.endDate);
      if (checkOut > validEnd) return false;
    }
    
    return true;
  }

  /**
   * Get rate trends (mock implementation for future enhancement)
   */
  async getRateTrends(
    hotelId: string,
    roomType: string,
    currency: string,
    days = 30
  ): Promise<Array<{ date: string; averageRate: number; minRate: number; maxRate: number }>> {
    // This would implement actual rate trend analysis
    // For now, return mock data structure
    const trends: Array<{ date: string; averageRate: number; minRate: number; maxRate: number }> = [];
    
    const startDate = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        averageRate: 0,
        minRate: 0,
        maxRate: 0
      });
    }
    
    return trends;
  }
}

// Create and export singleton instance
export const multiCurrencyRateService = new MultiCurrencyRateService();
export default multiCurrencyRateService;