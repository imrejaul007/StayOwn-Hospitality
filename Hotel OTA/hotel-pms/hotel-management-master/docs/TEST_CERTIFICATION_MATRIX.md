# Test Certification Matrix

## Purpose

This document maps critical production flows to current automated verification and identifies what still needs deeper certification.

Phase 7 is not complete because tests exist somewhere in the repo.
It is complete only when the highest-risk flows have explicit automated evidence.

## Latest Full Run (2026-03-26)

**Backend: 18 suites passed, 143 tests passed, 0 failures**
**Frontend: 2 suites passed, 3 tests passed**

## Current Automated Coverage

### Booking Domain (18 tests)

| Suite | Tests | What It Covers |
| --- | --- | --- |
| `bookingModuleService.test.js` | 8 | Creation preparation, overlap-safe setup, permission/transition guards, settlement validation |
| `bookingStateMachine.test.js` | 5 | Booking lifecycle state transitions and guard enforcement |
| `bookingOverlap.test.js` | 5 | Concurrent booking overlap detection and collision handling |

### Billing / Financial Domain (18 tests)

| Suite | Tests | What It Covers |
| --- | --- | --- |
| `billingModuleService.test.js` | 7 | Invoice status transitions, payment reconciliation, strict vs observe policy |
| `invoiceLifecycleSyncService.test.js` | 5 | Invoice-to-booking lifecycle synchronization |
| `nightAuditService.test.js` | 6 | Night audit no-show processing, mutable document persistence, revenue posting |

### Concurrency / Replay Safety (11 tests)

| Suite | Tests | What It Covers |
| --- | --- | --- |
| `idempotencyMiddleware.test.js` | 4 | Duplicate request detection, processing-state replay, idempotency key handling |
| `otaWebhookSecurity.test.js` | 3 | Webhook signature verification, timestamp freshness, replay rejection |
| `transactionHelper.test.js` | 4 | MongoDB transaction boundary handling, rollback behavior |

### Security (13 tests)

| Suite | Tests | What It Covers |
| --- | --- | --- |
| `rbacPolicy.test.js` | 5 | Role-based access control policy evaluation |
| `piiEncryption.test.js` | 4 | PII field encryption/decryption, key management |
| `websocketService.test.js` | 4 | WebSocket subscription authorization, unauthorized room rejection |

### Resilience (9 tests)

| Suite | Tests | What It Covers |
| --- | --- | --- |
| `circuitBreaker.test.js` | 6 | Circuit breaker open/half-open/closed transitions, fallback behavior, recovery |
| `queueService.test.js` | 3 | Queue startup without Redis, shutdown interval cleanup |

### API Design / Ops (18 tests)

| Suite | Tests | What It Covers |
| --- | --- | --- |
| `apiVersioningMiddleware.test.js` | 3 | API version routing and header handling |
| `apiResponse.test.js` | 8 | Response envelope (success/error/paginated), status codes, structured error format |
| `validateEnv.test.js` | 4 | Production environment variable strict gate, recommended variable warnings |
| `bookingComConnector.test.js` | 3 | OTA connector fallback behavior, hotel-context enforcement |

### Frontend Safety (3 tests)

| Suite | Tests | What It Covers |
| --- | --- | --- |
| `frontend/src/utils/auth.test.ts` | 2 | Bearer token not exposed from storage, demo auto-login disabled |
| `frontend/src/services/bookingService.test.ts` | 1 | Property-context enforcement on booking creation |

### Skipped Integration Tests (pre-existing config issue)

| Suite | Tests | Reason |
| --- | --- | --- |
| `auth.test.js` | 12 skipped | Imports `server.js` which uses dynamic ESM imports incompatible with Jest CJS mode |
| `booking.test.js` | 14 skipped | Same ESM/Jest config issue |

## Still Missing For Full Certification

### Integration Tests (blocked by Jest ESM config)

- booking create to invoice to checkout settlement flow
- check-out to housekeeping to ready-to-sell flow
- OTA amendment approval/rejection with booking state sync
- supertest-based auth login/register/logout flows
- **Blocker**: `server.js` uses dynamic ESM `import()` that Jest CJS mode cannot parse. Fix requires `--experimental-vm-modules` or Babel transform.

### Deeper Concurrency (unit baselines exist, integration-level missing)

- simultaneous booking attempts under load (bookingOverlap covers unit baseline)
- duplicate payment or refund replay handling under real DB (idempotencyMiddleware covers unit baseline)
- room block vs booking race conditions

### Degraded Mode

- Redis unavailable during queue and cache-backed operations (queueService covers startup case)
- transient DB failure during critical booking or billing mutation
- webhook replay and retry behavior (otaWebhookSecurity covers signature/timestamp case)

### Operational Certification

- restore-drill: **service-level drill passed** (expanded environment-level replay deferred)
- production-like worker/API deployment: **pilot precheck passed** (full pilot execution pending)

## Exit Rule

Phase 7 is fully complete only when critical booking, billing, operational, and integration failure modes have direct automated evidence.
