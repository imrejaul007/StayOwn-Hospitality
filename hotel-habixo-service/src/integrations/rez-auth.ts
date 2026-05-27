/**
 * ReZ Auth Service Integration
 *
 * Provides JWT verification, user extraction, and auth middleware for protected routes.
 * Calls the rez-auth-service for token validation.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

const authLogger = logger.child({ service: 'ReZ-Auth' });

// Auth service base URL
const AUTH_SERVICE_URL = config.services.auth;
const AUTH_INTERNAL_TOKEN = config.internalToken;

// ── Types ────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  userId: string;
  role: string;
  phoneNumber?: string;
  email?: string;
  name?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  role?: string;
  phoneNumber?: string;
  merchantId?: string;
  error?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  userId?: string;
  isAuthenticated?: boolean;
}

// Extended Express Request with user property
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      userId?: string;
      isAuthenticated?: boolean;
    }
  }
}

// ── JWT Secret for local verification (fallback) ───────────────────────────────

/**
 * Get the appropriate JWT secret based on role.
 * Falls back to JWT_SECRET for consumer tokens.
 */
function getJwtSecret(role?: string): string | undefined {
  const ADMIN_ROLES = ['admin', 'super_admin', 'operator', 'support'];

  if (role && ADMIN_ROLES.includes(role)) {
    return process.env.JWT_ADMIN_SECRET;
  }
  if (role === 'merchant') {
    return process.env.JWT_MERCHANT_SECRET;
  }
  return process.env.JWT_SECRET;
}

// ── Token Verification ─────────────────────────────────────────────────────────

/**
 * Verify a JWT token using the auth service or local verification.
 *
 * @param token - The JWT access token to verify
 * @returns TokenValidationResult with validity and user info
 */
