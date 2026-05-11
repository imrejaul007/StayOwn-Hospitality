# REZ OTA Integration — Required Environment Variables

Add these to your PMS backend `.env` file:

```env
# ── Hotel OTA Integration ─────────────────────────────────────────────────────
# Hotel OTA API base URL (no trailing slash)
REZ_OTA_API_URL=https://your-hotel-ota-api.onrender.com

# Shared secret: PMS uses this as x-internal-token when calling Hotel OTA
REZ_OTA_INTERNAL_TOKEN=shared-internal-token-ota-to-pms

# Hotel OTA uses this to sign webhooks it sends to PMS
# PMS verifies it on POST /api/v1/ota-webhooks/rez-ota
REZ_OTA_WEBHOOK_SECRET=shared-secret-between-ota-and-pms

# ── REZ Auth Service (for PMS SSO via REZ token) ─────────────────────────────
REZ_AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
INTERNAL_SERVICE_TOKEN=shared-internal-token-between-rez-services
```

## How the integration works

```
Hotel OTA (confirm booking) ──webhook──▶ PMS  POST /api/v1/ota-webhooks/rez-ota
Hotel OTA (cancel booking)  ──webhook──▶ PMS  POST /api/v1/ota-webhooks/rez-ota

PMS (guest checkout)  ──API──▶ Hotel OTA  POST /v1/partner/pms/coins/earn
PMS (inventory change)──API──▶ Hotel OTA  PUT  /v1/partner/pms/inventory/:hotelId/:roomTypeId/:date

REZ User login to PMS  ──verifies via──▶ REZ Auth Service  GET /auth/validate
                                          GET /internal/auth/user/:userId
```

## Hotel model — link PMS hotel to OTA hotel

Add this field to the Hotel document in PMS:

```js
otaConnections: {
  rezOta: {
    hotelId: 'ota-hotel-uuid-here',  // UUID from Hotel OTA hotels table
    isEnabled: true,
    lastSync: null,
  }
}
```

The rezOtaConnector looks up PMS hotels via `otaConnections.rezOta.hotelId`.
