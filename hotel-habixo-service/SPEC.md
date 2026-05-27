# REZ Habixo Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** StayOwn-Hospitality
**Category:** PropTech

---

## Overview

Habixo - Smart Living OS powered by ReZ. Hybrid rental platform combining short-term stays, long-term rentals, and roommate matching with trust and safety features.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Habixo Service                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Services:                                                                │
│  ├── Property Service → Listing management                                │
│  ├── Booking Service  → Reservations and payments                        │
│  ├── Matching Service → Roommate/property matching                      │
│  ├── Trust Service   → Identity verification, reviews, disputes          │
│  └── Payment Service → Rent collection, security deposits                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Property
```typescript
{
  propertyId: string
  ownerId: string
  type: 'apartment' | 'house' | 'room' | 'bed'
  address: Address
  rooms: { type: string; available: number; price: number }[]
  amenities: string[]
  images: string[]
  status: 'active' | 'inactive' | 'pending'
  verificationStatus: 'unverified' | 'verified' | 'trusted'
}
```

### Booking
```typescript
{
  bookingId: string
  propertyId: string
  renterId: string
  roomType: string
  startDate: Date
  endDate: Date
  monthlyRent: number
  securityDeposit: number
  status: 'inquiry' | 'confirmed' | 'active' | 'completed' | 'cancelled'
  agreementUrl?: string
}
```

### Match
```typescript
{
  matchId: string
  type: 'roommate' | 'property'
  userIds: string[]
  propertyId?: string
  criteria: Record<string, any>
  score: number
  status: 'pending' | 'accepted' | 'rejected'
}
```

---

## API Endpoints

### Properties
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/properties` | Create listing |
| GET | `/properties` | Search listings |
| GET | `/properties/:id` | Property details |
| PUT | `/properties/:id` | Update listing |
| POST | `/properties/:id/verify` | Request verification |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/bookings` | Create booking |
| GET | `/bookings/:id` | Booking details |
| POST | `/bookings/:id/confirm` | Confirm booking |
| POST | `/bookings/:id/cancel` | Cancel booking |

### Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/match/roommate` | Find roommates |
| POST | `/match/property` | Match to property |
| GET | `/match/:id` | Match details |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

---

## Dependencies

```json
{
  "axios": "^1.7.7",
  "bcryptjs": "^2.4.3",
  "bullmq": "^5.25.0",
  "cors": "^2.8.5",
  "express": "^4.21.0",
  "express-rate-limit": "^7.5.0",
  "helmet": "^8.0.0",
  "ioredis": "^5.4.1",
  "jsonwebtoken": "^9.0.3",
  "mongoose": "^8.8.3",
  "multer": "^1.4.5-lts.1",
  "uuid": "^10.0.0",
  "winston": "^3.11.0",
  "zod": "^3.23.8"
}
```

---

## Status

- [x] Property listings
- [x] Booking management
- [x] Roommate matching
- [x] Trust & verification
- [x] Payment processing

