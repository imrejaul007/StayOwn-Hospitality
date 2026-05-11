# Domain Ownership Map

## Purpose
This document defines how the backend should be organized as production work proceeds.

## Current Domain Shape

### Booking
Current evidence:
- `backend/src/routes/bookings.js`
- `backend/src/modules/booking/service.js`
- `backend/src/modules/booking/repository.js`

Assessment:
- partially modularized
- still route-heavy

Target ownership:
- booking routes
- booking lifecycle service
- availability rules
- room assignment rules
- booking state transitions
- booking audit events

### Billing
Current evidence:
- `backend/src/routes/invoices.js`
- `backend/src/routes/payments.js`
- `backend/src/modules/billing/service.js`
- `backend/src/modules/billing/repository.js`
- `backend/src/models/Invoice.js`
- `backend/src/models/FinancialInvoice.js`

Assessment:
- strongest backend baseline after booking
- model/service overlap still needs rationalization

Target ownership:
- invoice lifecycle
- payments
- reconciliation
- supplementary billing
- settlement-linked financial events

### Inventory / Rooms
Current evidence:
- `backend/src/routes/rooms.js`
- `backend/src/routes/roomInventory.js`
- `backend/src/routes/checkoutInventory.js`
- multiple room/inventory models and services

Assessment:
- broad feature coverage
- ownership not consolidated

Target ownership:
- room master data
- room status
- room inventory
- checkout inventory
- room blocks / maintenance holds

### Auth / Security
Current evidence:
- `backend/src/routes/auth.js`
- `backend/src/middleware/auth.js`
- `backend/src/middleware/rbacPolicy.js`
- `backend/src/middleware/tenantIsolation.js`

Assessment:
- good baseline
- should become canonical security platform for all modules

Target ownership:
- login/session/token
- route protection
- RBAC policy
- tenant isolation
- security logging

### Guests
Current evidence:
- `backend/src/routes/guests.js`
- `backend/src/routes/guestManagement.js`
- guest-related services/models across the codebase

Assessment:
- functionally broad
- structure unclear

Target ownership:
- guest profile
- guest preferences
- guest history
- guest-facing operational actions

### Operations
Current evidence:
- housekeeping, maintenance, staff tasks, alerts, no-show, night audit, daily checks

Assessment:
- operationally important
- fragmented across many routes/services

Target ownership:
- housekeeping
- maintenance
- staff workflow
- no-show
- night audit
- daily operational routines

### Reporting / Analytics
Current evidence:
- dashboard routes
- analytics services
- KPI and ETL services

Assessment:
- large and high risk for tenant leakage if not governed

Target ownership:
- analytics queries
- dashboard summaries
- scheduled reports
- exports

### Integrations
Current evidence:
- OTA, webhooks, web settings, POS, CRM, channels, notifications

Assessment:
- large integration surface
- needs consistent retry, audit, and failure policy

Target ownership:
- inbound webhooks
- outbound delivery
- partner credentials
- queue-backed retries
- event publishing

## Architectural Rules
- each domain owns its service and repository logic
- route files orchestrate only request parsing, auth, validation, and response formatting
- cross-domain calls must happen through explicit services, not model-level shortcuts
- destructive and financial actions must emit audit/event records
- all tenant-scoped domains must enforce hotel/property context centrally

## Ownership Priorities
1. Booking
2. Billing
3. Auth / Security
4. Operations
5. Inventory / Rooms
6. Integrations
7. Guests
8. Reporting / Analytics
