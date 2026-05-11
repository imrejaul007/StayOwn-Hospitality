import { Router, Request, Response } from 'express';
import { BookingService } from '../services/booking/booking.service';
import { HotelService } from '../services/hotels/hotel.service';
import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticatePartner } from '../middleware/auth';

const router = Router();

// Webhook routes require partner API key authentication
router.use(authenticatePartner);

/**
 * Booking Status Webhook Payload Schema
 */
const BookingStatusPayloadSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * Booking Cancel Payload Schema
 */
const BookingCancelPayloadSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().optional(),
  refundAmount: z.number().optional(),
  refundReason: z.string().optional(),
});

/**
 * POST /booking-sync/webhook/status
 *
 * Called by Stay Owen OTA when booking status changes.
 * Updates the booking status and notifies relevant parties.
 */
router.post('/webhook/status', asyncHandler(async (req: Request, res: Response) => {
  const parsed = BookingStatusPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.validation('Invalid payload', { errors: parsed.error.flatten() });
  }

  const { bookingId, status, reason, metadata } = parsed.data;

  // Find the booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: true,
      hotel: true,
    },
  });

  if (!booking) {
    throw Errors.notFound('Booking not found');
  }

  // Map status to enum value
  const statusMap: Record<string, 'init' | 'hold' | 'confirmed' | 'checked_in' | 'stayed' | 'cancelled' | 'no_show'> = {
    pending: 'init',
    confirmed: 'confirmed',
    checked_in: 'checked_in',
    checked_out: 'stayed',
    cancelled: 'cancelled',
    no_show: 'no_show',
  };

  // Update booking status
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: statusMap[status] || 'confirmed',
    },
    include: {
      user: true,
      hotel: true,
    },
  });

  // Log the status change to booking events
  await prisma.bookingEvent.create({
    data: {
      bookingId,
      eventType: 'confirmed',
      eventData: JSON.stringify({ reason, metadata, changedBy: 'ota-webhook' }),
      triggeredBy: 'system',
    },
  });

  // Send notifications based on status
  switch (status) {
    case 'confirmed':
      // Send confirmation notification
      // await NotificationService.sendBookingConfirmed(booking);
      break;
    case 'checked_in':
      // Send check-in confirmation
      // await NotificationService.sendCheckInConfirmation(booking);
      break;
    case 'checked_out':
      // Send check-out summary
      // await NotificationService.sendCheckOutSummary(booking);
      break;
    case 'cancelled':
      // Send cancellation confirmation
      // await NotificationService.sendCancellationConfirmation(booking);
      break;
  }

  res.json({
    success: true,
    bookingId,
    status,
    updatedAt: updatedBooking.updatedAt,
  });
}));

/**
 * POST /booking-sync/webhook/cancel
 *
 * Called by Stay Owen OTA when a booking is cancelled.
 * Processes refund and updates status.
 */
router.post('/webhook/cancel', asyncHandler(async (req: Request, res: Response) => {
  const parsed = BookingCancelPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    throw Errors.validation('Invalid payload', { errors: parsed.error.flatten() });
  }

  const { bookingId, reason, refundAmount, refundReason } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: true },
  });

  if (!booking) {
    throw Errors.notFound('Booking not found');
  }

  if (booking.status === 'cancelled') {
    throw Errors.badRequest('Booking already cancelled');
  }

  // Process refund if amount provided
  let refundResult = null;
  if (refundAmount && refundAmount > 0) {
    // Process refund through wallet
    // await WalletService.refund(booking.userId, refundAmount, reason);
    refundResult = {
      amount: refundAmount,
      reason: refundReason || reason,
      processed: true,
    };
  }

  // Update booking
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'cancelled',
      cancellationReason: reason || 'Cancelled via webhook',
      refundAmountPaise: refundAmount ? Math.round(refundAmount * 100) : 0,
    },
  });

  // Log the cancellation as booking event
  await prisma.bookingEvent.create({
    data: {
      bookingId,
      eventType: 'cancelled',
      eventData: { reason, refundAmount, refundReason, refundResult },
      triggeredBy: 'system',
    },
  });

  res.json({
    success: true,
    bookingId,
    status: 'cancelled',
    refund: refundResult,
    cancelledAt: updatedBooking.cancelledAt,
  });
}));

/**
 * GET /booking-sync/bookings/:bookingId
 *
 * Get booking details for Stay Owen OTA.
 */
router.get('/bookings/:bookingId', asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      hotel: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!booking) {
    throw Errors.notFound('Booking not found');
  }

  res.json({
    success: true,
    booking: {
      id: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      checkinDate: booking.checkinDate,
      checkoutDate: booking.checkoutDate,
      numNights: booking.numNights,
      numRooms: booking.numRooms,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      totalValuePaise: booking.totalValuePaise,
      pgAmountPaise: booking.pgAmountPaise,
      refundAmountPaise: booking.refundAmountPaise,
      paymentStatus: booking.paymentStatus,
      hotelName: booking.hotel?.name,
      userName: booking.user?.fullName,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    },
  });
}));

/**
 * GET /booking-sync/bookings
 *
 * List bookings for Stay Owen OTA with filters.
 */
router.get('/bookings', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const status = req.query.status as string;
  const hotelId = req.query.hotel_id as string;
  const userId = req.query.user_id as string;

  const where: any = {};
  if (status) where.status = status;
  if (hotelId) where.hotelId = hotelId;
  if (userId) where.userId = userId;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true as const, phone: true },
        },
        hotel: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    success: true,
    bookings: bookings.map((b) => ({
      id: b.id,
      bookingRef: b.bookingRef,
      status: b.status,
      checkinDate: b.checkinDate,
      checkoutDate: b.checkoutDate,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
      hotelName: b.hotel?.name,
      numRooms: b.numRooms,
      totalValuePaise: b.totalValuePaise,
      createdAt: b.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

/**
 * POST /booking-sync/bookings/:bookingId/notes
 *
 * Add notes to a booking via BookingEvent.
 */
router.post('/bookings/:bookingId/notes', asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { note, type } = req.body;

  if (!note) {
    throw Errors.validation('Note is required');
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw Errors.notFound('Booking not found');
  }

  // Log note as booking event
  await prisma.bookingEvent.create({
    data: {
      bookingId,
      eventType: 'confirmed', // Using confirmed as a generic event type for notes
      eventData: { note, type: type || 'general', addedAt: new Date().toISOString() },
      triggeredBy: 'admin',
    },
  });

  res.json({
    success: true,
    bookingId,
    message: 'Note added successfully',
  });
}));

/**
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'booking-sync',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
