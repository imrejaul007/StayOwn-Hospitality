/**
 * Google Hotel Ads Integration
 *
 * Features:
 * - Product feed generation (hotels.xml)
 * - Click tracking webhook
 * - Conversion tracking
 * - Bid management (placeholder for future)
 */
declare class GoogleHotelAdsService {
    private merchantId;
    private developerId;
    constructor();
    /**
     * Generate Google Hotels Product Feed (XML format)
     * This is served at /feeds/hotels.xml for Google to crawl
     */
    generateProductFeed(): Promise<string>;
    /**
     * Generate inline data for Google Hotel Ads
     * Used for dynamic hotel listings
     */
    generateInlineData(): Promise<object>;
    /**
     * Handle click tracking from Google
     * POST /webhooks/google-hotel-ads/click
     */
    trackClick(data: {
        hotel_id: string;
        gclid: string;
        user_id?: string;
        check_in?: string;
        check_out?: string;
        guests: number;
    }): Promise<void>;
    /**
     * Handle booking confirmation from Google
     * POST /webhooks/google-hotel-ads/conversion
     */
    trackConversion(data: {
        hotel_id: string;
        gclid: string;
        booking_id: string;
        value: number;
        currency: string;
    }): Promise<void>;
    private getActiveHotels;
    private escapeXml;
    private storeClickData;
}
export declare const googleHotelAdsService: GoogleHotelAdsService;
export {};
//# sourceMappingURL=google-hotel-ads.d.ts.map