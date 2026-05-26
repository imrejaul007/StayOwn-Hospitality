import logger from './utils/logger';

/**
 * Pricing Service with REZ Mind Dynamic Pricing
 *
 * Features:
 * - Dynamic pricing from REZ Mind AI
 * - TTL-based caching
 * - Fallback to base pricing
 * - Price optimization
 */

import { rezMindHotel } from './rez-mind-integration';

// ─── Configuration ─────────────────────────────────────────────────────────────

const PRICE_CACHE_TTL_MS = parseInt(process.env.PRICE_CACHE_TTL_MS || '300000', 10); // 5 minutes default
const MAX_PRICE_DISCOUNT = parseFloat(process.env.MAX_PRICE_DISCOUNT || '0.30'); // 30% max discount

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PriceRequest {
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  baseRate: number;
  userId?: string;
}

export interface PriceResponse {
  hotelId: string;
  roomTypeId: string;
  baseRate: number;
  dynamicRate: number;
  discountPercent: number;
  adjustedRate: number;
  finalRate: number;
  nights: number;
  subtotal: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalTax: number;
  totalAmount: number;
  pricingSource: 'rez_mind' | 'fallback';
  reason: string;
  cachedAt?: string;
  expiresAt?: string;
}

export interface CachedPrice {
  data: PriceResponse;
  timestamp: number;
}

// ─── In-Memory Cache ────────────────────────────────────────────────────────────

const priceCache = new Map<string, CachedPrice>();

/**
 * Generate cache key for price request
 */
function getCacheKey(hotelId: string, roomTypeId: string, checkIn: string, checkOut: string): string {
  return `${hotelId}:${roomTypeId}:${checkIn}:${checkOut}`;
}

/**
 * Get cached price if still valid
 */
function getCachedPrice(key: string): PriceResponse | null {
  const cached = priceCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > PRICE_CACHE_TTL_MS) {
    priceCache.delete(key);
    return null;
  }

  return {
    ...cached.data,
    cachedAt: new Date(cached.timestamp).toISOString(),
    expiresAt: new Date(cached.timestamp + PRICE_CACHE_TTL_MS).toISOString(),
  };
}

/**
 * Cache a price response
 */
function cachePrice(key: string, data: PriceResponse): void {
  // Cleanup old entries if cache is too large (max 1000 entries)
  if (priceCache.size >= 1000) {
    const oldestKey = priceCache.keys().next().value;
    if (oldestKey) priceCache.delete(oldestKey);
  }

  priceCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear expired cache entries
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, cached] of priceCache.entries()) {
    if (now - cached.timestamp > PRICE_CACHE_TTL_MS) {
      priceCache.delete(key);
    }
  }
}

// ─── Pricing Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate base pricing (GST included)
 */
function calculateBasePricing(baseRate: number, nights: number) {
  const subtotal = baseRate * nights;
  const taxableAmount = Math.round(subtotal / 1.12);
  const cgstAmount = Math.round(taxableAmount * 0.06);
  const sgstAmount = cgstAmount;

  return {
    subtotal,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    totalTax: cgstAmount + sgstAmount,
  };
}

/**
 * Get dynamic price from REZ Mind with caching
 */
