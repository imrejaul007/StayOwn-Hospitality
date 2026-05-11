import { Router, Request, Response } from 'express';
import { HotelService } from '../services/hotels/hotel.service';
import { InventoryEngine } from '../services/booking/inventory-engine.service';
import { searchRateLimiter } from '../middleware/rateLimiter';
import { Errors } from '../utils/errors';
import { q, qInt, qFloat } from '../utils/query';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../config/database';
import { z } from 'zod';
import dayjs from 'dayjs';
import { captureHotelSearch, captureHotelView } from '../services/shared/intent-capture.service';

const router = Router();

/**
 * FIX-BUG-9: Validate date string is ISO format and in valid range
 */
const validateDateString = (dateStr: string, fieldName: string): Date => {
  const date = dayjs(dateStr);
  if (!date.isValid()) {
    throw Errors.validation(`${fieldName} must be a valid date (YYYY-MM-DD)`);
  }
  return date.toDate();
};

// FIX-BUG-9: Zod schema for search query parameters with date validation
const searchQuerySchema = z.object({
  city: z.string().min(1, 'city is required').max(100),
  checkin: z.string().refine((val) => {
    const date = dayjs(val);
    return date.isValid() && date.isAfter(dayjs().subtract(1, 'day')) && date.isBefore(dayjs().add(365, 'day'));
  }, 'checkin must be a valid future date within 365 days'),
  checkout: z.string().refine((val) => {
    const date = dayjs(val);
    return date.isValid() && date.isAfter(dayjs().subtract(1, 'day')) && date.isBefore(dayjs().add(366, 'day'));
  }, 'checkout must be a valid date within 366 days'),
  rooms: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return undefined;
    return Math.min(num, 10); // Cap at 10 rooms
  }),
  guests: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return undefined;
    return Math.min(num, 20); // Cap at 20 guests
  }),
  category: z.string().optional(),
  min_rate: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) ? undefined : num;
  }),
  max_rate: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) ? undefined : num;
  }),
  lat: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseFloat(val);
    if (isNaN(num) || num < -90 || num > 90) return undefined;
    return num;
  }),
  lng: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseFloat(val);
    if (isNaN(num) || num < -180 || num > 180) return undefined;
    return num;
  }),
  radius_km: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 100) return undefined;
    return num;
  }),
  sort: z.string().optional(),
  page: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) || num < 1 ? undefined : num;
  }),
  per_page: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) || num < 1 || num > 100 ? undefined : Math.min(num, 100);
  }),
}).refine((data) => {
  const checkin = dayjs(data.checkin);
  const checkout = dayjs(data.checkout);
  return checkout.isAfter(checkin, 'day');
}, {
  message: 'checkout must be after checkin date',
  path: ['checkout'],
});

// Browse all active hotels (used for hotel selection in non-search contexts)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const result = await HotelService.list(qInt(req, 'page') || 1, qInt(req, 'per_page') || 50);
  res.json(result);
}));

router.get('/search', searchRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  // FIX-BUG-9: Validate all query parameters with Zod schema
  const parseResult = searchQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw Errors.validation('Invalid search parameters', { errors });
  }

  const params = parseResult.data;
  const checkin = dayjs(params.checkin);
  const checkout = dayjs(params.checkout);

  // Additional validation: checkout must be after checkin
  if (!checkout.isAfter(checkin, 'day')) {
    throw Errors.validation('checkout date must be after checkin date');
  }

  const result = await HotelService.search({
    city: params.city,
    checkin: params.checkin,
    checkout: params.checkout,
    rooms: params.rooms,
    guests: params.guests,
    category: params.category,
    minRate: params.min_rate,
    maxRate: params.max_rate,
    lat: params.lat,
    lng: params.lng,
    radiusKm: params.radius_km,
    sort: params.sort,
    page: params.page,
    perPage: params.per_page,
  });

  // RTMN Commerce Memory: Capture hotel search intent (non-blocking)
  // Get userId from header or query if authenticated
  const userId = (req.headers['x-user-id'] as string) || (req.query['user_id'] as string);
  if (userId) {
    captureHotelSearch({
      userId,
      city: params.city,
      checkin: params.checkin,
      checkout: params.checkout,
    }).catch(() => {}); // Non-blocking
  }

  res.json(result);
}));

router.get('/:hotel_id', asyncHandler(async (req: Request, res: Response) => {
  const result = await HotelService.getById(req.params.hotel_id);

  // RTMN Commerce Memory: Capture hotel view intent (non-blocking)
  const userId = (req.headers['x-user-id'] as string) || (req.query['user_id'] as string);
  if (userId) {
    captureHotelView({
      userId,
      hotelId: req.params.hotel_id,
      city: req.query['city'] as string,
    }).catch(() => {}); // Non-blocking
  }

  res.json(result);
}));

