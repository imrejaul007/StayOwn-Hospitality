import { Router, Request, Response } from 'express';
import { authenticateHotelStaff } from '../middleware/auth';
import { prisma } from '../config/database';
import { SettlementService } from '../services/payments/settlement.service';
import { PmsWebhookService } from '../services/integrations/pms-webhook.service';
import { Errors } from '../utils/errors';
import { q, qInt } from '../utils/query';
import dayjs from 'dayjs';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authenticateHotelStaff);

/**
 * GET /hotel/dashboard
 */
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const startOfMonth = dayjs().startOf('month').toDate();

  const [bookingsThisMonth, revenueAgg, wallet] = await Promise.all([
    prisma.booking.count({
      where: { hotelId, status: { in: ['confirmed', 'checked_in', 'stayed'] }, createdAt: { gte: startOfMonth } },
    }),
    prisma.booking.aggregate({
      where: { hotelId, status: { in: ['confirmed', 'checked_in', 'stayed'] }, createdAt: { gte: startOfMonth } },
      _sum: { totalValuePaise: true },
    }),
    prisma.hotelWallet.findUnique({ where: { hotelId } }),
  ]);

  res.json({
    hotel_id: hotelId,
    period: dayjs().format('YYYY-MM'),
    total_bookings: bookingsThisMonth,
    total_revenue_paise: revenueAgg._sum.totalValuePaise || 0,
    avg_occupancy_pct: null, // TODO: calculate from inventory
    avg_rating: null, // TODO: implement reviews
    pending_settlement_paise: wallet?.pendingBalancePaise || 0,
  });
}));

/**
 * GET /hotel/inventory?from=&to=
 */
router.get('/inventory', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const from = q(req, 'from');
  const to = q(req, 'to');

  if (!from || !to) throw Errors.validation('from and to dates required');

  const slots = await prisma.inventorySlot.findMany({
    where: {
      hotelId,
      date: { gte: new Date(from), lte: new Date(to) },
    },
    include: { roomType: { select: { name: true } } },
    orderBy: [{ roomTypeId: 'asc' }, { date: 'asc' }],
  });

  res.json(slots.map((s) => ({
    id: s.id,
    room_type_id: s.roomTypeId,
    room_type_name: s.roomType.name,
    date: s.date,
    total_rooms: s.totalRooms,
    available_rooms: s.availableRooms,
    rate_paise: s.ratePaise,
    is_blocked: s.isBlocked,
  })));
}));

/**
 * PUT /hotel/inventory/:room_type_id/:date
 */
router.put('/inventory/:room_type_id/:date', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const { room_type_id, date } = req.params;
  const { available_rooms, rate_paise, is_blocked } = req.body;

  // Verify room type belongs to hotel
  const roomType = await prisma.roomType.findFirst({
    where: { id: room_type_id, hotelId },
  });
  if (!roomType) throw Errors.notFound('Room type');

  // FIX-BUG-22: Validate inventory amounts before update
  if (available_rooms !== undefined) {
    if (!Number.isInteger(available_rooms) || available_rooms < 0 || available_rooms > roomType.maxOccupancy) {
      throw Errors.validation(`available_rooms must be integer between 0 and ${roomType.maxOccupancy}`);
    }
  }
  if (rate_paise !== undefined && (!Number.isInteger(rate_paise) || rate_paise < 0)) {
    throw Errors.validation('rate_paise must be non-negative integer');
  }

  const slot = await prisma.inventorySlot.upsert({
    where: {
      roomTypeId_date: { roomTypeId: room_type_id, date: new Date(date) },
    },
    create: {
      hotelId,
      roomTypeId: room_type_id,
      date: new Date(date),
      totalRooms: available_rooms ?? roomType.maxOccupancy,
      availableRooms: available_rooms ?? roomType.maxOccupancy,
      ratePaise: rate_paise ?? roomType.baseRatePaise,
      isBlocked: is_blocked ?? false,
    },
    update: {
      // Only update availableRooms — totalRooms tracks physical capacity and must not
      // be overwritten every time a hotel manager adjusts availability.
      ...(available_rooms !== undefined && { availableRooms: available_rooms }),
      ...(rate_paise !== undefined && { ratePaise: rate_paise }),
      ...(is_blocked !== undefined && { isBlocked: is_blocked }),
    },
  });

  res.json({
    id: slot.id,
    room_type_id: slot.roomTypeId,
    date: slot.date,
    available_rooms: slot.availableRooms,
    rate_paise: slot.ratePaise,
    is_blocked: slot.isBlocked,
  });
}));

