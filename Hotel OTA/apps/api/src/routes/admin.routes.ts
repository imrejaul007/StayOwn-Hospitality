import { Router, Request, Response } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { adminRateLimiter } from '../middleware/rateLimiter';
import { generatePartnerApiKey } from '../middleware/auth';
import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { q, qInt } from '../utils/query';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(authenticateAdmin);
router.use(adminRateLimiter);

// Valid API key scopes
const VALID_SCOPES = [
  'READ_INVENTORY', 'WRITE_INVENTORY',
  'READ_BOOKINGS', 'WRITE_BOOKINGS',
  'READ_SETTINGS', 'WRITE_SETTINGS',
  'READ_COINS', 'WRITE_COINS',
] as const;

type ApiKeyScope = typeof VALID_SCOPES[number];

/**
 * GET /admin/overview — dashboard KPIs
 */
router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    gmvTodayAgg,
    gmvMonthAgg,
    activeBookings,
    activeHotels,
    totalUsers,
    coinLiability,
    hotelBrandLiability,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: {
        status: { in: ['confirmed', 'checked_in', 'stayed'] },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { totalValuePaise: true },
    }),
    prisma.booking.aggregate({
      where: {
        status: { in: ['confirmed', 'checked_in', 'stayed'] },
        createdAt: { gte: monthStart },
      },
      _sum: { totalValuePaise: true },
    }),
    prisma.booking.count({
      where: { status: { in: ['confirmed', 'checked_in'] } },
    }),
    prisma.hotel.count({
      where: { onboardingStatus: 'active' },
    }),
    prisma.user.count({
      where: { isActive: true },
    }),
    prisma.coinWallet.aggregate({
      _sum: { otaCoinBalancePaise: true, rezCoinBalancePaise: true },
    }),
    prisma.hotelBrandCoinBalance.aggregate({
      _sum: { balancePaise: true },
    }),
  ]);

  const otaCoin = coinLiability._sum.otaCoinBalancePaise || 0;
  const rezCoin = coinLiability._sum.rezCoinBalancePaise || 0;
  const hotelBrandCoin = hotelBrandLiability._sum.balancePaise || 0;

  res.json({
    gmv_today_paise: gmvTodayAgg._sum.totalValuePaise || 0,
    gmv_month_paise: gmvMonthAgg._sum.totalValuePaise || 0,
    active_bookings: activeBookings,
    active_hotels: activeHotels,
    total_users: totalUsers,
    coin_liability_paise: {
      ota_coin: otaCoin,
      rez_coin: rezCoin,
      hotel_brand_coin: hotelBrandCoin,
      total: otaCoin + rezCoin + hotelBrandCoin,
    },
  });
}));

/**
 * GET /admin/users — list users with pagination and filters
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const search = q(req, 'search');
  const tier = q(req, 'tier');
  const isActive = q(req, 'is_active');
  const page = q(req, 'page');

  const pageNum = page ? parseInt(page) : 1;
  const where: any = {};
  if (tier) where.tier = tier;
  if (isActive !== undefined && isActive !== null) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { phone: { contains: search } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, phone: true, email: true, fullName: true,
        tier: true, isActive: true, attributionSource: true, createdAt: true,
        coinWallet: { select: { otaCoinBalancePaise: true, rezCoinBalancePaise: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    users: users.map((u) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      full_name: u.fullName,
      tier: u.tier,
      is_active: u.isActive,
      attribution_source: u.attributionSource,
      total_bookings: u._count.bookings,
      ota_coin_balance_paise: u.coinWallet?.otaCoinBalancePaise || 0,
      rez_coin_balance_paise: u.coinWallet?.rezCoinBalancePaise || 0,
      created_at: u.createdAt,
    })),
    total,
    page: pageNum,
  });
}));

/**
 * GET /admin/users/:id — user detail with bookings + coin history
 */
