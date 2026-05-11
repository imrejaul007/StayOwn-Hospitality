"use strict";
/**
 * Bulk QR Generation Routes
 *
 * Endpoints for bulk operations:
 * - POST /api/room-qr/bulk/generate - Generate multiple QRs
 * - GET /api/room-qr/bulk/status/:batchId - Check batch status
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const room_qr_bulk_1 = require("../room-qr-bulk");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// In-memory batch storage (would use Redis in production)
const batchStore = new Map();
/**
 * Bulk generate Room QR codes
 * POST /api/room-qr/bulk/generate
 */
router.post('/generate', auth_1.authenticateService, rateLimiter_1.rateLimiters.qrGenerate, async (req, res) => {
    try {
        const body = req.body;
        if (!body.bookings || !Array.isArray(body.bookings) || body.bookings.length === 0) {
            res.status(400).json({
                success: false,
                message: 'bookings array is required and must not be empty',
            });
            return;
        }
        // Limit batch size
        if (body.bookings.length > 100) {
            res.status(400).json({
                success: false,
                message: 'Maximum batch size is 100 bookings',
            });
            return;
        }
        // Generate batch ID
        const batchId = `BATCH${Date.now()}`;
        // Process in background (in production, use a job queue)
        const result = await (0, room_qr_bulk_1.generateBulkRoomQRs)(body);
        // Store result
        batchStore.set(batchId, result);
        res.status(202).json({
            success: true,
            data: {
                batchId,
                total: result.total,
                generated: result.generated,
                skipped: result.skipped,
                failed: result.failed,
                status: result.failed === 0 ? 'completed' : 'completed_with_errors',
            },
        });
    }
    catch (error) {
        console.error('[BulkQR] Generate error:', error);
        res.status(500).json({
            success: false,
            message: 'Bulk generation failed',
        });
    }
});
/**
 * Get bulk generation batch status
 * GET /api/room-qr/bulk/status/:batchId
 */
router.get('/status/:batchId', auth_1.authenticateService, async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = batchStore.get(batchId);
        if (!result) {
            res.status(404).json({
                success: false,
                message: 'Batch not found',
            });
            return;
        }
        res.json({
            success: true,
            data: {
                batchId,
                total: result.total,
                generated: result.generated,
                skipped: result.skipped,
                failed: result.failed,
                status: result.failed === 0 ? 'completed' : 'completed_with_errors',
                results: result.results,
                errors: result.errors,
            },
        });
    }
    catch (error) {
        console.error('[BulkQR] Status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get batch status',
        });
    }
});
/**
 * Get bulk generation results summary
 * GET /api/room-qr/bulk/summary
 */
router.get('/summary', auth_1.authenticateService, async (req, res) => {
    try {
        const { hotelId, date } = req.query;
        // Would query database for aggregated stats
        // For now, return mock data
        res.json({
            success: true,
            data: {
                totalBatches: batchStore.size,
                stats: {
                    totalGenerated: 0,
                    totalSkipped: 0,
                    totalFailed: 0,
                },
            },
        });
    }
    catch (error) {
        console.error('[BulkQR] Summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get summary',
        });
    }
});
exports.default = router;
//# sourceMappingURL=bulk-qr.routes.js.map