/**
 * GET /hotel/bookings
 */
router.get('/bookings', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const status = q(req, 'status');
  const checkinFrom = q(req, 'checkin_from');
  const checkinTo = q(req, 'checkin_to');
  const page = q(req, 'page');

  const where: any = { hotelId };
  if (status) where.status = status;
  if (checkinFrom) where.checkinDate = { ...where.checkinDate, gte: new Date(checkinFrom) };
  if (checkinTo) where.checkinDate = { ...where.checkinDate, lte: new Date(checkinTo) };

  const pageNum = page ? parseInt(page) : 1;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { user: { select: { fullName: true, phone: true } } },
      orderBy: { checkinDate: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    bookings: bookings.map((b) => ({
      booking_id: b.id,
      booking_ref: b.bookingRef,
      guest_name: b.guestName || b.user?.fullName,
      guest_phone: b.guestPhone || b.user?.phone,
      status: b.status,
      checkin_date: b.checkinDate,
      checkout_date: b.checkoutDate,
      num_rooms: b.numRooms,
      total_value_paise: b.totalValuePaise,
    })),
    total,
    page: pageNum,
  });
}));

/**
 * POST /hotel/bookings/:booking_id/checkin
 */
router.post('/bookings/:booking_id/checkin', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const booking = await prisma.booking.findUnique({ where: { id: req.params.booking_id } });

  if (!booking || booking.hotelId !== hotelId) throw Errors.notFound('Booking');
  if (booking.status !== 'confirmed') throw Errors.validation('Booking must be confirmed to check in');

  await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: booking.id, status: 'confirmed' },
      data: { status: 'checked_in' },
    });
    if (updated.count === 0) throw Errors.validation('Booking must be confirmed to check in');
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        eventType: 'checked_in',
        eventData: {},
        triggeredBy: 'user',
      },
    });
  });

  // Fire-and-forget: notify PMS so its records stay in sync
  PmsWebhookService.notifyCheckIn({
    bookingId: booking.id,
    hotelId: booking.hotelId,
    checkinDate: dayjs(booking.checkinDate).format('YYYY-MM-DD'),
  });

  res.json({ status: 'checked_in' });
}));

/**
 * POST /hotel/bookings/:booking_id/checkout
 */
router.post('/bookings/:booking_id/checkout', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const booking = await prisma.booking.findUnique({ where: { id: req.params.booking_id } });

  if (!booking || booking.hotelId !== hotelId) throw Errors.notFound('Booking');
  if (booking.status !== 'checked_in') throw Errors.validation('Guest must be checked in first');

  await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: booking.id, status: 'checked_in' },
      data: { status: 'stayed', stayCompletedFlag: true, stayCompletedAt: new Date() },
    });
    if (updated.count === 0) throw Errors.validation('Guest must be checked in first');
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        eventType: 'stayed',
        eventData: {},
        triggeredBy: 'user',
      },
    });
  });

  // Fire-and-forget: notify PMS so its records stay in sync and it can award brand coins
  PmsWebhookService.notifyCheckOut({
    bookingId: booking.id,
    hotelId: booking.hotelId,
    checkoutDate: dayjs(booking.checkoutDate).format('YYYY-MM-DD'),
  });

  res.json({ status: 'stayed' });
}));

/**
 * GET /hotel/bookings/today-checkins — bookings checking in today
 */
