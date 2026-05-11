# Loyalty Phase 2 Operations Guide

## New Capabilities
- Versioned loyalty rules with activation history.
- Rule simulation endpoint for liability impact.
- Campaign-scoped bonus awards with per-user and global caps.
- SLA alerting for stale reconciliation, high mismatch, drift spikes, and expiry backlog.

## Admin APIs
- `GET /api/v1/loyalty/admin/rules`
- `POST /api/v1/loyalty/admin/rules`
- `POST /api/v1/loyalty/admin/rules/simulate`
- `GET /api/v1/loyalty/admin/campaigns`
- `POST /api/v1/loyalty/admin/campaigns`
- `POST /api/v1/loyalty/admin/campaigns/:campaignId/award`
- `GET /api/v1/loyalty/admin/alerts`
- `POST /api/v1/loyalty/admin/alerts/evaluate`
- `POST /api/v1/loyalty/admin/alerts/:alertId/ack`

## RBAC Matrix
- `loyalty.rulesManage`: admin
- `loyalty.simulationAccess`: admin, manager
- `loyalty.campaignManage`: admin, manager
- `loyalty.operationsRun`: admin, manager
- `loyalty.walletRepair`: admin

## Deployment Checks
1. Verify active rule version exists.
2. Run one simulation and compare expected monthly liability delta.
3. Create one campaign and award one user bonus.
4. Evaluate SLA alerts and acknowledge one alert.
