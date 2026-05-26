/**
 * OTA → PMS Integration Service
 *
 * High-level wrapper for sending events FROM Hotel OTA TO Hotel PMS.
 * Provides a clean API for inventory sync, pricing updates, and booking operations.
 *
 * Usage:
 *   import { otaToPmsIntegration } from './services/integrations/ota-to-pms.service';
 *   await otaToPmsIntegration.syncInventory(hotelId, roomTypeId, date, availableRooms);
 */

import { randomUUID } from 'crypto';
import { PMSWebhookSender } from './pms-webhook-sender.service';
import { logger } from '../../config/logger';
import { prisma } from '../../config/database';
import {
  OTAWebhookEventType,
  OTAWebhookPayload,
} from './pms-ota-types';

interface PMSConnection {
  pmsWebhookUrl: string;
  pmsWebhookSecret: string;
  pmsHotelId: string;
  isEnabled: boolean;
}

/**
 * Get PMS connection details for a hotel
 */
async function getPmsConnection(hotelId: string): Promise<PMSConnection | null> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      pmsWebhookUrl: true,
      pmsWebhookSecret: true,
      pmsWebhookActive: true,
      hotelId: true,
    },
  });

  if (!hotel || !hotel.pmsWebhookActive || !hotel.pmsWebhookUrl) {
    return null;
  }

  return {
    pmsWebhookUrl: hotel.pmsWebhookUrl,
    pmsWebhookSecret: hotel.pmsWebhookSecret || process.env.PMS_WEBHOOK_SECRET || '',
    // Use hotelId as PMS hotel ID (may be same as OTA hotelId or mapped)
    pmsHotelId: hotel.hotelId || hotelId,
    isEnabled: hotel.pmsWebhookActive,
  };
}

/**
 * OTA → PMS Integration Service
 *
 * Provides methods for sending events to PMS.
 */
export class OtaToPmsIntegration {
  private sender: typeof PMSWebhookSender;

  constructor() {
    this.sender = PMSWebhookSender;
  }

