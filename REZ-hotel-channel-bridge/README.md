# REZ Hotel Channel Bridge

A comprehensive Hotel-to-Channel Manager integration service for StayOwn Hospitality, enabling bi-directional synchronization of inventory, pricing, and bookings across multiple OTA channels.

## Features

- **Multi-Channel Management**: Connect to multiple OTA channels (Booking.com, Expedia, Hotels.com, Airbnb, Agoda, custom)
- **Bi-directional Availability Sync**: Real-time inventory synchronization
- **Rate Plan Synchronization**: Unified rate management across channels
- **Booking Import**: Automatic import of reservations from connected channels
- **Channel-Specific Configurations**: Per-channel API credentials and mapping rules
- **Automatic Sync Scheduling**: Configurable sync intervals for inventory and pricing
- **Webhook Support**: Real-time notifications for booking updates
- **Audit Logging**: Complete sync history and error tracking

## Architecture

```
                                    ┌──────────────────┐
                                    │   StayOwn PMS    │
                                    │  (Property Mgmt)│
                                    └────────┬─────────┘
                                             │
┌─────────────┐    ┌─────────────────────────┼─────────────────────────┐
│ Booking.com │    │     REZ Hotel Channel Bridge                       │
│ Expedia     │◄──►│  ┌─────────────┐  ┌─────────────┐                │
│ Hotels.com  │    │  │ Inventory   │  │  Pricing    │                │
│ Airbnb      │    │  │   Sync      │  │   Sync      │                │
│ Agoda       │    │  └──────┬──────┘  └──────┬──────┘                │
│ Custom      │    │         │                  │                       │
└─────────────┘    │  ┌──────┴──────┐  ┌──────┴──────┐                │
                   │  │   Channel   │  │   Booking   │                │
                   │  │  Manager    │  │   Import    │                │
                   │  └─────────────┘  └─────────────┘                │
                   └────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- npm or yarn

## Installation

```bash
cd REZ-hotel-channel-bridge
npm install
```

## Configuration

Create a `.env` file in the root directory:

```bash
# Server
PORT=4042
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-hotel-channel-bridge

# Security
INTERNAL_SERVICE_TOKEN=your-secret-token-here

# Redis (optional, for job queue)
REDIS_URL=redis://localhost:6379

# Sync Intervals (in minutes)
INVENTORY_SYNC_INTERVAL=15
PRICING_SYNC_INTERVAL=30
BOOKING_IMPORT_INTERVAL=5

# Sync Settings
SYNC_BATCH_SIZE=100
SYNC_MAX_RETRIES=3
SYNC_RETRY_DELAY=5000
```

## Running the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t rez-hotel-channel-bridge .
docker run -p 4042:4042 --env-file .env rez-hotel-channel-bridge
```

## API Reference

All API endpoints require the `X-Internal-Token` header for authentication.

### Health Check

```
GET /health
```

### Channel Management

#### Register a Channel

```bash
POST /api/channels
Content-Type: application/json
X-Internal-Token: your-token

{
  "channelType": "booking_com",
  "name": "Booking.com Main",
  "apiEndpoint": "https://supply-api.booking.com",
  "apiKey": "your-api-key",
  "propertyId": "hotel-123",
  "webhookUrl": "https://your-domain.com/webhooks/booking"
}
```

#### Get Hotel Channels

```bash
GET /api/channels?hotelId=hotel-123
X-Internal-Token: your-token
```

#### Update Channel

```bash
PUT /api/channels/:channelId
Content-Type: application/json
X-Internal-Token: your-token

{
  "isActive": true,
  "webhookUrl": "https://new-webhook-url.com"
}
```

#### Test Channel Connection

```bash
POST /api/channels/:channelId/test
X-Internal-Token: your-token
```

### Room Mappings

#### Create Room Mapping

```bash
POST /api/rooms/mappings
Content-Type: application/json
X-Internal-Token: your-token

{
  "hotelId": "hotel-123",
  "channelId": "channel-uuid",
  "internalRoomId": "std-001",
  "channelRoomId": "BKC-STD-001",
  "roomType": "standard",
  "syncAvailability": true,
  "syncPricing": true,
  "syncRestrictions": true
}
```

#### Get Room Mappings

```bash
GET /api/rooms/mappings?hotelId=hotel-123&channelId=channel-uuid
X-Internal-Token: your-token
```

### Inventory Management

#### Update Inventory

```bash
POST /api/inventory
Content-Type: application/json
X-Internal-Token: your-token

{
  "hotelId": "hotel-123",
  "roomMappingId": "mapping-uuid",
  "date": "2024-03-15",
  "availableRooms": 5,
  "totalRooms": 10,
  "minStay": 2,
  "maxStay": 14,
  "closedToArrival": false,
  "closedToDeparture": false
}
```

#### Bulk Update Inventory

