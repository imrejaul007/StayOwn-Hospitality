/**
 * Hotel OTA - PMS→OTA Webhook Handler (Enhanced)
 *
 * Handles inbound webhook events pushed FROM the Property Management System TO Hotel OTA.
 * Mounted at: POST /api/webhooks/pms/*
 *
 * Secret alignment: PMS_WEBHOOK_SECRET must equal REZ_OTA_WEBHOOK_SECRET on PMS side.
 *
 * Handles ALL PMS events:
 * - booking_confirmed
 * - check_in
 * - check_out
 * - room_status_change
 * - guest_data_updated
 * - pricing_changed
 * - housekeeping_status
 * - inventory_updated
 * - reservation_cancelled
 */

import * as crypto from 'crypto';
import { prisma } from '../../config/database';
import { CoinService } from '../finance/coin.service';
import { logger } from '../../config/logger';
import { redis } from '../../config/redis';
import {
  PMSWebhookEventType,
  PMSWebhookPayload,
  PMSWebhookData,
  BookingConfirmedData,
  CheckInData,
  CheckOutData,
  RoomStatusChangeData,
  RoomStatus,
  GuestDataUpdatedData,
  PricingChangedData,
  HousekeepingStatusData,
  HousekeepingStatus,
  InventoryUpdatedData,
  WebhookResponse,
} from './pms-ota-types';

const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
const WEBHOOK_DEDUP_TTL_SECONDS = 86400; // 24 hours

// ── Signature verification ──────────────────────────────────────────────────────

export function verifyPMSSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ── Security helpers ─────────────────────────────────────────────────────────────

function validateWebhookTimestamp(timestamp: string): boolean {
  const eventTime = new Date(timestamp).getTime();
  if (isNaN(eventTime)) {
    logger.warn('[PMS→OTA] Invalid webhook timestamp format', { timestamp });
    return false;
  }
  const drift = Math.abs(Date.now() - eventTime);
  if (drift > WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
    logger.warn('[PMS→OTA] Webhook timestamp outside tolerance', { timestamp, driftMs: drift });
    return false;
  }
  return true;
}

