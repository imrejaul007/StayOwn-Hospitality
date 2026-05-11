# PMS Acceptance Criteria

## Purpose

This document defines the minimum product-level acceptance criteria for critical PMS workflows.

## 1. Night Audit

Acceptance criteria:
- scheduled audit can run for active hotels without runtime mutation failures
- manual audit can be triggered safely by authorized staff
- no-shows are processed for unarrived confirmed bookings
- settlement verification results are captured in the audit summary
- failures are logged with actionable error detail

Evidence required:
- service-level verification
- scheduled/manual execution verification
- operator-visible failure reporting

## 2. Housekeeping Turnover

Acceptance criteria:
- checked-out rooms do not remain falsely ready for sale
- housekeeping task lifecycle supports assignment, progress, completion, and inspection
- clean-to-ready flow results in consistent room status for operations and availability consumers

Evidence required:
- flow verification across housekeeping and room status services
- at least one automated verification path for the turnover baseline

## 3. Maintenance / Room Block

Acceptance criteria:
- blocked rooms are excluded from availability
- room block creation updates operational visibility
- releasing a block restores correct sellable/non-sellable state

Evidence required:
- service-level verification for block create/release
- availability verification against blocked inventory

## 4. Folio / Settlement / Refund

Acceptance criteria:
- front desk can see consistent balance due and paid state
- checkout settlement reflects posted charges and applied refunds
- invoice and booking payment states do not drift after refund or settlement updates

Evidence required:
- integration verification for checkout and refund scenarios
- reconciliation evidence for the supported payment paths

## 5. OTA Amendments

Acceptance criteria:
- pending amendments can be approved or rejected safely
- duplicate or replayed amendment processing does not corrupt local booking state
- operators can identify failed or conflicting amendment flows

Evidence required:
- workflow verification for approve/reject paths
- retry/conflict handling evidence

## 6. Group Booking / Corporate Billing

Acceptance criteria:
- grouped or corporate financial flows produce deterministic billing outcomes
- staff-facing operational state remains understandable during group/corporate workflows

Evidence required:
- representative product flow review
- backend verification for primary billing and booking state transitions
