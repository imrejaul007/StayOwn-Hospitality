import logger from '../utils/logger.js';
/**
 * Performance Monitor Service
 *
 * Tracks performance metrics for API endpoints and operations.
 * Provides insights into:
 * - Response times
 * - Slow queries
 * - Resource usage
 * - Cache hit rates
 */
class PerformanceMonitor {
  constructor() {
    // Store metrics in memory
    // For production, consider persisting to database or external monitoring service
    this.metrics = new Map();
    this.slowQueries = [];
    this.maxSlowQueries = 100; // Keep last 100 slow queries
    this.slowQueryThreshold = 1000; // 1 second

    // Initialize stats
    this.stats = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      startTime: Date.now()
    };
  }

  /**
   * Start timing an operation
   * @param {String} operationName - Name of the operation
   * @returns {Object} Timer object
   */
  startTimer(operationName) {
    return {
      name: operationName,
      startTime: Date.now()
    };
  }

  /**
   * End timing and record metric
   * @param {Object} timer - Timer object from startTimer
   * @param {Object} metadata - Additional metadata (optional)
   * @returns {Number} Duration in milliseconds
   */
  endTimer(timer, metadata = {}) {
    const duration = Date.now() - timer.startTime;

    this.recordMetric(timer.name, duration, metadata);

    // Track slow queries
    if (duration > this.slowQueryThreshold) {
      this.recordSlowQuery(timer.name, duration, metadata);
    }

    return duration;
  }

  /**
   * Record a metric
   * @param {String} name - Metric name
   * @param {Number} value - Metric value (usually duration in ms)
   * @param {Object} metadata - Additional metadata
   */
  recordMetric(name, value, metadata = {}) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
        recent: [], // Keep last 10 values
        errors: 0
      });
    }

    const metric = this.metrics.get(name);
    metric.count++;
    metric.total += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.avg = metric.total / metric.count;

    // Keep recent values (last 10)
    metric.recent.push(value);
    if (metric.recent.length > 10) {
      metric.recent.shift();
    }

    // Track errors if indicated in metadata
    if (metadata.error) {
      metric.errors++;
      this.stats.totalErrors++;
    }

    // Update global stats
    this.stats.totalRequests++;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + value) /
      this.stats.totalRequests;
  }

  /**
   * Record a slow query
   * @param {String} name - Query name
   * @param {Number} duration - Duration in milliseconds
   * @param {Object} metadata - Additional metadata
   */
  recordSlowQuery(name, duration, metadata = {}) {
    this.slowQueries.unshift({
      name,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata
    });

    // Keep only last N slow queries
    if (this.slowQueries.length > this.maxSlowQueries) {
      this.slowQueries.pop();
    }
  }

  /**
   * Get all metrics
   * @returns {Object} Metrics summary
   */
  getMetrics() {
    const metricsObj = {};

    for (const [name, metric] of this.metrics) {
      metricsObj[name] = {
        count: metric.count,
        avgMs: Math.round(metric.avg),
        minMs: Math.round(metric.min),
        maxMs: Math.round(metric.max),
        errors: metric.errors,
        errorRate: metric.count > 0 ? ((metric.errors / metric.count) * 100).toFixed(2) + '%' : '0%',
        recent: metric.recent.map(v => Math.round(v))
      };
    }

    return metricsObj;
  }

  /**
   * Get metric by name
   * @param {String} name - Metric name
   * @returns {Object} Metric details
   */
  getMetric(name) {
    const metric = this.metrics.get(name);
    if (!metric) return null;

    return {
      name,
      count: metric.count,
      avgMs: Math.round(metric.avg),
      minMs: Math.round(metric.min),
      maxMs: Math.round(metric.max),
      errors: metric.errors,
      errorRate: metric.count > 0 ? ((metric.errors / metric.count) * 100).toFixed(2) + '%' : '0%',
      recent: metric.recent.map(v => Math.round(v))
    };
  }

  /**
   * Get global statistics
   * @returns {Object} Global stats
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const uptimeMinutes = Math.floor(uptime / 60000);
    const requestsPerMinute = uptimeMinutes > 0 ? (this.stats.totalRequests / uptimeMinutes).toFixed(2) : 0;

    return {
      totalRequests: this.stats.totalRequests,
      totalErrors: this.stats.totalErrors,
      errorRate: this.stats.totalRequests > 0
        ? ((this.stats.totalErrors / this.stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%',
      averageResponseTime: Math.round(this.stats.averageResponseTime),
      uptimeMs: uptime,
      uptimeMinutes,
      requestsPerMinute: parseFloat(requestsPerMinute),
      startTime: new Date(this.stats.startTime).toISOString()
    };
  }

  /**
   * Get slow queries
   * @param {Number} limit - Number of slow queries to return
   * @returns {Array} Slow queries
   */
  getSlowQueries(limit = 20) {
    return this.slowQueries.slice(0, limit);
  }

  /**
   * Get top N slowest operations
   * @param {Number} n - Number of operations to return
   * @returns {Array} Top slowest operations
   */
  getTopSlowOperations(n = 10) {
    const operations = Array.from(this.metrics.entries()).map(([name, metric]) => ({
      name,
      avgMs: Math.round(metric.avg),
      maxMs: Math.round(metric.max),
      count: metric.count
    }));

    return operations
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, n);
  }

  /**
   * Get operations with high error rates
   * @param {Number} threshold - Error rate threshold percentage (default: 5%)
   * @returns {Array} Operations with high error rates
   */
  getHighErrorOperations(threshold = 5) {
    const operations = [];

    for (const [name, metric] of this.metrics) {
      if (metric.count > 0) {
        const errorRate = (metric.errors / metric.count) * 100;
        if (errorRate >= threshold) {
          operations.push({
            name,
            errorRate: errorRate.toFixed(2) + '%',
            errors: metric.errors,
            total: metric.count
          });
        }
      }
    }

    return operations.sort((a, b) => parseFloat(b.errorRate) - parseFloat(a.errorRate));
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
    this.slowQueries = [];
    this.stats = {
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      startTime: Date.now()
    };
  }

  /**
   * Reset specific metric
   * @param {String} name - Metric name
   */
  resetMetric(name) {
    this.metrics.delete(name);
  }

  /**
   * Export metrics for external monitoring
   * @returns {Object} Metrics in exportable format
   */
  export() {
    return {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      metrics: this.getMetrics(),
      slowQueries: this.getSlowQueries(50),
      topSlowOperations: this.getTopSlowOperations(20),
      highErrorOperations: this.getHighErrorOperations()
    };
  }

  /**
   * Middleware for Express to track route performance
   * @returns {Function} Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const timer = this.startTimer(`${req.method} ${req.path}`);

      // Capture original end method
      const originalEnd = res.end;

      // Override end method to capture metrics
      res.end = (...args) => {
        const duration = this.endTimer(timer, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          error: res.statusCode >= 400
        });

        // Log slow requests
        if (duration > this.slowQueryThreshold) {
          logger.warn(`[Performance] Slow request: ${req.method} ${req.path} took ${duration}ms`);
        }

        // Call original end method
        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Get performance report
   * @returns {Object} Comprehensive performance report
   */
  getReport() {
    return {
      summary: this.getStats(),
      topSlowOperations: this.getTopSlowOperations(10),
      recentSlowQueries: this.getSlowQueries(10),
      highErrorOperations: this.getHighErrorOperations(),
      totalMetrics: this.metrics.size,
      generated: new Date().toISOString()
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
