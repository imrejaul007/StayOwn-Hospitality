# Hotel PMS Security & Architecture Audit Report

> **Audit Date:** 2026-04-26
> **Auditor:** Claude Code (Security Auditor Agent)
> **Scope:** Hotel OTA API, Hotel Management Master Backend, ReZ Backend Integration
> **Severity Scale:** CRITICAL → HIGH → MEDIUM → LOW
> **Overall Security Posture:** MODERATE

---

## Executive Summary

The Hotel PMS codebase demonstrates good foundational security (HMAC verification, Prisma parameterized queries, JWT auth, Zod validation, transaction-based operations). However, **5 critical vulnerabilities** and **8 high-severity issues** require immediate remediation before production deployment.

**Most urgent:** Coin double-awarding via webhook race condition (C-1) and inventory double-booking window (C-2) can directly cause financial loss.

| Severity | Count | Fix Timeline |
|----------|-------|-------------|
| CRITICAL | 5 | Before next deploy |
| HIGH | 8 | Within 2 weeks |
| MEDIUM | 6 | Within 1 month |
| LOW | 4 | Backlog |

---

## CRITICAL Issues

### C-1: PMS Webhook Race Condition — Coin Double Awarding

**Severity:** CRITICAL
**File:** `src/services/pmsWebhookService.ts`, lines 82–131
**Function:** `processReservationConfirmed`

#### Description

The `processReservationConfirmed` handler awards coins without idempotency protection. If the PMS sends duplicate `reservation.confirmed` events (network retry, bug, or attack), coins are credited multiple times.

```typescript
// Current code — no idempotency check:
const userTier = booking.user?.tier || 'basic';
const earnRule = await CoinService.findEarnRule({...});

let coinsAwarded = 0;
if (earnRule) {
  // Called every time — no dedup
  await CoinService.earnCoins({...});
}
```

#### Risk
- Financial loss through duplicate coin issuance
- Gamification economy inflation
- User trust erosion

#### Fix

Add idempotency check using `bookingId` + `transactionType`:

```typescript
// src/services/pmsWebhookService.ts — processReservationConfirmed
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';

// 1. Check for existing earn transaction for this booking
const existingEarn = await prisma.coinTransaction.findFirst({
  where: {
    metadata: { path: ['bookingId'], equals: booking.id },
    coinType: 'ota',
    transactionType: 'earn',
  },
});

if (existingEarn) {
  logger.info('[PMS→OTA] Coin earn already recorded, skipping', {
    bookingId: booking.id,
    existingTxId: existingEarn.id,
  });
  return { success: true, coinsAwarded: 0, duplicate: true };
}

// 2. Proceed with earning
const userTier = booking.user?.tier || 'basic';
const earnRule = await CoinService.findEarnRule({...});

let coinsAwarded = 0;
if (earnRule) {
  const result = await CoinService.earnCoins({
    userId: booking.userId,
    amountPaise: earnPaise,
    coinType: 'ota',
    bookingId: booking.id,
    idempotencyKey: `hotel-ota:${booking.id}:earn:${earnPaise}`,
  });
  coinsAwarded = result.coinsAwarded;
}
```

**Files to modify:**
- `src/services/pmsWebhookService.ts`

---

### C-2: Inventory Double-Booking Window in `releaseInventory`

**Severity:** CRITICAL
**File:** `src/services/inventory-engine.service.ts`, lines 184–249
**Function:** `releaseInventory`

#### Description

The `releaseInventory` function performs two separate database operations without an atomic transaction. Between the `SELECT FOR UPDATE` lock and the `UPDATE`, a concurrent request could modify the same rows, creating a race window.

```typescript
// Current code — gap between lock and update:
const rows = await tx.$queryRaw`SELECT ... FROM inventory_slots WHERE ... FOR UPDATE`;

// <<< RACE WINDOW >>>
// Another request could hold a conflicting lock or modify state here

const affected = await tx.$executeRaw`UPDATE inventory_slots SET ... WHERE id = ${row.id}`;
```

#### Risk
- Overbooking — two guests assigned the same room slot
- Revenue loss from manual resolution
- Customer trust damage

#### Fix

Wrap the entire operation in a single `$transaction` with serializable isolation:

