import { getRedisClient } from '../config/redis.js';
import logger from './logger.js';

/**
 * Acquire a distributed lock using Redis SET NX PX.
 * @param {string} lockKey - Unique key for the lock
 * @param {number} timeoutMs - Lock timeout in milliseconds (default 30s)
 * @returns {string} lockValue - Value needed to release the lock
 */
export async function acquireDistributedLock(lockKey, timeoutMs = 30000) {
  const lockValue = `${Date.now()}-${Math.random()}`;
  const redisClient = getRedisClient();
  const acquired = await redisClient.set(
    lockKey,
    lockValue,
    'PX',
    timeoutMs,
    'NX'
  );

  if (!acquired) {
    throw new Error(`Failed to acquire lock: ${lockKey}`);
  }

  return lockValue;
}

/**
 * Release a distributed lock using a Lua script for atomic check-and-delete.
 * @param {string} lockKey - Lock key to release
 * @param {string} expectedValue - Value returned by acquireDistributedLock
 * @returns {boolean} Whether the lock was successfully released
 */
export async function releaseDistributedLock(lockKey, expectedValue) {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  const redisClient = getRedisClient();
  const released = await redisClient.eval(script, 1, lockKey, expectedValue);
  return released === 1;
}

/**
 * Execute a function while holding a distributed lock.
 * Guarantees lock release even on error.
 * @param {string} lockKey - Unique key for the lock
 * @param {Function} fn - Async function to execute while holding the lock
 * @param {number} timeoutMs - Lock timeout in milliseconds (default 30s)
 * @returns {*} Return value of fn
 */
export async function withDistributedLock(lockKey, fn, timeoutMs = 30000) {
  let lockValue = null;
  try {
    lockValue = await acquireDistributedLock(lockKey, timeoutMs);
    return await fn();
  } finally {
    if (lockValue) {
      try {
        await releaseDistributedLock(lockKey, lockValue);
      } catch (err) {
        logger.error('Failed to release distributed lock', { lockKey, error: err.message });
      }
    }
  }
}
