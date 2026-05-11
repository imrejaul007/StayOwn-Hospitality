/**
 * Room QR Email Template
 *
 * HTML email template for sending room QR codes to guests
 */

export interface RoomQREmailData {
  guestName: string;
  hotelName: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  qrImage: string;
  qrUrl: string;
}

export function generateRoomQREmail(data: RoomQREmailData): string {
  const formattedCheckIn = data.checkIn.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedCheckOut = data.checkOut.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const checkInTime = '14:00'; // Standard check-in time
  const checkOutTime = '12:00'; // Standard check-out time

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Room QR Code - ${data.hotelName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }

    .logo {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }

    .header-subtitle {
      font-size: 16px;
      opacity: 0.9;
    }

    .content {
      padding: 40px 30px;
    }

    .welcome-message {
      font-size: 18px;
      color: #333;
      margin-bottom: 30px;
    }

    .room-details {
      background-color: #f8f9fa;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
    }

    .room-number {
      font-size: 32px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 15px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e9ecef;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      color: #6c757d;
      font-size: 14px;
    }

    .detail-value {
      font-weight: 600;
      font-size: 14px;
    }

    .qr-section {
      text-align: center;
      padding: 30px;
      background: linear-gradient(to bottom, #f8f9fa, #ffffff);
      border-radius: 12px;
      margin-bottom: 30px;
    }

    .qr-title {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin-bottom: 20px;
    }

    .qr-code {
      width: 250px;
      height: 250px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
    }

    .qr-instruction {
      font-size: 14px;
      color: #6c757d;
      margin-top: 15px;
    }

    .instructions {
      background-color: #fff3cd;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .instructions-title {
      font-weight: 600;
      color: #856404;
      margin-bottom: 10px;
      font-size: 16px;
    }

    .instructions-list {
      list-style: none;
      padding: 0;
    }

    .instructions-list li {
      padding: 6px 0;
      padding-left: 25px;
      position: relative;
      color: #856404;
      font-size: 14px;
    }

    .instructions-list li:before {
      content: "•";
      position: absolute;
      left: 8px;
      color: #856404;
    }

    .link-section {
      text-align: center;
      margin-bottom: 30px;
    }

    .link-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 14px 35px;
      border-radius: 25px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s;
    }

    .link-button:hover {
      transform: translateY(-2px);
    }

    .link-url {
      font-size: 12px;
      color: #6c757d;
      margin-top: 10px;
      word-break: break-all;
    }

    .support-section {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
    }

    .support-text {
      color: #6c757d;
      font-size: 14px;
      margin-bottom: 10px;
    }

    .support-contact {
      color: #667eea;
      font-weight: 600;
      text-decoration: none;
    }

    .footer {
      background-color: #f8f9fa;
      padding: 25px 30px;
      text-align: center;
    }

    .footer-text {
      font-size: 12px;
      color: #6c757d;
      margin-bottom: 5px;
    }

    .social-links {
      margin-top: 15px;
    }

    .social-link {
      display: inline-block;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: #e9ecef;
      margin: 0 5px;
      text-align: center;
      line-height: 32px;
      color: #6c757d;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
    }

    @media only screen and (max-width: 480px) {
      .container {
        width: 100%;
      }

      .header {
        padding: 30px 20px;
      }

      .content {
        padding: 30px 20px;
      }

      .qr-code {
        width: 200px;
        height: 200px;
      }

      .room-number {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">ReZ Hotels</div>
      <div class="header-subtitle">Your Digital Room Key</div>
    </div>

    <!-- Content -->
    <div class="content">
      <p class="welcome-message">
        Hello <strong>${data.guestName}</strong>,
      </p>
      <p class="welcome-message">
        Welcome to <strong>${data.hotelName}</strong>! We're excited to have you with us.
        Your digital room access QR code is ready.
      </p>

      <!-- Room Details -->
      <div class="room-details">
        <div class="room-number">Room ${data.roomNumber}</div>
        <div class="detail-row">
          <span class="detail-label">Check-in</span>
          <span class="detail-value">${formattedCheckIn} at ${checkInTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Check-out</span>
          <span class="detail-value">${formattedCheckOut} at ${checkOutTime}</span>
        </div>
      </div>

      <!-- QR Code Section -->
      <div class="qr-section">
        <div class="qr-title">Your Room QR Code</div>
        <img
          src="${data.qrImage}"
          alt="Room QR Code"
          class="qr-code"
          style="width: 250px; height: 250px;"
        />
        <p class="qr-instruction">
          Scan this QR code at the room's digital hub to access all services
        </p>
      </div>

      <!-- Instructions -->
      <div class="instructions">
        <div class="instructions-title">How to Use Your QR Code</div>
        <ul class="instructions-list">
          <li>Show this QR code at the hotel reception for quick check-in</li>
          <li>Scan the QR code displayed in your room to access services</li>
          <li>Use the link below if you prefer web access</li>
          <li>Your QR code is valid from check-in until check-out + 24 hours</li>
          <li>Screenshots of the QR code are also valid for scanning</li>
        </ul>
      </div>

      <!-- Web Access Link -->
      <div class="link-section">
        <a href="${data.qrUrl}" class="link-button">Access Room Services</a>
        <div class="link-url">${data.qrUrl}</div>
      </div>

      <!-- Support -->
      <div class="support-section">
        <p class="support-text">Need help? Contact us at</p>
        <a href="mailto:support@rez.money" class="support-contact">support@rez.money</a>
        <p class="support-text" style="margin-top: 10px;">or call +91 98765 43210</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">ReZ Hotels - Powered by ReZ</p>
      <p class="footer-text">This is an automated message. Please do not reply directly to this email.</p>
      <div class="social-links">
        <a href="#" class="social-link">f</a>
        <a href="#" class="social-link">t</a>
        <a href="#" class="social-link">in</a>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate a plain text version of the email
 */
export function generateRoomQRTextEmail(data: RoomQREmailData): string {
  const formattedCheckIn = data.checkIn.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedCheckOut = data.checkOut.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
Hello ${data.guestName},

Welcome to ${data.hotelName}! Your digital room access QR code is ready.

ROOM DETAILS
------------
Room Number: ${data.roomNumber}
Check-in: ${formattedCheckIn} at 14:00
Check-out: ${formattedCheckOut} at 12:00

HOW TO USE
----------
1. Show this QR code at the hotel reception for quick check-in
2. Scan the QR code displayed in your room to access services
3. Use the link below if you prefer web access

WEB ACCESS
----------
${data.qrUrl}

Your QR code is valid from check-in until check-out + 24 hours.

SUPPORT
-------
Email: support@rez.money
Phone: +91 98765 43210

Thank you for choosing ${data.hotelName}!

Best regards,
ReZ Hotels
`.trim();
}

/**
 * Generate WhatsApp message for Room QR
 */
export function generateWhatsAppMessage(data: RoomQREmailData): string {
  const formattedCheckIn = data.checkIn.toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const formattedCheckOut = data.checkOut.toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return `
*Welcome to ${data.hotelName}, ${data.guestName}!*

Your Room QR Code is ready!

*Room:* ${data.roomNumber}
*Check-in:* ${formattedCheckIn} at 14:00
*Check-out:* ${formattedCheckOut} at 12:00

*Quick Access:*
${data.qrUrl}

*How to use:*
1. Show this at reception for quick check-in
2. Scan the QR in your room to access services
3. Use the link for web access

Questions? Reply to this message or call +91 98765 43210

- ReZ Hotels
`.trim();
}
