# Production Rollout Checklist

## Objective
- Complete a safe, non-breaking rollout with observability and rollback readiness.

## Pre-deploy Gates
- Ensure backend quality workflow passes:
  - syntax check
  - module seam tests
  - RBAC/validation audits
  - baseline drift guard
- Confirm docs are updated:
  - `docs/MODULAR_MIGRATION_BASELINE.md`
  - `docs/PROGRAM_MILESTONES.md`
  - `docs/API_VERSIONING_STRATEGY.md`
  - `docs/OPERATIONS_BASELINE_STANDARDS.md`

## Environment Setup
- Set required secrets and environment variables:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `REDIS_URL`
  - `STRIPE_SECRET_KEY` (if payments enabled)
  - `API_V1_SUNSET_DATE`
  - `BILLING_RECONCILIATION_ENFORCE` (start with `false`)
- Validate health endpoints after deploy:
  - `/health`
  - `/health/detailed`
  - `/health/metrics`
  - `/health/queue`
  - `/api/versions`
- For dedicated queue worker deployments:
  - set `QUEUE_PROCESSOR_MODE=worker` on API instances
  - run worker instances with `npm run start:worker`

## Deployment Sequence
- Deploy backend to staging.
- Start or restart queue worker instances if queue processing is separated from the API process.
- Run smoke checks for booking, billing, RBAC, and validation paths.
- Run:
  - `npm run audit:validation`
  - `npm run audit:rbac`
  - `npm run verify:baseline`
- Deploy frontend once backend staging smoke checks pass.
- Promote to production with canary or phased traffic routing.

## Post-deploy Validation
- Verify logs and error rates for:
  - billing reconciliation mismatch events
  - queue failure/retry trends
  - endpoint latency regressions
- Run:
  - `npm run profile:api -- 7 20`
  - `npm run queue:health`

## Rollback Plan
- Keep prior backend release artifact available.
- If severe regression:
  - roll back backend release
  - roll back worker release if worker is deployed separately
  - keep DB schema-compatible mode
  - set `BILLING_RECONCILIATION_ENFORCE=false` if strict mode was enabled
- Re-run health endpoints and baseline verification after rollback.

## Completion Criteria
- No baseline drift (`verify:baseline` passes).
- RBAC and validation remain at zero missing.
- No critical queue failures and no sustained P95 latency regression.
- Version headers observed correctly for v1/v2 requests.
