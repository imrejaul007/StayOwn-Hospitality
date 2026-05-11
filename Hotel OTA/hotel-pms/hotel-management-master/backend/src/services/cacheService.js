import { createClient } from 'redis';
import logger from '../utils/logger.js';

class CacheService {
  constructor() {
    this.client = null;
    this.getAsync = null;
    this.setAsync = null;
    this.delAsync = null;
    this.expireAsync = null;
    this.ttlAsync = null;
    this.keysAsync = null;
    this.flushdbAsync = null;
    this.connected = false;
  }

  async connect() {
    try {
      // Use same Redis URL as notification cache
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        logger.warn('Redis URL not configured, cache service will use fallback');
        this.connected = false;
        return;
      }

      this.client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          lazyConnect: false
        }
      });

      // Event handlers with graceful error handling
      this.client.on('connect', () => {
        logger.info('✅ Cache service Redis client connected');
        this.connected = true;
      });

      this.client.on('error', (err) => {
        if (!this.errorLogged) {
          logger.warn('⚠️  Cache service Redis connection failed, using fallback. Error:', err.message);
          this.errorLogged = true;
        }
        this.connected = false;
      });

      this.client.on('end', () => {
        logger.info('Cache service Redis client disconnected');
        this.connected = false;
      });

      this.client.on('ready', () => {
        logger.info('✅ Cache service Redis client ready');
        this.connected = true;
        this.errorLogged = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.connected = false;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.connected = false;
      }
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Basic cache operations
  async get(key) {
    if (!this.connected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.client.setEx(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache del error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.connected) {
      return false;
    }

    try {
      const value = await this.getAsync(key);
      return value !== null;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  async ttl(key) {
    if (!this.connected) {
      return -1;
    }

    try {
      return await this.ttlAsync(key);
    } catch (error) {
      logger.error('Cache TTL error:', error);
      return -1;
    }
  }

  // Pattern-based operations
  async getKeys(pattern) {
    if (!this.connected) {
      return [];
    }

    try {
      return await this.keysAsync(pattern);
    } catch (error) {
      logger.error('Cache getKeys error:', error);
      return [];
    }
  }

  async delPattern(pattern) {
    if (!this.connected) {
      return 0;
    }

    try {
      const keys = await this.keysAsync(pattern);
      if (keys.length > 0) {
        await this.delAsync(keys);
      }
      return keys.length;
    } catch (error) {
      logger.error('Cache delPattern error:', error);
      return 0;
    }
  }

  // Cache invalidation strategies
  async invalidateUser(userId) {
    try {
      const patterns = [
        `user:${userId}:*`,
        `booking:user:${userId}:*`,
        `profile:${userId}:*`
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await this.delPattern(pattern);
      }

      logger.info(`Invalidated ${totalDeleted} cache entries for user ${userId}`);
      return totalDeleted;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateHotel(hotelId) {
    try {
      const patterns = [
        `hotel:${hotelId}:*`,
        `room:hotel:${hotelId}:*`,
        `booking:hotel:${hotelId}:*`,
        `dashboard:hotel:${hotelId}:*`,
        `analytics:hotel:${hotelId}:*`
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await this.delPattern(pattern);
      }

      logger.info(`Invalidated ${totalDeleted} cache entries for hotel ${hotelId}`);
      return totalDeleted;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async invalidateBooking(bookingId) {
    try {
      const patterns = [
        `booking:${bookingId}:*`,
        `booking:user:*:${bookingId}:*`,
        `booking:hotel:*:${bookingId}:*`
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await this.delPattern(pattern);
      }

      logger.info(`Invalidated ${totalDeleted} cache entries for booking ${bookingId}`);
      return totalDeleted;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Invalidate cache for a property (multi-property system)
   * Removes all cached data related to a specific property
   * @param {String} propertyId - Property ID
   * @returns {Promise<Number>} Number of keys deleted
   */
  async invalidateProperty(propertyId) {
    try {
      if (!this.connected || !this.client) {
        return 0;
      }

      const patterns = [
        `property:${propertyId}:*`,
        `inheritance:${propertyId}:*`,
        `settings:${propertyId}:*`,
        `api:*propertyId=${propertyId}*`
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await this.delPattern(pattern);
      }

      logger.info(`Invalidated ${totalDeleted} cache entries for property ${propertyId}`);
      return totalDeleted;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Invalidate cache for a property group
   * @param {String} groupId - Property group ID
   * @returns {Promise<Number>} Number of keys deleted
   */
  async invalidateGroup(groupId) {
    try {
      if (!this.connected || !this.client) {
        return 0;
      }

      const patterns = [
        `group:${groupId}:*`,
        `api:*groupId=${groupId}*`
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await this.delPattern(pattern);
      }

      logger.info(`Invalidated ${totalDeleted} cache entries for group ${groupId}`);
      return totalDeleted;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Invalidate cache for multiple properties
   * @param {Array} propertyIds - Array of property IDs
   * @returns {Promise<Number>} Total keys deleted
   */
  async invalidateProperties(propertyIds) {
    try {
      if (!this.connected || !this.client) {
        return 0;
      }

      let totalDeleted = 0;
      for (const propertyId of propertyIds) {
        totalDeleted += await this.invalidateProperty(propertyId);
      }

      return totalDeleted;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Invalidate all settings-related cache
   * @returns {Promise<Number>} Number of keys deleted
   */
  async invalidateAllSettings() {
    try {
      if (!this.connected || !this.client) {
        return 0;
      }

      const patterns = [
        'settings:*',
        'inheritance:*',
        'api:*settings*'
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        totalDeleted += await this.delPattern(pattern);
      }

      logger.info(`Invalidated ${totalDeleted} settings cache entries`);
      return totalDeleted;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get or set pattern: get from cache or compute and cache
   * @param {String} key - Cache key
   * @param {Function} computeFn - Async function to compute value
   * @param {Number} ttl - Time to live in seconds
   * @returns {Promise<any>} Cached or computed value
   */
  async getOrSet(key, computeFn, ttl = 300) {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Not in cache, compute value
      const value = await computeFn();

      // Cache the result
      await this.set(key, value, ttl);

      return value;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Cache middleware
  cacheMiddleware(ttl = 3600, keyGenerator = null) {
    return async (req, res, next) => {
      if (!this.connected) {
        return next();
      }

      const key = keyGenerator ? keyGenerator(req) : `api:${req.originalUrl}`;
      
      try {
        const cachedData = await this.get(key);
        if (cachedData) {
          logger.info(`Cache hit for key: ${key}`);
          return res.json(cachedData);
        }

        // Store original send method
        const originalSend = res.json;
        
        // Override send method to cache response
        res.json = function(data) {
          this.set(key, data, ttl);
          return originalSend.call(this, data);
        }.bind(this);

        logger.info(`Cache miss for key: ${key}`);
        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  // Cache decorator for functions
  async cached(key, ttl, fn) {
    if (!this.connected) {
      return await fn();
    }

    try {
      const cachedResult = await this.get(key);
      if (cachedResult) {
        logger.info(`Cache hit for function: ${key}`);
        return cachedResult;
      }

      logger.info(`Cache miss for function: ${key}`);
      const result = await fn();
      await this.set(key, result, ttl);
      return result;
    } catch (error) {
      logger.error('Cache decorator error:', error);
      return await fn();
    }
  }

  // Cache statistics
  async getStats() {
    if (!this.connected) {
      return { connected: false };
    }

    try {
      const keys = await this.keysAsync('*');
      const stats = {
        connected: true,
        totalKeys: keys.length,
        memoryUsage: await this.getMemoryUsage(),
        patterns: {
          users: (await this.keysAsync('user:*')).length,
          hotels: (await this.keysAsync('hotel:*')).length,
          bookings: (await this.keysAsync('booking:*')).length,
          api: (await this.keysAsync('api:*')).length
        }
      };

      return stats;
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { connected: false, error: error.message };
    }
  }

  async getMemoryUsage() {
    if (!this.connected) {
      return null;
    }

    try {
      const info = await promisify(this.client.info).bind(this.client)('memory');
      const lines = info.split('\r\n');
      const memoryInfo = {};
      
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryInfo[key] = value;
        }
      });

      return memoryInfo;
    } catch (error) {
      logger.error('Memory usage error:', error);
      return null;
    }
  }

  // Health check
  async healthCheck() {
    if (!this.connected) {
      return { status: 'disconnected', message: 'Redis not connected' };
    }

    try {
      await this.setAsync('health:check', Date.now(), 60);
      const result = await this.getAsync('health:check');
      
      if (result) {
        return { status: 'healthy', message: 'Redis is working properly' };
      } else {
        return { status: 'unhealthy', message: 'Redis health check failed' };
      }
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;
