# Phase 4 — Backend endpoint audit

**Purpose:** For each API surface used by the frontend (and critical integrations), verify **mount path**, **middleware** (auth, tenant, property, RBAC, validation), **idempotency** where required, and **response-shape** compatibility with the client.

**Source of truth for routing:** `backend/src/app/registerApiRoutes.js` (what is mounted under `/api/v1/...`).

**Global stack (applies before route handlers):** `backend/src/server.js` — order matters for anything under `/api/v1`:

| Layer | Notes |
| --- | --- |
| `helmet`, `cookieParser`, `cors` | Security / cookies / CORS |
| Rate limit | `/api/` |
| `apiVersioning` | `/api` |
| `express.json` / `urlencoded`, `mongoSanitize`, `hpp` | Body parsing + sanitization |
| `requestTracing`, `compression`, loggers | Observability |
| `apiMetricsMiddleware` | `/api/v1` |
| **`csrfProtection`** | **`/api/v1`** — double-submit cookie when `accessToken` cookie present |
| `paginationBounds` | Caps page/limit |
| Optional `enhancedAuditLogger`, `piiAccessLogger` | Audit / PII |
| Path-specific `piiResponseFilter` | e.g. `/api/v1/guests`, guest-services, etc. |
| `maintenanceMode` | Global gate |

**Per-route verification checklist (copy row for each endpoint):**

| Endpoint | Method | Router file | Auth | Tenant | Property | RBAC (`authorizePolicy`) | Validate (Joi) | Idempotency | Response shape vs client | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

**Status:** `verified` · `gap` · `deferred`

---

## Batch A — Auth (`/api/v1/auth`) — *core routes documented*

| Endpoint | Method | Middleware chain (high level) | Validation | Idempotency | Client notes |
| --- | --- | --- | --- | --- | --- |
| `/auth/register` | POST | `authLimiter`, `validate(schemas.register)` | `schemas.register` (role forced to `guest` in handler) | N/A | Sets httpOnly cookies + CSRF cookie; **no** `authenticate` (pre-login) |
| `/auth/login` | POST | `authLimiter`, `strictAuthLimiter`, `validate(schemas.login)` | `schemas.login` | N/A | Cookie session + CSRF |
| `/auth/me` | GET | `authenticate`, `authorizePolicy('auth','baseAccess')` | — | N/A | Returns `{ status, user }` — normalize with `authService` / `PropertyContext` (`data.user` vs nested `data.data.user`) |
| `/auth/switch-hotel` | POST | `authenticate`, `authorizePolicy('auth','baseAccess')`, `validate(schemas.switchHotel)` | `schemas.switchHotel` (`hotelId` ObjectId) | N/A | Staff roles only; updates `User.hotelId`, reissues JWT + cookies; **Bearer** skips CSRF (cookie session still needs `X-CSRF-Token`). HTTP integration: `npm run test:integration:switch-hotel` |
| `/auth/profile` | PATCH | `authenticate`, `ensurePropertyAccess`, `authorizePolicy`, `validate(updateProfile)` | `schemas.updateProfile` | N/A | |
| `/auth/change-password` | PATCH | `authenticate`, `ensurePropertyAccess`, `authorizePolicy`, `validate(changePassword)` | `schemas.changePassword` | N/A | |
| `/auth/refresh` | POST | `validate(mutationBaselineSchema)` only — **no** `authenticate` | `mutationBaselineSchema` (open object) | N/A | Uses **refresh** cookie; issues new access+refresh+CSRF; replay protection on refresh tokens |
| `/auth/logout` | POST | `validate(mutationBaselineSchema)` only | `mutationBaselineSchema` | N/A | Clears cookies; invalidates refresh token **family** |

**CSRF:** Any mutating `POST` under `/api/v1` with `accessToken` cookie requires `X-CSRF-Token` matching `csrfToken` cookie (`csrfProtection` in `server.js`). Login/register/refresh set CSRF cookie for subsequent calls.

---

## Batch A — Bookings (`/api/v1/bookings` + `/api/v1/bookings/enhanced`)

**Mount order:** `registerApiRoutes.js` mounts `noShowRoutes` then `bookingRoutes` on the same path prefix `/api/v1/bookings` — **first matching route wins**; ensure no path shadowing (verify in `routes/bookings.js` vs no-show router).

