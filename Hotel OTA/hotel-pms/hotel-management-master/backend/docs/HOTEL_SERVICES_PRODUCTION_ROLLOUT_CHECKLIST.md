# Hotel Services Production Rollout Checklist

## 1) Environment and Limits
- Set `HOTEL_SERVICE_BOOKING_DAILY_LIMIT` (recommended start: `10`).
- Set `HOTEL_SERVICE_MAX_FEATURED` (recommended start: `12`).
- Ensure Socket.IO is enabled and reachable at `/ws/notifications`.

## 2) Database and Index Health
- Confirm indexes created for:
  - `ServiceBooking(userId,idempotencyKey)` unique partial index.
  - `ServiceBooking(hotelId,assignedStaffId,status,bookingDate)`.
  - `HotelService(hotelId,featured,featuredFrom,featuredUntil,featuredPriority)`.
  - `HotelServiceFavorite(userId,hotelId,serviceId)` unique index.
- Verify index build completion before peak traffic windows.

## 3) API Smoke Checks
- Guest:
  - `GET /api/v1/hotel-services` with filters (`featured`, `tags`, `minPrice`, `maxPrice`, `availabilityNow`).
  - `GET/POST/DELETE /api/v1/hotel-services/favorites`.
  - `POST /api/v1/hotel-services/:serviceId/bookings` with `x-idempotency-key`.
- Admin:
  - `GET /api/v1/admin/hotel-services/bookings/queue`.
  - `PATCH /api/v1/admin/hotel-services/bookings/:bookingId/assign-staff`.
  - `PATCH /api/v1/admin/hotel-services/bookings/:bookingId/status`.
  - `GET /api/v1/admin/hotel-services/analytics/summary`.
  - `GET /api/v1/admin/hotel-services/analytics/export.csv`.

## 4) Functional Flows
- Admin creates service with featured window and priority.
- Guest sees service in catalog and `Featured Only` only within active window.
- Guest favorites syncs across sessions/devices (authenticated path).
- Guest booking enforces capacity/date and daily guardrails.
- Duplicate booking request with same idempotency key returns existing booking.
- Staff assignment and status updates visible in fulfillment queue.

## 5) Realtime Validation
- Confirm `hotel-service:*` events update guest service dashboard cache.
- Confirm `hotel-service-booking:updated` events emitted for assignment/status changes.
- Verify no event storms during bulk operations.

## 6) Monitoring and Operational Alerts
- Track rates for `429` from booking daily-limit guard.
- Track failed idempotent writes and duplicate-key conflicts.
- Track queue lag for fulfillment actions and socket delivery errors.

## 7) Rollback Strategy
- Feature-toggle frontend usage of new filters/favorites sync if needed.
- Revert admin booking fulfillment endpoints behind RBAC policy if required.
- Keep baseline booking create/list/cancel paths available.
