import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAvailability,
  updateCalendar,
  blockDates,
  unblockDates,
  syncCalendar,
  checkAvailability,
} from '../../services';
import { logger } from '../../utils/logger';

const router = Router();
const calendarLogger = logger.child({ service: 'CalendarRoutes' });

// ── Validation Schemas ──────────────────────────────────────────────────────────

const getAvailabilitySchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date format',
  }),
});

const updateCalendarSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  updates: z.array(
    z.object({
      date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid date format',
      }),
      available: z.boolean().optional(),
      price: z.number().min(0).optional(),
      note: z.string().max(200).optional(),
    })
  ).min(1, 'At least one update is required'),
});

const blockDatesSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date format',
  }),
  reason: z.string().max(200).optional(),
});

const syncCalendarSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  entries: z.array(
    z.object({
      date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid date format',
      }),
      available: z.boolean(),
      price: z.number().min(0).optional(),
    })
  ).min(1, 'At least one entry is required'),
});

const checkAvailabilitySchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  checkIn: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid check-in date format',
  }),
  checkOut: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid check-out date format',
  }),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/habixo/calendar/availability
 * Get availability calendar for a property
 */
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate } = req.query;

    if (!propertyId || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'propertyId, startDate, and endDate are required',
      });
      return;
    }

    const result = await getAvailability(
      propertyId as string,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Property not found',
      });
      return;
    }
    calendarLogger.error({ error, query: req.query }, 'Failed to get availability');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get availability',
    });
  }
});

/**
 * PUT /api/habixo/calendar/update
 * Update calendar entries
 */
router.put('/update', async (req: Request, res: Response) => {
  try {
    const validation = updateCalendarSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const entries = await updateCalendar(validation.data);
    res.json({
      success: true,
      data: entries,
      updated: entries.length,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Property not found',
      });
      return;
    }
    calendarLogger.error({ error, body: req.body }, 'Failed to update calendar');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update calendar',
    });
  }
});

/**
 * POST /api/habixo/calendar/block
 * Block dates (make unavailable)
 */
router.post('/block', async (req: Request, res: Response) => {
  try {
    const validation = blockDatesSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { propertyId, startDate, endDate, reason } = validation.data;
    const blockedCount = await blockDates({
      propertyId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    });

    res.json({
      success: true,
      data: { blockedCount },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Property not found',
      });
      return;
    }
    if (error instanceof Error && error.name === 'ConflictError') {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }
    calendarLogger.error({ error, body: req.body }, 'Failed to block dates');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to block dates',
    });
  }
});

/**
 * DELETE /api/habixo/calendar/unblock
 * Unblock dates (make available)
 */
router.delete('/unblock', async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate } = req.query;

    if (!propertyId || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'propertyId, startDate, and endDate are required',
      });
      return;
    }

    const unblockedCount = await unblockDates(
      propertyId as string,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: { unblockedCount },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Property not found',
      });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    calendarLogger.error({ error, query: req.query }, 'Failed to unblock dates');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unblock dates',
    });
  }
});

/**
 * POST /api/habixo/calendar/sync
 * Sync calendar with external source
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const validation = syncCalendarSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { synced, errors } = await syncCalendar(
      validation.data.propertyId,
      validation.data.entries.map((e) => ({
        date: e.date,
        available: e.available,
        price: e.price,
      }))
    );

    res.json({
      success: true,
      data: { synced, errors },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Property not found',
      });
      return;
    }
    calendarLogger.error({ error, body: req.body }, 'Failed to sync calendar');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to sync calendar',
    });
  }
});

/**
 * GET /api/habixo/calendar/check
 * Check if dates are available for booking
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const { propertyId, checkIn, checkOut } = req.query;

    if (!propertyId || !checkIn || !checkOut) {
      res.status(400).json({
        success: false,
        message: 'propertyId, checkIn, and checkOut are required',
      });
      return;
    }

    const result = await checkAvailability(
      propertyId as string,
      new Date(checkIn as string),
      new Date(checkOut as string)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Property not found',
      });
      return;
    }
    calendarLogger.error({ error, query: req.query }, 'Failed to check availability');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check availability',
    });
  }
});

export default router;