| Endpoint | Method | Middleware (representative) | Validation | Idempotency | Notes |
| --- | --- | --- | --- | --- | --- |
| `/bookings/` | POST | `authenticate`, `ensureTenantContext`, `authorizePolicy('bookings','create')`, `ensurePropertyAccess`, `bookingCompletionMiddleware`, `validate(createBooking)` | `schemas.createBooking` includes `idempotencyKey` | Body idempotency in `prepareBookingCreation` | **`reserveRoomsWithParentSession`** when physical rooms are assigned or **`primaryRoomTypeId`** hold; cancel calls **`releaseRooms`**; **`PATCH /:id`** resyncs calendar when stay/rooms/primary fields change |
| `/bookings/` | GET | `authenticate`, `ensureTenantContext`, `ensurePropertyAccess` | Query via handler | — | Guest: `query.userId = req.user._id` |
| `/bookings/enhanced/:id` | GET | See `routes/enhancedBookings.js` | — | — | Guest booking detail page uses this |

---

## Batch A — Payments (`/api/v1/payments`)

**Router-level:** `payments.js` applies `financialLimiter`, `authenticate`, `ensureTenantContext`, `ensurePropertyAccess` to **all** routes in the file.

| Endpoint | Method | Extra middleware | Validation | Idempotency |
| --- | --- | --- | --- | --- |
| `/payments/intent` | POST | `authorizePolicy('payments','createIntent')`, `enforceIdempotency` (as `idempotentFinancialMutation`), `validate(createPaymentIntent)` | Joi | **Yes** — Redis/memory namespace `payments` |

*Individual routes may repeat `authenticate` / tenant — redundant but harmless.*

---

## Batch B — Inventory, availability, rooms — *first pass*

**Mount paths:** `registerApiRoutes.js` — `/api/v1/inventory-management`, `/api/v1/availability`, `/api/v1/rooms` (rooms also uses `roomCacheMiddleware` where registered).

### B1 — Inventory management (`/api/v1/inventory-management`)

**File:** `routes/inventoryManagement.js`

Router applies `router.use(authenticate)` and `router.use(ensurePropertyAccess)` once; each route **also** repeats `authenticate` (redundant).

**Not applied on this router:** `ensureTenantContext` — `hotelId`/`tenant` scope relies on **JWT + property access** and controller logic; ties to **FAB-001** (client `hotelId` vs server enforcement) if query/body `hotelId` can diverge.

| Path | Method | RBAC | Validation | Notes |
| --- | --- | --- | --- | --- |
| `/` | GET | `authorizePolicy('inventoryManagement','readAccess')` | Query in controller | Calendar/admin inventory data |
| `/update` | POST | `manageAccess` | `mutationBaselineSchema` | Mutates `RoomAvailability` |
| `/bulk-update` | POST | `manageAccess` | `mutationBaselineSchema` | |
| `/stop-sell` | POST | `manageAccess` | `mutationBaselineSchema` | |
| `/calendar` | GET | `readAccess` | — | Aligns with admin `InventoryCalendar` UI |
| `/summary` | GET | `readAccess` | — | |
| `/create-range` | POST | `manageAccess` | `mutationBaselineSchema` | |

**FAB-004 linkage:** Inventory writes here; **`POST /bookings`** also reserves/releases via `availabilityService` when calendar rows exist (assigned rooms or catalog `roomTypeId` hold). Admin calendar edits remain a second write path — ops should keep hotel/date ranges consistent.

### B2 — Availability (`/api/v1/availability`)

**File:** `routes/availability.js`

| Path | Method | Auth | Notes |
| --- | --- | --- | --- |
| `/check` | GET | **None** on handler | Public-style availability check (booking funnel / APIs) |
| `/calendar` | GET | **None** on handler | Calendar |
| `/room-status` | GET | `authenticate`, `authorizePolicy('availability','staffAccess')`, `ensurePropertyAccess` | Staff |
| `/block`, `/unblock` | POST | `authenticate`, `manageAccess`, `ensurePropertyAccess`, `validate(mutationBaselineSchema)` | |
| `/occupancy` | GET | `authenticate`, `staffAccess`, `ensurePropertyAccess` | |
| `/alternatives` | GET | **None** on handler | |
| `/overbooking` | GET | `authenticate`, `staffAccess`, `ensurePropertyAccess` | Handler also requires **`hotelId` query** for service scoping |
| `/with-rates` | GET | **None** on handler | |
| `/search` | GET | **None** on handler | |

