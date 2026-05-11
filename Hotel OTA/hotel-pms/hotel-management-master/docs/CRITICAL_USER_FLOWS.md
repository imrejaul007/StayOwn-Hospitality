# Critical User Flows

## Purpose
These are the flows that must be correct before the system can be called production-ready for hotel operations.

## P0 Revenue And Reservation Flows

### 1. Search Availability
Actors:
- guest
- front desk
- staff

Minimum expected behavior:
- availability reflects real room occupancy and blocks overlaps
- hotel/property scope is enforced
- performance is acceptable under normal hotel load

Key gaps to verify:
- all search paths use the same canonical availability rules
- cache and DB reads do not diverge by property

### 2. Create Booking
Actors:
- guest
- front desk
- admin

Minimum expected behavior:
- idempotent request handling
- overlap-safe booking creation
- transaction-safe booking + related writes
- correct initial invoice/payment state

Current state:
- baseline exists
- still needs full certification across all alternate booking paths

### 3. Modify Booking
Actors:
- guest
- staff
- admin

Minimum expected behavior:
- permission checks are consistent
- room/date change rules are centralized
- repricing is deterministic
- audit trail is captured

### 4. Cancel Booking / No-Show
Actors:
- guest
- staff
- admin
- system

Minimum expected behavior:
- policy and penalty rules are enforced
- payment/refund state stays consistent
- inventory is released correctly
- audit event is captured

### 5. Check-In
Actors:
- front desk
- staff

Minimum expected behavior:
- cannot check in without valid room assignment and booking state
- room status updates correctly
- guest/accounting side effects are consistent

### 6. Room Move
Actors:
- front desk
- staff

Minimum expected behavior:
- old room released and new room assigned safely
- no overlap conflict
- guest folio and operational state stay consistent

### 7. Charge Posting
Actors:
- front desk
- POS/integration
- system

Minimum expected behavior:
- room/service charges post to the correct guest/booking/folio
- taxes are applied correctly
- duplicate posting is blocked or detectable

### 8. Invoice Issue / Payment / Refund
Actors:
- staff
- admin
- system

Minimum expected behavior:
- invoice lifecycle is valid
- finalized invoices are immutable
- split billing and discounts reconcile
- refunds are consistent with original payment state

### 9. Check-Out And Settlement
Actors:
- front desk
- staff

Minimum expected behavior:
- outstanding charges are included
- settlement totals reconcile exactly
- final invoice/payment state is consistent
- room is released correctly

## P1 Operational Flows

### 10. Night Audit
Minimum expected behavior:
- room charges posted
- no-shows processed
- business date advanced safely
- daily reports generated
- failures are observable and retryable

Current state:
- present in codebase, needs product-level certification

### 11. Housekeeping Turnover
Minimum expected behavior:
- room status transitions are valid
- check-out to clean to ready path is reliable
- operational alerts are visible

### 12. Maintenance / Room Block
Minimum expected behavior:
- blocked rooms cannot be sold
- room availability and operations stay aligned

### 13. OTA Amendments / Channel Sync
Minimum expected behavior:
- inbound amendments do not corrupt local state
- retries and duplicates are controlled
- failed syncs are observable

### 14. Multi-Property Access
Minimum expected behavior:
- users only see allowed property data
- bulk or analytics queries do not leak cross-property results

## P2 Administrative Flows

### 15. User / Role Administration
Minimum expected behavior:
- role changes are audited
- property assignments are enforced
- account disable/enable is safe

### 16. Settings And Integrations
Minimum expected behavior:
- changes are validated
- dangerous settings are auditable
- secret-backed integrations are environment-driven

## Certification Matrix
Each flow must eventually have:
- owner module
- canonical service path
- acceptance criteria
- integration tests
- failure-mode tests
- monitoring hooks
- rollback guidance
