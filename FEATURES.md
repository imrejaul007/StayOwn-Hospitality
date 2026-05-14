# StayOwn Hospitality - Complete Feature Specification

**Document Version:** 1.0.0
**Date:** May 13, 2026
**Last Updated:** Claude Code Audit

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [API Features](#api-features)
3. [Admin Panel Features](#admin-panel-features)
4. [Hotel Panel Features](#hotel-panel-features)
5. [Corporate Panel Features](#corporate-panel-features)
6. [OTA Web Features](#ota-web-features)
7. [Mobile App Features](#mobile-app-features)
8. [Business Flows](#business-flows)
9. [Wallet & Loyalty System](#wallet--loyalty-system)
10. [Database Schema](#database-schema)
11. [Environment Configuration](#environment-configuration)

---

## Platform Overview

```
StayOwn-Hospitality/
├── Hotel-OTA/
│   ├── apps/
│   │   ├── api/              # Backend API (Node.js, Express, PostgreSQL)
│   │   ├── admin/            # Super Admin Panel (Next.js 14)
│   │   ├── hotel-panel/      # Hotel Management Dashboard (Next.js 14)
│   │   ├── corporate-panel/  # Corporate Bookings Panel (Next.js 14)
│   │   ├── ota-web/         # Consumer Web App (Next.js 14)
│   │   └── mobile/          # Guest Mobile App (React Native)
│   ├── packages/
│   │   ├── database/        # Prisma schema & client
│   │   └── merchant-sdk/     # Merchant Integration SDK
│   └── services/
├── rez-stayown-service/      # Hotel Booking Service (MongoDB)
├── rez-channel-manager-service/ # Channel Manager (MongoDB)
└── verify-service/           # Product Verification (Next.js)
```

---

## API Features

### Port: 3000 | Tech Stack: Node.js, Express, PostgreSQL, Redis, Socket.IO

### Authentication (33 endpoints)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **OTP Authentication** | `POST /v1/auth/send-otp` | Send 6-digit OTP to phone (rate-limited) |
| **OTP Verification** | `POST /v1/auth/verify-otp` | Verify OTP, return JWT tokens |
| **Token Refresh** | `POST /v1/auth/refresh` | Refresh JWT using refresh token |
| **REZ SSO** | `POST /v1/auth/rez-sso` | Complete REZ ecosystem SSO flow |
| **Logout** | `POST /v1/auth/logout` | Blacklist JWT in Redis |
| **Hotel Staff OTP** | `POST /v1/auth/hotel/send-otp` | 4-digit hotel staff OTP |
| **Hotel Staff Verify** | `POST /v1/auth/hotel/verify-otp` | Hotel staff JWT with hotel_id + role |
| **Admin Login** | `POST /v1/auth/admin/login` | Email/password admin login |

### Booking Management

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Hold Booking** | `POST /v1/bookings/hold` | 10-min inventory lock, coin burn simulation |
| **Confirm Booking** | `POST /v1/bookings/confirm` | Signature verification, state transition |
| **List Bookings** | `GET /v1/bookings` | Filter by status (upcoming/past/cancelled) |
| **Booking Detail** | `GET /v1/bookings/:id` | Full detail with coin summary |
| **Cancel Booking** | `POST /v1/bookings/:id/cancel` | Release inventory, reverse coins, refund |
| **Razorpay Webhook** | `POST /v1/bookings/webhooks/razorpay` | Handle payment.failed, order.paid events |

### Hotel Management

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **List Hotels** | `GET /v1/hotels` | Browse active hotels (paginated) |
| **Search Hotels** | `GET /v1/hotels/search` | Full search with filters |
| **Hotel Detail** | `GET /v1/hotels/:id` | Hotel info, amenities, images |
| **Hotel Onboarding** | `POST /v1/hotels` | Create new hotel |
| **Update Hotel** | `PUT /v1/hotels/:id` | Update hotel details |
| **Upload Images** | `POST /v1/hotels/:id/images` | Upload hotel images |
| **Room Types** | `GET /v1/hotels/:id/rooms` | List room types |
| **Add Room Type** | `POST /v1/hotels/:id/rooms` | Create room type |
| **Update Room Type** | `PUT /v1/rooms/:id` | Update room type |
| **Availability** | `GET /v1/hotels/:id/availability` | Check availability |
| **Get Rates** | `GET /v1/hotels/:id/rates` | Get rates for dates |
| **Set Rates** | `POST /v1/hotels/:id/rates` | Bulk update rates |

### Room QR & Digital Key

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Validate QR** | `POST /v1/room-qr/validate` | Validate QR code, return room/booking info |
| **Generate QR** | `POST /v1/room-qr/generate` | Generate QR for booking |
| **Check-in Status** | `GET /v1/room-qr/status/:bookingId` | Get check-in status |

### Room Service

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Place Order** | `POST /v1/room-service/orders` | Place room service order |
| **List Orders** | `GET /v1/room-service/orders` | Guest's orders (status filter) |
| **Order Detail** | `GET /v1/room-service/orders/:id` | Order with items |
| **Cancel Order** | `POST /v1/room-service/orders/:id/cancel` | Cancel order |
| **Hotel Menu** | `GET /v1/room-service/menu/:hotelId` | Hotel's service menu |
| **Minibar Items** | `GET /v1/room-service/minibar/:roomId` | Minibar items for room |
| **Checkout Billing** | `GET /v1/room-service/checkout/:bookingId` | All room service charges |
| **Submit Feedback** | `POST /v1/room-service/feedback` | Post-stay feedback |
| **Get Feedback** | `GET /v1/room-service/feedback/:bookingId` | Get feedback for booking |

### Wallet System

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Get Balance** | `GET /v1/wallet` | OTA coin + REZ coin balance |
| **List Transactions** | `GET /v1/wallet/transactions` | Paginated transactions |
| **Check Burn** | `POST /v1/wallet/check-burn` | Calculate coins needed for amount |
| **Burn Coins** | `POST /v1/wallet/burn` | Burn coins for discount |
| **Earn Coins** | `POST /v1/wallet/earn` | Earn coins on booking |

### User Profile

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Get Profile** | `GET /v1/user/profile` | User details + tier |
| **Update Profile** | `PUT /v1/user/profile` | Update name, email |
| **Register Stay** | `POST /v1/user/register-stay` | Register offline stay |
| **List Registrations** | `GET /v1/user/register-stay` | User's stays |
| **Get Referral Code** | `GET /v1/user/referral-code` | User's referral code |
| **Referral Stats** | `GET /v1/user/referral-stats` | Referral earnings |

### Reviews

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Hotel Reviews** | `GET /v1/reviews/hotel/:id` | Reviews for hotel |
| **Submit Review** | `POST /v1/reviews` | Submit review with rating |

### Wishlist

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **List Wishlist** | `GET /v1/wishlists` | User's wishlist |
| **Add to Wishlist** | `POST /v1/wishlists/:hotelId` | Add hotel |
| **Remove from Wishlist** | `DELETE /v1/wishlists/:hotelId` | Remove hotel |

### Admin Features

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Admin Hotels** | `GET /v1/admin/hotels` | All hotels (pending/active/suspended) |
| **Admin Update Hotel** | `PUT /v1/admin/hotels/:id` | Update hotel (admin) |
| **Admin Users** | `GET /v1/admin/users` | All users |
| **Admin Update User** | `PUT /v1/admin/users/:id` | Update user |
| **Earn Rules** | `CRUD /v1/admin/earn-rules` | Configure earn rates |
| **Burn Rules** | `CRUD /v1/admin/burn-rules` | Configure burn constraints |
| **Coin Liability** | `GET /v1/admin/coin-liability` | OTA/ReZ/Hotel liability |
| **Settlements** | `CRUD /v1/admin/settlements` | Settlement batches |
| **Mining** | `POST /v1/admin/mining` | Ownership mining execution |
| **Broadcast** | `POST /v1/admin/broadcast` | Push notifications |

### Hotel Staff Features

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Staff Bookings** | `GET /v1/hotel/bookings` | Hotel's bookings |
| **Check-in Guest** | `POST /v1/hotel/checkin/:id` | Process guest check-in |
| **Check-out Guest** | `POST /v1/hotel/checkout/:id` | Process guest check-out |
| **Room Status** | `CRUD /v1/hotel/rooms` | Room management |
| **Minibar Billing** | `POST /v1/hotel/minibar` | Add minibar charges |
| **Room Service Orders** | `CRUD /v1/hotel/room-service` | Manage orders |
| **Feedback View** | `GET /v1/hotel/feedback` | View feedback |

### Corporate Features

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **Corporate Profile** | `CRUD /v1/corporate/profile` | Company profile |
| **Corporate Bookings** | `CRUD /v1/corporate/bookings` | Manage corporate bookings |
| **Approve Booking** | `POST /v1/corporate/bookings/:id/approve` | Approve booking |
| **Reject Booking** | `POST /v1/corporate/bookings/:id/reject` | Reject booking |
| **Booking Policy** | `CRUD /v1/corporate/policy` | Spending policy |
| **Usage Report** | `GET /v1/corporate/report` | Usage analytics |

### Real-time (Socket.IO)

| Event | Direction | Payload |
|-------|-----------|---------|
| `booking:created` | Server→Client | Booking object |
| `booking:updated` | Server→Client | Booking object |
| `booking:cancelled` | Server→Client | Booking object |
| `room-service:order_update` | Server→Client | Order status |
| `minibar:charge_added` | Server→Client | Charge details |
| `checkin:confirmed` | Server→Client | Check-in confirmation |
| `checkout:confirmed` | Server→Client | Check-out confirmation |

---

## Admin Panel Features

### Port: 3000 (via Next.js) | Tech: Next.js 14, Tailwind CSS

### Pages

#### Login Page (`/`)
- Email/password form
- "Login as Super Admin" button
- Error message display

#### Dashboard (`/dashboard`)
**KPI Cards:**
- Total Hotels (count)
- Total Bookings (count)
- Total Revenue (sum)
- Active Users (count)
- OTA Coin Liability (amount)
- REZ Coin Liability (amount)
- Pending Settlements (count)
- Mining Status (active/inactive)

**Quick Actions:**
- Add New Hotel
- View Pending Approvals
- Run Mining
- Create Settlement

#### Bookings Management (`/dashboard/bookings`)
- Searchable booking table
- Filters: Status, Date range, Hotel
- Columns: Booking ID, Guest, Hotel, Check-in, Check-out, Amount, Status, Actions
- Actions: View Detail, Cancel (if pending)
- Pagination

#### Hotels Management (`/dashboard/hotels`)
**All Hotels Tab:**
- Hotel cards with: Name, City, Category, Status, Rooms, Rating
- Actions: View, Edit, Suspend

**Onboarding Tab:**
- Pending hotel approvals
- Approve/Reject buttons
- Hotel details preview

**Suspended Tab:**
- Suspended hotels list
- Reactivate button

**Onboarding Form:**
- Hotel Name
- Owner Name
- Phone
- Email
- Address (street, city, state, pincode)
- Category (Budget/Standard/Premium/Luxury)
- Star Rating
- GST Number
- PAN Number
- Bank Account Details

#### Users Management (`/dashboard/users`)
- User list with search
- Columns: Name, Phone, Email, Tier, OTA Coins, REZ Coins, Bookings
- Actions: View, Update Tier, Manage Coins
- **Tier Management:** Bronze, Silver, Gold, Platinum
- **Coin Adjustment:** Add/Subtract OTA/REZ coins

#### Earn Rules (`/dashboard/earn-rules`)
- CRUD for earn rules
- Fields: Name, Description, Type (percentage/fixed), Value, Min Order, Max Cap
- Status toggle (active/inactive)
- Priority ordering

#### Burn Rules (`/dashboard/burn-rules`)
- CRUD for burn rules
- Fields: Name, Percentage, Max Burn Amount
- Status toggle

#### Coin Liability (`/dashboard/coin-liability`)
- Breakdown by: OTA Brand, REZ Brand, Individual Hotels
- Total liability display
- Export to CSV

#### Settlements (`/dashboard/settlements`)
- Pending settlements list
- Columns: Batch ID, Hotel, Amount, Coins, Status
- Actions: View Details, Approve, Reject
- **Batch Detail Modal:** Individual transactions

**History Tab:**
- Completed settlements
- Filters by date, hotel

#### Mining (`/dashboard/mining`)
- Ownership mining configuration
- Preview mining run (shows affected bookings)
- Execute Mining button
- Mining history log

#### Settings (`/dashboard/settings`)
- Platform name/logo
- Contact info
- Support email

#### Push Notifications (`/dashboard/notifications`)
- Create notification form
- Title, Body, Target (All/Hotel/Corporate)
- Schedule option
- Notification history

#### Audit Logs (`/dashboard/audit-logs`)
- All admin actions logged
- Filters: Action type, Admin, Date
- Columns: Timestamp, Admin, Action, Details

---

## Hotel Panel Features

### Port: 3000 (via Next.js) | Tech: Next.js 14, Tailwind CSS

### Pages

#### Login (`/`)
- Phone + OTP login for hotel staff
- Hotel selector (if multiple hotels)

#### Dashboard (`/dashboard`)
**Stats Cards:**
- Today's Check-ins (count)
- Tonight's Stay (count)
- Tomorrow's Check-outs (count)
- Revenue Today (amount)
- Pending Requests (count)
- Pending Feedback (count)

**Today's Timeline:**
- Check-in list with time
- Check-out list with time

**Quick Actions:**
- New Booking
- Manage Rooms
- View Feedback

#### Bookings (`/dashboard/bookings`)
- Tabs: Upcoming, Checked-in, Checked-out, Cancelled
- Booking cards with: Guest name, Room, Check-in/out, Status, Amount
- **Booking Detail:**
  - Guest info
  - Room assignment
  - Payment status
  - Check-in/Check-out buttons
  - Room service charges
  - Feedback status

**Check-in Flow:**
- Verify guest identity
- Assign room
- Confirm contact details
- Generate room QR

**Check-out Flow:**
- View all charges
- Minibar settlement
- Room service settlement
- Final payment
- Generate invoice

#### Rooms (`/dashboard/rooms`)
- Room grid/list view
- Room cards: Number, Type, Floor, Status
- **Status Colors:** Available (green), Occupied (blue), Dirty (orange), Maintenance (red)
- **Room Detail:**
  - Edit room info
  - Update status
  - View current guest
  - View history

**Room Types Management:**
- Add/Edit room types
- Fields: Name, Base Rate, Max Guests, Amenities, Images

#### Room Service (`/dashboard/room-service`)
**Menu Management:**
- Categories: Food, Beverages, Essentials, Minibar
- Add/Edit menu items
- Fields: Name, Price, Category, Available toggle, Image

**Orders List:**
- Tabs: New, Preparing, Ready, Delivered, Cancelled
- Order cards: Room, Items, Total, Time
- **Order Detail:** Items list, Status timeline, Update status

**Minibar Management:**
- Per-room minibar view
- Add/Remove items
- Auto-calculate charges
- Generate bill

#### Menu Management (`/dashboard/menu`)
- Restaurant menu builder
- Categories: Breakfast, Lunch, Dinner, Snacks, Beverages
- Item fields: Name, Description, Price, Image, Available
- Combo meals support

#### Reviews (`/dashboard/reviews`)
- All reviews list
- Filter by rating, date
- Review cards: Guest name, Rating, Comment, Date, Room
- Reply to review

#### Financials (`/dashboard/financials`)
- Revenue chart (daily/weekly/monthly)
- Breakdown by: Room, Room Service, Minibar
- Settlement status
- Payout history

#### Staff (`/dashboard/staff`)
- Staff list
- Add/Remove staff
- Role management: Admin, Receptionist, Housekeeping, Kitchen
- Staff attendance

#### Settings (`/dashboard/settings`)
- Hotel profile edit
- Contact information
- Check-in/Check-out times
- Cancellation policy

---

## Corporate Panel Features

### Port: 3000 (via Next.js) | Tech: Next.js 14, Tailwind CSS

### Pages

#### Login (`/`)
- Corporate email/password

#### Dashboard (`/dashboard`)
- Active bookings count
- Pending approvals count
- Total spend (month/year)
- Policy compliance %

#### Bookings (`/dashboard/bookings`)
**Pending Tab:**
- Bookings awaiting approval
- Approve/Reject buttons
- Reason for rejection

**Approved Tab:**
- Confirmed bookings
- Cancel option (with policy)

**All Tab:**
- Complete booking history

**Booking Request Form:**
- Hotel selection
- Check-in/Check-out dates
- Rooms count
- Guests count
- Purpose (Business/Travel)
- Special requests

#### Policy Management (`/dashboard/policy`)
- Spending limits per stay
- Allowed hotel categories
- Advance booking window
- Blackout dates
- Approval hierarchy

#### Employees (`/dashboard/employees`)
- Employee list
- Add/Remove employees
- Spending limits per employee
- Travel history

#### Reports (`/dashboard/reports`)
- Spend by month
- Spend by hotel
- Spend by employee
- Booking trends
- Export to PDF/CSV

#### Settings (`/dashboard/settings`)
- Company profile
- Logo upload
- Payment method
- Invoice preferences

---

## OTA Web Features

### Port: 3000 | Tech: Next.js 14, Tailwind CSS, Cookie sessions

### Pages

#### Home (`/`)
- Search bar: City, Check-in, Check-out, Rooms, Guests
- Featured hotels carousel
- Popular hotels grid
- Categories: Budget, Standard, Premium, Luxury
- Wallet balance display (OTA coins + REZ coins)

#### Search (`/search`)
- Search results list
- Filters: Category, Price range, Star rating, Amenities, Distance
- Sort: Price (low/high), Rating, Popularity
- Map view toggle
- Hotel cards: Image, Name, Rating, Price, OTA coin preview

#### Hotel Detail (`/hotel/:id`)
- Image gallery
- Hotel info: Name, Address, Rating, Category
- Amenities icons
- Room types with rates
- **Room Selection:**
  - Select room type
  - Select dates
  - Guest count
  - Price breakdown

#### Checkout (`/checkout`)
- Booking summary
- Guest details form
- **Payment Options:**
  - Pay Full (Razorpay)
  - Burn OTA Coins (discount)
  - Burn REZ Coins (discount)
- Coupon code input
- Apply button
- Confirm & Pay button

#### Booking Confirmation (`/booking/:id`)
- Success animation
- Booking details
- QR code (for digital key)
- Check-in instructions
- Contact hotel button

#### My Bookings (`/bookings`)
- Tabs: Upcoming, Past, Cancelled
- Booking cards with status badges
- **Status Colors:**
  - Hold (amber)
  - Confirmed (blue)
  - Checked-in (green)
  - Stayed (gray)
  - Cancelled (red)
- Booking detail view
- Cancel button (if eligible)

#### Wallet (`/wallet`)
- OTA Coin balance
- REZ Coin balance
- Coin value display
- Transaction history
- Earn/Burn activity

#### Profile (`/profile`)
- User info display
- Edit form: Name, Email, Phone
- Referral code display
- Referral stats

#### Stay Registration (`/register-stay`)
- Register non-booking stays
- Hotel name input
- Check-in/out dates
- Earn coins for registered stays

#### Rewards (`/rewards`)
- Tier progress bar
- Tier benefits
- Earn history
- Available rewards

#### Saved Hotels (`/saved`)
- Wishlist hotels
- Add/Remove from wishlist

#### Staff Portal (`/staff`)
- Staff login
- Check-in/Check-out forms
- Room assignment
- Room QR generation

---

## Mobile App Features

### Tech: React Native / Expo | Platforms: iOS, Android

### Screens

#### Splash & Onboarding
- App logo animation
- Permission requests (Notifications, Location)
- Feature highlights carousel

#### Authentication
- Phone input screen
- OTP verification
- REZ SSO option

#### Home (`/`)
- Search bar
- Featured hotels
- Categories grid
- Recent searches

#### Search (`/search`)
- Location search
- Date picker
- Filters sheet
- Results list

#### Hotel Detail (`/hotel/:id`)
- Image carousel with zoom
- Info section
- Room list with prices
- Reviews section
- Map location
- Save to wishlist

#### Booking Flow
- Date selection
- Guest details
- Room selection
- Payment (coins + Razorpay)
- Confirmation

#### My Trips (`/trips`)
- Upcoming bookings
- Past bookings
- Booking detail

#### Digital Key (`/key/:bookingId`)
- QR code display
- Large QR for scanning
- Room info
- Check-in/out info

#### Room Service (`/room-service/:bookingId`)
- Menu categories
- Item list
- Add to cart
- Cart summary
- Place order
- Order tracking

#### Wallet (`/wallet`)
- Balance display
- Transaction list
- Earn coins
- Burn coins

#### Profile (`/profile`)
- User info
- Tier badge
- Referral code
- Settings

#### Notifications (`/notifications`)
- Booking updates
- Promotions
- Stay reminders

#### Hotel Search Nearby
- GPS location
- Nearby hotels
- Distance sorting

---

## Business Flows

### Booking Flow

```
1. User searches hotel
        ↓
2. Select room type & dates
        ↓
3. Checkout page:
   - Guest details
   - Payment method selection
   - Coupon (optional)
        ↓
4. POST /bookings/hold
   - Creates inventory hold (10 min)
   - Creates Razorpay order
   - Simulates coin burn
   - Captures intent
        ↓
5. User completes payment on Razorpay
        ↓
6. POST /bookings/confirm
   - Verifies signature
   - Transitions to confirmed
   - Earns coins
   - Creates settlement entry
   - Sends confirmation
```

### Check-in Flow

```
1. Guest arrives at hotel
        ↓
2. Staff searches booking by ID/phone
        ↓
3. Staff verifies guest identity
        ↓
4. Staff assigns room
        ↓
5. POST /hotel/checkin/:id
   - Updates booking status
   - Assigns room
   - Generates QR
        ↓
6. Guest receives room QR
        ↓
7. Guest uses QR at room lock (digital key)
```

### Check-out Flow

```
1. Staff initiates checkout
        ↓
2. View all charges:
   - Room rate
   - Room service
   - Minibar
   - Other services
        ↓
3. Calculate total
        ↓
4. Apply any discounts
        ↓
5. Process payment (if additional)
        ↓
6. Generate invoice
        ↓
7. POST /hotel/checkout/:id
   - Updates booking status
   - Releases room
   - Marks room dirty
```

### Coin Flow

```
Earn Coins:
  Booking confirmed → Earn % of booking value
  Stay registered → Fixed coins
  Referral booking → Bonus coins
        ↓
Coin Wallet:
  OTA Coins (platform-wide)
  REZ Coins (REZ ecosystem)
        ↓
Burn Coins:
  New booking → Burn for discount
  1 OTA Coin = ₹1 discount
        ↓
Settlement:
  Hotel submits expenses
  Admin reviews
  Approves settlement
  Hotel receives payout
```

---

## Wallet & Loyalty System

### Coin Types

| Type | Earned From | Redeemable For | Validity |
|------|-------------|----------------|----------|
| OTA Coins | Booking, Referral | All bookings | 365 days |
| REZ Coins | REZ ecosystem | REZ services | 365 days |

### Tier System

| Tier | Requirement | Earn Multiplier | Burn Benefit |
|------|-------------|-----------------|-------------|
| Bronze | 0-999 coins | 1x | 1% extra |
| Silver | 1000-4999 coins | 1.25x | 2% extra |
| Gold | 5000-19999 coins | 1.5x | 3% extra |
| Platinum | 20000+ coins | 2x | 5% extra |

### Earn Rules (Admin Configurable)
- Percentage of booking value
- Minimum order amount
- Maximum cap per booking
- Category bonuses

### Burn Rules (Admin Configurable)
- Percentage of order value
- Maximum burn amount
- Burn ratio to INR

### Mining (Ownership)
- Periodic ownership mining
- Redistributes coin value to booking holders
- Based on stay recency and frequency

---

## Database Schema

### Users Table
```sql
users:
  - id (UUID, PK)
  - phone (VARCHAR, unique)
  - email (VARCHAR)
  - name (VARCHAR)
  - tier (ENUM: bronze/silver/gold/platinum)
  - ota_coin_balance (DECIMAL)
  - rez_coin_balance (DECIMAL)
  - referral_code (VARCHAR)
  - referred_by (UUID, FK → users)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Hotels Table
```sql
hotels:
  - id (UUID, PK)
  - name (VARCHAR)
  - slug (VARCHAR, unique)
  - owner_id (UUID, FK → users)
  - category (ENUM: budget/standard/premium/luxury)
  - star_rating (INT)
  - address (TEXT)
  - city (VARCHAR)
  - state (VARCHAR)
  - pincode (VARCHAR)
  - phone (VARCHAR)
  - email (VARCHAR)
  - gstin (VARCHAR)
  - pan (VARCHAR)
  - bank_account (JSONB)
  - amenities (TEXT[])
  - images (TEXT[])
  - status (ENUM: pending/active/suspended)
  - commission_rate (DECIMAL)
  - settlement_frequency (ENUM: daily/weekly/monthly)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Rooms Table
```sql
rooms:
  - id (UUID, PK)
  - hotel_id (UUID, FK → hotels)
  - room_type_id (UUID, FK → room_types)
  - room_number (VARCHAR)
  - floor (INT)
  - status (ENUM: available/occupied/dirty/maintenance)
  - created_at (TIMESTAMP)
```

### Room Types Table
```sql
room_types:
  - id (UUID, PK)
  - hotel_id (UUID, FK → hotels)
  - name (VARCHAR)
  - base_rate (DECIMAL)
  - max_guests (INT)
  - amenities (TEXT[])
  - images (TEXT[])
  - created_at (TIMESTAMP)
```

### Bookings Table
```sql
bookings:
  - id (UUID, PK)
  - booking_ref (VARCHAR, unique)
  - user_id (UUID, FK → users)
  - hotel_id (UUID, FK → hotels)
  - room_type_id (UUID, FK → room_types)
  - check_in (DATE)
  - check_out (DATE)
  - rooms_count (INT)
  - guests_count (INT)
  - guest_name (VARCHAR)
  - guest_phone (VARCHAR)
  - guest_email (VARCHAR)
  - status (ENUM: hold/confirmed/checked_in/stayed/cancelled)
  - total_amount (DECIMAL)
  - coin_discount (DECIMAL)
  - razorpay_amount (DECIMAL)
  - ota_coins_used (DECIMAL)
  - rez_coins_used (DECIMAL)
  - ota_coins_earned (DECIMAL)
  - checked_in_at (TIMESTAMP)
  - checked_out_at (TIMESTAMP)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Transactions Table
```sql
transactions:
  - id (UUID, PK)
  - user_id (UUID, FK → users)
  - type (ENUM: earn/burn/expire/adjustment)
  - coin_type (ENUM: ota/rez)
  - amount (DECIMAL)
  - balance_after (DECIMAL)
  - reference_type (VARCHAR)
  - reference_id (UUID)
  - description (TEXT)
  - created_at (TIMESTAMP)
```

### Menu Items Table
```sql
menu_items:
  - id (UUID, PK)
  - hotel_id (UUID, FK → hotels)
  - category (ENUM: food/beverages/essentials/minibar)
  - name (VARCHAR)
  - description (TEXT)
  - price (DECIMAL)
  - image (VARCHAR)
  - available (BOOLEAN)
  - created_at (TIMESTAMP)
```

### Room Service Orders Table
```sql
room_service_orders:
  - id (UUID, PK)
  - booking_id (UUID, FK → bookings)
  - room_id (UUID, FK → rooms)
  - status (ENUM: pending/preparing/ready/delivered/cancelled)
  - total_amount (DECIMAL)
  - notes (TEXT)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

### Minibar Charges Table
```sql
minibar_charges:
  - id (UUID, PK)
  - room_id (UUID, FK → rooms)
  - booking_id (UUID, FK → bookings)
  - item_name (VARCHAR)
  - quantity (INT)
  - unit_price (DECIMAL)
  - total (DECIMAL)
  - charged_at (TIMESTAMP)
  - charged_by (UUID, FK → users)
```

### Feedback Table
```sql
feedback:
  - id (UUID, PK)
  - booking_id (UUID, FK → bookings)
  - hotel_id (UUID, FK → hotels)
  - rating (INT, 1-5)
  - cleanliness (INT, 1-5)
  - service (INT, 1-5)
  - value (INT, 1-5)
  - comment (TEXT)
  - staff_reply (TEXT)
  - created_at (TIMESTAMP)
```

### Earn Rules Table
```sql
earn_rules:
  - id (UUID, PK)
  - name (VARCHAR)
  - description (TEXT)
  - type (ENUM: percentage/fixed)
  - value (DECIMAL)
  - min_order_amount (DECIMAL)
  - max_cap (DECIMAL)
  - tier_multiplier (JSONB)
  - active (BOOLEAN)
  - priority (INT)
  - created_at (TIMESTAMP)
```

### Settlements Table
```sql
settlements:
  - id (UUID, PK)
  - batch_id (VARCHAR)
  - hotel_id (UUID, FK → hotels)
  - period_start (DATE)
  - period_end (DATE)
  - gross_amount (DECIMAL)
  - commission (DECIMAL)
  - coin_liability (DECIMAL)
  - net_amount (DECIMAL)
  - status (ENUM: pending/approved/paid)
  - approved_by (UUID, FK → users)
  - approved_at (TIMESTAMP)
  - paid_at (TIMESTAMP)
  - created_at (TIMESTAMP)
```

### Corporations Table
```sql
corporations:
  - id (UUID, PK)
  - name (VARCHAR)
  - email (VARCHAR)
  - phone (VARCHAR)
  - address (TEXT)
  - gstin (VARCHAR)
  - status (ENUM: active/suspended)
  - created_at (TIMESTAMP)
```

### Corporate Policies Table
```sql
corporate_policies:
  - id (UUID, PK)
  - corporation_id (UUID, FK → corporations)
  - max_spend_per_stay (DECIMAL)
  - allowed_categories (TEXT[])
  - advance_days_required (INT)
  - approval_required (BOOLEAN)
  - blackout_dates (DATE[])
  - created_at (TIMESTAMP)
```

---

## Environment Configuration

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/stayown

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=<64-char-secret>
JWT_REFRESH_SECRET=<64-char-secret>

# Razorpay
RAZORPAY_KEY_ID=rzp_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# Session
SESSION_SECRET=<32-char-secret>

# API
API_URL=http://localhost:3000
WEB_URL=http://localhost:3001

# REZ Integration
REZ_AUTH_SERVICE_URL=http://localhost:4001
REZ_WALLET_SERVICE_URL=http://localhost:4002
REZ_MIND_URL=http://localhost:4008

# Coin Configuration
OTA_COIN_VALUE_PAISER=100  # 1 OTA coin = ₹1
REZ_COIN_VALUE_PAISER=100  # 1 REZ coin = ₹1
COIN_EXPIRY_DAYS=365

# Mining
MINING_ENABLED=true
MINING_FREQUENCY=daily
```

---

## Backend Services

### REZ HABIXO SERVICE (Habixo - Smart Living OS)

**Path:** `rez-habixo-service/`
**Tech Stack:** Node.js, Express, MongoDB, Redis, BullMQ, JWT, Sentry

**Description:** Hybrid rental platform combining Stay (hotels) + Rent (properties) + Match (roommates)

#### Properties API (`/api/habixo/properties`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Search Properties | `GET /api/habixo/properties` | Search with filters |
| Property Detail | `GET /api/habixo/properties/:id` | Get property details |
| Host Properties | `GET /api/habixo/properties/host/:hostId` | Host's properties |
| Create Property | `POST /api/habixo/properties` | Create listing |
| Update Property | `PUT /api/habixo/properties/:id` | Update listing |
| Activate | `POST /api/habixo/properties/:id/activate` | Go live |
| Deactivate | `POST /api/habixo/properties/:id/deactivate` | Take offline |
| Photos Upload | `POST /api/habixo/properties/:id/photos` | Upload photos |
| Presigned URL | `POST /api/habixo/properties/:id/photos/upload-url` | S3 upload |
| Delete Photo | `DELETE /api/habixo/properties/:id/photos/:photoId` | Remove photo |
| Reorder Photos | `PUT /api/habixo/properties/:id/photos/reorder` | Change order |
| Set Primary | `PUT /api/habixo/properties/:id/photos/:photoId/primary` | Main photo |
| Photo Caption | `PATCH /api/habixo/properties/:id/photos/:photoId` | Edit caption |

#### Bookings API (`/api/habixo/bookings`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Search Bookings | `GET /api/habixo/bookings` | List bookings |
| Booking Detail | `GET /api/habixo/bookings/:id` | Get details |
| Create Booking | `POST /api/habixo/bookings` | New booking |
| Cancel | `POST /api/habixo/bookings/:id/cancel` | Cancel booking |

#### Matching API (`/api/habixo/matching`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Property Matches | `GET /api/habixo/matching/property/:id` | Find roommates |
| User Matches | `GET /api/habixo/matching/user/:id` | Find properties |
| Roommate Profiles | `GET /api/habixo/matching/roommates` | Search roommates |
| Request Match | `POST /api/habixo/matching/request` | Send request |
| Accept Match | `POST /api/habixo/matching/:id/accept` | Accept request |
| Reject Match | `POST /api/habixo/matching/:id/reject` | Decline request |

#### Flatmates API (`/api/habixo/flatmates`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Profile | `GET /api/habixo/flatmates/profile/:userId` | Get profile |
| Create Profile | `POST /api/habixo/flatmates/profile` | Create profile |
| Update Profile | `PUT /api/habixo/flatmates/profile/:userId` | Update profile |
| Search | `GET /api/habixo/flatmates/search` | Find flatmates |

#### Trust & Safety API (`/api/habixo/trust`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| User Verification | `GET /api/habixo/trust/verify/:userId` | Check verification |
| Submit Document | `POST /api/habixo/trust/document` | Upload ID |
| Approve Document | `POST /api/habixo/trust/document/:id/approve` | Approve |
| Reject Document | `POST /api/habixo/trust/document/:id/reject` | Reject |
| Trust Score | `GET /api/habixo/trust/score/:userId` | Get trust score |

#### Availability API (`/api/habixo/availability`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Check Availability | `GET /api/habixo/availability/:propertyId` | Check dates |
| Block Dates | `POST /api/habixo/availability/block` | Block dates |
| Unblock Dates | `POST /api/habixo/availability/unblock` | Unblock dates |

#### Payments API (`/api/habixo/payments`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Create Payment | `POST /api/habixo/payments` | Initiate payment |
| Verify | `GET /api/habixo/payments/:id/verify` | Verify payment |
| Host Payout | `POST /api/habixo/payments/payout` | Pay host |

#### Reviews API (`/api/habixo/reviews`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Property Reviews | `GET /api/habixo/reviews/property/:propertyId` | All reviews |
| User Reviews | `GET /api/habixo/reviews/user/:userId` | User's reviews |
| Submit Review | `POST /api/habixo/reviews` | Add review |

#### Wishlist API (`/api/habixo/wishlist`)

| Feature | Endpoint | Description |
|---------|----------|-------------|
| List | `GET /api/habixo/wishlist` | User's wishlist |
| Add | `POST /api/habixo/wishlist` | Add property |
| Remove | `DELETE /api/habixo/wishlist/:propertyId` | Remove |

---

### REZ STAYOWN SERVICE (Hotel Booking)

**Path:** `rez-stayown-service/`
**Tech Stack:** Node.js, Express, MongoDB, Redis, JWT

**Description:** ReZ's own hotel booking platform

#### Core Endpoints

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Hotels | `GET /hotels` | List hotels |
| Hotel Detail | `GET /hotels/:id` | Hotel info |
| Hotel Search | `GET /hotels/search` | Search hotels |
| Room Types | `GET /hotels/:id/rooms` | Room types |
| Availability | `GET /hotels/:id/availability` | Check dates |
| Rates | `GET /hotels/:id/rates` | Get rates |

#### Bookings

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Hold Booking | `POST /bookings/hold` | Reserve slot |
| Confirm | `POST /bookings/confirm` | Confirm booking |
| Cancel | `POST /bookings/cancel` | Cancel booking |
| My Bookings | `GET /bookings/my` | User's bookings |

#### Room Management

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Room Status | `GET /rooms/status` | All rooms |
| Update Status | `PUT /rooms/:id/status` | Change status |
| Block Dates | `POST /rooms/block` | Block dates |

#### Authentication

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Send OTP | `POST /auth/otp/send` | Send OTP |
| Verify OTP | `POST /auth/otp/verify` | Verify & login |
| Hotel Staff | `POST /auth/hotel/staff` | Staff login |

#### Internationalization

| Feature | Description |
|---------|-------------|
| i18next | Multi-language support |
| react-i18next | React integration |

---

### REZ CHANNEL MANAGER SERVICE

**Path:** `rez-channel-manager-service/`
**Tech Stack:** Node.js, TypeScript

**Description:** Sync hotels with OTAs

#### Endpoints

| Feature | Endpoint | Description |
|---------|----------|-------------|
| List Channels | `GET /channels` | All channels |
| Connect | `POST /channels` | Add channel |
| Sync Inventory | `POST /inventory/sync` | Sync availability |
| Sync Rates | `POST /rates/sync` | Sync pricing |
| Reservations | `GET /reservations` | Get from channels |
| Update | `PUT /reservations/:id` | Update status |

---

### VERIFY SERVICE (Product Verification)

**Path:** `verify-service/`
**Tech Stack:** Next.js 14, Prisma, PostgreSQL, JWT, QRCode

#### Endpoints

| Feature | Endpoint | Description |
|---------|----------|-------------|
| Submit Product | `POST /api/products` | Submit for verification |
| Get Product | `GET /api/products/:id` | Get details |
| Update Status | `PUT /api/products/:id` | Update verification |
| List Products | `GET /api/products` | List all |
| QR Verify | `GET /api/verify/:code` | Scan QR code |
| Product Search | `GET /api/products/search` | Search products |

#### Features

| Feature | Description |
|---------|-------------|
| QR Code | Generate & scan verification codes |
| Status Flow | pending → verified → approved / rejected |
| Charts | Recharts for analytics |
| Admin Panel | Product verification dashboard |

---

### HOTEL PMS (Property Management System)

**Path:** `hotel-pms/`
**Tech Stack:** Node.js

#### Components

| Component | Description |
|-----------|-------------|
| hotel-management-master | Main PMS application |
| apps/ | Frontend apps |

---

### REZ CONNECTOR

**Path:** `services/REZConnector.js`
**Tech Stack:** JavaScript

**Description:** REZ ecosystem integration module

---

## Database Schema (PostgreSQL - Prisma)

### Additional Tables

```sql
// Staff table
staff:
  - id (UUID, PK)
  - hotel_id (UUID, FK)
  - name (VARCHAR)
  - phone (VARCHAR)
  - role (ENUM: admin/receptionist/housekeeping/kitchen)
  - email (VARCHAR)
  - password_hash (VARCHAR)
  - active (BOOLEAN)
  - created_at (TIMESTAMP)

// Room inventory
room_inventory:
  - id (UUID, PK)
  - room_id (UUID, FK)
  - date (DATE)
  - available (INT)
  - booked (INT)
  - blocked (INT)
  - rate (DECIMAL)

// Room rates
room_rates:
  - id (UUID, PK)
  - room_type_id (UUID, FK)
  - date (DATE)
  - rate (DECIMAL)
  - min_stay (INT)

// Corporate users
corporate_users:
  - id (UUID, PK)
  - corporation_id (UUID, FK)
  - name (VARCHAR)
  - email (VARCHAR)
  - phone (VARCHAR)
  - password_hash (VARCHAR)
  - spending_limit (DECIMAL)
  - active (BOOLEAN)

// Room QR codes
room_qr:
  - id (UUID, PK)
  - booking_id (UUID, FK)
  - room_id (UUID, FK)
  - qr_data (TEXT)
  - valid_from (TIMESTAMP)
  - valid_until (TIMESTAMP)
  - used (BOOLEAN)
  - used_at (TIMESTAMP)
```

---

## Habixo (MongoDB) Data Models

### Property Schema
```javascript
{
  propertyId: String,
  hostId: String,
  title: String,
  description: String,
  type: "hotel" | "apartment" | "room" | "shared",
  location: {
    address: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: { lat: Number, lng: Number }
  },
  amenities: [String],
  photos: [{ url: String, caption: String, primary: Boolean }],
  pricing: {
    basePrice: Number,
    currency: String
  },
  capacity: { beds: Number, guests: Number },
  rules: { smoking: Boolean, pets: Boolean, parties: Boolean },
  availability: { instantBook: Boolean },
  status: "active" | "inactive",
  verified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Booking Schema (Habixo)
```javascript
{
  bookingId: String,
  propertyId: String,
  guestId: String,
  hostId: String,
  checkIn: Date,
  checkOut: Date,
  guests: Number,
  totalPrice: Number,
  status: "pending" | "confirmed" | "cancelled" | "completed",
  paymentStatus: "pending" | "paid" | "refunded",
  createdAt: Date,
  updatedAt: Date
}
```

### Flatmate Profile Schema
```javascript
{
  profileId: String,
  userId: String,
  bio: String,
  budget: { min: Number, max: Number },
  location: { cities: [String], areas: [String] },
  preferences: {
    smoking: Boolean,
    pets: Boolean,
    cooking: Boolean,
    guests: Boolean
  },
  moveInDate: Date,
  occupation: String,
  age: Number,
  gender: String,
  verified: Boolean,
  trustScore: Number
}
```

### Matching Schema
```javascript
{
  matchId: String,
  type: "roommate" | "property",
  requesterId: String,
  targetId: String,
  status: "pending" | "accepted" | "rejected",
  compatibilityScore: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Trust Document Schema
```javascript
{
  documentId: String,
  userId: String,
  type: "id" | "address" | "employment",
  status: "pending" | "approved" | "rejected",
  documentUrl: String,
  verifiedAt: Date,
  verifiedBy: String,
  createdAt: Date
}
```

### Payment Schema (Habixo)
```javascript
{
  paymentId: String,
  bookingId: String,
  userId: String,
  amount: Number,
  currency: String,
  status: "pending" | "completed" | "failed" | "refunded",
  method: String,
  transactionRef: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Availability Schema
```javascript
{
  propertyId: String,
  date: Date,
  available: Boolean,
  price: Number,
  minStay: Number
}
```

### Review Schema (Habixo)
```javascript
{
  reviewId: String,
  bookingId: String,
  reviewerId: String,
  revieweeId: String,
  type: "property" | "guest" | "host",
  rating: Number,
  comment: String,
  photos: [String],
  createdAt: Date
}
```

### Wishlist Schema (Habixo)
```javascript
{
  wishlistId: String,
  userId: String,
  propertyId: String,
  createdAt: Date
}
```

---

## Shared Packages

### Database Package (`packages/database/`)

- Prisma schema
- Generated client
- Seed scripts

### Merchant SDK (`packages/merchant-sdk/`)

```typescript
// Usage
import { StayOwnSDK } from '@stayown/merchant-sdk';

const sdk = new StayOwnSDK({
  apiKey: 'your-api-key',
  hotelId: 'your-hotel-id'
});

// Bookings
await sdk.bookings.create(bookingData);
await sdk.bookings.list(filters);
await sdk.bookings.cancel(id);

// Inventory
await sdk.inventory.check(date, roomTypeId);
await sdk.inventory.update(date, roomTypeId, count);

// Rates
await sdk.rates.get(date, roomTypeId);
await sdk.rates.set(date, roomTypeId, rate);
```

---

## Integration Points

### REZ Ecosystem Integration

| Service | Integration | Purpose |
|---------|-------------|---------|
| Auth Service | `REZ_AUTH_SERVICE_URL` | User authentication |
| Wallet Service | `REZ_WALLET_SERVICE_URL` | REZ coin management |
| Intent Graph | `REZ_MIND_URL` | User intent tracking |
| Notification Hub | `NOTIFICATIONS_URL` | Push notifications |

### External Integrations

| Service | Integration | Purpose |
|---------|-------------|---------|
| Razorpay | Payment gateway | Payment processing |
| SendGrid | Email service | Transactional emails |
| Twilio | SMS service | OTPs, notifications |
| AWS S3 | File storage | Hotel images, documents |

---

## Feature Status Summary

| Feature | Status | Notes |
|----------|--------|-------|
| OTP Auth | ✅ Implemented | Rate-limited |
| REZ SSO | ✅ Implemented | Full integration |
| Booking Hold | ✅ Implemented | 10-min expiry |
| Booking Confirm | ✅ Implemented | State machine |
| Room QR | ✅ Implemented | Digital key |
| Room Service | ✅ Implemented | Full CRUD |
| Minibar | ✅ Implemented | Per-room |
| Wallet | ✅ Implemented | Dual coin |
| Loyalty Tiers | ✅ Implemented | 4 tiers |
| Earn Rules | ✅ Implemented | Admin CRUD |
| Burn Rules | ✅ Implemented | Admin CRUD |
| Settlements | ✅ Implemented | Admin approval |
| Mining | ✅ Implemented | Ownership |
| Corporate | ⚠️ Partial | Incomplete UI |
| Push Notifications | ✅ Implemented | Broadcast |
| Channel Manager | ✅ Implemented | Inventory sync |
| Product Verification | ✅ Implemented | QR-based |

---

**Document End**

*Last updated: May 13, 2026*
