# StayOwn-Hospitality Platform

**Company:** StayOwn-Hospitality  
**Purpose:** Hotels + Living Spaces + Product Verification  
**GitHub:** https://github.com/imrejaul007/StayOwn-Hospitality  
**Last Updated:** 2026-05-12

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Architecture](#architecture)
3. [Services](#services)
4. [ReZ Mind Intelligence](#rez-mind-intelligence)
5. [ReZ Agent OS (CoPilot)](#rez-agent-os-copilot)
6. [Service Connections](#service-connections)
7. [Data Flow](#data-flow)
8. [Environment Variables](#environment-variables)
9. [API Endpoints](#api-endpoints)
10. [Deployment](./DEPLOYMENT-CHECKLIST.md)

---

## Platform Overview

### ⚠️ IMPORTANT: Two Different "Verify" Systems

| Service | Purpose | QR Type | Example |
|---------|---------|---------|---------|
| **verify-service** | Product authenticity | Product Serial QR | Scan shoe QR → Verify real/nice |
| **Room QR (Hotel-OTA)** | Hotel room access | Room Access QR | Hotel check-in QR code |

**verify-service** = Anti-counterfeit, product loyalty, brand engagement  
**Room QR** = Hotel guest check-in, room service, checkout

### Hotel-OTA Components

| App | Purpose | Tech |
|-----|---------|------|
| **api** | Backend API (33 routes) | Node.js, Express, PostgreSQL |
| **hotel-panel** | Hotel admin dashboard | React |
| **ota-web** | Consumer hotel search | React |
| **admin** | Super admin panel | React |
| **corporate-panel** | Corporate bookings | React |
| **mobile** | Guest mobile app | React Native |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ReZ Ecosystem                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ReZ Mind (Intelligence)                     │    │
│  │  • Commerce Memory (Intent Graph)                            │    │
│  │  • Agent OS (CoPilot)                                        │    │
│  │  • 8 Autonomous AI Agents                                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                   │
│                                    ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ReZ Platform Core                           │    │
│  │  Auth │ Wallet │ Karma │ Payments │ Notifications │ Profile   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│           StayOwn-Hospitality   │                                       │
├─────────────────────────────────┼───────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐            │
│  │   Verify    │  │   StayOwn   │  │    Habixo       │            │
│  │  Service    │  │  Service    │  │    Service      │            │
│  │              │  │              │  │                  │            │
│  │ • Products  │  │ • Hotels   │  │ • Properties    │            │
│  │ • Serials  │  │ • Bookings │  │ • Bookings      │            │
│  │ • Rewards  │  │ • Room QR  │  │ • Matching      │            │
│  │ • Fraud    │  │ • Check-in │  │ • Trust         │            │
│  └──────────────┘  └─────────────┘  └────────────────┘            │
│                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐      │
│  │   Channel Manager   │  │       Hotel OTA                   │      │
│  │                     │  │                                   │      │
│  │ • OTA Connect      │  │ • AI Chat (CoPilot)              │      │
│  │ • Inventory Sync    │  │ • Support Copilot                │      │
│  │ • Bookings          │  │ • Socket.IO Namespaces           │      │
│  └──────────────────────┘  └──────────────────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Services

### 1. rez-stayown-service

**Port:** 4016 | **Stack:** Node.js, Express, MongoDB, Redis

| Category | Features |
|----------|----------|
| **Hotel Booking** | Search, availability, dynamic pricing, free cancellation |
| **Room QR** | QR generation/validation, service charges, checkout billing |
| **Digital Check-in** | Multi-step check-in, ID verification, digital keys |
| **Room Service** | Services menu, orders, bill view, feedback |
| **Pre-Arrival** | Guest preferences (temp, lighting), transport requests |
| **WhatsApp** | Template messages, confirmations, reminders |
| **AI/ML** | Dynamic pricing via REZ Mind |

### 2. verify-service

**Port:** 3000 | **Stack:** Next.js 14, PostgreSQL (Prisma)

| Category | Features |
|----------|----------|
| **Verification** | Serial validation (HMAC), first scan tracking |
| **Brand Management** | Products, serial generation, analytics |
| **Campaigns** | Reward campaigns, eligibility, budget tracking |
| **Fraud Detection** | Real-time scoring, velocity check, GPS validation |
| **Rewards** | Coin issuance (BRANDED/REZ), claim management |

### 3. rez-channel-manager-service

**Port:** 3082 | **Stack:** Node.js, Express, MongoDB

| Category | Features |
|----------|----------|
| **Channel Connect** | Connect OTA channels (Booking.com, Airbnb, etc.) |
| **Inventory Sync** | Room availability, pricing, calendar |
| **Booking Sync** | Pull bookings, commission tracking |

### 4. rez-habixo-service

**Port:** 3007 | **Stack:** Node.js, Express, MongoDB, BullMQ

| Category | Features |
|----------|----------|
| **Property** | CRUD, search, photos, activation |
| **Booking** | Create, hourly slots, cancel, complete |
| **Matching** | Roommate profiles, compatibility scoring |
| **Trust** | Multi-component trust scores |
| **Reviews** | Submit, host responses |
| **Payments** | Transactions, payouts |

### 5. Hotel-OTA API

**Port:** 3000 | **Stack:** Node.js, Express, PostgreSQL

| Category | Features |
|----------|----------|
| **Booking** | Create, cancel, modify reservations |
| **Room Management** | Availability, pricing, bundles |
| **Room Service** | Order food, amenities |
| **Room QR** | Digital keys, check-in, checkout |
| **AI Chat** | CoPilot integration, support chatbot |
| **Chat** | Hotel chat, room chat, unified messaging |
| **Payments** | Razorpay integration, coin payments |
| **Mining** | REZ coin mining system |
| **Admin** | Hotel management, partner management |

**Key Routes (33 total):**
- `auth.routes.ts` - Authentication, OAuth
- `booking.routes.ts` - Booking management
- `room-qr.routes.ts` - Room QR codes
- `chatAi.routes.ts` - AI Chat (CoPilot)
- `room-service.routes.ts` - Room service orders
- `unified-chat.routes.ts` - Unified messaging
- `mining.routes.ts` - Coin mining

---

## ReZ Mind Intelligence

**Location:** `/rez-intent-graph`  
**Purpose:** AI-powered commerce intelligence

```
ReZ Mind = RTMN Commerce Memory + ReZ Agent OS
```

### Components

#### 1. Commerce Memory (Intent Graph)

Tracks user intent across ReZ ecosystem.

**Signal Weights:**
| Signal | Weight | Source |
|--------|--------|--------|
| `search` | 0.15 | All services |
| `view` | 0.10 | All services |
| `wishlist` | 0.25 | All services |
| `hold` | 0.35 | habixo |
| `booking_confirmed` | 1.0 | All services |
| `fulfilled` | 1.0 | All services |

#### 2. 8 Autonomous Agents

| Agent | Schedule | Purpose |
|-------|----------|---------|
| DemandSignalAgent | Every 5 min | Aggregate demand per merchant |
| ScarcityAgent | Every 1 min | Supply/demand ratios |
| PersonalizationAgent | Event-driven | User response profiling |
| AttributionAgent | Daily | Attribution tracking |
| AdaptiveScoringAgent | Daily | Dynamic scoring |
| FeedbackLoopAgent | Weekly | ML feedback |
| NetworkEffectAgent | Daily | Network growth |
| RevenueAttributionAgent | Daily | Revenue attribution |

---

## ReZ Agent OS (CoPilot)

**Location:** `/rez-agent-os`  
**Purpose:** AI Chatbot + Autonomous Agents

### Socket.IO Namespaces

| Namespace | Purpose | Connected Services |
|----------|---------|------------------|
| `/ai/room-qr` | Room QR requests | StayOwn, Hotel OTA |
| `/ai/hotel` | Hotel OTA chat | StayOwn, Hotel OTA |
| `/ai/general` | Consumer app | All apps |
| `/ai/restaurant` | Restaurant | Merchant |
| `/ai/merchant` | Merchant OS | All merchants |

### AI Tools (14 Base + 5 Orchestration)

#### Base Tools
| Tool | API | Purpose |
|------|-----|---------|
| `search_hotels` | Hotel OTA | Search hotels |
| `create_hotel_booking` | Hotel OTA | Book room |
| `request_room_service` | Hotel OTA | Room service |
| `request_housekeeping` | Hotel OTA | Housekeeping |
| `get_wallet_balance` | Wallet | Check coins |
| `get_loyalty_points` | Karma | Check points |
| `escalate_to_staff` | Support | Human handoff |

#### Orchestration Tools
| Tool | Description |
|------|-------------|
| `book_hotel_with_preferences` | Book + set room preferences |
| `plan_dinner_date` | Restaurant + reservation |
| `place_order_with_loyalty` | Order + use points |
| `plan_trip` | Hotel + activities |

---

## Service Connections

### External Integrations

| Service | Used By | Purpose |
|---------|---------|---------|
| **REZ Auth** | All | JWT verification, roles |
| **REZ Wallet** | verify, habixo | Coin transactions |
| **REZ Karma** | verify, habixo | Engagement scoring |
| **REZ Mind** | All | Event streaming, AI |
| **REZ Intent Graph** | verify, habixo | User intent |
| **REZ Notifications** | habixo | Push/email |
| **REZ Gamification** | habixo | Streaks, badges |
| **WhatsApp Business** | stayown | Notifications |
| **Google Hotel Ads** | stayown | Marketing |
| **Razorpay** | stayown, habixo | Payments |
| **Cloudinary** | habixo | Photos |

---

## Data Flow

### StayOwn Booking Flow
```
User → rez-stayown → Hotel PMS (inventory)
         ↓
      REZ Mind (events)
         ↓
      WhatsApp (notifications)
```

### Verify Flow
```
User Scans → verify-service → Serial Validation (HMAC)
               ↓
            Fraud Engine → REZ Mind (fraud signal)
               ↓
         [BLOCK/ALLOW]
               ↓
      Rewards → Wallet + Karma + Intent Graph
```

### Habixo Flow
```
User → rez-habixo → REZ Auth (verify)
            ↓
         REZ Intent Graph (habixo_stay_search)
            ↓
         REZ Wallet (rewards)
            ↓
         REZ Karma (engagement)
```

---

## Environment Variables

### rez-stayown-service

```bash
# Required
JWT_SECRET=<openssl rand -base64 64>
ROOM_QR_JWT_SECRET=<openssl rand -base64 64>
MONGODB_URI=<production-uri>
FACEBOOK_APP_SECRET=<from Meta>

# ReZ Mind
REZ_MIND_URL=https://rez-mind.onrender.com
REZ_INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com
```

### verify-service

```bash
# Required
JWT_SECRET=<openssl rand -base64 64>
DATABASE_URL=<postgresql-uri>
INTERNAL_SERVICE_KEY=<openssl rand -hex 32>

# ReZ Mind
REZ_MIND_URL=https://rez-mind.onrender.com
INTENT_CAPTURE_URL=https://rez-intent-graph.onrender.com
```

### rez-habixo-service

```bash
# Required
JWT_SECRET=<openssl rand -base64 64>
HASH_SECRET=<openssl rand -base64 64>
MONGODB_URI=<production-uri>
INTERNAL_SERVICE_TOKEN=<openssl rand -hex 32>

# ReZ Mind
REZ_INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com
```

---

## API Endpoints

### StayOwn Service (Port 4016)
| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/hotels/search` | Search hotels |
| POST | `/api/hotels/bookings` | Create booking |
| POST | `/api/room-qr/generate` | Generate QR |
| POST | `/api/room-qr/validate` | Validate QR |
| POST | `/api/room-qr/charge` | Add charge |
| POST | `/api/digital-checkin/start` | Start check-in |
| POST | `/api/whatsapp/send` | Send WhatsApp |

### Verify Service (Port 3000)
| Method | Endpoint | Description |
|-------|----------|-------------|
| POST | `/api/verify` | Verify serial |
| GET | `/api/serials/:serial` | Get serial info |
| POST | `/api/admin/brands` | Create brand |
| POST | `/api/rewards/:id/claim` | Claim reward |

### Habixo Service (Port 3007)
| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/habixo/properties` | Search properties |
| POST | `/api/habixo/bookings` | Create booking |
| POST | `/api/habixo/match/search` | Find roommates |
| GET | `/api/habixo/trust/:type/:id` | Get trust score |

### Intent Graph (Port 3001)
| Method | Endpoint | Description |
|-------|----------|-------------|
| POST | `/api/intent/capture` | Capture intent |
| GET | `/api/intent/active/:userId` | Get active intents |
| POST | `/api/autonomous/start` | Enable agents |
| GET | `/api/agent/tools` | List AI tools |

---

## Deployment

See [DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md) for detailed deployment instructions.

---

## Security

- JWT authentication with fail-closed validation
- HMAC-SHA256 webhook signature verification
- Rate limiting (Redis-backed)
- Input sanitization
- CORS with strict origins
- Correlation ID tracking
- Audit logging

---

*Document Version: 1.0.0 | Last Updated: 2026-05-12*
