"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rezMindHotel = void 0;
const axios_1 = __importDefault(require("axios"));
const REZ_MIND_URL = process.env.REZ_MIND_URL || process.env.EXPO_PUBLIC_EVENT_PLATFORM_URL || 'http://localhost:4008';
// ─── HTTP Client ────────────────────────────────────────────────────────────────
async function sendEvent(endpoint, data) {
    try {
        const response = await axios_1.default.post(`${REZ_MIND_URL}${endpoint}`, {
            ...data,
            source: 'stayown_service',
            timestamp: new Date().toISOString(),
        }, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return {
            success: response.data?.success !== false,
            correlationId: response.data?.correlationId || response.data?.correlation_id,
        };
    }
    catch (error) {
        console.warn(`[REZ Mind] Event failed: ${error.message}`);
        return { success: false };
    }
}
// ─── REZ Mind Service ─────────────────────────────────────────────────────────
exports.rezMindHotel = {
    /**
     * Track hotel search behavior
     */
    async trackSearch(event) {
        await sendEvent('/webhook/hotel/search', {
            user_id: event.userId,
            query: event.query,
            city: event.city,
            check_in: event.checkIn,
            check_out: event.checkOut,
            guests: event.guests,
            results_count: event.resultsCount,
            selected_hotel_id: event.selectedHotelId,
        });
    },
    /**
     * Track booking lifecycle
     */
    async trackBooking(event) {
        await sendEvent('/webhook/hotel/booking', {
            user_id: event.userId,
            booking_id: event.bookingId,
            hotel_id: event.hotelId,
            room_type_id: event.roomTypeId,
            check_in: event.checkIn,
            check_out: event.checkOut,
            total_amount_paise: event.totalAmountPaise,
            status: event.status,
        });
    },
    /**
     * Track Room QR usage
     */
    async trackRoomQR(event) {
        await sendEvent('/webhook/hotel/room-qr', {
            user_id: event.userId,
            booking_id: event.bookingId,
            hotel_id: event.hotelId,
            room_id: event.roomId,
            action: event.action,
            service_type: event.serviceType,
            amount_paise: event.amountPaise,
        });
    },
    /**
     * Track service requests
     */
    async trackServiceRequest(event) {
        await sendEvent('/webhook/hotel/service-request', {
            user_id: event.userId,
            booking_id: event.bookingId,
            hotel_id: event.hotelId,
            room_id: event.roomId,
            request_type: event.requestType,
            status: event.status,
            amount_paise: event.amountPaise,
            response_time_ms: event.responseTimeMs,
        });
    },
    /**
     * Track checkout events
     */
    async trackCheckout(event) {
        await sendEvent('/webhook/hotel/checkout', {
            user_id: event.userId,
            booking_id: event.bookingId,
            hotel_id: event.hotelId,
            total_amount_paise: event.totalAmountPaise,
            service_charges_paise: event.serviceChargesPaise,
            payment_method: event.paymentMethod,
            payment_status: event.paymentStatus,
        });
    },
    /**
     * Track guest preferences
     */
    async trackPreference(event) {
        await sendEvent('/webhook/hotel/preference', {
            user_id: event.userId,
            booking_id: event.bookingId,
            hotel_id: event.hotelId,
            preference_type: event.preferenceType,
            value: event.value,
        });
    },
    /**
     * Get AI-powered hotel recommendations for user
     */
    async getRecommendations(userId, context) {
        try {
            const response = await axios_1.default.post(`${REZ_MIND_URL}/api/hotel/recommendations`, {
                user_id: userId,
                ...context,
            }, {
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            console.warn('[REZ Mind] Failed to get recommendations');
            return null;
        }
    },
    /**
     * Get personalized pricing for user
     */
    async getPersonalizedPricing(userId, hotelId, baseRate) {
        try {
            const response = await axios_1.default.post(`${REZ_MIND_URL}/api/hotel/pricing`, {
                user_id: userId,
                hotel_id: hotelId,
                base_rate: baseRate,
            }, {
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            console.warn('[REZ Mind] Failed to get personalized pricing');
            return null;
        }
    },
    /**
     * Get service request SLA predictions
     */
    async predictServiceResponseTime(hotelId, requestType) {
        try {
            const response = await axios_1.default.post(`${REZ_MIND_URL}/api/hotel/sla-predict`, {
                hotel_id: hotelId,
                request_type: requestType,
            }, {
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            console.warn('[REZ Mind] Failed to predict SLA');
            return null;
        }
    },
    /**
     * Get guest satisfaction prediction
     */
    async predictGuestSatisfaction(bookingId, events) {
        try {
            const response = await axios_1.default.post(`${REZ_MIND_URL}/api/hotel/satisfaction-predict`, {
                booking_id: bookingId,
                ...events,
            }, {
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            console.warn('[REZ Mind] Failed to predict satisfaction');
            return null;
        }
    },
};
exports.default = exports.rezMindHotel;
//# sourceMappingURL=rez-mind-integration.js.map