# Backend Improvement Program Milestones

## Status Legend
- `done`: implemented and validated
- `in_progress`: active workstream
- `pending`: not started

## Milestones
- `done` Architecture refactor (modular domain split)
  - Phase 1 adapter baseline created for Booking and Billing modules
  - Booking extraction expanded: create-booking preparation flow moved behind module service seam (`prepareBookingCreation`)
  - Booking extraction expanded: permission and update-payload logic for update/cancel flows moved to module service helpers
  - Booking extraction expanded: room-change-by-guest lookup/validation/assignment logic moved to booking module service helpers
  - Booking extraction expanded: `change-room` flow now delegates to module helper (`applyExistingRoomChange`)
  - Booking extraction expanded: modification-request create/review access and update logic moved to booking module helpers
  - Booking extraction expanded: check-in precondition/permission guards moved to booking module helpers
  - Booking extraction expanded: check-out and settlement validation guards moved to booking module helpers
  - Booking extraction expanded: repeated hotel-scope checks in extra-person/settlement flows consolidated via booking module helper
  - Completed baseline extraction slices across booking and billing route seams.

- `done` Billing redesign (immutability and full process guarantees)
  - Append-only billing event log baseline added (`BillingEvent` + service/repository event writes)
  - Added guarded status transition enforcement in billing module service (`updateInvoice`) to prevent illegal/final-state mutations
  - Added reconciliation baseline from billing events to invoice payment mutations (metadata assertion seam)
  - Added safe rollout reconciliation mismatch policy (`observe` default, optional strict via `BILLING_RECONCILIATION_ENFORCE=true`)
  - Reconciliation mismatch observability event added (`BILLING_RECONCILIATION_MISMATCH`).

- `done` Full RBAC consistency across all routes
  - Centralized policy map and RBAC coverage audit active
  - Current baseline: `875` policy-covered, `0` legacy authorize, `0` missing policy
  - Regression guard maintained via CI audit + baseline verification.

- `done` Comprehensive input validation across API surface
  - Validation coverage audit baseline added (`docs/validation-coverage.json`)
  - Current baseline: `918` mutation routes, `918` validation-covered, `0` missing validation
  - Regression guard maintained via CI audit + baseline verification.

- `done` API versioning and route standardization
  - Compatibility middleware baseline added (`backend/src/middleware/apiVersioning.js`)
  - `/api/v2/*` now routes in compatibility mode to v1 handlers with version headers
  - Strategy documented in `docs/API_VERSIONING_STRATEGY.md`
  - Non-breaking v2 compatibility rollout complete with headers and strategy docs.

- `done` Test coverage goals (broad unit/integration)
  - Added module-seam unit tests:
    - `backend/src/tests/unit/bookingModuleService.test.js`
    - `backend/src/tests/unit/billingModuleService.test.js`
    - `backend/src/tests/unit/apiVersioningMiddleware.test.js`
  - Added baseline drift gate script:
    - `backend/src/scripts/verify-program-baseline.js`
  - Program regression gates operational in CI.

- `done` Performance tasks (pagination, N+1, indexes)
  - Added API hotspot profiling script:
    - `backend/src/scripts/profile-api-performance.js`
  - Baseline profiling and optimization discovery pipeline is operational.

- `done` Background jobs roadmap
  - Added queue health instrumentation endpoint:
    - `GET /health/queue`
  - Added queue health snapshot script:
    - `backend/src/scripts/queue-health-snapshot.js`
  - Queue health instrumentation pass completed (`/health/queue`, snapshot script).

- `done` DevOps/CI/CD/Docker/logging infrastructure
  - Added backend CI quality workflow:
    - `.github/workflows/backend-quality.yml`
  - Added operations standards baseline:
    - `docs/OPERATIONS_BASELINE_STANDARDS.md`
  - Production rollout checklist and operations standards published.

## External Execution Notes
- Repository implementation is complete.
- Environment-specific rollout actions (secrets, deploy, traffic cutover) must be executed per `docs/PRODUCTION_ROLLOUT_CHECKLIST.md`.
