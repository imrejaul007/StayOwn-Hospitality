# StayOwn Hospitality - Source of Truth

**GitHub:** https://github.com/imrejaul007/StayOwn-Hospitality
**Local:** StayOwn-Hospitality/
**Last Updated:** May 14, 2026
**Version:** 1.0.0

---

## Overview

StayOwn Hospitality provides hotel booking and smart living solutions.

**Part of:** RTNM Digital Ecosystem
**Infrastructure:** RABTUL-Technologies
**Dependencies:** Auth, Payment, Wallet, Booking, Search, Notifications

---

## Master SOT Reference

**Canonical SOT:** [RABTUL-Technologies/SOT.md](https://github.com/imrejaul007/RABTUL-Technologies/blob/main/SOT.md)

---

## Services

### Core Services

| Service | Type | Description |
|---------|------|-------------|
| `rez-stayown-service` | API | Hotel booking, Room QR |
| `rez-habixo-service` | API | Living platform (stays/rent/match) |
| `rez-channel-manager-service` | API | OTA sync, Overbooking prevention |
| `verify-service` | API | QR verification |

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

---

## Documentation Index

| Document | Description |
|----------|-------------|
| **SOT.md** | This document |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [FEATURES.md](FEATURES.md) | Feature inventory |
| [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) | Deployment guide |

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

**Last Updated:** May 14, 2026
**Owner:** StayOwn Hospitality Team
