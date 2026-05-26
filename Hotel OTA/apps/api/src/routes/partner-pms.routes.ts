/**
 * Partner PMS Routes — server-to-server only
 *
 * Called by the Hotel PMS backend to:
 * 1. Award hotel brand coins when a guest checks out
 * 2. Push inventory updates to Hotel OTA
 *
 * Auth: x-internal-token header (same secret as INTERNAL_SERVICE_TOKEN)
 */

import { Router, Request, Response } import logger from './utils/logger';
import from 'express';
import { prisma } from '../config/database';
import { CoinService } from '../services/finance/coin.service';
import { Errors } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import crypto, { timingSafeEqual } from 'crypto';

const router = Router();

// ── Internal token auth ───────────────────────────────────────────────────────

function authenticatePms(req: Request, res: Response, next: Function) {
  const token = req.headers['x-internal-token'];
  const expected = process.env.REZ_OTA_INTERNAL_TOKEN || process.env.INTERNAL_SERVICE_TOKEN || '';

  if (!expected) {
    // No token configured — reject all requests regardless of environment
    logger.error('[PMS] REZ_OTA_INTERNAL_TOKEN / INTERNAL_SERVICE_TOKEN not set — all PMS requests rejected');
    return res.status(503).json({ error: 'PMS integration not configured' });
  }

  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Missing x-internal-token' });
  }

  // Constant-time compare — buffers must be equal length, otherwise timingSafeEqual throws
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (tokenBuf.length !== expectedBuf.length) {
    return res.status(401).json({ error: 'Invalid internal token' });
  }
  const matches = timingSafeEqual(tokenBuf, expectedBuf);

  if (!matches) return res.status(401).json({ error: 'Invalid internal token' });
  next();
}

router.use(authenticatePms);

// ── POST /partner/pms/coins/earn ──────────────────────────────────────────────
// Called by PMS on guest checkout to credit hotel brand coins.

router.post('/coins/earn', asyncHandler(async (req: Request, res: Response) => {
  const {
    user_id,    // Hotel OTA userId (UUID)
    hotel_id,   // Hotel OTA hotelId (UUID)
    booking_id, // optional — PMS or OTA booking reference
    booking_value_paise,
    coin_type,  // must be 'hotel_brand'
    source,     // e.g. 'pms_checkout'
  } = req.body;

  if (!user_id || !hotel_id || !booking_value_paise) {
    throw Errors.validation('user_id, hotel_id, and booking_value_paise are required');
  }

  if (coin_type && coin_type !== 'hotel_brand') {
    throw Errors.validation('Only hotel_brand coin_type is supported on this endpoint');
  }

  // Verify the hotel has brand coins enabled
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotel_id },
    select: { brandCoinEnabled: true, brandCoinName: true },
  });
  if (!hotel) throw Errors.notFound('Hotel');
  if (!hotel.brandCoinEnabled) {
    return res.json({ awarded: false, reason: 'Brand coin program not enabled for this hotel' });
  }

  // Find earn rule
  const earnRule = await CoinService.findEarnRule({
    coinType: 'hotel_brand',
    hotelId: hotel_id,
    channelSource: 'all',
    userTier: 'all',
    bookingValue: booking_value_paise,
  });

  if (!earnRule) {
    return res.json({ awarded: false, reason: 'No active earn rule for this hotel' });
  }

  const amountPaise = CoinService.calculateEarnAmount(
    booking_value_paise,
    Number(earnRule.earnPct),
    earnRule.maxEarnPerBookingPaise
  );

  if (amountPaise <= 0) {
    return res.json({ awarded: false, reason: 'Calculated earn amount is zero' });
  }

  await CoinService.earnCoins({
    userId: user_id,
    coinType: 'hotel_brand',
    amountPaise,
    bookingId: booking_id || `pms_earn_${Date.now()}`,
    earnRuleId: earnRule.id,
    hotelId: hotel_id,
  });

  res.json({
    awarded: true,
    coin_type: 'hotel_brand',
    coin_name: hotel.brandCoinName || 'Brand Points',
    amount_paise: amountPaise,
    hotel_id,
    user_id,
    source: source || 'pms_checkout',
  });
}));

// ── PUT /partner/pms/inventory/:hotelId/:roomTypeId/:date ─────────────────────
// Called by PMS when room availability or rate changes.

router.put('/inventory/:hotelId/:roomTypeId/:date', asyncHandler(async (req: Request, res: Response) => {
  const { hotelId, roomTypeId, date } = req.params;
  const { available_rooms, rate_paise, is_blocked } = req.body;

  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId },
  });
  if (!roomType) throw Errors.notFound('Room type');

  const slot = await prisma.inventorySlot.upsert({
    where: { roomTypeId_date: { roomTypeId, date: new Date(date) } },
    create: {
      hotelId,
      roomTypeId,
      date: new Date(date),
      totalRooms: available_rooms ?? roomType.maxOccupancy,
      availableRooms: available_rooms ?? roomType.maxOccupancy,
      ratePaise: rate_paise ?? roomType.baseRatePaise,
      isBlocked: is_blocked ?? false,
    },
    update: {
      ...(available_rooms !== undefined && { availableRooms: available_rooms, totalRooms: available_rooms }),
      ...(rate_paise !== undefined && { ratePaise: rate_paise }),
      ...(is_blocked !== undefined && { isBlocked: is_blocked }),
    },
  });

  res.json({
    hotel_id: hotelId,
    room_type_id: roomTypeId,
    date,
    available_rooms: slot.availableRooms,
    rate_paise: slot.ratePaise,
    is_blocked: slot.isBlocked,
  });
}));

export default router;
