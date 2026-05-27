import logger from './utils/logger';

import dotenv from 'dotenv';
dotenv.config();

// ─── Fail-Closed Security Validation ────────────────────────────────────────────

function getRequiredSecret(envKey: string, name: string): string {
  const value = process.env[envKey];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`CRITICAL: ${name} (${envKey}) must be configured in production`);
    }
    logger.warn(`[Security] WARNING: ${name} not set - using insecure fallback`);
    return `dev-only-${envKey.toLowerCase()}-do-not-use-in-production`;
  }
  return value;
}

function getOptionalSecret(envKey: string, fallback: string): string {
  const value = process.env[envKey];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    logger.warn(`[Security] WARNING: ${envKey} not set - using fallback`);
  }
  return fallback;
}

// ─── JWT Secret Validation ───────────────────────────────────────────────────────

function getJwtSecret(envKey: string, name: string): string {
  const value = process.env[envKey];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`CRITICAL: ${name} (${envKey}) must be configured in production`);
    }
    logger.warn(`[Security] WARNING: ${name} not set - using dev fallback`);
    return `dev-only-${envKey.toLowerCase()}-fallback`;
  }
  return value;
}

// ─── CORS Validation ─────────────────────────────────────────────────────────────

function getCorsOrigins(): string[] {
  const origins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
  if (origins.length === 0) {
    origins.push('http://localhost:3000');
  }
  if (process.env.NODE_ENV === 'production') {
    if (origins.some(o => o.includes('localhost'))) {
      logger.warn('[Security] WARNING: Localhost in CORS_ORIGINS for production');
    }
  }
  return origins;
}

export const config = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3007'),
  logLevel: process.env.LOG_LEVEL || 'info',

  // REQUIRED in production - fail closed
  hashSecret: getRequiredSecret('HASH_SECRET', 'Hash Secret'),

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/habixo',
    user: process.env.MONGODB_USER || '',
    password: process.env.MONGODB_PASSWORD || '',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // ReZ Services
  services: {
    auth: getRequiredSecret('REZ_AUTH_SERVICE_URL', 'Auth Service URL'),
    profile: getOptionalSecret('REZ_PROFILE_SERVICE_URL', 'http://localhost:3002'),
    wallet: getOptionalSecret('REZ_WALLET_SERVICE_URL', 'http://localhost:4004'),
    karma: getOptionalSecret('REZ_KARMA_SERVICE_URL', 'http://localhost:3004'),
    payment: getOptionalSecret('REZ_PAYMENT_SERVICE_URL', 'http://localhost:3005'),
    notifications: getOptionalSecret('REZ_NOTIFICATION_SERVICE_URL', 'http://localhost:3006'),
    gamification: getOptionalSecret('REZ_GAMIFICATION_SERVICE_URL', 'http://localhost:3007'),
    search: getOptionalSecret('REZ_SEARCH_SERVICE_URL', 'http://localhost:3008'),
    intentGraph: getOptionalSecret('REZ_INTENT_GRAPH_URL', 'http://localhost:3001'),
  },

  // REQUIRED in production - fail closed
  internalToken: getRequiredSecret('INTERNAL_SERVICE_TOKEN', 'Internal Service Token'),

  // JWT Secrets - REQUIRED in production
  jwt: {
    secret: getJwtSecret('JWT_SECRET', 'JWT Secret'),
    adminSecret: getJwtSecret('JWT_ADMIN_SECRET', 'JWT Admin Secret'),
    merchantSecret: getJwtSecret('JWT_MERCHANT_SECRET', 'JWT Merchant Secret'),
    refreshSecret: getJwtSecret('JWT_REFRESH_SECRET', 'JWT Refresh Secret'),
  },

  // External Services
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },

  // CORS - validated for security
  corsOrigins: getCorsOrigins(),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
};