router.get('/users/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const page = q(req, 'page');
  const pageNum = page ? parseInt(page) : 1;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { coinWallet: true },
  });
  if (!user) throw Errors.notFound('User');

  const [bookings, coinTransactions, bookingsTotal, coinsTotal] = await Promise.all([
    prisma.booking.findMany({
      where: { userId },
      include: { hotel: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.booking.count({ where: { userId } }),
    prisma.coinTransaction.count({ where: { userId } }),
  ]);

  res.json({
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      full_name: user.fullName,
      tier: user.tier,
      is_active: user.isActive,
      attribution_source: user.attributionSource,
      created_at: user.createdAt,
      coin_wallet: user.coinWallet
        ? {
            ota_coin_balance_paise: user.coinWallet.otaCoinBalancePaise,
            rez_coin_balance_paise: user.coinWallet.rezCoinBalancePaise,
            ota_coin_lifetime_earned_paise: user.coinWallet.otaCoinLifetimeEarnedPaise,
          }
        : null,
    },
    bookings: {
      data: bookings.map((b) => ({
        booking_id: b.id,
        booking_ref: b.bookingRef,
        hotel_name: b.hotel.name,
        status: b.status,
        checkin_date: b.checkinDate,
        checkout_date: b.checkoutDate,
        total_value_paise: b.totalValuePaise,
        created_at: b.createdAt,
      })),
      total: bookingsTotal,
      page: pageNum,
    },
    coin_history: {
      data: coinTransactions.map((t) => ({
        id: t.id,
        coin_type: t.coinType,
        transaction_type: t.transactionType,
        direction: t.direction,
        amount_paise: t.amountPaise,
        balance_after_paise: t.balanceAfterPaise,
        notes: t.notes,
        created_at: t.createdAt,
      })),
      total: coinsTotal,
      page: pageNum,
    },
  });
}));

/**
 * PUT /admin/users/:id/suspend — suspend a user
 */
router.put('/users/:id/suspend', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { reason } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound('User');
  if (!user.isActive) throw Errors.validation('User is already suspended');

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  res.json({ id: userId, is_active: false, reason: reason || null });
}));

/**
 * POST /admin/users/:id/coin-adjust — manual coin adjustment
 */
router.post('/users/:id/coin-adjust', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { coin_type, direction, notes } = req.body;
  const rawAmount = req.body.amount_paise;
  const amount_paise = parseInt(rawAmount, 10);
  if (isNaN(amount_paise) || amount_paise === 0) {
    return res.status(400).json({ error: 'amount_paise must be a non-zero integer' });
  }

  if (!coin_type || !direction) {
    throw Errors.validation('coin_type, direction, and amount_paise are required');
  }
  if (!['credit', 'debit'].includes(direction)) {
    throw Errors.validation('direction must be credit or debit');
  }
  if (!['ota', 'rez', 'hotel_brand'].includes(coin_type)) {
    throw Errors.validation('coin_type must be ota, rez, or hotel_brand');
  }

  const { hotel_id } = req.body;
  if (coin_type === 'hotel_brand' && !hotel_id) {
    throw Errors.validation('hotel_id is required for hotel_brand adjustments');
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw Errors.notFound('Coin wallet');

  if (coin_type === 'hotel_brand') {
    const brandBalance = await prisma.hotelBrandCoinBalance.findUnique({
      where: { userId_hotelId: { userId, hotelId: hotel_id } },
    });
    const currentBrandBalance = brandBalance?.balancePaise ?? 0;
    const delta = direction === 'credit' ? amount_paise : -amount_paise;
    const newBrandBalance = currentBrandBalance + delta;
    if (newBrandBalance < 0) throw Errors.validation('Insufficient hotel brand coin balance');

    await prisma.$transaction(async (tx) => {
      await tx.hotelBrandCoinBalance.upsert({
        where: { userId_hotelId: { userId, hotelId: hotel_id } },
        create: { userId, hotelId: hotel_id, balancePaise: amount_paise, lifetimeEarnedPaise: direction === 'credit' ? amount_paise : 0 },
        update: { balancePaise: newBrandBalance },
      });
      await tx.coinTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          coinType: 'hotel_brand',
          transactionType: 'admin_adjust',
          amountPaise: amount_paise,
          direction,
          hotelId: hotel_id,
          balanceAfterPaise: newBrandBalance,
          notes: notes || 'Manual admin adjustment',
        },
      });
    });

    return res.json({ user_id: userId, coin_type, direction, amount_paise, hotel_id, new_balance_paise: newBrandBalance });
  }

  const balanceField = coin_type === 'ota' ? 'otaCoinBalancePaise' : 'rezCoinBalancePaise';
  const currentBalance = wallet[balanceField];
  const delta = direction === 'credit' ? amount_paise : -amount_paise;
  const newBalance = currentBalance + delta;

  if (newBalance < 0) throw Errors.validation('Insufficient coin balance');

  await prisma.$transaction(async (tx) => {
    await tx.coinWallet.update({
      where: { id: wallet.id },
      data: {
        [balanceField]: newBalance,
        ...(direction === 'credit' && coin_type === 'ota' && {
          otaCoinLifetimeEarnedPaise: { increment: amount_paise },
        }),
      },
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        walletId: wallet.id,
        coinType: coin_type,
        transactionType: 'admin_adjust',
        amountPaise: amount_paise,
        direction,
        balanceAfterPaise: newBalance,
        notes: notes || 'Manual admin adjustment',
      },
    });
  });

  res.json({
    user_id: userId,
    coin_type,
    direction,
    amount_paise,
    new_balance_paise: newBalance,
  });
}));

