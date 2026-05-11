/**
 * Recurring Job Scheduler
 * Sets up all scheduled jobs that run on a recurring basis using BullMQ's repeat feature.
 *
 * BullMQ handles recurring jobs natively via the repeat.pattern option (cron syntax),
 * so no external cron library is needed.
 */

import {
  holdExpiryQueue,
  coinExpiryFifoQueue,
  coinExpiryQueue, // kept for getSchedulerStatus() to report deprecated queue state
  settlementBatchQueue,
  tierUpdateQueue,
  monthlyMiningQueue,
  pmsInventorySyncQueue,
  reconciliationQueue,
} from './queues';
import { createServiceLogger } from '../config/logger';
import { CoinLedger } from '../services/finance/coin-ledger.service';
import { redis } from '../config/redis';

const logger = createServiceLogger('job-scheduler');

/**
 * Check if Redis is connected and healthy
 */
async function isRedisHealthy(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize all recurring jobs.
 * Call this once when the server starts.
 */
export async function initializeScheduledJobs(): Promise<void> {
  // Check if Redis is available
  const redisHealthy = await isRedisHealthy();
  if (!redisHealthy) {
    logger.warn('Redis unavailable — skipping job scheduler initialization');
    return;
  }

  try {
    // ── Daily Jobs ──

    /**
     * Coin Expiry Job — FIFO variant
     * Runs daily at 2 AM UTC
     * Uses CoinLedger.processExpiredCoins() which burns oldest batches first (FIFO).
     * Cron: minute hour day month day-of-week
     *       0     2    *   *     *           (2 AM daily)
     */
    await coinExpiryFifoQueue.add(
      'daily-expiry-fifo',
      {},
      {
        repeat: {
          pattern: '0 2 * * *', // 2 AM daily
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
        },
      },
    );

    logger.info('Scheduled: Coin Expiry FIFO Job (daily at 2 AM UTC — processExpiredCoins())');

    /**
     * Settlement Batch Job
     * Runs daily at 3 AM UTC
     * Creates T+1 payout batches for settled hotels
     * Cron: 0 3 * * *
     */
    await settlementBatchQueue.add(
      'daily-settlement',
      {},
      {
        repeat: {
          pattern: '0 3 * * *', // 3 AM daily
        },
        removeOnComplete: {
          age: 3600,
        },
      },
    );

    logger.info('Scheduled: Settlement Batch Job (daily at 3 AM UTC)');

    // PMS Inventory Sync Job
    // Runs every 30 minutes to sync inventory with PMS systems
    // Cron: *\/30 * * * * (every 30 minutes)
    await pmsInventorySyncQueue.add(
      'sync-inventory',
      {},
      {
        repeat: {
          pattern: '*/30 * * * *', // Every 30 minutes
        },
        removeOnComplete: {
          age: 1800, // Keep for 30 minutes
        },
      },
    );

    logger.info('Scheduled: PMS Inventory Sync Job (every 30 minutes)');

    // ── Monthly Jobs ──

    /**
     * Tier Update Job
     * Runs on the 1st of each month at 1 AM UTC
     * Updates user tiers based on 12-month rolling activity
     * Cron: 0 1 1 * *
     */
    await tierUpdateQueue.add(
      'monthly-tier-update',
      {},
      {
        repeat: {
          pattern: '0 1 1 * *', // 1 AM on 1st day of each month
        },
        removeOnComplete: {
          age: 86400, // Keep for 24 hours
        },
      },
    );

    logger.info('Scheduled: Tier Update Job (monthly on 1st at 1 AM UTC)');

    /**
     * Monthly Mining Job
     * Runs on the 1st of each month at 4 AM UTC
     * Distributes mining rewards
     * Cron: 0 4 1 * *
     */
    await monthlyMiningQueue.add(
      'monthly-mining',
      {},
      {
        repeat: {
          pattern: '0 4 1 * *', // 1 AM on 1st day of each month
        },
        removeOnComplete: {
          age: 86400,
        },
      },
    );

    logger.info('Scheduled: Monthly Mining Job (monthly on 1st at 4 AM UTC)');

    // P0-LOGIC-4: Ledger verification — runs daily at 3:01 AM
    await reconciliationQueue.add(
      'ledger-verification',
      {},
      {
        repeat: {
          pattern: '1 3 * * *', // 3:01 AM daily
        },
        removeOnComplete: {
          age: 86400,
        },
      },
    );
    logger.info('Scheduled: Ledger Verification Job (daily at 3:01 AM)');

    logger.info('✓ All scheduled jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize scheduled jobs', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get scheduler status for monitoring
 */
export async function getSchedulerStatus(): Promise<Record<string, any>> {
  const [coinExpiryFifoJobs, settlementJobs, tierUpdateJobs, miningJobs, pmsJobs] = await Promise.all([
    coinExpiryFifoQueue.getRepeatableJobs(),
    settlementBatchQueue.getRepeatableJobs(),
    tierUpdateQueue.getRepeatableJobs(),
    monthlyMiningQueue.getRepeatableJobs(),
    pmsInventorySyncQueue.getRepeatableJobs(),
  ]);

  return {
    coinExpiryFifo: coinExpiryFifoJobs.length,
    settlement: settlementJobs.length,
    tierUpdate: tierUpdateJobs.length,
    mining: miningJobs.length,
    pmsSync: pmsJobs.length,
    total: coinExpiryFifoJobs.length + settlementJobs.length + tierUpdateJobs.length + miningJobs.length + pmsJobs.length,
  };
}