**Public `GET` scoping (verified 2026-03-27):** `availabilityController` requires **`hotelId` query** on `/check`, `/calendar`, `/alternatives`, `/with-rates`, `/search`, and **`/overbooking`** (legacy `availabilityService.checkAvailability` without `hotelId` previously queried rooms/bookings without a property filter — see **FAB-017**). Staff-only routes still pass `hotelId` from the client (`OverbookingConfiguration` + `availabilityService`).

### B3 — Rooms (`/api/v1/rooms`)

**File:** `routes/rooms.js`

| Path | Method | Middleware (representative) | Notes |
| --- | --- | --- | --- |
| `/` | GET | `authenticate`, `ensureTenantContext`, `ensurePropertyAccess` | Requires `hotelId` query (400 if missing) |
| *(other room routes)* | *varies* | Often `optionalAuth` / `authenticate` + tenant | See file for CRUD |

**Client alignment:** `bookingService.getRooms` calls `GET /rooms` with filters — must send `hotelId` (from `api.ts` / property context) or the handler returns **400** (`ApplicationError('Hotel ID is required')`).

---

## Batch C — Webhooks (Stripe + OTA) — *first pass*

**Mounts:** `registerApiRoutes.js` — `/api/v1/webhooks` (`webhooks.js`), `/api/v1/ota-webhooks` (`otaWebhooks.js`).

**Body parsing:** `server.js` applies `express.raw({ type: 'application/json' })` **only** to `/api/v1/webhooks` so Stripe signature verification sees the raw buffer. Other JSON routes use `express.json()`.

**CSRF:** `middleware/csrf.js` skips paths containing `/webhooks/` (Stripe). Paths under `/api/v1/ota-webhooks` do **not** match that substring; OTA calls typically have **no** `accessToken` cookie, so CSRF still no-ops (see `csrfProtection` “only if cookie session”). Bearer header also skips CSRF.

### C1 — Stripe (`POST /api/v1/webhooks/stripe`)

| Concern | Implementation |
| --- | --- |
| Auth | **None** (provider callback) |
| Signature | `stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)` |
| Idempotency | **`StripeWebhookEvent`** — `eventId` from Stripe; `processed` / `processing` short-circuit; `failed` retries |
| Config | 503 if `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` missing |

### C2 — OTA (`POST /api/v1/ota-webhooks/ota`)

| Middleware (order) | Role |
| --- | --- |
| `validate(mutationBaselineSchema)` | Permissive Joi |
| `verifyWebhookSignature` | HMAC-style verification per channel in **production**; non-prod allows unsigned with warning |
| `channelRateLimit` | Per-IP + channel |
| Handler | `reservation` / `modification` / `cancellation` / `rate_change` |

**Gap vs Stripe:** No persisted idempotency record in this file (unlike `StripeWebhookEvent`) — duplicate OTA deliveries may need channel-specific dedupe in handlers (verify in `handleReservation` etc.).

`GET /api/v1/ota-webhooks/health` — lightweight health check on OTA router.

---

## Batch D — Admin surfaces — *router-level pass*

**Mounts (representative):** `/api/v1/admin` → `routes/admin.js`; `/api/v1/admin-dashboard` → `routes/adminDashboard.js`; `/api/v1/admin/travel-dashboard`, `/api/v1/admin/hotel-services`, `/api/v1/admin/loyalty`, `/api/v1/admin/service-types`; `/api/v1/admin-bypass-management` (two routers: main + bypass financial analytics).

| Router file | Router-wide middleware | Pattern |
| --- | --- | --- |
| `adminDashboard.js` | `router.use(authenticate)`, `ensureTenantContext`, `ensurePropertyAccess` | All dashboard routes get tenant + property; per-route may add `authorize` / `authorizePolicy` |
| `admin.js` | **None** at `router.use` | **Per-route** — e.g. `GET /hotels` uses `authenticate`, `ensureTenantContext`, `ensurePropertyAccess`, `authorize(['admin','staff','frontdesk'])` |

