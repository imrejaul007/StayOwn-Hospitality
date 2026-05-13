# StayOwn-Hospitality Architecture

## Source of Truth - Technical Architecture

**Version:** 1.1.0 | **Last Updated:** 2026-05-13

---

## System Overview

### ⚠️ IMPORTANT: Two Different "Verify" Systems

| Service | Purpose | QR Type | Database |
|---------|---------|---------|---------|
| **verify-service** | Product authenticity | Product Serial QR | PostgreSQL |
| **Room QR (Hotel-OTA)** | Hotel room access | Room Access QR | PostgreSQL |

**verify-service** = Anti-counterfeit, product loyalty  
- Serial validation (HMAC)
- Fraud detection
- Brand rewards (coins)
- Karma points

**Room QR (Hotel-OTA)** = Hotel guest operations  
- Room access control
- Service ordering
- Checkout billing
- Connected to CoPilot AI

### Hotel-OTA Components

| App | Purpose | Tech |
|-----|---------|------|
| **Hotel-OTA/apps/api** | Backend API (33 routes) | Node.js, Express, PostgreSQL |
| **Hotel-OTA/apps/hotel-panel** | Hotel admin dashboard | React |
| **Hotel-OTA/apps/ota-web** | Consumer hotel search | React |
| **Hotel-OTA/apps/admin** | Super admin panel | React |
| **Hotel-OTA/apps/mobile** | Guest mobile app | React Native |
| **Hotel-OTA/apps/corporate-panel** | Corporate bookings | React |

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ReZ Ecosystem                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        ReZ Mind (Intelligence)                        │   │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐     │   │
│  │  │  Commerce Memory      │  │         Agent OS                │     │   │
│  │  │  (Intent Graph)       │  │  ┌─────────────────────────┐   │     │   │
│  │  │                       │  │  │  AI Chat (Claude)       │   │     │   │
│  │  │  • Intent Capture     │  │  │  14 Base Tools          │   │     │   │
│  │  │  • Dormant Detection  │  │  │  5 Orchestration Tools  │   │     │   │
│  │  │  • Revival Nudges     │  │  │  8 Autonomous Agents   │   │     │   │
│  │  │  • Signal Weights     │  │  └─────────────────────────┘   │     │   │
│  │  └─────────────────────────┘  └─────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                        │
│                                      ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     ReZ Platform Core                               │   │
│  │                                                                       │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │ Auth   │ │ Wallet │ │ Karma  │ │Payments│ │Notifs │        │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  │                                                                       │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │Profile │ │ Gamif. │ │Search  │ │ Orders │ │Merchants│        │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                        │
│                           ┌───────────┴───────────┐                         │
│                           ▼                       ▼                         │
└───────────────────────────┼───────────────────────┼───────────────────────┘
                            │                       │
┌───────────────────────────┼───────────────────────┼───────────────────────┐
│           StayOwn-Hospitality │                       │                       │
├───────────────────────────┼───────────────────────┼───────────────────────┤
│                           │                       │                       │
│  ┌────────────────┐ ┌─────┴────────┐ ┌──────────┴──────────┐ ┌──────┴────┐ │
│  │   Verify      │ │  StayOwn    │ │   Channel Manager   │ │  Hotel    │ │
│  │  Service      │ │  Service    │ │                     │ │  OTA       │ │
│  │               │ │  (4016)     │ │    (3082)          │ │            │ │
│  │  Port: 3000  │ │             │ │                     │ │  • AI Chat │ │
│  │               │ │  • Hotels   │ │  • OTA Connect    │ │  • CoPilot │ │
│  │  • Products   │ │  • Bookings │ │  • Inventory Sync  │ │  • Support │ │
│  │  • Serials    │ │  • Room QR  │ │  • Bookings       │ └────────────┘ │
│  │  • Rewards    │ │  • Check-in │ └────────────────────┘                │
│  │  • Fraud      │ │  • WhatsApp │                                        │
│  └────────────────┘ │  • AI/ML    │  ┌────────────────────────┐           │
│                    └─────────────┘  │  │     Habixo Service     │           │
│                                   │  │       (3007)          │           │
│                                   │  │                       │           │
│                                   │  │  • Properties        │           │
│                                   │  │  • Bookings          │           │
│                                   │  │  • Matching          │           │
│                                   │  │  • Trust             │           │
│                                   │  └───────────────────────┘           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Services Detail

### 1. rez-stayown-service

**Port:** 4016  
**Database:** MongoDB  
**Cache:** Redis  
**Language:** TypeScript

