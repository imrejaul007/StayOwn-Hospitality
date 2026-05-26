/**
 * Authentication Middleware for StayOwn Service - RABTUL Integration
 *
 * Delegates all authentication to the RABTUL Auth Service:
 * - JWT token validation
 * - Service-to-service authentication
 * - Role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import logger from './utils/logger';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Token payload type
export interface JWTPayload {
  sub: string;           // User ID
  email?: string;
  phone?: string;
  role?: 'user' | 'admin' | 'staff' | 'service';
  hotelId?: string;      // For hotel-specific access
  iat?: number;
  exp?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      serviceAuth?: boolean;
    }
  }
}

/**
 * Verify token with RABTUL Auth Service
 */
async function verifyTokenWithRABTUL(token: string): Promise<JWTPayload | null> {
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
        sub: data.user.id,
        phone: data.user.phone,
        role: data.user.role || 'user',
        hotelId: data.user.hotelId,
        email: data.user.email,
      };
    }

    return null;
  } catch (error) {
    console.error('[Auth] RABTUL verify failed:', error);
    return null;
  }
}

/**
 * Validate JWT token from Authorization header via RABTUL Auth Service
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  // CRITICAL: Fail closed if AUTH_SERVICE_URL not configured
  if (!AUTH_SERVICE_URL) {
    logger.error('[Auth] CRITICAL: AUTH_SERVICE_URL not configured - rejecting all requests');
    res.status(500).json({ success: false, message: 'Server configuration error' });
    return;
  }

  verifyTokenWithRABTUL(token).then((user) => {
    if (!user) {
      logger.error('[Auth] Token verification failed');
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    req.user = user;
    next();
  }).catch((error) => {
    console.error('[Auth] Token verification error:', error);
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  });
}

/**
 * Verify internal service token for service-to-service communication via RABTUL
 */
export function authenticateService(req: Request, res: Response, next: NextFunction): void {
  const serviceKey = req.headers['x-service-key'] as string;
  const authHeader = req.headers.authorization;

  // Check service key header first
  if (serviceKey && INTERNAL_SERVICE_TOKEN && serviceKey === INTERNAL_SERVICE_TOKEN) {
    req.serviceAuth = true;
    next();
    return;
  }

  // Check Bearer token for service role via RABTUL
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    verifyTokenWithRABTUL(token).then((user) => {
      if (user && user.role === 'service') {
        req.user = user;
        req.serviceAuth = true;
        next();
      } else {
        res.status(401).json({ success: false, message: 'Service authentication required' });
      }
    }).catch(() => {
      res.status(401).json({ success: false, message: 'Service authentication required' });
    });
    return;
  }

  res.status(401).json({ success: false, message: 'Service authentication required' });
}

/**
 * Require specific roles
 */
export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const userRole = req.user.role || 'user';
    if (!roles.includes(userRole) && userRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Require hotel-specific access (user must belong to the hotel)
 */
export function requireHotelAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  // Admins can access all hotels
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Staff must have hotelId that matches the request
  const requestedHotelId = req.params.hotelId || req.body.hotelId || req.query.hotelId;

  if (requestedHotelId && req.user.hotelId && req.user.hotelId !== requestedHotelId) {
    res.status(403).json({ success: false, message: 'Access denied for this hotel' });
    return;
  }

  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  verifyTokenWithRABTUL(token).then((user) => {
    req.user = user || undefined;
    next();
  }).catch(() => {
    next();
  });
}

/**
 * Validate API key for programmatic access
 * Accepts either:
 * - x-api-key header
 * - Bearer token with 'service' role
 * - Service key header (x-service-key)
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const serviceKey = req.headers['x-service-key'] as string;
  const authHeader = req.headers.authorization;

  // Check API key header
  if (apiKey && process.env.WHATSAPP_API_KEY && apiKey === process.env.WHATSAPP_API_KEY) {
    req.serviceAuth = true;
    next();
    return;
  }

  // Check service key
  if (serviceKey && INTERNAL_SERVICE_TOKEN && serviceKey === INTERNAL_SERVICE_TOKEN) {
    req.serviceAuth = true;
    next();
    return;
  }

  // Check Bearer token with service role via RABTUL
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    verifyTokenWithRABTUL(token).then((user) => {
      if (user && (user.role === 'service' || user.role === 'admin')) {
        req.user = user;
        req.serviceAuth = true;
        next();
      } else {
        res.status(401).json({
          success: false,
          error: 'API key or authentication required',
          hint: 'Provide x-api-key, x-service-key, or Bearer token'
        });
      }
    }).catch(() => {
      res.status(401).json({
        success: false,
        error: 'API key or authentication required',
        hint: 'Provide x-api-key, x-service-key, or Bearer token'
      });
    });
    return;
  }

  res.status(401).json({
    success: false,
    error: 'API key or authentication required',
    hint: 'Provide x-api-key, x-service-key, or Bearer token'
  });
}

/**
 * Verify WhatsApp webhook signature (Meta)
 * CRITICAL: Implements HMAC-SHA256 signature verification
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    console.warn('[Webhook] Missing webhook signature from', req.ip);
    res.status(401).json({ error: 'Missing webhook signature' });
    return;
  }

  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appSecret) {
    logger.error('[Webhook] CRITICAL: FACEBOOK_APP_SECRET not configured - rejecting webhook');
    res.status(500).json({ error: 'Webhook verification not configured' });
    return;
  }

  // Verify HMAC-SHA256 signature
  const crypto = require('crypto');
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.warn('[Webhook] Invalid webhook signature from', req.ip);
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  next();
}