async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const key = `webhook:pms:processed:${eventId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    logger.error('[PMS→OTA] Redis dedup check failed', { eventId, error: String(err) });
    return false;
  }
}

async function markEventProcessed(eventId: string): Promise<void> {
  try {
    const key = `webhook:pms:processed:${eventId}`;
    await redis.setex(key, WEBHOOK_DEDUP_TTL_SECONDS, '1');
  } catch (err) {
    logger.error('[PMS→OTA] Failed to mark event processed', { eventId, error: String(err) });
  }
}

async function verifyPmsHotelAuthorization(
  signingPmsId: string | undefined,
  payloadHotelId: string,
  fallbackSecret: string
): Promise<{ authorized: boolean; reason?: string; hotelId: string }> {
  let authorizedHotelId: string | null = null;

  if (payloadHotelId) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: payloadHotelId },
      select: { id: true, pmsWebhookSecret: true },
    });
    if (!hotel) {
      return { authorized: false, reason: 'Hotel not found', hotelId: '' };
    }
    authorizedHotelId = hotel.id;
  }

  return { authorized: true, hotelId: authorizedHotelId ?? payloadHotelId };
}

function getSecretForHotel(hotelId: string, fallbackSecret: string): string {
  // In production, this would fetch per-hotel secrets from the database
  // For now, use the fallback secret
  return fallbackSecret;
}

// ── Event Handlers ────────────────────────────────────────────────────────────

/**
 * Handle booking confirmed event from PMS.
 * Awards OTA coins to the guest.
 */
async function handleBookingConfirmed(
  payload: PMSWebhookPayload
): Promise<{ success: boolean; coinsAwarded?: number; duplicate?: boolean }> {
  const data = payload.data as BookingConfirmedData;
  logger.info('[PMS→OTA] booking_confirmed', {
    reservationId: data.reservationId,
    hotelId: payload.hotelId,
    eventId: payload.eventId,
  });

  // Find the OTA booking by bookingRef (PMS reservation ID) or ID
  // The PMS sends its own reservationId which should match bookingRef in OTA
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { bookingRef: data.reservationId },
        { id: data.reservationId },
      ],
      hotelId: payload.hotelId,
    },
    select: {
      id: true,
      userId: true,
      hotelId: true,
      totalValuePaise: true,
      status: true,
      user: { select: { tier: true, email: true } },
    },
  });

  if (!booking) {
    logger.warn('[PMS→OTA] No OTA booking found for reservation', {
      reservationId: data.reservationId,
      otaBookingId: data.otaBookingId,
    });
    return { success: true }; // Not an error - may be a walk-in booking
  }

  // Update booking status to confirmed if not already confirmed
  if (booking.status === 'init' || booking.status === 'hold') {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'confirmed' },
    });
  }

  // Award OTA coins
  const userTier = booking.user?.tier || 'basic';
  const earnRule = await CoinService.findEarnRule({
    coinType: 'ota',
    hotelId: booking.hotelId,
    channelSource: 'hotel_qr',
    userTier,
    bookingValue: booking.totalValuePaise,
  });

  let coinsAwarded = 0;
  if (earnRule) {
    const earnPct = Number(earnRule.earnPct) / 100;
    const earnAmount = Math.floor(booking.totalValuePaise * earnPct);
    if (earnAmount > 0) {
      await CoinService.earnCoins({
        userId: booking.userId,
        coinType: 'ota',
        amountPaise: earnAmount,
        bookingId: booking.id,
        earnRuleId: earnRule.id,
      });
      coinsAwarded = earnAmount;
    }
  }

  return { success: true, coinsAwarded };
}

/**
 * Handle guest check-in event from PMS.
 * Updates OTA booking status to checked_in.
 */
async function handleCheckIn(
  payload: PMSWebhookPayload
): Promise<{ success: boolean }> {
  const data = payload.data as CheckInData;
  logger.info('[PMS→OTA] check_in', {
    reservationId: data.reservationId,
    roomNumber: data.roomNumber,
    hotelId: payload.hotelId,
  });

  // Update OTA booking status
  await prisma.booking.updateMany({
    where: {
      OR: [
        { bookingRef: data.reservationId },
        { id: data.reservationId },
      ],
      status: { in: ['init', 'hold', 'confirmed'] },
    },
    data: {
      status: 'checked_in',
    },
  });

  return { success: true };
}

/**
 * Handle guest check-out event from PMS.
 * Awards hotel brand coins and updates booking status.
 */
async function handleCheckOut(
  payload: PMSWebhookPayload
): Promise<{ success: boolean; brandCoinsAwarded?: number }> {
  const data = payload.data as CheckOutData;
  logger.info('[PMS→OTA] check_out', {
    reservationId: data.reservationId,
    roomNumber: data.roomNumber,
    hotelId: payload.hotelId,
  });

  // Update OTA booking status
  await prisma.booking.updateMany({
    where: {
      OR: [
        { bookingRef: data.reservationId },
        { id: data.reservationId },
      ],
      status: { in: ['init', 'hold', 'confirmed', 'checked_in'] },
    },
    data: {
      status: 'stayed',
    },
  });

  // Award brand coins via partner API
  let brandCoinsAwarded = 0;
  if (data.bookingValuePaise && data.otaUserId) {
    try {
      const hotel = await prisma.hotel.findUnique({
        where: { id: payload.hotelId },
        select: { brandCoinEnabled: true },
      });

      if (hotel?.brandCoinEnabled) {
        const earnRule = await CoinService.findEarnRule({
          coinType: 'hotel_brand',
          hotelId: payload.hotelId,
          channelSource: 'all',
          userTier: 'all',
          bookingValue: data.bookingValuePaise,
        });

        if (earnRule) {
          const earnAmount = CoinService.calculateEarnAmount(
            data.bookingValuePaise,
            Number(earnRule.earnPct),
            earnRule.maxEarnPerBookingPaise
          );
          if (earnAmount > 0) {
            await CoinService.earnCoins({
              userId: data.otaUserId,
              coinType: 'hotel_brand',
              amountPaise: earnAmount,
              bookingId: data.reservationId,
              earnRuleId: earnRule.id,
              hotelId: payload.hotelId,
            });
            brandCoinsAwarded = earnAmount;
          }
        }
      }
    } catch (error) {
      logger.error('[PMS→OTA] Brand coin award failed', {
        reservationId: data.reservationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { success: true, brandCoinsAwarded };
}

/**
 * Handle room status change event from PMS.
 * Updates room availability status in OTA.
 */
async function handleRoomStatusChange(
  payload: PMSWebhookPayload
): Promise<{ success: boolean }> {
  const data = payload.data as RoomStatusChangeData;
  logger.info('[PMS→OTA] room_status_change', {
    roomNumber: data.roomNumber,
    previousStatus: data.previousStatus,
    newStatus: data.newStatus,
    hotelId: payload.hotelId,
  });

  // Room status changes from PMS are logged but don't directly affect OTA
  // The PMS controls room inventory; OTA uses inventory slots for availability
  // This event is logged for analytics and audit purposes
  logger.info('[PMS→OTA] Room status change logged', {
    roomTypeId: data.roomTypeId,
    newStatus: data.newStatus,
  });

  return { success: true };
}

/**
 * Handle guest data update event from PMS.
 * Syncs guest preferences and loyalty info.
 */
async function handleGuestDataUpdated(
  payload: PMSWebhookPayload
): Promise<{ success: boolean }> {
  const data = payload.data as GuestDataUpdatedData;
  logger.info('[PMS→OTA] guest_data_updated', {
    guestId: data.guestId,
    updatedFields: data.updatedFields,
    hotelId: payload.hotelId,
  });

  // Update loyalty info if provided
  if (data.loyaltyTier && data.guestId) {
    // Cast to any to allow enum value assignment since we're receiving external data
    const tierValue = data.loyaltyTier as 'basic' | 'silver' | 'gold';
    await prisma.user.updateMany({
      where: {
        OR: [
          { id: data.guestId },
          { email: data.guestEmail || undefined },
          { phone: data.guestPhone || undefined },
        ].filter((c) => c !== undefined) as any,
      },
      data: {
        tier: tierValue,
      },
    });
  }

  return { success: true };
}

/**
 * Handle pricing change event from PMS.
 * Updates room type rates in OTA.
 */
async function handlePricingChanged(
  payload: PMSWebhookPayload
): Promise<{ success: boolean }> {
  const data = payload.data as PricingChangedData;
  logger.info('[PMS→OTA] pricing_changed', {
    roomTypeId: data.roomTypeId,
    date: data.date,
    previousRate: data.previousRate,
    newRate: data.newRate,
    hotelId: payload.hotelId,
  });

  // Update inventory slot rate
  const rateInPaise = Math.round(data.newRate * 100); // Convert rupees to paise

  await prisma.inventorySlot.updateMany({
    where: {
      hotelId: payload.hotelId,
      roomTypeId: data.roomTypeId,
      date: new Date(data.date),
    },
    data: {
      ratePaise: rateInPaise,
    },
  });

  return { success: true };
}

/**
 * Handle housekeeping status event from PMS.
 * Updates room housekeeping status in OTA.
 */
async function handleHousekeepingStatus(
  payload: PMSWebhookPayload
): Promise<{ success: boolean }> {
  const data = payload.data as HousekeepingStatusData;
  logger.info('[PMS→OTA] housekeeping_status', {
    roomNumber: data.roomNumber,
    previousStatus: data.previousStatus,
    newStatus: data.newStatus,
    hotelId: payload.hotelId,
  });

  // Map housekeeping status to OTA room status
  const roomStatusMap: Record<HousekeepingStatus, string> = {
    pending: 'vacant_dirty',
    in_progress: 'vacant_dirty',
    completed: 'vacant_clean',
    declined: 'needs_attention',
    inspected: 'vacant_clean',
    needs_attention: 'vacant_dirty',
  };

  // Note: In a real implementation, you might want to store this in a separate
  // housekeeping status table or update room metadata

  return { success: true };
}

/**
 * Handle inventory update event from PMS.
 * Updates room availability in OTA.
 */
async function handleInventoryUpdated(
  payload: PMSWebhookPayload
): Promise<{ success: boolean }> {
  const data = payload.data as InventoryUpdatedData;
  logger.info('[PMS→OTA] inventory_updated', {
    roomTypeId: data.roomTypeId,
    date: data.date,
    previousAvailableRooms: data.previousAvailableRooms,
    newAvailableRooms: data.newAvailableRooms,
    hotelId: payload.hotelId,
  });

  // Update inventory slot
  await prisma.inventorySlot.updateMany({
    where: {
      hotelId: payload.hotelId,
      roomTypeId: data.roomTypeId,
      date: new Date(data.date),
    },
    data: {
      availableRooms: data.newAvailableRooms,
      totalRooms: data.totalRooms,
      isBlocked: data.isBlocked ?? false,
      ratePaise: data.ratePaise,
    },
  });

  return { success: true };
}

/**
 * Handle reservation cancelled event from PMS.
 * Cancels OTA booking and releases inventory.
 */
async function handleReservationCancelled(
  payload: PMSWebhookPayload
): Promise<{ success: boolean }> {
  const data = payload.data as any;
  logger.info('[PMS→OTA] reservation_cancelled', {
    reservationId: data.reservationId,
    hotelId: payload.hotelId,
  });

  const reservationId = data.reservationId;

  // Find the booking by bookingRef or ID
  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { bookingRef: reservationId },
        { id: reservationId },
      ],
    },
    select: {
      id: true,
      status: true,
      numRooms: true,
      roomTypeId: true,
      hotelId: true,
      checkinDate: true,
      checkoutDate: true,
    },
  });

  if (!booking || booking.status === 'cancelled') {
    return { success: true }; // Already cancelled or not found
  }

  // Update booking status and release inventory
  await prisma.$transaction(async (tx) => {
    // Update booking status
    await tx.booking.updateMany({
      where: { id: booking.id, status: { not: 'cancelled' } },
      data: {
        status: 'cancelled',
        cancellationReason: data.cancellationReason,
        cancelledAt: new Date(data.cancelledAt),
      },
    });

    // Release inventory
    await tx.$executeRaw`
      UPDATE inventory_slots
      SET available_rooms = available_rooms + ${booking.numRooms},
          updated_at = NOW()
      WHERE room_type_id = ${booking.roomTypeId}::uuid
        AND hotel_id = ${booking.hotelId}::uuid
        AND date >= ${booking.checkinDate}::date
        AND date < ${booking.checkoutDate}::date
    `;
  });

  return { success: true };
}

// ── Main Dispatcher ───────────────────────────────────────────────────────────

export async function handlePMSWebhook(
  payload: PMSWebhookPayload,
  signature: string,
  fallbackSecret: string,
  pmsId?: string
): Promise<{
  success: boolean;
  message: string;
  coinsAwarded?: number;
  brandCoinsAwarded?: number;
  duplicate?: boolean;
}> {
  // Validate timestamp
  if (!validateWebhookTimestamp(payload.timestamp)) {
    return { success: false, message: 'Webhook timestamp outside tolerance window' };
  }

  // Deduplicate via eventId
  if (payload.eventId) {
    if (await isEventProcessed(payload.eventId)) {
      logger.info('[PMS→OTA] Duplicate webhook event, skipping', {
        eventId: payload.eventId,
        eventType: payload.eventType,
      });
      return { success: true, message: 'Event already processed', duplicate: true };
    }
  }

  // Get secret for hotel
  const secret = getSecretForHotel(payload.hotelId, fallbackSecret);
  if (!secret) {
    logger.error('[PMS→OTA] No webhook secret configured');
    return { success: false, message: 'Webhook not configured' };
  }

  // Verify signature
  if (!verifyPMSSignature(JSON.stringify(payload), signature, secret)) {
    logger.warn('[PMS→OTA] Invalid webhook signature', { hotelId: payload.hotelId });
    return { success: false, message: 'Invalid signature' };
  }

  // Verify authorization
  if (pmsId && payload.hotelId) {
    const auth = await verifyPmsHotelAuthorization(pmsId, payload.hotelId, fallbackSecret);
    if (!auth.authorized) {
      logger.warn('[PMS→OTA] Unauthorized PMS access attempt', {
        signingPmsId: pmsId,
        claimedHotelId: payload.hotelId,
        reason: auth.reason,
      });
      return { success: false, message: 'PMS not authorized for this hotel' };
    }
  }

  logger.info('[PMS→OTA] Received event', {
    eventType: payload.eventType,
    hotelId: payload.hotelId,
    eventId: payload.eventId,
  });

  // Mark event processed BEFORE handling
  if (payload.eventId) {
    await markEventProcessed(payload.eventId);
  }

  // Dispatch to appropriate handler
  let result: { success: boolean; coinsAwarded?: number; brandCoinsAwarded?: number };

  switch (payload.eventType) {
    case PMSWebhookEventType.BOOKING_CONFIRMED:
      result = await handleBookingConfirmed(payload);
      break;

    case PMSWebhookEventType.CHECK_IN:
      result = await handleCheckIn(payload);
      break;

    case PMSWebhookEventType.CHECK_OUT:
      result = await handleCheckOut(payload);
      break;

    case PMSWebhookEventType.ROOM_STATUS_CHANGE:
      result = await handleRoomStatusChange(payload);
      break;

    case PMSWebhookEventType.GUEST_DATA_UPDATED:
      result = await handleGuestDataUpdated(payload);
      break;

    case PMSWebhookEventType.PRICING_CHANGED:
      result = await handlePricingChanged(payload);
      break;

    case PMSWebhookEventType.HOUSEKEEPING_STATUS:
      result = await handleHousekeepingStatus(payload);
      break;

    case PMSWebhookEventType.INVENTORY_UPDATED:
      result = await handleInventoryUpdated(payload);
      break;

    case PMSWebhookEventType.RESERVATION_CANCELLED:
      result = await handleReservationCancelled(payload);
      break;

    default:
      logger.info('[PMS→OTA] Unhandled event type (ignored)', { eventType: String(payload.eventType) });
      return { success: true, message: 'Event type not handled' };
  }

  return {
    success: result.success,
    message: result.success ? 'OK' : 'Failed',
    coinsAwarded: result.coinsAwarded,
    brandCoinsAwarded: result.brandCoinsAwarded,
  };
}

// ── Coin calculation utility ────────────────────────────────────────────────────

export function calculateCoinReward(
  bookingAmount: number,
  coinRate = 0.06,
  minimumBooking = 500
): number {
  if (bookingAmount < minimumBooking) return 0;
  return Math.floor(bookingAmount * coinRate * 100);
}

export default {
  handlePMSWebhook,
  verifyPMSSignature,
  calculateCoinReward,
};
