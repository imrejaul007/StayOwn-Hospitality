import logger from './utils/logger';

/**
 * Environment Validation for StayOwn Service
 * Fails fast on missing required environment variables
 */

interface EnvValidation {
  required: string[];
  optional: string[];
}

const envConfig: Record<string, EnvValidation> = {
  development: {
    required: [],
    optional: ['JWT_SECRET', 'INTERNAL_SERVICE_TOKEN', 'REDIS_URL', 'MONGODB_URI'],
  },
  production: {
    required: ['JWT_SECRET', 'MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'],
    optional: [],
  },
  test: {
    required: [],
    optional: ['JWT_SECRET', 'MONGODB_URI', 'REDIS_URL'],
  },
};

function validateEnv(): void {
  const env = process.env.NODE_ENV || 'development';
  const config = envConfig[env] || envConfig.development;

  const missing: string[] = [];

  for (const key of config.required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const error = `[ENV] Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}`;
    console.error(error);
    throw new Error(error);
  }

  // Log warnings for missing optional vars in production
  if (env === 'production') {
    for (const key of config.optional) {
      if (!process.env[key]) {
        logger.warn(`[ENV] Recommended environment variable not set: ${key}`);
      }
    }
  }
}

// Validate on module load
try {
  validateEnv();
} catch (error) {
  // In test environment, don't crash
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export { validateEnv };
