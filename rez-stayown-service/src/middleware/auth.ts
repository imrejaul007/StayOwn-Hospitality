/**
 * Authentication Middleware for StayOwn Service
 *
 * Handles:
 * - JWT token validation
 * - Service-to-service authentication
 * - Role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Environment-based secrets (in production, use secure secret management)
const JWT_SECRET = process.env.JWT_SECRET || process.env.REZ_STAYOWN_JWT_SECRET || '';
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
 * Validate JWT token from Authorization header
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  // CRITICAL: Fail closed if JWT_SECRET not configured
  if (!JWT_SECRET) {
    console.error('[Auth] CRITICAL: JWT_SECRET not configured - rejecting all requests');
    res.status(500).json({ success: false, message: 'Server configuration error' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('[Auth] Token verification failed:', err.message);
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    req.user = decoded as JWTPayload;
    next();
  });
}

/**
 * Verify internal service token for service-to-service communication
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

  // Check Bearer token for service role
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (!JWT_SECRET) {
      try {
        const decoded = jwt.decode(token) as JWTPayload;
        if (decoded && decoded.role === 'service') {
          req.user = decoded;
          req.serviceAuth = true;
          next();
          return;
        }
      } catch {
        // Fall through to error
      }
    } else {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (!err && (decoded as JWTPayload).role === 'service') {
          req.user = decoded as JWTPayload;
          req.serviceAuth = true;
          next();
          return;
        }
      });
    }
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

  if (!JWT_SECRET) {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      req.user = decoded || undefined;
    } catch {
      // Ignore decode errors
    }
    next();
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err) {
      req.user = decoded as JWTPayload;
    }
  });

  next();
}

/**
 * Generate a service token for internal use
 */
export function generateServiceToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
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

  // Check Bearer token with service role
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (!JWT_SECRET) {
      try {
        const decoded = jwt.decode(token) as JWTPayload;
        if (decoded && (decoded.role === 'service' || decoded.role === 'admin')) {
          req.user = decoded;
          req.serviceAuth = true;
          next();
          return;
        }
      } catch {
        // Fall through to error
      }
    } else {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (!err && ((decoded as JWTPayload).role === 'service' || (decoded as JWTPayload).role === 'admin')) {
          req.user = decoded as JWTPayload;
          req.serviceAuth = true;
          next();
          return;
        }
      });
    }
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
    console.error('[Webhook] CRITICAL: FACEBOOK_APP_SECRET not configured - rejecting webhook');
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