router.get('/bookings/today-checkins', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const todayStart = dayjs().startOf('day').toDate();
  const todayEnd = dayjs().endOf('day').toDate();

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      checkinDate: { gte: todayStart, lte: todayEnd },
      status: { in: ['confirmed', 'checked_in'] },
    },
    include: { user: { select: { fullName: true, phone: true } } },
    orderBy: { checkinDate: 'asc' },
  });

  res.json({
    date: dayjs().format('YYYY-MM-DD'),
    count: bookings.length,
    bookings: bookings.map((b) => ({
      booking_id: b.id,
      booking_ref: b.bookingRef,
      guest_name: b.guestName || b.user?.fullName,
      guest_phone: b.guestPhone || b.user?.phone,
      status: b.status,
      checkin_date: b.checkinDate,
      checkout_date: b.checkoutDate,
      num_rooms: b.numRooms,
      num_guests: b.numGuests,
      total_value_paise: b.totalValuePaise,
    })),
  });
}));

/**
 * GET /hotel/bookings/today-checkouts — bookings checking out today
 */
router.get('/bookings/today-checkouts', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const todayStart = dayjs().startOf('day').toDate();
  const todayEnd = dayjs().endOf('day').toDate();

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      checkoutDate: { gte: todayStart, lte: todayEnd },
      status: { in: ['checked_in', 'stayed'] },
    },
    include: { user: { select: { fullName: true, phone: true } } },
    orderBy: { checkoutDate: 'asc' },
  });

  res.json({
    date: dayjs().format('YYYY-MM-DD'),
    count: bookings.length,
    bookings: bookings.map((b) => ({
      booking_id: b.id,
      booking_ref: b.bookingRef,
      guest_name: b.guestName || b.user?.fullName,
      guest_phone: b.guestPhone || b.user?.phone,
      status: b.status,
      checkin_date: b.checkinDate,
      checkout_date: b.checkoutDate,
      num_rooms: b.numRooms,
      num_guests: b.numGuests,
      total_value_paise: b.totalValuePaise,
    })),
  });
}));

/**
 * GET /hotel/analytics — revenue chart data (last 30 days daily breakdown)
 */
router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const last30Start = dayjs().subtract(29, 'day').startOf('day').toDate();
  const todayEnd = dayjs().endOf('day').toDate();

  const bookings = await prisma.booking.findMany({
    where: {
      hotelId,
      status: { in: ['confirmed', 'checked_in', 'stayed'] },
      createdAt: { gte: last30Start, lte: todayEnd },
    },
    select: { createdAt: true, totalValuePaise: true },
  });

  // Build a map of date -> { revenue, bookings }
  const dayMap: Record<string, { date: string; revenue_paise: number; bookings: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const key = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    dayMap[key] = { date: key, revenue_paise: 0, bookings: 0 };
  }

  for (const b of bookings) {
    const key = dayjs(b.createdAt).format('YYYY-MM-DD');
    if (dayMap[key]) {
      dayMap[key].revenue_paise += b.totalValuePaise;
      dayMap[key].bookings += 1;
    }
  }

  const daily = Object.values(dayMap);
  const totalRevenue = daily.reduce((sum, d) => sum + d.revenue_paise, 0);
  const totalBookings = daily.reduce((sum, d) => sum + d.bookings, 0);

  res.json({
    period: 'last_30_days',
    from: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD'),
    total_revenue_paise: totalRevenue,
    total_bookings: totalBookings,
    daily,
  });
}));

/**
 * GET /hotel/settlement
 */
router.get('/settlement', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const page = q(req, 'page');
  const result = await SettlementService.getHotelStatement(
    hotelId,
    page ? parseInt(page) : undefined,
  );
  res.json(result);
}));

/**
 * POST /hotel/images/upload
 * Upload hotel image (accepts base64 or URL for dev mode)
 */
router.post('/images/upload', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const { image_url, image_base64, content_type } = req.body;

  let url: string;

  if (image_url) {
    // Direct URL provided (dev mode or external CDN)
    url = image_url;
  } else if (image_base64) {
    // Base64 encoded image — upload to S3
    const { S3UploadService } = require('../services/s3-upload.service');
    const buffer = Buffer.from(image_base64, 'base64');
    url = await S3UploadService.uploadImage(buffer, hotelId, content_type || 'image/jpeg');
  } else {
    throw Errors.validation('image_url or image_base64 required');
  }

  // Append to hotel images array
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { images: true } });
  const currentImages = (hotel?.images as string[]) || [];
  currentImages.push(url);

  await prisma.hotel.update({
    where: { id: hotelId },
    data: { images: currentImages },
  });

  res.json({ url, total_images: currentImages.length });
}));

