/**
 * ResilientCache - Redis-backed cache that gracefully degrades when Redis is unavailable.
 * Never throws on cache miss or Redis failure — always falls through to the data source.
 */
class ResilientCache {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.defaultTTL = options.defaultTTL || 300; // 5 minutes
    this.prefix = options.prefix || 'cache';
    this.isAvailable = true;
    this._setupHealthCheck();
  }

  _setupHealthCheck() {
    if (this.redis) {
      this.redis.on('error', () => { this.isAvailable = false; });
      this.redis.on('connect', () => { this.isAvailable = true; });
      this.redis.on('ready', () => { this.isAvailable = true; });
    }
  }

  _key(key, tenantId) {
    return tenantId ? `${this.prefix}:${tenantId}:${key}` : `${this.prefix}:${key}`;
  }

  /**
   * Get cached value or execute fallback function.
   * @param {string} key - Cache key
   * @param {Function} fallback - async function to get data if cache misses
   * @param {object} options - { ttl, tenantId }
   */
  async getOrSet(key, fallback, options = {}) {
    const { ttl = this.defaultTTL, tenantId } = options;
    const cacheKey = this._key(key, tenantId);

    // Try cache first
    if (this.isAvailable && this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Redis failed — fall through silently
        console.warn(`[ResilientCache] Redis get failed for ${cacheKey}: ${err.message}`);
      }
    }

    // Cache miss or Redis unavailable — execute fallback
    const result = await fallback();

    // Try to cache the result (non-blocking)
    if (this.isAvailable && this.redis && result !== undefined && result !== null) {
      this.redis.set(cacheKey, JSON.stringify(result), 'EX', ttl).catch(err => console.warn(`[ResilientCache] Redis set failed for ${cacheKey}: ${err.message}`));
    }

    return result;
  }

  async invalidate(key, tenantId) {
    if (!this.isAvailable || !this.redis) return;
    try {
      await this.redis.del(this._key(key, tenantId));
    } catch {
      // Ignore — cache will expire naturally
    }
  }

  async invalidatePattern(pattern, tenantId) {
    if (!this.isAvailable || !this.redis) return;
    try {
      const fullPattern = this._key(pattern, tenantId);
      const keys = await this.redis.keys(fullPattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch {
      // Ignore
    }
  }
}

export { ResilientCache };
