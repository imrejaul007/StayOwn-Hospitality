# Deprecation Matrix

## Purpose
This document tracks overlapping code paths that should not all remain active in a production-grade backend.

## Rules
- do not delete a legacy path until the replacement is canonical, tested, and rollout-safe
- deprecations must be done behind compatibility-preserving adapters where needed
- every deprecation entry must have an owner and exit criteria before removal

## Current Candidates

### 1. Legacy Route-Heavy Booking Logic
Current state:
- `backend/src/modules/booking/routes.js` is still an adapter to `backend/src/routes/bookings.js`

Keep for now:
- yes

Replacement target:
- module-owned booking routes/controllers/services

Removal criteria:
- booking route file reduced to thin adapter or retired
- critical booking flows fully tested through module-owned services

### 2. Legacy Route-Heavy Billing Logic
Current state:
- billing services exist, but route-level billing logic is still active in invoices/payments paths

Keep for now:
- yes

Replacement target:
- canonical billing module ownership

Removal criteria:
- invoice/payment mutations are fully service-owned
- overlapping calculation paths removed

### 3. `Invoice` vs `FinancialInvoice`
Current state:
- both appear to represent invoice-like financial records

Risk:
- split source of truth for finance and reporting

Decision needed:
- choose one canonical invoice model strategy
- document whether one is ledger/reporting-only or fully deprecated

Removal criteria:
- canonical ownership documented
- migrations and reporting dependencies resolved

### 4. Multiple Payment / Settlement Paths
Current state:
- booking, invoice, settlement, financial, and POS-related payment paths overlap

Risk:
- reconciliation drift
- duplicated business rules

Replacement target:
- one payment domain policy with explicit adapters for booking, invoice, settlement, and POS

Removal criteria:
- shared canonical payment service and reconciliation contract

### 5. Mixed Auth / Authorization Styles
Current state:
- central policy middleware exists, but legacy role-style checks still appear across the codebase

Replacement target:
- canonical policy-based auth + tenant enforcement

Removal criteria:
- no legacy direct authorization pattern left on protected routes

### 6. Large Server Bootstrap
Current state:
- `backend/src/server.js` owns too much composition and route wiring detail

Replacement target:
- module registration/bootstrap composition only

Removal criteria:
- route registration split by module
- startup file simplified

### 7. Custom Queue As Final Architecture
Current state:
- queue service exists and is useful
- long-term production decision still open

Options:
- harden current queue architecture
- or migrate to BullMQ/worker-first model

Decision criteria:
- failure handling
- dead-letter support
- operational visibility
- retry semantics

## Deferred Until Later
- frontend structure cleanup
- report/export standardization after booking/billing correctness
- non-critical legacy utility cleanup
