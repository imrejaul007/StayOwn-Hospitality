import { env } from '../../config/env';

/**
 * Notification service - SMS via MSG91
 * In development mode, OTPs are logged to console instead of sent.
 */
export class NotificationService {
  /**
   * Send OTP via SMS
   */
  static async sendOtp(phone: string, otp: string): Promise<void> {
    if (env.NODE_ENV === 'development' || !env.MSG91_API_KEY) {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
      return;
    }

    const response = await fetch('https://api.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: env.MSG91_API_KEY,
      },
      body: JSON.stringify({
        mobile: `91${phone}`,
        otp,
        sender: env.MSG91_SENDER_ID,
      }),
    });

    if (!response.ok) {
      console.error('MSG91 OTP send failed:', await response.text());
    }
  }

  /**
   * Send booking confirmation SMS
   */
  static async sendBookingConfirmation(phone: string, bookingRef: string, hotelName: string): Promise<void> {
    const message = `Your booking ${bookingRef} at ${hotelName} is confirmed. Show this at check-in.`;

    if (env.NODE_ENV === 'development' || !env.MSG91_API_KEY) {
      console.log(`[DEV] SMS to ${phone}: ${message}`);
      return;
    }

    await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: env.MSG91_API_KEY,
      },
      body: JSON.stringify({
        mobile: `91${phone}`,
        message,
        sender: env.MSG91_SENDER_ID,
      }),
    });
  }
}
