/**
 * Graceful shutdown handler.
 * Ensures in-flight requests complete before the process exits.
 */
const setupGracefulShutdown = (server, { mongoose, redis, logger, beforeExit } = {}) => {
  let isShuttingDown = false;
  let forceShutdownTimer = null;

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    const log = logger ? logger.info.bind(logger) : console.log;
    const logErr = logger ? logger.error.bind(logger) : console.error;

    log(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      log('HTTP server closed. Cleaning up...');

      try {
        if (typeof beforeExit === 'function') {
          await beforeExit(signal);
        }

        // Close database connection
        if (mongoose && mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
          log('MongoDB connection closed.');
        }

        // Close Redis connection
        if (redis) {
          await redis.quit();
          log('Redis connection closed.');
        }

        if (forceShutdownTimer) {
          clearTimeout(forceShutdownTimer);
          forceShutdownTimer = null;
        }

        log('Graceful shutdown complete.');
        process.exit(0);
      } catch (err) {
        logErr('Error during shutdown:', err);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    forceShutdownTimer = setTimeout(() => {
      logErr('Forced shutdown after 30s timeout.');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    const logErr = logger ? logger.error.bind(logger) : console.error;
    logErr('Uncaught Exception:', err);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    const logErr = logger ? logger.error.bind(logger) : console.error;
    logErr('Unhandled Rejection:', reason);
  });
};

export { setupGracefulShutdown };
