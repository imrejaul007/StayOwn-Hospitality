import { api } from './api';

export interface WebSettings {
  _id: string;
  hotelId: string;
  general: {
    hotelName: string;
    description?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
    contact?: {
      phone?: string;
      email?: string;
      website?: string;
      socialMedia?: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        linkedin?: string;
      };
    };
    timezone: string;
    currency: {
      code: string;
      symbol: string;
      position: 'before' | 'after';
    };
    languages: Array<{
      code: string;
      name: string;
      isDefault: boolean;
    }>;
  };
  booking: {
    minimumStay: number;
    maximumStay: number;
    advanceBookingLimit: number;
    cutoffTime: {
      hours: number;
      minutes: number;
    };
    cancellationPolicy: {
      type: 'flexible' | 'moderate' | 'strict' | 'custom';
      hoursBeforeCheckin: number;
      penaltyPercentage: number;
      customTerms?: string;
    };
    checkInTime: string;
    checkOutTime: string;
    instantConfirmation: boolean;
    requiresApproval: boolean;
    guestDataRequired: string[];
  };
  payment: {
    gateways: Array<{
      name: 'stripe' | 'paypal' | 'razorpay' | 'square' | 'authorize_net' | 'braintree';
      isActive: boolean;
      configuration: Record<string, unknown>;
      fees: {
        percentage: number;
        fixed: number;
      };
    }>;
    acceptedCurrencies: Array<{
      code: string;
      symbol: string;
      exchangeRate: number;
    }>;
    paymentMethods: Array<{
      type: string;
      isActive: boolean;
    }>;
    depositRequired: boolean;
    depositAmount: {
      type: 'percentage' | 'fixed';
      value: number;
    };
    taxInclusive: boolean;
  };
  seo: {
    metaTags?: {
      title?: string;
      description?: string;
      keywords?: string[];
    };
    structuredData?: Record<string, unknown>;
    googleBusinessProfile?: {
      placeId?: string;
      isConnected: boolean;
    };
    robots: {
      index: boolean;
      follow: boolean;
    };
    sitemap: {
      autoGenerate: boolean;
      lastGenerated?: string;
    };
  };
  integrations: {
    googleAnalytics?: {
      isActive: boolean;
      trackingId?: string;
      measurementId?: string;
    };
    googleTagManager?: {
      isActive: boolean;
      containerId?: string;
    };
    facebookPixel?: {
      isActive: boolean;
      pixelId?: string;
    };
    emailMarketing?: {
      provider: 'mailchimp' | 'sendgrid' | 'constant_contact' | 'campaign_monitor' | 'none';
      apiKey?: string;
      listId?: string;
      isActive: boolean;
    };
    chatWidget?: {
      provider: 'intercom' | 'zendesk' | 'tawk_to' | 'crisp' | 'none';
      widgetId?: string;
      isActive: boolean;
    };
    reviewPlatforms?: Array<{
      name: 'google' | 'tripadvisor' | 'booking_com' | 'expedia' | 'yelp';
      widgetCode?: string;
      isActive: boolean;
    }>;
  };
  theme: {
    colorScheme: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
      success: string;
      error: string;
      warning: string;
    };
    typography: {
      primaryFont: string;
      secondaryFont: string;
      fontSize: {
        base: string;
        scale: number;
      };
    };
    layout: {
      maxWidth: string;
      borderRadius: string;
      spacing: string;
    };
    customCSS?: string;
  };
  advanced?: {
    caching?: {
      enabled: boolean;
      ttl: number;
    };
    compression?: {
      enabled: boolean;
    };
    cdn?: {
      enabled: boolean;
      provider?: string;
      endpoint?: string;
    };
    security?: {
      csrfProtection: boolean;
      rateLimiting?: {
        enabled: boolean;
        maxRequests: number;
        windowMinutes: number;
      };
      encryption?: {
        algorithm: string;
      };
    };
  };
  maintenance?: {
    isMaintenanceMode: boolean;
    maintenanceMessage: string;
    allowedIPs?: string[];
    autoBackup?: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
      retention: number;
    };
  };
  version: string;
  isActive: boolean;
  lastBackup?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface SettingsPreview {
  settings: WebSettings;
  metadata: {
    previewId: string;
    createdAt: string;
    expiresAt: string;
    changes: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
  };
}

