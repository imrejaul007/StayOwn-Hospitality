# REZ Ecosystem — System Architecture & Integration Mapping

## Overview

This document maps how all components of the REZ ecosystem connect together:
- **REZ Backend** — Core platform services (coin system, user management, campaigns)
- **Hotel OTA (Stayeon)** — Hotel booking platform
- **Hotel PMS (Stayeon)** — Property Management System for hotels
- **Hotel QR** — Room Operating System (QR scan → services, chat, orders)
- **StayOwn App** — Consumer mobile app for hotel booking & services
- **REZ Now** — QR commerce platform (stores, orders, coins)
- **Consumer App** — User-facing mobile application
- **Merchant App** — Hotel/merchant management application

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REZ ECOSYSTEM                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REZ BACKEND                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ User Service │  │ Coin Service │  │Campaign Svc │  │Travel Webhook   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
│         │                │                │                    │            │
│         └────────────────┴────────────────┴────────────────────┘            │
│                                    │                                        │
│                            ┌───────▼───────┐                               │
│                            │   MongoDB     │                               │
│                            │  (Core DB)    │                               │
│                            └───────────────┘                               │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                        │
│                    │               │               │                        │
│                    ▼               ▼               ▼                        │
│            ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│            │OtaBooking  │ │ServiceBook │ │CoinWallet  │                   │
│            │Collection  │ │Collection  │ │Collection  │                   │
│            └────────────┘ └────────────┘ └────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
                    ▲                              │
                    │ webhook                      │ webhook
                    │ ota-booking-confirmed        │ pms-webhook
                    │ ota-stay-completed           │ hotel-qr-engagement
                    │                              │
┌───────────────────┴──────────────────────────────┴───────────────────────┐
│                          HOTEL OTA (Stayeon)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────────┐ │
│  │ Booking Service │  │ Coin Service    │  │ Webhook Services         │ │
│  │ - hold()       │  │ - earnCoins()   │  │ - PMS→OTA webhooks      │ │
│  │ - confirm()    │  │ - burnCoins()   │  │ - REZ→OTA webhooks      │ │
│  │ - cancel()     │  │ - checkBurn()   │  │ - verifyPMSSignature()  │ │
│  └─────────────────┘  └─────────────────┘  └───────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ HOTEL QR - Room Operating System                                     │ │
│  │  - RoomService API (create/track requests)                          │ │
│  │  - Chat Service (guest ↔ staff real-time)                          │ │
│  │  - Engagement Tracking (scan, order, coins)                        │ │
│  │  - Bill & Checkout                                                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│         │                   │                        │                    │
│         └───────────────────┴────────────────────────┘                    │
│                             │                                             │
│                     ┌───────▼───────┐                                    │
│                     │  PostgreSQL   │                                    │
│                     │   (OTA DB)    │                                    │
│                     └───────────────┘                                    │
│                             │                                             │
│         ┌───────────────────┼───────────────────────┐                     │
│         │                   │                       │                     │
│         ▼                   ▼                       ▼                     │
│ ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐        │
│ │  Bookings    │  │ Inventory Slots   │  │ RoomServiceReq   │        │
│ │  (holds,     │  │ (rates, avail,   │  │ (housekeeping,   │        │
│ │  confirmed,   │  │  blocked)        │  │  room_service,   │        │
│ │  cancelled)   │  └──────────────────┘  │  laundry, etc.)   │        │
│ └──────────────┘                        └────────────────────┘        │
│                             │                                             │
│                             │ API calls (push inventory, get bookings)   │
│                             ▼                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │                              │
         │ API (inventory/push, etc)    │ API (booking events)
         │                              │ service_request webhooks
         │                              │
