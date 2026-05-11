# PMS Functional Gaps

## Purpose

This document tracks the product-level PMS gaps that remain after core backend hardening work.

A feature is not considered complete only because a route or model exists.
For Phase 6, each area must be evaluated for:

- canonical flow ownership
- safe mutation behavior
- operational correctness
- edge-case handling
- observability
- test evidence

## Current Assessment Summary

### Certified Or Strong Baseline

- booking lifecycle baseline
  - create
  - modify
  - cancel
  - check-in
  - check-out
  - no-show
- settlement and invoice synchronization baseline
- room blocking and availability baseline
- housekeeping task management baseline
- scheduled night audit baseline exists
- OTA amendment workflow baseline exists

### Partial / Needs Certification

- night audit correctness and retryability
- housekeeping turnover completion path
- room-block release and downstream room-state consistency
- OTA amendment conflict handling and duplicate safety
- folio-level guest financial certification
- group booking and corporate billing operational certification

### Missing Or Not Yet Proven

- explicit pilot-grade acceptance signoff for all P1 operational flows
- end-to-end certification evidence for daily hotel operations
- clearly documented operator playbooks for failed PMS workflows

## Domain Gap Matrix

## 1. Night Audit

Current state:
- scheduled job exists
- manual route exists
- service performs inventory, reconciliation, revenue posting, no-show processing, settlement verification, and lock-day steps

Gaps:
- product-level certification is not complete
- retry and failure recovery expectations are not formally documented
- room-charge posting and journal behavior need broader verification in live-like conditions

Phase 6 blocker fixed:
- no-show processing inside night audit was using lean results and then calling `save()`
- fixed in `backend/src/services/nightAuditService.js`

## 2. Housekeeping Turnover

Current state:
- housekeeping tasks and QA inspection flows exist
- room status and tape-chart operational services exist

Gaps:
- turnover certification from check-out to clean to ready is not yet explicitly proven
- room-state consistency between housekeeping and room/tape-chart operations needs acceptance-test evidence

## 3. Maintenance And Room Blocks

Current state:
- room block routes and tape-chart room block services exist
- availability service checks blocked rooms

Gaps:
- release and status restoration behavior needs explicit certification
- operations need clear evidence that blocked inventory is consistently excluded from all selling paths

## 4. Folio / Settlement / Refund Behavior

Current state:
- booking settlement, invoice sync, refund state, and payment reconciliation baseline are hardened

Gaps:
- folio-level operational certification still needs explicit product acceptance criteria
- broader end-to-end test evidence is still needed

## 5. OTA Amendments And Channel Sync

Current state:
- OTA amendment routes and workflow hooks exist
- queue/retry infrastructure baseline exists

Gaps:
- duplicate/replay and conflict-resolution certification is not yet complete
- operator guidance for failed or conflicting amendments is not yet formalized

## 6. Group Booking / Corporate Billing

Current state:
- there is corporate and billing functionality in the codebase

Gaps:
- production certification for real group-stay operational flows is not yet explicit
- financial and operational acceptance criteria for group/corporate scenarios need formal signoff

## Release-Blocking Functional Risks

- night audit failure leaving arrivals unprocessed
- room turnover status drift between checkout, housekeeping, and room availability
- blocked-room inventory accidentally becoming sellable
- OTA amendment conflict corrupting local booking state
- folio or settlement mismatch visible to front desk at checkout

## Phase 6 Deliverables

- `docs/PMS_FUNCTIONAL_GAPS.md`
- `docs/PMS_ACCEPTANCE_CRITERIA.md`

## Exit Rule

Phase 6 is complete only when each PMS operational area is either:

- certified with explicit acceptance criteria and evidence, or
- listed as deferred by a conscious product decision with documented risk
