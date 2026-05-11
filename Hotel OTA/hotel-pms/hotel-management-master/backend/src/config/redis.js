import { createClient } from 'redis';
import logger from '../utils/logger.js';

let redisClient;
let lastRedisErrorLogAt = 0;

export const connectRedis = async () => {
  // If no REDIS_URL is configured, skip connection entirely.
  // Attempting localhost:6379 on cloud hosts (Render, Railway, etc.) causes an
  // ECONNREFUSED reconnect storm that spams logs every 10 s with no benefit.
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not set — Redis disabled. Caching, rate-limit storage, and distributed locks will be unavailable.');
    redisClient = null;
    return;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        // Limit reconnect attempts so a transient outage doesn't hammer logs forever.
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: max reconnect attempts reached — giving up');
            return false; // stop retrying
          }
          return Math.min(retries * 500, 5000); // exponential back-off up to 5 s
        },
      },
    });

    redisClient.on('error', (err) => {
      const now = Date.now();
      // Throttle repetitive connection/auth error logs during reconnect storms.
      if (now - lastRedisErrorLogAt > 10000) {
        lastRedisErrorLogAt = now;
        logger.error('Redis Client Error', {
          error: err?.message || 'Unknown Redis error',
          code: err?.code || null
        });
      }
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    await redisClient.connect();

  } catch (error) {
    logger.warn('Redis connection failed, continuing with degraded functionality:', error.message);
    logger.warn('Features requiring Redis (caching, distributed locking, refresh tokens) will be unavailable');
    redisClient = null;
  }
};

export const getRedisClient = () => redisClient;

export const isRedisConnected = () => redisClient && redisClient.isReady;

export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.disconnect();
  }
};