┌────────┴──────────────────────────────┴───────────────────────────────┐
│                        HOTEL PMS (Stayeon)                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────────┐ │
│  │ Booking Engine  │  │ Inventory Mgmt │  │ Webhook Outbound       │ │
│  │ - status change │  │ - rates, avail │  │ - push events to OTA   │ │
│  │ - check-in/out  │  │ - blackouts    │  │ - service requests     │ │
│  └─────────────────┘  └─────────────────┘  │ - HMAC signed          │ │
│  ┌─────────────────┐  ┌─────────────────┐  └───────────────────────────┘ │
│  │ Service Engine  │  │ Staff Dashboard │                              │
│  │ - housekeeping │  │ - accept/assign │                              │
│  │ - room service  │  │ - update status │                              │
│  │ - maintenance   │  │ - chat with     │                              │
│  │ - laundry       │  │   guest         │                              │
│  └─────────────────┘  └─────────────────┘                               │
│         │                   │                                             │
│         └───────────────────┴────────────────────────┘                    │
│                             │                                             │
│                     ┌───────▼───────┐                                    │
│                     │   MongoDB     │                                    │
│                     │  (PMS DB)     │                                    │
│                     └───────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

    HOTEL QR ACCESS POINTS (Guest Experience)

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Room QR Scan   │     │  StayOwn App    │     │   REZ Now      │
│  (Any Phone)    │     │  (Mobile App)   │     │  (Hotel Store) │
│                 │     │                 │     │                │
│ Scan QR →       │     │ Login →         │     │ Hotel page →   │
│ /room-hub       │     │ /app/services   │     │ /hotel-slug    │
│                 │     │                 │     │ /room/101      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │      ROOM HUB           │
                    │  ┌─────┐ ┌─────┐ ┌───┐ │
                    │  │Quick│ │Cart/ │ │   │ │
                    │  │Serv │ │Order │ │Chat│ │
                    │  └─────┘ └─────┘ └───┘ │
                    │  ┌─────┐ ┌─────┐ ┌───┐ │
                    │  │Bill │ │Req  │ │   │ │
                    │  │View │ │Hist │ │   │ │
                    │  └─────┘ └─────┘ └───┘ │
                    └─────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ REZ COINS REWARDED     │
                    │ Scan +5 | Order +2/100  │
                    │ Chat +2 | Review +15    │
                    └─────────────────────────┘

         ▲                     ▲                     ▲
         │                     │                     │
    ┌────┴────┐         ┌─────┴─────┐        ┌────┴────┐
    │ Consumer │         │  Merchant  │        │ Hotel   │
    │   App   │         │    App     │        │ Panel   │
    │(React   │         │(Merchant   │        │(Admin   │
    │ Native) │         │ Dashboard)  │        │ Portal) │
    └─────────┘         └────────────┘        └─────────┘