/**
 * DELETE /hotel/images
 * Remove an image by URL from hotel images array
 */
router.delete('/images', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const { image_url } = req.body;
  if (!image_url) throw Errors.validation('image_url required');

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { images: true } });
  const currentImages = ((hotel?.images as string[]) || []).filter((img) => img !== image_url);

  await prisma.hotel.update({
    where: { id: hotelId },
    data: { images: currentImages },
  });

  res.json({ removed: true, total_images: currentImages.length });
}));

/**
 * GET /hotel/brand-coin/program — view brand coin configuration + active earn/burn rules
 */
router.get('/brand-coin/program', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;

  const [hotel, earnRule, burnRule] = await Promise.all([
    prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { brandCoinEnabled: true, brandCoinName: true, brandCoinSymbol: true },
    }),
    prisma.earnRule.findFirst({
      where: { coinType: 'hotel_brand', hotelId, isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.burnRule.findFirst({
      where: { coinType: 'hotel_brand', hotelId, isActive: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!hotel) throw Errors.notFound('Hotel');

  res.json({
    brand_coin_enabled: hotel.brandCoinEnabled,
    brand_coin_name: hotel.brandCoinName,
    brand_coin_symbol: hotel.brandCoinSymbol,
    earn_rule: earnRule
      ? { id: earnRule.id, earn_pct: Number(earnRule.earnPct), valid_from: earnRule.validFrom, valid_until: earnRule.validUntil }
      : null,
    burn_rule: burnRule
      ? { id: burnRule.id, max_burn_pct: Number(burnRule.maxBurnPct) }
      : null,
  });
}));

/**
 * PUT /hotel/brand-coin/program — set brand coin name, symbol, earn %, and max burn %
 */
router.put('/brand-coin/program', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const { brand_coin_name, brand_coin_symbol, earn_pct, max_burn_pct } = req.body;

  if (!brand_coin_name || !brand_coin_symbol) {
    throw Errors.validation('brand_coin_name and brand_coin_symbol are required');
  }
  if (earn_pct !== undefined && (earn_pct < 0 || earn_pct > 100)) {
    throw Errors.validation('earn_pct must be between 0 and 100');
  }
  if (max_burn_pct !== undefined && (max_burn_pct < 0 || max_burn_pct > 100)) {
    throw Errors.validation('max_burn_pct must be between 0 and 100');
  }

  await prisma.$transaction(async (tx) => {
    // Update hotel branding info
    await tx.hotel.update({
      where: { id: hotelId },
      data: { brandCoinName: brand_coin_name, brandCoinSymbol: brand_coin_symbol },
    });

    // Upsert earn rule: deactivate old, create new if earn_pct provided
    if (earn_pct !== undefined) {
      await tx.earnRule.updateMany({
        where: { coinType: 'hotel_brand', hotelId, isActive: true },
        data: { isActive: false },
      });
      await tx.earnRule.create({
        data: {
          ruleName: `${brand_coin_name} earn rule`,
          coinType: 'hotel_brand',
          hotelId,
          earnPct: earn_pct,
          channelSource: 'all',
          userTier: 'all',
          validFrom: new Date(),
        },
      });
    }

    // Upsert burn rule: deactivate old, create new if max_burn_pct provided
    if (max_burn_pct !== undefined) {
      await tx.burnRule.updateMany({
        where: { coinType: 'hotel_brand', hotelId, isActive: true },
        data: { isActive: false },
      });
      await tx.burnRule.create({
        data: {
          coinType: 'hotel_brand',
          hotelId,
          maxBurnPct: max_burn_pct,
          userTier: 'all',
        },
      });
    }
  });

  res.json({ updated: true, brand_coin_name, brand_coin_symbol, earn_pct, max_burn_pct });
}));

/**
 * GET /hotel/brand-coin/members — paginated list of users with brand coin balances at this hotel
 */
router.get('/brand-coin/members', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const page = Math.max(1, qInt(req, 'page') || 1);
  const perPage = 20;

  const [members, total] = await Promise.all([
    prisma.hotelBrandCoinBalance.findMany({
      where: { hotelId },
      include: { user: { select: { fullName: true, phone: true } } },
      orderBy: { balancePaise: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.hotelBrandCoinBalance.count({ where: { hotelId } }),
  ]);

  res.json({
    members: members.map((m) => ({
      user_id: m.userId,
      full_name: m.user.fullName,
      phone: m.user.phone ? `*****${m.user.phone.slice(-4)}` : null,
      balance_paise: m.balancePaise,
      lifetime_earned_paise: m.lifetimeEarnedPaise,
      lifetime_burned_paise: m.lifetimeBurnedPaise,
      updated_at: m.updatedAt,
    })),
    total,
    page,
    per_page: perPage,
  });
}));

/**
 * PUT /hotel/pms-sync — save PMS backend URL for auto inventory sync
 * Body: { pms_url: string }
 */
router.put('/pms-sync', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const { pms_url } = req.body;

  if (!pms_url || typeof pms_url !== 'string') {
    return res.status(400).json({ error: 'pms_url is required' });
  }

  try { new URL(pms_url); } catch {
    return res.status(400).json({ error: 'pms_url must be a valid URL' });
  }

  await prisma.hotel.update({
    where: { id: hotelId },
    data: { pmsWebhookUrl: pms_url },
  });

  res.json({ success: true, message: 'PMS URL saved. Inventory sync will begin within 30 seconds.' });
}));

