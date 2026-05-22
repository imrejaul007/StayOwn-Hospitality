# REZ StayOwn Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** StayOwn-Hospitality
**Category:** Hospitality

---

## Overview

StayOwn Hotel OTA Service - ReZ's proprietary hotel booking platform. Provides complete hotel management, booking engine, and guest experience features.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ StayOwn Service                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Hotel Manager   → Property management                                │
│  ├── Booking Engine → Reservation system                                 │
│  ├── Guest Portal   → Guest-facing features                              │
│  ├── Payment Hub    → Payment processing                                  │
│  └── QR Services    → Digital keys, check-in                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Hotel
```typescript
{
  hotelId: string
  name: string
  brand: string
  address: Address
  coordinates: { lat: number; lng: number }
  contact: { phone: string; email: string }
  settings: HotelSettings
  status: 'active' | 'inactive' | 'maintenance'
}
```

### Reservation
```typescript
{
  reservationId: string
  hotelId: string
  roomTypeId: string
  guestId: string
  checkIn: Date
  checkOut: Date
  guests: { adults: number; children: number }
  rooms: number
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'refunded'
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  source: 'direct' | 'ota' | 'corporate'
  qrCode?: string
}
```

### RoomType
```typescript
{
  roomTypeId: string
  hotelId: string
  name: string
  description: string
  baseOccupancy: number
  maxOccupancy: number
  bedConfiguration: string
  size: number
  amenities: string[]
  images: string[]
  baseRate: number
  availability: Record<string, { available: number; rate: number }>
}
```

---

## API Endpoints

### Hotels
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/hotels` | Register hotel |
| GET | `/hotels` | Search hotels |
| GET | `/hotels/:id` | Hotel details |
| PUT | `/hotels/:id` | Update hotel |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/hotels/:id/rooms` | Add room type |
| GET | `/hotels/:id/rooms` | List rooms |
| PUT | `/rooms/:id` | Update room |
| GET | `/availability` | Check availability |

### Reservations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reservations` | Create reservation |
| GET | `/reservations/:id` | Reservation details |
| POST | `/reservations/:id/confirm` | Confirm booking |
| POST | `/reservations/:id/checkin` | Check in |
| POST | `/reservations/:id/checkout` | Check out |
| POST | `/reservations/:id/cancel` | Cancel |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

---

## Dependencies

```json
{
  "axios": "^1.6.2",
  "i18next": "^23.7.0",
  "cors": "^2.8.5",
  "express": "^4.18.2",
  "helmet": "^7.1.0",
  "ioredis": "^5.10.1",
  "jsonwebtoken": "^9.0.2",
  "mongoose": "^8.0.3",
  "qrcode": "^1.5.3",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] Hotel management
- [x] Room management
- [x] Booking engine
- [x] Payment processing
- [x] QR check-in
- [x] Multi-language support

