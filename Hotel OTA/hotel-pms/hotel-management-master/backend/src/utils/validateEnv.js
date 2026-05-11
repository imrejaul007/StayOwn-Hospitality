import logger from './logger.js';

/**
 * Validate required environment variables on startup.
 * Fails fast with a clear error if critical configuration is missing.
 */
export function validateEnvironment() {
  // Only JWT_SECRET is truly required; ENCRYPTION_KEY can fallback
  const required = ['JWT_SECRET'];

  const recommended = [
    'ENCRYPTION_KEY',
    'REDIS_URL',
    'STRIPE_SECRET_KEY',
    'SMTP_HOST',
    'ALLOWED_ORIGINS',
  ];

  // Only hard-fail on truly critical secrets; optional integrations should not block boot.
  const effectiveRequired = required;
  const missing = effectiveRequired.filter(v => !process.env[v]);
  const missingRecommended = recommended.filter(v => !process.env[v]);

  const hasMongoUri = Boolean(
    process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL
  );

  if (missing.length > 0 || !hasMongoUri) {
    const missingList = [...missing];
    if (!hasMongoUri) {
      missingList.push('MONGO_URI (or MONGODB_URI / DATABASE_URL)');
    }
    const error = `FATAL: Missing required environment variables: ${missingList.join(', ')}. ` +
      'The server cannot start without these. Check your .env file.';
    logger.error(error);
    throw new Error(error);
  }

  if (missingRecommended.length > 0) {
    logger.warn(
      `Missing recommended environment variables: ${missingRecommended.join(', ')}. ` +
      'Some features may not work correctly.'
    );
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET is shorter than 32 characters. Consider using a stronger secret.');
  }

  logger.info('Environment validation passed');
}
