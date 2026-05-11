/**
 * PMS Webhook Service
 *
 * Pushes Hotel OTA booking events to the Hotel PMS (hotel-management-master).
 * The PMS receives these at POST /api/v1/ota-webhooks/rez-ota.
 *
 * BUG-24 FIX: Now uses BullMQ queue (pms-notification) for reliable delivery.
 * The worker in jobs/workers.ts handles retry with exponential backoff and
 * tracks delivery status in the database.
 *
 * Secret alignment: PMS_WEBHOOK_SECRET (OTA) MUST equal REZ_OTA_WEBHOOK_SECRET (PMS).
 */

import { pmsNotificationQueue } from '../../jobs/queues';

export class PmsWebhookService {
  /**
   * Push booking_confirmed to PMS via BullMQ queue.
   * Queue worker handles retry with exponential backoff.
   */
  static notifyBookingConfirmed(params: {
    bookingId: string;
    bookingRef: string;
    hotelId: string;
    userId: string;
    checkinDate: Date;
    checkoutDate: Date;
    numRooms: number;
    numGuests: number;
    guestName: string | null;
    guestPhone: string | null;
    totalValuePaise: number;
    pgAmountPaise: number;
    otaCoinBurnedPaise: number;
    rezCoinBurnedPaise: number;
    hotelBrandCoinBurnedPaise: number;
  }): void {
    const jobData = {
      event: 'booking_confirmed',
      bookingId: params.bookingId,
      data: {
        ...params,
        checkinDate: params.checkinDate.toISOString().split('T')[0],
        checkoutDate: params.checkoutDate.toISOString().split('T')[0],
      },
    };

    pmsNotificationQueue.add(
      `booking_confirmed-${params.bookingId}`,
      jobData,
      { jobId: `booking_confirmed-${params.bookingId}` }
    ).catch((err) =>
      console.error('[PmsWebhook] Failed to enqueue booking_confirmed:', err.message)
    );
  }

  /**
   * Push booking_cancelled to PMS via BullMQ queue.
   */
  static notifyBookingCancelled(params: {
    bookingId: string;
    bookingRef: string;
    hotelId: string;
    reason: string;
  }): void {
    const jobData = {
      event: 'booking_cancelled',
      bookingId: params.bookingId,
      data: params,
    };

    pmsNotificationQueue.add(
      `booking_cancelled-${params.bookingId}`,
      jobData,
      { jobId: `booking_cancelled-${params.bookingId}` }
    ).catch((err) =>
      console.error('[PmsWebhook] Failed to enqueue booking_cancelled:', err.message)
    );
  }

  /**
   * Push check_in event to PMS when OTA booking is checked in.
   */
  static notifyCheckIn(params: {
    bookingId: string;
    hotelId: string;
    checkinDate: string;
  }): void {
    const jobData = {
      event: 'booking_checkin',
      bookingId: params.bookingId,
      data: params,
    };

    pmsNotificationQueue.add(
      `booking_checkin-${params.bookingId}`,
      jobData,
      { jobId: `booking_checkin-${params.bookingId}` }
    ).catch((err) =>
      console.error('[PmsWebhook] Failed to enqueue booking_checkin:', err.message)
    );
  }

  /**
   * Push check_out event to PMS when OTA booking is checked out.
   */
  static notifyCheckOut(params: {
    bookingId: string;
    hotelId: string;
    checkoutDate: string;
  }): void {
    const jobData = {
      event: 'booking_checkout',
      bookingId: params.bookingId,
      data: params,
    };

    pmsNotificationQueue.add(
      `booking_checkout-${params.bookingId}`,
      jobData,
      { jobId: `booking_checkout-${params.bookingId}` }
    ).catch((err) =>
      console.error('[PmsWebhook] Failed to enqueue booking_checkout:', err.message)
    );
  }
}
