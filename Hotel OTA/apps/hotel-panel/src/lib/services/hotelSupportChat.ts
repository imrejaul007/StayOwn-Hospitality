/**
 * REZ Support Copilot Integration for Hotel OTA
 *
 * Connects hotel room services and concierge to AI-powered support.
 * Provides intelligent routing and context-aware responses.
 */

import axios from 'axios';

const SUPPORT_COPILOT_URL = process.env.NEXT_PUBLIC_SUPPORT_COPILOT_URL || 'https://rez-support-copilot.onrender.com';

const apiClient = axios.create({
  baseURL: SUPPORT_COPILOT_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ServiceType = 'room_service' | 'housekeeping' | 'maintenance' | 'concierge' | 'checkout' | 'restaurant' | 'spa';

export interface HotelGuestContext {
  hotelId: string;
  hotelName: string;
  roomNumber: string;
  guestName: string;
  guestId: string;
  bookingId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guestTier?: 'standard' | 'silver' | 'gold' | 'platinum';
  specialRequests?: string[];
}

export interface ServiceRequest {
  serviceType: ServiceType;
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledTime?: string;
  guestPreferences?: Record<string, unknown>;
}

export interface SupportChatMessage {
  id: string;
  conversationId: string;
  sender: 'guest' | 'ai' | 'staff';
  content: string;
  timestamp: string;
  metadata?: {
    suggestions?: string[];
    confidence?: number;
    actions?: AIAction[];
    serviceRequest?: ServiceRequest;
  };
}

export interface AIAction {
  type: 'create_service_request' | 'notify_staff' | 'provide_info' | 'escalate' | 'suggest_addon';
  data: Record<string, unknown>;
  reason: string;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  conversationId?: string;
  suggestions?: string[];
  actions?: AIAction[];
  serviceRequestCreated?: boolean;
  error?: string;
}

// ─── Hotel Support Chat Service ─────────────────────────────────────────────────

class HotelSupportChatService {
  /**
   * Initialize a support chat session for a hotel guest
   */
  async initSession(guestContext: HotelGuestContext): Promise<ChatResponse> {
    try {
      const response = await apiClient.post('/api/chat/session', {
        appType: 'hotel',
        merchantId: guestContext.hotelId,
        customerContext: {
          customerId: guestContext.guestId,
          name: guestContext.guestName,
          tier: guestContext.guestTier,
          preferences: {
            roomNumber: guestContext.roomNumber,
            checkIn: guestContext.checkInDate,
            checkOut: guestContext.checkOutDate,
            specialRequests: guestContext.specialRequests,
          },
        },
        metadata: {
          bookingId: guestContext.bookingId,
          serviceContext: 'hotel_ota',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[HotelSupportChat] Session init failed:', error);
      return {
        success: false,
        error: 'Failed to initialize support chat',
      };
    }
  }

  /**
   * Send a message to the AI support
   */
  async sendMessage(
    conversationId: string,
    message: string,
    guestContext: HotelGuestContext
  ): Promise<ChatResponse> {
    try {
      const response = await apiClient.post('/api/chat/message', {
        conversationId,
        message,
        userId: guestContext.guestId,
        appType: 'hotel',
        merchantId: guestContext.hotelId,
        customerContext: {
          customerId: guestContext.guestId,
          name: guestContext.guestName,
          tier: guestContext.guestTier,
        },
      });
      return response.data;
    } catch (error) {
      console.error('[HotelSupportChat] Message send failed:', error);
      return {
        success: false,
        error: 'Failed to send message',
      };
    }
  }

  /**
   * Request room service with AI assistance
   */
  async requestRoomService(
    guestContext: HotelGuestContext,
    request: ServiceRequest
  ): Promise<ChatResponse> {
    try {
      // First get AI-suggested items based on guest preferences
      const suggestionsResponse = await this.sendMessage(
        '',
        `I'd like to request ${request.serviceType}: ${request.description}`,
        guestContext
      );

      // Create the service request
      const response = await apiClient.post('/api/hotel/service-request', {
        hotelId: guestContext.hotelId,
        roomNumber: guestContext.roomNumber,
        guestId: guestContext.guestId,
        bookingId: guestContext.bookingId,
        serviceType: request.serviceType,
        description: request.description,
        priority: request.priority || 'normal',
        scheduledTime: request.scheduledTime,
        preferences: request.guestPreferences,
        conversationId: suggestionsResponse.conversationId,
      });

      return {
        ...response.data,
        suggestions: suggestionsResponse.suggestions,
      };
    } catch (error) {
      console.error('[HotelSupportChat] Room service request failed:', error);
      return {
        success: false,
        error: 'Failed to submit service request',
      };
    }
  }

  /**
   * Request concierge assistance with AI routing
   */
  async requestConcierge(
    guestContext: HotelGuestContext,
    request: string
  ): Promise<ChatResponse> {
    try {
      const response = await apiClient.post('/api/hotel/concierge', {
        hotelId: guestContext.hotelId,
        roomNumber: guestContext.roomNumber,
        guestId: guestContext.guestId,
        request,
        guestTier: guestContext.guestTier,
      });
      return response.data;
    } catch (error) {
      console.error('[HotelSupportChat] Concierge request failed:', error);
      return {
        success: false,
        error: 'Failed to submit concierge request',
      };
    }
  }

  /**
   * Get AI-suggested services based on guest profile
   */
  async getSuggestedServices(guestContext: HotelGuestContext): Promise<string[]> {
    try {
      const response = await apiClient.post('/api/hotel/suggestions', {
        hotelId: guestContext.hotelId,
        guestTier: guestContext.guestTier,
        stayDuration: guestContext.checkInDate && guestContext.checkOutDate
          ? Math.ceil(
              (new Date(guestContext.checkOutDate).getTime() - new Date(guestContext.checkInDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 1,
        preferences: guestContext.specialRequests,
      });
      return response.data.suggestions || [];
    } catch (error) {
      console.error('[HotelSupportChat] Get suggestions failed:', error);
      return [];
    }
  }

  /**
   * Get AI-suggested add-ons for upsell
   */
  async getUpsellSuggestions(guestContext: HotelGuestContext): Promise<Array<{
    item: string;
    price: number;
    reason: string;
    confidence: number;
  }>> {
    try {
      const response = await apiClient.post('/api/hotel/upsell', {
        hotelId: guestContext.hotelId,
        guestTier: guestContext.guestTier,
        currentServices: [],
      });
      return response.data.items || [];
    } catch (error) {
      console.error('[HotelSupportChat] Upsell suggestions failed:', error);
      return [];
    }
  }

  /**
   * Process checkout with AI assistance
   */
  async processCheckout(
    guestContext: HotelGuestContext
  ): Promise<{ success: boolean; charges?: Record<string, number>; error?: string }> {
    try {
      const response = await apiClient.post('/api/hotel/checkout', {
        hotelId: guestContext.hotelId,
        roomNumber: guestContext.roomNumber,
        guestId: guestContext.guestId,
        bookingId: guestContext.bookingId,
      });
      return response.data;
    } catch (error) {
      console.error('[HotelSupportChat] Checkout failed:', error);
      return {
        success: false,
        error: 'Failed to process checkout',
      };
    }
  }

  /**
   * Track guest interaction for analytics
   */
  async trackInteraction(
    guestContext: HotelGuestContext,
    action: 'service_request' | 'concierge_request' | 'checkout' | 'upsell_view' | 'upsell_accept',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await apiClient.post('/api/analytics/track', {
        hotelId: guestContext.hotelId,
        guestId: guestContext.guestId,
        roomNumber: guestContext.roomNumber,
        action,
        metadata,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Non-critical - silent failure
      console.debug('[HotelSupportChat] Analytics tracking failed:', error);
    }
  }
}

export const hotelSupportChatService = new HotelSupportChatService();
export default hotelSupportChatService;
