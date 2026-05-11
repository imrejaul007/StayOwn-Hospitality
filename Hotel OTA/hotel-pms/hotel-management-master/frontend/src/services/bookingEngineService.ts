import { api } from './api';

// Types for the booking engine
export interface BookingWidget {
  _id: string;
  widgetId: string;
  name: string;
  type: string;
  isActive: boolean;
  config: {
    theme: {
      primaryColor: string;
      secondaryColor: string;
      textColor: string;
      borderRadius: string;
      fontFamily: string;
    };
    layout: {
      showImages: boolean;
      showPrices: boolean;
      showAmenities: boolean;
      showReviews: boolean;
      columns: number;
      maxRooms: number;
    };
    behavior: {
      autoSearch: boolean;
      showAvailabilityCalendar: boolean;
      enableGuestSelection: boolean;
      minStayNights: number;
      maxStayNights: number;
      advanceBookingDays: number;
    };
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PromoCode {
  _id: string;
  codeId: string;
  code: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'free_night' | 'upgrade';
  discount: {
    value: number;
    maxAmount?: number;
    freeNights?: number;
    upgradeRoomType?: string;
  };
  conditions: {
    minBookingValue?: number;
    minNights?: number;
    maxNights?: number;
    applicableRoomTypes?: string[];
    firstTimeGuests?: boolean;
    maxUsagePerGuest?: number;
    combinableWithOtherOffers?: boolean;
  };
  validity: {
    startDate: string;
    endDate: string;
  };
  usage: {
    totalUsageLimit?: number;
    currentUsage: number;
  };
  isActive: boolean;
}

export interface EmailCampaign {
  _id: string;
  campaignId: string;
  name: string;
  type: string;
  status: string;
  content: {
    subject: string;
    preheader?: string;
    htmlContent?: string;
    textContent?: string;
  };
  tracking: {
    sent: number;
    opens: number;
    clicks: number;
    conversions: number;
  };
  targeting: {
    segments: string[];
    excludeUnsubscribed: boolean;
  };
}

export interface ReviewManagement {
  _id: string;
  reviewId: string;
  platform: string;
  guest: {
    name: string;
    email: string;
    verified: boolean;
  };
  content: {
    rating: number;
    title?: string;
    review?: string;
    stayDate: string;
  };
  sentiment: {
    score: number;
    label: string;
    confidence: number;
  };
  moderation: {
    status: string;
  };
  visibility: {
    isPublic: boolean;
  };
}

export interface MarketingDashboardData {
  widgetPerformance: {
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
  };
  emailMarketing: {
    totalSent: number;
    totalOpens: number;
    totalClicks: number;
    totalConversions: number;
    openRate: number;
    clickRate: number;
  };
  guestSegmentation: Array<{
    _id: string;
    count: number;
    averageLTV: number;
  }>;
  reviewSummary: {
    totalReviews: number;
    averageRating: number;
    positiveReviews: number;
  };
  totalWidgets: number;
  activeCampaigns: number;
}

export interface CreateWidgetData {
  name: string;
  type: string;
  config: {
    theme: {
      primaryColor: string;
      secondaryColor: string;
      textColor: string;
      borderRadius: string;
      fontFamily: string;
    };
    layout: {
      showImages: boolean;
      showPrices: boolean;
      showAmenities: boolean;
      showReviews: boolean;
      columns: number;
      maxRooms: number;
    };
    behavior: {
      autoSearch: boolean;
      showAvailabilityCalendar: boolean;
      enableGuestSelection: boolean;
      minStayNights: number;
      maxStayNights: number;
      advanceBookingDays: number;
    };
  };
  domains: Array<{
    domain: string;
    isActive: boolean;
    sslEnabled: boolean;
  }>;
  languages: Array<{
    code: string;
    name: string;
    isDefault: boolean;
  }>;
}

export interface CreateEmailCampaignData {
  campaignId: string;
  name: string;
  type: string;
  status: string;
  content: {
    subject: string;
    preheader?: string;
    htmlContent?: string;
    textContent?: string;
  };
  targeting: {
    segments: string[];
    excludeUnsubscribed: boolean;
  };
  scheduling: {
    sendImmediately: boolean;
    scheduledDate?: string;
  };
  tracking: {
    sent: number;
    opens: number;
    clicks: number;
    conversions: number;
  };
}

export interface CreatePromoCodeData {
  codeId: string;
  code: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'free_night' | 'upgrade';
  discount: {
    value: number;
    maxAmount?: number;
  };
  conditions: {
    minBookingValue?: number;
    minNights?: number;
    maxNights?: number;
    applicableRoomTypes?: string[];
    firstTimeGuests?: boolean;
    maxUsagePerGuest?: number;
    combinableWithOtherOffers?: boolean;
  };
  validity: {
    startDate: string;
    endDate: string;
  };
  usage: {
    totalUsageLimit?: number;
  };
  targeting: {
    guestSegments?: string[];
    channels?: string[];
  };
  isActive: boolean;
}

class BookingEngineService {
  /**
   * Get marketing dashboard data
   */
  async getMarketingDashboard(): Promise<MarketingDashboardData> {
    try {
      const response = await api.get('/booking-engine/dashboard');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all booking widgets
   */
  async getBookingWidgets(): Promise<BookingWidget[]> {
    try {
      const response = await api.get('/booking-engine/widgets');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new booking widget
   */
  async createBookingWidget(widgetData: CreateWidgetData): Promise<BookingWidget> {
    try {
      const response = await api.post('/booking-engine/widgets', widgetData);
      return response.data.data.widget;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing booking widget
   */
  async updateBookingWidget(widgetId: string, widgetData: Partial<CreateWidgetData>): Promise<BookingWidget> {
    try {
      const response = await api.put(`/booking-engine/widgets/${widgetId}`, widgetData);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a booking widget
   */
  async deleteBookingWidget(widgetId: string): Promise<void> {
    try {
      await api.delete(`/booking-engine/widgets/${widgetId}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get widget embed code
   */
  async getWidgetCode(widgetId: string): Promise<{ code: string }> {
    try {
      const response = await api.get(`/booking-engine/widgets/${widgetId}/code`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all promo codes
   */
  async getPromoCodes(): Promise<PromoCode[]> {
    try {
      const response = await api.get('/booking-engine/promo-codes');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new promo code
   */
  async createPromoCode(promoData: CreatePromoCodeData): Promise<PromoCode> {
    try {
      const response = await api.post('/booking-engine/promo-codes', promoData);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing promo code
   */
  async updatePromoCode(promoId: string, promoData: Partial<CreatePromoCodeData>): Promise<PromoCode> {
    try {
      const response = await api.put(`/booking-engine/promo-codes/${promoId}`, promoData);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate a promo code
   */
  async validatePromoCode(code: string, bookingValue: number, checkInDate: string, checkOutDate: string): Promise<{
    valid: boolean;
    discount: number;
    message: string;
  }> {
    try {
      const response = await api.post('/booking-engine/promo-codes/validate', {
        code,
        bookingValue,
        checkInDate,
        checkOutDate
      });
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all email campaigns
   */
  async getEmailCampaigns(): Promise<EmailCampaign[]> {
    try {
      const response = await api.get('/booking-engine/campaigns');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new email campaign
   */
  async createEmailCampaign(campaignData: CreateEmailCampaignData): Promise<EmailCampaign> {
    try {
      const response = await api.post('/booking-engine/campaigns', campaignData);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing email campaign
   */
  async updateEmailCampaign(campaignId: string, campaignData: Partial<CreateEmailCampaignData>): Promise<EmailCampaign> {
    try {
      const response = await api.put(`/booking-engine/campaigns/${campaignId}`, campaignData);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send an email campaign
   */
  async sendEmailCampaign(campaignId: string, testEmail?: string): Promise<void> {
    try {
      await api.post(`/booking-engine/campaigns/${campaignId}/send`, { testEmail });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all reviews
   */
  async getReviews(): Promise<ReviewManagement[]> {
    try {
      const response = await api.get('/booking-engine/reviews');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }
}

export const bookingEngineService = new BookingEngineService();
