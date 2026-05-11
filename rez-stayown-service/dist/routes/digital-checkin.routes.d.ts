/**
 * Digital Check-in Routes for StayOwn
 *
 * Endpoints:
 * - POST /api/digital-checkin/start - Start check-in process
 * - GET /api/digital-checkin/:bookingId - Get check-in status
 * - PUT /api/digital-checkin/:bookingId - Update check-in data
 * - POST /api/digital-checkin/:bookingId/verify-id - Verify guest ID
 * - POST /api/digital-checkin/:bookingId/complete - Complete check-in and get key
 * - GET /api/digital-checkin/:bookingId/key - Get digital key
 * - POST /api/digital-checkin/:bookingId/key/send - Send key to guest
 * - POST /api/digital-checkin/:bookingId/checkout - Express checkout
 * - POST /api/digital-checkin/qr/validate - Validate QR code scan
 * - GET /api/digital-checkin/stats/:hotelId - Get check-in statistics
 * - GET /api/digital-checkin/user/:userId - Get check-ins by user
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=digital-checkin.routes.d.ts.map