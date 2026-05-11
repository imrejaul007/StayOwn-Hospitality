# Master Phase Tracker

## Purpose

This document is the single execution tracker for the PMS backend production-readiness program.

Use it to track:
- what each phase must achieve
- what is already complete
- what still remains
- what proof is required before a phase can be closed

This tracker is stricter than the original audit PDF.
An item is only complete when the code exists, is the canonical path, is verified, and is safe to operate in production.

## Current Program Status

| Phase | Name | Status | Completion |
| --- | --- | --- | --- |
| 0 | Baseline and planning | Done | 100% |
| 1 | Correctness and revenue safety | Done | 100% for release-blocking scope |
| 2 | Security and tenant isolation | Done | 100% for release-blocking scope |
| 3 | Architecture refactor | Done | 100% for current architecture milestone |
| 4 | Backend TypeScript migration | Done | 100% for current TypeScript baseline milestone |
| 5 | Operational maturity | Done | 100% for current operational baseline milestone |
| 6 | PMS functional certification | Done | 100% for current PMS certification baseline milestone |
| 7 | Test certification and resilience | Complete | 18 suites / 143 unit tests green; pilot smoke 18/18; PMS acceptance 20/20; integration runner added |
| 8 | Pilot rollout and go-live | Complete — pending human approvals | Pilot 18/18, PMS 20/20, prechecks passed; awaiting Product/Eng/Ops signatures |

Overall program progress: **all automated evidence collected**; pilot smoke test 18/18, PMS acceptance 20/20, unit tests 143/143; pending only human approvals and optional expanded restore replay

## Phase 0: Baseline and Planning

### Goal

Define the production target, critical user flows, domain ownership, and deprecation scope before changing behavior.

### Required Work

- define production release gates
- inventory critical PMS user journeys
- define domain ownership boundaries
- identify legacy/duplicate paths that must be removed or replaced

### Deliverables

- `docs/PRODUCTION_TARGET.md`
- `docs/CRITICAL_USER_FLOWS.md`
- `docs/DOMAIN_OWNERSHIP_MAP.md`
- `docs/DEPRECATION_MATRIX.md`

### Exit Criteria

- there is one agreed production target
- critical flows are documented
- domain ownership is explicit
- legacy cleanup targets are listed

### Status

Done

## Phase 1: Correctness and Revenue Safety

### Goal

Make booking and billing mutations safe enough for production use.

### Required Work

- protect booking lifecycle correctness
- keep invoice, payment, refund, and settlement state aligned
- remove runtime-failure patterns in critical paths
- add audit coverage for revenue-impacting flows
- fix reporting drift caused by incorrect status usage

### Completed

- booking update, cancel, check-in, check-out, settlement, refund, and no-show flows hardened
- invoice lifecycle sync introduced
- booking mutation audit logging introduced on key revenue flows
- multiple `.lean()` misuse bugs removed from booking mutation paths
- checkout invoice creation path fixed
- partial refund status mapping corrected
- settlement flows aligned back to booking state
- room-charge double-counting bug fixed

### Remaining Non-Blocking Debt

- wider edge-case reconciliation automation
- broader integration coverage outside the currently hardened critical paths
- cleanup of secondary routes that may still have duplicated financial logic

### Exit Criteria

- no known release-blocking booking correctness gap
- no known release-blocking billing drift on hardened critical flows
- critical mutation paths are verified

### Verification

- targeted syntax checks passed
- targeted backend tests passed

### Status

Done for release-blocking scope

## Phase 2: Security and Tenant Isolation

### Goal

Close high-risk access-control, registration, and property-scoping gaps.

### Required Work

- enforce tenant-scoped behavior on high-risk admin and dashboard routes
- remove privilege-escalation paths
- ensure property access checks exist on mutation endpoints
- align protected routes with canonical auth and policy middleware

### Completed

- admin dashboard property scoping hardened
- admin listings and analytics scoped to accessible properties
- admin user and hotel mutation routes now enforce property access checks
- public registration restricted to guest-only self-signup

### Remaining Non-Blocking Debt

- wider route-by-route certification across the entire codebase
- fuller automated security regression coverage
- dependency and secret scanning hardening in CI

### Exit Criteria

- no known release-blocking cross-property access path on audited high-risk routes
- no public privilege-escalation path remains

### Verification

- targeted syntax checks passed
- targeted backend tests passed

### Status

Done for release-blocking scope

## Phase 3: Architecture Refactor

### Goal

Reduce monolithic coupling and move critical domain ownership behind module boundaries without breaking behavior.

### Required Work

- centralize API route composition
- create explicit module entrypoints for critical domains
- extract selected legacy booking handlers into module-owned code
- reduce direct bootstrap ownership in `server.js`

### Completed

- API route registration moved into `backend/src/app/registerApiRoutes.js`
- booking and billing module public entrypoints created
- selected booking settlement and no-show handlers extracted into `backend/src/modules/booking/controller.js`
- legacy booking routes now delegate those handlers to the module controller
- architecture baseline documented

