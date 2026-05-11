/**
 * Pricing Service with REZ Mind Dynamic Pricing
 *
 * Features:
 * - Dynamic pricing from REZ Mind AI
 * - TTL-based caching
 * - Fallback to base pricing
 * - Price optimization
 */
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
export declare const pricingService: {
    /**
     * Get dynamic price with caching and fallback
     */
    getPrice(request: PriceRequest): Promise<PriceResponse>;
    /**
     * Get multiple room prices for a hotel
     */
    getRoomPrices(hotelId: string, rooms: Array<{
        roomTypeId: string;
        baseRate: number;
    }>, checkIn: string, checkOut: string, userId?: string): Promise<PriceResponse[]>;
    /**
     * Clear price cache (for testing/admin)
     */
    clearCache(): void;
    /**
     * Cleanup expired cache entries
     */
    cleanupCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        ttl: number;
    };
};
export default pricingService;
//# sourceMappingURL=pricing.service.d.ts.map