  /**
   * Send inventory sync request to PMS
   *
   * Call this when OTA needs to update PMS inventory
   *
   * @param hotelId - OTA hotel ID
   * @param roomTypeId - Room type ID
   * @param date - Date (YYYY-MM-DD)
   * @param availableRooms - Number of available rooms
   * @param isBlocked - Whether rooms are blocked
   */
  async syncInventory(
    hotelId: string,
    roomTypeId: string,
    date: string,
    availableRooms: number,
    isBlocked = false
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await getPmsConnection(hotelId);
    if (!connection) {
      logger.debug('[OTA→PMS] PMS not enabled for hotel', { hotelId });
      return { success: false, error: 'PMS not enabled for hotel' };
    }

    try {
      logger.info('[OTA→PMS] Syncing inventory', {
        hotelId,
        roomTypeId,
        date,
        availableRooms,
        isBlocked,
        pmsUrl: connection.pmsWebhookUrl,
      });

      const result = await this.sender.sendInventorySync(
        connection.pmsWebhookUrl,
        connection.pmsWebhookSecret,
        connection.pmsHotelId,
        roomTypeId,
        date,
        availableRooms,
        isBlocked
      );

      if (result.success) {
        logger.info('[OTA→PMS] Inventory synced successfully', {
          eventId: result.eventId,
          hotelId,
          roomTypeId,
        });
      } else {
        logger.warn('[OTA→PMS] Inventory sync failed', {
          error: result.error,
          hotelId,
          roomTypeId,
        });
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      logger.error('[OTA→PMS] Inventory sync error', {
        error: error instanceof Error ? error.message : String(error),
        hotelId,
        roomTypeId,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send pricing sync request to PMS
   *
   * Call this when OTA needs to update PMS rates
   *
   * @param hotelId - OTA hotel ID
   * @param roomTypeId - Room type ID
   * @param date - Date (YYYY-MM-DD)
   * @param ratePaise - Rate in paise
   * @param currency - Currency code (default: INR)
   */
  async syncPricing(
    hotelId: string,
    roomTypeId: string,
    date: string,
    ratePaise: number,
    currency = 'INR'
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await getPmsConnection(hotelId);
    if (!connection) {
      logger.debug('[OTA→PMS] PMS not enabled for hotel', { hotelId });
      return { success: false, error: 'PMS not enabled for hotel' };
    }

    try {
      logger.info('[OTA→PMS] Syncing pricing', {
        hotelId,
        roomTypeId,
        date,
        ratePaise,
        currency,
        pmsUrl: connection.pmsWebhookUrl,
      });

      const result = await this.sender.sendPricingSync(
        connection.pmsWebhookUrl,
        connection.pmsWebhookSecret,
        connection.pmsHotelId,
        roomTypeId,
        date,
        ratePaise,
        currency
      );

      if (result.success) {
        logger.info('[OTA→PMS] Pricing synced successfully', {
          eventId: result.eventId,
          hotelId,
          roomTypeId,
        });
      } else {
        logger.warn('[OTA→PMS] Pricing sync failed', {
          error: result.error,
          hotelId,
          roomTypeId,
        });
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      logger.error('[OTA→PMS] Pricing sync error', {
        error: error instanceof Error ? error.message : String(error),
        hotelId,
        roomTypeId,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Query guest loyalty info from PMS
   *
   * @param hotelId - OTA hotel ID
   * @param guestEmail - Guest email (optional)
   * @param guestPhone - Guest phone (optional)
   * @param otaUserId - OTA user ID (optional)
   */
  async queryGuestLoyalty(
    hotelId: string,
    guestEmail?: string,
    guestPhone?: string,
    otaUserId?: string
  ): Promise<{ success: boolean; loyaltyTier?: string; loyaltyPoints?: number; error?: string }> {
    const connection = await getPmsConnection(hotelId);
    if (!connection) {
      logger.debug('[OTA→PMS] PMS not enabled for hotel', { hotelId });
      return { success: false, error: 'PMS not enabled for hotel' };
    }

    try {
      logger.info('[OTA→PMS] Querying guest loyalty', {
        hotelId,
        guestEmail,
        guestPhone,
        otaUserId,
      });

      // Note: This endpoint is typically at /ota-webhooks/hotel-ota for loyalty queries
      // We'll use the webhook sender but this requires a specific endpoint
      const result = await this.sender.queryGuestLoyalty(
        connection.pmsWebhookUrl.replace('/api/webhooks/pms/unified', '/api/v1/ota-webhooks/hotel-ota'),
        connection.pmsWebhookSecret,
        connection.pmsHotelId,
        guestEmail,
        guestPhone,
        otaUserId
      );

      if (result.success) {
        logger.info('[OTA→PMS] Guest loyalty query successful', {
          hotelId,
          loyaltyTier: result.loyaltyTier,
        });
      } else {
        logger.warn('[OTA→PMS] Guest loyalty query failed', {
          error: result.error,
          hotelId,
        });
      }

      return {
        success: result.success,
        loyaltyTier: result.loyaltyTier,
        loyaltyPoints: result.loyaltyPoints,
        error: result.error,
      };
    } catch (error) {
      logger.error('[OTA→PMS] Guest loyalty query error', {
        error: error instanceof Error ? error.message : String(error),
        hotelId,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Notify PMS of booking cancellation (OTA-initiated)
   *
   * @param hotelId - OTA hotel ID
   * @param bookingId - OTA booking ID
   * @param bookingRef - Booking reference
   * @param reason - Cancellation reason
   * @param refundAmount - Refund amount (optional)
   */
  async notifyBookingCancellation(
    hotelId: string,
    bookingId: string,
    bookingRef: string,
    reason?: string,
    refundAmount?: number
  ): Promise<{ success: boolean; error?: string }> {
    const connection = await getPmsConnection(hotelId);
    if (!connection) {
      logger.debug('[OTA→PMS] PMS not enabled for hotel', { hotelId });
      return { success: false, error: 'PMS not enabled for hotel' };
    }

    try {
      logger.info('[OTA→PMS] Notifying booking cancellation', {
        hotelId,
        bookingId,
        bookingRef,
        reason,
        refundAmount,
      });

      const result = await this.sender.sendBookingCancellation(
        connection.pmsWebhookUrl,
        connection.pmsWebhookSecret,
        connection.pmsHotelId,
        bookingId,
        bookingRef,
        reason,
        refundAmount
      );

      if (result.success) {
        logger.info('[OTA→PMS] Booking cancellation notified successfully', {
          eventId: result.eventId,
          bookingId,
        });
      } else {
        logger.warn('[OTA→PMS] Booking cancellation notification failed', {
          error: result.error,
          bookingId,
        });
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      logger.error('[OTA→PMS] Booking cancellation notification error', {
        error: error instanceof Error ? error.message : String(error),
        bookingId,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send a raw webhook event to PMS (advanced usage)
   *
   * @param hotelId - OTA hotel ID
   * @param eventType - Event type
   * @param data - Event data
   */
  async send(
    hotelId: string,
    eventType: OTAWebhookEventType,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const connection = await getPmsConnection(hotelId);
    if (!connection) {
      logger.debug('[OTA→PMS] PMS not enabled for hotel', { hotelId });
      return { success: false, error: 'PMS not enabled for hotel' };
    }

    try {
      const payload: OTAWebhookPayload = {
        // SECURITY: Use crypto.randomUUID() for cryptographically secure event IDs
        eventId: `${eventType}_${Date.now()}_${randomUUID().substring(0, 9)}`,
        eventType,
        timestamp: new Date().toISOString(),
        hotelId: connection.pmsHotelId,
        source: 'ota',
        data: data as any,
      };

      const result = await this.sender.send(
        connection.pmsWebhookUrl,
        eventType,
        payload,
        connection.pmsWebhookSecret
      );

      return {
        success: result.success,
        eventId: result.eventId,
        error: result.error,
      };
    } catch (error) {
      logger.error('[OTA→PMS] Send error', {
        error: error instanceof Error ? error.message : String(error),
        eventType,
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check if PMS integration is configured for a hotel
   *
   * @param hotelId - Hotel ID
   */
  async isConfigured(hotelId: string): Promise<boolean> {
    const connection = await getPmsConnection(hotelId);
    return !!connection;
  }

  /**
   * Get integration status for a hotel
   *
   * @param hotelId - Hotel ID
   */
  async getStatus(hotelId: string): Promise<{
    configured: boolean;
    pmsWebhookUrl?: string;
    error?: string;
  }> {
    const connection = await getPmsConnection(hotelId);
    if (!connection) {
      return { configured: false, error: 'PMS not enabled for hotel' };
    }
    return {
      configured: true,
      pmsWebhookUrl: connection.pmsWebhookUrl,
    };
  }
}

// Singleton instance
export const otaToPmsIntegration = new OtaToPmsIntegration();

export default otaToPmsIntegration;
