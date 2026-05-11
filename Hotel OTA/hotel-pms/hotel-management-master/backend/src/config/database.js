import mongoose from "mongoose";
import logger from "../utils/logger.js";

// Guard against duplicate index declarations (e.g. path `index: true` + `schema.index()`).
if (!globalThis.__mongooseIndexPatchApplied) {
globalThis.__mongooseIndexPatchApplied = true;
const originalSchemaIndex = mongoose.Schema.prototype.index;
const originalSchemaIndexes = mongoose.Schema.prototype.indexes;
mongoose.Schema.prototype.index = function patchedIndex(fields, options = {}) {
  try {
    const normalizeFields = (obj = {}) =>
      JSON.stringify(
        Object.keys(obj)
          .sort()
          .reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
          }, {})
      );

    const normalizeOptions = (obj = {}) => {
      const copy = { ...obj };
      delete copy.background;
      return JSON.stringify(
        Object.keys(copy)
          .sort()
          .reduce((acc, key) => {
            acc[key] = copy[key];
            return acc;
          }, {})
      );
    };

    const targetFields = normalizeFields(fields);
    const existingIndexes = this.indexes();
    const hasSameFields = existingIndexes.filter(([idxFields]) => normalizeFields(idxFields) === targetFields);
    // Exact duplicate: ignore silently.
    if (
      hasSameFields.some(([_, idxOptions]) => normalizeOptions(idxOptions || {}) === normalizeOptions(options || {}))
    ) {
      return this;
    }

    // Prefer explicit schema indexes over simple path-level `index: true`.
    for (const fieldName of Object.keys(fields || {})) {
      const path = this.path(fieldName);
      if (path?.options?.index === true) {
        delete path.options.index;
      }
    }
  } catch (_err) {
    // Fall back to default behavior if patch logic fails.
  }

  return originalSchemaIndex.call(this, fields, options);
};

mongoose.Schema.prototype.indexes = function patchedIndexes(...args) {
  const indexes = originalSchemaIndexes.call(this, ...args);

  const normalizeFields = (obj = {}) =>
    JSON.stringify(
      Object.keys(obj)
        .sort()
        .reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {})
    );

  const normalizeOptions = (obj = {}) => {
    const copy = { ...obj };
    delete copy.background;
    return JSON.stringify(
      Object.keys(copy)
        .sort()
        .reduce((acc, key) => {
          acc[key] = copy[key];
          return acc;
        }, {})
    );
  };

  const deduped = [];
  const seen = new Set();
  for (const [fields, options] of indexes) {
    const key = `${normalizeFields(fields)}|${normalizeOptions(options || {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push([fields, options]);
  }

  return deduped;
};
}

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      throw new Error('Missing MongoDB URI. Set MONGO_URI (or MONGODB_URI / DATABASE_URL).');
    }

    // On Render (and similar serverless/free tiers), a high minPoolSize slows first connect.
    // Override with MONGO_MIN_POOL_SIZE / MONGO_MAX_POOL_SIZE if needed.
    const minPool = Number(process.env.MONGO_MIN_POOL_SIZE);
    const maxPool = Number(process.env.MONGO_MAX_POOL_SIZE);
    const minPoolSize = Number.isFinite(minPool) && minPool >= 0
      ? minPool
      : process.env.RENDER === 'true'
        ? 0
        : 5;
    const maxPoolSize = Number.isFinite(maxPool) && maxPool > 0 ? maxPool : 20;

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      w: "majority",
      wtimeoutMS: 5000,
      readPreference: "primary",
      readConcern: { level: "majority" },
      autoIndex: process.env.NODE_ENV !== "production",
      autoCreate: process.env.NODE_ENV !== "production",
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // M-6: Database pool monitoring — log pool statistics every 60 seconds
    const poolMonitorInterval = setInterval(() => {
      try {
        const state = mongoose.connection.pool;
        if (state) {
          logger.debug('MongoDB pool stats', {
            total: state.total,
            active: state.active,
            idle: state.idle,
            available: state.available,
          });
          // Alert if pool is near exhaustion (>80% used)
          const utilizationPct = state.total > 0 ? (state.active / state.total) * 100 : 0;
          if (utilizationPct > 80) {
            logger.warn('MongoDB pool utilization high', {
              utilizationPct: Math.round(utilizationPct),
              active: state.active,
              total: state.total,
            });
          }
        }
      } catch (err) {
        logger.debug('Pool stats unavailable', { error: err.message });
      }
    }, 60000);
    // Store reference so server.js can clear it on shutdown
    mongoose.connection.poolMonitorInterval = poolMonitorInterval;

    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // H-8: Tenant query interceptor — auto-adds hotelId filter to all queries
    // Models that need tenant isolation should add a 'tenantScope' static to their schema
    // that returns the filter, and opt-in via Model.schema.statics.requiresTenantScope = true
    const globalQueryInterceptor = (schema) => {
      // Only apply to schemas that explicitly opt-in via static flag
      if (!schema.statics.requiresTenantScope) return;

      schema.pre(['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments', 'aggregate'], function() {
        // Only apply if AsyncLocalStorage has a hotelId context
        const hotelId = global.__tenantContext?.hotelId;
        if (!hotelId) return; // Let middleware handle it if no context

        // Don't override if already filtered by hotelId
        const query = this.getQuery();
        if (query.hotelId) return;

        this.where({ hotelId, ...query });
      });
    };
    mongoose.plugin(globalQueryInterceptor);

    // Note: Graceful shutdown (SIGINT/SIGTERM) is handled centrally in server.js

  } catch (error) {
  logger.error(`MongoDB connection failed: ${error.message}`, {
    stack: error.stack,
    code: error.code,
    name: error.name
  });
  if (process.env.NODE_ENV === 'production') {
    throw error;
  }
  logger.warn('Server continuing without database outside production');
  return null;
}
};

export default connectDB;
