import logger from './utils/logger';

import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.warn('Redis unavailable — BullMQ jobs disabled. Set a valid REDIS_URL to enable.');
      return null; // stop retrying, don't crash
    }
    return Math.min(times * 500, 2000);
  },
});

redis.on('error', (err) => {
  console.error('[Redis]', err.message);
});

redis.on('connect', () => {
  logger.info('[Redis] connected');
});
