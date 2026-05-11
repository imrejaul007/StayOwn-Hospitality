import { ApplicationError } from './errorHandler.js';
import { getRedisClient, isRedisConnected } from '../config/redis.js';
import logger from '../utils/logger.js';

const memoryStore = new Map();
const DEFAULT_TTL_SECONDS = 60 * 60; // 1 hour
const PROCESSING_TTL_SECONDS = 5 * 60; // 5 minutes

const nowMs = () => Date.now();

const parseIfJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getIdempotencyHeader = (req) => {
  const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  return typeof key === 'string' ? key.trim() : '';
};

const buildStorageKey = (req, key, namespace) => {
  const userId = req.user?._id?.toString() || 'anonymous';
  return `idempotency:${namespace}:${userId}:${req.method}:${req.baseUrl}${req.path}:${key}`;
};

const cleanupMemoryStore = () => {
  const current = nowMs();
  for (const [key, value] of memoryStore.entries()) {
    if (!value?.expiresAt || value.expiresAt <= current) {
      memoryStore.delete(key);
    }
  }
};

const createMemoryState = (state, ttlSeconds) => ({
  ...state,
  expiresAt: nowMs() + (ttlSeconds * 1000)
});

async function readState(storageKey) {
  if (process.env.NODE_ENV === 'production' && !isRedisConnected()) {
    throw new ApplicationError('Idempotency storage unavailable', 503);
  }
  if (isRedisConnected()) {
    const redis = getRedisClient();
    const raw = await redis.get(storageKey);
    return parseIfJson(raw);
  }

  cleanupMemoryStore();
  const state = memoryStore.get(storageKey);
  if (!state) return null;

  if (state.expiresAt <= nowMs()) {
    memoryStore.delete(storageKey);
    return null;
  }

  return state;
}

async function tryAcquireProcessing(storageKey) {
  const processingState = {
    state: 'processing',
    createdAt: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'production' && !isRedisConnected()) {
    throw new ApplicationError('Idempotency storage unavailable', 503);
  }
  if (isRedisConnected()) {
    const redis = getRedisClient();
    const acquired = await redis.set(
      storageKey,
      JSON.stringify(processingState),
      'EX',
      PROCESSING_TTL_SECONDS,
      'NX'
    );

    return acquired === 'OK';
  }

  cleanupMemoryStore();
  if (memoryStore.has(storageKey)) {
    return false;
  }

  memoryStore.set(storageKey, createMemoryState(processingState, PROCESSING_TTL_SECONDS));
  return true;
}

async function storeCompleted(storageKey, responseBody, statusCode, ttlSeconds) {
  const completedState = {
    state: 'completed',
    statusCode,
    responseBody,
    completedAt: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'production' && !isRedisConnected()) {
    throw new ApplicationError('Idempotency storage unavailable', 503);
  }
  if (isRedisConnected()) {
    const redis = getRedisClient();
    await redis.set(storageKey, JSON.stringify(completedState), 'EX', ttlSeconds);
    return;
  }

  memoryStore.set(storageKey, createMemoryState(completedState, ttlSeconds));
}

async function clearState(storageKey) {
  if (process.env.NODE_ENV === 'production' && !isRedisConnected()) {
    throw new ApplicationError('Idempotency storage unavailable', 503);
  }
  if (isRedisConnected()) {
    const redis = getRedisClient();
    await redis.del(storageKey);
    return;
  }
  memoryStore.delete(storageKey);
}

export const enforceIdempotency = (options = {}) => {
  const {
    ttlSeconds = DEFAULT_TTL_SECONDS,
    namespace = 'financial'
  } = options;

  return async (req, res, next) => {
    try {
      const idempotencyKey = getIdempotencyHeader(req);
      if (!idempotencyKey) {
        throw new ApplicationError(
          'Missing Idempotency-Key header for this endpoint',
          400
        );
      }

      const storageKey = buildStorageKey(req, idempotencyKey, namespace);
      const existingState = await readState(storageKey);

      if (existingState?.state === 'completed') {
        res.setHeader('X-Idempotency-Replayed', 'true');
        return res.status(existingState.statusCode || 200).json(existingState.responseBody);
      }

      if (existingState?.state === 'processing') {
        throw new ApplicationError(
          'A request with the same idempotency key is already being processed',
          409
        );
      }

      const acquired = await tryAcquireProcessing(storageKey);
      if (!acquired) {
        throw new ApplicationError(
          'Duplicate request detected. Retry with a new idempotency key.',
          409
        );
      }

      const originalJson = res.json.bind(res);
      let responseHandled = false;
      res.json = (body) => {
        responseHandled = true;
        const statusCode = res.statusCode || 200;

        // Keep successful responses for replay; clear failed ones to allow safe retry.
        if (statusCode < 400) {
          void storeCompleted(storageKey, body, statusCode, ttlSeconds).catch((error) => {
            logger.error('Failed storing idempotent response', { storageKey, error: error.message });
          });
        } else {
          void clearState(storageKey).catch((error) => {
            logger.error('Failed clearing idempotency key after error response', { storageKey, error: error.message });
          });
        }

        return originalJson(body);
      };

      // Ensure processing locks are released even when handlers throw before res.json.
      res.on('finish', () => {
        if (!responseHandled) {
          void clearState(storageKey).catch((error) => {
            logger.error('Failed clearing idempotency key on finish without response body', {
              storageKey,
              error: error.message
            });
          });
        }
      });

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export default enforceIdempotency;
