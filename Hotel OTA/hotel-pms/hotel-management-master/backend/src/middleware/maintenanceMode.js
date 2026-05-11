import { getRedisClient, isRedisConnected } from '../config/redis.js';

/**
 * Maintenance mode middleware.
 * When enabled (via Redis flag or env var), returns 503 for all non-health routes.
 * Toggle: Set MAINTENANCE_MODE=true in env or set 'maintenance_mode' key in Redis.
 */
export const maintenanceMode = async (req, res, next) => {
  // Always allow health checks
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    return next();
  }

  // Check env var first (fastest)
  if (process.env.MAINTENANCE_MODE === 'true') {
    return res.status(503).json({
      status: 'error',
      message: 'System is under maintenance. Please try again later.',
      retryAfter: 300
    });
  }

  // Check Redis flag (for dynamic toggling without restart)
  if (isRedisConnected()) {
    try {
      const redis = getRedisClient();
      const maintenanceFlag = await redis.get('maintenance_mode');
      if (maintenanceFlag === 'true') {
        return res.status(503).json({
          status: 'error',
          message: 'System is under maintenance. Please try again later.',
          retryAfter: 300
        });
      }
    } catch {
      // Redis error shouldn't block requests
    }
  }

  next();
};