/**
 * GET /admin/burn-rules — list burn rules
 */
router.get('/burn-rules', asyncHandler(async (req: Request, res: Response) => {
  const isActive = q(req, 'is_active');
  const page = q(req, 'page');
  const pageNum = page ? parseInt(page) : 1;

  const where: any = {};
  if (isActive !== undefined && isActive !== null) where.isActive = isActive === 'true';

  const [rules, total] = await Promise.all([
    prisma.burnRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.burnRule.count({ where }),
  ]);

  res.json({
    rules: rules.map((r) => ({
      id: r.id,
      coin_type: r.coinType,
      user_tier: r.userTier,
      hotel_id: r.hotelId,
      max_burn_pct: r.maxBurnPct,
      min_cash_pct: r.minCashPct,
      is_active: r.isActive,
      created_at: r.createdAt,
    })),
    total,
    page: pageNum,
  });
}));

/**
 * POST /admin/burn-rules — create burn rule
 */
router.post('/burn-rules', asyncHandler(async (req: Request, res: Response) => {
  const { coin_type, user_tier, hotel_id, max_burn_pct, min_cash_pct } = req.body;

  if (!coin_type || max_burn_pct === undefined) {
    throw Errors.validation('coin_type and max_burn_pct are required');
  }

  const rule = await prisma.burnRule.create({
    data: {
      coinType: coin_type,
      userTier: user_tier || 'all',
      hotelId: hotel_id || null,
      maxBurnPct: max_burn_pct,
      minCashPct: min_cash_pct ?? 0,
    },
  });

  res.status(201).json({
    id: rule.id,
    coin_type: rule.coinType,
    user_tier: rule.userTier,
    hotel_id: rule.hotelId,
    max_burn_pct: rule.maxBurnPct,
    min_cash_pct: rule.minCashPct,
    is_active: rule.isActive,
    created_at: rule.createdAt,
  });
}));

/**
 * PUT /admin/burn-rules/:id — update burn rule
 */
router.put('/burn-rules/:id', asyncHandler(async (req: Request, res: Response) => {
  const { max_burn_pct, min_cash_pct, is_active } = req.body;

  const rule = await prisma.burnRule.update({
    where: { id: req.params.id },
    data: {
      ...(max_burn_pct !== undefined && { maxBurnPct: max_burn_pct }),
      ...(min_cash_pct !== undefined && { minCashPct: min_cash_pct }),
      ...(is_active !== undefined && { isActive: is_active }),
    },
  });

  res.json({
    id: rule.id,
    coin_type: rule.coinType,
    user_tier: rule.userTier,
    hotel_id: rule.hotelId,
    max_burn_pct: rule.maxBurnPct,
    min_cash_pct: rule.minCashPct,
    is_active: rule.isActive,
    created_at: rule.createdAt,
  });
}));

/**
 * GET /admin/hotels
 */
