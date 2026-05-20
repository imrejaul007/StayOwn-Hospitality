/**
 * REZ Ecosystem Integrations for Hotel OTA
 *
 * Connects Hotel OTA to:
 * - RABTUL Platform (Auth, Payment, Booking, Notifications)
 * - REZ Intelligence (Hospitality Expert, Churn Prediction, Personalization)
 * - REZ Media (Attribution)
 */

import axios from 'axios';

// Configuration
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001';
const BOOKING_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:4020';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4011';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const INTELLIGENCE_URL = process.env.REZ_INTELLIGENCE_URL || 'http://localhost:4018';

// Hospitality Expert Service
const HOSPITALITY_EXPERT_URL = process.env.HOSPITALITY_EXPERT_URL || 'http://localhost:3000';

// Types
interface HotelBooking {
  bookingId: string;
  guestId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  totalAmount: number;
}

interface GuestProfile {
  guestId: string;
  preferences: {
    roomType?: string;
    dietaryRestrictions?: string[];
    specialRequests?: string[];
    loyaltyTier?: string;
  };
  history: {
    totalStays: number;
    avgRating: number;
    lastStay?: string;
  };
}

interface PersonalizationOffer {
  type: 'upgrade' | 'discount' | 'amenity' | 'loyalty';
  value: string;
  reason: string;
}

class HotelOTAIntegrations {
  /**
   * Process hotel booking with full ecosystem integration
   */
  async processBooking(booking: HotelBooking): Promise<{
    booking: HotelBooking;
    payment: { orderId: string; status: string };
    personalization: PersonalizationOffer[];
  }> {
    const headers = {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
    };

    // 1. Create RABTUL Booking
    const rbtBooking = await axios.post(
      `${BOOKING_URL}/api/bookings`,
      {
        userId: booking.guestId,
        resourceType: 'hotel_room',
        resourceId: booking.hotelId,
        slots: [{ start: booking.checkIn, end: booking.checkOut }],
        metadata: { rooms: booking.rooms, guests: booking.guests },
      },
      { headers }
    );

    // 2. Create RABTUL Payment
    const payment = await axios.post(
      `${PAYMENT_URL}/api/payment/create-order`,
      {
        amount: booking.totalAmount,
        userId: booking.guestId,
        metadata: { bookingId: booking.bookingId, type: 'hotel' },
      },
      { headers }
    );

    // 3. Get personalization offers from REZ Intelligence
    const personalization = await this.getPersonalizationOffers(booking.guestId);

    // 4. Check churn risk
    const churnRisk = await this.getChurnRisk(booking.guestId);

    // 5. If high churn risk, add retention offer
    if (churnRisk.riskLevel === 'high') {
      personalization.push({
        type: 'loyalty',
        value: '10% off next booking',
        reason: 'We value you as a guest!',
      });
    }

    // 6. Update guest profile with booking
    await axios.patch(
      `${PROFILE_URL}/api/profiles/${booking.guestId}`,
      {
        metadata: {
          lastBooking: booking.bookingId,
          lastStay: booking.checkIn,
        },
      },
      { headers }
    );

    // 7. Send confirmation notification
    await axios.post(
      `${NOTIFICATION_URL}/api/notifications/send`,
      {
        userId: booking.guestId,
        type: 'email',
        title: 'Booking Confirmed!',
        message: `Your stay at ${booking.hotelId} is confirmed. Check-in: ${booking.checkIn}`,
        data: { bookingId: booking.bookingId, type: 'booking_confirmation' },
      },
      { headers }
    );

    // 8. Track for attribution
    await this.trackConversion(booking.guestId, booking.bookingId, booking.totalAmount);

    return {
      booking,
      payment: payment.data,
      personalization,
    };
  }

