# Phase 3 Architecture Baseline

## Goal

Reduce bootstrap and route-file coupling without changing API behavior.

## Completed

- `backend/src/server.js` no longer owns the full API route mount list directly.
- Route registration is centralized in `backend/src/app/registerApiRoutes.js`.
- Booking domain now has an explicit module entrypoint:
  - `backend/src/modules/booking/index.js`
- Billing domain now has an explicit module entrypoint:
  - `backend/src/modules/billing/index.js`

## Current Ownership

- Server bootstrap:
  - process startup
  - infrastructure initialization
  - global middleware
  - health/docs/widget endpoints
  - delegated API route registration

- Route composition:
  - `backend/src/app/registerApiRoutes.js`

- Booking module public surface:
  - routes
  - service
  - repository

- Billing module public surface:
  - payment routes
  - invoice routes
  - service
  - repository

## Remaining Phase 3 Debt

- `backend/src/routes/bookings.js` is still a legacy monolith behind a module adapter.
- `backend/src/routes/payments.js` and `backend/src/routes/invoices.js` are still legacy route implementations behind billing adapters.
- `backend/src/server.js` still contains a very large import surface.
- Additional domains still need module entrypoints and dedicated composition ownership.

## Next Refactor Slices

1. Extract booking mutation handlers from `routes/bookings.js` into module-owned controller/service files.
2. Extract billing/payment mutation handlers from legacy route files into module-owned controller/service files.
3. Introduce per-module controller exports so route adapters stop importing the legacy route monoliths.
4. Reduce `server.js` import surface by moving route imports behind grouped domain registries.
