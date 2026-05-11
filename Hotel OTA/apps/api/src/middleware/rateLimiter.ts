import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis';

/**
 * HOTEL-OTA-ARCH-001: Redis-backed rate limiting
 * Replaces in-memory store with Redis for multi-instance safety.
 * Each limiter shares state across all API instances.
 */

function createRedisStore(prefix: string, expirySeconds: number) {
  return new RedisStore({
    // @ts-expect-error - rate-limit-redis v4 API compatibility
    sendCommand: async (command: string, args: string[]) => {
      return redis.call(command, ...args) as Promise<number | null>;
    },
    prefix,
    expiry: expirySeconds,
  });
}

export const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:otp:', 600),
  keyGenerator: (req) => req.body?.phone || req.ip || 'unknown',
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many OTP requests. Try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:search:', 60),
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

export const bookingRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:booking:', 3600),
  keyGenerator: (req): string => (req as any).user?.userId || req.ip || 'unknown',
  message: { error: true, code: 'RATE_LIMITED', message: 'Too many booking attempts. Try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

export const partnerRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:partner:', 60),
  keyGenerator: (req) => (req.headers['x-api-key'] as string) || req.ip || 'unknown',
  message: { error: true, code: 'RATE_LIMITED', message: 'Partner API rate limit exceeded.' },
  skip: () => process.env.NODE_ENV === 'test',
});

export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('rl:admin:', 60),
  message: { error: true, code: 'RATE_LIMITED', message: 'Admin API rate limit exceeded.' },
  skip: () => process.env.NODE_ENV === 'test',
});