```
┌─────────────────────────────────────────────────────────────────┐
│                    rez-stayown-service                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Hotel      │  │ Room QR    │  │ Digital     │          │
│  │ Booking    │  │ System     │  │ Check-in   │          │
│  │            │  │            │  │            │          │
│  │ • Search   │  │ • Generate │  │ • ID Verify│          │
│  │ • Avail    │  │ • Validate │  │ • Keys    │          │
│  │ • Pricing  │  │ • Charges │  │ • Express  │          │
│  │ • Book     │  │ • Checkout │  │   Checkout │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Room       │  │ Pre-Arrival│  │ WhatsApp   │          │
│  │ Service    │  │            │  │ Integration│          │
│  │            │  │ • Prefs   │  │            │          │
│  │ • Menu     │  │ • Transport│  │ • Templates│          │
│  │ • Orders   │  │ • Sync    │  │ • Notifs   │          │
│  │ • Feedback │  │           │  │            │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              External Integrations                  │        │
│  │                                                     │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │        │
│  │  │ REZ Mind │  │ Razorpay │  │ WhatsApp │     │        │
│  │  │ (Events) │  │ (Payment)│  │ (Notify) │     │        │
│  │  └──────────┘  └──────────┘  └──────────┘     │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │        │
│  │  │Hotel PMS│  │ Google   │  │ Hotel    │     │        │
│  │  │(Rooms)  │  │ Hotel Ads│  │ OTA      │     │        │
│  │  └──────────┘  └──────────┘  └──────────┘     │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. verify-service

**Port:** 3000 (Next.js)  
**Database:** PostgreSQL (Prisma)  
**Language:** TypeScript

```
┌─────────────────────────────────────────────────────────────────┐
│                     verify-service                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │                   Verification Flow                    │      │
│  │                                                     │      │
│  │    User Scans QR                                     │      │
│  │         │                                             │      │
│  │         ▼                                             │      │
│  │    ┌─────────────────┐                              │      │
│  │    │  Serial Validate │                              │      │
│  │    │  (HMAC Check)   │                              │      │
│  │    └────────┬────────┘                              │      │
│  │             │                                        │      │
│  │             ▼                                        │      │
│  │    ┌─────────────────┐                              │      │
│  │    │  Fraud Engine   │                              │      │
│  │    │                 │                              │      │
│  │    │ • Velocity     │                              │      │
│  │    │ • GPS Check   │                              │      │
│  │    │ • Device FP   │                              │      │
│  │    └────────┬────────┘                              │      │
│  │             │                                        │      │
│  │      ┌──────┴──────┐                               │      │
│  │      ▼             ▼                                │      │
│  │   [BLOCK]       [ALLOW]                            │      │
│  │      │             │                                │      │
│  │      ▼             ▼                                │      │
│  │  REZ Mind      ┌──────────────────┐                 │      │
│  │  (fraud)       │ Reward + Karma  │                 │      │
│  │                 │ + Intent Graph │                 │      │
│  │                 └──────────────────┘                 │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Brands     │  │ Campaigns   │  │ Analytics  │          │
│  │            │  │             │  │            │          │
│  │ • Products │  │ • Rewards  │  │ • Reports │          │
│  │ • Serials │  │ • Eligibility│ │ • Metrics │          │
│  │ • Plans   │  │ • Budget   │  │ • Charts  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. rez-channel-manager-service

**Port:** 3082  
**Database:** MongoDB

```
┌─────────────────────────────────────────────────────────────────┐
│              rez-channel-manager-service                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │                    OTA Channels                      │      │
│  │                                                     │      │
│  │   ┌───────────┐  ┌───────────┐  ┌───────────┐     │      │
│  │   │ Booking  │  │ Airbnb   │  │ Expedia  │     │      │
│  │   │   .com   │  │          │  │          │     │      │
│  │   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘     │      │
│  │         │              │              │             │      │
│  │         └──────────────┼──────────────┘             │      │
│  │                        │                            │      │
│  │                        ▼                            │      │
│  │              ┌──────────────────┐                  │      │
│  │              │   Channel Mgr   │                  │      │
│  │              │                  │                  │      │
│  │              │ • Connect      │                  │      │
│  │              │ • Inventory    │                  │      │
│  │              │ • Bookings    │                  │      │
│  │              │ • Commission   │                  │      │
│  │              └────────┬───────┘                  │      │
│  │                       │                          │      │
│  └───────────────────────┼──────────────────────────┘      │
│                          │                                  │
│                          ▼                                  │
│                   ┌────────────────┐                       │
│                   │   Hotel PMS   │                       │
│                   │ (Room Updates) │                       │
│                   └────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. rez-habixo-service

**Port:** 3007  
**Database:** MongoDB  
**Queue:** BullMQ

```
┌─────────────────────────────────────────────────────────────────┐
│                   rez-habixo-service                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Property   │  │ Booking    │  │ Matching   │          │
│  │ Management │  │ System     │  │ (Roommates)│          │
│  │            │  │            │  │            │          │
│  │ • CRUD    │  │ • Create  │  │ • Profiles│          │
│  │ • Search  │  │ • Cancel  │  │ • Compat. │          │
│  │ • Photos  │  │ • Complete│  │ • Notifs  │          │
│  │ • Pricing │  │ • Reminders│ │            │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Trust      │  │ Wishlists  │  │ Reviews    │          │
│  │ Score      │  │            │  │            │          │
│  │ • Reliability│ │ • Add    │  │ • Submit  │          │
│  │ • Quality  │  │ • Remove │  │ • Respond │          │
│  │ • Behavior │  │ • List   │  │ • Stats   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐      │
│  │              ReZ Platform Integration                  │      │
│  │                                                     │      │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │      │
│  │  │ Auth   │  │ Wallet │  │ Karma  │  │ Mind   │ │      │
│  │  └────────┘  └────────┘  └────────┘  └────────┘ │      │
│  │  ┌────────┐  ┌────────┐  ┌────────┐              │      │
│  │  │Profile │  │Notifs  │  │Gamif. │              │      │
│  │  └────────┘  └────────┘  └────────┘              │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### StayOwn Booking + Room QR Flow