**Verification note:** When extending `admin.js`, ensure new routes include **`ensureTenantContext`** where multi-tenant data is touched (first route already does); inconsistent omission would match **FAB-001** risk class.

**Batch E** — remaining mounts in `registerApiRoutes.js` (see table below).

---

## Batch E — Remaining `/api/v1/*` mounts — *inventory*

**Method:** For each router, read **top-of-file** `router.use(...)` and first few `router.(get|post|...)` lines — same checklist as Phase 4 intro table.

| Category | Example prefixes (not line-audited in Batches A–D) |
| --- | --- |
| Bookings adjacent | `/extra-person-pricing`, `/settlements`, `/pos-settlements`, `/approvals`, `/bookings/enhanced` (see `enhancedBookings.js`) |
| Ops / staff | `/housekeeping`, `/staff-dashboard`, `/staff/alerts`, `/staff-meetups`, `/staff-tasks`, `/staff/services`, `/daily-inventory-checks`, `/inventory-notifications` |
| Guest & services | `/guests`, `/guest-services`, `/guest-lookup`, `/guest-management`, `/guest-import`, `/reviews`, `/loyalty`, `/hotel-services` |
| Inventory & rooms (non–Batch B) | `/inventory`, `/inventory/analytics`, `/checkout-inventory`, `/room-inventory`, `/room-blocks`, `/room-types`, `/tape-chart` |
| Financial / POS | `/invoices`, `/billing-history`, `/billing-sessions`, `/financial`, `/pos`, `/pos/reports`, `/revenue-management`, `/channel-manager` |
| CRM / comms | `/communications`, `/message-templates`, `/booking-conversations`, `/crm`, `/segmentation`, `/personalization`, `/email-campaigns` |
| Config / system | `/hotel-settings`, `/settings`, `/integrations`, `/workflow`, `/feature-flags`, `/api-management`, `/credentials`, `/roles` |
| Travel / external | `/travel-agents`, `/external`, `/ota`, `/ota-amendments`, `/channels`, `/booking-engine` |
| Compliance / security | `/gdpr`, `/data-privacy`, `/security-monitoring`, `/audit`, `/audit-log`, `/audit-trail`, `/login-activity` |
| Misc | `/upload`, `/photos`, `/documents`, `/ai`, `/test`, `/night-audit`, `/cancellations` (if route present), … |

**Status:** Inventory **complete** for Phase 4 “breadth” goal; **depth** (per-endpoint rows) remains optional for high-risk paths only (payments, bookings, inventory, auth — covered in A–C).

---

## Phase 4 follow-up — Routed page -> service -> endpoint/RBAC matrix (2026-03-30)

**Scope:** Protected routed sets in `frontend/src/App.tsx` for `admin`, `frontdesk`, `staff`, `guest`, `travel_agent`.

