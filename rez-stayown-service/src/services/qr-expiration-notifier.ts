/**
 * QR Expiration Notification Service
 *
 * Sends reminders when:
 * - Check-in is approaching (24 hours before)
 * - QR code is about to expire (4 hours before)
 * - QR code has expired
 *
 * Uses RABTUL Notification Service for all notifications
 */

import { RoomQR } from '../room-qr';

// RABTUL Notification Service URL
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';

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
 * Send notification via RABTUL Notification Service
 */
async function sendViaRABTUL(recipient: string, channel: 'EMAIL' | 'WHATSAPP' | 'SMS', template: string, data: any): Promise<boolean> {
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': internalToken,
      },
      body: JSON.stringify({
        userId: recipient,
        channel,
        template,
        data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ExpirationNotifier] RABTUL API error: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[ExpirationNotifier] Failed to send via RABTUL:`, error);
    return false;
  }
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

  // Send email via RABTUL
  if (qr.guestEmail) {
    const emailSent = await sendViaRABTUL(qr.guestEmail, 'EMAIL', 'expiration_reminder', {
      to: qr.guestEmail,
      subject,
      message,
    });
    result.email = emailSent;
  }

  // Send WhatsApp via RABTUL
  if (qr.guestPhone) {
    const whatsappSent = await sendViaRABTUL(qr.guestPhone, 'WHATSAPP', 'expiration_reminder', {
      to: qr.guestPhone,
      message,
    });
    result.whatsapp = whatsappSent;
  }

  // Send SMS via RABTUL
  if (qr.guestPhone) {
    const smsSent = await sendViaRABTUL(qr.guestPhone, 'SMS', 'expiration_reminder', {
      to: qr.guestPhone,
      message: message.substring(0, 160), // SMS limit
    });
    result.sms = smsSent;
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

  // Email via RABTUL
  if (qr.guestEmail) {
    const emailSent = await sendViaRABTUL(qr.guestEmail, 'EMAIL', 'checkin_reminder', {
      to: qr.guestEmail,
      subject: `Check-in Reminder - ${qr.hotelId}`,
      message,
    });
    sent.push(emailSent);
  }

  // WhatsApp via RABTUL
  if (qr.guestPhone) {
    const whatsappSent = await sendViaRABTUL(qr.guestPhone, 'WHATSAPP', 'checkin_reminder', {
      to: qr.guestPhone,
      message,
    });
    sent.push(whatsappSent);
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
