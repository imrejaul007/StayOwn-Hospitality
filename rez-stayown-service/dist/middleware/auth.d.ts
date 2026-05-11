/**
 * Authentication Middleware for StayOwn Service
 *
 * Handles:
 * - JWT token validation
 * - Service-to-service authentication
 * - Role-based access control
 */
import { Request, Response, NextFunction } from 'express';
export interface JWTPayload {
    sub: string;
    email?: string;
    phone?: string;
    role?: 'user' | 'admin' | 'staff' | 'service';
    hotelId?: string;
    iat?: number;
    exp?: number;
}
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
            serviceAuth?: boolean;
        }
    }
}
/**
 * Validate JWT token from Authorization header
 */
export declare function authenticateToken(req: Request, res: Response, next: NextFunction): void;
/**
 * Verify internal service token for service-to-service communication
 */
export declare function authenticateService(req: Request, res: Response, next: NextFunction): void;
/**
 * Require specific roles
 */
export declare function requireRoles(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Require hotel-specific access (user must belong to the hotel)
 */
export declare function requireHotelAccess(req: Request, res: Response, next: NextFunction): void;
/**
 * Optional authentication - doesn't fail if no token
 */
export declare function optionalAuth(req: Request, _res: Response, next: NextFunction): void;
/**
 * Generate a service token for internal use
 */
export declare function generateServiceToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
/**
 * Validate API key for programmatic access
 * Accepts either:
 * - x-api-key header
 * - Bearer token with 'service' role
 * - Service key header (x-service-key)
 */
export declare function validateApiKey(req: Request, res: Response, next: NextFunction): void;
/**
 * Verify WhatsApp webhook signature (Meta)
 * CRITICAL: Implements HMAC-SHA256 signature verification
 */
export declare function verifyWebhookSignature(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map