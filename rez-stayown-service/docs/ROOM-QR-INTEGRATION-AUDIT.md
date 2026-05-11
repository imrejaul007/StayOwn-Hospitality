# Room QR Integration Audit Checklist

## Integration Overview

This document provides a comprehensive audit checklist for the Room QR integration between StayOwn Hotel Booking and Hotel OTA.

## Pre-Deployment Checklist

### Environment Configuration
- [ ] `ROOM_QR_JWT_SECRET` - HMAC signing key for QR tokens (min 32 chars)
- [ ] `ROOM_QR_BASE_URL` - Base URL for QR code links (default: https://rez.money/room)
- [ ] `HOTEL_OTA_API_URL` - Hotel OTA API endpoint
- [ ] `EMAIL_SERVICE_URL` - Email service endpoint
- [ ] `WHATSAPP_SERVICE_URL` - WhatsApp service endpoint
- [ ] `SMS_SERVICE_URL` - SMS service endpoint
- [ ] `ROOM_QR_WEBHOOK_SECRET` - Secret for webhook signature verification
- [ ] `MONGODB_URI` - MongoDB connection string

### Dependencies
- [ ] `jsonwebtoken` - JWT generation and validation
- [ ] `qrcode` - QR code image generation
- [ ] `axios` - HTTP client for service calls
- [ ] `mongoose` - MongoDB ODM

## Functional Testing Checklist

### QR Generation
- [ ] QR generates on booking confirmation
- [ ] QR contains correct hotelId, roomId, bookingId
- [ ] QR payload is properly encoded
- [ ] QR image is valid PNG (base64)
- [ ] Token expiry is set correctly (checkOut + 24 hours)
- [ ] Duplicate booking generates updated QR (not duplicate)

### Guest Notification
- [ ] Guest receives email with QR code
- [ ] Email contains inline QR image
- [ ] Email contains web access link
- [ ] Email template renders correctly (HTML)
- [ ] WhatsApp message sends (if phone provided)
- [ ] SMS fallback sends (if phone provided)
- [ ] Notification status updates in database

### Token Validation
- [ ] Valid token returns correct room context
- [ ] Expired token returns error
- [ ] Invalid signature returns error
- [ ] Deactivated QR returns error
- [ ] Usage count increments on validation
- [ ] `lastUsedAt` updates on validation
- [ ] `canUseServices` logic works correctly
- [ ] `canCheckout` logic works correctly

### Service Charge Sync
- [ ] Minibar charges sync to folio
- [ ] Room service charges sync to folio
- [ ] Laundry charges sync to folio
- [ ] Restaurant charges sync to folio
- [ ] Spa charges sync to folio
- [ ] Transport charges sync to folio
- [ ] Manual charges sync to folio
- [ ] Sync status tracks in database
- [ ] Failed syncs retry on checkout

### Checkout Integration
- [ ] All unsynced charges sync on checkout
- [ ] Room charges calculate correctly
- [ ] Service charges group by category
- [ ] Subtotal calculates correctly
- [ ] Taxes (18% GST) calculate correctly
- [ ] Total calculates correctly
- [ ] QR deactivates after checkout
- [ ] Bill generates successfully
- [ ] Final bill sends to guest email

### Webhook Processing
- [ ] `request.created` event logs correctly
- [ ] `request.completed` event triggers charge
- [ ] `charge.added` event records charge
- [ ] `checkout.requested` event processes checkout
- [ ] Webhook signature verification works
- [ ] Failed webhooks retry with backoff
- [ ] Webhook events log to audit trail

## API Endpoint Testing

### POST /api/room-qr/generate
```bash
curl -X POST http://localhost:4015/api/room-qr/generate \
  -H "Content-Type: application/json" \
  -d '{
    "hotelId": "hotel123",
    "hotelName": "Test Hotel",
    "hotelSlug": "test-hotel",
    "roomId": "room456",
    "roomNumber": "101",
    "bookingId": "booking789",
    "guestId": "guest001",
    "guestName": "John Doe",
    "guestEmail": "john@example.com",
    "guestPhone": "+919876543210",
    "checkIn": "2024-01-15T14:00:00Z",
    "checkOut": "2024-01-18T12:00:00Z"
  }'
```
Expected: 201 Created with QR data

### GET /api/room-qr/:bookingId
```bash
curl http://localhost:4015/api/room-qr/booking789
```
Expected: 200 OK with QR details

### POST /api/room-qr/:bookingId/send
```bash
curl -X POST http://localhost:4015/api/room-qr/booking789/send \
  -H "Content-Type: application/json" \
  -d '{"channel": "email"}'
```
Expected: 200 OK

### POST /api/room-qr/validate
```bash
curl -X POST http://localhost:4015/api/room-qr/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbG..."}'
```
Expected: 200 OK with validation result

### POST /api/room-qr/charge
```bash
curl -X POST http://localhost:4015/api/room-qr/charge \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "booking789",
    "hotelId": "hotel123",
    "roomId": "room456",
    "category": "minibar",
    "description": "Mineral Water",
    "amountPaise": 2000,
    "quantity": 2,
    "source": "minibar"
  }'
```
Expected: 201 Created

### GET /api/room-qr/:bookingId/bill
```bash
curl http://localhost:4015/api/room-qr/booking789/bill
```
Expected: 200 OK with bill data

### POST /api/room-qr/:bookingId/checkout
```bash
curl -X POST http://localhost:4015/api/room-qr/booking789/checkout
```
Expected: 200 OK with checkout summary

### POST /api/room-qr/webhook
```bash
curl -X POST http://localhost:4015/api/room-qr/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: webhook-secret-change-in-production" \
  -d '{
    "event": "charge.added",
    "bookingId": "booking789",
    "hotelId": "hotel123",
    "roomId": "room456",
    "data": {
      "category": "minibar",
      "description": "Beer",
      "amountPaise": 12000,
      "source": "minibar"
    }
  }'
```
Expected: 200 OK

## Security Testing

- [ ] JWT tokens use HMAC-SHA256
- [ ] Tokens expire at correct time
- [ ] Webhook signatures verified
- [ ] No sensitive data in logs
- [ ] No hardcoded secrets
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all endpoints
- [ ] SQL/NoSQL injection prevention

## Performance Testing

- [ ] QR generation < 500ms
- [ ] Token validation < 100ms
- [ ] Charge sync < 200ms
- [ ] Checkout processing < 2s
- [ ] Webhook processing < 1s
- [ ] Concurrent requests handled (100+)

## Error Handling

- [ ] Invalid bookingId returns 404
- [ ] Missing required fields returns 400
- [ ] Service failures don't crash server
- [ ] Failed notifications retry
- [ ] Failed syncs queue for retry
- [ ] Error messages are user-friendly

## Monitoring

### Logs to Monitor
- [ ] `RoomQR API` - All API requests
- [ ] `RoomQR] Generated QR` - QR generation events
- [ ] `RoomQR] Email sent` - Email delivery
- [ ] `RoomQR] Charge synced` - Charge syncs
- [ ] `RoomQR] Checkout processed` - Checkouts

### Alerts to Configure
- [ ] High webhook failure rate (>5%)
- [ ] QR generation failures
- [ ] Notification delivery failures
- [ ] Sync failures
- [ ] High checkout processing time

## Database Verification

```javascript
// Check RoomQR collection
db.roomqrs.findOne({ bookingId: "booking789" })

// Check ServiceCharge collection
db.servicecharges.find({ bookingId: "booking789" }).pretty()

// Check indexes
db.roomqrs.getIndexes()
db.servicecharges.getIndexes()
```

## Smoke Test Script

```javascript
// Save as test-room-qr.js and run with: node test-room-qr.js

const axios = require('axios');

const BASE_URL = 'http://localhost:4015';

async function smokeTest() {
  console.log('Starting Room QR smoke test...\n');

  // 1. Generate QR
  console.log('1. Generating QR...');
  const generateRes = await axios.post(`${BASE_URL}/api/room-qr/generate`, {
    hotelId: 'test-hotel',
    hotelName: 'Test Hotel',
    hotelSlug: 'test-hotel',
    roomId: 'test-room',
    roomNumber: '101',
    bookingId: `test-${Date.now()}`,
    guestId: 'test-guest',
    guestName: 'Test Guest',
    guestEmail: 'test@example.com',
    guestPhone: '+919876543210',
    checkIn: new Date().toISOString(),
    checkOut: new Date(Date.now() + 86400000 * 3).toISOString()
  });
  console.log('   QR Generated:', generateRes.data.success);

  const bookingId = generateRes.data.data.bookingId;

  // 2. Get QR
  console.log('2. Getting QR...');
  const getRes = await axios.get(`${BASE_URL}/api/room-qr/${bookingId}`);
  console.log('   QR Retrieved:', getRes.data.success);

  // 3. Validate token
  console.log('3. Validating token...');
  const validateRes = await axios.post(`${BASE_URL}/api/room-qr/validate`, {
    token: generateRes.data.data.qrUrl.split('qr=')[1]
  });
  console.log('   Token Valid:', validateRes.data.success);

  // 4. Add charge
  console.log('4. Adding charge...');
  const chargeRes = await axios.post(`${BASE_URL}/api/room-qr/charge`, {
    bookingId,
    hotelId: 'test-hotel',
    roomId: 'test-room',
    category: 'minibar',
    description: 'Test Item',
    amountPaise: 1000,
    quantity: 1,
    source: 'manual'
  });
  console.log('   Charge Added:', chargeRes.data.success);

  // 5. Get bill
  console.log('5. Getting bill...');
  const billRes = await axios.get(`${BASE_URL}/api/room-qr/${bookingId}/bill`);
  console.log('   Bill Retrieved:', billRes.data.success);

  // 6. Checkout
  console.log('6. Processing checkout...');
  const checkoutRes = await axios.post(`${BASE_URL}/api/room-qr/${bookingId}/checkout`);
  console.log('   Checkout Processed:', checkoutRes.data.success);

  console.log('\nSmoke test completed!');
}

smokeTest().catch(console.error);
```

## Sign-Off

| Checkpoint | Status | Date | Tester |
|------------|--------|------|--------|
| Unit Tests | [ ] Pass / [ ] Fail | | |
| Integration Tests | [ ] Pass / [ ] Fail | | |
| Security Review | [ ] Pass / [ ] Fail | | |
| Performance Tests | [ ] Pass / [ ] Fail | | |
| UAT | [ ] Pass / [ ] Fail | | |
| Production Deploy | [ ] Done | | |

---

Last Updated: 2024-01-15
Version: 1.0.0
