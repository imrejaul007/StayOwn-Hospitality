/**
 * Bulk QR Generation Routes
 *
 * Endpoints for bulk operations:
 * - POST /api/room-qr/bulk/generate - Generate multiple QRs
 * - GET /api/room-qr/bulk/status/:batchId - Check batch status
 */

import { Router, Request, Response } from 'express';
import { generateBulkRoomQRs, BulkQRRequest, BulkQRResult } from '../room-qr-bulk';
import { authenticateService } from '../middleware/auth';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();

// In-memory batch storage (would use Redis in production)
const batchStore: Map<string, BulkQRResult> = new Map();

/**
 * Bulk generate Room QR codes
 * POST /api/room-qr/bulk/generate
 */
router.post('/generate', authenticateService, rateLimiters.qrGenerate, async (req: Request, res: Response) => {
  try {
    const body = req.body as BulkQRRequest;

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
    const result = await generateBulkRoomQRs(body);

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
  } catch (error: any) {
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
router.get('/status/:batchId', authenticateService, async (req: Request, res: Response) => {
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
  } catch (error: any) {
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
router.get('/summary', authenticateService, async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('[BulkQR] Summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get summary',
    });
  }
});

export default router;
