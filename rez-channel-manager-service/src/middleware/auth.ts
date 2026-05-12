/**
 * Authentication middleware for Channel Manager Service - RABTUL Integration
 * Validates tokens via the RABTUL Auth Service
 */

import { Request, Response, NextFunction } from 'express';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    hotelId?: string;
    role?: string;
    type: 'service' | 'user';
  };
}

/**
 * Verify token with RABTUL Auth Service
 */
async function verifyTokenWithRABTUL(token: string): Promise<any | null> {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.success && data.user) {
      return {
        id: data.user.id,
        hotelId: data.user.hotelId,
        role: data.user.role || 'user',
        type: 'user',
      };
    }

    return null;
  } catch (error) {
    console.error('[Auth] RABTUL verify failed:', error);
    return null;
  }
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
    const expectedToken = INTERNAL_SERVICE_TOKEN;
    if (expectedToken && serviceToken === expectedToken) {
      req.user = { id: 'internal-service', type: 'service' };
      return next();
    }
  }

  // Check for JWT token via RABTUL Auth Service
  if (authHeader) {
    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    if (!AUTH_SERVICE_URL) {
      // Fail closed if no auth service configured
      res.status(500).json({ error: 'Server misconfiguration' });
      return;
    }

    verifyTokenWithRABTUL(token).then((user) => {
      if (user) {
        req.user = user;
        return next();
      } else {
        res.status(401).json({ error: 'Invalid or expired token' });
      }
    }).catch(() => {
      res.status(401).json({ error: 'Invalid or expired token' });
    });
    return;
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
