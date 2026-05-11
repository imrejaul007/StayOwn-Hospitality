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

import axios from 'axios';

const REZ_MIND_URL = process.env.REZ_MIND_URL || process.env.EXPO_PUBLIC_EVENT_PLATFORM_URL || 'http://localhost:4008';

// ─── Event Types ───────────────────────────────────────────────────────────────

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

// ─── HTTP Client ────────────────────────────────────────────────────────────────

async function sendEvent(endpoint: string, data: Record<string, unknown>): Promise<{ success: boolean; correlationId?: string }> {
  try {
    const response = await axios.post(`${REZ_MIND_URL}${endpoint}`, {
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
  } catch (error: any) {
    console.warn(`[REZ Mind] Event failed: ${error.message}`);
    return { success: false };
  }
}

// ─── REZ Mind Service ─────────────────────────────────────────────────────────

export const rezMindHotel = {
  /**
   * Track hotel search behavior
   */
  async trackSearch(event: HotelSearchEvent): Promise<void> {
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
  async trackBooking(event: BookingEvent): Promise<void> {
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
  async trackRoomQR(event: RoomQREvent): Promise<void> {
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
  async trackServiceRequest(event: ServiceRequestEvent): Promise<void> {
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
  async trackCheckout(event: CheckoutEvent): Promise<void> {
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
  async trackPreference(event: GuestPreferenceEvent): Promise<void> {
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
  async getRecommendations(userId: string, context: {
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
  } | null> {
    try {
      const response = await axios.post(`${REZ_MIND_URL}/api/hotel/recommendations`, {
        user_id: userId,
        ...context,
      }, {
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.warn('[REZ Mind] Failed to get recommendations');
      return null;
    }
  },

  /**
   * Get personalized pricing for user
   */
  async getPersonalizedPricing(userId: string, hotelId: string, baseRate: number): Promise<{
    suggestedRate: number;
    discountPercent: number;
    reason: string;
  } | null> {
    try {
      const response = await axios.post(`${REZ_MIND_URL}/api/hotel/pricing`, {
        user_id: userId,
        hotel_id: hotelId,
        base_rate: baseRate,
      }, {
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.warn('[REZ Mind] Failed to get personalized pricing');
      return null;
    }
  },

  /**
   * Get service request SLA predictions
   */
  async predictServiceResponseTime(
    hotelId: string,
    requestType: string
  ): Promise<{
    predictedTimeMs: number;
    confidence: number;
    currentLoad: number;
  } | null> {
    try {
      const response = await axios.post(`${REZ_MIND_URL}/api/hotel/sla-predict`, {
        hotel_id: hotelId,
        request_type: requestType,
      }, {
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.warn('[REZ Mind] Failed to predict SLA');
      return null;
    }
  },

  /**
   * Get guest satisfaction prediction
   */
  async predictGuestSatisfaction(bookingId: string, events: {
    checkInTime: number;
    serviceResponseTimes: number[];
    totalCharges: number;
    specialRequests: number;
  }): Promise<{
    score: number;
    riskFactors: string[];
    recommendations: string[];
  } | null> {
    try {
      const response = await axios.post(`${REZ_MIND_URL}/api/hotel/satisfaction-predict`, {
        booking_id: bookingId,
        ...events,
      }, {
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.warn('[REZ Mind] Failed to predict satisfaction');
      return null;
    }
  },
};

export default rezMindHotel;
