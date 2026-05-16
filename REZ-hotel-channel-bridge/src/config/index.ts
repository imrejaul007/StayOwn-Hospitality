import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '4042', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-hotel-channel-bridge',
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  // Redis (for job queue and caching)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'channel-bridge:'
  },

  // Security
  security: {
    internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },

  // Sync Configuration
  sync: {
    inventoryIntervalMinutes: parseInt(process.env.INVENTORY_SYNC_INTERVAL || '15', 10),
    pricingIntervalMinutes: parseInt(process.env.PRICING_SYNC_INTERVAL || '30', 10),
    bookingImportIntervalMinutes: parseInt(process.env.BOOKING_IMPORT_INTERVAL || '5', 10),
    maxRetries: parseInt(process.env.SYNC_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.SYNC_RETRY_DELAY || '5000', 10),
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '100', 10)
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  // Webhook Configuration
  webhooks: {
    enabled: process.env.WEBHOOKS_ENABLED === 'true',
    retryAttempts: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000', 10)
  }
};

export type Config = typeof config;
