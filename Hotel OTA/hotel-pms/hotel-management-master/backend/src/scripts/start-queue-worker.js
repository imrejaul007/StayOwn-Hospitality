import 'dotenv/config';
import connectDB from '../config/database.js';
import { connectRedis, getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';
import queueService from '../services/queueService.js';

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received. Stopping queue worker...`);

  try {
    await queueService.stopProcessing();

    const redis = getRedisClient();
    if (redis) {
      await redis.quit();
      logger.info('Queue worker Redis connection closed');
    }

    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('Queue worker MongoDB connection closed');
    }

    logger.info('Queue worker stopped cleanly');
    process.exit(0);
  } catch (error) {
    logger.error('Queue worker shutdown failed', {
      error: error.message
    });
    process.exit(1);
  }
};

const start = async () => {
  process.env.QUEUE_PROCESSOR_MODE = 'worker';

  await connectDB();
  await connectRedis();
  await queueService.initialize();
  await queueService.startProcessing();

  logger.info('Queue worker started', {
    workerId: queueService.workerId,
    workerInstance: queueService.workerInstance,
    maxConcurrentJobs: queueService.maxConcurrentJobs
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  logger.error('Queue worker failed to start', {
    error: error.message
  });
  process.exit(1);
});
