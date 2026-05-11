/**
 * QR Expiration Notification Service
 *
 * Sends reminders when:
 * - Check-in is approaching (24 hours before)
 * - QR code is about to expire (4 hours before)
 * - QR code has expired
 */

import { RoomQR } from '../room-qr';
import axios from 'axios';

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:4003';
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:4004';
const SMS_SERVICE_URL = process.env.SMS_SERVICE_URL || 'http://localhost:4005';

interface QRExpirationStatus {
  bookingId: string;
  hotelName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: Date;
  checkOut: Date;
  expiresAt: Date;
  hoursUntilExpiry: number;
  status: 'approaching' | 'about_to_expire' | 'expired' | 'ok';
}

export interface NotificationResult {
  bookingId: string;
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
  error?: string;
}

/**
 * Check for QR codes that need expiration notifications
 */
export async function checkExpiringQRs(): Promise<QRExpirationStatus[]> {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  // Find active QR codes that are expiring soon or already expired
  const expiringQRs = await RoomQR.aggregate([
    {
      $match: {
        isActive: true,
        expiresAt: {
          $lte: in24Hours,
          $gte: now,
        },
      },
    },
  ]);

  return expiringQRs.map((qr) => {
    const hoursUntilExpiry = (qr.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    let status: QRExpirationStatus['status'] = 'ok';
    if (hoursUntilExpiry <= 0) {
      status = 'expired';
    } else if (hoursUntilExpiry <= 4) {
      status = 'about_to_expire';
    } else if (hoursUntilExpiry <= 24) {
      status = 'approaching';
    }

    return {
      bookingId: qr.bookingId,
      hotelName: '', // Would need to fetch from hotel service
      guestName: qr.guestName,
      guestEmail: qr.guestEmail,
      guestPhone: qr.guestPhone,
      checkIn: qr.checkIn,
      checkOut: qr.checkOut,
      expiresAt: qr.expiresAt,
      hoursUntilExpiry,
      status,
    };
  });
}

/**
 * Send expiration reminder notifications
 */
export async function sendExpirationReminders(): Promise<NotificationResult[]> {
  const expiringQRs = await checkExpiringQRs();
  const results: NotificationResult[] = [];

  for (const qr of expiringQRs) {
    try {
      const result = await sendExpirationNotification(qr);
      results.push(result);
    } catch (error: any) {
      results.push({
        bookingId: qr.bookingId,
        email: false,
        whatsapp: false,
        sms: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Send a single expiration notification
 */
export async function sendExpirationNotification(
  qr: QRExpirationStatus
): Promise<NotificationResult> {
  const result: NotificationResult = {
    bookingId: qr.bookingId,
    email: false,
    whatsapp: false,
    sms: false,
  };

  let message: string;
  let subject: string;

  switch (qr.status) {
    case 'approaching':
      message = `Hi ${qr.guestName}! Your Room QR code will expire in ${Math.round(qr.hoursUntilExpiry)} hours. Please ensure you have completed your checkout by then. - ${qr.hotelName}`;
      subject = `Reminder: Room QR expiring soon - ${qr.hotelName}`;
      break;
    case 'about_to_expire':
      message = `Hi ${qr.guestName}! Your Room QR code will expire in ${Math.round(qr.hoursUntilExpiry)} hours. Please complete your checkout or contact reception if you need an extension. - ${qr.hotelName}`;
      subject = `Urgent: Room QR expiring soon - ${qr.hotelName}`;
      break;
    case 'expired':
      message = `Hi ${qr.guestName}, your Room QR code has expired. Please return your room key at reception. Thank you for staying with ${qr.hotelName}!`;
      subject = `Room QR Expired - ${qr.hotelName}`;
      break;
    default:
      return result;
  }

  // Send email
  if (qr.guestEmail) {
    try {
      await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: qr.guestEmail,
        subject,
        message,
        type: 'expiration_reminder',
      });
      result.email = true;
    } catch (error) {
      console.error(`[ExpirationNotifier] Email failed for ${qr.bookingId}`);
    }
  }

  // Send WhatsApp
  if (qr.guestPhone) {
    try {
      await axios.post(`${WHATSAPP_SERVICE_URL}/api/send`, {
        to: qr.guestPhone,
        message,
        type: 'text',
      });
      result.whatsapp = true;
    } catch (error) {
      console.error(`[ExpirationNotifier] WhatsApp failed for ${qr.bookingId}`);
    }
  }

  // Send SMS
  if (qr.guestPhone) {
    try {
      await axios.post(`${SMS_SERVICE_URL}/api/send`, {
        to: qr.guestPhone,
        message: message.substring(0, 160), // SMS limit
        type: 'text',
      });
      result.sms = true;
    } catch (error) {
      console.error(`[ExpirationNotifier] SMS failed for ${qr.bookingId}`);
    }
  }

  return result;
}

/**
 * Send check-in reminder (24 hours before)
 */
export async function sendCheckinReminder(bookingId: string): Promise<boolean> {
  const qr = await RoomQR.findOne({ bookingId });

  if (!qr) {
    return false;
  }

  const checkInDate = new Date(qr.checkIn);
  const now = new Date();
  const hoursUntilCheckin = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Only send if within 24-25 hours of check-in
  if (hoursUntilCheckin > 25 || hoursUntilCheckin < 23) {
    return false;
  }

  const message = `Hi ${qr.guestName}! Your stay at ${qr.hotelId} starts tomorrow. Check-in time is 14:00. Your Room QR code will be sent to you at check-in. We look forward to welcoming you!`;

  const sent: boolean[] = [];

  // Email
  if (qr.guestEmail) {
    try {
      await axios.post(`${EMAIL_SERVICE_URL}/api/send`, {
        to: qr.guestEmail,
        subject: `Check-in Reminder - ${qr.hotelId}`,
        message,
        type: 'checkin_reminder',
      });
      sent.push(true);
    } catch {
      sent.push(false);
    }
  }

  // WhatsApp
  if (qr.guestPhone) {
    try {
      await axios.post(`${WHATSAPP_SERVICE_URL}/api/send`, {
        to: qr.guestPhone,
        message,
        type: 'text',
      });
      sent.push(true);
    } catch {
      sent.push(false);
    }
  }

  return sent.some((s) => s);
}

/**
 * Deactivate expired QR codes
 */
export async function deactivateExpiredQRs(): Promise<number> {
  const result = await RoomQR.updateMany(
    {
      isActive: true,
      expiresAt: { $lt: new Date() },
    },
    {
      isActive: false,
    }
  );

  console.log(`[ExpirationNotifier] Deactivated ${result.modifiedCount} expired QR codes`);
  return result.modifiedCount;
}