```

---

## Integration Points

### 1. REZ Backend ↔ Hotel OTA (Stayeon)

#### Outbound: Hotel OTA → REZ (Webhooks)

**Endpoint:** `POST /api/travel-webhooks/ota-booking-confirmed`

When a user books a hotel through Hotel OTA:
1. Hotel OTA calls this endpoint with `booking_confirmed` event
2. REZ Backend credits REZ coins to user's wallet
3. Creates `OtaBooking` record for tracking

**Payload:**
```json
{
  "event": "booking_confirmed",
  "booking_id": "uuid",
  "rez_user_id": "uuid",
  "booking_value_paise": 150000,
  "channel_source": "hotel_qr",
  "rez_coin_to_credit_paise": 1500,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Security:** HMAC-SHA256 signature using `REZ_OTA_WEBHOOK_SECRET`

---

**Endpoint:** `POST /api/travel-webhooks/ota-stay-completed`

After guest checkout:
1. Hotel OTA calls this endpoint with `stay_completed` event
2. REZ Backend credits stay-completion bonus coins
3. Triggers review prompt

**Payload:**
```json
{
  "event": "stay_completed",
  "booking_id": "uuid",
  "rez_user_id": "uuid",
  "booking_value_paise": 150000,
  "stay_completion_bonus_paise": 3000,
  "timestamp": "2024-01-17T11:00:00Z"
}
```

---

#### Outbound: Hotel OTA → REZ (Onward Travel Bookings)

**Endpoint:** `POST /api/travel-webhooks/booking-update`

When travel partner confirms bookings:
1. Hotel OTA forwards booking updates
2. Updates booking status in REZ system

---

### 2. Hotel OTA ↔ Hotel PMS (Stayeon)

#### Inbound: PMS → Hotel OTA (Webhooks)

**Endpoint:** `POST /api/webhooks/pms/reservation-confirmed`

When PMS confirms a booking:
1. PMS sends reservation event with guest details
2. Hotel OTA credits OTA coins to user
3. Updates booking status

**Endpoint:** `POST /api/webhooks/pms/guest-checkin`

When guest checks in:
1. PMS sends check-in event
2. Hotel OTA updates booking status

**Endpoint:** `POST /api/webhooks/pms/guest-checkout`

When guest checks out:
1. PMS sends check-out event
2. Hotel OTA updates booking status
3. Triggers stay completion webhook to REZ

**Endpoint:** `POST /api/webhooks/pms/reservation-cancelled`

When PMS cancels:
1. PMS sends cancellation event
2. Hotel OTA refunds coins, releases inventory

**Security:**
- HMAC-SHA256 signature with `PMS_WEBHOOK_SECRET`
- 5-minute timestamp tolerance
- Redis-based event deduplication

---

#### Outbound: Hotel OTA → PMS (API)

**Endpoint:** `POST /api/pms/inventory/push`

Pushes inventory updates to PMS:
```json
{
  "updates": [
    { "date": "2024-01-15", "rate_paise": 5000, "available_rooms": 10 }
  ]
}
```

**Endpoint:** `GET /api/pms/bookings`

Fetches bookings from PMS for reconciliation.

---

### 3. REZ Backend → Consumer App

**Channels:**
- Firebase Cloud Messaging (FCM) for push notifications
- Email via SendGrid
- In-app notifications

**Coin Balance:**
- Real-time balance via `GET /api/wallet/balance`
- Transaction history via `GET /api/wallet/transactions`

---

### 4. REZ Backend → Merchant App

**Dashboard API:**
- Campaign performance
- Coin economics (earn/burn rates)
- Hotel wallet balances

---

## Data Flow Examples

### Flow 1: Hotel Booking via OTA with REZ Coins

```
1. User books hotel via Consumer App
   │
   ├─► Hotel OTA: hold() reserves inventory
   │
   ├─► User pays via PG (Razorpay)
   │
   ├─► Hotel OTA: confirm() completes booking
   │
   ├─► Hotel OTA: sends webhook to Hotel PMS (reservation_created)
   │
   ├─► Hotel OTA: sends webhook to REZ Backend (booking_confirmed)
   │     └─► REZ Backend credits REZ coins
   │
   └─► User receives confirmation notification
```

### Flow 2: Guest Check-in via PMS

```
1. Hotel staff checks in guest in PMS
   │
   ├─► PMS updates booking status
   │
   ├─► PMS sends webhook to Hotel OTA (guest_checkin)
   │     └─► Hotel OTA updates booking status
   │
   └─► PMS pushes to Hotel OTA (guest-checkin event)
```

### Flow 3: Guest Check-out & Stay Completion

```
1. Hotel staff checks out guest in PMS
   │
   ├─► PMS updates booking status
   │
   ├─► PMS sends webhook to Hotel OTA (guest_checkout)
   │     └─► Hotel OTA updates booking status to "stayed"
   │
   ├─► PMS sends webhook to Hotel OTA (reservation_confirmed)
   │     └─► Hotel OTA credits OTA coins (loyalty program)
   │
   ├─► Hotel OTA sends webhook to REZ Backend (stay_completed)
   │     └─► REZ Backend credits stay-completion bonus
   │
   └─► Guest receives review prompt
```

### Flow 4: Hotel QR — Scan & Order

```
1. Guest scans QR code on room door
   │
   ├─► QR scanned → /room-hub?roomId=xxx
   │
   ├─► Hotel OTA validates QR (HMAC signature, expiry)
   │
   ├─► RoomHub loads with room context
   │
   ├─► Hotel OTA sends engagement webhook to REZ
         └─► REZ credits 5 coins (scan bonus)
   │
   ├─► Guest browses services (housekeeping, room service, etc.)
   │
   ├─► Guest places order (e.g., room service)
         │
         ├─► Hotel OTA creates RoomServiceRequest
         │
         ├─► Hotel OTA forwards to Hotel PMS (webhook)
         │     └─► PMS creates service request, assigns staff
         │
         ├─► Staff completes service
         │
         ├─► PMS sends status update to Hotel OTA
         │
         └─► Guest receives push notification
   │
   └─► On checkout: Hotel OTA syncs engagement to REZ
         └─► Additional coin rewards credited
```

### Flow 5: Hotel QR — Chat with Staff

```
1. Guest opens chat in RoomHub
   │
   ├─► Hotel OTA creates RoomChatThread
   │
   ├─► Hotel PMS receives thread creation
   │
   ├─► Staff joins thread via PMS dashboard
   │
   ├─► Guest sends message via RoomHub
   │     └─► Hotel OTA → WebSocket → PMS → Staff dashboard
   │
   ├─► Staff responds via PMS dashboard
   │     └─► Hotel PMS → WebSocket → Hotel OTA → RoomHub
   │
   └─► Hotel OTA tracks engagement
         └─► REZ credits 2 coins per 5 messages
```

### Flow 6: Hotel QR — Checkout via Room Hub

```
1. Guest requests checkout via RoomHub
   │
   ├─► Hotel OTA fetches pending service requests
   │
   ├─► Hotel OTA fetches room charges
   │
   ├─► Hotel OTA shows bill breakdown
   │
   ├─► Guest can redeem REZ coins
   │     └─► Hotel OTA calls REZ API to burn coins
   │
   ├─► Guest confirms payment
   │
   ├─► Hotel OTA sends checkout webhook to PMS
   │
   ├─► Hotel OTA sends stay_completed to REZ
   │     └─► REZ credits final coin bonus
   │
   └─► PMS processes checkout
```

---

## Security Architecture

### Webhook Security (Hotel OTA)

| Layer | Protection | Implementation |
|-------|------------|----------------|
| **Signature** | HMAC-SHA256 | `verifyPMSSignature()` in pmsWebhookService.ts |
| **Timestamp** | 5-min tolerance | `validateWebhookTimestamp()` |
| **Replay** | Redis deduplication | `isEventProcessed()` with 24h TTL |
| **Authorization** | Hotel ID verification | `verifyPmsHotelAuthorization()` |
| **Rate Limit** | 100 req/min per IP | express-rate-limit middleware |

### Webhook Security (REZ Backend)

| Layer | Protection | Implementation |
|-------|------------|----------------|
| **Signature** | HMAC-SHA256 | `verifyWebhookSignature()` in travelWebhookController.ts |
| **Idempotency** | Unique constraint | `OtaBooking.otaBookingId` as upsert key |
| **Raw Body** | Pre-captured | Express middleware captures before JSON parse |

---

## Database Schema Highlights

### Hotel OTA (PostgreSQL)

**Bookings Table:**
```sql
- id, bookingRef (unique)
- userId, hotelId, roomTypeId
- channelSource (direct, hotel_qr, etc)
- checkinDate, checkoutDate, numRooms
- status: init → hold → confirmed → checked_in → stayed → settled
- otaCoinBurnedPaise, rezCoinBurnedPaise, hotelBrandCoinBurnedPaise
- miningEligible, miningRulesVersion (HCS vesting)
```

**Inventory Slots Table:**
```sql
- hotelId, roomTypeId, date (unique constraint)
- ratePaise, rateType (base/weekend/event)
- availableRooms, isBlocked, blockReason
- SELECT FOR UPDATE NOWAIT for locking
```

**Coin Transactions Table:**
```sql
- userId, walletId, coinType (ota/rez/hotel_brand/cashback)
- transactionType (earn/burn/earn_reversal/expiry)
- amountPaise, direction (credit/debit)
- idempotencyKey for dedup
- metadata JSONB for extensible data
```

**Room Service Requests Table:**
```sql
- id, bookingId, hotelId, roomId, roomNumber, guestName
- serviceType (housekeeping/room_service/laundry/etc.)
- description, items (JSON), totalAmountPaise
- status: pending → assigned → in_progress → completed/cancelled
- priority (low/medium/high/now)
- requestedBy (staff), assignedTo (staff), guestUserId
- createdAt, updatedAt, completedAt
```

**Room Engagement Table:**
```sql
- id, rezUserId, otaUserId, bookingId, hotelId, roomId, roomNumber
- engagementType (qr_scan/service_request/order/chat)
- metadata (JSON for extensible data)
- engagedAt
```

### REZ Backend (MongoDB)

**OtaBooking Collection:**
```javascript
{
  otaBookingId: String,     // upsert key
  userId: ObjectId,
  amountPaise: Number,
  channelSource: String,
  status: 'confirmed',
  hotelId: ObjectId,         // partial, enrich via OTA API
  checkIn: Date,
  checkOut: Date
}
```

---

## Coin System Architecture

### Multi-Coin Types

| Coin Type | Issuer | Earn Sources | Burn Uses |
|-----------|--------|--------------|-----------|
| **OTA Coins** | Hotel OTA | Booking confirmation, stay completion | Discount future bookings |
| **REZ Coins** | REZ Backend | Booking confirmation, stay completion, campaigns | Platform purchases, travel services |
| **Hotel Brand Coins** | Individual Hotels | Hotel-specific loyalty | Hotel services only |
| **Cashback Coins** | REZ Backend | Cashback promotions | Withdraw to UPI |

### Hotel QR Engagement Rewards

| Action | Coins Earned | Description |
|--------|-------------|-------------|
| QR Scan (Check-in) | 5 coins | First scan of the stay |
| View Menu | 1 coin | Browse room service menu |
| First Order | 20 coins | First room service order |
| Order (per ₹100) | 2 coins | Cashback on orders |
| Chat with Staff | 2 coins | Per 5 messages exchanged |
| Checkout via QR | 10 coins | Scanning to checkout |
| Review Submitted | 15 coins | Post-stay review |

**Note:** Coins are tracked by Hotel OTA and synced to REZ Backend via engagement webhooks.

### HCS (Hotel Contribution Score) Mining

- Users earn mining eligibility based on booking attributes
- 12-month vesting schedule after stay completion
- Formula: `HCS = bookingValue * (1 - otaCommissionPct) * hotelMultiplier`

---

## Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLOUDS                                     │
├─────────────────────┬───────────────────────┬─────────────────────┤
│     Render (PMS)    │   Vercel (Hotel OTA)  │   Render (REZ)      │
│  ┌────────────────┐ │  ┌──────────────────┐ │  ┌────────────────┐ │
│  │ Hotel PMS API  │ │  │ Hotel OTA API    │ │  │ REZ Backend   │ │
│  │ (Node/Express) │ │  │ (Node/Express)   │ │  │ (Node/Express) │ │
│  └───────┬────────┘ │  └────────┬─────────┘ │  └───────┬────────┘ │
│          │                    │                    │          │       │
│  ┌───────▼────────┐ │  ┌───────▼─────────┐ │  ┌───────▼────────┐ │
│  │    MongoDB      │ │  │   PostgreSQL    │ │  │    MongoDB      │ │
│  │  (PMS data)    │ │  │   (OTA data)    │ │  │  (Core data)   │ │
│  └────────────────┘ │  └──────────────────┘ │  └────────────────┘ │
│          │                    │                    │          │       │
│  ┌───────▼────────┐ │  ┌───────▼─────────┐ │  ┌───────▼────────┐ │
│  │     Redis      │ │  │      Redis       │ │  │      Redis      │ │
│  │  (Rate limit, │ │  │  (Webhook dedup,│ │  │  (Session,     │ │
│  │   Sessions)    │ │  │   Sessions)     │ │  │   Cache)       │ │
│  └────────────────┘ │  └──────────────────┘ │  └────────────────┘ │
└─────────────────────┴───────────────────────┴─────────────────────┘
         │                     │                    │
         │    Consumer App     │                    │
         │    (React Native)   │                    │
         │                     │                    │
         └─────────────────────┴────────────────────┘
```

---

## Environment Variables

### Hotel OTA

| Variable | Purpose |
|----------|---------|
| `REZ_API_BASE_URL` | REZ Backend base URL |
| `REZ_OTA_WEBHOOK_SECRET` | HMAC secret for REZ webhooks |
| `PMS_WEBHOOK_SECRET` | HMAC secret for PMS webhooks |
| `ROOM_QR_SECRET` | HMAC secret for room QR codes |
| `REZ_ROOM_ENGAGEMENT_SECRET` | REZ engagement webhook verification |
| `DATABASE_URL` | PostgreSQL connection |
| `REDIS_URL` | Redis connection |

### Hotel PMS

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection |
| `REDIS_URL` | Redis connection |
| `REZ_API_BASE_URL` | REZ Backend base URL (for outbound webhooks) |
| `ROOM_QR_SECRET` | Must match OTA for QR verification |
| `CHAT_WS_SECRET` | WebSocket authentication secret |

### REZ Backend

| Variable | Purpose |
|----------|---------|
| `REZ_OTA_WEBHOOK_SECRET` | HMAC secret for OTA webhooks |
| `REZ_STAY_COMPLETION_BONUS_PCT` | Default 20% bonus |
| `MONGODB_URI` | MongoDB connection |
| `REDIS_URL` | Redis connection |
| `HOTEL_API_KEY` | API key for Hotel OTA integration |
| `HOTEL_QR_ENGAGEMENT_WEBHOOK` | Hotel QR engagement webhook URL |

### StayOwn App / REZ Now

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Hotel OTA API URL |
| `REZ_API_KEY` | API key for REZ services |
| `REZ_WALLET_URL` | REZ wallet service URL |

---

## API Endpoints Summary

### Hotel OTA Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/pms/reservation-confirmed` | PMS booking confirmed |
| POST | `/api/webhooks/pms/guest-checkin` | PMS guest check-in |
| POST | `/api/webhooks/pms/guest-checkout` | PMS guest check-out |
| POST | `/api/webhooks/pms/reservation-cancelled` | PMS cancellation |
| POST | `/api/pms/inventory/push` | Push inventory to PMS |
| GET | `/api/pms/bookings` | Get bookings from PMS |
| POST | `/api/bookings/hold` | Hold inventory |
| POST | `/api/bookings/confirm` | Confirm booking |
| POST | `/api/bookings/cancel` | Cancel booking |

### Hotel QR (Room Operating System) Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/room-qr/validate` | Validate scanned QR code |
| GET | `/v1/room-qr/menu/:hotelId` | Get room service menu |
| POST | `/v1/room-service` | Create service request |
| GET | `/v1/room-service` | List service requests |
| GET | `/v1/room-service/guest/my-requests` | Guest's service requests |
| PATCH | `/v1/room-service/:id` | Update request status |
| POST | `/v1/room-chat/threads` | Create chat thread |
| GET | `/v1/room-chat/threads/:id` | Get chat thread |
| POST | `/v1/room-chat/threads/:id/messages` | Send chat message |
| POST | `/v1/room-engagement/webhook` | REZ engagement webhook |
| POST | `/v1/room-engagement/sync` | Sync engagement to REZ |

### Hotel PMS (Room Service & Chat)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guest-services` | List guest service requests |
| POST | `/api/guest-services` | Create service request |
| PATCH | `/api/guest-services/:id` | Update service request |
| GET | `/api/guest-services/room/:roomId` | Room service requests |
| POST | `/api/webhooks/pms/service-request` | PMS service request webhook |

### REZ Backend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/travel-webhooks/ota-booking-confirmed` | OTA booking confirmed |
| POST | `/api/travel-webhooks/ota-stay-completed` | OTA stay completed |
| POST | `/api/travel-webhooks/booking-update` | Travel partner update |
| GET | `/api/wallet/balance` | Get coin balance |
| GET | `/api/wallet/transactions` | Get transaction history |

---

## Integration Status Checklist

### Core Booking & Coins
- [x] PMS → Hotel OTA webhooks (reservation events)
- [x] PMS → Hotel OTA webhooks (check-in/out events)
- [x] Hotel OTA → REZ Backend (booking_confirmed)
- [x] Hotel OTA → REZ Backend (stay_completed)
- [x] Hotel OTA → PMS (inventory push)
- [x] Hotel OTA → PMS (booking fetch)

### Hotel QR (Room Operating System)
- [x] Room QR generation (PMS admin)
- [x] QR Scanner component (frontend)
- [x] RoomHub component (guest UI)
- [x] Room Service API (create/track requests)
- [x] Room engagement webhook (REZ integration)
- [x] Hotel QR routes registered in App.tsx
- [ ] Chat Service (WebSocket - guest ↔ staff)
- [ ] PMS Service Request webhooks (OTA ↔ PMS)
- [ ] Push notifications (request updates)
- [ ] REZ coin rewards (scan bonus, order cashback)
- [ ] Real-time status updates (WebSocket)
- [ ] StayOwn app integration (room hub access)
- [ ] REZ Now hotel store page

### Future Integrations
- [ ] REZ Backend → Hotel OTA (direct user lookup)
- [ ] Campaign integration (both directions)
- [ ] Analytics data sharing

---

## Troubleshooting

### Common Issues

1. **Webhook not delivered:**
   - Check `PMS_WEBHOOK_SECRET` matches in PMS and Hotel OTA
   - Verify timestamp within 5-minute window
   - Check Redis for event deduplication

2. **Coins not credited:**
   - Check REZ Backend logs for `ota-booking-confirmed` processing
   - Verify `OtaBooking` upsert succeeded
   - Check `awardCoins()` response

3. **Inventory mismatch:**
   - Run reconciliation query in Hotel OTA
   - Check `inventory_slots` available_rooms vs `bookings` records

### Hotel QR Issues

4. **QR code not scanning:**
   - Verify `ROOM_QR_SECRET` matches between PMS and Hotel OTA
   - Check QR expiry date hasn't passed
   - Ensure camera has permission

5. **Service request not reaching PMS:**
   - Check `ROOM_QR_SECRET` matches
   - Verify webhook URL is accessible
   - Check PMS webhook logs

6. **Coins not awarded for engagement:**
   - Check REZ Backend logs for `room-engagement` event
   - Verify `REZ_ROOM_ENGAGEMENT_SECRET` matches
   - Check engagement sync endpoint

7. **Chat messages not delivering:**
   - Verify WebSocket connection is established
   - Check Redis for message queue status
   - Verify staff has joined the thread

---

## Architecture Upgrade (HOTEL-OTA-ARCH-001)

**Completed:** 2026-04-29  
**Status:** ✅ All phases complete

### What Changed

| Phase | Change | Impact |
|-------|--------|--------|
| 1 | Socket.IO Redis adapter | Horizontal scaling enabled |
| 1 | Redis-backed rate limiter | Multi-instance rate limiting |
| 1 | Prisma connection pool | Database connection tuning |
| 2 | Service directory reorg | 32 files → 12 subdirectories |
| 2 | Enhanced error handling | JSON logging + request IDs |
| 3 | Lazy-loaded analytics | Reduced initial bundle size |
| 3 | Manual chunk splitting | Separate MUI/DataGrid/Recharts chunks |

### Service Directory Structure
```
src/services/
├── auth/           # Authentication
├── booking/        # Booking, inventory, state machine
├── payments/       # Payment, settlement
├── finance/        # Coins, ledger
├── governance/     # Governance
├── mining/         # Mining
├── hotels/         # Hotel service
├── integrations/    # PMS, channel manager, REZ
├── notifications/  # Push notifications
├── corporate/      # Corporate accounts
├── marketing/      # Affiliate, referral
├── pricing/        # Pricing
└── shared/        # S3, OCR, fraud, intent
```

### Deployment Notes

1. **Prisma migration** (if needed):
   ```bash
   cd packages/database && npx prisma migrate deploy
   ```

2. **Multi-instance WebSocket test**:
   ```bash
   kubectl scale deployment hotel-ota-api --replicas=2
   ```
   - Open 2 browser tabs, each connects to different instance
   - Messages should broadcast correctly via Redis adapter

3. **Rate limiting test**:
   - Send 5 OTP requests from instance 1
   - 6th request from instance 2 should be blocked

### Rollback

If issues occur:
- **Phase 1**: Comment out `createAdapter()` in `src/socket/hotelSocket.ts`
- **Phase 2**: Git revert import path changes
- **Phase 3**: Revert `vite.config.ts` and `MultiPropertyManager.tsx`
