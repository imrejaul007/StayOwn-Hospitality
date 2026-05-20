# REZ Hotel Service

**Hotel booking, OTA, and Room QR services** - v2.0

Integrating with Makcorps API for hotel inventory.

---

## Features (v2.0)

| Feature | Description |
|---------|-------------|
| Hotel Search | Search hotels and availability |
| Room Booking | Book rooms with payment processing |
| Room QR | Hotel guest services via QR codes |
| Service Requests | Housekeeping, room service, maintenance |
| ML Recommendations | AI-powered room suggestions |
| Guest Preferences | Save and learn guest preferences |
| Analytics | Hotel and guest analytics |
| RABTUL Integration | Auth, Payment, Wallet, Care |

### Room QR Services
| Service | Description |
|---------|-------------|
| Housekeeping | Request cleaning |
| Room Service | Order food/beverages |
| Maintenance | Report issues |
| Concierge | Special requests |
| Checkout | Express checkout |

---

## Architecture

```
REZ Hotel Service
├── Hotel Booking (Makcorps API)
├── Room Management
├── Room QR
│   ├── QR Scanning
│   ├── Service Requests
│   ├── Guest Preferences
│   └── ML Recommendations
├── Analytics
└── RABTUL Integration
```

---

## API Reference

### Room QR APIs
```bash
GET  /api/rooms/recommend         # ML room recommendations
POST /api/rooms/preferences       # Save guest preferences
POST /api/service-request         # Create service request
GET  /api/service-request/:id     # Get request status
GET  /api/service-requests        # List requests
POST /api/service-request/:id/assign  # Assign request
```

### Analytics
```bash
GET /api/analytics/room-qr         # Room QR analytics
GET /api/analytics/guest-insights   # Guest insights
```

### Support
```bash
POST /api/support/ticket             # Create support ticket
```

---

## Deployment

### Docker
```bash
docker build -t room-qr-service .
docker run -p 4016:4016 room-qr-service
```

### Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
```

---

## Environment Variables

```bash
PORT=4016
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/rez-hotel
REDIS_URL=redis://localhost:6379

# Makcorps API
MAKCORPS_API_URL=https://api.makcorps.com
MAKCORPS_API_KEY=your_api_key

# RABTUL Services
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
CARE_SERVICE_URL=https://REZ-care.onrender.com
```

---

## Testing

```bash
npm test
```

---

## Documentation

- Room QR APIs in `src/room-qr.ts`
- Integration: Uses centralized RABTUL integration
