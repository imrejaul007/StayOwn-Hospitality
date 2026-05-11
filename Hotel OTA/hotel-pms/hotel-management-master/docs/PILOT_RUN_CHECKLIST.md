# Pilot Run Checklist

## Purpose

Use this checklist for the first controlled staging or pilot rollout before broad production exposure.

## Scope

- backend API deployment
- queue worker deployment
- health and telemetry validation
- critical PMS smoke flows
- rollback readiness

## Pre-Start

- confirm deployment artifact version
- confirm environment variables are set
- confirm `QUEUE_PROCESSOR_MODE=worker` on API instances if worker is separate
- confirm worker instances are running with `npm run start:worker`
- confirm database backup exists
- confirm rollback artifact exists

## Health Validation

- `GET /health`
- `GET /health/detailed`
- `GET /health/metrics`
- `GET /health/queue`
- `GET /api/versions`

Expected:
- API health returns success
- queue health returns success or clearly explained degraded state
- no startup crash loops

## Critical Smoke Flows

- create booking
- modify booking
- cancel booking
- check-in booking
- post charge or settlement adjustment
- check-out booking
- invoice/payment update
- manual night audit run for a safe test property

Expected:
- no runtime exceptions
- no payment or invoice state drift
- no cross-property leakage

## Operational Validation

- logs visible for API and worker
- queue processing observed
- no stuck shutdown loops on restart
- alerting path confirmed for critical failures

## Rollback Trigger Conditions

- booking mutation failure on critical path
- billing or settlement inconsistency
- cross-property data leak
- repeated queue failure without recovery
- health endpoints unstable after deploy

## Completion

- capture findings in `docs/PILOT_FINDINGS_LOG.md`
- update `docs/GO_LIVE_GATE_REPORT.md`
