# Phase 6 — Production readiness backlog (from full-stack audit)

**Purpose:** Turn `FAB-*` findings in `docs/FULLSTACK_AUDIT_FINDINGS_TRACKER.md` into **prioritized work items** with **acceptance criteria** and **verification** so engineering and product can close them deliberately.

**How to use:** Pick items by **priority** (P0 first). When done, set status to `done` in this file and update the tracker row to `fixed` with verification notes.

**Related:** `docs/OPEN_RISKS_AND_DEFERRALS.md` (program risks), `docs/GO_LIVE_GATE_REPORT.md`, `docs/PHASE4_ENDPOINT_AUDIT.md`.

---

## Priority legend

| Priority | Typical severity | Meaning |
| --- | --- | --- |
| **P0** | S0 | Wrong inventory/booking or payment truth — fix before multi-property or high-volume production |
| **P1** | S1 | Major correctness, tenant safety, or broken guest flows |
| **P2** | S2 | Moderate UX, wrong tenant on marketing surfaces, demo-only features |
| **P3** | S3 | Hygiene, dead code, duplicate routes, documentation |

---

## P0 — Blockers

| ID | Title | Acceptance criteria | Verification |
| --- | --- | --- | --- |
| **FAB-004** | Inventory vs standard booking create | **Product rule documented** in repo (ADR or ops doc): either (a) `POST /bookings` (or prep step) **reduces** `RoomAvailability` / calls `reserveRooms` in the same transaction boundary, or (b) **explicit reconciliation job** + monitoring when counts diverge; channels/enhanced paths called out if different. Implementation matches the rule. | Code review + integration test or manual script: create booking → inventory (or reconciliation report) reflects expected availability for same `hotelId`/room type/dates. |
| **FAB-005** | Same as above (confirmation) | No separate fix if FAB-004 closes the same architectural gap; otherwise treat as duplicate and close with reference to FAB-004. | Same as FAB-004. |

*Note:* FAB-004 and FAB-005 are the same theme; **one** epic with two tracker IDs is enough.

---

## P1 — Major

| ID | Title | Acceptance criteria | Verification |
| --- | --- | --- | --- |
| **FAB-001** | Multi-property UI vs API tenant | **Single source of truth** for active property: either JWT/`/auth/me` lists allowed properties and server enforces active property, or **property switch is disabled** for roles that are single-tenant. No silent `ensureTenantContext` override vs UI `hotelId` without user-visible error. | E2E or manual: switch property → all mutating APIs use same property; cross-tenant mutation rejected with 403/400. |
| **FAB-003** | Public rooms/booking hardcoded room types | Public booking/rooms flows load **room types and availability** from API (or config service) keyed by **`hotelId`** / selected property — no hardcoded catalog for production tenants. | Network tab: `/room-types`, `/availability/check`, or equivalent; UI matches API. |
| **FAB-011** | GuestRequests `user.id` vs `_id` | *(**Fixed:** `isSameUserId` helper + `user._id`.)* | Socket handlers match current user. |
| **FAB-012** | Wrong SPA paths `/guest/bookings` | *(**Fixed:** all targets use `/app/bookings`.)* | `grep /guest/bookings` → none. |
| **FAB-017** | Public availability `hotelId` | *(**Fixed** in code.)* Keep regression check: **400** without `hotelId` on public availability reads. | `GET /api/v1/availability/check` without `hotelId` → 400; with `hotelId` → 200 scoped. |

---

## P2 — Moderate

| ID | Title | Acceptance criteria | Verification |
| --- | --- | --- | --- |
| **FAB-006** | Public Home/Reviews hardcoded `HOTEL_ID` | *(**Fixed:** `VITE_PUBLIC_DEFAULT_HOTEL_ID` + `constants/publicHotel.ts`; override per deploy.)* | Set env per tenant; home/reviews use constant. |
| **FAB-013** | Invalid `/app/dashboard` redirect | *(**Fixed:** `navigate('/app')`.)* | Click confirmation CTA → guest dashboard. |
| **FAB-015** | Contactless guest app mock-only | *(**Improved:** demo banner on page; full API wiring still optional.)* | Product signoff if hiding from prod nav. |
| **FAB-010** | Duplicate `/auth/me` on startup | *(**Fixed:** `AUTH_ME_QUERY_KEY` + `fetchQuery`; PropertyContext uses `useAuth` + optional admin hotel fetch.)* | DevTools: one `/auth/me` on cold load. |

---

## P3 — Hygiene / tech debt

| ID | Title | Acceptance criteria | Verification |
| --- | --- | --- | --- |
| **FAB-002** | Booking idempotency documentation | *(**Fixed:** comment in `api.ts` above `IDEMPOTENT_MUTATION_PATTERNS`.)* | Code review. |
| **FAB-007** | `ImprovedBookingPage` unrouted | *(**Fixed:** public route `/improved-booking`.)* | Manual nav. |
| **FAB-008** | Travel agent duplicate routes | *(**Fixed:** `/travel-agent/bookings` and `/travel-agent/dashboard` → `Navigate` to `/travel-agent`; sidebar updated.)* | Manual nav. |
| **FAB-009** | Unused `authService` import on Register | *(**Fixed:** import removed.)* | `npm run lint` |
| **FAB-014** | `GuestSettings` unrouted | *(**Fixed:** `/app/settings/guest` + back to `/app`.)* | App.tsx + UX. |
| **FAB-016** | Unrouted admin pages | Inventory admin `pages/admin/*` not in `App.tsx` — delete, merge, or route. | Bundle + sidebar audit. |

---

## Deferred / follow-up (not FAB-numbered)

| Topic | Source | Notes |
| --- | --- | --- |
| OTA webhook **duplicate delivery** persistence | Phase 4 Batch C | Stripe has `StripeWebhookEvent`; OTA may need channel-level idempotency keys — separate spike. |
| **Batch E** router line audit | Phase 4 | Only if new high-risk surface ships. |
| **Concurrency / replay** | `OPEN_RISKS_AND_DEFERRALS.md` | Integration tests for collision/replay beyond unit baselines — optional P2. |

---

## Suggested implementation order

1. **P0** FAB-004/005 (inventory + booking) — requires product + engineering joint decision.
2. **P1** FAB-001 (tenant) — before multi-property rollout.
3. **P1** FAB-003 (public rooms wired to APIs).
4. **P3** FAB-016 (unrouted admin pages) — cleanup when capacity allows.
5. Remaining **P2** items: FAB-015 full API wiring only if product wants contactless in scope.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-03-27 | Phase 6 backlog created from `FAB-*` quick index + Phase 4 notes. |
| 2026-03-27 | Marked FAB-009, 011, 012, 013 fixed in code + tracker. |
| 2026-03-27 | Marked FAB-002, 006, 007, 008, 010, 014 fixed; FAB-015 improved (demo banner); backlog order updated. |