async function getDynamicPrice(request: PriceRequest): Promise<PriceResponse> {
  const cacheKey = getCacheKey(request.hotelId, request.roomTypeId, request.checkIn, request.checkOut);

  // Check cache first
  const cached = getCachedPrice(cacheKey);
  if (cached) {
    logger.info(`[Pricing] Cache hit for ${cacheKey}`);
    return cached;
  }

  // Calculate nights
  const checkInDate = new Date(request.checkIn);
  const checkOutDate = new Date(request.checkOut);
  const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Get base pricing
  const basePricing = calculateBasePricing(request.baseRate, nights);

  // Try to get personalized pricing from REZ Mind
  let dynamicRate = request.baseRate;
  let discountPercent = 0;
  let reason = 'Base rate';
  let pricingSource: 'rez_mind' | 'fallback' = 'fallback';

  if (request.userId) {
    try {
      const personalizedPricing = await rezMindHotel.getPersonalizedPricing(
        request.userId,
        request.hotelId,
        request.baseRate
      );

      if (personalizedPricing) {
        dynamicRate = personalizedPricing.suggestedRate;
        discountPercent = personalizedPricing.discountPercent;
        reason = personalizedPricing.reason;
        pricingSource = 'rez_mind';

        // Ensure discount doesn't exceed max
        if (discountPercent > MAX_PRICE_DISCOUNT * 100) {
          discountPercent = MAX_PRICE_DISCOUNT * 100;
          dynamicRate = Math.round(request.baseRate * (1 - discountPercent / 100));
        }

        logger.info(`[Pricing] REZ Mind pricing for ${request.hotelId}: ${dynamicRate} (${discountPercent}% off)`);
      }
    } catch (error) {
      console.warn(`[Pricing] REZ Mind pricing failed, using fallback:`, error);
    }
  }

  // Calculate adjusted rate after discount
  const adjustedRate = Math.round(dynamicRate * (1 - discountPercent / 100));
  const finalRate = adjustedRate;

  // Recalculate pricing with dynamic rate
  const dynamicPricing = calculateBasePricing(finalRate, nights);

  const response: PriceResponse = {
    hotelId: request.hotelId,
    roomTypeId: request.roomTypeId,
    baseRate: request.baseRate,
    dynamicRate,
    discountPercent,
    adjustedRate,
    finalRate,
    nights,
    subtotal: dynamicPricing.subtotal,
    taxableAmount: dynamicPricing.taxableAmount,
    cgstRate: 6,
    cgstAmount: dynamicPricing.cgstAmount,
    sgstRate: 6,
    sgstAmount: dynamicPricing.sgstAmount,
    totalTax: dynamicPricing.totalTax,
    totalAmount: dynamicPricing.subtotal,
    pricingSource,
    reason,
  };

  // Cache the response
  cachePrice(cacheKey, response);

  return response;
}

/**
 * Get fallback price (no REZ Mind)
 */
function getFallbackPrice(request: PriceRequest): PriceResponse {
  const checkInDate = new Date(request.checkIn);
  const checkOutDate = new Date(request.checkOut);
  const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

  const basePricing = calculateBasePricing(request.baseRate, nights);

  return {
    hotelId: request.hotelId,
    roomTypeId: request.roomTypeId,
    baseRate: request.baseRate,
    dynamicRate: request.baseRate,
    discountPercent: 0,
    adjustedRate: request.baseRate,
    finalRate: request.baseRate,
    nights,
    subtotal: basePricing.subtotal,
    taxableAmount: basePricing.taxableAmount,
    cgstRate: 6,
    cgstAmount: basePricing.cgstAmount,
    sgstRate: 6,
    sgstAmount: basePricing.sgstAmount,
    totalTax: basePricing.totalTax,
    totalAmount: basePricing.subtotal,
    pricingSource: 'fallback',
    reason: 'Base pricing (REZ Mind unavailable)',
  };
}

// ─── Service Export ─────────────────────────────────────────────────────────────

export const pricingService = {
  /**
   * Get dynamic price with caching and fallback
   */
  async getPrice(request: PriceRequest): Promise<PriceResponse> {
    try {
      return await getDynamicPrice(request);
    } catch (error) {
      console.error('[Pricing] Dynamic pricing error, using fallback:', error);
      return getFallbackPrice(request);
    }
  },

  /**
   * Get multiple room prices for a hotel
   */
  async getRoomPrices(
    hotelId: string,
    rooms: Array<{ roomTypeId: string; baseRate: number }>,
    checkIn: string,
    checkOut: string,
    userId?: string
  ): Promise<PriceResponse[]> {
    const prices = await Promise.all(
      rooms.map(room =>
        this.getPrice({
          hotelId,
          roomTypeId: room.roomTypeId,
          checkIn,
          checkOut,
          baseRate: room.baseRate,
          userId,
        })
      )
    );

    return prices;
  },

  /**
   * Clear price cache (for testing/admin)
   */
  clearCache(): void {
    priceCache.clear();
    logger.info('[Pricing] Cache cleared');
  },

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): void {
    cleanupExpiredCache();
  },

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: priceCache.size,
      ttl: PRICE_CACHE_TTL_MS,
    };
  },
};

export default pricingService;
