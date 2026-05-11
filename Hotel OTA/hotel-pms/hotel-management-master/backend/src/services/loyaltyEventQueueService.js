import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';
import loyaltyReconciliationService from './loyaltyReconciliationService.js';
import loyaltyExpiryService from './loyaltyExpiryService.js';
import loyaltyOpsMonitoringService from './loyaltyOpsMonitoringService.js';

const QUEUE_KEY = 'queue:loyalty:events';

class LoyaltyEventQueueService {
  constructor() {
    this.redis = null;
    this.interval = null;
    this.isProcessing = false;
    this.pollMs = Number.parseInt(process.env.LOYALTY_QUEUE_POLL_MS || '15000', 10);
  }

  async initialize() {
    this.redis = getRedisClient();
  }

  async enqueue(type, payload = {}, metadata = {}) {
    if (!this.redis || !this.redis.isReady) {
      logger.warn('Loyalty queue unavailable, skipping enqueue', { type });
      return { queued: false, reason: 'redis_unavailable' };
    }
    const event = {
      type,
      payload,
      metadata,
      createdAt: new Date().toISOString()
    };
    await this.redis.lPush(QUEUE_KEY, JSON.stringify(event));
    await this.redis.expire(QUEUE_KEY, 7 * 24 * 60 * 60);
    return { queued: true };
  }

  async processNext() {
    if (!this.redis || !this.redis.isReady) return null;
    const raw = await this.redis.rPop(QUEUE_KEY);
    if (!raw) return null;
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return null;
    }
    try {
      switch (event.type) {
        case 'loyalty.expiry.run':
          await loyaltyExpiryService.runExpiryBatch(event.payload || {});
          break;
        case 'loyalty.reconciliation.run':
          await loyaltyReconciliationService.runFullReconciliation(event.payload || {});
          break;
        case 'loyalty.alerts.evaluate':
          await loyaltyOpsMonitoringService.evaluateSlaAlerts();
          break;
        default:
          logger.warn('Unknown loyalty queue event type', { type: event.type });
      }
    } catch (error) {
      logger.error('Loyalty queue event processing failed', { type: event.type, error: error.message });
    }
    return event;
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.processNext();
      } finally {
        this.isProcessing = false;
      }
    }, this.pollMs);
    logger.info('Loyalty event queue started', { pollMs: this.pollMs });
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async getDepth() {
    if (!this.redis || !this.redis.isReady) return 0;
    return this.redis.lLen(QUEUE_KEY);
  }
}

export default new LoyaltyEventQueueService();