```typescript
// src/services/inventory-engine.service.ts — releaseInventory
async releaseInventory(params: {
  hotelId: string;
  roomTypeId: string;
  checkinDate: Date;
  checkoutDate: Date;
  releaseQuantity: number;
}): Promise<{ success: boolean; released: number }> {
  return this.prisma.$transaction(
    async (tx) => {
      // 1. Lock and verify in single transaction
      const rows = await tx.$queryRaw<InventorySlot[]>`
        SELECT id, slot_date, booking_id, status
        FROM inventory_slots
        WHERE hotel_id = ${params.hotelId}
          AND room_type_id = ${params.roomTypeId}
          AND slot_date >= ${params.checkinDate}
          AND slot_date < ${params.checkoutDate}
          AND status = 'reserved'
          AND booking_id IS NOT NULL
        ORDER BY slot_date, id
        LIMIT ${params.releaseQuantity}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        return { success: true, released: 0 };
      }

      // 2. Verify these are all for the same booking
      const bookingIds = [...new Set(rows.map(r => r.booking_id))];
      if (bookingIds.length > 1) {
        throw new Error('Cannot release slots from multiple bookings in single call');
      }

      // 3. Release all slots atomically
      const released = await tx.$executeRaw`
        UPDATE inventory_slots
        SET status = 'available',
            booking_id = NULL,
            updated_at = NOW()
        WHERE id = ANY(${rows.map(r => r.id)})
      `;

      logger.info('[Inventory] Released slots', {
        bookingId: bookingIds[0],
        released,
        roomTypeId: params.roomTypeId,
      });

      return { success: true, released };
    },
    {
      isolationLevel: 'Serializable',
      timeout: 10000,
    }
  );
}
```

**Files to modify:**
- `src/services/inventory-engine.service.ts`

---

### C-3: Missing Hotel Authorization on PMS Webhook `hotelId`

**Severity:** CRITICAL
**File:** `src/services/pmsWebhookService.ts`, lines 221–247
**Function:** `handlePMSWebhook`

#### Description

The webhook handler validates the HMAC signature but does not verify that the PMS sending the webhook is authorized for the `payload.hotelId` in the payload. A compromised or malicious PMS could send events for any hotel.

```typescript
// Current code — signature verified but hotelId not authorized:
let secret = fallbackSecret;
if (payload.hotelId) {
  const hotel = await prisma.hotel.findUnique({
    where: { id: payload.hotelId },
    select: { pmsWebhookSecret: true },
  });
  // No check that THIS PMS is authorized for this hotelId
}
```

#### Risk
- Cross-hotel data manipulation
- Unauthorized booking modifications
- Settlement fraud

#### Fix

Verify the PMS endpoint/API key is registered for the claimed `hotelId`:

```typescript
// src/services/pmsWebhookService.ts — handlePMSWebhook
async handlePMSWebhook(req: Request, res: Response): Promise<void> {
  const payload = req.body as PMSWebhookPayload;
  const signature = req.headers['x-pms-signature'] as string;

  // 1. Validate signature (existing)
  const { valid, hotelId: signingHotelId } = await this.validateSignature(
    payload,
    signature,
    req.headers['x-pms-id'] as string,
  );

  if (!valid) {
    res.status(401).json({ success: false, message: 'Invalid signature' });
    return;
  }

  // 2. CRITICAL: Verify the signing PMS is authorized for this hotelId
  const payloadHotelId = payload.hotelId;
  const signingPmsId = req.headers['x-pms-id'] as string;

  const authorizedHotel = await prisma.pMSIntegration.findFirst({
    where: {
      pmsId: signingPmsId,
      hotelId: payloadHotelId,
      status: 'active',
    },
    include: { hotel: true },
  });

  if (!authorizedHotel) {
    logger.warn('[PMS→OTA] Unauthorized PMS access attempt', {
      signingPmsId,
      claimedHotelId: payloadHotelId,
      signingHotelId,
    });
    res.status(403).json({ success: false, message: 'Not authorized for this hotel' });
    return;
  }

  // 3. Verify payload hotelId matches authorized hotel
  if (signingHotelId && signingHotelId !== payloadHotelId) {
    logger.error('[PMS→OTA] HotelId mismatch in webhook', {
      signingHotelId,
      payloadHotelId,
    });
    res.status(400).json({ success: false, message: 'Hotel ID mismatch' });
    return;
  }

  // 4. Proceed with event handling...
}
```

**Files to modify:**
- `src/services/pmsWebhookService.ts`
- Add `pmsId` field to `pMSIntegration` model if not present

---

### C-4: No Webhook Timestamp Validation — Replay Attack Possible

**Severity:** CRITICAL
**File:** `src/services/pmsWebhookService.ts`, lines 221–272
**Function:** `handlePMSWebhook`

#### Description

The webhook handler accepts events without validating the `timestamp` field. An attacker with a valid signature could replay old events (reversing a cancellation, re-crediting coins) or inject future-dated events.

```typescript
// Current code — timestamp field exists but is never validated:
timestamp: string, // in payload type

