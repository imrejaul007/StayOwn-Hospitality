import logger from './utils/logger';

/**
 * WhatsApp Business API Integration
 * FIX: Added retry logic with exponential backoff for transient failures
 */

import axios, { AxiosError } from 'axios';

const WHATSAPP_API = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

// Timeout configuration (10 seconds default)
const REQUEST_TIMEOUT = 10000;

/**
 * Retry logic with exponential backoff for transient failures
 * Only retries on rate limits (429) and server errors (5xx)
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (attempt < retries && isRetryableError(error)) {
        const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        logger.info(`[WhatsApp] Retry attempt ${attempt + 1}/${retries} after ${delay}ms`);
        await sleep(delay);
        continue;
      }

      // Don't retry on non-retryable errors
      break;
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable (rate limit or server error)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    // Retry on rate limit (429) or server errors (5xx)
    return status === 429 || (status !== undefined && status >= 500);
  }
  // Retry on network errors
  return true;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface WhatsAppTemplate {
  to: string;
  template: string;
  language?: { code: string };
  components?: any[];
}

// Pre-approved templates
const TEMPLATES = {
  booking_confirmed: {
    name: 'booking_confirmed',
    language: { code: 'en' },
    components: [
      { type: 'header', parameters: [{ type: 'text', text: '{{1}}' }] }, // Hotel name
      { type: 'body', parameters: [
        { type: 'text', text: '{{2}}' }, // Guest name
        { type: 'text', text: '{{3}}' }, // Check-in date
        { type: 'text', text: '{{4}}' }, // Room number
      ]}
    ]
  },
  checkin_reminder: {
    name: 'checkin_reminder',
    language: { code: 'en' },
    components: [
      { type: 'body', parameters: [
        { type: 'text', text: '{{1}}' }, // Guest name
        { type: 'text', text: '{{2}}' }, // Hotel name
        { type: 'text', text: '{{3}}' }, // Check-in time
        { type: 'text', text: '{{4}}' }, // QR link
      ]}
    ]
  },
  room_service_ready: {
    name: 'room_service_ready',
    language: { code: 'en' },
    components: [
      { type: 'body', parameters: [
        { type: 'text', text: '{{1}}' }, // Guest name
        { type: 'text', text: '{{2}}' }, // Order ID
      ]}
    ]
  }
};

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class WhatsAppService {
  /**
   * Send a WhatsApp template message
   * FIX: Added retry logic with exponential backoff for reliability
   */
  async sendMessage(phone: string, template: keyof typeof TEMPLATES, params: string[]): Promise<WhatsAppMessageResult> {
    const templateConfig = TEMPLATES[template];

    if (!WHATSAPP_TOKEN) {
      logger.warn('[WhatsApp] WHATSAPP_ACCESS_TOKEN not configured - message not sent');
      return { success: false, error: 'WhatsApp not configured' };
    }

    // Replace template params
    let bodyParams = templateConfig.components.find(c => c.type === 'body')?.parameters || [];
    bodyParams = bodyParams.map((p: any, i: number) => ({
      ...p,
      text: params[i] || p.text
    }));

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateConfig.name,
        language: templateConfig.language,
        components: templateConfig.components.map((c: any) =>
          c.type === 'body' ? { ...c, parameters: bodyParams } : c
        )
      }
    };

    try {
      // Use retry logic for transient failures
      const response = await withRetry(async () => {
        return axios.post(`${WHATSAPP_API}/messages`, payload, {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: REQUEST_TIMEOUT
        });
      });

      console.log(`[WhatsApp] Message sent to ${phone}:`, response.data);
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error: any) {
      console.error('[WhatsApp] Send failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Send a raw WhatsApp text message (for testing or simple messages)
   * FIX: Added retry logic with exponential backoff
   */
  async sendTextMessage(phone: string, message: string): Promise<WhatsAppMessageResult> {
    if (!WHATSAPP_TOKEN) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message }
    };

    try {
      // Use retry logic for transient failures
      const response = await withRetry(async () => {
        return axios.post(`${WHATSAPP_API}/messages`, payload, {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: REQUEST_TIMEOUT
        });
      });
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error: any) {
      console.error('[WhatsApp] Send text failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Convenience methods

  /**
   * Send booking confirmation message
   */
  async sendBookingConfirmation(phone: string, data: {
    hotelName: string;
    guestName: string;
    checkIn: string;
    roomNumber: string;
  }): Promise<WhatsAppMessageResult> {
    return this.sendMessage(phone, 'booking_confirmed', [
      data.hotelName,
      data.guestName,
      data.checkIn,
      data.roomNumber
    ]);
  }

  /**
   * Send check-in reminder with QR code
   */
  async sendCheckinReminder(phone: string, data: {
    guestName: string;
    hotelName: string;
    checkInTime: string;
    qrUrl: string;
  }): Promise<WhatsAppMessageResult> {
    return this.sendMessage(phone, 'checkin_reminder', [
      data.guestName,
      data.hotelName,
      data.checkInTime,
      data.qrUrl
    ]);
  }

  /**
   * Send room service ready notification
   */
  async sendServiceReady(phone: string, data: {
    guestName: string;
    orderId: string;
  }): Promise<WhatsAppMessageResult> {
    return this.sendMessage(phone, 'room_service_ready', [
      data.guestName,
      data.orderId
    ]);
  }

  /**
   * Validate phone number format (E.164)
   */
  validatePhoneNumber(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Format phone number to E.164 if needed
   */
  formatPhoneNumber(phone: string, countryCode: string = '91'): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If already has country code
    if (digits.startsWith(countryCode)) {
      return `+${digits}`;
    }

    // If starts with 0, remove it and add country code
    if (digits.startsWith('0')) {
      return `+${countryCode}${digits.slice(1)}`;
    }

    // Otherwise just add country code
    return `+${countryCode}${digits}`;
  }
}

export const whatsappService = new WhatsAppService();
