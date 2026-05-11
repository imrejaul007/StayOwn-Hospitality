import { Router, Request, Response } from 'express';
import { authenticatePartner } from '../middleware/auth';
import { partnerRateLimiter } from '../middleware/rateLimiter';
import { HotelService } from '../services/hotels/hotel.service';
import { BookingService } from '../services/booking/booking.service';
import { AttributionService } from '../services/marketing/attribution.service';
import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { q, qInt } from '../utils/query';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// All partner routes require API key auth
router.use(authenticatePartner);
router.use(partnerRateLimiter);

/**
 * GET /partner/rez/hotels/search
 * Same as public search but tracks ReZ session and adds ReZ coin preview
 */
router.get('/hotels/search', asyncHandler(async (req: Request, res: Response) => {
  const city = q(req, 'city');
  const checkin = q(req, 'checkin');
  const checkout = q(req, 'checkout');
  const rezSessionId = q(req, 'rez_session_id');
  const rezUserId = q(req, 'rez_user_id');
  const rezCampaignId = q(req, 'rez_campaign_id');

  if (!city || !checkin || !checkout) throw Errors.validation('city, checkin, checkout required');
  if (!rezSessionId || !rezUserId) throw Errors.validation('rez_session_id and rez_user_id required');

  const result = await HotelService.search({
    city,
    checkin,
    checkout,
    rooms: qInt(req, 'rooms'),
    guests: qInt(req, 'guests'),
    category: q(req, 'category'),
    minRate: qInt(req, 'min_rate'),
    maxRate: qInt(req, 'max_rate'),
    sort: q(req, 'sort'),
    page: qInt(req, 'page'),
    perPage: qInt(req, 'per_page'),
  });

  // Track campaign click if provided
  if (rezCampaignId && rezUserId) {
    const user = await prisma.user.findFirst({ where: { rezUserId } });
    if (user) {
      await AttributionService.recordCampaignClick(user.id, rezCampaignId);
    }
  }

  res.json(result);
}));

/**
 * POST /partner/rez/bookings/hold
 * Same as user hold but channel_source = rez_app, attribution engine runs
 */
const rezHoldSchema = z.object({
  hotel_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  checkin_date: z.string(),
  checkout_date: z.string(),
  num_rooms: z.number().int().min(1).default(1),
  num_guests: z.number().int().min(1).default(2),
  guest_name: z.string(),
  guest_phone: z.string(),
  special_requests: z.string().optional(),
  ota_coin_burn_paise: z.number().int().min(0).default(0),
  rez_coin_burn_paise: z.number().int().min(0).default(0),
  rez_session_id: z.string(),
  rez_user_id: z.string(),
  rez_campaign_id: z.string().optional(),
});

router.post('/bookings/hold', asyncHandler(async (req: Request, res: Response) => {
  const parsed = rezHoldSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid booking data', { errors: parsed.error.flatten() });

  // Find or link user by ReZ user ID.
  // Use a transaction with findFirst + create to guard against concurrent requests for
  // the same rezUserId both trying to create the user.
  let user = await prisma.user.findFirst({ where: { rezUserId: parsed.data.rez_user_id } });
  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          phone: parsed.data.guest_phone,
          fullName: parsed.data.guest_name,
          rezUserId: parsed.data.rez_user_id,
          attributionSource: 'rez_app',
          attributionPartner: 'rez',
        },
      });
      await prisma.coinWallet.create({ data: { userId: user.id } });
      await AttributionService.setFirstTouch(user.id, parsed.data.rez_user_id);
    } catch (createErr: any) {
      // Unique constraint violation: concurrent request already created the user — re-fetch
      if (createErr?.code === 'P2002') {
        const existing = await prisma.user.findFirst({ where: { rezUserId: parsed.data.rez_user_id } });
        if (!existing) throw createErr;
        user = existing;
      } else {
        throw createErr;
      }
    }
  }

  const result = await BookingService.hold({
    userId: user.id,
    hotelId: parsed.data.hotel_id,
    roomTypeId: parsed.data.room_type_id,
    checkinDate: parsed.data.checkin_date,
    checkoutDate: parsed.data.checkout_date,
    numRooms: parsed.data.num_rooms,
    numGuests: parsed.data.num_guests,
    guestName: parsed.data.guest_name,
    guestPhone: parsed.data.guest_phone,
    specialRequests: parsed.data.special_requests,
    channelSource: 'rez_app',
    otaCoinBurnPaise: parsed.data.ota_coin_burn_paise,
    rezCoinBurnPaise: parsed.data.rez_coin_burn_paise,
    userTier: user.tier,
  });

  res.json({
    hold_id: result.holdId,
    booking_ref: result.bookingRef,
    expires_at: result.expiresAt,
    room_rate_paise: result.roomRatePaise,
    total_value_paise: result.totalValuePaise,
    ota_coin_applied_paise: result.otaCoinAppliedPaise,
    rez_coin_applied_paise: result.rezCoinAppliedPaise,
    pg_amount_paise: result.pgAmountPaise,
    razorpay_order_id: result.razorpayOrderId,
  });
}));

/**
 * POST /partner/rez/bookings/confirm
 */
router.post('/bookings/confirm', asyncHandler(async (req: Request, res: Response) => {
  const { hold_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!hold_id || !razorpay_payment_id || !razorpay_signature) {
    throw Errors.validation('hold_id, razorpay_payment_id, razorpay_signature required');
  }

  const booking = await prisma.booking.findUnique({ where: { id: hold_id } });
  if (!booking) throw Errors.notFound('Booking');

  const result = await BookingService.confirm({
    holdId: hold_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    userId: booking.userId,
  });

  res.json(result);
}));

/**
 * GET /partner/rez/bookings/:booking_id
 */
router.get('/bookings/:booking_id', asyncHandler(async (req: Request, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.booking_id },
    include: { hotel: { select: { name: true, city: true } } },
  });

  if (!booking) throw Errors.notFound('Booking');

  res.json({
    booking_id: booking.id,
    booking_ref: booking.bookingRef,
    status: booking.status,
    hotel_name: booking.hotel.name,
    checkin_date: booking.checkinDate,
    checkout_date: booking.checkoutDate,
    total_value_paise: booking.totalValuePaise,
  });
}));

/**
 * POST /partner/rez/wallet/sync
 * ReZ pushes updated coin balance for a linked user
 */
router.post('/wallet/sync', asyncHandler(async (req: Request, res: Response) => {
  const { ota_user_id, rez_user_id, rez_coin_balance_paise } = req.body;

  if (!ota_user_id || rez_coin_balance_paise === undefined) {
    throw Errors.validation('ota_user_id and rez_coin_balance_paise required');
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId: ota_user_id } });
  if (!wallet) throw Errors.notFound('Wallet');

  await prisma.coinWallet.update({
    where: { id: wallet.id },
    data: { rezCoinBalancePaise: rez_coin_balance_paise },
  });

  res.json({ synced: true });
}));

export default router;
