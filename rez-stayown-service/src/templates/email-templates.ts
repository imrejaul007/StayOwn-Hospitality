/**
 * Email Templates for Hotel Bookings
 * Marketing and transactional email templates for StayOwn
 */

export interface BookingConfirmationData {
  guestName: string;
  hotelName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  confirmationNumber: string;
  amount: string;
  guestEmail: string;
}

export interface CheckinReminderData {
  guestName: string;
  hotelName: string;
  roomNumber: string;
  checkInTime: string;
  qrUrl: string;
  guestEmail: string;
}

export interface ReviewRequestData {
  guestName: string;
  hotelName: string;
  bookingId: string;
  reviewUrl: string;
  guestEmail: string;
}

/**
 * Booking confirmation email template
 */
export function generateBookingConfirmationEmail(data: BookingConfirmationData) {
  const formattedCheckIn = new Date(data.checkIn).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedCheckOut = new Date(data.checkOut).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    to: data.guestEmail,
    subject: `Booking Confirmed - ${data.hotelName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed - ${data.hotelName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background: linear-gradient(135deg, #1a3a52, #2d5a7b);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.8); margin-top: 8px; font-size: 16px; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .booking-details {
      background: #f8f9fa;
      padding: 25px;
      border-radius: 12px;
      margin: 25px 0;
    }
    .confirmation-badge {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 10px 20px;
      border-radius: 25px;
      display: inline-block;
      margin-bottom: 20px;
      font-weight: 600;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #6c757d; font-size: 14px; }
    .detail-value { font-weight: 600; font-size: 14px; }
    .amount-highlight {
      font-size: 24px;
      font-weight: 700;
      color: #1a3a52;
      text-align: center;
      margin: 25px 0;
    }
    .welcome-text { color: #6c757d; font-size: 14px; text-align: center; margin-top: 30px; }
    .footer {
      background-color: #f8f9fa;
      padding: 25px 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer-text { font-size: 12px; color: #6c757d; }
    @media only screen and (max-width: 480px) {
      .container { width: 100%; }
      .header, .content, .footer { padding: 25px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.hotelName}</h1>
      <p>Booking Confirmed</p>
    </div>
    <div class="content">
      <div class="confirmation-badge">✓ Booking Confirmed</div>
      <p class="greeting">Hi ${data.guestName},</p>
      <p>Your booking is confirmed! We're excited to welcome you.</p>

      <div class="booking-details">
        <div class="detail-row">
          <span class="detail-label">Confirmation Number</span>
          <span class="detail-value" style="color: #1a3a52;">${data.confirmationNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Room Type</span>
          <span class="detail-value">${data.roomType}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Check-in</span>
          <span class="detail-value">${formattedCheckIn}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Check-out</span>
          <span class="detail-value">${formattedCheckOut}</span>
        </div>
      </div>

      <div class="amount-highlight">Total: ${data.amount}</div>

      <p class="welcome-text">We look forward to hosting you! If you have any questions, please don't hesitate to contact us.</p>
    </div>
    <div class="footer">
      <p class="footer-text">${data.hotelName} - Powered by StayOwn</p>
      <p class="footer-text">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
    `
  };
}

/**
 * Check-in reminder email (24h before)
 */
export function generateCheckinReminderEmail(data: CheckinReminderData) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedDate = tomorrow.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    to: data.guestEmail,
    subject: `Check-in Tomorrow - ${data.hotelName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check-in Reminder - ${data.hotelName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 { font-size: 28px; font-weight: 700; }
    .header p { opacity: 0.9; margin-top: 8px; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .reminder-box {
      background: linear-gradient(135deg, #fff3cd, #ffeeba);
      border-radius: 12px;
      padding: 25px;
      text-align: center;
      margin: 25px 0;
    }
    .reminder-title { font-size: 20px; font-weight: 700; color: #856404; margin-bottom: 10px; }
    .room-display {
      font-size: 48px;
      font-weight: 700;
      color: #667eea;
      margin: 20px 0;
    }
    .checkin-time { font-size: 16px; color: #6c757d; }
    .cta-section { text-align: center; margin: 30px 0; }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 14px 35px;
      border-radius: 25px;
      font-weight: 600;
      font-size: 16px;
    }
    .tips { background: #f8f9fa; border-radius: 12px; padding: 20px; margin-top: 25px; }
    .tips-title { font-weight: 600; margin-bottom: 10px; color: #1a3a52; }
    .tips-list { list-style: none; padding: 0; }
    .tips-list li { padding: 6px 0; color: #6c757d; font-size: 14px; padding-left: 20px; position: relative; }
    .tips-list li:before { content: "•"; position: absolute; left: 5px; color: #667eea; }
    .footer { background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer-text { font-size: 12px; color: #6c757d; }
    @media only screen and (max-width: 480px) {
      .container { width: 100%; }
      .header, .content, .footer { padding: 25px 20px; }
      .room-display { font-size: 36px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.hotelName}</h1>
      <p>Your check-in is tomorrow!</p>
    </div>
    <div class="content">
      <p class="greeting">Hi ${data.guestName},</p>
      <p>We can't wait to welcome you! Here's everything you need to know for tomorrow's check-in.</p>

      <div class="reminder-box">
        <div class="reminder-title">Tomorrow, ${formattedDate}</div>
        <div class="room-display">Room ${data.roomNumber}</div>
        <div class="checkin-time">Check-in available from ${data.checkInTime}</div>
      </div>

      <div class="cta-section">
        <a href="${data.qrUrl}" class="cta-button">Get Your Room QR Code</a>
      </div>

      <div class="tips">
        <div class="tips-title">Quick Tips</div>
        <ul class="tips-list">
          <li>Your room QR code will be sent separately - keep it handy</li>
          <li>Standard check-in time is 14:00, early check-in subject to availability</li>
          <li>Valid ID with address proof is required at check-in</li>
          <li>Contact the hotel directly for any special requests</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">${data.hotelName} - Powered by StayOwn</p>
      <p class="footer-text">Questions? Reply to this email or call the hotel reception.</p>
    </div>
  </div>
</body>
</html>
    `
  };
}

