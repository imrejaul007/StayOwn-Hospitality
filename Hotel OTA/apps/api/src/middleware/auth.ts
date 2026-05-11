import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto, { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { Errors } from '../utils/errors';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

export interface JwtPayload {
  userId: string;
  id?: string;
  phone: string;
  tier: string;
  hotelId?: string;
  role?: string;
  name?: string;
}

export interface AdminJwtPayload {
  adminId: string;
  email: string;
  role: string;
}

export interface HotelStaffJwtPayload {
  staffId: string;
  hotelId: string;
  phone: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      admin?: AdminJwtPayload;
      hotelStaff?: HotelStaffJwtPayload;
    }
  }
}

/**
 * Authenticate user JWT (OTA app users)
 */
export async function authenticateUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.authRequired();
  }

  const token = authHeader.slice(7);

  // Check token blacklist
  try {
    const { redis } = require('../config/redis');
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) {
      throw Errors.authRequired();
    }
  } catch (e: any) {
    if (e?.statusCode === 401) throw e; // re-throw auth errors
    // HOTEL-OTA-P1 FIX: Redis unavailable → always deny. Letting unauthenticated requests
    // through because Redis is down is a privilege escalation vector.
    logger.error('[AUTH] Redis unavailable during token blacklist check — denying request');
    throw Errors.authRequired();
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw Errors.authRequired();
  }
}

/**
 * Authenticate admin JWT
 * FIX-BUG-2: Now includes role verification to ensure user has ADMIN role
 */
export async function authenticateAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.authRequired();
  }

  const token = authHeader.slice(7);

  // Check token blacklist
  try {
    const { redis } = require('../config/redis');
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) {
      throw Errors.authRequired();
    }
  } catch (e: any) {
    if (e?.statusCode === 401) throw e; // re-throw auth errors
    // HOTEL-OTA-P1 FIX: Redis unavailable → always deny.
    logger.error('[AUTH] Redis unavailable during token blacklist check — denying request');
    throw Errors.authRequired();
  }

  try {
    const payload = jwt.verify(token, env.JWT_ADMIN_SECRET) as AdminJwtPayload;
    // FIX-BUG-2: Verify role is ADMIN before allowing access
    if (!payload.role || payload.role !== 'ADMIN') {
      logger.warn('[AUTH] Non-admin user attempted to access admin route', { adminId: payload.adminId, role: payload.role });
      throw Errors.forbidden();
    }
    req.admin = payload;
    next();
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.statusCode === 403) throw err;
    throw Errors.authRequired();
  }
}

/**
 * FIX-BUG-2: Additional middleware to require specific admin roles
 * Usage: router.use('/route', authenticateAdmin, requireAdminRole('SUPERADMIN'));
 */
export function requireAdminRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      throw Errors.authRequired();
    }
    if (!allowedRoles.includes(req.admin.role)) {
      logger.warn('[AUTH] Admin role mismatch', { adminId: req.admin.adminId, role: req.admin.role, required: allowedRoles });
      throw Errors.forbidden();
    }
    next();
  };
}

/**
 * Authenticate hotel staff JWT (via OTP, same secret as user but different payload)
 * FIX-BUG-1: Verify staff member actually works at the hotel from JWT claim
 */
export async function authenticateHotelStaff(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Errors.authRequired();
  }

  const token = authHeader.slice(7);

  // Check token blacklist
  try {
    const { redis } = require('../config/redis');
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) {
      throw Errors.authRequired();
    }
  } catch (e: any) {
    if (e?.statusCode === 401) throw e; // re-throw auth errors
    // HOTEL-OTA-P1 FIX: Redis unavailable → always deny.
    logger.error('[AUTH] Redis unavailable during token blacklist check — denying request');
    throw Errors.authRequired();
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as HotelStaffJwtPayload;
    if (!payload.hotelId) {
      throw Errors.authRequired();
    }
    
    // FIX-BUG-1: Verify staff member exists in database and belongs to claimed hotel
    // This prevents JWT token forgery/modification attacks
    const staffMember = await prisma.hotelStaff.findFirst({
      where: {
        id: payload.staffId,
        hotelId: payload.hotelId,
        isActive: true,  // Also check staff is not suspended
      },
      select: { id: true },
    });
    
    if (!staffMember) {
      logger.warn('[AUTH] Hotel staff verification failed', { staffId: payload.staffId, hotelId: payload.hotelId });
      throw Errors.authRequired();
    }
    
    req.hotelStaff = payload;
    next();
  } catch (err: any) {
    if (err?.statusCode === 401) throw err;
    throw Errors.authRequired();
  }
}

/**
 * FIX-BUG-3: Authenticate partner API key with per-partner scoping
 * Supports both legacy single key (REZ_API_KEY) and new per-partner keys
 */
export async function authenticatePartner(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    throw Errors.forbidden();
  }

  // Legacy fallback: single API key for all partners
  if (env.REZ_API_KEY) {
    const keyBuf = Buffer.from(apiKey);
    const expectedBuf = Buffer.from(env.REZ_API_KEY);
    if (keyBuf.length === expectedBuf.length && timingSafeEqual(keyBuf, expectedBuf)) {
      logger.warn('[AUTH] Legacy API key used - partner should migrate to scoped keys');
      return next();
    }
  }

  // FIX-BUG-3: Per-partner API key with scoped permissions
  const apiKeyPrefix = apiKey.substring(0, 8);
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const partnerKey = await prisma.partnerApiKey.findFirst({
    where: {
      apiKeyPrefix: apiKeyPrefix,
      apiKeyHash: apiKeyHash,
      isActive: true,
    },
  });

  if (!partnerKey) {
    logger.warn('[AUTH] Invalid or expired partner API key', { prefix: apiKeyPrefix });
    throw Errors.forbidden();
  }

  // Check expiration
  if (partnerKey.expiresAt && new Date() > partnerKey.expiresAt) {
    logger.warn('[AUTH] Expired partner API key', { partnerId: partnerKey.partnerId });
    throw Errors.forbidden();
  }

  // Update last used timestamp (fire and forget)
  prisma.partnerApiKey.update({
    where: { id: partnerKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  // Store partner info on request for scope checking
  (req as any).partnerKey = partnerKey;

  logger.info('[AUTH] Partner API key authenticated', {
    partnerId: partnerKey.partnerId,
    scopes: partnerKey.scopes,
  });

  next();
}

/**
 * FIX-BUG-3: Middleware to require specific API key scopes
 * Usage: router.get('/route', authenticatePartner, requirePartnerScope('READ_BOOKINGS'));
 */
export function requirePartnerScope(...requiredScopes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const partnerKey = (req as any).partnerKey;
    if (!partnerKey) {
      throw Errors.authRequired();
    }

    const hasScope = requiredScopes.some((scope) => partnerKey.scopes.includes(scope));
    if (!hasScope) {
      logger.warn('[AUTH] Partner lacks required scope', {
        partnerId: partnerKey.partnerId,
        required: requiredScopes,
        actual: partnerKey.scopes,
      });
      throw Errors.forbidden();
    }

    next();
  };
}

/**
 * FIX-BUG-3: Generate a new partner API key (for admin use)
 * Returns the raw key (only time it's visible) and stores the hash
 */
export function generatePartnerApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `pk_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return {
    raw,
    prefix: raw.substring(0, 8),
    hash,
  };
}

// Aliases for compatibility
export const authMiddleware = authenticateUser;
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authenticateUser(req, res, next);
  } catch {
    // For optional auth, just continue without user
    next();
  }
};