router.get('/hotels', asyncHandler(async (req: Request, res: Response) => {
  const status = q(req, 'status');
  const page = q(req, 'page');
  const where: any = {};
  if (status) where.onboardingStatus = status;

  const pageNum = page ? parseInt(page) : 1;

  const [hotels, total] = await Promise.all([
    prisma.hotel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
      select: {
        id: true, name: true, city: true, category: true,
        onboardingStatus: true, miningEligible: true, createdAt: true,
      },
    }),
    prisma.hotel.count({ where }),
  ]);

  res.json({ hotels, total, page: pageNum });
}));

/**
 * PUT /admin/hotels/:id/status
 */
router.put('/hotels/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['pending', 'active', 'suspended', 'churned'].includes(status)) {
    throw Errors.validation('Invalid status');
  }

  const hotel = await prisma.hotel.update({
    where: { id: req.params.id },
    data: { onboardingStatus: status },
  });

  res.json({ id: hotel.id, onboarding_status: hotel.onboardingStatus });
}));

/**
 * GET /admin/bookings
 */
router.get('/bookings', asyncHandler(async (req: Request, res: Response) => {
  const status = q(req, 'status');
  const hotelId = q(req, 'hotel_id');
  const page = q(req, 'page');
  const where: any = {};
  if (status) where.status = status;
  if (hotelId) where.hotelId = hotelId;

  const pageNum = page ? parseInt(page) : 1;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        hotel: { select: { name: true } },
        user: { select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({
    bookings: bookings.map((b) => ({
      booking_id: b.id,
      booking_ref: b.bookingRef,
      hotel_name: b.hotel.name,
      guest_name: b.guestName || b.user?.fullName,
      status: b.status,
      channel_source: b.channelSource,
      total_value_paise: b.totalValuePaise,
      checkin_date: b.checkinDate,
      created_at: b.createdAt,
    })),
    total,
    page: pageNum,
  });
}));

/**
 * GET /admin/coin-liability
 */
router.get('/coin-liability', asyncHandler(async (req: Request, res: Response) => {
  const [otaAgg, hotelBrandAgg] = await Promise.all([
    prisma.coinWallet.aggregate({ _sum: { otaCoinBalancePaise: true, rezCoinBalancePaise: true } }),
    prisma.hotelBrandCoinBalance.aggregate({ _sum: { balancePaise: true } }),
  ]);

  res.json({
    total_ota_coin_liability_paise: otaAgg._sum.otaCoinBalancePaise || 0,
    total_rez_coin_liability_paise: otaAgg._sum.rezCoinBalancePaise || 0,
    total_hotel_brand_coin_liability_paise: hotelBrandAgg._sum.balancePaise || 0,
    total_liability_paise:
      (otaAgg._sum.otaCoinBalancePaise || 0) +
      (otaAgg._sum.rezCoinBalancePaise || 0) +
      (hotelBrandAgg._sum.balancePaise || 0),
  });
}));

/**
 * PATCH /admin/hotels/:id/brand-coin — enable or disable hotel brand coin program
 */
router.patch('/hotels/:id/brand-coin', asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.params.id;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') throw Errors.validation('enabled (boolean) is required');

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { id: true, brandCoinName: true, brandCoinSymbol: true },
  });
  if (!hotel) throw Errors.notFound('Hotel');

  if (enabled && (!hotel.brandCoinName || !hotel.brandCoinSymbol)) {
    throw Errors.validation('brandCoinName and brandCoinSymbol must be set before enabling the program');
  }

  const updated = await prisma.hotel.update({
    where: { id: hotelId },
    data: { brandCoinEnabled: enabled },
    select: { id: true, brandCoinEnabled: true, brandCoinName: true, brandCoinSymbol: true },
  });

  res.json({
    hotel_id: updated.id,
    brand_coin_enabled: updated.brandCoinEnabled,
    brand_coin_name: updated.brandCoinName,
    brand_coin_symbol: updated.brandCoinSymbol,
  });
}));

/**
 * GET /admin/earn-rules
 */
router.get('/earn-rules', asyncHandler(async (req: Request, res: Response) => {
  const rules = await prisma.earnRule.findMany({
    orderBy: { createdAt: 'desc' },
    include: { hotel: { select: { name: true } } },
  });
  res.json({ rules: rules.map((r) => ({
    id: r.id, rule_name: r.ruleName, coin_type: r.coinType, channel_source: r.channelSource,
    hotel_id: r.hotelId, hotel_name: r.hotel?.name, user_tier: r.userTier,
    earn_pct: Number(r.earnPct), valid_from: r.validFrom, valid_until: r.validUntil,
    active: r.isActive, campaign_id: r.campaignId,
  })) });
}));