/**
 * Review request email after checkout
 */
export function generateReviewRequestEmail(data: ReviewRequestData) {
  return {
    to: data.guestEmail,
    subject: `How was your stay at ${data.hotelName}?`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Your Stay - ${data.hotelName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background: linear-gradient(135deg, #1a3a52, #2d5a7b);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 { font-size: 28px; font-weight: 700; }
    .header p { opacity: 0.9; margin-top: 8px; }
    .content { padding: 40px 30px; text-align: center; }
    .greeting { font-size: 18px; margin-bottom: 20px; text-align: left; }
    .message { color: #6c757d; margin-bottom: 30px; text-align: left; }
    .stars-section { margin: 30px 0; }
    .stars-invite { font-size: 16px; color: #6c757d; margin-bottom: 20px; }
    .stars { font-size: 32px; letter-spacing: 5px; color: #ffc107; }
    .cta-section { margin: 30px 0; }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 25px;
      font-weight: 600;
      font-size: 16px;
    }
    .thanks-message {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 20px;
      margin-top: 30px;
      text-align: center;
    }
    .thanks-text { color: #6c757d; font-size: 14px; }
    .footer { background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer-text { font-size: 12px; color: #6c757d; }
    @media only screen and (max-width: 480px) {
      .container { width: 100%; }
      .header, .content, .footer { padding: 25px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.hotelName}</h1>
      <p>We'd love your feedback!</p>
    </div>
    <div class="content">
      <p class="greeting">Hi ${data.guestName},</p>
      <p class="message">
        We hope you had a wonderful stay at ${data.hotelName}!<br>
        Your feedback helps us improve and assists other travelers in making decisions.
      </p>

      <div class="stars-section">
        <p class="stars-invite">How would you rate your experience?</p>
        <div class="stars">★★★★★</div>
      </div>

      <div class="cta-section">
        <a href="${data.reviewUrl}" class="cta-button">Write a Review</a>
      </div>

      <div class="thanks-message">
        <p class="thanks-text">
          Thank you for choosing ${data.hotelName}!<br>
          We hope to welcome you back soon.
        </p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">${data.hotelName} - Powered by StayOwn</p>
      <p class="footer-text">Booking Ref: ${data.bookingId}</p>
    </div>
  </div>
</body>
</html>
    `
  };
}

/**
 * Special offer / promotional email template
 */
export interface SpecialOfferData {
  guestName: string;
  guestEmail: string;
  hotelName: string;
  offerTitle: string;
  offerDescription: string;
  discountPercent: number;
  validUntil: string;
  bookingUrl: string;
}

export function generateSpecialOfferEmail(data: SpecialOfferData) {
  const formattedDate = new Date(data.validUntil).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return {
    to: data.guestEmail,
    subject: `Exclusive Offer for You - ${data.offerTitle}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.offerTitle} - ${data.hotelName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background: linear-gradient(135deg, #ff6b6b, #ee5a24);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 { font-size: 28px; font-weight: 700; }
    .header p { opacity: 0.9; margin-top: 8px; font-size: 16px; }
    .offer-badge {
      background: white;
      color: #ff6b6b;
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 14px;
      display: inline-block;
      margin-bottom: 15px;
    }
    .content { padding: 40px 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .offer-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      margin: 25px 0;
      color: white;
    }
    .discount {
      font-size: 64px;
      font-weight: 700;
      line-height: 1;
    }
    .discount-label { font-size: 18px; opacity: 0.9; margin-top: 5px; }
    .offer-title { font-size: 24px; font-weight: 700; margin: 20px 0 10px; }
    .offer-description { opacity: 0.9; font-size: 14px; }
    .validity {
      background: rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 10px 15px;
      margin-top: 20px;
      font-size: 13px;
    }
    .cta-section { text-align: center; margin: 30px 0; }
    .cta-button {
      display: inline-block;
      background: #ff6b6b;
      color: white;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 25px;
      font-weight: 600;
      font-size: 16px;
    }
    .terms { font-size: 12px; color: #6c757d; margin-top: 20px; }
    .footer { background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef; }
    .footer-text { font-size: 12px; color: #6c757d; }
    @media only screen and (max-width: 480px) {
      .container { width: 100%; }
      .header, .content, .footer { padding: 25px 20px; }
      .discount { font-size: 48px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="offer-badge">EXCLUSIVE OFFER</div>
      <h1>${data.hotelName}</h1>
      <p>Just for you!</p>
    </div>
    <div class="content">
      <p class="greeting">Hi ${data.guestName},</p>

      <div class="offer-box">
        <div class="discount">${data.discountPercent}%</div>
        <div class="discount-label">OFF</div>
        <div class="offer-title">${data.offerTitle}</div>
        <div class="offer-description">${data.offerDescription}</div>
        <div class="validity">Valid until ${formattedDate}</div>
      </div>

      <div class="cta-section">
        <a href="${data.bookingUrl}" class="cta-button">Book Now</a>
      </div>

      <p class="terms">
        Terms and conditions apply. This offer is exclusive to you and cannot be combined with other promotions.
        Blackout dates may apply.
      </p>
    </div>
    <div class="footer">
      <p class="footer-text">${data.hotelName} - Powered by StayOwn</p>
      <p class="footer-text">You're receiving this because you stayed with us before.</p>
    </div>
  </div>
</body>
</html>
    `
  };
}