| Routed set (examples) | Primary frontend service(s) | Backend endpoint group(s) | Role/RBAC expectation |
| --- | --- | --- | --- |
| `admin/*` — dashboard, rooms, bookings, staff, settings, analytics, reports, inventory/maintenance/supply, travel, documents | `adminService`, `dashboardService`, `reportsService`, `financialService`, `adminMaintenanceService`, `adminSupplyRequestsService`, `adminGuestServicesService` | `/api/v1/admin*`, `/api/v1/admin-dashboard`, `/api/v1/reports`, `/api/v1/financial`, `/api/v1/inventory*`, `/api/v1/maintenance`, `/api/v1/supply-requests`, `/api/v1/travel-agents`, `/api/v1/documents`, `/api/v1/settings` | `ProtectedRoute(['admin','manager'])`; backend expects `authenticate` + tenant/property guards, then admin-scoped policy/authorize checks per route |
| `frontdesk/*` — bookings, billing, guest-services, service-requests, housekeeping, daily-check, inventory, supply, travel-agents | `bookingService`, `dashboardService`, `financialService`, `guestService`, `hotelServicesService`, `housekeepingService`, `maintenanceService`, `dailyRoutineCheckService` | `/api/v1/bookings*`, `/api/v1/billing-*`, `/api/v1/guests`, `/api/v1/guest-services`, `/api/v1/service-requests`, `/api/v1/housekeeping`, `/api/v1/daily-routine-checks`, `/api/v1/inventory*`, `/api/v1/travel-agents` | `ProtectedRoute(['frontdesk'])`; backend policy should grant frontdesk operational read/write only (no admin-only config/analytics mutations) |
| `staff/*` — housekeeping, maintenance, alerts, meetups, guest-services, inventory/service/supply requests, checkout, reports, staff settings | `staffDashboardService`, `staffAlertService`, `housekeepingService`, `maintenanceService`, `guestService`, `dailyRoutineCheckService`, `staffSupplyRequestsService`, `notificationService` | `/api/v1/staff-dashboard`, `/api/v1/staff/alerts`, `/api/v1/staff-meetups`, `/api/v1/housekeeping`, `/api/v1/maintenance`, `/api/v1/guest-services`, `/api/v1/inventory-requests`, `/api/v1/service-requests`, `/api/v1/checkout-inventory`, `/api/v1/reports` | `ProtectedRoute(['staff'])`; backend expects staff-limited policy surface with property-scoped access and no escalation into admin-only routes |
| `app/*` (guest) — bookings, loyalty, services, notifications, keys, meet-ups, documents, billing, requests, settings | `guestService`, `bookingService`, `loyaltyService`, `hotelServicesService`, `notificationService` | `/api/v1/bookings*`, `/api/v1/loyalty`, `/api/v1/hotel-services`, `/api/v1/notifications`, `/api/v1/digital-keys`, `/api/v1/meet-up-requests`, `/api/v1/documents`, `/api/v1/billing-history`, `/api/v1/guest-services`, `/api/v1/inventory-requests` | `ProtectedRoute(['guest'])`; backend should enforce self-only guest access (`userId` constrained), guest-safe projection, and property isolation |
| `travel-agent/*` — dashboard, booking create/multi-booking, rates, notifications, profile/settings | `travelAgentService`, `bookingService` | `/api/v1/travel-agents`, `/api/v1/bookings`, `/api/v1/rates` (or pricing endpoints), `/api/v1/notifications` | `ProtectedRoute(['travel_agent'])`; backend should enforce travel-agent domain permissions and prevent access to internal admin/staff operational routes |

### Confirmed fixed areas (from Phase 4 wave notes)

| Area | Confirmation |
| --- | --- |
| Availability property scoping (`FAB-017`) | Public availability reads now require `hotelId`; frontend path alignment to `/availability/check` corrected (see changelog 2026-03-27). |
| Route ordering / routing collisions | Wave 2/3 campaign notes indicate routing collision fixes across routed role surfaces. |
| WebSocket naming parity | Event naming alignment documented in Wave 2/3 notes; lowers cross-role real-time drift. |
| Role-scoped action leakage | Wave 2/3 notes mark role-safe route/service behavior tightening for admin/frontdesk/staff/guest/travel-agent flows. |
| Selected-property/hotelId propagation | Wave 2/3 notes confirm propagation normalization through shared service calls. |
| Pagination/filter contract normalization | Shared service contract normalization (`page/limit/sort/order`) documented in 2026-03-30 changelog notes. |
| Settings/report export contract fixes | Follow-up notes confirm settings apply endpoint normalization and analytics/report export path corrections. |

### Remaining risk tags (post follow-up)

| Tag | Remaining risk | Current status |
| --- | --- | --- |
| `FAB-001` | Tenant/property enforcement consistency remains dependent on per-route middleware completeness in some mixed routers (notably legacy-style admin variants) | **Monitor** during per-endpoint deep audit |
| `FAB-004` | Inventory write-path duality (calendar/admin edits vs booking reservation/release path) can still drift operationally if date/property controls diverge | **Operational guardrails needed** |
| `FAB-OTA-IDEMPOTENCY` | OTA webhook dedupe persistence parity with Stripe webhook event store is not yet confirmed | **Deferred deep dive** |
| `FAB-RBAC-EDGE` | Large routed surface area means occasional role/policy edge mismatches may still exist in long-tail endpoints | **Sampled/fixed in Wave 2/3; continue spot checks** |
| `FAB-RESPONSE-SHAPE` | Shared service normalization reduced drift, but legacy endpoints may still return variant envelopes requiring adapter logic | **Low-to-medium residual risk** |

