import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authenticateUser } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { q, qInt } from '../utils/query';
import { RezIntegrationService } from '../services/integrations/rez-integration.service';

const router = Router();

/**
 * GET /user/profile
 * Syncs REZ wallet balance if user has REZ account linked
 */
router.get('/profile', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { coinWallet: true },
  });
  if (!user) throw Errors.notFound('User');

  // Sync REZ balance if user has REZ account linked (non-blocking with timeout)
  let rezCoinBalancePaise = user.coinWallet?.rezCoinBalancePaise || 0;
  if (user.rezUserId) {
    // Sync asynchronously without blocking the response
    RezIntegrationService.syncRezWalletBalance(user.id, user.rezUserId).catch(err =>
      console.warn('[UserProfile] REZ balance sync failed:', err.message)
    );
  }

  res.json({
    id: user.id,
    phone: user.phone,
    email: user.email,
    full_name: user.fullName,
    profile_photo_url: user.profilePhotoUrl,
    tier: user.tier,
    ota_coin_balance_paise: user.coinWallet?.otaCoinBalancePaise || 0,
    rez_coin_balance_paise: rezCoinBalancePaise,
    attribution_source: user.attributionSource,
    created_at: user.createdAt,
  });
}));

/**
 * PUT /user/profile
 */
router.put('/profile', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const { full_name, email, profile_photo_url } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(full_name !== undefined && { fullName: full_name }),
      ...(email !== undefined && { email }),
      ...(profile_photo_url !== undefined && { profilePhotoUrl: profile_photo_url }),
    },
  });

  res.json({
    id: user.id,
    phone: user.phone,
    email: user.email,
    full_name: user.fullName,
    tier: user.tier,
  });
}));

/**
 * POST /user/rez-sync — Sync REZ profile and wallet balance
 * Requires user to have REZ account linked (rezUserId set)
 */
router.post('/rez-sync', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { coinWallet: true },
  });
  if (!user) throw Errors.notFound('User');

  if (!user.rezUserId) {
    throw Errors.validation('No REZ account linked to this user');
  }

  // Sync REZ balance
  const rezCoinBalancePaise = await RezIntegrationService.syncRezWalletBalance(user.id, user.rezUserId);

  // Return updated profile
  res.json({
    id: user.id,
    phone: user.phone,
    email: user.email,
    full_name: user.fullName,
    tier: user.tier,
    ota_coin_balance_paise: user.coinWallet?.otaCoinBalancePaise || 0,
    rez_coin_balance_paise: rezCoinBalancePaise,
    synced_at: new Date(),
  });
}));

/**
 * POST /user/stay-registration
 */
router.post('/stay-registration', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const { hotel_id, stay_date, receipt_image_url } = req.body;

  if (!hotel_id || !stay_date || !receipt_image_url) {
    throw Errors.validation('hotel_id, stay_date, and receipt_image_url are required');
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: hotel_id } });
  if (!hotel) throw Errors.notFound('Hotel');

  const registration = await prisma.stayRegistration.create({
    data: {
      userId: req.user!.userId,
      hotelId: hotel_id,
      stayDate: new Date(stay_date),
      receiptImageUrl: receipt_image_url,
    },
  });

  res.status(201).json({
    registration_id: registration.id,
    status: registration.verificationStatus,
    estimated_review_hours: 24,
  });
}));

/**
 * GET /user/stay-registration/:id
 */
router.get('/stay-registration/:id', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const reg = await prisma.stayRegistration.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
    include: { hotel: { select: { name: true } } },
  });

  if (!reg) throw Errors.notFound('Stay registration');

  res.json({
    id: reg.id,
    hotel_name: reg.hotel.name,
    stay_date: reg.stayDate,
    status: reg.verificationStatus,
    coins_awarded_paise: reg.coinsAwardedPaise,
    reviewed_at: reg.reviewedAt,
  });
}));

/**
 * GET /user/upcoming-trip — get next upcoming booking (for home screen)
 */
router.get('/upcoming-trip', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const now = new Date();

  const booking = await prisma.booking.findFirst({
    where: {
      userId,
      status: { in: ['confirmed', 'checked_in'] },
      checkinDate: { gte: now },
    },
    include: {
      hotel: {
        select: {
          name: true,
          city: true,
          addressLine1: true,
          images: true,
        },
      },
      roomType: { select: { name: true } },
    },
    orderBy: { checkinDate: 'asc' },
  });

  if (!booking) {
    return res.json({ upcoming_trip: null });
  }

  res.json({
    upcoming_trip: {
      booking_id: booking.id,
      booking_ref: booking.bookingRef,
      status: booking.status,
      hotel: {
        name: booking.hotel.name,
        city: booking.hotel.city,
        address: booking.hotel.addressLine1,
        thumbnail_url: (booking.hotel.images as string[])?.[0] || null,
      },
      room_type_name: booking.roomType.name,
      checkin_date: booking.checkinDate,
      checkout_date: booking.checkoutDate,
      num_nights: booking.numNights,
      num_rooms: booking.numRooms,
      num_guests: booking.numGuests,
      total_value_paise: booking.totalValuePaise,
    },
  });
}));

/**
 * GET /user/referral-code — get or create referral code for the user
 */
router.get('/referral-code', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Look for an existing referral record where this user is the referrer
  // and no referred user yet (i.e. the shareable code)
  let referral = await prisma.referral.findFirst({
    where: { referrerId: userId, referredUserId: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!referral) {
    // Generate a unique referral code: REF + last 6 chars of userId (uppercased) + UUID suffix (uppercased, trimmed)
    const suffix = userId.replace(/-/g, '').slice(-6).toUpperCase();
    const uuidSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const referralCode = `REF${suffix}${uuidSuffix}`;

    referral = await prisma.referral.create({
      data: {
        referrerId: userId,
        referralCode,
        status: 'pending',
      },
    });
  }

  res.json({
    referral_code: referral.referralCode,
    referrer_reward_paise: referral.referrerRewardPaise,
    referred_reward_paise: referral.referredRewardPaise,
    created_at: referral.createdAt,
  });
}));

/**
 * PUT /user/fcm-token — Update FCM push token
 */
router.put('/fcm-token', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const { fcm_token } = req.body;
  if (!fcm_token) throw Errors.validation('fcm_token is required');

  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { fcmToken: fcm_token },
  });

  res.json({ updated: true });
}));

export default router;
