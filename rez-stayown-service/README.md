# REZ Hotel Service

Hotel booking and OTA (Online Travel Agency) microservice integrating with Makcorps API.

## Purpose

The Hotel Service manages:
- Hotel search and discovery
- Room availability
- Booking management
- Payment processing for hotels
- Guest services (Room QR)
- Integration with Makcorps hotel inventory

## Environment Variables

```env
# Service
PORT=4011
NODE_ENV=production

# CORS
CORS_ORIGIN=https://admin.rez.money,https://rez-app.vercel.app

# Makcorps API
MAKCORPS_API_URL=https://api.makcorps.com
MAKCORPS_API_KEY=your_api_key_here
MAKCORPS_CLIENT_ID=your_client_id
MAKCORPS_CLIENT_SECRET=your_client_secret

# Internal Service Auth
INTERNAL_SERVICE_TOKEN=your_internal_token_here
```

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Production build
npm run build

# Start production server
npm start
```

## API Endpoints

### Hotels

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/hotels/search | Search hotels |
| GET | /api/hotels/:propertyId | Hotel details |
| GET | /api/hotels/:propertyId/availability | Room availability |
| GET | /api/hotels/:propertyId/reviews | Get hotel reviews |

### Bookings

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/hotels/bookings | Create booking |
| GET | /api/hotels/bookings | List bookings |
| GET | /api/hotels/bookings/:bookingId | Get booking details |
| POST | /api/hotels/bookings/:bookingId/cancel | Cancel booking |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |

## Room QR Feature

Guests can scan QR codes in their rooms to access:
- Room service ordering
- Housekeeping requests
- Checkout procedures
- Local information
- Guest feedback

Intent captured: `guest_services_scan`

## Data Models

### Hotel
```typescript
{
  hotelId: string;
  makcorpsId: string;
  name: string;
  description: string;
  address: Address;
  images: string[];
  amenities: string[];
  rating: number;
  reviewCount: number;
  priceRange: { min: number; max: number };
  available: boolean;
}
```

### Room
```typescript
{
  roomId: string;
  hotelId: string;
  type: string;
  description: string;
  capacity: number;
  price: number;
  amenities: string[];
  images: string[];
  available: boolean;
}
```

### Booking
```typescript
{
  bookingId: string;
  userId: string;
  hotelId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  totalAmount: number;
  paymentId?: string;
  createdAt: Date;
}
```

## Partner Integration

### Makcorps API
- Real-time inventory sync
- Booking synchronization
- Payment settlement

## Deployment

### Render.com
1. Connect GitHub repository
2. Build command: `npm run build`
3. Start command: `npm start`
4. Configure Makcorps credentials

### Docker
```bash
docker build -t rez-hotel-service .
docker run -p 4011:4011 --env-file .env rez-hotel-service
```

## Related Services

- **rez-payment-service** - Payment processing
- **rez-corpperks-service** - Corp bookings
- **rez-order-service** - Room service orders

## License

MIT
