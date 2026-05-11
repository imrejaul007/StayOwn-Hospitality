# Open Risks And Deferrals

## Purpose

This document is the formal register of known remaining risks, deferred work, and signoff exceptions.

If a risk is not listed here, it should be assumed to be expected to be closed before final production approval.

## Current Open Risks

| Severity | Area | Risk | Required To Close | Current Status |
| --- | --- | --- | --- | --- |
| ~~High~~ | ~~Pilot~~ | ~~No completed pilot run is logged yet~~ | ~~Execute pilot and log findings~~ | **Closed** — pilot smoke 18/18 passed (2026-03-26) |
| ~~Low~~ | ~~Recovery~~ | ~~Expanded environment-level restore replay needed~~ | ~~Run `npm run drill:restore-replay`~~ | **Closed** — restore replay passed (6/6 steps, isolated replay DB validated and dropped) |
| Low | Concurrency | Full end-to-end collision certification | Add integration concurrency tests | Unit baseline closed + PMS acceptance verified (bookingOverlap 5/5, transactionHelper 4/4) |
| Low | Replay Safety | Full end-to-end replay certification | Add integration replay tests | Unit baseline closed + PMS acceptance verified (idempotencyMiddleware 4/4, otaWebhookSecurity 3/3) |
| ~~Medium~~ | ~~PMS Ops~~ | ~~Housekeeping turnover not certified~~ | ~~Add integration evidence~~ | **Closed** — PMS acceptance domain 2 verified (3/3 criteria passed) |
| ~~Medium~~ | ~~PMS Ops~~ | ~~Room-block release not certified~~ | ~~Add integration evidence~~ | **Closed** — PMS acceptance domain 3 verified (4/4 criteria passed) |
| ~~Medium~~ | ~~Integrations~~ | ~~OTA amendment handling not certified~~ | ~~Add integration evidence~~ | **Closed** — PMS acceptance domain 5 verified (3/3 criteria passed) |
| ~~Medium~~ | ~~Product~~ | ~~Corporate billing not captured~~ | ~~Add product signoff~~ | **Closed** — PMS acceptance domain 6 verified (3/3 criteria passed) |

## Recently Closed Risks (Code-Level)

| Severity | Area | Risk | Closure Evidence | Closed Status |
| --- | --- | --- | --- | --- |
| Critical | Security | Private JWT key committed in repository | Removed committed key file and migrated runtime toward env-managed signing key flow | Closed (code) |
| High | Security | Public detailed health endpoints and auth policy mismatch | Protected detailed health endpoints and fixed admin policy usage in health routes | Closed (code) |
| High | Tenant Isolation | Cross-property risk in payment mutation routes | Added property-access assertions and POS order property scoping checks in payment routes | Closed (code) |
| High | Financial Integrity | Refund state divergence risk | Wrapped refund payment/booking updates in transaction boundary | Closed (code) |
| High | Idempotency | Non-distributed fallback in production | Enforced fail-closed behavior when idempotency storage is unavailable in production | Closed (code) |
| High | Realtime Security | WebSocket unauthorized room subscription risk | Restricted websocket subscriptions to authorized rooms/prefixes | Closed (code) |
| High | Runtime Stability | Notification route shadowing and lean misuse on template preview | Constrained notification id routes and removed lean misuse on method-bound template preview | Closed (code) |
| High | Production Config | Missing strict env gate for production critical settings | Added strict production environment validation for Redis/Stripe/origin/health/webhook secrets | Closed (code) |
| High | Concurrency | No explicit booking collision certification existed | Added automated overlap/collision baseline tests (`bookingOverlap`) and reran suite with pass evidence | Closed (baseline evidence) |
| High | Replay Safety | No explicit duplicate payment/webhook replay certification existed | Added automated idempotency and OTA webhook replay-signature tests (`idempotencyMiddleware`, `otaWebhookSecurity`) and reran suite with pass evidence | Closed (baseline evidence) |

Code-level closure is complete for the items above. Remaining strict signoff blocker is human approvals.

## Operational Closure Commands (Runbook)

- Pilot precheck: `cd backend && npm run pilot:precheck`
- Pilot smoke test: `cd backend && npm run pilot:smoke`
- PMS acceptance verification: `cd backend && npm run pms:verify`
- Backup drill precheck: `cd backend && npm run drill:precheck`
- Restore replay: `cd backend && npm run drill:restore-replay`
- Integration tests: `cd backend && npm run test:integration` (full suite may need ESM/in-band tuning)
- Switch-hotel (multi-property tenant) HTTP integration: `cd backend && npm run test:integration:switch-hotel`

## Latest Execution Snapshot (2026-03-26)

- `drill:precheck`: passed
- `pilot:precheck`: passed
- **pilot smoke test**: **18/18 passed** — booking lifecycle + health + auth + billing + night audit + ops
- **PMS acceptance**: **6 domains, 20/20 criteria passed** — all PMS workflows verified
- **full backend unit suite**: 18 suites, 143 tests passed, 0 failures
- **frontend safety**: 2 suites, 3 tests passed
- **production bugs fixed during pilot**: Room.toObject crash, tenantIsolation ObjectId cast, Joi schema compliance
- **server.js ESM fix**: top-level await removed, integration test runner added
- **expanded restore replay**: passed (6/6 steps), validated critical collections and dropped isolated replay DB (`docs/evidence/restore-replay-results.json`)

## Allowed Deferrals

None should be treated as approved by default.

Any deferral must include:
- owner
- target date
- business impact
- technical risk
- mitigation

## Deferral Template

### Deferral Item

- area:
- description:
- owner:
- target date:
- business reason:
- risk:
- mitigation:
- approval:

## Exit Rule

This document must be empty or explicitly approved before unqualified production signoff is granted.
