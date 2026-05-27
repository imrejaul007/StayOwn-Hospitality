import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getHostDashboard,
  getHostEarnings,
  getHostCalendar,
  getHostMetrics,
} from '../../services';
import { logger } from '../../utils/logger';

const router = Router();
const hostLogger = logger.child({ service: 'HostRoutes' });

// ── Validation Schemas ──────────────────────────────────────────────────────────

const earningsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  propertyId: z.string().optional(),
});

const calendarQuerySchema = z.object({
  startDate: z.string().datetime().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().datetime().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date format',
  }),
  propertyId: z.string().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/habixo/host/:hostId/dashboard
 * Get host dashboard data
 */
router.get('/:hostId/dashboard', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.params;
    const dashboard = await getHostDashboard(hostId);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Host properties not found',
      });
      return;
    }
    hostLogger.error({ error, hostId: req.params.hostId }, 'Failed to get host dashboard');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get dashboard',
    });
  }
});

/**
 * GET /api/habixo/host/:hostId/earnings
 * Get host earnings data
 */
router.get('/:hostId/earnings', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.params;
    const { startDate, endDate, propertyId } = req.query;

    const validation = earningsQuerySchema.safeParse({
      startDate,
      endDate,
      propertyId,
    });

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const earnings = await getHostEarnings(hostId, {
      startDate: validation.data.startDate ? new Date(validation.data.startDate) : undefined,
      endDate: validation.data.endDate ? new Date(validation.data.endDate) : undefined,
      propertyId: validation.data.propertyId,
    });

    res.json({
      success: true,
      data: earnings,
    });
  } catch (error) {
    hostLogger.error({ error, hostId: req.params.hostId }, 'Failed to get host earnings');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get earnings',
    });
  }
});

/**
 * GET /api/habixo/host/:hostId/calendar
 * Get host calendar (all properties overview)
 */
router.get('/:hostId/calendar', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.params;
    const { startDate, endDate, propertyId } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required',
      });
      return;
    }

    const validation = calendarQuerySchema.safeParse({
      startDate,
      endDate,
      propertyId,
    });

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const calendar = await getHostCalendar(hostId, {
      startDate: new Date(validation.data.startDate),
      endDate: new Date(validation.data.endDate),
      propertyId: validation.data.propertyId,
    });

    res.json({
      success: true,
      data: calendar,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Host properties not found',
      });
      return;
    }
    hostLogger.error({ error, hostId: req.params.hostId }, 'Failed to get host calendar');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get calendar',
    });
  }
});

/**
 * GET /api/habixo/host/:hostId/metrics
 * Get host performance metrics
 */
router.get('/:hostId/metrics', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.params;
    const metrics = await getHostMetrics(hostId);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Host properties not found',
      });
      return;
    }
    hostLogger.error({ error, hostId: req.params.hostId }, 'Failed to get host metrics');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get metrics',
    });
  }
});

export default router;
