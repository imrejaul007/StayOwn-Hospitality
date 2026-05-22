# REZ Channel Manager Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** StayOwn-Hospitality
**Category:** Hospitality

---

## Overview

Channel manager service enabling hotels to sync inventory and bookings with multiple OTAs (Online Travel Agencies). Central hub for multi-channel distribution.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                REZ Channel Manager Service                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── OTA Connectors  → Adapters for each OTA                             │
│  ├── Inventory Engine → Availability management                           │
│  ├── Rate Manager   → Pricing distribution                               │
│  └── Booking Hub    → Central booking collection                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### OTA
```typescript
{
  otaId: string
  name: string
  apiEndpoint: string
  credentials: Record<string, string>
  mappings: Record<string, string>
  status: 'active' | 'inactive'
}
```

### DistributionRule
```typescript
{
  ruleId: string
  hotelId: string
  otaId: string
  roomTypeMapping: Record<string, string>
  rateMapping: string
  inventorySource: 'master' | 'derived'
}
```

---

## API Endpoints

### OTAs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/otas` | Register OTA |
| GET | `/otas` | List OTAs |
| PUT | `/otas/:id` | Update OTA |

### Distribution
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/distribute/inventory` | Update inventory |
| POST | `/distribute/rates` | Update rates |
| GET | `/bookings/pull/:otaId` | Pull bookings |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

---

## Status

- [x] OTA management
- [x] Inventory distribution
- [x] Rate management
- [x] Booking collection

