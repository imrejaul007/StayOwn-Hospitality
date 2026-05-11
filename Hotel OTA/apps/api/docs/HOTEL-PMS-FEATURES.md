# Hotel PMS / OTA Platform — Complete Feature Inventory

> **Last Updated:** 2026-04-26
> **Platforms:** Hotel OTA API, Hotel Panel, Admin Panel, Mobile App, Hotel Management Master Backend

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER FACING (rez-app-consumer)             │
│  Hotel Search → Room Select → Checkout → My Bookings         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    HOTEL OTA API (Node.js/Prisma)             │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Booking  │  │  Coin    │  │Inventory │  │Payment   │  │
│  │ Service  │  │ Service  │  │ Engine   │  │Orchestr. │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  State   │  │Settlement│  │ Mining   │  │  PMS     │  │
│  │Machine   │  │ Service  │  │ Service  │  │Webhooks  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  REZ     │  │Partner   │  │Attribution│ │ Channel  │  │
│  │Integration│ │  API     │  │ Service  │  │ Manager  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│Hotel Panel  │    │Admin Panel  │    │ Hotel Management    │
│(Next.js)    │    │(Next.js)   │    │Master Backend      │
└─────────────┘    └─────────────┘    └─────────────────────┘
```

---

## Data Stores

| Store | Technology | Purpose |
|-------|-----------|---------|
| PostgreSQL | Prisma ORM | Bookings, coins, inventory, settlements, users |
| Redis | BullMQ | Job queues, session cache, rate limiting |
| MongoDB | Mongoose | Hotel management master backend |

---

## USER FEATURES

### Authentication & Identity

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Phone OTP Login** | Send + verify OTP via SMS (Twilio) | 6-digit code, 10-min expiry, 3 attempts max | `auth.routes.ts` |
| **REZ SSO Login** | Cross-platform login via REZ JWT token exchange | 2-step: validate token + fetch profile | `rez-integration.service.ts` |
| **JWT Token Mgmt** | Access token (15 min) + Refresh token (7 days) | Redis blacklist on logout | `auth.routes.ts` |
| **Session Persistence** | Mobile: SecureStore; Web: sessionStorage | Auto-refresh 5 min before expiry | `hotelOtaApi.ts` |
| **User Linking** | Link OTA account to existing REZ account | 3 modes: found+linked, found+unlinked, create new | `rez-integration.service.ts` |

### Hotel Search & Discovery

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **City-Based Search** | Search by city, date range, guest count | Prisma full-text + geo queries | `hotel.routes.ts`, `hotel.service.ts` |
| **Geo Filtering** | Filter by lat/lng radius (km) | Haversine distance calculation | `hotel.routes.ts` |
| **Star Rating Filter** | Filter by 1-5 star rating | Range filter | `hotel.routes.ts` |
| **Rate Range Filter** | Min/max price per night | Inclusive bounds | `hotel.routes.ts` |
| **Availability Check** | Pre-check room availability for dates | Inventory engine query | `inventory-engine.service.ts` |
| **Hotel Detail View** | Full hotel info: amenities, images, policies, location | Aggregated from Hotel + RoomType + images | `hotel.routes.ts`, `hotels/[id].tsx` |
| **Room Type Listing** | All room types with occupancy, bed type, base rate | Grouped by hotel | `hotel.routes.ts` |
| **Wishlist Management** | Add/remove hotels to personal wishlist | Persisted per user | `review.routes.ts` |
| **Hotel Images** | Image gallery with S3-backed upload | WebP optimization | `s3-upload.service.ts` |

### Booking Flow

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **10-Min Inventory Hold** | Atomic lock using `SELECT FOR UPDATE NOWAIT` | 10-minute window; expires via BullMQ job | `booking.service.ts`, `inventory-engine.service.ts` |
| **Coin Discount Preview** | Pre-check burn eligibility with tier caps | OTA: 15%, REZ: 10%, Brand: 20% | `coin.service.ts`, `wallet.routes.ts` |
| **Coin Burn at Hold** | Deduct coins immediately on hold | Reversed if payment fails | `booking.service.ts`, `coin.service.ts` |
| **Razorpay Order** | Create payment order for PG amount | Creates `razorpay_order_id` | `payment-orchestration.service.ts` |
| **Hold Expiry Job** | BullMQ job releases inventory if unpaid | Runs 10 min after hold creation | `booking.service.ts` |
| **Payment Confirmation** | Verify Razorpay signature + confirm booking | `payment.captured` webhook handler | `payment-orchestration.service.ts` |
| **Hold Countdown UI** | Timer in checkout UI, red at 2 min remaining | 300ms debounce on updates | `checkout.tsx` |
| **Zero-Cash Booking** | Coins-only path when coins cover full amount | Skips Razorpay flow | `booking.routes.ts` |
| **Booking Confirmation** | SMS notification with booking reference | Twilio SMS | `notification.service.ts` |
| **Idempotent Confirm** | Prevent double-confirm on retry | Check `status !== 'confirmed'` before update | `booking.service.ts` |

### Multi-Coin Loyalty System

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **OTA Coins** | Platform-wide coins earned on booking | 12-month expiry from earn date | `coin.service.ts` |
| **REZ Coins** | Cross-platform coins synced from REZ wallet | Polled from REZ API | `rez-integration.service.ts` |
| **Hotel Brand Coins** | Hotel-specific coins, burnable only at issuing hotel | Per-hotel balance tracking | `coin.service.ts` |
| **Coin Earning** | Earn on confirmed booking | Priority: campaign > hotel > tier > channel > default | `coin.service.ts` |
| **Coin Burning** | Apply coins to booking value | Waterfall: OTA > REZ > Brand; 60% cash floor minimum | `coin.service.ts` |
| **Coin History** | Paginated transaction log with booking ref | Filter by type: earn/burn/reversal/expiry | `coin.service.ts`, `wallet.routes.ts` |
| **Expiring Coins** | Show coins expiring soonest | Sorted by expiry date | `coin.service.ts` |
| **Coin Idempotency** | All operations have idempotency keys | Prevents duplicate earn/burn | `coin.service.ts` |
| **Manual Adjustment** | Admin can add/deduct any user's coins | Audit logged | `admin.routes.ts` |
| **Coin Liability View** | Total platform OTA/REZ/brand exposure | Admin dashboard metric | `admin.routes.ts` |
| **Coin Expiry Job** | BullMQ job processes 12-month expired coins | Daily run | `coin.service.ts` |

### Cancellation & Refunds

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **24-Hour Policy** | Free cancellation outside 24h of check-in | 50% penalty fee within 24h | `booking.service.ts`, `booking-state-machine.service.ts` |
| **Inventory Release** | Release locked rooms on cancel/payment failure | Postgres transaction | `inventory-engine.service.ts` |
| **Coin Restoration** | Reverse burned coins on cancellation | Guaranteed — always succeeds | `coin.service.ts` |
| **Earn Reversal** | Claw back earned coins on confirmed booking cancel | Only for confirmed bookings | `coin.service.ts` |
| **Razorpay Refund** | Initiate refund via Razorpay API | Proportional to penalty | `payment.service.ts` |
| **No-Show Handling** | Retain first night; partial refund for remainder | Automatic via nightly sweep | `booking-state-machine.service.ts` |
| **No-Show Sweep** | Nightly cron marks overdue confirmed bookings | Runs at 2 AM daily | `booking-state-machine.service.ts` |

### Offline Bill Payment (QR-Based)

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **QR Generation** | Generate payment QR for hotel front desk | Encodes booking + amount | `offline-payment.routes.ts` |
| **Coin on Bill Pay** | Apply OTA (10% cap) + REZ (5% cap) on bill | Separate burn waterfall | `offline-payment.routes.ts` |
| **Earn on Bill Pay** | Earn OTA (2%) + REZ (4%) coins on successful payment | After payment confirmation | `offline-payment.routes.ts` |
| **Shadow Stay Creation** | Auto-create stay registration for coin eligibility | Triggers coin earn | `offline-payment.routes.ts` |

### Reviews & Ratings

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Submit Review** | Rate 1-5 stars across: cleanliness, location, value, service | Only for completed bookings | `review.routes.ts` |
| **Hotel Reviews** | View reviews with averages per category | Aggregated per hotel | `review.routes.ts` |
| **Review Moderation** | Admin can hide inappropriate reviews | Flag-based | `review.routes.ts` |

### Referral Program

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Generate Code** | Unique `REF` prefixed referral code per user | 8-char alphanumeric | `referral.service.ts` |
| **Apply Code** | New user applies code on signup | Stored on user profile | `referral.service.ts` |
| **Referral Completion** | After referrer's first booking | Referrer: 200 Rs, Referred: 100 Rs | `referral.service.ts` |

### Stay Registration (Offline / Manual)

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Submit Receipt** | User uploads stay receipt for OCR | Stored pending review | `admin.routes.ts` |
| **Admin Approval** | Admin verifies and manually awards coins | Pending → approved/rejected | `admin.routes.ts` |

---

## HOTEL FEATURES

### Hotel Staff Authentication

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Phone OTP Login** | Staff login with OTP | Separate from user auth | `auth.routes.ts` |
| **Role-Based Access** | Manager, front desk, owner roles | Different permissions per role | `auth.ts` |

### Dashboard & Analytics

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Dashboard KPIs** | Monthly GMV, occupancy rate, ADR, pending settlements | Rolling 30-day | `hotel-panel.routes.ts` |
| **Revenue Chart** | 30-day daily revenue line chart | Aggregated by checkout date | `hotel-panel.routes.ts` |
| **Booking Trends** | Booking volume over time | Grouped by week/month | `hotel-panel.routes.ts` |
| **Cancellation Rate** | % of bookings cancelled | With penalty breakdown | `hotel-panel.routes.ts` |
| **Repeat Booking Rate** | % of guests who rebooked | Tracked per user | `hotel-panel.routes.ts` |

### Inventory Management

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Inventory Overview** | View all room types × date ranges | Visual calendar view | `hotel-panel.routes.ts` |
| **Update Inventory** | Set available rooms per date | Atomic update | `hotel-panel.routes.ts` |
| **Blackout Dates** | Block dates for closures | Sets all rooms to 0 | `inventory-engine.service.ts` |
| **Bulk Rate Updates** | Set base rate, weekend rate, event rate | Date range + rate matrix | `inventory-engine.service.ts` |
| **Inventory Reconciliation** | Nightly job detects overselling | Alerts on mismatch | `inventory-engine.service.ts` |

### Booking Operations

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **View Bookings** | List hotel's bookings with status filter | Paginated, sortable | `hotel-panel.routes.ts` |
| **Today's Check-ins** | Guests arriving today | Check-in date = today | `hotel-panel.routes.ts` |
| **Today's Check-outs** | Guests departing today | Checkout date = today | `hotel-panel.routes.ts` |
| **Guest Check-in** | Mark guest as physically arrived | Triggers PMS webhook | `hotel-panel.routes.ts` |
| **Guest Check-out** | Mark stay complete | Triggers brand coin award | `hotel-panel.routes.ts` |

### PMS Integration

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Webhook URL Config** | Set endpoint for inventory sync | Per-hotel configuration | `hotel-panel.routes.ts` |
| **Receive Webhooks** | Handle booking_confirmed, checkin, checkout, cancel | HMAC signature verified | `pms.routes.ts` |
| **Push to PMS** | Send booking events to hotel PMS | BullMQ queue, exponential backoff | `pms-webhook.service.ts` |
| **PMS Event History** | Log all inbound webhook events | For debugging | `pmsWebhookService.ts` |

### Settlement & Payouts

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Settlement Statement** | Paginated history + wallet balances | T+1 batches | `settlement.service.ts`, `hotel-panel.routes.ts` |
| **Available Balance** | Withdrawable after T+1 settlement | Includes pending reversals | `hotel-panel.routes.ts` |
| **Pending Balance** | Amount in-flight from recent bookings | Check-out < T+1 | `hotel-panel.routes.ts` |
| **T+1 Batch Processing** | Daily job moves pending → available | Runs at midnight | `settlement.service.ts` |
| **Settlement Reversal** | Cancel entry on booking cancellation | Audit logged | `settlement.service.ts` |

### Brand Coin Program

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Enable/Configure** | Set coin name, symbol, earn/burn rules | Admin approval required | `hotel-panel.routes.ts` |
| **View Members** | Paginated list of brand coin holders | Filterable | `hotel-panel.routes.ts` |
| **Brand Coin Burning** | Users can only burn at issuing hotel | Hotel-specific balance check | `coin.service.ts` |
| **Brand Coin Earn** | Hotels earn on their own brand coin transactions | Configurable rate | `coin.service.ts` |

### Ownership & Mining

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Ownership Dashboard** | Current token units, vesting timeline, network rank | Aggregated from ledger | `mining.service.ts` |
| **HCS Score Display** | Monthly score with breakdown | `base × repeat × rating × cancel_penalty` | `mining.service.ts` |
| **Vesting Timeline** | All ledger entries with unlock dates | Sorted by unlock date | `mining.service.ts` |
| **Score History** | 12-month historical HCS scores | Monthly snapshots | `mining.service.ts` |
| **Network Ranking** | Rank among all mining-eligible hotels | Top 100 display | `mining.service.ts` |
| **Mining Dispute** | Submit dispute for incorrect HCS | Tracked for resolution | `hotel-panel.routes.ts` |
| **Monthly Cycle** | Execute HCS calculation + token issuance | Idempotent per month | `mining.service.ts` |
| **12-Month Vesting** | All tokens locked 12 months | Automatic unlock job | `mining.service.ts` |
| **Forfeiture** | Churned hotels lose locked tokens | 90-day inactivity | `mining.service.ts` |
| **Pool Schedule** | Year 1-5 decreasing pool % | 50M → 40M → 30M → 20M → 10M tokens | `mining.service.ts` |

### Governance

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **View Proposals** | List active proposals with status | Draft → Active → Passed/Failed | `governance.routes.ts` |
| **Cast Vote** | Token-weighted voting (for/against/abstain) | One vote per token holder | `governance.service.ts` |
| **View Dividends** | Dividend payouts from platform distributions | Per holding period | `governance.service.ts` |

---

## ADMIN FEATURES

### Platform Dashboard

| Feature | Description | Files |
|---------|-------------|-------|
| **Overview KPIs** | Total GMV, active bookings, coin liability, active hotels | `admin.routes.ts` |
| **User Management** | List, view details, suspend users | `admin.routes.ts` |
| **Coin History** | Per-user OTA/REZ/brand transactions | `admin.routes.ts` |
| **Manual Coin Adjustment** | Add or deduct coins for any user | `admin.routes.ts` |

### Hotel Management

| Feature | Description | Files |
|---------|-------------|-------|
| **Hotel List** | All hotels with status filter | `admin.routes.ts` |
| **Hotel Onboarding** | Approve and activate new hotels | `admin.routes.ts` |
| **Suspend Hotel** | Deactivate (stops new bookings) | `admin.routes.ts` |
| **Commission Config** | Set per-hotel OTA commission % | `admin.routes.ts` |
| **Brand Coin Toggle** | Enable/disable brand coin program | `admin.routes.ts` |

### Coin Rule Management

| Feature | Description | Files |
|---------|-------------|-------|
| **Earn Rules CRUD** | Hotel-specific, tier-specific, campaign rules | `admin.routes.ts` |
| **Burn Rules CRUD** | Burn caps per tier and coin type | `admin.routes.ts` |
| **Coin Liability View** | Total platform OTA/REZ/brand exposure | `admin.routes.ts` |

### Settlement Management

| Feature | Description | Files |
|---------|-------------|-------|
| **Settlement History** | All entries with status | `admin.routes.ts` |
| **Approve Batch** | Manually approve T+1 payout batches | `admin.routes.ts`, `settlement.service.ts` |

### Mining Management

| Feature | Description | Files |
|---------|-------------|-------|
| **Run Mining Cycle** | Execute monthly HCS + token issuance | `admin.routes.ts`, `mining.service.ts` |
| **Preview Scores** | View estimated units before finalizing | `mining.service.ts` |
| **View Disputes** | List and manage HCS disputes | `admin.routes.ts` |
| **Adjust Score** | Manually correct HCS inputs | `mining.service.ts` |
| **Process Vesting** | Unlock due token tranches | `mining.service.ts` |

### Partner API Management

| Feature | Description | Files |
|---------|-------------|-------|
| **List Partner Keys** | View all partner API keys with scopes | `admin.routes.ts` |
| **Create Partner Key** | Generate scoped key for partner | `admin.routes.ts` |
| **Revoke Partner Key** | Deactivate partner API key | `admin.routes.ts` |

### Stay Registration Review

| Feature | Description | Files |
|---------|-------------|-------|
| **Pending Registrations** | List offline stays awaiting verification | `admin.routes.ts` |
| **Approve/Reject** | Verify receipt and award coins | `admin.routes.ts` |

### Bill Payments

| Feature | Description | Files |
|---------|-------------|-------|
| **Bill Payment History** | All offline payments platform-wide | `admin.routes.ts` |

---

## SYSTEM FEATURES

### Payment Processing

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Razorpay Integration** | UPI, cards, netbanking | Order → Capture flow | `payment-orchestration.service.ts` |
| **Webhook Security** | HMAC-SHA256 signature verification | On every Razorpay event | `payment-orchestration.service.ts` |
| **Idempotent Confirm** | Prevent double-confirmation on retry | idempotency key on razorpay_order_id | `booking.service.ts` |
| **Payment Reconciliation** | Daily DB vs Razorpay comparison | Logs discrepancies | `payment-orchestration.service.ts` |
| **Late Payment Handling** | Handle `payment.captured` after hold expiry | Check booking status before confirming | `payment-orchestration.service.ts` |

### Inventory Engine

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Atomic Locking** | `SELECT FOR UPDATE NOWAIT` | Prevents concurrent holds on same slot | `inventory-engine.service.ts` |
| **Oversell Guard** | Post-decrement availability check | Throws if < 0 | `inventory-engine.service.ts` |
| **Release Lock** | `FOR UPDATE` prevents race with concurrent hold | Single transaction | `inventory-engine.service.ts` |
| **Nightly Reconciliation** | Detect inventory discrepancies | Alerts on mismatch | `inventory-engine.service.ts` |

### Booking State Machine

```
┌─────────┐   hold()    ┌────────┐  confirm()  ┌───────────┐
│  init   │────────────▶│  hold  │────────────▶│ confirmed │
└─────────┘             └────────┘             └───────────┘
                              │                       │
                              │ expire()              │ checkin()
                              │ cancel()              ▼
                              ▼                 ┌───────────┐
                         [released]            │ checked_in │
                                               └───────────┘
                                                      │
                                                      │ checkout()
                                                      ▼
                                                 ┌────────┐
                                                 │ stayed │
                                                 └────────┘
                                                      │
                                                      │ settle()
                                                      ▼
                                                 ┌─────────┐
                                                 │ settled │
                                                 └─────────┘
                                                      │
                                                      │ mining_cycle()
                                                      ▼
                                             ┌────────────────┐
                                             │ mining_counted │
                                             └────────────────┘