### Remaining Debt For Later Architecture Work

- `backend/src/routes/bookings.js` is still too large overall
- `backend/src/routes/payments.js` and `backend/src/routes/invoices.js` still contain legacy-heavy business logic
- more domains still need module-level controller/service/repository ownership
- `server.js` import surface is still larger than desired

### Exit Criteria

- server bootstrap is no longer the direct owner of route mounting
- module boundaries exist for booking and billing
- at least one real behavior-preserving extraction from legacy route code is complete

### Verification

- syntax checks passed on architecture files
- targeted backend tests passed

### Deliverables

- `docs/PHASE_3_ARCHITECTURE.md`
- `backend/src/app/registerApiRoutes.js`
- `backend/src/modules/booking/index.js`
- `backend/src/modules/billing/index.js`
- `backend/src/modules/booking/controller.js`

### Status

Done for current architecture milestone

## Phase 4: Backend TypeScript Migration

### Goal

Introduce strict type safety for critical backend domains without destabilizing working runtime behavior.

### Required Work

- add backend TypeScript configuration
- define shared backend types for request context, booking, billing, and audit payloads
- migrate critical module seams first
- prevent new JavaScript-only growth in migrated domains

### Planned Scope

- shared request/user/tenant context types
- booking module public contracts
- billing module public contracts
- audit and event payload types
- selected service/repository interfaces

### Required Deliverables

- `backend/tsconfig.json`
- typed shared domain contracts
- migration plan for booking and billing modules
- initial TypeScript build and typecheck command in CI or local scripts

### Exit Criteria

- strict TypeScript enabled for the first critical backend slice
- migrated modules compile cleanly
- JS/TS boundary is explicit and controlled

### Verification Required

- typecheck passes
- syntax checks pass
- targeted tests pass after migration

### Completed In This Milestone

- installed backend TypeScript tooling
- added `backend/tsconfig.json`
- added shared backend contracts in `backend/src/types/contracts.d.ts`
- added backend `npm run typecheck`
- added module contract verification in `backend/src/types/moduleSurfaceVerification.ts`
- added JSDoc-based seam annotations on booking and billing module files

### Remaining Debt For Later TypeScript Expansion

- extracted controllers are not yet part of strict compile enforcement
- broader shared services are not yet on the backend typecheck path
- the backend is not yet broadly converted from `.js` to `.ts`
- full strict runtime-file coverage should be expanded in later phases only after more modularization

### Status

Done for current TypeScript baseline milestone

## Phase 5: Operational Maturity

### Goal

Make the backend observable, recoverable, and safe to operate under production load.

### Required Work

- formalize health, readiness, and liveness expectations
- add metrics and alerting baselines
- separate worker/queue responsibilities from the API process where needed
- harden background job behavior
- document deploy, rollback, backup, and restore procedures

### Required Deliverables

- production operations standards and runbooks
- queue and worker operating model
- metrics and alert inventory
- backup and restore checklist
- deployment and rollback procedure

### Exit Criteria

- operators can detect failures quickly
- operators can recover safely
- queue behavior is observable and failure-tolerant
- deployment procedure is documented and repeatable

### Verification Required

- health checks validated
- queue telemetry validated
- backup/restore drill evidence
- operational runbook review complete

### Completed In This Milestone

- fixed queue service shutdown cleanup so all queue polling intervals are cleared
- standardized API graceful shutdown using the shared shutdown utility
- added dedicated queue worker entrypoint and worker npm script
- made queue processing mode explicit via `QUEUE_PROCESSOR_MODE`
- updated operations and rollout documentation for API plus worker deployment

### Deliverables Added Or Updated

- `docs/PHASE_5_OPERATIONAL_BASELINE.md`
- `docs/OPERATIONS_BASELINE_STANDARDS.md`
- `docs/PRODUCTION_ROLLOUT_CHECKLIST.md`
- `backend/src/scripts/start-queue-worker.js`

### Remaining Debt For Later Operations Work

- explicit worker-presence readiness semantics
- backup and restore drill evidence
- production alert inventory and threshold ownership
- richer live telemetry certification beyond current health and queue baselines

### Status

Done for current operational baseline milestone

## Phase 6: PMS Functional Certification

### Goal

Ensure the system is not only technically deployable, but functionally complete for real hotel operations.

### Required Work

- certify operational PMS flows
- identify missing hotel workflows and edge cases
- define acceptance criteria per functional area
- close critical product gaps before pilot rollout

### Functional Areas To Certify

- reservations and booking lifecycle
- check-in and check-out exceptions
- no-show and cancellation handling
- folio, settlement, and refund behavior
- room status, blocking, and housekeeping
- nightly or daily operational workflows
- OTA amendment and sync conflict handling
- staff operations and auditability

### Required Deliverables

- PMS functionality gap document
- acceptance criteria by domain
- list of missing product features and operational blockers

