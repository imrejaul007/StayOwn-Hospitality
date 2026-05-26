/**
 * OTA → PMS Webhook Sender Service
 *
 * Sends webhook events FROM Hotel OTA TO Hotel PMS.
 * Used for:
 * - Inventory sync requests
 * - Pricing sync requests
 * - Guest loyalty queries
 * - Booking cancellations initiated from OTA
 *
 * Mounted at: POST /api/webhooks/pms/*
 *
 * Secret alignment: REZ_OTA_WEBHOOK_SECRET must equal PMS_WEBHOOK_SECRET on PMS side.
 */

import axios, { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';
import {
  OTAWebhookEventType,
  OTAWebhookPayload,
  WebhookResponse,
  WebhookDeliveryResult,
} from './pms-ota-types';

const WEBHOOK_TIMEOUT_MS = 10000;
const WEBHOOK_RETRY_DELAYS = [1000, 5000, 15000]; // Exponential backoff
const WEBHOOK_DEDUP_TTL_SECONDS = 3600; // 1 hour

// ── Signature helpers ─────────────────────────────────────────────────────────

function signPayload(payload: object, secret: string): string {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  try {
    const expected = signPayload(JSON.parse(payload), secret);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ── Delivery helpers ──────────────────────────────────────────────────────────

async function isDeliveryDuplicate(eventId: string): Promise<boolean> {
  try {
    const key = `webhook:ota:delivered:${eventId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch {
    return false;
  }
}

async function markDeliveryComplete(eventId: string): Promise<void> {
  try {
    const key = `webhook:ota:delivered:${eventId}`;
    await redis.setex(key, WEBHOOK_DEDUP_TTL_SECONDS, '1');
  } catch {
    // Non-critical, continue
  }
}

// ── Webhook Sender ────────────────────────────────────────────────────────────

export class PMSWebhookSender {
  /**
   * Send a webhook event to a specific PMS endpoint.
   * Automatically handles retries, signature, and deduplication.
   */
  static async send(
    endpoint: string,
    eventType: OTAWebhookEventType,
    payload: OTAWebhookPayload,
    secret: string,
    maxRetries = 3
  ): Promise<WebhookDeliveryResult> {
    const { eventId } = payload;

    // Check for duplicate delivery
    if (await isDeliveryDuplicate(eventId)) {
      logger.info('[OTA→PMS] Duplicate delivery skipped', { eventId, endpoint });
      return {
        eventId,
        deliveredAt: new Date().toISOString(),
        success: true,
        attempts: 0,
      };
    }

    const signature = signPayload(payload, secret);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': eventType,
            'X-Webhook-ID': eventId,
            'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
            'User-Agent': 'HotelOTA-Webhooks/1.0',
          },
          timeout: WEBHOOK_TIMEOUT_MS,
          validateStatus: (status) => status < 500, // Accept 2xx and 4xx as "delivered"
        });

        if (response.status >= 200 && response.status < 300) {
          await markDeliveryComplete(eventId);
          logger.info('[OTA→PMS] Webhook delivered', { eventId, endpoint, attempt });
          return {
            eventId,
            deliveredAt: new Date().toISOString(),
            success: true,
            attempts: attempt,
            responseCode: response.status,
          };
        }

        logger.warn('[OTA→PMS] Webhook received non-success', { eventId, status: response.status, attempt });
      } catch (error) {
        const err = error as AxiosError;
        logger.warn('[OTA→PMS] Webhook delivery failed', {
          eventId,
          endpoint,
          attempt,
          error: err.message,
        });

        // Last attempt - don't retry
        if (attempt === maxRetries) {
          return {
            eventId,
            deliveredAt: new Date().toISOString(),
            success: false,
            attempts: attempt,
            error: err.message,
          };
        }
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, WEBHOOK_RETRY_DELAYS[attempt - 1]));
      }
    }

    // Should not reach here
    return {
      eventId,
      deliveredAt: new Date().toISOString(),
      success: false,
      attempts: maxRetries,
      error: 'Max retries exceeded',
    };
  }

  /**
   * Send inventory sync request to PMS.
   */
  static async sendInventorySync(
    pmsEndpoint: string,
    pmsSecret: string,
    hotelId: string,
    roomTypeId: string,
    date: string,
    availableRooms: number,
    isBlocked = false
  ): Promise<WebhookDeliveryResult> {
    const payload: OTAWebhookPayload = {
      // SECURITY: Use crypto.randomUUID() for cryptographically secure event IDs
      eventId: `inv_sync_${Date.now()}_${randomUUID().substring(0, 9)}`,
      eventType: OTAWebhookEventType.INVENTORY_SYNC_REQUEST,
      timestamp: new Date().toISOString(),
      hotelId,
      source: 'ota',
      data: {
        eventType: OTAWebhookEventType.INVENTORY_SYNC_REQUEST,
        roomTypeId,
        date,
        availableRooms,
        isBlocked,
      },
    };

    return this.send(pmsEndpoint, OTAWebhookEventType.INVENTORY_SYNC_REQUEST, payload, pmsSecret);
  }

  /**
   * Send pricing sync request to PMS.
   */
  static async sendPricingSync(
    pmsEndpoint: string,
    pmsSecret: string,
    hotelId: string,
    roomTypeId: string,
    date: string,
    ratePaise: number,
    currency = 'INR'
  ): Promise<WebhookDeliveryResult> {
    const payload: OTAWebhookPayload = {
      // SECURITY: Use crypto.randomUUID() for cryptographically secure event IDs
      eventId: `price_sync_${Date.now()}_${randomUUID().substring(0, 9)}`,
      eventType: OTAWebhookEventType.PRICING_SYNC_REQUEST,
      timestamp: new Date().toISOString(),
      hotelId,
      source: 'ota',
      data: {
        eventType: OTAWebhookEventType.PRICING_SYNC_REQUEST,
        roomTypeId,
        date,
        ratePaise,
        currency,
      },
    };

    return this.send(pmsEndpoint, OTAWebhookEventType.PRICING_SYNC_REQUEST, payload, pmsSecret);
  }

  /**
   * Query guest loyalty info from PMS.
   */
  static async queryGuestLoyalty(
    pmsEndpoint: string,
    pmsSecret: string,
    hotelId: string,
    guestEmail?: string,
    guestPhone?: string,
    otaUserId?: string
  ): Promise<{ success: boolean; loyaltyTier?: string; loyaltyPoints?: number; error?: string }> {
    const payload: OTAWebhookPayload = {
      // SECURITY: Use crypto.randomUUID() for cryptographically secure event IDs
      eventId: `loyalty_query_${Date.now()}_${randomUUID().substring(0, 9)}`,
      eventType: OTAWebhookEventType.GUEST_LOYALTY_QUERY,
      timestamp: new Date().toISOString(),
      hotelId,
      source: 'ota',
      data: {
        eventType: OTAWebhookEventType.GUEST_LOYALTY_QUERY,
        guestEmail,
        guestPhone,
        otaUserId,
      },
    };

    try {
      const signature = signPayload(payload, pmsSecret);
      const response = await axios.post(pmsEndpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': OTAWebhookEventType.GUEST_LOYALTY_QUERY,
          'X-Webhook-ID': payload.eventId,
          'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
        },
        timeout: WEBHOOK_TIMEOUT_MS,
      });

      return {
        success: true,
        ...response.data,
      };
    } catch (error) {
      const err = error as AxiosError;
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Notify PMS of booking cancellation (for OTA-initiated cancellations).
   */
  static async sendBookingCancellation(
    pmsEndpoint: string,
    pmsSecret: string,
    hotelId: string,
    bookingId: string,
    bookingRef: string,
    reason?: string,
    refundAmount?: number
  ): Promise<WebhookDeliveryResult> {
    const payload: OTAWebhookPayload = {
      // SECURITY: Use crypto.randomUUID() for cryptographically secure event IDs
      eventId: `ota_cancel_${Date.now()}_${randomUUID().substring(0, 9)}`,
      eventType: OTAWebhookEventType.BOOKING_CANCELLED,
      timestamp: new Date().toISOString(),
      hotelId,
      source: 'ota',
      data: {
        eventType: OTAWebhookEventType.BOOKING_CANCELLED,
        bookingId,
        bookingRef,
        reason,
        cancelledAt: new Date().toISOString(),
        refundAmount,
      },
    };

    return this.send(pmsEndpoint, OTAWebhookEventType.BOOKING_CANCELLED, payload, pmsSecret);
  }
}

// ── Export for convenience ─────────────────────────────────────────────────────

export const pmsWebhookSender = PMSWebhookSender;

export default PMSWebhookSender;