---

## Next batches (Phase 4 roadmap)

| Batch | Scope | Priority |
| --- | --- | --- |
| ~~B~~ | ~~`inventoryManagement`, `availability`, `rooms`~~ | **First pass done** (see above); deep controller review deferred |
| ~~C~~ | ~~`webhooks` (Stripe), `otaWebhookRoutes`~~ | **First pass done** (see above); OTA handler idempotency deep-dive deferred |
| ~~D~~ | ~~`admin` sub-routers~~ | **Router-level pass** (see above); per-endpoint admin matrix deferred |
| ~~E~~ | ~~Remaining `registerApiRoutes` entries~~ | **Prefix inventory** (see Batch E table); line-level audit deferred |

---

## Phase 5 closure (2026-03-30)

### What was verified in Phases 4/5

| Area | Verification outcome |
| --- | --- |
| Global API middleware contract (`/api/v1`) | Verified baseline stack ordering (auth-adjacent layers, CSRF behavior, pagination bounds, tracing/logging) and impact on all mounted routers. |
| High-risk endpoint families | Verified representative endpoint chains for `auth`, `bookings`, `payments`, `inventory-management`, `availability`, `rooms`, and webhook ingress (`webhooks`, `ota-webhooks`). |
| Routed role surfaces | Verified routed-page -> frontend service -> backend endpoint mapping for `guest`, `frontdesk`, `staff`, `admin`, and `travel_agent` protected areas. |
| Property/tenant propagation | Verified selected-property and `hotelId` propagation normalization across shared frontend service calls and key backend checks. |
| Contract normalization | Verified ongoing normalization of pagination/sort/filter and response-shape expectations for heavily used role flows and exports/settings paths. |
| Phase 5 closure confidence | Verified that previously identified high-impact gaps now have either a confirmed fix path (resolved tags) or explicit owner/severity follow-up (outstanding tags below). |

### Resolved risk tags

| Tag | Resolution status | Closure note |
| --- | --- | --- |
| `FAB-017` | **Resolved** | Public availability read paths require `hotelId`; client path alignment corrected to `/availability/check`. |
| `FAB-ROUTE-COLLISION` | **Resolved** | Route ordering collision fixes documented in Wave 2/3 routed-page campaign and follow-up notes. |
| `FAB-WS-EVENT-PARITY` | **Resolved** | WebSocket event naming parity documented across role surfaces to reduce real-time drift. |
| `FAB-PROPAGATION-HOTELID` | **Resolved** | Selected-property/`hotelId` propagation normalized through shared service paths in follow-up wave. |
| `FAB-PAGINATION-CONTRACT` | **Resolved** | Shared service pagination/filter contract normalization (`page/limit/sort/order`) documented as completed for covered flows. |
| `FAB-SETTINGS-EXPORT-CONTRACT` | **Resolved** | Settings apply contract and analytics/report export path fixes captured in 2026-03-30 follow-up. |

### Outstanding risk tags (severity + suggested owner)

| Tag | Severity | Remaining risk | Suggested owner |
| --- | --- | --- | --- |
| `FAB-001` | **High** | Mixed/legacy routers can still miss tenant/property middleware on long-tail endpoints if added inconsistently. | **Backend Platform + API Governance** (route middleware standards + CI route checks) |
| `FAB-004` | **Medium-High** | Dual inventory write paths (calendar/admin edits vs booking reserve/release) can drift operationally without strict reconciliation controls. | **Inventory/Booking Domain Team + Hotel Ops** (reconciliation jobs + guardrails) |
| `FAB-OTA-IDEMPOTENCY` | **High** | OTA webhook dedupe persistence parity with Stripe event-store behavior is not fully confirmed. | **Integrations Team** (persistent dedupe + replay tests) |
| `FAB-RBAC-EDGE` | **Medium** | Long-tail role/policy mismatches remain possible due to very large routed/API surface. | **Security/RBAC Owners + Feature Teams** (policy matrix spot-audits) |
| `FAB-RESPONSE-SHAPE` | **Low-Medium** | Legacy endpoints may still return variant envelopes requiring adapters and increasing regression risk. | **Frontend Platform + API Owners** (response contract conformance pass) |

