import logger from './utils/logger';

import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  JWT_EXPIRY: parseInt(process.env.JWT_EXPIRY || '3600', 10),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
  REFRESH_TOKEN_EXPIRY: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '2592000', 10),

  // Admin JWT
  JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET || 'dev-admin-secret-change-in-production',

  // SMS (MSG91)
  MSG91_API_KEY: process.env.MSG91_API_KEY || '',
  MSG91_SENDER_ID: process.env.MSG91_SENDER_ID || '',

  // Razorpay
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // ReZ Integration
  REZ_API_KEY: process.env.REZ_API_KEY || '',
  REZ_API_BASE_URL: process.env.REZ_API_BASE_URL || '',
  REZ_WEBHOOK_SECRET: process.env.REZ_WEBHOOK_SECRET || '',
  REZ_WALLET_SERVICE_URL: process.env.REZ_WALLET_SERVICE_URL || '',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || '',
  WALLET_SERVICE_URL: process.env.WALLET_SERVICE_URL || '',
  FINANCE_SERVICE_URL: process.env.FINANCE_SERVICE_URL || '',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN || '',
  REZ_COIN_TO_RUPEE_RATE: parseFloat(process.env.REZ_COIN_TO_RUPEE_RATE || '1'),

  // REZ OAuth2 Partner Credentials (for partner SSO via REZ Auth Service)
  REZ_OAUTH_CLIENT_SECRET: process.env.REZ_OAUTH_CLIENT_SECRET || '',

  // REZ Payment Service — for routing payment webhooks and captures through canonical service
  REZ_PAYMENT_SERVICE_URL: process.env.REZ_PAYMENT_SERVICE_URL || '',

  // Hotel PMS Integration
  PMS_API_URL: process.env.PMS_API_URL || '',
  PMS_WEBHOOK_SECRET: process.env.PMS_WEBHOOK_SECRET || '',
  REZ_OTA_INTERNAL_TOKEN: process.env.REZ_OTA_INTERNAL_TOKEN || '',
  // Secret used to sign outbound webhooks to REZ (must match REZ_OTA_WEBHOOK_SECRET in rezbackend)
  REZ_OTA_WEBHOOK_SECRET: process.env.REZ_OTA_WEBHOOK_SECRET || '',
  // Room QR code validation — must match the secret used by Hotel PMS when generating QR codes
  ROOM_QR_SECRET: process.env.ROOM_QR_SECRET || process.env.DIGITAL_KEY_QR_SECRET || 'dev-qr-secret-change-in-production',

  // AWS S3
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || '',
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || '',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  AWS_REGION: process.env.AWS_REGION || 'ap-south-1',

  // SendGrid
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
};

/**
 * BUG-25 FIX: Validate critical secrets that MUST be present in ALL environments.
 * Missing these will cause fatal runtime errors — the app cannot function without them.
 */
export function validateCriticalEnv(): void {
  const errors: string[] = [];

  // Critical: Database connection is required for ANY operation
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required — cannot connect to database without this');
  }

  // Critical: Redis is required for BullMQ job queues
  if (!process.env.REDIS_URL) {
    errors.push('REDIS_URL is required — cannot process jobs without Redis');
  }

  if (errors.length > 0) {
    logger.error('\n[CRITICAL] Missing required environment variables:');
    errors.forEach((e) => logger.error(`  - ${e}`));
    logger.error('\nFix these before starting the application.\n');
    process.exit(1);
  }
}

/**
 * Validate environment variables — warns in development, throws in production.
 */
export function validateEnv(): string[] {
  const errors: string[] = [];

  // BUG-25: Always validate critical secrets
  if (!process.env.DATABASE_URL) errors.push('DATABASE_URL is required');

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('dev')) errors.push('JWT_SECRET must be set for production');
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.includes('dev')) errors.push('JWT_REFRESH_SECRET must be set for production');
    if (!process.env.JWT_ADMIN_SECRET || process.env.JWT_ADMIN_SECRET.includes('dev')) errors.push('JWT_ADMIN_SECRET must be set for production');
    if (!process.env.REZ_API_BASE_URL) errors.push('REZ_API_BASE_URL required for production — without it all booking events to REZ will be silently dropped');
    if (!process.env.REZ_API_KEY) errors.push('REZ_API_KEY required for production — without it REZ API calls will be rejected');
    if (!process.env.MSG91_API_KEY && process.env.SMS_TEST_MODE !== 'true') errors.push('MSG91_API_KEY required for production — without it OTP/SMS delivery will fail');
    if (!process.env.AUTH_SERVICE_URL) {
      logger.warn('[ENV] AUTH_SERVICE_URL not set — partner SSO will use fallback');
    }
    if (!process.env.REZ_OAUTH_CLIENT_SECRET) {
      logger.warn('[ENV] REZ_OAUTH_CLIENT_SECRET not set — OAuth2 partner SSO disabled');
    }
    if (!process.env.WALLET_SERVICE_URL) {
      logger.warn('[ENV] WALLET_SERVICE_URL not set — wallet operations will use local fallback');
    }
    if (!process.env.INTERNAL_SERVICE_TOKEN) errors.push('INTERNAL_SERVICE_TOKEN required for production');
    if (!process.env.PMS_WEBHOOK_SECRET) errors.push('PMS_WEBHOOK_SECRET required for production');
    if (!process.env.REZ_OTA_INTERNAL_TOKEN) errors.push('REZ_OTA_INTERNAL_TOKEN required for production');
    // Without this secret, stay-completed and booking-confirmed webhooks to REZ will be rejected (500)
    if (!process.env.REZ_OTA_WEBHOOK_SECRET) errors.push('REZ_OTA_WEBHOOK_SECRET required for production (must match REZ_OTA_WEBHOOK_SECRET in rezbackend)');
    // ALLOW_TEST_RAZORPAY=true bypasses Razorpay key/secret checks for test deployments
    if (process.env.ALLOW_TEST_RAZORPAY !== 'true') {
      if (!process.env.RAZORPAY_KEY_ID) errors.push('RAZORPAY_KEY_ID required for production');
      if (!process.env.RAZORPAY_KEY_SECRET) errors.push('RAZORPAY_KEY_SECRET required for production');
      // RAZORPAY_WEBHOOK_SECRET is required — without it Razorpay payment webhooks cannot be
      // verified and all payment callbacks will be rejected. Set this to the webhook secret
      // from your Razorpay Dashboard → Settings → Webhooks.
      if (!process.env.RAZORPAY_WEBHOOK_SECRET) errors.push('RAZORPAY_WEBHOOK_SECRET required for production (Razorpay Dashboard → Settings → Webhooks)');
    }
  }
  return errors;
}
