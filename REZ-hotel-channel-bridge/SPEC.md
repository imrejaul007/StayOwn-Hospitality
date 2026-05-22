# REZ Hotel Channel Bridge - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** StayOwn-Hospitality
**Category:** Integration

---

## Overview

Integration service connecting hotels to channel managers for StayOwn Hospitality. Synchronizes inventory, rates, and bookings between hotel PMS and OTAs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Hotel Channel Bridge                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Inventory Sync   → Room availability synchronization                │
│  ├── Rate Manager    → Price updates across channels                     │
│  ├── Booking Puller  → Fetch bookings from channels                     │
│  └── Availability Engine → Real-time room tracking                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### ChannelConnection
```typescript
{
  connectionId: string
  hotelId: string
  channelId: string
  credentials: Record<string, string>
  status: 'active' | 'inactive' | 'error'
  lastSync?: Date
}
```

### InventorySync
```typescript
{
  syncId: string
  connectionId: string
  roomTypeId: string
  date: Date
  available: number
  price: number
  syncedAt: Date
}
```

---

## API Endpoints

### Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/channels` | Add channel connection |
| GET | `/channels/:hotelId` | List hotel channels |
| DELETE | `/channels/:id` | Remove channel |

### Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sync/inventory` | Trigger inventory sync |
| POST | `/sync/rates` | Update rates |
| GET | `/sync/status/:connectionId` | Sync status |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

---

## Dependencies

```json
{
  "axios": "^1.6.7",
  "cors": "^2.8.5",
  "express": "^4.18.2",
  "express-rate-limit": "^7.1.5",
  "helmet": "^7.1.0",
  "mongoose": "^8.2.0",
  "winston": "^3.11.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.1"
}
```

---

## Status

- [x] Channel connections
- [x] Inventory sync
- [x] Rate management
- [x] Booking pull

