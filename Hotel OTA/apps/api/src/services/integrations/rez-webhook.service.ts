import { env } from '../../config/env';
import { hmacSha256 } from '../../utils/helpers';

/**
 * Outbound webhooks to ReZ platform.
 * Async — don't block booking confirmation.
 * Retry 3 times with exponential backoff.
 */
export class RezWebhookService {
  private static MAX_RETRIES = 3;

  static async sendBookingConfirmed(params: {
    bookingId: string;
    rezUserId: string;
    bookingValuePaise: number;
    channelSource: string;
    rezCoinToCreditPaise: number;
    rezSessionId?: string;
  }): Promise<void> {
    const payload = {
      event: 'booking_confirmed',
      booking_id: params.bookingId,
      rez_user_id: params.rezUserId,
      rez_session_id: params.rezSessionId || null,
      booking_value_paise: params.bookingValuePaise,
      channel_source: params.channelSource,
      rez_coin_to_credit_paise: params.rezCoinToCreditPaise,
      timestamp: new Date().toISOString(),
    };

    await this.sendWithRetry(
      `${env.REZ_API_BASE_URL}/api/travel-webhooks/ota-booking-confirmed`,
      payload
    );
  }

  static async sendStayCompleted(params: {
    bookingId: string;
    rezUserId: string;
  }): Promise<void> {
    const payload = {
      event: 'stay_completed',
      booking_id: params.bookingId,
      rez_user_id: params.rezUserId,
      timestamp: new Date().toISOString(),
    };

    await this.sendWithRetry(
      `${env.REZ_API_BASE_URL}/api/travel-webhooks/ota-stay-completed`,
      payload
    );
  }

  private static async sendWithRetry(url: string, payload: Record<string, unknown>, attempt = 1): Promise<void> {
    // Prefer REZ_OTA_WEBHOOK_SECRET (specific to OTA→REZ events).
    // Fall back to REZ_WEBHOOK_SECRET for backward compatibility during migration.
    const webhookSecret = env.REZ_OTA_WEBHOOK_SECRET || env.REZ_WEBHOOK_SECRET;
    if (!env.REZ_API_BASE_URL || !webhookSecret) {
      console.log('[DEV] ReZ webhook skipped (no config):', JSON.stringify(payload));
      return;
    }

    const body = JSON.stringify(payload);
    const signature = hmacSha256(body, webhookSecret);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HMAC-Signature': signature,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`ReZ webhook ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(url, payload, attempt + 1);
      }
      console.error(`ReZ webhook failed after ${this.MAX_RETRIES} attempts:`, error);
      throw error;
    }
  }
}
