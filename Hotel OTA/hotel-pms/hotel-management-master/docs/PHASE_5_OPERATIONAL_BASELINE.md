# Phase 5 Operational Baseline

## Goal

Make the backend safer to operate in production by tightening lifecycle management, queue observability, and worker execution boundaries.

## Completed In This Milestone

- fixed queue lifecycle cleanup so scheduled queue polling is stopped during shutdown
- standardized API shutdown through `backend/src/utils/gracefulShutdown.js`
- added a dedicated queue worker entrypoint:
  - `backend/src/scripts/start-queue-worker.js`
- added backend worker start script:
  - `npm run start:worker`
- made queue processing mode explicit with `QUEUE_PROCESSOR_MODE`
  - `api` keeps current behavior
  - `worker` is intended for dedicated worker process operation
  - any non-`api` mode prevents queue processing from auto-starting in the API server

## Operating Model

- API process:
  - serves HTTP traffic
  - may run queue processing only when `QUEUE_PROCESSOR_MODE=api`

- Worker process:
  - runs `npm run start:worker`
  - owns queue processing in worker mode
  - shuts down cleanly on `SIGTERM` and `SIGINT`

## Recommended Production Mode

- API:
  - `QUEUE_PROCESSOR_MODE=worker`

- Worker:
  - run `npm run start:worker`

This separates request-serving and queue-processing responsibilities while preserving the current in-process fallback for simpler environments.

## Remaining Phase 5 Work

1. tighten health and readiness checks around worker presence expectations
2. add backup and restore rehearsal evidence
3. define alert inventory and threshold ownership
4. add deploy/runbook detail for API plus worker rollout
