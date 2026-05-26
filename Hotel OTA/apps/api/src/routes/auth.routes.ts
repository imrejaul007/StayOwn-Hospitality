import { Router, Request, Response } import logger from './utils/logger';
import from 'express';
import { AuthService } from '../services/auth/auth.service';
import { RezIntegrationService } from '../services/integrations/rez-integration.service';
import { otpRateLimiter, adminRateLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { Errors } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { env } from '../config/env';

const router = Router();

const sendOtpSchema = z.object({ phone: z.string().length(10) });
const verifyOtpSchema = z.object({
  phone: z.string().length(10),
  otp: z.string().length(6),
  otp_ref: z.string(),
});
const refreshSchema = z.object({ refresh_token: z.string() });
const rezSsoSchema = z.object({ rez_access_token: z.string() });

router.post('/send-otp', otpRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid phone number');

  const result = await AuthService.sendOtp(parsed.data.phone);
  res.json({ otp_ref: result.otpRef, expires_in_seconds: result.expiresInSeconds, ...(result.devOtp ? { dev_otp: result.devOtp } : {}) });
}));

router.post('/verify-otp', otpRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid request');

  const result = await AuthService.verifyOtp(parsed.data.phone, parsed.data.otp, parsed.data.otp_ref);
  res.json({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    user: {
      id: result.user.id,
      phone: result.user.phone,
      full_name: result.user.fullName,
      tier: result.user.tier,
      ota_coin_balance_paise: result.user.otaCoinBalancePaise,
      is_new_user: result.user.isNewUser,
    },
  });
}));

router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid request');

  const result = await AuthService.refreshToken(parsed.data.refresh_token);
  res.json({ access_token: result.accessToken, expires_in: result.expiresIn });
}));

// REZ SSO authentication
router.post('/rez-sso', asyncHandler(async (req: Request, res: Response) => {
  const parsed = rezSsoSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('REZ access token required');

  const result = await RezIntegrationService.completeSsoFlow(parsed.data.rez_access_token);
  res.json({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    user: {
      id: result.user.id,
      phone: result.user.phone,
      full_name: result.user.fullName,
      tier: result.user.tier,
      ota_coin_balance_paise: result.user.otaCoinBalancePaise,
      rez_coin_balance_paise: result.user.rezCoinBalancePaise,
      is_new_user: result.user.isNewUser,
    },
  });
}));

// Hotel staff auth
router.post('/hotel/send-otp', otpRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid phone number');

  const result = await AuthService.sendHotelStaffOtp(parsed.data.phone);
  res.json({ otp_ref: result.otpRef, expires_in_seconds: result.expiresInSeconds, ...(result.devOtp ? { dev_otp: result.devOtp } : {}) });
}));

router.post('/hotel/verify-otp', otpRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) throw Errors.validation('Invalid request');

  const result = await AuthService.verifyHotelStaffOtp(parsed.data.phone, parsed.data.otp, parsed.data.otp_ref);
  res.json({
    access_token: result.accessToken,
    staff_id: result.staffId,
    hotel_id: result.hotelId,
    role: result.role,
  });
}));

// Admin auth
router.post('/admin/login', adminRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password?.trim()) throw Errors.validation('Email and password required');

  const result = await AuthService.adminLogin(email, password);
  res.json({ access_token: result.accessToken, admin: result.admin });
}));

// Logout — blacklist the current access token in Redis
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.json({ success: true, message: 'Logged out' }); // no-op if no token
  }
  const token = authHeader.slice(7);
  try {
    const { redis } = await import('../config/redis');
    // Store in Redis with TTL matching JWT expiry (default 1 hour)
    const ttl = env.JWT_EXPIRY || 3600;
    await redis.set(`blacklist:${token}`, '1', 'EX', ttl);
  } catch {
    // If Redis is unavailable, log but still return success
    logger.warn('[Auth] Redis unavailable — token not blacklisted');
  }
  res.json({ success: true, message: 'Logged out successfully' });
}));

export default router;
