# StayOwn-Hospitality Deployment Checklist

## Pre-Deployment

### 1. Generate Secure Secrets
```bash
# JWT Secret
openssl rand -base64 64

# Room QR JWT Secret
openssl rand -base64 64

# Internal Service Token
openssl rand -hex 32
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

| Service | Required Variables |
|---------|------------------|
| **rez-stayown-service** | `JWT_SECRET`, `ROOM_QR_JWT_SECRET`, `MONGODB_URI`, `FACEBOOK_APP_SECRET`, `INTERNAL_SERVICE_TOKENS_JSON` |
| **verify-service** | `JWT_SECRET`, `DATABASE_URL`, `INTERNAL_SERVICE_KEY`, `REZ_MIND_URL`, `INTENT_CAPTURE_URL` |
| **rez-channel-manager** | `MONGODB_URI`, `INTERNAL_SERVICE_TOKENS_JSON`, Channel API keys |
| **rez-habixo-service** | `JWT_SECRET`, `HASH_SECRET`, `MONGODB_URI`, `INTERNAL_SERVICE_TOKEN`, `RAZORPAY_KEY_SECRET` |

### 3. ReZ Mind & Intent Graph Configuration

All services connect to ReZ Mind for AI intelligence:

```
REZ_MIND_URL=https://rez-mind.onrender.com (production)
REZ_INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com (production)
```

**verify-service** sends:
- Product verification events
- Fraud signals
- Intent capture

**rez-stayown-service** sends:
- Room QR generation events
- Booking events
- Checkout events
- Service order events

**rez-habixo-service** sends:
- Stay/Rent/Match search events
- Wishlist events
- Booking fulfilled events

### 4. Redis Configuration

Required for rate limiting across services:
```
REDIS_URL=redis://localhost:6379 (development)
REDIS_URL=redis://your-redis-host:6379 (production)
```

### 5. Webhook Secrets

Configure for payment and notification webhooks:

| Service | Secret Variable |
|---------|---------------|
| WhatsApp | `FACEBOOK_APP_SECRET` |
| Room QR | `ROOM_QR_WEBHOOK_SECRET` |
| PMS | `PMS_WEBHOOK_SECRET` |
| Razorpay | `RAZORPAY_KEY_SECRET` |

## Service Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                    ReZ Intent Graph                          │
│              (User Intent & Commerce Memory)                  │
│         https://rez-intent-graph.onrender.com               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      ReZ Mind                               │
│              (Event Tracking & Analytics)                   │
│              https://rez-mind.onrender.com                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  verify-     │    │   rez-       │    │   rez-        │
│  service     │    │   stayown-    │    │   habixo-     │
│              │    │   service    │    │   service     │
│  - Fraud     │    │              │    │              │
│    detection │    │  - Bookings  │    │  - Matching   │
│  - Rewards   │    │  - Room QR   │    │  - Payments   │
│  - Karma     │    │  - Checkout  │    │  - Wishlists  │
└───────────────┘    └───────────────┘    └───────────────┘
                              │
                              ▼
              ┌─────────────────────────────────┐
              │           Redis                  │
              │    (Rate Limiting & Caching)    │
              └─────────────────────────────────┘
```

## Build & Deploy

### 1. rez-stayown-service
```bash
cd rez-stayown-service
npm install
npm run build
# Deploy to Render/Railway/etc.
```

### 2. verify-service
```bash
cd verify-service
npm install
npm run build
# Deploy to Vercel/Node server
```

### 3. rez-channel-manager
```bash
cd rez-channel-manager-service
npm install
npm run build
# Deploy to Render/Railway/etc.
```

### 4. rez-habixo-service
```bash
cd rez-habixo-service
npm install
npm run build
# Deploy to Render/Railway/etc.
```

## Security Checklist

- [ ] All `JWT_SECRET` values are unique and secure
- [ ] `INTERNAL_SERVICE_TOKEN` matches across services
- [ ] `FACEBOOK_APP_SECRET` configured for webhook verification
- [ ] `RAZORPAY_WEBHOOK_SECRET` configured
- [ ] CORS origins configured for production domains
- [ ] HTTPS enforced (check `x-forwarded-proto`)
- [ ] Rate limiting enabled in production
- [ ] No `.env` files committed to git

## Monitoring

- [ ] Sentry DSN configured for error tracking
- [ ] Health check endpoints verified:
  - `/health/live` - Liveness probe
  - `/health/ready` - Readiness probe
  - `/health/detailed` - Detailed status

## Post-Deployment

1. **Verify webhook endpoints** are accessible
2. **Test authentication** on protected routes
3. **Test rate limiting** is working
4. **Verify ReZ Mind connection** - check logs for event sends
5. **Monitor error rates** in Sentry

## Environment Variables Reference

### rez-stayown-service (.env)
```
PORT=4016
JWT_SECRET=<generated>
ROOM_QR_JWT_SECRET=<generated>
MONGODB_URI=<production-uri>
REDIS_URL=<production-redis>
FACEBOOK_APP_SECRET=<from-meta>
INTERNAL_SERVICE_TOKENS_JSON={"service-name":"<token>"}
REZ_MIND_URL=https://rez-mind.onrender.com
REZ_INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com
```

### verify-service (.env)
```
DATABASE_URL=<postgresql-uri>
JWT_SECRET=<generated>
INTERNAL_SERVICE_KEY=<generated>
REZ_MIND_URL=https://rez-mind.onrender.com
INTENT_CAPTURE_URL=https://rez-intent-graph.onrender.com
```

### rez-habixo-service (.env)
```
PORT=3007
JWT_SECRET=<generated>
HASH_SECRET=<generated>
MONGODB_URI=<production-uri>
INTERNAL_SERVICE_TOKEN=<generated>
REZ_INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com
RAZORPAY_KEY_SECRET=<from-razorpay>
```
