import NotificationTemplate from '../models/NotificationTemplate.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

// Cache key patterns
const CACHE_KEYS = {
  TEMPLATE: (hotelId, templateId) => `template:${hotelId}:${templateId}`,
  TEMPLATE_BY_TYPE: (hotelId, type) => `template:${hotelId}:type:${type}`,
  TEMPLATES_BY_CATEGORY: (hotelId, category) => `templates:${hotelId}:category:${category}`,
  USER_PREFERENCES: (userId, hotelId) => `preferences:${userId}:${hotelId || 'global'}`,
  USER_PROFILE: (userId) => `user:${userId}`,
  NOTIFICATION_COUNT: (userId) => `count:${userId}`,
  HOTEL_SETTINGS: (hotelId) => `hotel:${hotelId}:settings`,
  ROUTING_RULES: (hotelId) => `routing:${hotelId}`,
  TEMPLATE_STATS: (hotelId) => `stats:${hotelId}:templates`
};

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400 // 24 hours
};

class NotificationCache {
  constructor() {
    this.redis = null;
    this.connected = false;
    this.initialize();
  }

  async initialize() {
    try {
      // Use shared Redis client only; keep fallback mode by default.
      const enableRedisCache = process.env.ENABLE_NOTIFICATION_CACHE_REDIS === 'true';
      if (!enableRedisCache) {
        this.connected = false;
        logger.info('Notification cache Redis disabled; using fallback mode');
        return;
      }

      this.redis = getRedisClient();
      if (!this.redis || !this.redis.isReady) {
        this.connected = false;
        logger.warn('Notification cache Redis unavailable; using fallback mode');
        return;
      }

      await this.redis.ping();
      this.connected = true;
      logger.debug('✅ Redis cache connected successfully');
    } catch (error) {
      logger.warn('⚠️  Redis cache connection failed, falling back to memory cache:', error.message);
      this.connected = false;
    }
  }

