/**
 * Room Service Hub Routes
 *
 * Endpoints for the Room Service Hub mobile app:
 * - GET /api/room-service/:hotelId/:roomId - Get room service info
 * - POST /api/room-service/order - Place service order
 * - GET /api/room-service/menu/:hotelId - Get services menu
 * - GET /api/room-service/bill/:bookingId - Get current bill
 * - POST /api/room-service/checkout - Process checkout
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=room-service-hub.routes.d.ts.map