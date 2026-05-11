import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import prisma from './db'

// JWT secret - should be set in production
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

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
