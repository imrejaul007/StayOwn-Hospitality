/**
 * Room QR API Routes
 *
 * REST API endpoints for Room QR functionality:
 * - POST /api/room-qr/generate - Generate QR for booking
 * - GET /api/room-qr/:bookingId - Get QR details
 * - POST /api/room-qr/:bookingId/send - Resend notification
 * - POST /api/room-qr/validate - Validate token
 * - POST /api/room-qr/charge - Add charge to folio
 * - GET /api/room-qr/:bookingId/bill - Get bill
 * - POST /api/room-qr/:bookingId/checkout - Process checkout
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=room-qr-routes.d.ts.map