  /**
   * Get personalized offers for guest
   */
  async getPersonalizationOffers(guestId: string): Promise<PersonalizationOffer[]> {
    try {
      // Get guest profile
      const profileResponse = await axios.get(`${PROFILE_URL}/api/profiles/${guestId}`, {
        headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' },
      });

      // Get preferences from REZ Intelligence
      const intelResponse = await axios.post(
        `${INTELLIGENCE_URL}/api/recommend/hospitality`,
        {
          userId: guestId,
          context: profileResponse.data.metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );

      return intelResponse.data.offers || [];
    } catch (error) {
      console.error('Get personalization failed:', error);
      return [];
    }
  }

  /**
   * Get guest churn risk from REZ Intelligence
   */
  async getChurnRisk(guestId: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    probability: number;
  }> {
    try {
      const response = await axios.post(
        `${INTELLIGENCE_URL}/api/predict/churn`,
        { userId: guestId },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
      return {
        riskLevel: response.data.riskLevel,
        probability: response.data.probability,
      };
    } catch (error) {
      console.error('Churn prediction failed:', error);
      return { riskLevel: 'medium', probability: 0.5 };
    }
  }

  /**
   * Get hospitality expert insights
   */
  async getExpertInsights(checkIn: Date, hotelId: string): Promise<{
    recommendations: string[];
    optimalPricing: number;
    demandForecast: string;
  }> {
    try {
      const response = await axios.post(
        `${HOSPITALITY_EXPERT_URL}/api/expert/insights`,
        {
          hotelId,
          checkInDate: checkIn.toISOString(),
          context: 'booking_optimization',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Expert insights failed:', error);
      return {
        recommendations: [],
        optimalPricing: 0,
        demandForecast: 'unknown',
      };
    }
  }

  /**
   * Send pre-arrival personalization
   */
  async sendPreArrival(guestId: string, booking: HotelBooking): Promise<void> {
    const headers = {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
    };

    // Get guest preferences
    const profile = await axios.get(`${PROFILE_URL}/api/profiles/${guestId}`, {
      headers,
    });

    // Get personalized welcome message
    const personalization = await this.getPersonalizationOffers(guestId);

    // Send pre-arrival email
    await axios.post(
      `${NOTIFICATION_URL}/api/notifications/send`,
      {
        userId: guestId,
        type: 'email',
        title: 'Your stay is almost here!',
        message: `We're preparing for your arrival. ${personalization[0]?.value || 'See you soon!'}`,
        data: {
          type: 'pre_arrival',
          bookingId: booking.bookingId,
          checkIn: booking.checkIn,
        },
      },
      { headers }
    );
  }

  /**
   * Process checkout with feedback collection
   */
  async processCheckout(
    guestId: string,
    bookingId: string,
    rating: number,
    feedback: string
  ): Promise<void> {
    const headers = {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
    };

    // Update profile with feedback
    await axios.patch(
      `${PROFILE_URL}/api/profiles/${guestId}`,
      {
        metadata: {
          lastRating: rating,
          lastFeedback: feedback,
        },
      },
      { headers }
    );

    // Check if high-value guest (for retention)
    const churnRisk = await this.getChurnRisk(guestId);

    if (rating >= 4 && churnRisk.probability > 0.3) {
      // Award loyalty points
      await axios.post(
        `${PAYMENT_URL}/api/loyalty/add`,
        {
          userId: guestId,
          points: rating * 10,
          reason: 'feedback_reward',
        },
        { headers }
      );

      // Send thank you with retention offer
      await axios.post(
        `${NOTIFICATION_URL}/api/notifications/send`,
        {
          userId: guestId,
          type: 'email',
          title: 'Thank you for your feedback!',
          message: 'As a token of appreciation, enjoy 10% off your next booking!',
          data: { type: 'retention_offer', discount: '10%' },
        },
        { headers }
      );
    }
  }

  /**
   * Track conversion for attribution
   */
  private async trackConversion(guestId: string, bookingId: string, value: number): Promise<void> {
    try {
      await axios.post(
        `${INTELLIGENCE_URL}/api/attribution/track`,
        {
          userId: guestId,
          event: 'conversion',
          channel: 'hotel_ota',
          metadata: { bookingId, value },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
    } catch (error) {
      console.error('Attribution tracking failed:', error);
    }
  }
}

export const hotelOTAIntegrations = new HotelOTAIntegrations();
export default hotelOTAIntegrations;