export async function verifyToken(token: string): Promise<TokenValidationResult> {
  if (!token) {
    return { valid: false, error: 'Token is required' };
  }

  try {
    // Try auth service first (authoritative validation with blacklist check)
    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/v1/auth/validate`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-internal-token': AUTH_INTERNAL_TOKEN,
          'x-internal-service': 'rez-habixo-service',
        },
        timeout: 5000,
      }
    );

    if (response.data?.valid) {
      return {
        valid: true,
        userId: response.data.userId,
        role: response.data.role,
        phoneNumber: response.data.phoneNumber,
        merchantId: response.data.merchantId,
      };
    }

    return { valid: false, error: 'Token validation failed' };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number }; message?: string };

    // If auth service is unavailable, try local JWT verification (degraded mode)
    if (axiosError.response?.status === 404 || axiosError.response?.status === 503) {
      authLogger.warn('Auth service unavailable, using local verification');
      return verifyTokenLocally(token);
    }

    // For 401/validation errors, do local verification as fallback
    if (axiosError.response?.status === 401) {
      return verifyTokenLocally(token);
    }

    authLogger.error({ error: axiosError.message }, 'Token verification error');
    return { valid: false, error: axiosError.message || 'Verification failed' };
  }
}

/**
 * Verify JWT locally without calling the auth service.
 * Used as fallback when auth service is unavailable.
 *
 * @param token - The JWT token to verify
 * @returns TokenValidationResult
 */
export function verifyTokenLocally(token: string): TokenValidationResult {
  try {
    // Decode without verification to get the role
    const decoded = jwt.decode(token) as {
      userId?: string;
      role?: string;
      phoneNumber?: string;
      merchantId?: string;
      exp?: number;
    } | null;

    if (!decoded || !decoded.userId) {
      return { valid: false, error: 'Invalid token structure' };
    }

    // Check expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }

    // Get the appropriate secret and verify
    const secret = getJwtSecret(decoded.role);
    if (!secret) {
      return { valid: false, error: 'JWT secret not configured' };
    }

    const verified = jwt.verify(token, secret, { algorithms: ['HS256'] }) as typeof decoded;
    return {
      valid: true,
      userId: verified.userId,
      role: verified.role,
      phoneNumber: verified.phoneNumber,
      merchantId: verified.merchantId,
    };
  } catch (error: unknown) {
    const jwtError = error as { name?: string; message?: string };
    if (jwtError.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired' };
    }
    if (jwtError.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token' };
    }
    return { valid: false, error: jwtError.message || 'Verification failed' };
  }
}

// ── User Extraction ────────────────────────────────────────────────────────────

/**
 * Extract user information from a JWT token.
 *
 * @param token - The JWT token to decode
 * @returns AuthUser object or null if invalid
 */
export function getUserFromToken(token: string): AuthUser | null {
  try {
    // Decode to get role for secret selection
    const decoded = jwt.decode(token) as {
      userId?: string;
      role?: string;
      phoneNumber?: string;
    } | null;

    if (!decoded || !decoded.userId) {
      return null;
    }

    const secret = getJwtSecret(decoded.role);
    if (!secret) {
      // If no secret configured, just return decoded data without verification
      return {
        id: decoded.userId,
        userId: decoded.userId,
        role: decoded.role || 'user',
        phoneNumber: decoded.phoneNumber,
      };
    }

    // Verify and return user
    const verified = jwt.verify(token, secret, { algorithms: ['HS256'] }) as typeof decoded;
    const userId = verified.userId ?? decoded.userId ?? '';
    return {
      id: userId,
      userId: userId,
      role: verified.role || decoded.role || 'user',
      phoneNumber: verified.phoneNumber || decoded.phoneNumber,
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header.
 *
 * @param authHeader - The Authorization header value
 * @returns The token string or null
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// ── Auth Middleware ────────────────────────────────────────────────────────────

/**
 * Express middleware for protecting routes with JWT authentication.
 *
 * Usage:
 *   router.post('/protected', authMiddleware, handler);
 *
 * Attaches user info to req.user and req.userId on success.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_001',
    });
    return;
  }

  // Synchronous local verification for middleware (avoid async auth service call)
  const result = verifyTokenLocally(token);

  if (!result.valid) {
    res.status(401).json({
      success: false,
      message: result.error || 'Invalid or expired token',
      code: 'AUTH_003',
    });
    return;
  }

  // Attach user to request
  req.user = {
    id: result.userId!,
    userId: result.userId!,
    role: result.role || 'user',
    phoneNumber: result.phoneNumber,
  };
  req.userId = result.userId;
  req.isAuthenticated = true;

  next();
}

/**
 * Optional auth middleware - attaches user if token present but doesn't require it.
 *
 * Usage:
 *   router.get('/optional-auth', optionalAuthMiddleware, handler);
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    req.isAuthenticated = false;
    next();
    return;
  }

  const result = verifyTokenLocally(token);

  if (result.valid) {
    req.user = {
      id: result.userId!,
      userId: result.userId!,
      role: result.role || 'user',
      phoneNumber: result.phoneNumber,
    };
    req.userId = result.userId;
    req.isAuthenticated = true;
  } else {
    req.isAuthenticated = false;
  }

  next();
}

/**
 * Role-based access control middleware factory.
 *
 * Usage:
 *   router.delete('/admin-only', authMiddleware, requireRole('admin'), handler);
 *
 * @param allowedRoles - Array of roles that are allowed access
 */
export function requireRole(...allowedRoles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_001',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'AUTH_006',
      });
      return;
    }

    next();
  };
}

/**
 * Host-only access middleware.
 * Ensures the authenticated user is a host or admin.
 *
 * Usage:
 *   router.post('/host-action', authMiddleware, requireHost, handler);
 */
export function requireHost(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_001',
    });
    return;
  }

  const HOST_ROLES = ['host', 'admin', 'super_admin', 'operator'];
  if (!HOST_ROLES.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: 'Host access required',
      code: 'AUTH_006',
    });
    return;
  }

  next();
}

// ── Internal Service Calls ─────────────────────────────────────────────────────

/**
 * Call an internal auth service endpoint with proper headers.
 *
 * @param path - API path (e.g., '/internal/users/bulk')
 * @param method - HTTP method
 * @param body - Request body (for POST/PUT/PATCH)
 * @returns API response
 */
export async function callAuthService<T = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await axios({
      url: `${AUTH_SERVICE_URL}${path}`,
      method,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': AUTH_INTERNAL_TOKEN,
        'x-internal-service': 'rez-habixo-service',
      },
      timeout: 10000,
    });

    return { success: true, data: response.data };
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown }; message?: string };
    authLogger.error({ error: axiosError.message, path }, 'Auth service call failed');
    return {
      success: false,
      error: axiosError.message || 'Auth service call failed',
    };
  }
}

/**
 * Get user profile from auth service.
 *
 * @param userId - The user ID to fetch
 * @returns User profile or null
 */
export async function getUserProfile(userId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    name: string;
    phone: string;
    email: string;
    role: string;
  };
  error?: string;
}> {
  return callAuthService(`${AUTH_SERVICE_URL}/internal/auth/user/${userId}`, 'GET');
}

/**
 * Bulk lookup users by IDs from auth service.
 *
 * @param ids - Array of user IDs
 * @returns Array of user profiles
 */
export async function bulkGetUsers(ids: string[]): Promise<{
  success: boolean;
  data?: Array<{ _id: string; name: string; email: string; phone?: string }>;
  error?: string;
}> {
  return callAuthService(`${AUTH_SERVICE_URL}/internal/users/bulk`, 'POST', { ids });
}

// ── Host Registration (Service-to-Service) ─────────────────────────────────────

export interface HostRegistrationData {
  userId: string;
  phoneNumber?: string;
  email?: string;
  businessName?: string;
  businessType?: 'individual' | 'company';
  taxId?: string;
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  verificationDocuments?: string[];
}

/**
 * Register a host profile with the auth service.
 * This creates a host-specific record linked to the user account.
 *
 * @param userId - The authenticated user's ID
 * @param hostData - Host registration data
 * @returns Registration result
 */
export async function registerHost(
  userId: string,
  hostData: HostRegistrationData
): Promise<{
  success: boolean;
  hostId?: string;
  error?: string;
}> {
  try {
    // Destructure userId from hostData to avoid duplication
    const { userId: _, ...restHostData } = hostData;

    const response = await axios.post(
      `${AUTH_SERVICE_URL}/internal/hosts/register`,
      {
        userId,
        ...restHostData,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': AUTH_INTERNAL_TOKEN,
          'x-internal-service': 'rez-habixo-service',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success) {
      authLogger.info({ userId }, 'Host registered successfully');
      return {
        success: true,
        hostId: response.data.hostId,
      };
    }

    return { success: false, error: response.data?.message || 'Registration failed' };
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: { message?: string }; status?: number }; message?: string };
    authLogger.error({ error: axiosError.message, userId }, 'Host registration failed');

    return {
      success: false,
      error: axiosError.response?.data?.message || axiosError.message || 'Registration failed',
    };
  }
}

// ── Health Check ───────────────────────────────────────────────────────────────

/**
 * Check if the auth service is healthy.
 *
 * @returns Health status
 */
export async function checkAuthServiceHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/health`, {
      timeout: 3000,
    });

    return {
      healthy: response.status === 200,
      latencyMs: Date.now() - start,
    };
  } catch (error: unknown) {
    const axiosError = error as { message?: string };
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: axiosError.message || 'Health check failed',
    };
  }
}

// ── Token Refresh ──────────────────────────────────────────────────────────────

/**
 * Refresh access token using a refresh token.
 *
 * @param refreshToken - The refresh token
 * @returns New tokens or error
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/v1/auth/refresh`,
      { refreshToken },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data?.success) {
      return {
        success: true,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresIn: response.data.expiresIn,
      };
    }

    return { success: false, error: response.data?.message || 'Refresh failed' };
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: { message?: string }; status?: number }; message?: string };

    if (axiosError.response?.status === 401) {
      return { success: false, error: 'Invalid or expired refresh token' };
    }

    return {
      success: false,
      error: axiosError.response?.data?.message || axiosError.message || 'Refresh failed',
    };
  }
}

export default {
  verifyToken,
  verifyTokenLocally,
  getUserFromToken,
  extractToken,
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireHost,
  callAuthService,
  getUserProfile,
  bulkGetUsers,
  registerHost,
  checkAuthServiceHealth,
  refreshAccessToken,
};
