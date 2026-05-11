# Large-scope FAB items — plans, analysis, and what shipped

This document covers **FAB-001**, **FAB-003**, **FAB-004/005**, and **FAB-016**: analysis, implementation steps, and verification. Use it with `docs/FULLSTACK_AUDIT_FINDINGS_TRACKER.md` and `docs/PHASE6_PRODUCTION_BACKLOG.md`.

---

## FAB-001 — Multi-property UI vs JWT tenant (`ensureTenantContext`)

### Problem

`ensureTenantContext` forces `req.body.hotelId` / `req.query.hotelId` to the JWT’s primary property. The UI can show a **different** selected property (`localStorage.selectedPropertyId`), so staff may think they act on property B while the API still applies property A.

### Plan

1. **Short term (frontend):** Surface **primary tenant id** from `/auth/me` and show a **warning** when the property switcher selection differs from that tenant in multi-property mode.
2. **Medium term (backend):** JWT or session **active property** (e.g. `POST /auth/active-property`) so switching property updates the token or server-side session; all tenant middleware reads that value.
3. **Tests:** Extend `backend/src/tests/integration/multiProperty.integration.test.js` for the intended contract once product chooses (a) or (b).

### Implemented

- `PropertyContext`: `primaryTenantHotelId`, `tenantSelectionMismatch`.
- `PropertySelector`: amber notice when `tenantSelectionMismatch` is true.

### Still open

- Server-side **active property** switch and tests for multi-property roles.

---

## FAB-003 — Public rooms / booking using live catalog

### Problem

Marketing pages used hardcoded `ROOM_TYPES` only.

### Plan

1. Use public **GET `/room-types/hotel/:hotelId/options`** (no auth) for catalog.
2. Map **ObjectId** slugs in `/rooms/:type` when the param is a 24-char id.
3. Pass **`roomTypeId`** (or legacy `roomType`) into `/booking` query params.

### Implemented

- `frontend/src/services/publicRoomCatalogService.ts`, `hooks/usePublicRoomCatalog.ts`.
- `RoomsPage`, `RoomDetailPage`, `BookingPage` load catalog + fallback to static `ROOM_TYPES` when the API returns nothing.

### Still open

- Optional **availability checks** on public booking before pay (wire `availabilityService.checkAvailability` / `checkAvailabilityV2` when dates + `roomTypeId` are set).
- **Backend** `createBooking` validation still expects `roomType` in `single|double|suite|deluxe`; API-driven types use a **fallback** enum (`double`) when `legacyType` does not match — consider a real `roomTypeId` field on the booking schema.

---

## FAB-004 / FAB-005 — `RoomAvailability` vs `POST /bookings`

### Problem

Assigned-room bookings did not decrement **RoomAvailability** calendar rows.

### Plan

1. After `Booking.create`, group assigned **rooms** by `roomTypeId` and call inventory reservation in the **same** session.
2. **Skip** when no `RoomAvailability` documents exist (property not calendar-managed).
3. Fix `bookRooms` to persist with **Mongo session** when provided.
4. Fix `reserveRooms` empty-calendar and **wrong `bookRooms` argument order** (userId vs session).

### Implemented

- `availabilityService.reserveRoomsWithParentSession(session, …)` used from `backend/src/routes/bookings.js` when `rooms.length > 0`.
- `RoomAvailability` `bookRooms` uses `metadata.session` on `save`.
- `reserveRooms` (standalone) now rejects **zero** availability rows; passes `userId` correctly into `bookRooms`.

### Still open

- **Release** inventory on cancel/modify (pair with `releaseRooms` / booking lifecycle).
- **Guest** booking path with `roomIds: []` does not touch inventory until rooms are assigned.

---

## FAB-016 — Unrouted admin modules

### Problem

Many `frontend/src/pages/admin/**/*.tsx` files are not wired in `App.tsx`.

### Plan

1. Inventory: script `scripts/list-unrouted-admin-pages.cjs` (basename not found in `App.tsx`).
2. Per file: **route + sidebar**, **merge** into an existing screen, or **delete** / move to `_archive` after product confirmation.
3. **Do not** bulk-delete: duplicate names (e.g. `WalkInBooking` vs front desk) need human review.

### Output (snapshot)

Run `node scripts/list-unrouted-admin-pages.cjs`. Latest run: **41** files (of **105** total) not referenced by basename in `App.tsx`; list includes `AdminVIP.tsx`, `WalkInBooking_FIXED.tsx`, `analytics/*`, `alerts/AlertsDashboard.tsx`, etc.

### Still open

- Product prioritization and routing/cleanup.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-03-27 | Initial plan + implementation notes for FAB-001, 003, 004/005, 016. |
