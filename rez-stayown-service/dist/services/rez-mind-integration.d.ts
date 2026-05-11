/**
 * REZ Mind Integration for StayOwn Hotel Services
 *
 * Sends events to REZ Mind for:
 * - Hotel search analytics
 * - Booking events
 * - Room QR usage tracking
 * - Guest behavior analysis
 * - Service request tracking
 * - Checkout/payment events
 */
export interface HotelSearchEvent {
    userId?: string;
    query: string;
    city?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    resultsCount: number;
    selectedHotelId?: string;
}
export interface BookingEvent {
    userId: string;
    bookingId: string;
    hotelId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    totalAmountPaise: number;
    status: 'created' | 'confirmed' | 'cancelled';
}
export interface RoomQREvent {
    userId: string;
    bookingId: string;
    hotelId: string;
    roomId: string;
    action: 'generated' | 'scanned' | 'used_service' | 'checkout' | 'expired';
    serviceType?: string;
    amountPaise?: number;
}
export interface ServiceRequestEvent {
    userId: string;
    bookingId: string;
    hotelId: string;
    roomId: string;
    requestType: 'room_service' | 'housekeeping' | 'laundry' | 'concierge' | 'checkout';
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    amountPaise?: number;
    responseTimeMs?: number;
}
export interface CheckoutEvent {
    userId: string;
    bookingId: string;
    hotelId: string;
    totalAmountPaise: number;
    serviceChargesPaise: number;
    paymentMethod?: string;
    paymentStatus: 'pending' | 'completed' | 'failed';
}
export interface GuestPreferenceEvent {
    userId: string;
    bookingId: string;
    hotelId: string;
    preferenceType: 'temperature' | 'lighting' | 'pillow' | 'dietary' | 'transport';
    value: string;
}
export declare const rezMindHotel: {
    /**
     * Track hotel search behavior
     */
    trackSearch(event: HotelSearchEvent): Promise<void>;
    /**
     * Track booking lifecycle
     */
    trackBooking(event: BookingEvent): Promise<void>;
    /**
     * Track Room QR usage
     */
    trackRoomQR(event: RoomQREvent): Promise<void>;
    /**
     * Track service requests
     */
    trackServiceRequest(event: ServiceRequestEvent): Promise<void>;
    /**
     * Track checkout events
     */
    trackCheckout(event: CheckoutEvent): Promise<void>;
    /**
     * Track guest preferences
     */
    trackPreference(event: GuestPreferenceEvent): Promise<void>;
    /**
     * Get AI-powered hotel recommendations for user
     */
    getRecommendations(userId: string, context: {
        city?: string;
        checkIn?: string;
        checkOut?: string;
        budget?: number;
        preferences?: string[];
    }): Promise<{
        recommendedHotels: Array<{
            hotelId: string;
            score: number;
            reason: string;
        }>;
        upsells: Array<{
            type: string;
            description: string;
            estimatedValue: number;
        }>;
    } | null>;
    /**
     * Get personalized pricing for user
     */
    getPersonalizedPricing(userId: string, hotelId: string, baseRate: number): Promise<{
        suggestedRate: number;
        discountPercent: number;
        reason: string;
    } | null>;
    /**
     * Get service request SLA predictions
     */
    predictServiceResponseTime(hotelId: string, requestType: string): Promise<{
        predictedTimeMs: number;
        confidence: number;
        currentLoad: number;
    } | null>;
    /**
     * Get guest satisfaction prediction
     */
    predictGuestSatisfaction(bookingId: string, events: {
        checkInTime: number;
        serviceResponseTimes: number[];
        totalCharges: number;
        specialRequests: number;
    }): Promise<{
        score: number;
        riskFactors: string[];
        recommendations: string[];
    } | null>;
};
export default rezMindHotel;
//# sourceMappingURL=rez-mind-integration.d.ts.map