/**
 * PMS → StayOwn Webhooks
 *
 * Receives events from Hotel-PMS:
 * - check_in: Room assigned, guest checked in
 * - check_out: Guest checked out
 * - booking_update: Booking details changed
 * - room_status_change: Room status changed
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=pms-webhooks.routes.d.ts.map