/**
 * POST /admin/earn-rules
 */
router.post('/earn-rules', asyncHandler(async (req: Request, res: Response) => {
  const {
    rule_name, coin_type, channel_source, hotel_id, user_tier,
    campaign_id, earn_pct, min_booking_value_paise, max_earn_per_booking_paise,
    valid_from, valid_until,
  } = req.body;

  if (!rule_name || !coin_type || earn_pct === undefined || !valid_from) {
    throw Errors.validation('rule_name, coin_type, earn_pct, valid_from required');
  }

  const rule = await prisma.earnRule.create({
    data: {
      ruleName: rule_name,
      coinType: coin_type,
      channelSource: channel_source || 'all',
      hotelId: hotel_id || null,
      userTier: user_tier || 'all',
      campaignId: campaign_id || null,
      earnPct: earn_pct,
      minBookingValuePaise: min_booking_value_paise || 0,
      maxEarnPerBookingPaise: max_earn_per_booking_paise || null,
      validFrom: new Date(valid_from),
      validUntil: valid_until ? new Date(valid_until) : null,
    },
  });

  res.status(201).json(rule);
}));

/**
 * PUT /admin/earn-rules/:id
 */
router.put('/earn-rules/:id', asyncHandler(async (req: Request, res: Response) => {
  const { earn_pct, is_active, valid_until, max_earn_per_booking_paise } = req.body;

  const rule = await prisma.earnRule.update({
    where: { id: req.params.id },
    data: {
      ...(earn_pct !== undefined && { earnPct: earn_pct }),
      ...(is_active !== undefined && { isActive: is_active }),
      ...(valid_until !== undefined && { validUntil: valid_until ? new Date(valid_until) : null }),
      ...(max_earn_per_booking_paise !== undefined && { maxEarnPerBookingPaise: max_earn_per_booking_paise }),
    },
  });

  res.json(rule);
}));

/**
 * GET /admin/settlements
 */
router.get('/settlements', asyncHandler(async (req: Request, res: Response) => {
  const status = q(req, 'status');
  const page = q(req, 'page');
  const where: any = {};
  if (status) where.status = status;

  const pageNum = page ? parseInt(page) : 1;

  const [batches, total] = await Promise.all([
    prisma.payoutBatch.findMany({
      where,
      orderBy: { initiatedAt: 'desc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.payoutBatch.count({ where }),
  ]);

  res.json({ batches, total, page: pageNum });
}));

/**
 * POST /admin/settlements/approve-batch
 */
router.post('/settlements/approve-batch', asyncHandler(async (req: Request, res: Response) => {
  const { batch_id } = req.body;
  if (!batch_id) throw Errors.validation('batch_id required');

  const batch = await prisma.payoutBatch.update({
    where: { id: batch_id },
    data: { status: 'completed', completedAt: new Date() },
  });

  // Mark all entries as paid
  await prisma.settlementEntry.updateMany({
    where: { payoutBatchId: batch_id },
    data: { status: 'paid' },
  });

  res.json({ batch_ref: batch.batchRef, status: 'completed' });
}));

/**
 * GET /admin/stay-registrations/pending
 */
router.get('/stay-registrations/pending', asyncHandler(async (req: Request, res: Response) => {
  const page = q(req, 'page');
  const pageNum = page ? parseInt(page) : 1;

  const [registrations, total] = await Promise.all([
    prisma.stayRegistration.findMany({
      where: { verificationStatus: 'pending' },
      include: {
        user: { select: { fullName: true, phone: true } },
        hotel: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: (pageNum - 1) * 20,
      take: 20,
    }),
    prisma.stayRegistration.count({ where: { verificationStatus: 'pending' } }),
  ]);

  res.json({
    registrations: registrations.map((r) => ({
      id: r.id,
      user_name: r.user.fullName || r.user.phone,
      hotel_name: r.hotel.name,
      stay_date: r.stayDate,
      receipt_image_url: r.receiptImageUrl,
      created_at: r.createdAt,
    })),
    total,
    page: pageNum,
  });
}));

/**
 * PUT /admin/stay-registrations/:id/approve
 */
router.put('/stay-registrations/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const { coins_to_award_paise } = req.body;
  const regId = req.params.id;

  const reg = await prisma.stayRegistration.findUnique({ where: { id: regId } });
  if (!reg) throw Errors.notFound('Stay registration');
  if (reg.verificationStatus !== 'pending') throw Errors.validation('Already reviewed');

  await prisma.$transaction(async (tx) => {
    const updated = await tx.stayRegistration.updateMany({
      where: { id: regId, verificationStatus: 'pending' },
      data: {
        verificationStatus: 'approved',
        coinsAwardedPaise: coins_to_award_paise || 0,
        reviewerId: req.admin!.adminId,
        reviewedAt: new Date(),
      },
    });
    if (updated.count === 0) throw Errors.validation('Already reviewed');

    // Award coins atomically with approval — prevents approved-but-not-awarded state
    if (coins_to_award_paise && coins_to_award_paise > 0) {
      const wallet = await tx.coinWallet.findUnique({ where: { userId: reg.userId } });
      if (wallet) {
        const newBalance = wallet.otaCoinBalancePaise + coins_to_award_paise;
        await tx.coinTransaction.create({
          data: {
            userId: reg.userId,
            walletId: wallet.id,
            coinType: 'ota',
            transactionType: 'earn',
            amountPaise: coins_to_award_paise,
            direction: 'credit',
            balanceAfterPaise: newBalance,
            notes: 'Awarded for verified stay registration',
          },
        });
        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: {
            otaCoinBalancePaise: newBalance,
            otaCoinLifetimeEarnedPaise: { increment: coins_to_award_paise },
          },
        });
      }
    }
  });

  res.json({ status: 'approved', coins_awarded_paise: coins_to_award_paise || 0 });
}));

