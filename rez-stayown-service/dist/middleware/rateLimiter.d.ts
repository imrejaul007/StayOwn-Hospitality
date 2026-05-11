/**
 * Rate Limiter Middleware for Room QR endpoints
 *
 * Prevents abuse by limiting:
 * - QR generation requests
 * - Token validation requests
 * - Charge operations
 * - Checkout requests
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Close Redis connection for graceful shutdown
 */
export declare function closeRedisClient(): Promise<void>;
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyPrefix: string;
}
declare const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig>;
/**
 * Create rate limiter middleware
 */
export declare function createRateLimiter(type?: keyof typeof RATE_LIMIT_CONFIGS): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Specialized rate limiters for different operations
 */
export declare const rateLimiters: {
    qrGenerate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    qrValidate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    qrValidateHigh: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    charge: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    checkout: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    hotelSearch: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    hotelBooking: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    general: (req: Request, res: Response, next: NextFunction) => Promise<void>;
};
export default rateLimiters;
//# sourceMappingURL=rateLimiter.d.ts.map