/**
 * GET /api/hotels/:hotel_id/rooms/:room_type_id/availability
 * Pre-check room availability before initiating a hold.
 *
 * Query params:
 *   check_in  — YYYY-MM-DD (required)
 *   check_out — YYYY-MM-DD (required)
 *   rooms     — integer >= 1 (default: 1)
 *
 * Response:
 *   { available: boolean, total_paise: number }
 *
 * Note: this is a non-locking snapshot read. It does NOT guarantee the
 * inventory will still be free when /bookings/hold is called — race
 * conditions are prevented by the atomic SELECT FOR UPDATE NOWAIT inside
 * BookingService.hold(). Use this endpoint to give users early feedback
 * before they reach the payment screen.
 */
router.get(
  '/:hotel_id/rooms/:room_type_id/availability',
  asyncHandler(async (req: Request, res: Response) => {
    const { hotel_id, room_type_id } = req.params;
    const checkInStr = q(req, 'check_in');
    const checkOutStr = q(req, 'check_out');
    const rooms = qInt(req, 'rooms') ?? 1;

    // FIX-BUG-9: Validate dates are present
    if (!checkInStr || !checkOutStr) {
      throw Errors.validation('check_in and check_out are required (YYYY-MM-DD)');
    }

    // FIX-BUG-9: Validate date formats and logical constraints
    const checkIn = dayjs(checkInStr);
    const checkOut = dayjs(checkOutStr);
    const today = dayjs().startOf('day');

    if (!checkIn.isValid()) {
      throw Errors.validation('check_in must be a valid date (YYYY-MM-DD)');
    }
    if (!checkOut.isValid()) {
      throw Errors.validation('check_out must be a valid date (YYYY-MM-DD)');
    }
    if (checkIn.isBefore(today)) {
      throw Errors.validation('check_in cannot be in the past');
    }
    if (!checkOut.isAfter(checkIn, 'day')) {
      throw Errors.validation('check_out must be after check_in');
    }
    if (checkIn.isAfter(today.add(365, 'day'))) {
      throw Errors.validation('check_in cannot be more than 365 days in the future');
    }
    if (rooms < 1) {
      throw Errors.validation('rooms must be >= 1');
    }

    const result = await InventoryEngine.checkAvailability({
      hotelId: hotel_id,
      roomTypeId: room_type_id,
      checkinDate: checkInStr,
      checkoutDate: checkOutStr,
      numRooms: rooms,
    });

    res.json({
      available: result.available,
      total_paise: result.totalPaise,
    });
  }),
);

/**
 * GET /v1/hotels/:hotel_id/room-types
 * CD-XS-01 FIX: Returns all room types for a hotel, matching what the
 * consumer app expects at /v1/hotels/${hotelId}/room-types.
 */
router.get(
  '/:hotel_id/room-types',
  asyncHandler(async (req: Request, res: Response) => {
    const { hotel_id } = req.params;

    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId: hotel_id },
      orderBy: { baseRatePaise: 'asc' },
    });

    res.json({ data: roomTypes });
  }),
);

/**
 * GET /v1/hotels/:hotel_id/availability
 * CD-XS-01 FIX: Returns availability for all room types for given dates,
 * matching what the consumer app expects at
 * /v1/hotels/${hotelId}/availability?checkin=...&checkout=....
 *
 * Query params:
 *   checkin — YYYY-MM-DD (required)
 *   checkout — YYYY-MM-DD (required)
 */
router.get(
  '/:hotel_id/availability',
  asyncHandler(async (req: Request, res: Response) => {
    const { hotel_id } = req.params;
    const checkinStr = q(req, 'checkin');
    const checkoutStr = q(req, 'checkout');

    // FIX-BUG-9: Validate dates are present
    if (!checkinStr || !checkoutStr) {
      throw Errors.validation('checkin and checkout are required (YYYY-MM-DD)');
    }

    // FIX-BUG-9: Validate date formats and logical constraints
    const checkin = dayjs(checkinStr);
    const checkout = dayjs(checkoutStr);
    const today = dayjs().startOf('day');

    if (!checkin.isValid()) {
      throw Errors.validation('checkin must be a valid date (YYYY-MM-DD)');
    }
    if (!checkout.isValid()) {
      throw Errors.validation('checkout must be a valid date (YYYY-MM-DD)');
    }
    if (checkin.isBefore(today)) {
      throw Errors.validation('checkin cannot be in the past');
    }
    if (!checkout.isAfter(checkin, 'day')) {
      throw Errors.validation('checkout must be after checkin');
    }
    if (checkin.isAfter(today.add(365, 'day'))) {
      throw Errors.validation('checkin cannot be more than 365 days in the future');
    }

    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId: hotel_id },
      select: { id: true, name: true, maxOccupancy: true, baseRatePaise: true },
    });

    const availability = await Promise.all(
      roomTypes.map(async (rt) => {
        const result = await InventoryEngine.checkAvailability({
          hotelId: hotel_id,
          roomTypeId: rt.id,
          checkinDate: checkinStr,
          checkoutDate: checkoutStr,
          numRooms: 1,
        });
        return {
          roomTypeId: rt.id,
          name: rt.name,
          maxOccupancy: rt.maxOccupancy,
          baseRatePaise: rt.baseRatePaise,
          available: result.available,
          totalPaise: result.totalPaise,
        };
      }),
    );

    res.json({ data: availability });
  }),
);

export default router;