### Smoke-test checklist (role-based)

> Run after deploy and before sign-off; validate both success and expected-deny behavior.

#### Guest
- [ ] Login, refresh, logout cookie flow works; mutating requests include valid CSRF header/cookie pair.
- [ ] View own bookings, documents, billing history, loyalty, notifications; no access to another guest's records.
- [ ] Submit guest service/inventory/meet-up requests and verify responses use expected envelope shape in UI.
- [ ] Confirm property switch/context reload keeps `hotelId`-scoped data consistent across all guest dashboards.

#### Frontdesk
- [ ] Create/update/cancel booking and verify room reserve/release side-effects reconcile with availability/calendar.
- [ ] Access frontdesk billing/history/guest-services/housekeeping pages with correct role permissions.
- [ ] Confirm frontdesk user cannot access admin-only settings/analytics mutation endpoints.
- [ ] Validate paginated lists (bookings, requests, guests) honor `page/limit/sort/order` and preserve UX state.

#### Staff
- [ ] Access staff dashboard, alerts, housekeeping, maintenance, service/inventory request flows with staff policy scope.
- [ ] Confirm staff settings/profile endpoints resolve correctly and reject unauthorized admin mutations.
- [ ] Verify staff cannot read or mutate data outside assigned property context.
- [ ] Validate report/list pages use paginated queries and render safely with empty/error states.

#### Admin
- [ ] Access admin dashboard/settings/reports/analytics paths and verify authenticated tenant/property-scoped behavior.
- [ ] Confirm settings apply endpoint contract is stable and returns expected shape for UI integration.
- [ ] Validate export/report endpoints return expected formats and do not bypass auth/tenant/property checks.
- [ ] Spot-check legacy admin router endpoints for consistent middleware chain (`authenticate` + tenant/property + policy).

#### Travel-agent
- [ ] Login and access dashboard, rates, booking create/multi-booking flows using travel-agent permitted APIs only.
- [ ] Confirm travel-agent cannot call internal staff/admin operational endpoints.
- [ ] Validate pricing/availability lookups require correct property context and return expected contract.
- [ ] Verify notification/profile/settings actions persist and rehydrate correctly after token refresh.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-03-27 | Phase 4 started: global stack + Batch A (auth, bookings, payments) scaffold. |
| 2026-03-27 | Phase 4 continued: Auth **refresh** + **logout**; **Batch B** inventory / availability / rooms tables + FAB-004/FAB-001 cross-references. |
| 2026-03-27 | **Batch C** Stripe + OTA webhooks (signature, Stripe idempotency, CSRF/raw-body notes, OTA idempotency gap). |
| 2026-03-27 | **Batch D** admin router-level patterns (`admin.js` vs `adminDashboard.js` + FAB-001 note). |
| 2026-03-27 | **Batch E** remaining `/api/v1` mount categories (breadth inventory; depth deferred). |
| 2026-03-27 | **Production readiness:** required `hotelId` on public availability reads + **`FAB-017` fixed**; frontend **`/availability/check`** path corrected. |
| 2026-03-30 | **Wave 2/3 routed-page campaign (parallel agents):** guest/frontdesk/staff/admin/travel-agent + shared services contracts audited and patched (route ordering collisions, websocket event naming parity, role-scoped action leakage, selected-property/hotelId propagation, pagination/filter contract normalization, export format consistency). |
| 2026-03-30 | **Admin settings/analytics + staff/guest/fd follow-up:** settings apply contract normalization (`/settings/apply`), analytics/report export path fixes, frontdesk role-safe operational routing, staff settings endpoint alignment, guest loyalty/doc/settings guard + pagination fixes, shared service param normalization (`page/limit/sort/order`). |
| 2026-03-30 | **Phase 5 docs closure:** added verified scope summary, resolved risk-tag set, outstanding risk tags with severity/owner suggestions, and role-based smoke-test checklist for guest/frontdesk/staff/admin/travel-agent. |
| 2026-03-30 | **Phase 5.2 regression execution:** frontend production build passes; critical backend role-flow route syntax checks pass; lint command now executes with flat config but reports existing repository lint backlog (non-blocking for build, blocking for lint-gate). |
