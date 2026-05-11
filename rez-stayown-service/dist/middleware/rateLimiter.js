"use strict";
/**
 * Rate Limiter Middleware for Room QR endpoints
 *
 * Prevents abuse by limiting:
 * - QR generation requests
 * - Token validation requests
 * - Charge operations
 * - Checkout requests
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiters = void 0;
exports.closeRedisClient = closeRedisClient;
exports.createRateLimiter = createRateLimiter;
const ioredis_1 = __importDefault(require("ioredis"));
// Redis client for rate limiting
let redis = null;
let isRedisConnected = false;
try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        redis = new ioredis_1.default(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });
        redis.on('connect', () => {
            isRedisConnected = true;
            console.log('[RateLimiter] Redis connected');
        });
        redis.on('error', (err) => {
            isRedisConnected = false;
            console.error('[RateLimiter] Redis error:', err.message);
        });
        redis.on('close', () => {
            isRedisConnected = false;
        });
    }
}
catch {
    console.warn('[RateLimiter] Redis not available, using in-memory fallback');
}
// In-memory fallback for when Redis is not available
const inMemoryStore = new Map();
// Periodic cleanup of in-memory store to prevent memory leaks
const MEMORY_CLEANUP_INTERVAL = 60 * 1000; // 1 minute
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
        console.log(`[RateLimiter] Cleaned ${cleaned} expired entries from in-memory store`);
    }
}, MEMORY_CLEANUP_INTERVAL);
/**
 * Close Redis connection for graceful shutdown
 */
async function closeRedisClient() {
    if (redis) {
        try {
            await redis.quit();
            console.log('[RateLimiter] Redis connection closed');
        }
        catch (err) {
            console.error('[RateLimiter] Error closing Redis:', err);
        }
        redis = null;
        isRedisConnected = false;
    }
}
const RATE_LIMIT_CONFIGS = {
    qrGenerate: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // 10 QR generations per minute
        keyPrefix: 'rl:qr:gen:',
    },
    qrValidate: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60, // 60 validations per minute
        keyPrefix: 'rl:qr:val:',
    },
    qrValidateHigh: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100, // 100 validations per minute (high throughput)
        keyPrefix: 'rl:qr:val:hi:',
    },
    charge: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30, // 30 charges per minute
        keyPrefix: 'rl:charge:',
    },
    checkout: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // 10 checkouts per minute
        keyPrefix: 'rl:checkout:',
    },
    hotelSearch: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30, // 30 searches per minute
        keyPrefix: 'rl:hotel:search:',
    },
    hotelBooking: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // 10 bookings per minute
        keyPrefix: 'rl:hotel:booking:',
    },
    general: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100, // 100 requests per minute
        keyPrefix: 'rl:general:',
    },
};
async function checkRateLimitRedis(key, config) {
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
        multi.zadd(fullKey, now, `${now}:${Math.random()}`);
        multi.zcard(fullKey);
        multi.expire(fullKey, Math.ceil(config.windowMs / 1000));
        const results = await multi.exec();
        if (!results) {
            return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowMs };
        }
        const count = results[2][1];
        const remaining = Math.max(0, config.maxRequests - count);
        const allowed = count <= config.maxRequests;
        const resetAt = now + config.windowMs;
        if (!allowed) {
            // Remove the entry we just added
            await redis.zremrangebyscore(fullKey, now, now);
        }
        return { allowed, remaining, resetAt };
    }
    catch (error) {
        console.error('[RateLimiter] Redis error:', error);
        return checkRateLimitMemory(key, config);
    }
}
function checkRateLimitMemory(key, config) {
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
function createRateLimiter(type = 'general') {
    const config = RATE_LIMIT_CONFIGS[type];
    return async (req, res, next) => {
        // Get identifier (IP or user ID)
        const identifier = req.user?.sub ||
            req.ip ||
            req.headers['x-forwarded-for']?.toString() ||
            'unknown';
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
exports.rateLimiters = {
    qrGenerate: createRateLimiter('qrGenerate'),
    qrValidate: createRateLimiter('qrValidate'),
    qrValidateHigh: createRateLimiter('qrValidateHigh'),
    charge: createRateLimiter('charge'),
    checkout: createRateLimiter('checkout'),
    hotelSearch: createRateLimiter('hotelSearch'),
    hotelBooking: createRateLimiter('hotelBooking'),
    general: createRateLimiter('general'),
};
exports.default = exports.rateLimiters;
//# sourceMappingURL=rateLimiter.js.map