# Hotel OTA - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** StayOwn-Hospitality
**Category:** Hospitality

---

## Overview

Full-stack hotel OTA (Online Travel Agency) platform for StayOwn. Includes API backend, hotel panel, admin dashboard, OTA web interface, and corporate booking panel.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Hotel OTA                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Apps:                                                                    │
│  ├── API          → Backend API (Prisma + Express)                       │
│  ├── Hotel Panel  → Hotel management dashboard                           │
│  ├── Admin       → Platform admin                                       │
│  ├── OTA Web     → Public booking website                              │
│  └── Corporate   → Corporate travel panel                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Hotel
```typescript
{
  hotelId: string
  name: string
  description: string
  address: string
  city: string
  country: string
  images: string[]
  amenities: string[]
  rating: number
  status: 'active' | 'inactive'
}
```

### RoomType
```typescript
{
  roomTypeId: string
  hotelId: string
  name: string
  description: string
  capacity: { adults: number; children: number }
  pricePerNight: number
  amenities: string[]
  images: string[]
}
```

### Booking
```typescript
{
  bookingId: string
  hotelId: string
  roomTypeId: string
  guestName: string
  guestEmail: string
  checkIn: Date
  checkOut: Date
  guests: number
  totalAmount: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  createdAt: Date
}
```

---

## Apps

| App | Purpose |
|-----|---------|
| API | Backend services |
| Hotel Panel | Hotel management |
| Admin | Platform administration |
| OTA Web | Public booking site |
| Corporate | Business travel |

---

## Dependencies

```json
{
  "prisma": "Database ORM"
}
```

---

## Status

- [x] Hotel management
- [x] Room management
- [x] Booking system
- [x] Multi-panel architecture

