/**
 * Authentication middleware for Channel Manager Service
 * Validates internal service tokens and hotel manager tokens
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.INTERNAL_JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    hotelId?: string;
    role?: string;
    type: 'service' | 'user';
  };
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const serviceToken = req.headers['x-service-token'] as string;

  // Check for internal service token first
  if (serviceToken) {
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (expectedToken && serviceToken === expectedToken) {
      req.user = { id: 'internal-service', type: 'service' };
      return next();
    }
  }

  // Check for JWT token
  if (authHeader) {
    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    if (!JWT_SECRET) {
      // Fail closed if no JWT secret configured
      res.status(500).json({ error: 'Server misconfiguration' });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = {
        id: decoded.sub || decoded.userId,
        hotelId: decoded.hotelId,
        role: decoded.role,
        type: 'user',
      };
      return next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  }

  res.status(401).json({ error: 'Authentication required' });
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.type === 'service') {
      // Internal services bypass role checks
      return next();
    }

    if (roles.length > 0 && req.user.role && !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
