import { getRedisClient, isRedisConnected } from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * Simple feature flag service backed by Redis.
 * Flags can be toggled without redeployment.
 *
 * Usage:
 *   await featureFlagService.isEnabled('night_audit', hotelId)
 *   await featureFlagService.enable('night_audit', hotelId)
 *   await featureFlagService.disable('night_audit')
 */
class FeatureFlagService {
  constructor() {
    // Default flags (fallback when Redis unavailable)
    this.defaults = {
      night_audit: true,
      cancellation_policy: true,
      housekeeping_qa: true,
      walk_in_auto_register: true,
      websocket_broadcasts: true,
      hindi_locale: true,
      maintenance_mode: false,
    };
  }

  async isEnabled(flagName, hotelId = null) {
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();

        // Check hotel-specific override first
        if (hotelId) {
          const hotelFlag = await redis.get(`feature:${flagName}:${hotelId}`);
          if (hotelFlag !== null) return hotelFlag === 'true';
        }

        // Check global flag
        const globalFlag = await redis.get(`feature:${flagName}`);
        if (globalFlag !== null) return globalFlag === 'true';
      }
    } catch (error) {
      logger.debug('Feature flag Redis lookup failed, using default', { flagName, error: error.message });
    }

    // Fallback to defaults
    return this.defaults[flagName] ?? false;
  }

  async enable(flagName, hotelId = null) {
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const key = hotelId ? `feature:${flagName}:${hotelId}` : `feature:${flagName}`;
        await redis.set(key, 'true');
        logger.info('Feature flag enabled', { flagName, hotelId });
      }
    } catch (error) {
      logger.error('Failed to enable feature flag', { flagName, error: error.message });
    }
  }

  async disable(flagName, hotelId = null) {
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const key = hotelId ? `feature:${flagName}:${hotelId}` : `feature:${flagName}`;
        await redis.set(key, 'false');
        logger.info('Feature flag disabled', { flagName, hotelId });
      }
    } catch (error) {
      logger.error('Failed to disable feature flag', { flagName, error: error.message });
    }
  }

  async getAll() {
    const flags = { ...this.defaults };
    try {
      if (isRedisConnected()) {
        const redis = getRedisClient();
        const keys = await redis.keys('feature:*');
        for (const key of keys) {
          const flagName = key.replace('feature:', '');
          if (!flagName.includes(':')) {
            flags[flagName] = (await redis.get(key)) === 'true';
          }
        }
      }
    } catch (error) {
      logger.debug('Failed to fetch feature flags from Redis', { error: error.message });
    }
    return flags;
  }
}

export default new FeatureFlagService();