```

| Feature | Description | Files |
|---------|-------------|-------|
| **State Transitions** | init → hold → confirmed → checked_in → stayed → settled → mining_counted | `booking-state-machine.service.ts` |
| **Side Effects** | Per-transition handlers (earn coins, settlement, etc.) | Outside transaction | `booking-state-machine.service.ts` |
| **Audit Events** | Every transition logged to `bookingEvent` table | Immutable | `booking-state-machine.service.ts` |
| **No-Show Sweep** | Nightly marks overdue confirmed bookings | 2 AM cron | `booking-state-machine.service.ts` |

### REZ Platform Integration

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **Token Verification** | 2-step: validate + profile fetch | JWT validation + API call | `rez-integration.service.ts` |
| **Wallet Sync** | Poll REZ wallet, persist to Postgres | Hourly sync job | `rez-integration.service.ts` |
| **Booking Webhook** | Notify REZ of confirmed bookings | Triggers coin attribution | `rez-webhook.service.ts` |
| **Stay Completed Webhook** | Notify REZ of checkout | `REZ_STAY_COMPLETION_BONUS_PCT` bonus | `rez-webhook.service.ts` |
| **REZ Overview** | Platform-level REZ sync status | Admin dashboard | `admin.routes.ts` |

### REZ Partner API

| Feature | Description | Files |
|---------|-------------|-------|
| **Scoped API Keys** | SHA-256 hashed keys with per-partner scopes | `partner-rez.routes.ts` |
| **Campaign Tracking** | Track REZ campaigns for attribution | `partner-rez.routes.ts` |
| **Auto User Creation** | Create OTA user from REZ profile | `partner-rez.routes.ts` |
| **Wallet Sync** | Push REZ balance updates to OTA | `partner-rez.routes.ts` |

### Attribution Engine

| Feature | Description | Business Logic | Files |
|---------|-------------|---------------|-------|
| **First Touch Attribution** | 12-month window, decaying fee | 6mo @ 100%, 6mo @ 50% | `attribution.service.ts` |
| **Campaign Override** | 7-day last touch attribution | Shortest window wins | `attribution.service.ts` |
| **Campaign Click Recording** | Track and expire campaign clicks | 7-day TTL | `attribution.service.ts` |

### Channel Manager

| Feature | Description | Files |
|---------|-------------|-------|
| **Provider Config** | SiteMinder, STAAH, RateGain, custom | `channel-manager.routes.ts` |
| **Inventory Sync Push** | Push availability to external channels | BullMQ queue | `channel-manager.routes.ts` |
| **Inbound Webhook** | Receive inventory updates from channels | HMAC verified | `channel-manager.routes.ts` |
| **Sync Logs** | Track all sync operations | Audit trail | `channel-manager.routes.ts` |

### Security

| Feature | Description | Files |
|---------|-------------|-------|
| **Rate Limiting** | Per-endpoint: search (100/min), booking (10/min), OTP (3/min), admin (30/min) | Redis-backed sliding window | `rateLimiter.ts` |
| **JWT Blacklist** | Redis-based token blacklist on logout | 15-min token lifetime | `auth.routes.ts` |
| **API Key Scoping** | Partner keys with granular scopes | SHA-256 hashed | `admin.routes.ts` |
| **PII Protection** | Tenant isolation, encrypted fields | MongoDB middleware | `hotel-management-master/` |
| **Audit Logging** | All admin actions logged | Immutable log | `admin/` |

### Background Jobs (BullMQ)

| Job | Schedule | Description | Files |
|-----|---------|-----------|-------|
| **Hold Expiry** | On hold creation + 10 min | Release inventory if unpaid | `booking.service.ts` |
| **PMS Notifications** | On event + retry | Exponential backoff delivery | `pms-webhook.service.ts` |
| **Coin Expiry** | Daily 3 AM | Process 12-month expired coins | `coin.service.ts` |
| **No-Show Sweep** | Daily 2 AM | Mark overdue check-ins | `booking-state-machine.service.ts` |
| **Settlement Batch** | Daily midnight | Create T+1 payout batches | `settlement.service.ts` |
| **Vesting Unlock** | Daily 4 AM | Check for due token tranches | `mining.service.ts` |
| **Inventory Reconciliation** | Daily 1 AM | Detect overselling | `inventory-engine.service.ts` |
| **REZ Wallet Sync** | Hourly | Poll REZ API | `rez-integration.service.ts` |

---

## KEY BUSINESS LOGIC RULES

| # | Rule | Value | Files |
|---|------|-------|-------|
| 1 | Cancellation window | Free outside 24h; 50% penalty within 24h | `booking.service.ts` |
| 2 | OTA coin burn cap | Max 15% of booking value | `coin.service.ts` |
| 3 | REZ coin burn cap | Max 10% of booking value | `coin.service.ts` |
| 4 | Brand coin burn cap | Max 20% of booking value | `coin.service.ts` |
| 5 | Cash floor | Minimum 60% cash (max 40% discount) | `coin.service.ts` |
| 6 | Earn priority | Campaign > Hotel > Tier > Channel > Default | `coin.service.ts` |
| 7 | No-show fee | First night's rate retained | `booking-state-machine.service.ts` |
| 8 | Settlement | T+1 (one day after checkout) | `settlement.service.ts` |
| 9 | Token vesting | 12 months from issuance | `mining.service.ts` |
| 10 | Attribution window | 12 months first touch, decaying after 6 months | `attribution.service.ts` |
| 11 | Hold duration | 10 minutes | `booking.service.ts` |
| 12 | Coin expiry | 12 months from earn date | `coin.service.ts` |
| 13 | Hold expiry | 10 minutes without payment | BullMQ job | `booking.service.ts` |
| 14 | Referral reward | Referrer: 200 Rs, Referred: 100 Rs | `referral.service.ts` |
| 15 | Coin earn on bill pay | OTA 2%, REZ 4% | `offline-payment.routes.ts` |
| 16 | Coin burn on bill pay | OTA 10% cap, REZ 5% cap | `offline-payment.routes.ts` |
| 17 | Token pool schedule | Year 1: 50M, Y2: 40M, Y3: 30M, Y4: 20M, Y5: 10M | `mining.service.ts` |

---

## DATA MODELS (Prisma)

### Core
- **User** — phone, email, tier, referral, REZ link, attribution
- **Hotel** — name, location, commission, brand coin config, PMS settings, images
- **RoomType** — occupancy, bed type, base rate, amenities
- **InventorySlot** — per-date availability (row-level lock support)
- **Booking** — full lifecycle: init/hold/confirmed/checked_in/stayed/settled/mining_counted

### Coin System
- **CoinWallet** — OTA/REZ/cashback balances, lifetime stats, version field for optimistic locking
- **CoinTransaction** — earn/burn/reversal/expiry, idempotency keys, metadata JSONB
- **EarnRule** — priority-based rule matching (campaign → hotel → tier → channel → default)
- **BurnRule** — tier-based burn caps per coin type
- **CoinExpirySchedule** — 12-month expiry tracking per transaction
- **HotelBrandCoinBalance** — per-hotel brand coin balances

### Settlement
- **HotelWallet** — pendingBalance, availableBalance
- **SettlementEntry** — per-booking: hotelId, bookingId, amount, status, batchId
- **PayoutBatch** — T+1 groupings with status (pending/approved/paid)
- **SettlementAuditLog** — immutable reversal audit trail

### Ownership Mining
- **HotelContributionScore** — monthly HCS: base × repeat × rating × cancel_penalty
- **OwnershipPoolSchedule** — year-based token pool (Year 1–5)
- **OwnershipTokenLedger** — issued tokens with unlockAt timestamp
- **VestingSchedule** — per-hotel unlock tranches
- **MiningDispute** — disputeId, hotelId, claimedScore, resolution

### Integration
- **HotelApiKey** — PMS API key per hotel
- **PartnerApiKey** — scoped partner keys (SHA-256 hashed)
- **RezBookingSync** — cross-platform booking sync status
- **ChannelManagerConfig** — SiteMinder/STAAH/RateGain/custom config
- **PmsWebhookEvent** — inbound webhook audit log with signature verification status

### Operations
- **BookingEvent** — immutable state transition log
- **AdminAuditLog** — all admin actions
- **RiskEvent** — fraud detection events
- **ReconciliationRun** — nightly reconciliation status

---

## MOBILE APP FEATURES (rez-app-consumer)

| Screen | Features |
|--------|---------|
| **Hotel Search** (`/travel/hotels/`) | City input, date pickers, guest count, auto-SSO |
| **Hotel Detail** (`/travel/hotels/[id]`) | Image carousel, amenity icons, room list, coin savings calculator, 300ms debounced coin toggle |
| **Checkout** (`/travel/hotels/checkout`) | Hold countdown timer (red at 2 min), price breakdown, coin toggle, Razorpay SDK, hold expiry job |
| **Confirmation** (`/travel/hotels/booking-confirmed`) | Animated checkmark, haptic feedback, coins earned display, booking ref |
| **Booking List** (`/travel/hotels/booking/[id]`) | Status timeline, check-in instructions, cancel button, review CTA |
| **Coin History** (`/travel/hotels/coin-history`) | Paginated list, filter by earn/burn/expiry, expiring coins section |
| **Review** (`/travel/hotels/[id]/review`) | Star ratings × 4 categories, text review, submit |

---

## HOTEL PANEL FEATURES (Next.js)

| Screen | Features |
|--------|---------|
| **Dashboard** | KPI cards, revenue chart, recent bookings |
| **Calendar** | Visual inventory calendar, bulk rate update, blackout dates |
| **Bookings** | Filterable list, check-in/out actions, booking detail |
| **Settlement** | Wallet balances, statement, payout history |
| **Analytics** | 30-day revenue, occupancy trends, cancellation rate |
| **Ownership** | Token units, HCS score, vesting timeline, network rank, disputes |
| **Settings** | PMS config, brand coin, hotel info, images |
| **Reports** | Export revenue/occupancy CSV |

---

## ADMIN PANEL FEATURES (Next.js)

| Screen | Features |
|--------|---------|
| **Dashboard** | GMV, bookings, users, coin liability, active hotels |
| **Hotels** | List with status, onboard, suspend, commission config |
| **Users** | List with filters, suspend, view coin history |
| **Bookings** | All bookings, full state event log |
| **Earn Rules** | CRUD for earn rules by hotel/tier/campaign |
| **Burn Rules** | CRUD for burn caps by tier |
| **Settlements** | Batch approval, history, audit log |
| **Mining** | Run cycle, preview scores, disputes, score adjustment |
| **Stay Registrations** | Pending reviews, approve/reject with coin award |
| **Bill Payments** | Platform-wide offline payment history |
| **Coin Liability** | Total OTA/REZ/brand exposure dashboard |
| **REZ** | Sync status, wallet reconciliation |
| **Admin Users** | Manage admin accounts and roles |
| **Configuration** | Platform-wide settings |

---

## HOTEL QR (Room Operating System)

Hotel QR transforms each hotel room into a digital service hub. Guests scan the QR code on their room door or access via StayOwn app to order anything — food, housekeeping, transport, spa, laundry — and chat with staff in real-time.

> Full documentation: [HOTEL-QR.md](./HOTEL-QR.md)

### Access Points

| Access Point | URL Pattern | Description |
|-------------|-------------|-------------|
| **Room QR Scan** | `/room-hub?roomId=xxx` | Guest scans QR → opens Room Hub |
| **StayOwn App** | `/app/services/room` | Authenticated guest accesses via app |
| **REZ Now Hotel** | `/[hotel-slug]/room/[room-id]` | Via hotel store on REZ Now |

### Services Available

| Category | Examples |
|---------|----------|
| **Housekeeping** | Room cleaning, extra towels, toiletries, bedding change |
| **Room Service** | Beverages, breakfast, meals, snacks |
| **Laundry** | Wash & fold, ironing, dry clean |
| **Transport** | Airport drop/pickup, local travel |
| **Spa & Wellness** | Massage, facial, aromatherapy |
| **Maintenance** | AC repair, Wi-Fi support, TV setup |
| **Concierge** | Special requests, reservations, tickets |
| **Fitness** | Gym access, yoga, swimming |

### Data Models

```
RoomServiceRequest   — Service requests (housekeeping, room service, etc.)
RoomEngagement      — Engagement tracking for REZ coin rewards
RoomChatThread      — Chat thread between guest and staff
RoomChatMessage     — Individual chat messages
```

### API Routes

| Route | Description |
|-------|-------------|
| `POST /v1/room-qr/validate` | Validate scanned QR |
| `POST /v1/room-service` | Create service request |
| `GET /v1/room-service` | List requests |
| `GET /v1/room-service/guest/my-requests` | Guest's requests |
| `POST /v1/room-chat/threads` | Create chat thread |
| `POST /v1/room-chat/threads/:id/messages` | Send message |
| `POST /v1/room-engagement/webhook` | REZ engagement webhook |

### Coin Rewards (REZ Integration)

| Action | Coins |
|--------|-------|
| QR Scan | +5 |
| View Menu | +1 |
| First Order | +20 |
| Order (per ₹100) | +2 |
| Chat (per 5 messages) | +2 |
| Checkout via QR | +10 |
| Review | +15 |

### Components

| Component | Location | Purpose |
|----------|---------|---------|
| `QRScanner` | `frontend/src/pages/guest/QRScanner.tsx` | Camera-based QR scanning |
| `RoomHub` | `frontend/src/pages/guest/RoomHub.tsx` | Main guest room interface |
| `AdminRoomQRManagement` | `frontend/src/pages/admin/AdminRoomQRManagement.tsx` | Admin QR generation |
| `roomQR.js` | `backend/src/routes/roomQR.js` | Backend QR generation API |
| `room-service.routes.ts` | `apps/api/src/routes/room-service.routes.ts` | Service request API |
| `rez-room-engagement.routes.ts` | `apps/api/src/routes/rez-room-engagement.routes.ts` | REZ coin integration |