/**
 * GET /hotel/pms/status — get PMS connection status for merchant dashboard
 */
router.get('/pms/status', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      pmsWebhookUrl: true,
      pmsWebhookActive: true,
      pmsWebhookLastTriggeredAt: true,
      pmsWebhookErrorCount: true,
    },
  });

  res.json({
    connected: !!hotel?.pmsWebhookUrl && hotel?.pmsWebhookActive,
    lastSync: hotel?.pmsWebhookLastTriggeredAt?.toISOString() ?? null,
    pendingPush: 0,
  });
}));

/**
 * POST /hotel/pms/sync — trigger PMS inventory sync (FIX-BIZOS-002)
 * Triggers Hotel OTA to push current inventory to connected PMS
 */
router.post('/pms/sync', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.hotelStaff!.hotelId;

  // Check if PMS is configured
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      pmsWebhookUrl: true,
      pmsWebhookActive: true,
    },
  });

  if (!hotel?.pmsWebhookUrl || !hotel?.pmsWebhookActive) {
    return res.status(400).json({ error: 'PMS not configured or not active' });
  }

  // Get all room types and their inventory
  const roomTypes = await prisma.roomType.findMany({
    where: { hotelId },
    select: { id: true, name: true },
  });

  // Get inventory for next 30 days
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 30);

  const inventory = await prisma.inventorySlot.findMany({
    where: {
      hotelId,
      date: {
        gte: today,
        lte: futureDate,
      },
    },
    select: {
      roomTypeId: true,
      date: true,
      availableRooms: true,
      ratePaise: true,
    },
  });

  // Trigger sync for each room type
  const { otaToPmsIntegration } = await import('../services/integrations/ota-to-pms.service');

  let syncedCount = 0;
  for (const rt of roomTypes) {
    for (const slot of inventory.filter(i => i.roomTypeId === rt.id)) {
      const result = await otaToPmsIntegration.syncInventory(
        hotelId,
        rt.id,
        slot.date.toISOString().split('T')[0],
        slot.availableRooms,
        slot.availableRooms === 0
      );
      if (result.success) syncedCount++;
    }
  }

  // Update last triggered timestamp
  await prisma.hotel.update({
    where: { id: hotelId },
    data: { pmsWebhookLastTriggeredAt: new Date() },
  });

  res.json({
    success: true,
    synced_at: new Date().toISOString(),
    rooms_synced: syncedCount,
  });
}));

export default router;
