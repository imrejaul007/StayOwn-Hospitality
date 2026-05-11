/**
 * StayOwn Bridge - Integration with Hotel PMS
 *
 * This module handles communication between StayOwn (OTA) and Hotel PMS.
 * Key integrations:
 * 1. Folio sync - charges from Room QR to PMS billing
 * 2. Booking sync - booking creation and updates
 * 3. Room assignment - link Room QR to PMS room data
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './config/logger';

// ─── Configuration ─────────────────────────────────────────────────────────────

const PMS_URL = process.env.HOTEL_PMS_URL || process.env.HOTEL_OTA_API || 'http://localhost:3008';
const SERVICE_KEY = process.env.INTERNAL_SERVICE_TOKEN || '';

// ─── Axios Client ───────────────────────────────────────────────────────────────

const createPMSClient = (): AxiosInstance => {
  return axios.create({
    baseURL: PMS_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'x-service-key': SERVICE_KEY,
    },
  });
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FolioCharge {
  bookingId: string;
  hotelId: string;
  category: 'minibar' | 'laundry' | 'room_service' | 'restaurant' | 'spa' | 'transport' | 'other';
  description: string;
  amountPaise: number;
  quantity?: number;
  unitPricePaise?: number;
  source: 'minibar' | 'room_service' | 'laundry' | 'restaurant' | 'spa' | 'transport' | 'manual';
}

export interface FolioChargeResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface RoomAssignment {
  bookingId: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  floorNumber?: string;
}

export interface PMSBooking {
  bookingId: string;
  pmsBookingId: string;
  propertyId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
}

// ─── Folio Sync ────────────────────────────────────────────────────────────────

/**
 * Add a charge to guest folio in Hotel PMS
 */