  // Generic cache methods
  async get(key) {
    if (!this.connected) return null;

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = CACHE_TTL.MEDIUM) {
    if (!this.connected) return false;

    try {
      await this.redis.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.connected) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.connected) return false;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
      return true;
    } catch (error) {
      logger.error('Cache pattern invalidation error:', error);
      return false;
    }
  }

  // Template caching methods
  async getTemplate(hotelId, templateId) {
    try {
      const cacheKey = CACHE_KEYS.TEMPLATE(hotelId, templateId);
      let template = await this.get(cacheKey);

      if (!template) {
        template = await NotificationTemplate.findOne({
          _id: templateId,
          hotelId,
          'metadata.isActive': true
        }).lean();

        if (template) {
          await this.set(cacheKey, template, CACHE_TTL.LONG);
        }
      }

      return template;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async getTemplateByType(hotelId, type) {
    try {
      const cacheKey = CACHE_KEYS.TEMPLATE_BY_TYPE(hotelId, type);
      let template = await this.get(cacheKey);

      if (!template) {
        template = await NotificationTemplate.getByType(hotelId, type);

        if (template) {
          await this.set(cacheKey, template, CACHE_TTL.LONG);
        }
      }

      return template;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async getTemplatesByCategory(hotelId, category) {
    try {
      const cacheKey = CACHE_KEYS.TEMPLATES_BY_CATEGORY(hotelId, category);
      let templates = await this.get(cacheKey);

      if (!templates) {
        templates = await NotificationTemplate.getByCategory(hotelId, category);

        if (templates) {
          await this.set(cacheKey, templates, CACHE_TTL.MEDIUM);
        }
      }

      return templates || [];
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateTemplateCache(hotelId, templateId = null) {
    try {
      if (templateId) {
        await this.del(CACHE_KEYS.TEMPLATE(hotelId, templateId));
      }

      // Invalidate all template-related caches for the hotel
      await this.invalidatePattern(`template:${hotelId}:*`);
      await this.invalidatePattern(`templates:${hotelId}:*`);
      await this.del(CACHE_KEYS.TEMPLATE_STATS(hotelId));
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // User preference caching
  async getUserPreferences(userId, hotelId) {
    try {
      const cacheKey = CACHE_KEYS.USER_PREFERENCES(userId, hotelId);
      let preferences = await this.get(cacheKey);

      if (!preferences) {
        preferences = await NotificationPreference.findOne({
          userId,
          ...(hotelId ? { hotelId } : {})
        }).lean();

        if (preferences) {
          await this.set(cacheKey, preferences, CACHE_TTL.MEDIUM);
        }
      }

      return preferences;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateUserPreferences(userId) {
    try {
      await this.del(CACHE_KEYS.USER_PREFERENCES(userId));
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // User profile caching
  async getUserProfile(userId) {
    try {
      const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
      let user = await this.get(cacheKey);

      if (!user) {
        user = await User.findById(userId)
          .select('firstName lastName email role hotelId department isActive')
          .lean();

        if (user) {
          await this.set(cacheKey, user, CACHE_TTL.LONG);
        }
      }

      return user;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateUserProfile(userId) {
    try {
      await this.del(CACHE_KEYS.USER_PROFILE(userId));
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Notification count caching
  async getNotificationCount(userId) {
    try {
      const cacheKey = CACHE_KEYS.NOTIFICATION_COUNT(userId);
      return await this.get(cacheKey);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async setNotificationCount(userId, count) {
    try {
      const cacheKey = CACHE_KEYS.NOTIFICATION_COUNT(userId);
      await this.set(cacheKey, count, CACHE_TTL.SHORT);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async incrementNotificationCount(userId) {
    if (!this.connected) return;

    try {
      const cacheKey = CACHE_KEYS.NOTIFICATION_COUNT(userId);
      const current = await this.redis.get(cacheKey);
      const count = current ? parseInt(current) + 1 : 1;
      await this.redis.setEx(cacheKey, CACHE_TTL.SHORT, String(count));
    } catch (error) {
      logger.error('Error incrementing notification count:', error);
    }
  }

  async invalidateNotificationCount(userId) {
    try {
      await this.del(CACHE_KEYS.NOTIFICATION_COUNT(userId));
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Hotel settings caching
  async getHotelSettings(hotelId) {
    try {
      const cacheKey = CACHE_KEYS.HOTEL_SETTINGS(hotelId);
      let settings = await this.get(cacheKey);

      if (!settings) {
        // Fetch from database - this would be your hotel settings model
        // For now, return default settings
        settings = {
          timezone: 'UTC',
          quietHours: { start: 22, end: 7 },
          defaultLanguage: 'en',
          maxNotificationsPerHour: 50
        };

        await this.set(cacheKey, settings, CACHE_TTL.VERY_LONG);
      }

      return settings;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateHotelSettings(hotelId) {
    try {
      await this.del(CACHE_KEYS.HOTEL_SETTINGS(hotelId));
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Routing rules caching
  async getRoutingRules(hotelId) {
    try {
      const cacheKey = CACHE_KEYS.ROUTING_RULES(hotelId);
      return await this.get(cacheKey);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async setRoutingRules(hotelId, rules) {
    try {
      const cacheKey = CACHE_KEYS.ROUTING_RULES(hotelId);
      await this.set(cacheKey, rules, CACHE_TTL.LONG);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateRoutingRules(hotelId) {
    try {
      await this.del(CACHE_KEYS.ROUTING_RULES(hotelId));
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Template statistics caching
  async getTemplateStats(hotelId) {
    try {
      const cacheKey = CACHE_KEYS.TEMPLATE_STATS(hotelId);
      let stats = await this.get(cacheKey);

      if (!stats) {
        stats = await NotificationTemplate.getPerformanceStats(hotelId);

        if (stats) {
          await this.set(cacheKey, stats, CACHE_TTL.MEDIUM);
        }
      }

      return stats || [];
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateTemplateStats(hotelId) {
    try {
      await this.del(CACHE_KEYS.TEMPLATE_STATS(hotelId));
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Batch operations for better performance
  async getMultipleTemplates(hotelId, templateIds) {
    try {
      const keys = templateIds.map(id => CACHE_KEYS.TEMPLATE(hotelId, id));
      const cached = await this.getMultiple(keys);

      const missing = [];
      const results = {};

      templateIds.forEach((id, index) => {
        if (cached[index]) {
          results[id] = cached[index];
        } else {
          missing.push(id);
        }
      });

      // Fetch missing templates from database
      if (missing.length > 0) {
        const templates = await NotificationTemplate.find({
          _id: { $in: missing },
          hotelId,
          'metadata.isActive': true
        }).lean().limit(1000);

        // Cache the fetched templates
        const cachePromises = templates.map(template => {
          results[template._id.toString()] = template;
          return this.set(
            CACHE_KEYS.TEMPLATE(hotelId, template._id),
            template,
            CACHE_TTL.LONG
          );
        });

        await Promise.all(cachePromises);
      }

      return results;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async getMultiple(keys) {
    if (!this.connected || keys.length === 0) return [];

    try {
      const values = await this.redis.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  // Health check and monitoring
  async getHealthStatus() {
    if (!this.connected) {
      return { status: 'disconnected', connected: false };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      const info = await this.redis.info('memory');
      const memory = this.parseRedisInfo(info);

      return {
        status: 'healthy',
        connected: true,
        latency,
        memory: {
          used: memory.used_memory_human,
          peak: memory.used_memory_peak_human,
          keys: await this.redis.dbSize()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        error: error.message
      };
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const result = {};

    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    });

    return result;
  }

  // Cleanup and maintenance
  async cleanup() {
    if (!this.connected) return;

    try {
      // Clean up expired notification counts (they should auto-expire, but just in case)
      const countKeys = await this.redis.keys('count:*');
      if (countKeys.length > 1000) { // Cleanup if too many keys
        await this.redis.del(...countKeys.slice(0, 500));
      }

      logger.debug('Cache cleanup completed');
    } catch (error) {
      logger.error('Cache cleanup error:', error);
    }
  }

  // Graceful shutdown
  async disconnect() {
    try {
      if (this.redis) {
        // Shared client is managed centrally; do not close it here.
        logger.debug('Redis cache disconnected');
      }
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }
}

// Create singleton instance
const notificationCache = new NotificationCache();

// Cleanup on process exit
process.on('SIGINT', () => {
  notificationCache.disconnect();
});

process.on('SIGTERM', () => {
  notificationCache.disconnect();
});

export default notificationCache;