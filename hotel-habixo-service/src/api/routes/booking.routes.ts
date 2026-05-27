import { Router, Request, Response } from 'express';
import { createBooking, getBookingById, cancelBooking, completeBooking, searchBookings } from '../../services';
import { logger } from '../../utils/logger';
import { authMiddleware, optionalAuthMiddleware } from '../../integrations/rez-auth';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();
const bookingLogger = logger.child({ service: 'BookingRoutes' });

/**
 * POST /api/habixo/bookings
 * Create a new booking - Protected
 * Rate limited: 10 requests per minute
 */
router.post('/', rateLimiters.booking, authMiddleware, async (req: Request, res: Response) => {
  try {
    // Use authenticated user's ID as guestId
    const bookingData = {
      ...req.body,
      guestId: req.user!.userId,
    };
    const booking = await createBooking(bookingData);
    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    bookingLogger.error({ error, body: req.body }, 'Failed to create booking');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create booking',
    });
  }
});

/**
 * GET /api/habixo/bookings
 * Search bookings - Optional auth (filters by user if authenticated)
 */
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { propertyId, guestId, hostId, status, brand, page, limit } = req.query;

    // If authenticated, filter by user's bookings unless specific ID is provided
    let effectiveGuestId = guestId as string | undefined;
    let effectiveHostId = hostId as string | undefined;

    if (!guestId && !hostId && req.isAuthenticated) {
      // If user is a host, show their bookings; otherwise show their guest bookings
      if (req.user!.role === 'host' || req.user!.role === 'admin') {
        // Hosts might want to see their properties' bookings - pass through
        effectiveHostId = hostId as string | undefined;
      } else {
        // Regular users see only their bookings
        effectiveGuestId = req.user!.userId;
      }
    }

    const result = await searchBookings({
      propertyId: propertyId as string,
      guestId: effectiveGuestId,
      hostId: effectiveHostId,
      status: status as string,
      brand: brand as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.bookings,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    bookingLogger.error({ error }, 'Failed to search bookings');
    res.status(500).json({
      success: false,
      message: 'Failed to search bookings',
    });
  }
});

/**
 * GET /api/habixo/bookings/:id
 * Get booking by ID - Optional auth
 */
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const booking = await getBookingById(req.params.id);

    // Check access rights if authenticated
    if (req.isAuthenticated) {
      const isAuthorized =
        booking.guestId === req.user!.userId ||
        booking.hostId === req.user!.userId ||
        req.user!.role === 'admin' ||
        req.user!.role === 'super_admin';

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          message: 'You do not have access to this booking',
        });
        return;
      }
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    bookingLogger.error({ error, id: req.params.id }, 'Failed to get booking');
    res.status(404).json({
      success: false,
      message: 'Booking not found',
    });
  }
});

/**
 * POST /api/habixo/bookings/:id/cancel
 * Cancel booking - Protected (must be guest or host of the booking)
 */
router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { cancelledBy = 'guest' } = req.body;

    // Get booking to verify ownership
    const booking = await getBookingById(req.params.id);

    // Check authorization
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    const isGuest = booking.guestId === req.user!.userId;
    const isHost = booking.hostId === req.user!.userId;

    if (!isAdmin && !isGuest && !isHost) {
      res.status(403).json({
        success: false,
        message: 'You can only cancel bookings you are involved in',
      });
      return;
    }

    const updatedBooking = await cancelBooking(req.params.id, cancelledBy);
    res.json({
      success: true,
      data: updatedBooking,
    });
  } catch (error) {
    bookingLogger.error({ error, id: req.params.id }, 'Failed to cancel booking');
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
    });
  }
});

/**
 * POST /api/habixo/bookings/:id/complete
 * Complete booking - Protected (admin only)
 */
router.post('/:id/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Only admins can complete bookings
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Only admins can complete bookings',
      });
      return;
    }

    const booking = await completeBooking(req.params.id);
    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    bookingLogger.error({ error, id: req.params.id }, 'Failed to complete booking');
    res.status(500).json({
      success: false,
      message: 'Failed to complete booking',
    });
  }
});

/**
 * POST /api/habixo/bookings/hourly
 * Create hourly booking
 */
router.post('/hourly', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { createHourlyBooking } = await import('../../services/BookingService');
    const bookingData = {
      ...req.body,
      guestId: req.user!.userId,
      brand: 'habixo_hourly' as const,
    };
    const booking = await createHourlyBooking(bookingData);
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    bookingLogger.error({ error }, 'Failed to create hourly booking');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create hourly booking',
    });
  }
});

/**
 * GET /api/habixo/bookings/slots/:propertyId
 * Get available time slots
 */
router.get('/slots/:propertyId', async (req: Request, res: Response) => {
  try {
    const { getAvailableTimeSlots } = await import('../../services/BookingService');
    const { date } = req.query;
    const slots = await getAvailableTimeSlots(req.params.propertyId, date as string);
    res.json({ success: true, data: slots });
  } catch (error) {
    bookingLogger.error({ error }, 'Failed to get time slots');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get time slots',
    });
  }
});

/**
 * GET /api/habixo/bookings/price/hourly
 * Calculate hourly price
 */
router.get('/price/hourly', async (req: Request, res: Response) => {
  try {
    const { calculateHourlyPrice } = await import('../../services/BookingService');
    const { propertyId, hours } = req.query;
    const estimate = await calculateHourlyPrice(propertyId as string, parseInt(hours as string));
    res.json({ success: true, data: estimate });
  } catch (error) {
    bookingLogger.error({ error }, 'Failed to calculate hourly price');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to calculate price',
    });
  }
});

export default router;
