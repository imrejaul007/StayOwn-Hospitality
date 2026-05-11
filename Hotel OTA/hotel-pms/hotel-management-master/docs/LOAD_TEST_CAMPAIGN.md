# Load Test Campaign (Week 4)

This document defines objective launch-readiness performance criteria for a 10k-user target and how to produce evidence.

## Targets (Go/No-Go)

- p95 API latency: `< 500ms`
- p99 API latency: `< 1200ms`
- error rate (`5xx + transport failures`): `< 1%`
- sustained throughput during peak stage: document observed `requests/sec`
- no critical dependency saturation: database, Redis, queue, and CPU stay below emergency thresholds

## Test Scenarios

1. **Unauthenticated baseline**
   - Hit health and public endpoints only.
2. **Authenticated core flow**
   - Login + `auth/me` + booking list reads.
3. **Checkout pressure**
   - Settlement-related read/write paths with realistic mix.
4. **Webhook + queue stress**
   - Simulate event delivery and queue consumption in parallel.

## Execution

From `backend/`:

```bash
npm run perf:load:k6
```

Example with environment:

```bash
BASE_URL=https://your-api.example.com/api/v1 AUTH_EMAIL=ops@test.com AUTH_PASSWORD=secret npm run perf:load:k6
```

## Evidence Requirements

After each run, publish all of the following in `docs/evidence/`:

- k6 summary output
- environment metadata (branch, commit, target env, timestamp)
- threshold pass/fail result
- key metrics: p50/p95/p99 latency, failed request rate, throughput
- bottleneck notes and remediation

Use `docs/evidence/load-test-results-template.json` as the canonical format.

## Release Rule

No production launch sign-off unless:

- all target thresholds pass on a production-like environment
- results are repeatable across at least 2 independent runs
- no unresolved P0/P1 incidents are opened during the test window
