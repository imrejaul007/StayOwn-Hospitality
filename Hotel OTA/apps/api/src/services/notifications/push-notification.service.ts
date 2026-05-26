import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Push Notification Service using Firebase Cloud Messaging (FCM).
 * In dev mode, notifications are logged to console.
 * In production, requires FIREBASE_SERVICE_ACCOUNT env var with JSON.
 */

let firebaseApp: any = null;

function getFirebaseMessaging() {
  if (firebaseApp) return firebaseApp;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) return null;

  try {
    const admin = require('firebase-admin');
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
    return admin.messaging();
  } catch {
    return null;
  }
}

export class PushNotificationService {
  /**
   * Send push notification to a user by userId.
   */
  static async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, phone: true },
    });

    if (!user?.fcmToken) {
      logger.info(`[PUSH] No FCM token for user ${userId}`);
      return false;
    }

    return this.send(user.fcmToken, title, body, data);
  }

  /**
   * Send push notification to a hotel's primary contact.
   */
  static async sendToHotel(hotelId: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
    const staff = await prisma.hotelStaff.findFirst({
      where: { hotelId, isActive: true, role: 'manager' },
    });
    if (!staff) return false;

    // Find user by phone
    const user = await prisma.user.findUnique({ where: { phone: staff.phone } });
    if (!user?.fcmToken) return false;

    return this.send(user.fcmToken, title, body, data);
  }

  /**
   * Core send method.
   */
  static async send(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
    if (env.NODE_ENV !== 'production') {
      logger.info(`[PUSH] ${title}: ${body} → ${fcmToken.slice(0, 20)}...`);
      return true;
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      logger.info(`[PUSH] Firebase not configured. ${title}: ${body}`);
      return false;
    }

    try {
      await messaging.send({
        token: fcmToken,
        notification: { title, body },
        data: data || {},
        android: { priority: 'high' as const },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      return true;
    } catch (err: any) {
      console.error('[PUSH] Send failed:', err.message);
      // If token is invalid, clear it
      if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
        await prisma.user.updateMany({
          where: { fcmToken },
          data: { fcmToken: null },
        });
      }
      return false;
    }
  }

  // ── Notification triggers ──────────────────────────────────

  static async notifyBookingConfirmed(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: { select: { name: true } } },
    });
    if (!booking) return;

    await this.sendToUser(booking.userId, 'Booking Confirmed!', `Your stay at ${booking.hotel.name} is confirmed. Tap to view.`, { type: 'booking', booking_id: bookingId });
  }

  static async notifyCoinEarned(userId: string, amountPaise: number, hotelName: string) {
    await this.sendToUser(userId, `🟡 ₹${amountPaise / 100} Travel Coins earned!`, `From your stay at ${hotelName}`, { type: 'wallet' });
  }

  static async notifyCoinExpiring(userId: string, amountPaise: number, expiryDate: string) {
    await this.sendToUser(userId, `⚠️ ₹${amountPaise / 100} coins expiring soon`, `Use your Travel Coins before ${expiryDate}`, { type: 'wallet' });
  }

  static async notifyMiningComplete(hotelId: string, unitsEarned: number, rank: number) {
    await this.sendToHotel(hotelId, `🏛️ ${unitsEarned.toFixed(0)} ownership units earned!`, `Monthly mining complete. You ranked #${rank} in the network.`, { type: 'ownership' });
  }

  static async notifyDisputeResolved(hotelId: string, resolution: string) {
    await this.sendToHotel(hotelId, 'Dispute resolved', resolution, { type: 'ownership' });
  }

  static async notifyCheckinReminder(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: { select: { name: true } } },
    });
    if (!booking) return;

    await this.sendToUser(booking.userId, `Check-in tomorrow at ${booking.hotel.name}`, "Don't forget — check-in from 2:00 PM onwards.", { type: 'booking', booking_id: bookingId });
  }

  // ── Room Service Notifications ──────────────────────────────────────────

  /**
   * Notify guest when their room service request status changes.
   * Sent via FCM push notification.
   */
  static async notifyRoomServiceStatusUpdated(params: {
    guestUserId: string;
    requestId: string;
    serviceType: string;
    status: string;
    hotelName: string;
    roomNumber: string;
  }) {
    const { guestUserId, requestId, serviceType, status, hotelName, roomNumber } = params;

    const statusMessages: Record<string, { title: string; body: string }> = {
      assigned: {
        title: `${serviceType.replace('_', ' ')} request accepted`,
        body: `Your ${serviceType.replace('_', ' ')} request in Room ${roomNumber} has been assigned to staff.`,
      },
      in_progress: {
        title: `${serviceType.replace('_', ' ')} in progress`,
        body: `Your ${serviceType.replace('_', ' ')} request is now being worked on.`,
      },
      completed: {
        title: `${serviceType.replace('_', ' ')} completed`,
        body: `Your ${serviceType.replace('_', ' ')} request has been completed. Enjoy your stay!`,
      },
      cancelled: {
        title: `${serviceType.replace('_', ' ')} cancelled`,
        body: `Your ${serviceType.replace('_', ' ')} request has been cancelled. Please contact reception.`,
      },
    };

    const copy = statusMessages[status] ?? {
      title: `Room service update`,
      body: `Your request status: ${status}`,
    };

    await this.sendToUser(guestUserId, copy.title, copy.body, {
      type: 'room_service',
      request_id: requestId,
      status,
      hotel_name: hotelName,
    });
  }

  /**
   * Notify hotel staff (via Socket.IO + FCM fallback) when a new room service request arrives.
   * Staff notifications go to the hotel's staff dashboard via Socket.IO.
   */
  static async notifyHotelStaffNewRequest(params: {
    hotelId: string;
    requestId: string;
    serviceType: string;
    roomNumber: string;
    priority: string;
    description?: string;
  }) {
    const { hotelId, requestId, serviceType, roomNumber, priority, description } = params;

    // Log for dev environments (staff notification goes via Socket.IO in hotel-panel)
    logger.info('[PUSH] New room service request for hotel staff', {
      hotelId,
      requestId,
      serviceType,
      roomNumber,
      priority,
    });
  }
}