```
┌─────────┐     ┌──────────────────┐     ┌───────────┐
│  User   │────▶│ rez-stayown      │────▶│ Hotel PMS │
│   App   │     │   Service        │     │           │
└─────────┘     └────────┬─────────┘     └───────────┘
                          │
                          │ Events
                          ▼
                 ┌──────────────────┐
                 │    REZ Mind     │
                 │ (Intelligence)   │
                 └────────┬─────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  WhatsApp    │ │    AI        │ │  Intent      │
│  (Notifs)    │ │  (Pricing)   │ │  Graph       │
└──────────────┘ └──────────────┘ └──────────────┘

Events:
• search_performed
• booking_created
• room_qr_generated
• checkout_completed
```

### Verify Service Flow

```
┌─────────┐     ┌──────────────┐     ┌───────────┐
│  User   │────▶│   verify-   │────▶│  Serial   │
│ Scans   │     │   service   │     │  (HMAC)   │
└─────────┘     └──────┬───────┘     └───────────┘
                        │
                        │ Fraud Check
                        ▼
               ┌─────────────────┐
               │   Fraud Engine   │
               │                 │
               │ • Velocity     │
               │ • GPS         │
               │ • Device FP   │
               └────────┬────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
          [BLOCK]              [ALLOW]
              │                   │
              ▼                   │
        ┌──────────┐            │
        │ REZ Mind │            │
        │(fraud)   │            │
        └──────────┘            │
                               ▼
                    ┌───────────────────┐
                    │  Reward Flow       │
                    │                   │
                    │ • Wallet (coins)  │
                    │ • Karma (qr_in)  │
                    │ • Intent Graph   │
                    └───────────────────┘
```

---

## Database Models

### MongoDB

#### stayown-service
| Collection | Purpose |
|------------|---------|
| `bookings` | Hotel reservations |
| `roomqrs` | QR code data |
| `servicecharges` | Minibar, laundry |

#### habixo-service
| Collection | Purpose |
|------------|---------|
| `properties` | Listings |
| `bookings` | Reservations |
| `flatmateprofiles` | Roommate matching |
| `trustscores` | Trust calculation |

#### channel-manager
| Collection | Purpose |
|------------|---------|
| `channels` | OTA credentials |
| `inventories` | Room availability |
| `channelbookings` | Sync'd bookings |

### PostgreSQL (verify-service)

| Table | Purpose |
|-------|---------|
| `Brand` | Brand profiles |
| `Product` | Products |
| `Serial` | Serial numbers |
| `Scan` | Verification events |
| `Campaign` | Reward campaigns |
| `Reward` | Issued rewards |

---

## Technology Stack

| Service | Language | Framework | Database | Cache |
|---------|----------|-----------|---------|-------|
| stayown | TypeScript | Express | MongoDB | Redis |
| verify | TypeScript | Next.js 14 | PostgreSQL | - |
| channel-manager | TypeScript | Express | MongoDB | - |
| habixo | TypeScript | Express | MongoDB | Redis |

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Layers                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Authentication                       │  │
│  │                                                          │  │
│  │   JWT Validation ────▶ Role Verification ────▶ Access   │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Webhook Security                    │  │
│  │                                                          │  │
│  │   HMAC-SHA256 ────▶ Timing-Safe Compare ────▶ Process   │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Rate Limiting                       │  │
│  │                                                          │  │
│  │   Redis Sorted Sets ────▶ Per-IP/User ────▶ 429 Error   │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Input Validation                     │  │
│  │                                                          │  │
│  │   Zod Schema ────▶ Sanitize ────▶ Store               │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monitoring & Observability

| Component | Technology |
|----------|------------|
| Error Tracking | Sentry |
| Metrics | Prometheus |
| Logging | Winston |
| Health Checks | /health endpoints |
| Correlation IDs | X-Correlation-ID header |

---

*Document Version: 1.0.0 | Last Updated: 2026-05-12*