/**
 * PUT /admin/stay-registrations/:id/reject
 */
router.put('/stay-registrations/:id/reject', asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  const regId = req.params.id;

  const reg = await prisma.stayRegistration.findUnique({ where: { id: regId } });
  if (!reg) throw Errors.notFound('Stay registration');
  if (reg.verificationStatus !== 'pending') throw Errors.validation('Already reviewed');

  const rejectionResult = await prisma.stayRegistration.updateMany({
    where: { id: regId, verificationStatus: 'pending' },
    data: {
      verificationStatus: 'rejected',
      rejectionReason: reason || 'Rejected by admin',
      reviewerId: req.admin!.adminId,
      reviewedAt: new Date(),
    },
  });
  if (rejectionResult.count === 0) throw Errors.validation('Already reviewed');

  res.json({ status: 'rejected' });
}));

/**
 * GET /admin/bill-payments — list all offline bill payments
 */
router.get('/bill-payments', asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, qInt(req, 'page') || 1);
  const perPage = 20;
  const hotelId = q(req, 'hotel_id');

  const where: Record<string, unknown> = {};
  if (hotelId) where.hotelId = hotelId;

  const [payments, total] = await Promise.all([
    prisma.offlinePayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        hotel: { select: { id: true, name: true, city: true } },
        user: { select: { id: true, fullName: true, phone: true } },
      },
    }),
    prisma.offlinePayment.count({ where }),
  ]);

  res.json({
    payments: payments.map((p) => ({
      id: p.id,
      payment_ref: p.paymentRef,
      date: p.createdAt,
      stay_date: p.stayDate,
      hotel: p.hotel,
      user: {
        id: p.user.id,
        name: p.user.fullName,
        // Mask phone: show last 4 digits
        phone: p.user.phone ? `*****${p.user.phone.slice(-4)}` : null,
      },
      bill_amount_paise: p.billAmountPaise ?? p.amountPaise,
      amount_paid_paise: p.amountPaise,
      ota_coin_burned_paise: p.otaCoinBurnedPaise,
      rez_coin_burned_paise: p.rezCoinBurnedPaise,
      ota_coin_earned_paise: p.otaCoinEarnedPaise,
      rez_coin_earned_paise: p.rezCoinEarnedPaise,
      transaction_fee_paise: p.transactionFeePaise,
      status: p.status,
    })),
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  });
}));

