import { Router, Request, Response } from 'express';
import { CoinService } from '../services/finance/coin.service';
import { authenticateUser } from '../middleware/auth';
import { Errors } from '../utils/errors';
import { q, qInt } from '../utils/query';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../config/database';
import { RezIntegrationService } from '../services/integrations/rez-integration.service';

const router = Router();

router.get('/', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const result = await CoinService.getWallet(userId);

  // Fire-and-forget REZ balance sync if user has a REZ account linked.
  // The updated balance is persisted to DB for the next request.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { rezUserId: true },
  });
  if (user?.rezUserId) {
    RezIntegrationService.syncRezWalletBalance(userId, user.rezUserId)
      .catch(err => console.warn('[WalletGet] REZ balance sync failed:', err.message));
  }

  res.json({
    ota_coin_balance_paise: result.otaCoinBalancePaise,
    rez_coin_balance_paise: result.rezCoinBalancePaise,
    ota_coin_expiring_soon_paise: result.otaCoinExpiringSoonPaise,
    ota_coin_expiry_date: result.otaCoinExpiryDate,
    lifetime_ota_earned_paise: result.lifetimeOtaEarnedPaise,
    lifetime_ota_burned_paise: result.lifetimeOtaBurnedPaise,
    hotel_brand_coins: result.hotelBrandCoins,
  });
}));

router.get('/transactions', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const result = await CoinService.getTransactions(
    req.user!.userId,
    q(req, 'coin_type'),
    qInt(req, 'page'),
    qInt(req, 'per_page'),
  );
  res.json(result);
}));

router.post('/check-burn', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const {
    booking_value_paise, ota_coin_requested_paise, rez_coin_requested_paise,
    hotel_brand_coin_requested_paise, hotel_id,
  } = req.body;

  if (!booking_value_paise) throw Errors.validation('booking_value_paise is required');

  const result = await CoinService.checkBurn({
    bookingValuePaise: booking_value_paise,
    otaCoinRequestedPaise: ota_coin_requested_paise || 0,
    rezCoinRequestedPaise: rez_coin_requested_paise || 0,
    hotelBrandCoinRequestedPaise: hotel_brand_coin_requested_paise || 0,
    hotelId: hotel_id,
    userTier: req.user!.tier,
    userId: req.user!.userId,
  });

  res.json({
    ota_coin_applicable_paise: result.otaCoinApplicablePaise,
    rez_coin_applicable_paise: result.rezCoinApplicablePaise,
    hotel_brand_coin_applicable_paise: result.hotelBrandCoinApplicablePaise,
    total_discount_paise: result.totalDiscountPaise,
    pg_amount_paise: result.pgAmountPaise,
    ota_cap_applied: result.otaCapApplied,
    ota_cap_reason: result.otaCapReason,
  });
}));

export default router;
