# REZ ↔ Hotel OTA Integration Summary

## Overview
Successfully integrated Hotel OTA with REZ platform for single sign-on (SSO), shared wallet, and unified profile management.

## What Was Implemented

### 1. REZ Integration Service (`src/services/rez-integration.service.ts`)
New service that handles all REZ API interactions:

**Methods:**
- `verifyRezToken(rezAccessToken)` — Verifies REZ JWT with REZ auth service's internal API
- `getRezWalletBalance(rezUserId)` — Fetches wallet balance from REZ wallet service, converts to paise
- `syncRezWalletBalance(otaUserId, rezUserId)` — Updates OTA database with REZ coin balance
- `linkOrCreateOtaUser(rezProfile)` — Creates or links OTA user account to REZ identity
- `completeSsoFlow(rezAccessToken)` — Complete SSO flow: verify → link → sync → issue OTA JWT

**Key Design:**
- No secret sharing between systems — token verification via REZ's internal API
- Phone number used as the linking key (REZ JWT contains userId, not phone)
- Non-blocking wallet sync with graceful timeout fallback
- Coin-to-paise conversion: `rezCoinBalancePaise = Math.round(coins * 0.50 * 100)` (configurable rate)

### 2. Authentication Integration (`src/routes/auth.routes.ts`)
**New Endpoint: `POST /v1/auth/rez-sso`**

Request:
```json
{
  "rez_access_token": "eyJhbGc..."
}
```

Response:
```json
{
  "access_token": "ota-jwt...",
  "refresh_token": "refresh-jwt...",
  "user": {
    "id": "uuid",
    "phone": "+918011549915",
    "full_name": "John Doe",
    "tier": "basic",
    "ota_coin_balance_paise": 0,
    "rez_coin_balance_paise": 5000,
    "is_new_user": true
  }
}
```

Flow:
1. Client provides REZ access token
2. OTA verifies token with REZ auth service (`GET /internal/auth/user/:userId`)
3. OTA finds/creates user by phone, links REZ account
4. OTA fetches REZ wallet balance (`GET /internal/balance/:userId`)
5. OTA issues its own JWT and returns user profile

### 3. Profile Sync (`src/routes/user.routes.ts`)
**New Endpoint: `POST /v1/user/rez-sync`** (requires OTA JWT)

- Syncs REZ wallet balance to OTA database
- Returns updated user profile with latest balances
- Useful for manual refresh when balance is stale

**Modified: `GET /v1/user/profile`**
- Now triggers background wallet sync if user has `rezUserId` (non-blocking)
- Returns latest `rez_coin_balance_paise` from database

### 4. Wallet Balance Sync (`src/routes/wallet.routes.ts`)
**Modified: `GET /v1/wallet/`**
- Triggers background REZ balance sync if user has `rezUserId`
- Returns latest balances (synced before response if available)
- Graceful fallback: returns cached balance if REZ is unavailable

### 5. Environment Configuration (`src/config/env.ts`)
**New Variables:**
```
REZ_AUTH_SERVICE_URL        = https://rez-auth-service.onrender.com
REZ_WALLET_SERVICE_URL      = https://rez-wallet-service-36vo.onrender.com
INTERNAL_SERVICE_TOKEN      = shared-secret-token-with-rez
REZ_COIN_TO_RUPEE_RATE      = 0.50 (configurable)
```

**Production Validation:**
- All three REZ URLs + token required in production
- Build fails if missing during deploy

## API Flows

### REZ User → Hotel OTA (SSO)
```
REZ Consumer App
  ↓ (REZ JWT obtained via OTP)
POST /v1/auth/rez-sso { rez_access_token }
  ↓
OTA verifies with REZ:
  - GET /internal/auth/user/:userId (X-Internal-Token)
  - GET /internal/balance/:userId (X-Internal-Token)
  ↓
OTA creates/links user:
  - users.rezUserId = rez_userId
  - users.attributionSource = 'rez_app'
  - coin_wallets.rezCoinBalancePaise = synced_balance
  ↓
← Return OTA JWT { userId, phone, tier }
```

### OTA User → REZ (existing flow)
```
Partner-REZ Routes (api-key protected):
  POST /v1/partner/rez/bookings/hold
    - Auto-creates OTA user if rez_user_id not linked
    - Sets user.rezUserId, attribution_source = 'rez_app'
```

### Real-Time Balance Sync
```
User GET /v1/wallet/ (OTA JWT)
  ↓
If user.rezUserId exists:
  - Background: sync REZ balance (300ms timeout)
  - Respond immediately with latest cached balance
  - Update DB asynchronously
```

## Data Model Changes
**No schema changes required.** Existing fields used:
- `users.rezUserId` — links to REZ MongoDB ObjectId
- `coin_wallets.rezCoinBalancePaise` — stores REZ balance in paise
- `users.attributionSource` — tracks 'rez_app' source

## Security Considerations
1. **Token Verification:** Via REZ internal API, not local JWT verification
2. **No Secret Sharing:** Hotel OTA never stores REZ's `JWT_SECRET`
3. **Service-to-Service Auth:** Uses `X-Internal-Token` header (constant-time comparison)
4. **Input Validation:** Zod schemas for all endpoints
5. **Timeout Protection:** Wallet sync fails gracefully, doesn't block responses

## Testing Checklist
- [ ] Local: Start API with REZ staging env vars
- [ ] Local: Call `POST /v1/auth/rez-sso` with valid REZ token → OTA JWT + user created
- [ ] Local: Call `GET /v1/user/profile` → verify `rez_coin_balance_paise` populated
- [ ] Local: Call `GET /v1/wallet/` → verify balance synced
- [ ] Local: Test phone-linked user (existing OTA user with same phone as REZ) → no duplicate
- [ ] Local: Test REZ unavailable → graceful fallback with cached balance
- [ ] Run: `npm test` in `apps/api/`
- [ ] Build: `npm run build` in `apps/api/`

## Deployment Checklist
1. Add three new env vars to deployment:
   - `REZ_AUTH_SERVICE_URL`
   - `REZ_WALLET_SERVICE_URL`
   - `INTERNAL_SERVICE_TOKEN`
2. Build will fail if these are missing in production
3. No database migrations needed (using existing fields)
4. Test `/v1/auth/rez-sso` endpoint against production REZ services

## Future Enhancements
1. Profile sync from REZ (name, photo) when linking
2. Real-time wallet updates via webhooks from REZ
3. Deep linking from REZ → Hotel OTA (use `attributionSource` + `lastCampaignId`)
4. Coin spending in OTA → REZ wallet debit (reverse flow)