class WebSettingsService {
  /**
   * Get web settings for a hotel
   */
  async getSettings(hotelId: string): Promise<WebSettings> {
    try {
      const response = await api.get(`/web-settings/${hotelId}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch web settings');
    }
  }

  /**
   * Update web settings
   */
  async updateSettings(hotelId: string, settings: Partial<WebSettings>): Promise<WebSettings> {
    try {
      
      const response = await api.put(`/web-settings/${hotelId}`, settings);
      
      
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update web settings');
    }
  }

  /**
   * Update specific settings section
   */
  async updateSection(
    hotelId: string,
    section: 'general' | 'booking' | 'payment' | 'seo' | 'integrations' | 'theme' | 'advanced' | 'maintenance',
    data: Record<string, unknown>
  ): Promise<WebSettings> {
    try {
      
      const response = await api.put(`/web-settings/${hotelId}/section/${section}`, data);
      
      
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to update settings section');
    }
  }

  /**
   * Test settings configuration
   */
  async testSettings(
    hotelId: string,
    type: 'payment_gateway' | 'email_marketing' | 'google_analytics' | 'facebook_pixel',
    config: Record<string, unknown>
  ): Promise<TestResult> {
    try {
      const response = await api.post(`/web-settings/${hotelId}/test`, {
        type,
        config
      });
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to test settings');
    }
  }

  /**
   * Export settings
   */
  async exportSettings(hotelId: string, format: 'json' = 'json'): Promise<{
    data: WebSettings;
    exportedAt: string;
    version: string;
  }> {
    try {
      const response = await api.get(`/web-settings/${hotelId}/export?format=${format}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to export settings');
    }
  }

  /**
   * Import settings
   */
  async importSettings(hotelId: string, settingsData: Partial<WebSettings>): Promise<WebSettings> {
    try {
      const response = await api.post(`/web-settings/${hotelId}/import`, settingsData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to import settings');
    }
  }

  /**
   * Generate settings preview
   */
  async previewSettings(hotelId: string, previewData: Partial<WebSettings>): Promise<SettingsPreview> {
    try {
      const response = await api.post(`/web-settings/${hotelId}/preview`, previewData);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to generate preview');
    }
  }

  /**
   * Reset settings to default
   */
  async resetToDefault(hotelId: string): Promise<WebSettings> {
    try {
      const response = await api.post(`/web-settings/${hotelId}/reset`, {
        confirm: 'RESET'
      });
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to reset settings');
    }
  }

  /**
   * Download settings as JSON file
   */
  async downloadSettings(hotelId: string, fileName?: string): Promise<void> {
    try {
      const exportData = await this.exportSettings(hotelId);
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `web-settings-${hotelId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      throw new Error('Failed to download settings');
    }
  }

  /**
   * Upload settings from JSON file
   */
  async uploadSettings(hotelId: string, file: File): Promise<WebSettings> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const json = event.target?.result as string;
          const settingsData = JSON.parse(json);
          
          // Validate JSON structure (basic validation)
          if (!settingsData || typeof settingsData !== 'object') {
            throw new Error('Invalid settings file format');
          }
          
          // Extract the actual settings data if it's wrapped in an export structure
          const actualData = settingsData.data || settingsData;
          
          const result = await this.importSettings(hotelId, actualData);
          resolve(result);
        } catch (error: unknown) {
          reject(new Error((error instanceof Error ? error.message : "Unknown error") || 'Failed to parse settings file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read settings file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Validate settings before saving
   */
  validateSettings(settings: Partial<WebSettings>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // General settings validation
    if (settings.general?.hotelName && settings.general.hotelName.trim().length === 0) {
      errors.push('Hotel name is required');
    }

    if (settings.general?.hotelName && settings.general.hotelName.length > 200) {
      errors.push('Hotel name must not exceed 200 characters');
    }

    if (settings.general?.contact?.email && !this.isValidEmail(settings.general.contact.email)) {
      errors.push('Invalid email address');
    }

    // Booking settings validation
    if (settings.booking?.minimumStay !== undefined && settings.booking?.maximumStay !== undefined) {
      if (settings.booking.minimumStay > settings.booking.maximumStay) {
        errors.push('Minimum stay cannot be greater than maximum stay');
      }
    }

    if (settings.booking?.cancellationPolicy?.penaltyPercentage !== undefined) {
      if (settings.booking.cancellationPolicy.penaltyPercentage < 0 || settings.booking.cancellationPolicy.penaltyPercentage > 100) {
        errors.push('Penalty percentage must be between 0 and 100');
      }
    }

    // Payment settings validation
    if (settings.payment?.depositRequired && settings.payment?.depositAmount?.value !== undefined) {
      if (settings.payment.depositAmount.value <= 0) {
        errors.push('Deposit amount must be greater than 0 when deposit is required');
      }
    }

    // SEO validation
    if (settings.seo?.metaTags?.title && settings.seo.metaTags.title.length > 60) {
      errors.push('SEO title should not exceed 60 characters');
    }

    if (settings.seo?.metaTags?.description && settings.seo.metaTags.description.length > 160) {
      errors.push('SEO description should not exceed 160 characters');
    }

    // Theme validation
    if (settings.theme?.colorScheme) {
      const colorFields = ['primary', 'secondary', 'accent', 'background', 'text', 'success', 'error', 'warning'];
      colorFields.forEach(field => {
        const color = settings.theme?.colorScheme?.[field as keyof typeof settings.theme.colorScheme];
        if (color && !this.isValidHexColor(color)) {
          errors.push(`Invalid color format for ${field}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get default settings structure
   */
  getDefaultSettings(): Partial<WebSettings> {
    return {
      general: {
        hotelName: 'My Hotel',
        timezone: 'UTC',
        currency: {
          code: 'USD',
          symbol: '$',
          position: 'before'
        },
        languages: [{
          code: 'en',
          name: 'English',
          isDefault: true
        }]
      },
      booking: {
        minimumStay: 1,
        maximumStay: 30,
        advanceBookingLimit: 365,
        cutoffTime: {
          hours: 18,
          minutes: 0
        },
        cancellationPolicy: {
          type: 'moderate',
          hoursBeforeCheckin: 24,
          penaltyPercentage: 0
        },
        checkInTime: '15:00',
        checkOutTime: '11:00',
        instantConfirmation: true,
        requiresApproval: false,
        guestDataRequired: ['full_name', 'email', 'phone']
      },
      payment: {
        gateways: [],
        acceptedCurrencies: [],
        paymentMethods: [],
        depositRequired: false,
        depositAmount: {
          type: 'percentage',
          value: 0
        },
        taxInclusive: false
      },
      seo: {
        robots: {
          index: true,
          follow: true
        },
        sitemap: {
          autoGenerate: true
        }
      },
      integrations: {},
      theme: {
        colorScheme: {
          primary: '#2563eb',
          secondary: '#64748b',
          accent: '#f59e0b',
          background: '#ffffff',
          text: '#1f2937',
          success: '#10b981',
          error: '#ef4444',
          warning: '#f59e0b'
        },
        typography: {
          primaryFont: 'Inter',
          secondaryFont: 'Inter',
          fontSize: {
            base: '16px',
            scale: 1.125
          }
        },
        layout: {
          maxWidth: '1200px',
          borderRadius: '8px',
          spacing: '1rem'
        }
      }
    };
  }

  // Helper methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidHexColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
  }
}

export const webSettingsService = new WebSettingsService();
export default webSettingsService;