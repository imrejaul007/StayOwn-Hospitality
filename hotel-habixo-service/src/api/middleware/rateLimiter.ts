/**
 * Redis-backed Rate Limiter Middleware for Habixo Service
 *
 * Provides configurable rate limiting using Redis sorted sets
 * Falls back to in-memory store when Redis is unavailable
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from './utils/logger';
import Redis from 'ioredis';
import { config } from '../../config';

// Redis client for rate limiting
let redis: Redis | null = null;
let isRedisConnected = false;

try {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    redis.on('connect', () => {
      isRedisConnected = true;
    });
    redis.on('error', () => {
      isRedisConnected = false;
    });
  } else if (config.redis.host) {
    // Fallback to config-based connection
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    redis.on('connect', () => {
      isRedisConnected = true;
    });
    redis.on('error', () => {
      isRedisConnected = false;
    });
  }
} catch {
  logger.warn('[RateLimiter] Redis not available, using in-memory fallback');
}

// In-memory fallback for when Redis is not available
const inMemoryStore: Map<string, { count: number; resetAt: number }> = new Map();

// Periodic cleanup to prevent memory leaks
const MEMORY_CLEANUP_INTERVAL = 60000; // 1 minute
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of inMemoryStore.entries()) {
    if (value.resetAt < now) {
      inMemoryStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info(`[RateLimiter] Cleaned ${cleaned} expired entries`);
  }
}, MEMORY_CLEANUP_INTERVAL);

/**
 * Export Redis close function for graceful shutdown
 */
export async function closeRedisClient(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // Ignore errors during shutdown
    }
    redis = null;
    isRedisConnected = false;
  }
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  keyPrefix: string;      // Redis key prefix
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  booking: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 10,            // 10 bookings per minute
    keyPrefix: 'rl:habixo:booking:',
  },
  search: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 30,            // 30 searches per minute
    keyPrefix: 'rl:habixo:search:',
  },
  qrValidate: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 100,          // 100 validations per minute
    keyPrefix: 'rl:habixo:qr:val:',
  },
  general: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 100,           // 100 requests per minute
    keyPrefix: 'rl:habixo:general:',
  },
};

/**
 * SECURITY: Safely extract rate limit identifier from request
 * Prevents log injection via x-forwarded-for header
 */
function getSafeIdentifier(req: Request): string {
  // Prefer authenticated user ID
  if (req.user?.userId) {
    return `user:${req.user.userId}`;
  }
  if (req.user?.sub) {
    return `user:${req.user.sub}`;
  }

  // Use IP address, sanitizing x-forwarded-for
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  // x-forwarded-for can contain multiple IPs - take only first (original client)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    const firstIp = forwardedFor.split(',')[0].trim();
    // Validate it's a reasonable IP format (basic check)
    if (/^[\d.:a-f]+$/.test(firstIp)) {
      return `ip:${firstIp}`;
    }
  }

  return `ip:${ip}`;
}

async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (!redis) {
    return checkRateLimitMemory(key, config);
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const fullKey = `${config.keyPrefix}${key}`;

  try {
    // Remove old entries and count current
    const multi = redis.multi();
    multi.zremrangebyscore(fullKey, 0, windowStart);
    // STATISTICAL: Random suffix for Redis sorted set score uniqueness (not for security)
    // This is acceptable as sorted sets don't require cryptographic randomness
    multi.zadd(fullKey, now, `${now}:${randomUUID()}`);
    multi.zcard(fullKey);
    multi.expire(fullKey, Math.ceil(config.windowMs / 1000));

    const results = await multi.exec();

    if (!results) {
      return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowMs };
    }

    const count = results[2][1] as number;
    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count <= config.maxRequests;
    const resetAt = now + config.windowMs;

    if (!allowed) {
      // Remove the entry we just added
      await redis.zremrangebyscore(fullKey, now, now);
    }

    return { allowed, remaining, resetAt };
  } catch (error) {
    console.error('[RateLimiter] Redis error:', error);
    return checkRateLimitMemory(key, config);
  }
}

function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const fullKey = `${config.keyPrefix}${key}`;

  const entry = inMemoryStore.get(fullKey);

  if (!entry || entry.resetAt < now) {
    // New window
    inMemoryStore.set(fullKey, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Existing window
  entry.count += 1;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(type: keyof typeof RATE_LIMIT_CONFIGS = 'general') {
  const config = RATE_LIMIT_CONFIGS[type];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // SECURITY: Get identifier (user ID preferred over IP)
    const identifier = getSafeIdentifier(req);

    const result = await checkRateLimitRedis(identifier, config);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'rate_limit_exceeded',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Specialized rate limiters for different operations
 */
export const rateLimiters = {
  booking: createRateLimiter('booking'),
  search: createRateLimiter('search'),
  qrValidate: createRateLimiter('qrValidate'),
  general: createRateLimiter('general'),
};

export default rateLimiters;