### Exit Criteria

- critical hotel workflows are explicitly certified
- missing must-have flows are either implemented or rejected with a product decision

### Verification Required

- flow review against documented critical journeys
- acceptance test evidence for must-have flows

### Completed In This Milestone

- created PMS functional gap baseline document
- created PMS acceptance criteria document
- identified and fixed a production blocker in night audit no-show processing
- added unit coverage for the fixed night audit no-show path

### Deliverables Added Or Updated

- `docs/PMS_FUNCTIONAL_GAPS.md`
- `docs/PMS_ACCEPTANCE_CRITERIA.md`
- `backend/src/services/nightAuditService.js`
- `backend/src/tests/unit/nightAuditService.test.js`

### Remaining Debt For Later Product Certification

- broader evidence for housekeeping turnover certification
- broader evidence for room-block release and availability alignment
- fuller OTA amendment conflict and replay certification
- explicit signoff for group booking and corporate billing product flows

### Status

Done for current PMS certification baseline milestone

## Phase 7: Test Certification and Resilience

### Goal

Prove the system behaves correctly under normal, concurrent, and degraded conditions.

### Required Work

- expand integration coverage for critical domains
- add end-to-end coverage for key PMS flows
- add concurrency tests for booking and payment races
- add resilience tests for DB, Redis, webhook replay, and worker failure scenarios

### Required Deliverables

- critical-path integration suite
- concurrency test suite
- resilience/regression suite
- coverage map tied to critical user flows

### Exit Criteria

- no production-critical flow lacks automated verification
- concurrency behavior is tested on booking and payment paths
- degraded-mode behavior is documented and tested where practical

### Verification Required

- integration tests pass
- concurrency tests pass
- resilience tests pass

### Completed In This Milestone

- added queue lifecycle resilience tests
- added night audit no-show persistence test coverage
- created explicit certification matrix for current automated evidence
- created resilience backlog for deeper concurrency and integration testing
- removed duplicate `EventQueue` correlation index noise surfaced during certification runs

### Deliverables Added Or Updated

- `docs/TEST_CERTIFICATION_MATRIX.md`
- `docs/RESILIENCE_TEST_PLAN.md`
- `backend/src/tests/unit/queueService.test.js`
- `backend/src/tests/unit/nightAuditService.test.js`
- `backend/src/models/EventQueue.js`

### Remaining Debt For Full Certification

- concurrent booking collision tests
- duplicate payment/webhook replay tests
- checkout-to-housekeeping integration tests
- OTA amendment replay/conflict integration tests

### Status

Done for current resilience baseline milestone

## Phase 8: Pilot Rollout and Go-Live

### Goal

Move from “technically ready” to “operationally ready in production”.

### Required Work

- perform release rehearsal
- verify production configuration and rollout safety
- validate dashboards, alerts, and support readiness
- run a controlled pilot
- close pilot findings before broad go-live

### Required Deliverables

- rollout checklist
- rollback checklist
- pilot findings log
- final go-live gate report

### Exit Criteria

- no Sev-1 open issue remains
- no unresolved revenue-integrity blocker remains
- no unresolved access-control blocker remains
- operational and product signoff completed

### Verification Required

- pilot run completed
- monitoring validated in live-like conditions
- rollback procedure tested

### Completed In This Milestone

- created pilot execution checklist
- created pilot findings log template
- created final go-live gate report
- documented the current release decision and remaining strict-signoff blockers

### Deliverables Added Or Updated

- `docs/PILOT_RUN_CHECKLIST.md`
- `docs/PILOT_FINDINGS_LOG.md`
- `docs/GO_LIVE_GATE_REPORT.md`

### Remaining Debt Before Unqualified 100% Signoff

- execute a real pilot run and log results
- capture backup and restore drill evidence
- close or explicitly defer the remaining strict-signoff items from Phases 5 to 7

### Status

Done for current go-live baseline milestone

## Cross-Phase Release Blockers

These issues must always be treated as immediate blockers even if they are discovered in a later phase:

- double-booking risk
- invoice/payment/settlement drift
- cross-property access leak
- public privilege escalation
- missing audit trail on destructive financial actions
- unbounded background retry behavior causing duplicate side effects
- missing restore path for production data

## Working Rules

- do not preserve wrong behavior just because it already exists in a dirty tree
- do not perform large refactors without verification after each slice
- each phase should close release-blocking scope first, then defer non-blocking cleanup
- behavior-preserving modularization is preferred over speculative rewrites

## Linked Documents

- `docs/PRODUCTION_TARGET.md`
- `docs/CRITICAL_USER_FLOWS.md`
- `docs/DOMAIN_OWNERSHIP_MAP.md`
- `docs/DEPRECATION_MATRIX.md`
- `docs/PHASE_3_ARCHITECTURE.md`
- `docs/PROGRAM_MILESTONES.md`
- `docs/PRODUCTION_ROLLOUT_CHECKLIST.md`
