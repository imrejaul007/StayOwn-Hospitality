# Operations Baseline Standards

## CI Quality Gates
- Run backend syntax validation (`npm run build:check`).
- Run module seam tests (`bookingModuleService`, `billingModuleService`).
- Run RBAC and validation audits on every backend PR.
- Enforce baseline drift guard (`npm run verify:baseline`).

## Environment Parity
- Keep local/stage/prod on Node 20 baseline.
- Use the same npm lockfile resolution in CI and runtime builds.
- Keep API versioning middleware active in all environments.

## Observability
- Use `/health`, `/health/detailed`, `/health/metrics`, and `/health/queue` for runtime checks.
- Track billing reconciliation mismatch events via `BillingEvent` (`BILLING_RECONCILIATION_MISMATCH`).
- Keep API metrics collection enabled for endpoint latency/failure profiling.

## Performance and Job Health Routines
- Weekly API hotspot profiling: `npm run profile:api -- <daysBack> <limit>`.
- Daily queue snapshot check: `npm run queue:health`.
- Monitor failed/retry queues and reconcile with operational alerts.
- Prefer dedicated worker execution in production with `npm run start:worker`.
- Set `QUEUE_PROCESSOR_MODE=worker` on API instances when queue processing is moved to a worker process.

## Runtime Safety Defaults
- Billing reconciliation strict mode remains opt-in (`BILLING_RECONCILIATION_ENFORCE=true`).
- Default mode is observe-first to prevent breaking guest/checkout flows.

## Rollout Execution
- Use `docs/PRODUCTION_ROLLOUT_CHECKLIST.md` as the source of truth for staging/production execution.
