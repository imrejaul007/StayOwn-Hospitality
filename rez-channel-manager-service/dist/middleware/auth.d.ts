/**
 * Authentication middleware for Channel Manager Service
 * Validates internal service tokens and hotel manager tokens
 */
import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        hotelId?: string;
        role?: string;
        type: 'service' | 'user';
    };
}
export declare function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
export declare function requireRole(...roles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map