// ── Partner API Keys Management ─────────────────────────────────────────────────

/**
 * GET /admin/partner-keys — List all partner API keys
 */
router.get('/partner-keys', asyncHandler(async (req: Request, res: Response) => {
  const partnerId = q(req, 'partner_id');
  const page = qInt(req, 'page') || 1;
  const perPage = 20;

  const where: any = {};
  if (partnerId) where.partnerId = partnerId;

  const [keys, total] = await Promise.all([
    prisma.partnerApiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.partnerApiKey.count({ where }),
  ]);

  res.json({
    keys: keys.map((k) => ({
      id: k.id,
      partner_id: k.partnerId,
      partner_name: k.partnerName,
      prefix: k.apiKeyPrefix,
      scopes: k.scopes,
      label: k.label,
      is_active: k.isActive,
      last_used_at: k.lastUsedAt,
      expires_at: k.expiresAt,
      created_at: k.createdAt,
      revoked_at: k.revokedAt,
    })),
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  });
}));

/**
 * POST /admin/partner-keys — Create a new partner API key
 * FIX-BUG-3: Per-partner scoped API keys
 */
router.post('/partner-keys', asyncHandler(async (req: Request, res: Response) => {
  const { partner_id, partner_name, scopes, label, expires_days } = req.body;

  if (!partner_id || !partner_name) {
    throw Errors.validation('partner_id and partner_name are required');
  }

  // Validate scopes
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw Errors.validation('At least one scope is required');
  }

  const invalidScopes = scopes.filter((s: string) => !VALID_SCOPES.includes(s as ApiKeyScope));
  if (invalidScopes.length > 0) {
    throw Errors.validation(`Invalid scopes: ${invalidScopes.join(', ')}. Valid scopes: ${VALID_SCOPES.join(', ')}`);
  }

  // Generate the API key
  const { raw, prefix, hash } = generatePartnerApiKey();

  // Calculate expiration date if provided
  let expiresAt: Date | null = null;
  if (expires_days) {
    const days = parseInt(expires_days, 10);
    if (!isNaN(days) && days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
  }

  const partnerKey = await prisma.partnerApiKey.create({
    data: {
      partnerId: partner_id,
      partnerName: partner_name,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      scopes,
      label: label || null,
      expiresAt,
    },
  });

  res.status(201).json({
    id: partnerKey.id,
    partner_id: partnerKey.partnerId,
    partner_name: partnerKey.partnerName,
    api_key: raw, // Only returned on creation!
    prefix: partnerKey.apiKeyPrefix,
    scopes: partnerKey.scopes,
    label: partnerKey.label,
    expires_at: partnerKey.expiresAt,
    created_at: partnerKey.createdAt,
  });
}));

/**
 * DELETE /admin/partner-keys/:id — Revoke a partner API key
 */
router.delete('/partner-keys/:id', asyncHandler(async (req: Request, res: Response) => {
  const keyId = req.params.id;

  const existing = await prisma.partnerApiKey.findUnique({ where: { id: keyId } });
  if (!existing) throw Errors.notFound('Partner API key');
  if (existing.revokedAt) throw Errors.validation('Key already revoked');

  const revoked = await prisma.partnerApiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date(), isActive: false },
  });

  res.json({ id: revoked.id, status: 'revoked', revoked_at: revoked.revokedAt });
}));

/**
 * GET /admin/partner-keys/:id — Get partner API key details
 */
router.get('/partner-keys/:id', asyncHandler(async (req: Request, res: Response) => {
  const keyId = req.params.id;

  const key = await prisma.partnerApiKey.findUnique({ where: { id: keyId } });
  if (!key) throw Errors.notFound('Partner API key');

  res.json({
    id: key.id,
    partner_id: key.partnerId,
    partner_name: key.partnerName,
    prefix: key.apiKeyPrefix,
    scopes: key.scopes,
    label: key.label,
    is_active: key.isActive,
    last_used_at: key.lastUsedAt,
    expires_at: key.expiresAt,
    created_at: key.createdAt,
    revoked_at: key.revokedAt,
  });
}));

export default router;
