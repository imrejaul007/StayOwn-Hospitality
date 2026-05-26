import logger from './utils/logger';

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import prisma from './db'

// JWT secret - FAIL CLOSED in production
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET must be configured in production');
    }
    logger.warn('[Security] WARNING: Using development JWT secret - DO NOT use in production');
    return 'dev-only-secret-do-not-use-in-production';
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

// ─── Audit Logging ─────────────────────────────────────────────────────────────

interface AuditLogEntry {
  timestamp: Date
  event: string
  userId?: string
  brandId?: string
  serialId?: string
  ip?: string
  userAgent?: string
  success: boolean
  error?: string
  metadata?: Record<string, unknown>
}

export function logAuditEvent(entry: AuditLogEntry): void {
  // In production, this should be sent to a proper logging service
  const logEntry = {
    service: 'verify-service',
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  };

  if (entry.success) {
    console.log('[Audit]', JSON.stringify(logEntry));
  } else {
    console.warn('[Audit]', JSON.stringify(logEntry));
  }
}

export interface JWTPayload {
  userId: string
  email: string
  role: 'user' | 'admin' | 'brand'
  brandId?: string
}

export interface AuthResult {
  success: boolean
  user?: JWTPayload
  error?: string
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    // SECURITY FIX: Add algorithm constraint to prevent alg:none attacks
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as unknown as JWTPayload
    return decoded
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: JWTPayload, expiresInSeconds = 604800): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: expiresInSeconds, algorithm: 'HS256' })
}

export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return null
}

export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const token = extractToken(request)
  if (!token) {
    return { success: false, error: 'No token provided' }
  }

  const user = await verifyToken(token)
  if (!user) {
    return { success: false, error: 'Invalid or expired token' }
  }

  return { success: true, user }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return auth
  }

  if (auth.user!.role !== 'admin' && auth.user!.role !== 'brand') {
    return { success: false, error: 'Insufficient permissions' }
  }

  return auth
}

export async function requireBrandAccess(
  request: NextRequest,
  brandId: string
): Promise<AuthResult> {
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return auth
  }

  if (auth.user!.role === 'admin') {
    return auth
  }

  if (auth.user!.role === 'brand' && auth.user!.brandId !== brandId) {
    return { success: false, error: 'Access denied to this brand' }
  }

  if (auth.user!.role !== 'brand') {
    return { success: false, error: 'Insufficient permissions' }
  }

  return auth
}
