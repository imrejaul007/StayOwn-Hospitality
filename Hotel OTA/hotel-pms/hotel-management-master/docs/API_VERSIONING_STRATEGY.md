# API Versioning Strategy

## Current Baseline
- Requests under `/api/v1/*` remain the stable baseline.
- `/api/v2/*` is now supported as a non-breaking compatibility alias routed to v1 handlers.
- Unsupported versions return `400` with the supported list.

## Response Headers
- `x-api-version-requested`: requested version (`v1`, `v2`).
- `x-api-version-status`: `stable` for v1, `compatibility-mode` for v2 alias.
- `x-api-version-routed-to`: present for v2, currently `v1`.
- `x-api-deprecation-notice` + `x-api-sunset-date` are emitted for v1.

## Migration Rules
- Additive changes only for compatibility mode.
- Breaking changes must be introduced behind explicit v2 implementation routes before removing v1 behavior.
- Any endpoint contract change requires:
  - route-level compatibility note,
  - regression test update,
  - milestone/doc update.

## Rollout
- Phase 1 (implemented): version negotiation + headers + v2 compatibility alias.
- Phase 2 (next): endpoint-by-endpoint v2 native handlers for changed contracts.
- Phase 3 (future): enforce sunset policy after release and communication window.
