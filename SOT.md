# StayOwn Hospitality - Source of Truth

**GitHub:** https://github.com/imrejaul007/StayOwn-Hospitality
**Local:** StayOwn-Hospitality/
**Last Updated:** May 16, 2026
**Version:** 3.0.0

---

## Overview

StayOwn Hospitality provides hotel booking and smart living solutions.

**Part of:** RTNM Digital Ecosystem
**Infrastructure:** RABTUL-Technologies
**Dependencies:** Auth, Payment, Wallet, Booking, Search, Notifications

---

## QR Ecosystem (StayOwn)

StayOwn-Hospitality provides **Room QR** and **Product Verification** QR solutions as part of the complete ReZ QR Ecosystem.

### Complete QR Products (1)

| QR Product | Purpose | Tech | Port |
|-----------|---------|------|------|
| **Room QR** | Hotel guest services via room QR | Node.js | 4016 |

### Supporting QR

| QR Product | Purpose | Port |
|-----------|---------|------|
| **Product Verify** | Anti-counterfeit, brand verification | 3000 |
| **Habixo QR** | Living platform QR | 3007 |

### Room QR Features

| Feature | Description |
|---------|-------------|
| Auto-generate | Room QR generated when booking confirmed |
| Multi-channel delivery | Send via email, WhatsApp, SMS |
| JWT Authentication | Secure access token |
| Room Access | Digital key functionality |
| Service Charges | Sync to folio |
| Checkout | Digital checkout |

### Room QR Payload

```typescript
interface QRPpayload {
  intent: 'room_access';
  hotelId: string;
  roomId: string;
  bookingId: string;
  guestId: string;
  token: string;
  checkIn: string;
  checkOut: string;
}
```

For complete cross-company QR documentation, see [docs/QR-ECOSYSTEM.md](../docs/QR-ECOSYSTEM.md).

---

## Services

### Core Services

| Service | Type | Description | Port |
|---------|------|-------------|------|
| `rez-stayown-service` | API | Hotel booking, Room QR | 4016 |
| `rez-habixo-service` | API | Living platform (stays/rent/match) | 3007 |
| `rez-channel-manager-service` | API | OTA sync, Overbooking prevention | 3082 |
| `verify-service` | API | Product QR verification | 3000 |

### Frontend Apps

| App | Platform | Description |
|-----|----------|-------------|
| `Hotel OTA` | React | Hotel management |
| `Hotel OTA/apps/api` | API | Booking API |

---

## RABTUL Services Used

| Service | Status | Migration | Files |
|---------|--------|-----------|-------|
| **Auth** | ✅ Connected | Complete | `auth.service.ts` |
| **Payment** | ✅ Connected | Complete | `payment.service.ts` |
| **Notifications** | ✅ Connected | Complete | `email.service.ts` |
| **Search** | ✅ Connected | Complete | `search.service.ts` |

---

## Key Features

### Hotel Booking
- Room QR codes
- Multi-property management
- Channel manager
- OTA integrations

### Living Platform
- Room rental
- Flatmate matching
- Property verification

---

## Architecture

```
User → QR Scan → REZ Mind → StayOwn API → RABTUL Payment → Booking
                    ↓
              RABTUL Auth
```

### Room QR Flow

```
Booking Confirmed → Generate QR → Send to Guest → Scan at Hotel
                         ↓
                   MongoDB (QR Record)
                         ↓
                   JWT Token Validated → Room Access
```

---

## Documentation Index

| Document | Description |
|----------|-------------|
| **SOT.md** | This document |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [FEATURES.md](FEATURES.md) | Feature inventory |
| [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) | Deployment guide |
| [QR Ecosystem](../docs/QR-ECOSYSTEM.md) | All QR solutions across ReZ |

---

## RABTUL Integration

### Environment Variables

```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
NOTIFICATION_SERVICE_URL=https://rez-notifications-service.onrender.com
SEARCH_SERVICE_URL=https://rez-search-service.onrender.com
INTERNAL_SERVICE_TOKEN=<get-from-rabtul>
```

### How to Use RABTUL

```typescript
// Payment via RABTUL
const response = await fetch(`${PAYMENT_SERVICE_URL}/api/payments/initiate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Token': INTERNAL_SERVICE_TOKEN
  },
  body: JSON.stringify({ amount, currency })
});

// Auth via RABTUL
const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
  method: 'POST',
  headers: {
    'X-Internal-Token': INTERNAL_SERVICE_TOKEN
  },
  body: JSON.stringify({ token })
});
```

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-05-15 | 2.0 | Added QR ecosystem section, Room QR details |
| 2026-05-14 | 1.0 | Initial SOT |

---

**Last Updated:** May 15, 2026
**Owner:** StayOwn Hospitality Team