```bash
POST /api/inventory/bulk
Content-Type: application/json
X-Internal-Token: your-token

{
  "updates": [
    {
      "hotelId": "hotel-123",
      "roomMappingId": "mapping-uuid",
      "date": "2024-03-15",
      "availableRooms": 5,
      "totalRooms": 10
    },
    {
      "hotelId": "hotel-123",
      "roomMappingId": "mapping-uuid",
      "date": "2024-03-16",
      "availableRooms": 6,
      "totalRooms": 10
    }
  ]
}
```

#### Get Inventory

```bash
GET /api/inventory?hotelId=hotel-123&startDate=2024-03-01&endDate=2024-03-31
X-Internal-Token: your-token
```

#### Sync Inventory to Channel

```bash
POST /api/inventory/sync/:channelId
Content-Type: application/json
X-Internal-Token: your-token

{
  "hotelId": "hotel-123",
  "startDate": "2024-03-01",
  "endDate": "2024-03-31"
}
```

### Pricing Management

#### Update Pricing

```bash
POST /api/pricing
Content-Type: application/json
X-Internal-Token: your-token

{
  "hotelId": "hotel-123",
  "roomMappingId": "mapping-uuid",
  "date": "2024-03-15",
  "roomType": "standard",
  "rates": [
    {
      "ratePlanId": "standard-rate",
      "currency": "USD",
      "baseRate": 100.00,
      "taxes": 12.00,
      "fees": 5.00,
      "totalRate": 117.00,
      "minLos": 1,
      "maxLos": 14
    }
  ]
}
```

#### Calculate Stay Price

```bash
GET /api/pricing/calculate?hotelId=hotel-123&roomMappingId=mapping-uuid&checkIn=2024-03-15&checkOut=2024-03-18&ratePlanId=standard-rate
X-Internal-Token: your-token
```

#### Sync Pricing to Channel

```bash
POST /api/pricing/sync/:channelId
Content-Type: application/json
X-Internal-Token: your-token

{
  "hotelId": "hotel-123",
  "startDate": "2024-03-01",
  "endDate": "2024-03-31"
}
```

### Booking Management

#### Import Booking

```bash
POST /api/bookings/import
Content-Type: application/json
X-Internal-Token: your-token

{
  "channelId": "channel-uuid",
  "externalBookingId": "BKC-123456",
  "hotelId": "hotel-123",
  "internalRoomId": "std-001",
  "guestName": {
    "first": "John",
    "last": "Doe"
  },
  "guestEmail": "john.doe@example.com",
  "guestPhone": "+1234567890",
  "checkIn": "2024-03-15",
  "checkOut": "2024-03-18",
  "totalGuests": 2,
  "rooms": [
    {
      "roomMappingId": "mapping-uuid",
      "roomType": "standard",
      "ratePlanId": "standard-rate",
      "nightlyRate": 117.00,
      "totalNights": 3,
      "totalAmount": 351.00
    }
  ],
  "totalAmount": 351.00,
  "currency": "USD",
  "status": "confirmed",
  "specialRequests": "Late check-in"
}
```

#### Get Bookings

```bash
GET /api/bookings?hotelId=hotel-123&startDate=2024-03-01&endDate=2024-03-31
X-Internal-Token: your-token
```

#### Update Booking Status

```bash
PATCH /api/bookings/:bookingId/status
Content-Type: application/json
X-Internal-Token: your-token

{
  "status": "cancelled"
}
```

## Channel Types

| Type | Description |
|------|-------------|
| `booking_com` | Booking.com |
| `expedia` | Expedia |
| `hotels_com` | Hotels.com |
| `airbnb` | Airbnb |
| `agoda` | Agoda |
| `custom` | Custom channel API |

## Room Types

| Type | Description |
|------|-------------|
| `standard` | Standard Room |
| `deluxe` | Deluxe Room |
| `suite` | Suite |
| `presidential_suite` | Presidential Suite |
| `family` | Family Room |
| `accessible` | Accessible Room |

## Booking Status

| Status | Description |
|--------|-------------|
| `pending` | Booking pending confirmation |
| `confirmed` | Booking confirmed |
| `cancelled` | Booking cancelled |
| `no_show` | Guest did not check in |
| `completed` | Stay completed |

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Missing authentication token |
| `INVALID_TOKEN` | Invalid authentication token |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## Monitoring

### Metrics Endpoint

```bash
GET /metrics
```

### Sync Status

```bash
GET /api/inventory/sync/status?hotelId=hotel-123
GET /api/pricing/sync/status?hotelId=hotel-123
```

### Channel Statistics

```bash
GET /api/channels/:channelId/stats
```

## Webhooks

Configure webhook URLs in channel settings to receive real-time notifications:

### Supported Events

- `booking.created` - New booking imported
- `booking.updated` - Booking status changed
- `booking.cancelled` - Booking cancelled

### Webhook Payload

```json
{
  "event": "booking.created",
  "timestamp": "2024-03-15T10:30:00Z",
  "data": {
    "bookingId": "booking-uuid",
    "channelId": "channel-uuid",
    "externalBookingId": "BKC-123456",
    "hotelId": "hotel-123",
    "status": "confirmed"
  }
}
```

## Testing

```bash
npm test
```

## License

Proprietary - StayOwn Hospitality
