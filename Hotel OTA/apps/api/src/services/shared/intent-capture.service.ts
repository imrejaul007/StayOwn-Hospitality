// ── Intent Capture Service for Hotel OTA ──────────────────────────────────────
// RTMN Commerce Memory — fire-and-forget HTTP pattern

import { logger } from '../../config/logger';

const INTENT_CAPTURE_URL = process.env.INTENT_CAPTURE_URL || 'https://rez-intent-graph.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

const SIGNAL_WEIGHTS: Record<string, number> = {
  search: 0.15,
  view: 0.10,
  hold: 0.35,
  fulfilled: 1.0,
  abandoned: -0.2,
};

interface IntentPayload {
  userId: string;
  appType: string;
  category: string;
  intentKey: string;
  eventType: string;
  properties?: Record<string, unknown>;
}

async function captureIntent(payload: IntentPayload): Promise<void> {
  try {
    await fetch(`${INTENT_CAPTURE_URL}/api/intent/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    logger.debug('[IntentCapture] HTTP capture failed (fire-and-forget)', { error });
  }
}

/**
 * Capture hotel search intent
 */
export async function captureHotelSearch(params: {
  userId: string;
  city: string;
  checkin: string;
  checkout: string;
  hotelId?: string;
}): Promise<void> {
  const intentKey = `hotel_search_${params.city.toLowerCase().replace(/\s+/g, '_')}`;
  await captureIntent({
    userId: params.userId,
    appType: 'hotel_ota',
    category: 'TRAVEL',
    intentKey,
    eventType: 'search',
    properties: { city: params.city, checkin: params.checkin, checkout: params.checkout },
  });
}

/**
 * Capture hotel view intent
 */
export async function captureHotelView(params: {
  userId: string;
  hotelId: string;
  city?: string;
}): Promise<void> {
  const intentKey = `hotel_view_${params.hotelId}`;
  await captureIntent({
    userId: params.userId,
    appType: 'hotel_ota',
    category: 'TRAVEL',
    intentKey,
    eventType: 'view',
    properties: { hotelId: params.hotelId, city: params.city },
  });
}

/**
 * Capture booking hold intent (strong purchase signal)
 */
export async function captureBookingHold(params: {
  userId: string;
  hotelId: string;
  roomTypeId: string;
  checkin: string;
  checkout: string;
}): Promise<void> {
  const intentKey = `hotel_hold_${params.hotelId}_${params.roomTypeId}`;
  await captureIntent({
    userId: params.userId,
    appType: 'hotel_ota',
    category: 'TRAVEL',
    intentKey,
    eventType: 'hold',
    properties: { hotelId: params.hotelId, roomTypeId: params.roomTypeId, checkin: params.checkin, checkout: params.checkout },
  });
}

/**
 * Capture booking confirmation (intent fulfilled)
 */
export async function captureBookingConfirmed(params: {
  userId: string;
  hotelId: string;
  roomTypeId: string;
  bookingId: string;
}): Promise<void> {
  const intentKey = `hotel_fulfilled_${params.hotelId}`;
  await captureIntent({
    userId: params.userId,
    appType: 'hotel_ota',
    category: 'TRAVEL',
    intentKey,
    eventType: 'fulfilled',
    properties: { hotelId: params.hotelId, bookingId: params.bookingId },
  });
}

/**
 * Capture booking cancellation (intent abandoned)
 */
export async function captureBookingCancelled(params: {
  userId: string;
  hotelId: string;
  bookingId: string;
  reason?: string;
}): Promise<void> {
  const intentKey = `hotel_abandoned_${params.hotelId}`;
  await captureIntent({
    userId: params.userId,
    appType: 'hotel_ota',
    category: 'TRAVEL',
    intentKey,
    eventType: 'abandoned',
    properties: { hotelId: params.hotelId, bookingId: params.bookingId, reason: params.reason },
  });
}
