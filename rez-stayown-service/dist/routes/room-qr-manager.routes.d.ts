/**
 * Room QR Manager Routes
 *
 * Handles room-bound QR system:
 * - GET /api/room-qr/template/:roomId - Get room QR template
 * - POST /api/room-qr/link - Link guest to room QR (check-in)
 * - POST /api/room-qr/unlink - Unlink guest from room QR (check-out)
 * - POST /api/room-qr/validate - Validate QR scan
 * - POST /api/room-qr/request - Create service request
 * - GET /api/room-qr/requests/:roomId - Get room requests
 * - POST /api/room-qr/bulk-generate - Bulk generate QRs for hotel
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=room-qr-manager.routes.d.ts.map