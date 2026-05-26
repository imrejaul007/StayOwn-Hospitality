import logger from './utils/logger';

/**
 * Room Service Webhook Service
 *
 * Listens for room service events from Hotel OTA and syncs to StayOwn folio.
 *
 * Events:
 * - request.created - New service request
 * - request.completed - Service completed (triggers charge)
 * - charge.added - Direct charge (minibar, etc.)
 * - checkout.requested - Guest requests checkout
 */

import axios from 'axios';
import { handleRoomServiceWebhook, RoomServiceWebhookEvent } from '../room-qr';

const WEBHOOK_SECRET = process.env.ROOM_QR_WEBHOOK_SECRET || 'webhook-secret-change-in-production';
const HOTEL_OTA_API = process.env.HOTEL_OTA_API_URL || 'http://localhost:3008';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Event types from Hotel OTA
 */
export type RoomServiceEventType =
  | 'request.created'
  | 'request.completed'
  | 'request.cancelled'
  | 'charge.added'
  | 'checkout.requested';

export interface RoomServiceEvent {
  type: RoomServiceEventType;
  bookingId: string;
  hotelId: string;
  roomId: string;
  timestamp: Date;
  data?: Record<string, any>;
}

/**
 * Webhook subscription configuration
 */
export interface WebhookSubscription {
  id: string;
  url: string;
  events: RoomServiceEventType[];
  secret: string;
  active: boolean;
  createdAt: Date;
}

/**
 * Process incoming webhook from Hotel OTA
 */
export async function processWebhook(
  payload: RoomServiceWebhookEvent,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  // Verify signature
  if (!verifyWebhookSignature(payload, signature)) {
    logger.error('[RoomService Webhook] Invalid signature');
    return { success: false, error: 'Invalid signature' };
  }

  try {
    await handleRoomServiceWebhook(payload);
    logger.info(`[RoomService Webhook] Processed event: ${payload.event}`);
    return { success: true };
  } catch (error: any) {
    console.error('[RoomService Webhook] Processing failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify webhook signature (HMAC-SHA256)
 */
function verifyWebhookSignature(payload: any, signature: string): boolean {
  const crypto = require('crypto');
  const payloadString = JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * Register webhook with Hotel OTA
 */
export async function registerWebhook(): Promise<boolean> {
  try {
    const webhookUrl = `${process.env.STAYOWN_SERVICE_URL || 'http://localhost:4015'}/api/room-qr/webhook`;

    const response = await axios.post(`${HOTEL_OTA_API}/v1/webhooks`, {
      url: webhookUrl,
      events: ['request.created', 'request.completed', 'charge.added', 'checkout.requested'],
      secret: WEBHOOK_SECRET,
      description: 'StayOwn Room Service Sync'
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      logger.info('[RoomService Webhook] Registered with Hotel OTA');
      return true;
    }

    console.error('[RoomService Webhook] Registration failed:', response.data.message);
    return false;
  } catch (error: any) {
    console.error('[RoomService Webhook] Registration error:', error.message);
    return false;
  }
}

/**
 * Retry failed webhook processing
 */
export async function retryWebhook(
  payload: RoomServiceWebhookEvent,
  maxRetries: number = RETRY_ATTEMPTS
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await handleRoomServiceWebhook(payload);
      logger.info(`[RoomService Webhook] Retry ${attempt} succeeded`);
      return true;
    } catch (error: any) {
      console.error(`[RoomService Webhook] Retry ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return false;
}

/**
 * Handle webhook queue processing (for background jobs)
 */
export async function processWebhookQueue(): Promise<void> {
  // In production, this would process a queue of failed webhooks
  // For now, just log that the service is running
  logger.info('[RoomService Webhook] Queue processor running');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Event transformer - converts Hotel OTA events to StayOwn format
 */
export function transformRoomServiceEvent(
  hotelOtaEvent: any
): RoomServiceWebhookEvent {
  return {
    event: hotelOtaEvent.type,
    bookingId: hotelOtaEvent.bookingId,
    hotelId: hotelOtaEvent.hotelId,
    roomId: hotelOtaEvent.roomId,
    data: {
      serviceType: hotelOtaEvent.serviceType,
      description: hotelOtaEvent.description,
      totalAmountPaise: hotelOtaEvent.totalAmountPaise,
      quantity: hotelOtaEvent.quantity,
      unitPricePaise: hotelOtaEvent.unitPricePaise,
      category: hotelOtaEvent.category || hotelOtaEvent.serviceType,
      source: hotelOtaEvent.source,
      ...hotelOtaEvent.data
    }
  };
}

/**
 * Webhook health check
 */
export async function webhookHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  lastCheck: Date;
  registeredHotels: number;
}> {
  try {
    // In production, check database for registered webhooks
    return {
      status: 'healthy',
      lastCheck: new Date(),
      registeredHotels: 0 // Would query database
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      lastCheck: new Date(),
      registeredHotels: 0
    };
  }
}

/**
 * Event logging for audit trail
 */
export async function logWebhookEvent(
  event: RoomServiceWebhookEvent,
  result: 'success' | 'failure',
  error?: string
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: event.event,
    bookingId: event.bookingId,
    hotelId: event.hotelId,
    roomId: event.roomId,
    result,
    error: error || null,
    payload: JSON.stringify(event.data)
  };

  console.log('[RoomService Webhook]', JSON.stringify(logEntry));

  // In production, store in database for audit trail
  // await WebhookLog.create(logEntry);
}
