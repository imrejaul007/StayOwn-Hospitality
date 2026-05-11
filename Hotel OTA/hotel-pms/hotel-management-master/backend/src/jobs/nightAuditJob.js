import cron from 'node-cron';
import Hotel from '../models/Hotel.js';
import nightAuditService from '../services/nightAuditService.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

export function scheduleNightAudit() {
  // Run at 2:00 AM daily
  cron.schedule('0 2 * * *', async () => {
    const redis = getRedisClient();
    const lockKey = 'jobs:night_audit:lock';
    const lockValue = `pid:${process.pid}:${Date.now()}`;
    let lockAcquired = false;

    // Distributed lock to avoid duplicate runs in multi-instance deployments.
    if (redis && redis.isReady) {
      try {
        const lockResult = await redis.set(lockKey, lockValue, { NX: true, EX: 3 * 60 * 60 });
        lockAcquired = lockResult === 'OK';
      } catch (error) {
        logger.warn('Night audit lock acquisition failed; skipping run to avoid duplicates', {
          error: error.message
        });
        return;
      }

      if (!lockAcquired) {
        logger.info('Night audit already running on another instance; skipping this scheduler tick');
        return;
      }
    } else {
      logger.warn('Redis unavailable; running night audit without distributed lock');
    }

    logger.info('Starting scheduled night audit run');

    try {
      const hotels = await Hotel.find({ isActive: true }).select('_id name').lean().limit(1000);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      for (const hotel of hotels) {
        try {
          await nightAuditService.runFullAudit(hotel._id, yesterday, null, 'scheduled');
          logger.info(`Night audit completed for hotel ${hotel.name}`, { hotelId: hotel._id });
        } catch (error) {
          logger.error(`Night audit failed for hotel ${hotel.name}`, {
            hotelId: hotel._id,
            error: error.message
          });
        }
      }

      logger.info('Scheduled night audit run completed', { hotelsProcessed: hotels.length });
    } catch (error) {
      logger.error('Scheduled night audit run failed', { error: error.message });
    } finally {
      if (redis && redis.isReady && lockAcquired) {
        try {
          const currentValue = await redis.get(lockKey);
          if (currentValue === lockValue) {
            await redis.del(lockKey);
          }
        } catch (error) {
          logger.warn('Failed to release night audit lock', { error: error.message });
        }
      }
    }
  });

  logger.info('Night audit job scheduled for 2:00 AM daily');
}