export async function addChargeToFolio(charge: FolioCharge): Promise<FolioChargeResult> {
  try {
    const client = createPMSClient();

    logger.info('[Bridge] Adding charge to folio', {
      bookingId: charge.bookingId,
      category: charge.category,
      amountPaise: charge.amountPaise,
    });

    const response = await client.post('/v1/room-service/charge', {
      bookingId: charge.bookingId,
      hotelId: charge.hotelId,
      category: charge.category,
      description: charge.description,
      amountPaise: charge.amountPaise,
      quantity: charge.quantity || 1,
      unitPricePaise: charge.unitPricePaise || charge.amountPaise,
      source: charge.source,
    });

    if (response.data?.success) {
      return {
        success: true,
        transactionId: response.data.data?.transactionId,
      };
    }

    return {
      success: false,
      error: response.data?.message || 'Unknown error',
    };
  } catch (error: any) {
    logger.error('[Bridge] Failed to add charge to folio', {
      bookingId: charge.bookingId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get folio for a booking (charges + payments)
 */
export async function getBookingFolio(bookingId: string): Promise<{
  success: boolean;
  data?: {
    bookingId: string;
    roomCharges: any[];
    serviceCharges: any[];
    payments: any[];
    totalCharges: number;
    totalPayments: number;
    balanceDue: number;
  };
  error?: string;
}> {
  try {
    const client = createPMSClient();

    const response = await client.get(`/v1/room-service/checkout/${bookingId}/bill`);

    if (response.data?.success) {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data?.message || 'Failed to get folio',
    };
  } catch (error: any) {
    logger.error('[Bridge] Failed to get booking folio', {
      bookingId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Complete checkout in PMS
 */
export async function completeCheckout(
  bookingId: string,
  paymentDetails?: {
    method: 'upi' | 'card' | 'cash' | 'wallet';
    amountPaise: number;
    transactionId?: string;
  }
): Promise<{
  success: boolean;
  checkoutId?: string;
  error?: string;
}> {
  try {
    const client = createPMSClient();

    logger.info('[Bridge] Completing checkout', { bookingId });

    const response = await client.post(`/v1/staff/checkout/${bookingId}/complete`, {
      bookingId,
      ...(paymentDetails && { payment: paymentDetails }),
    });

    if (response.data?.success) {
      return {
        success: true,
        checkoutId: response.data.data?.checkoutId,
      };
    }

    return {
      success: false,
      error: response.data?.message || 'Checkout failed',
    };
  } catch (error: any) {
    logger.error('[Bridge] Failed to complete checkout', {
      bookingId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

// ─── Room Assignment ───────────────────────────────────────────────────────────

/**
 * Link Room QR to PMS room assignment
 */
export async function assignRoomToBooking(
  assignment: RoomAssignment
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const client = createPMSClient();

    logger.info('[Bridge] Assigning room to booking', {
      bookingId: assignment.bookingId,
      roomNumber: assignment.roomNumber,
    });

    const response = await client.post('/v1/hotel/room-assignment', {
      bookingId: assignment.bookingId,
      hotelId: assignment.hotelId,
      roomId: assignment.roomId,
      roomNumber: assignment.roomNumber,
      floorNumber: assignment.floorNumber,
    });

    return {
      success: response.data?.success || false,
      error: response.data?.message,
    };
  } catch (error: any) {
    logger.error('[Bridge] Failed to assign room', {
      bookingId: assignment.bookingId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get room details from PMS
 */
export async function getRoomDetails(
  hotelId: string,
  roomId: string
): Promise<{
  success: boolean;
  data?: {
    roomId: string;
    roomNumber: string;
    floorNumber: string;
    roomType: string;
    status: string;
    amenities: string[];
  };
  error?: string;
}> {
  try {
    const client = createPMSClient();

    const response = await client.get(`/v1/hotel/rooms/${roomId}`, {
      params: { hotelId },
    });

    if (response.data?.success) {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data?.message || 'Room not found',
    };
  } catch (error: any) {
    logger.error('[Bridge] Failed to get room details', {
      hotelId,
      roomId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

// ─── Booking Sync ──────────────────────────────────────────────────────────────

/**
 * Sync booking status from StayOwn to PMS
 */
export async function syncBookingToPMS(
  booking: PMSBooking
): Promise<{
  success: boolean;
  pmsBookingId?: string;
  error?: string;
}> {
  try {
    const client = createPMSClient();

    logger.info('[Bridge] Syncing booking to PMS', {
      stayownBookingId: booking.bookingId,
      status: booking.status,
    });

    const response = await client.post('/v1/bookings/sync', {
      source: 'stayown',
      bookingId: booking.bookingId,
      propertyId: booking.propertyId,
      roomTypeId: booking.roomTypeId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      status: booking.status,
    });

    if (response.data?.success) {
      return {
        success: true,
        pmsBookingId: response.data.data?.pmsBookingId,
      };
    }

    return {
      success: false,
      error: response.data?.message || 'Sync failed',
    };
  } catch (error: any) {
    logger.error('[Bridge] Failed to sync booking', {
      stayownBookingId: booking.bookingId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get booking from PMS
 */
export async function getBookingFromPMS(
  bookingId: string
): Promise<{
  success: boolean;
  data?: PMSBooking;
  error?: string;
}> {
  try {
    const client = createPMSClient();

    const response = await client.get(`/v1/bookings/${bookingId}`);

    if (response.data?.success) {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.data?.message || 'Booking not found',
    };
  } catch (error: any) {
    logger.error('[Bridge] Failed to get booking from PMS', {
      bookingId,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

// ─── Webhook Forwarding ─────────────────────────────────────────────────────────

/**
 * Forward webhook from PMS to StayOwn handlers
 */
export async function handlePMSWebhook(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  logger.info('[Bridge] Received PMS webhook', { event });

  switch (event) {
    case 'guest.checkin':
      logger.info('[Bridge] Guest checked in', { bookingId: data.bookingId });
      // Could trigger Room QR activation here
      break;

    case 'guest.checkout':
      logger.info('[Bridge] Guest checking out', { bookingId: data.bookingId });
      // Could trigger checkout process
      break;

    case 'reservation.cancelled':
      logger.info('[Bridge] Reservation cancelled', { bookingId: data.bookingId });
      // Could deactivate Room QR
      break;

    default:
      logger.warn('[Bridge] Unknown PMS webhook event', { event });
  }
}

// ─── Health Check ──────────────────────────────────────────────────────────────

/**
 * Check PMS connectivity
 */
export async function checkPMSHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const client = createPMSClient();
    await client.get('/health');

    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
    };
  }
}
