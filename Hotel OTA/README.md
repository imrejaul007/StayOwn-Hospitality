# Hotel OTA

> **Hotel booking platform with QR-based guest services**

---

## Overview

Hotel OTA is a Next.js application for hotel bookings and guest services, featuring:

- **Hotel Search & Booking** - Search hotels, view details, make reservations
- **Room Service** - QR-based service requests and checkout
- **Restaurant Ordering** - Menu QR for table ordering
- **Payment Integration** - Razorpay for secure payments

---

## Features

### Booking Module

| Feature | Description |
|---------|-------------|
| Hotel Search | Search by location, dates, guests |
| Hotel Details | Photos, amenities, reviews |
| Room Selection | Multiple room types and pricing |
| Booking Flow | Guest info, payment, confirmation |
| Booking Management | View/cancel upcoming bookings |

### Guest Services (Room QR)

| Feature | Description |
|---------|-------------|
| Service Requests | Housekeeping, maintenance, room service |
| Minibar Charges | Add charges to room |
| Checkout | Pay all charges at once |
| Digital Key | Room access via QR (future) |

### Restaurant Module

| Feature | Description |
|---------|-------------|
| Table QR | Scan to view menu |
| Digital Menu | Categories, items, prices |
| Cart & Order | Add items, place order |
| Kitchen Display | Orders appear in kitchen |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (database)
- Razorpay account (payments)
- MakCorps API key (hotel search)

### Installation

```bash
cd "Hotel OTA"
npm install
```

### Configuration

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret

# MakCorps (Hotel Search)
MAKCORPS_API_KEY=your-api-key

# ReZ Services
REZ_AUTH_URL=http://localhost:3001
REZ_WALLET_URL=http://localhost:3002
REZ_PAYMENT_URL=http://localhost:3003
REZ_MERCHANT_URL=http://localhost:3004

# Internal
INTERNAL_SERVICE_TOKEN=your-internal-token
```

### Run Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
Hotel OTA/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home/search
│   │   ├── hotels/
│   │   │   ├── [id]/             # Hotel details
│   │   │   └── [id]/book/       # Booking flow
│   │   ├── booking/
│   │   │   ├── confirmation/    # Booking success
│   │   │   └── manage/          # View/cancel
│   │   ├── restaurant/
│   │   │   ├── menu/            # Table menu view
│   │   │   ├── cart/            # Cart management
│   │   │   └── checkout/        # Payment
│   │   ├── services/
│   │   │   ├── request/         # Service request form
│   │   │   └── checkout/        # Room checkout
│   │   └── api/
│   │       ├── hotels/
│   │       ├── booking/
│   │       ├── restaurant/
│   │       └── services/
│   │
│   ├── components/
│   │   ├── HotelCard.tsx
│   │   ├── RoomCard.tsx
│   │   ├── MenuItem.tsx
│   │   ├── Cart.tsx
│   │   ├── QRScanner.tsx
│   │   └── PaymentForm.tsx
│   │
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── razorpay.ts
│   │   ├── makcorps.ts
│   │   └── api.ts
│   │
│   └── types/
│       ├── hotel.ts
│       ├── booking.ts
│       ├── menu.ts
│       └── service.ts
│
├── public/
│   ├── images/
│   └── fonts/
│
├── supabase/
│   └── migrations/              # Database schema
│
├── package.json
└── README.md
```

---

## QR Code Formats

### Table QR (Restaurant)
```
rez://menu/{merchantId}?table={tableId}
```

### Room QR (Services)
```
rez://room/{roomId}?token={encryptedToken}
```

### Booking QR
```
rez://booking/{bookingId}
```

---

## API Endpoints

### Hotels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hotels/search` | Search hotels |
| GET | `/api/hotels/:id` | Hotel details |
| GET | `/api/hotels/:id/rooms` | Available rooms |
| GET | `/api/hotels/:id/reviews` | Guest reviews |

### Booking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/booking` | Create booking |
| GET | `/api/booking/:id` | Get booking |
| PUT | `/api/booking/:id/cancel` | Cancel booking |
| GET | `/api/booking/user/:userId` | User bookings |

### Restaurant

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/restaurant/:merchantId/menu` | Get menu |
| POST | `/api/restaurant/order` | Place order |
| GET | `/api/restaurant/order/:id` | Order status |

### Room Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/services/request` | Submit request |
| GET | `/api/services/room/:roomId` | Room requests |
| POST | `/api/services/charge` | Add charge |
| POST | `/api/services/checkout` | Process checkout |

---

## Database Tables

### hotels
```sql
CREATE TABLE hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  star_rating INTEGER,
  amenities JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### bookings
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID REFERENCES hotels(id),
  user_id UUID,
  room_id VARCHAR(50),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER DEFAULT 1,
  total_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',
  payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### restaurant_orders
```sql
CREATE TABLE restaurant_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  table_id VARCHAR(50),
  items JSONB NOT NULL,
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Payment Flow

1. User completes booking/order form
2. Server creates Razorpay order
3. Frontend shows Razorpay checkout
4. User completes payment
5. Webhook confirms payment
6. Booking/Order status updated

```typescript
// Payment callback
const handlePaymentSuccess = async (paymentId: string) => {
  await api.post('/api/booking/confirm', {
    bookingId,
    paymentId,
  });
};
```

---

## Testing

```bash
# Run integration tests
npx tsx ../scripts/test-qr-integration.ts

# Test hotel search
curl "http://localhost:3000/api/hotels/search?city=Mumbai"

# Test booking flow
npx playwright test
```

---

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Required environment variables in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `MAKCORPS_API_KEY`
- `REZ_AUTH_URL`
- `REZ_WALLET_URL`
- `REZ_PAYMENT_URL`

---

## Related Documentation

- [QR Systems Complete Guide](../docs/QR-SYSTEMS-COMPLETE-GUIDE.md)
- [Quick Start Guide - Room QR](../docs/QUICK-START/ROOM-QR.md)
- [Quick Start Guide - Menu QR](../docs/QUICK-START/MENU-QR.md)
- [Environment Variables](../docs/ENV-VARIABLES.md)
- [Deployment Guide](../docs/DEPLOYMENT-GUIDE.md)

---

**Powered by ReZ Mind** - AI-powered commerce intelligence