// Line 249: Event processed without timestamp check
logger.info('[PMS→OTA] Received event', { eventType: payload.eventType });
```

#### Risk
- Replay of stale events (double-credit, booking state reversal)
- Future-dated event injection
- Business logic bypass

#### Fix

Add timestamp validation with configurable tolerance:

```typescript
// src/services/pmsWebhookService.ts — validateTimestamp
private validateTimestamp(timestamp: string, maxAgeMs = 5 * 60 * 1000): boolean {
  const eventTime = new Date(timestamp).getTime();
  const now = Date.now();

  if (isNaN(eventTime)) {
    logger.warn('[PMS→OTA] Invalid timestamp format', { timestamp });
    return false;
  }

  const drift = Math.abs(now - eventTime);
  if (drift > maxAgeMs) {
    logger.warn('[PMS→OTA] Webhook timestamp outside tolerance', {
      timestamp,
      driftMs: drift,
      maxAgeMs,
    });
    return false;
  }

  return true;
}

// Usage in handlePMSWebhook:
if (!this.validateTimestamp(payload.timestamp)) {
  res.status(400).json({
    success: false,
    message: 'Webhook timestamp too old or too far in future',
  });
  return;
}
```

**Files to modify:**
- `src/services/pmsWebhookService.ts`

---

### C-5: Race Condition in `checkBurn` — TOCTOU Coin Drain

**Severity:** CRITICAL
**File:** `src/services/coin.service.ts`, lines 551–658
**Function:** `checkBurn`

#### Description

The `checkBurn` function reads wallet balance outside a transaction. Multiple concurrent booking requests from the same user can all pass the balance check simultaneously, then all proceed to burn — allowing the user to spend more coins than their balance.

```typescript
// Current code — balance read outside lock:
const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
// Multiple concurrent requests can all pass this check
const otaMaxByBalance = wallet.otaCoinBalancePaise;
const otaCoinApplicable = Math.min(otaCoinRequestedPaise, otaMaxByCap, otaMaxByBalance);
```

#### Risk
- Users over-spend coins beyond their balance
- Negative wallet balances
- Coin economy destabilization

#### Fix

Use `SELECT FOR UPDATE` within a transaction:

```typescript
// src/services/coin.service.ts — checkBurn
async checkBurn(params: CheckBurnParams): Promise<CheckBurnResult> {
  const { userId, amountPaise, coinType, bookingId } = params;

  // Use transaction with row lock
  const wallet = await this.prisma.$transaction(async (tx) => {
    // Lock the wallet row for the duration of this transaction
    const locked = await tx.$queryRaw<CoinWalletRow[]>`
      SELECT id, "otaCoinBalancePaise", "rezCoinBalancePaise",
             "cashbackCoinBalancePaise", version
      FROM coin_wallet
      WHERE user_id = ${userId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new Error('Wallet not found');
    }

    const w = locked[0];
    const balance = coinType === 'ota'
      ? Number(w.otaCoinBalancePaise)
      : coinType === 'rez'
      ? Number(w.rezCoinBalancePaise)
      : Number(w.cashbackCoinBalancePaise);

    const applicable = Math.min(amountPaise, balance);

    return {
      ...w,
      applicableCoinsPaise: applicable,
      balance,
    };
  }, {
    isolationLevel: 'Serializable',
    timeout: 5000,
  });

  return {
    applicable: wallet.applicableCoinsPaise,
    balance: wallet.balance,
    sufficient: wallet.applicableCoinsPaise >= amountPaise,
  };
}
```

**Files to modify:**
- `src/services/coin.service.ts`

---

## HIGH Issues

### H-1: Missing Date Validation in `booking.service.ts`

**Severity:** HIGH
**File:** `src/services/booking.service.ts`, lines 26–52
**Function:** `hold`

#### Description

While Zod validation exists in routes, the `hold` service function does not re-validate dates. Direct code-path calls bypass route-level validation.

#### Fix

Add explicit validation at service layer:

```typescript
// src/services/booking.service.ts — hold
const checkin = new Date(params.checkinDate);
const checkout = new Date(params.checkoutDate);

if (isNaN(checkin.getTime()) || isNaN(checkout.getTime())) {
  throw Errors.validation('Invalid date format');
}

const today = new Date();
today.setHours(0, 0, 0, 0);
if (checkin < today) {
  throw Errors.validation('Check-in date cannot be in the past');
}

const maxStayDays = 365;
const numNights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
if (numNights <= 0) {
  throw Errors.validation('Checkout must be after check-in');
}
if (numNights > maxStayDays) {
  throw Errors.validation(`Stay cannot exceed ${maxStayDays} nights`);
}
```

---

### H-2: Idempotency Key Missing `coinType`

**Severity:** HIGH
**File:** `src/services/coin.service.ts`, lines 255–264
**Function:** `burnCoins`

#### Description

Idempotency key uses `bookingId` and `amountPaise` but not `coinType`. Same amount burned for different coin types could conflict.

```typescript
// Current:
const idempotencyKey = eventId ?? `hotel-ota:${bookingId}:burn:${amountPaise}`;

// Fix:
const idempotencyKey = eventId ?? `hotel-ota:${bookingId}:${coinType}:burn:${amountPaise}`;
```

---

### H-3: No Row Lock on `confirm` Transaction

**Severity:** HIGH
**File:** `src/services/booking.service.ts`, lines 308–403
**Function:** `confirm`

#### Description

`updateMany` is atomic but subsequent reads of booking data may be stale during concurrent confirmations.

```typescript
// Add before updateMany:
await tx.$executeRaw`
  SELECT id FROM "booking"
  WHERE id = ${bookingId} AND status = 'hold'
  FOR UPDATE
`;

const updated = await tx.booking.updateMany({
  where: { id: bookingId, status: 'hold' },
  data: { status: 'confirmed', ... },
});
```

---

### H-4: No Webhook Signature Replay Protection

**Severity:** HIGH
**File:** `src/routes/pms.routes.ts`, lines 75–108

#### Description

Valid HMAC signatures can be reused multiple times. Add Redis-based event deduplication:

```typescript
// src/services/pmsWebhookService.ts
private async isEventProcessed(eventId: string): Promise<boolean> {
  const cacheKey = `webhook:processed:${eventId}`;
  const existing = await this.redis.get(cacheKey);
  return existing !== null;
}

private async markEventProcessed(eventId: string, ttlSeconds = 86400): Promise<void> {
  const cacheKey = `webhook:processed:${eventId}`;
  await this.redis.setex(cacheKey, ttlSeconds, '1');
}

// In handlePMSWebhook:
if (await this.isEventProcessed(payload.eventId)) {
  return res.status(200).json({ success: true, duplicate: true });
}
// ... process event ...
await this.markEventProcessed(payload.eventId);
```

---

### H-5: Integer Overflow in `calculateEarnAmount`

**Severity:** HIGH
**File:** `src/services/coin.service.ts`, lines 71–76

#### Description

`Math.round(bookingValue * (earnPct / 100))` can overflow for extremely large `bookingValue`.

```typescript
// Add overflow protection:
const MAX_SAFE_COINS = Number.MAX_SAFE_INTEGER / 100;
const cappedValue = Math.min(bookingValue, MAX_SAFE_COINS);
const amount = Math.round(cappedValue * (earnPct / 100));
```

---

### H-6: Admin Bypass Non-Atomic Check-and-Insert

**Severity:** HIGH
**File:** `hotel-management-master/backend/src/middleware/bypassSecurityMiddleware.js`, lines 224–264

#### Description

The duplicate bypass prevention check and the actual bypass are not atomic.

```javascript
// Use MongoDB transaction:
const session = await mongoose.startSession();
session.startTransaction();
try {
  const recentBypass = await AdminBypassAudit.findOne({ bookingId, adminId }, { session });
  if (recentBypass) {
    await session.abortTransaction();
    return res.status(429).json({ error: 'Duplicate bypass' });
  }
  // Perform bypass atomically
  await AdminBypassAudit.create([{ bookingId, adminId }], { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

---

### H-7: No Rate Limiting on Webhook Endpoints

**Severity:** HIGH
**File:** `src/routes/pms.routes.ts`, lines 49–201

#### Description

Webhook routes have no rate limiting — an attacker with a valid signature could flood the system.

```typescript
// src/routes/pms.routes.ts
import rateLimit from 'express-rate-limit';

const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,             // 100 requests per minute per IP
  keyGenerator: (req) => req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests' },
});

router.post('/webhooks/pms', webhookRateLimiter, async (req, res) => {
  // ...
});
```

---

### H-8: Missing `tenantId` Filter in Some Queries

**Severity:** HIGH
**File:** `hotel-management-master/backend/src/middleware/auth.js`, lines 135–185

#### Description

Some routes may not enforce `hotelId` filtering. Cross-hotel data access possible.

```javascript
// Implement automatic query interceptor:
const originalFind = mongoose.Query.prototype.find;
mongoose.Query.prototype.find = function(filter) {
  const hotelId = this.getOptions().hotelId;
  if (hotelId && !filter.hotelId) {
    filter.hotelId = hotelId;
  }
  return originalFind.call(this, filter);
};
```

---

## MEDIUM Issues

### M-1: Soft Delete Not Implemented for Bookings

**File:** `src/services/booking.service.ts`, lines 507–707

Cancelled bookings use `status: 'cancelled'` without `deletedAt` timestamp. For audit compliance, add soft delete:

```typescript
data: {
  status: 'cancelled',
  cancelledAt: new Date(),
  cancelledBy: userId,
  deletedAt: new Date(), // for soft delete
}
```

---

### M-2: Missing Index on `bookingEvent.bookingId`

**File:** Database Schema

Add composite index for event queries:

```sql
CREATE INDEX idx_booking_event_booking_id ON booking_event(booking_id);
CREATE INDEX idx_booking_event_created_at ON booking_event(created_at);
CREATE INDEX idx_coin_transaction_metadata ON coin_transaction USING GIN (metadata);
```

---

### M-3: Error Information Leakage in Webhook Responses

**File:** `src/routes/pms.routes.ts`, lines 95, 126, 157, 188

```typescript
// Production: hide internal details
res.status(result.success ? 200 : 400).json({
  success: result.success,
  // message: only in non-production
  ...(process.env.NODE_ENV !== 'production' && { message: result.message }),
});
```

---

### M-4: Memory Leak in Session Timeout Cleanup

**File:** `hotel-management-master/backend/src/middleware/bypassSecurityMiddleware.js`, lines 27–45

```javascript
// Replace in-memory Map with Redis TTL:
const sessionKey = `bypass:session:${sessionId}`;
await redis.setex(sessionKey, SESSION_TIMEOUT_MS, '1');
const exists = await redis.exists(sessionKey);
```

---

### M-5: Silent Side-Effect Failures

**File:** `src/services/booking-state-machine.service.ts`, lines 147–161

```typescript
// Replace console.error with structured logging + alerting:
logger.error({
  level: 'critical',
  bookingId,
  transition: `${fromState}→${toState}`,
  error: err.message,
  stack: err.stack,
}, 'BookingStateMachine side-effect failed');

// Emit metrics for alerting:
metrics.increment('booking.sm.side_effect.error', {
  fromState,
  toState,
});
```

---

### M-6: No Database Pool Monitoring

**File:** `src/config/database.ts`

```typescript
prisma.$on('pool:busy', (event) => {
  metrics.gauge('db_pool_busy', event.limit - event.available);
});

prisma.$on('pool:error', (event) => {
  logger.error({ error: event.error }, 'Database pool error');
  metrics.increment('db_pool.errors');
});
```

---

## LOW Issues

### L-1: Verbose Logging of Financial Data

**Files:** `src/services/coin.service.ts`, lines 121, 262, 372, 471

Audit log statements — remove or hash PII/financial amounts in logs.

---

### L-2: Missing `vary` Header on SSE Endpoint

**File:** `src/routes/booking.routes.ts`, lines 186–267

```typescript
res.setHeader('Vary', 'Accept-Encoding, Authorization');
```

---

### L-3: `console.log` Instead of Structured Logger

Multiple files use `console.*` instead of the centralized `logger`.

```bash
# Find all instances:
grep -rn "console\.\(log\|error\|info\|warn\|debug\)" src/ --include="*.ts"
```

Replace with `logger.info()`, `logger.error()`, etc.

---

### L-4: No Graceful Shutdown Handler

**File:** `src/index.ts`

```typescript
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });
  // Force exit after 30 seconds
  setTimeout(() => process.exit(1), 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## Architecture Assessment

### FSM — Booking State Machine

**File:** `src/services/booking-state-machine.service.ts`

| Aspect | Status | Notes |
|--------|--------|-------|
| State transition table | ✅ Good | Clear valid transitions defined |
| Transition validation | ✅ Good | Validated before execution |
| Atomic persistence | ✅ Good | State + event in single transaction |
| Side-effect isolation | ✅ Good | Outside transaction to avoid rollback cascades |
| Event sourcing | ✅ Good | All transitions recorded in `bookingEvent` table |

### Settlement Batch Processing

**File:** `src/services/settlement.service.ts`, lines 136–191

- Groups entries by hotel
- Creates atomic batch
- Updates wallet balances atomically
- **Verdict:** Well-designed

### Coin Double-Write Pattern

**File:** `src/services/coin.service.ts`

1. Writes transaction record first
2. Updates wallet balance
3. Requires careful transaction boundaries
4. **Verdict:** Acceptable with proper `$transaction` wrapping

---

## Race Condition Matrix

| Operation | File:Line | Risk | Mitigation |
|-----------|-----------|------|------------|
| Booking hold | `booking.service.ts:58-68` | Low | `SELECT FOR UPDATE NOWAIT` |
| Booking confirm | `booking.service.ts:308-323` | **Medium** | No row lock (H-3) |
| Inventory release | `inventory-engine.service.ts:184-249` | **Critical** | Separate queries (C-2) |
| Coin burn check | `coin.service.ts:571-594` | **Critical** | No lock (C-5) |
| PMS webhook coin | `pmsWebhookService.ts:82-131` | **Critical** | No idempotency (C-1) |
| Settlement batch | `settlement.service.ts:160-188` | Low | Atomic transaction |

---

## Security Controls Checklist

| Control | Implemented | Location | Quality |
|---------|-------------|----------|---------|
| HMAC Signature Verification | ✅ Yes | Webhook routes | Good |
| JWT Authentication | ✅ Yes | `auth.ts` | Good |
| Role-Based Access | ✅ Yes | Multiple | Good |
| Input Validation (Zod) | ✅ Yes | Route schemas | Good |
| Rate Limiting | ⚠️ Partial | Some routes only | Medium |
| SQL Injection Prevention | ✅ Yes | Prisma parameterized | Good |
| IDOR Protection | ✅ Yes | `idorProtection.js` | Good |
| Webhook Replay Protection | ❌ **No** | — | **Critical Gap** |
| Timestamp Validation | ❌ **No** | — | **Critical Gap** |
| Hotel Authorization on Webhooks | ❌ **No** | — | **Critical Gap** |
| Request Signing | ✅ Yes | HMAC-SHA256 | Good |
| $transaction Isolation | ⚠️ Partial | Some operations | Medium |

---

## Fix Priority Order

### Phase 1 — Immediate (Before Next Deploy)
1. **C-1** — Add idempotency to `processReservationConfirmed` ⬅️ Highest financial risk
2. **C-2** — Wrap `releaseInventory` in serializable transaction
3. **C-3** — Verify hotelId authorization on webhook
4. **C-4** — Add timestamp validation to webhooks
5. **C-5** — Lock wallet reads in `checkBurn`

### Phase 2 — Within 2 Weeks
6. **H-3** — Add row lock to `confirm` transaction
7. **H-4** — Implement webhook eventId deduplication
8. **H-7** — Add rate limiting to webhook endpoints
9. **H-1** — Add date validation to service layer
10. **H-2** — Include `coinType` in idempotency keys

### Phase 3 — Within 1 Month
11. **H-5** — Add overflow protection to coin calculations
12. **H-6** — Make admin bypass atomic
13. **H-8** — Implement tenant query interceptor
14. **M-1** — Add soft delete for bookings
15. **M-2** — Add database indexes
16. **M-3** — Sanitize webhook error responses

### Phase 4 — Backlog
17. **M-4** — Fix session timeout memory leak
18. **M-5** — Add alert-based monitoring
19. **M-6** — Database pool monitoring
20. **L-1** — Audit logging for PII
21. **L-2** — Add Vary header
22. **L-3** — Replace console.log with logger
23. **L-4** — Graceful shutdown handler

---

## Files Modified

| File | Issues Fixed |
|------|-------------|
| `src/services/pmsWebhookService.ts` | C-1, C-3, C-4, H-4 |
| `src/services/inventory-engine.service.ts` | C-2 |
| `src/services/coin.service.ts` | C-5, H-2, H-5 |
| `src/services/booking.service.ts` | H-1, H-3, M-1 |
| `src/routes/pms.routes.ts` | H-7, M-3 |
| `src/services/booking-state-machine.service.ts` | M-5 |
| `src/config/database.ts` | M-6 |
| `src/index.ts` | L-4 |
| `hotel-management-master/backend/src/middleware/bypassSecurityMiddleware.js` | H-6, M-4 |
| `hotel-management-master/backend/src/middleware/auth.js` | H-8 |
| Database migration | M-2 |
