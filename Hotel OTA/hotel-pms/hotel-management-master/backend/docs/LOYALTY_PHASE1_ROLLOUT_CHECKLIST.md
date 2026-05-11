# Loyalty Phase 1 Rollout Checklist

## Pre-Deploy
- Configure env vars:
  - `LOYALTY_AWARD_ON_CHECKOUT`
  - `LOYALTY_POINTS_PER_CURRENCY_UNIT`
  - `LOYALTY_POINTS_PER_NIGHT`
  - `LOYALTY_MAX_POINTS_PER_STAY`
  - `LOYALTY_MAINTENANCE_ENABLED`
  - `LOYALTY_MAINTENANCE_INTERVAL_HOURS`
  - `LOYALTY_RECON_MAX_USERS`
- Ensure new indexes are created on `Loyalty` collection.
- Smoke-check admin APIs:
  - `GET /api/v1/loyalty/admin/health`
  - `GET /api/v1/loyalty/admin/reconciliation-runs`
  - `POST /api/v1/loyalty/admin/reconciliation/run`
  - `POST /api/v1/loyalty/admin/expiry/run`

## Functional Validation
- Guest checkout posts one earned transaction only once per booking.
- Repeated checkout/payment/webhook events do not duplicate earned points.
- Guest dashboard shows:
  - pending points
  - expiring-soon points
  - earning formula
- Admin Loyalty Manager page loads and can run reconciliation + expiry.

## Data Integrity Validation
- Compare `User.loyalty.points` and active ledger total for sample users.
- Run one reconcile dry run and verify mismatch summary.
- Run one targeted user repair and verify tier update.

## Runtime Monitoring
- Watch logs for:
  - `Loyalty points awarded for stay completion`
  - `Loyalty maintenance cycle completed`
  - `Loyalty reconciliation failed` / `Loyalty expiry row processing failed`
- Alert if mismatch rate spikes after deployment.

## Rollback Plan
- Disable awarding immediately by setting `LOYALTY_AWARD_ON_CHECKOUT=false`.
- Disable maintenance by setting `LOYALTY_MAINTENANCE_ENABLED=false`.
- Use admin reconcile endpoint for corrective repairs after rollback if required.
