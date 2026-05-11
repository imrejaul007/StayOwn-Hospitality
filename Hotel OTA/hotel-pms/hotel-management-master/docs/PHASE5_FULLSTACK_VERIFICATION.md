# Phase 5 — Full-stack verification (audit track)

**Purpose (from full-stack audit):** Run automated checks, record **pass/fail evidence**, and list **manual critical journeys** so go-live confidence does not depend only on code review.

**Note:** This is separate from `docs/PHASE_5_OPERATIONAL_BASELINE.md` (queue/worker ops maturity).

---

## 1. Backend — Jest

| Command | Role |
| --- | --- |
| `cd backend && npm run test:unit` | Fast unit tests under `src/tests/unit/` (no full `server.js` import). |
| `cd backend && npm run test:integration` | All ESM integration tests under `src/tests/integration/`. |
| `cd backend && npm run test:integration:gate` | **CI gate:** `multiProperty.integration.test.js` only (stable; matches `backend-quality.yml`). |
| `cd backend && npm run test:integration:http` | **Local:** `auth.integration` + `booking.integration` (HTTP + `server.js`) — run with `--runInBand`; may need Mongo URI alignment with the app (see suite comments if timeouts occur). |
| `cd backend && npm test` | Full Jest default (same config as `test`). |

**Layout fix (2026-03-27):** `auth` and `booking` HTTP tests lived under `unit/` but import `server.js` (top-level `await`); they were moved to:

- `backend/src/tests/integration/auth.integration.test.js`
- `backend/src/tests/integration/booking.integration.test.js`

`test:integration` now targets `src/tests/integration` only.

**Known issues:**

- **Windows / CI:** `mongodb-memory-server` can fail with `EACCES` / port bind when many suites run; retry or run with fewer parallel workers.
- **Integration suite:** Long-running; may log `Cannot log after tests are done` if background timers (e.g. OTA monitoring) fire after Jest teardown — treat as hygiene follow-up, not a functional pass/fail for Phase 5 breadth.

---

## 2. Frontend E2E — Playwright

| Command | Role |
| --- | --- |
| `npm run test:e2e:install` | Install browsers (once per machine). |
| `npm run test:e2e -- --project=chromium` | All specs, Chromium only (faster). |
| `npm run test:e2e:auth` | `e2e-tests/tests/01-authentication.spec.ts` only. |

Config: `playwright.config.ts` — starts backend (`:4000`) and frontend (`:3000`) via `webServer` unless URLs already respond.

**Evidence:** Store HTML/JSON reports under `e2e-tests/reports/` after a full run; copy summary into `docs/evidence/phase5-verification.json`.

---

## 3. Manual critical journeys (minimum)

Run once per release candidate; record date + operator in evidence JSON.

1. Login (guest + staff) — session and CSRF on mutations.
2. Search availability / rooms with **`hotelId`** (public or app) — aligns with FAB-017 enforcement.
3. Create booking → pay or hold (per env) → confirm booking visible in list.
4. Admin: open inventory calendar for same property as booking.

---

## 4. Related scripts (optional)

| Script | Use |
| --- | --- |
| `cd backend && npm run pilot:precheck` | Environment / dependency checks |
| `cd backend && npm run pilot:smoke` | Smoke against configured base URL |

---

## Status

| Area | Automated | Evidence file |
| --- | --- | --- |
| Backend unit | `npm run test:unit` | `docs/evidence/phase5-verification.json` |
| Backend integration | `npm run test:integration` | Same (append run) |
| Playwright | `npm run test:e2e` | `e2e-tests/reports/results.json` + same |

**Phase 6** (backlog): Convert open `FAB-*` items into prioritized tickets with acceptance criteria.
