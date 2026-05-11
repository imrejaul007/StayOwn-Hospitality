import { Queue } from 'bullmq';
import { env } from '../config/env';

// Lazy queue factory - queues are created only when first accessed
// This prevents connection errors at startup when Redis isn't ready yet
const queueCache: Map<string, Queue> = new Map();

function createQueue(name: string, options?: Partial<ConstructorParameters<typeof Queue>[1]>): Queue {
  return new Queue(name, {
    connection: { url: env.REDIS_URL },
    ...options,
  });
}

export function getQueue(name: string): Queue {
  if (!queueCache.has(name)) {
    queueCache.set(name, createQueue(name));
  }
  return queueCache.get(name)!;
}

// Export queue proxy objects that delegate to lazily-created queues
// Only creates the actual queue when a method is called
export const holdExpiryQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('hold-expiry').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('hold-expiry').getJob(...args),
  getRepeatableJobs: () => getQueue('hold-expiry').getRepeatableJobs(),
};

export const coinExpiryFifoQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('coin-expiry-fifo').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('coin-expiry-fifo').getJob(...args),
  getRepeatableJobs: () => getQueue('coin-expiry-fifo').getRepeatableJobs(),
};

export const coinExpiryQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('coin-expiry').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('coin-expiry').getJob(...args),
  getRepeatableJobs: () => getQueue('coin-expiry').getRepeatableJobs(),
};

export const settlementBatchQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('settlement-batch').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('settlement-batch').getJob(...args),
  getRepeatableJobs: () => getQueue('settlement-batch').getRepeatableJobs(),
};

export const tierUpdateQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('tier-update').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('tier-update').getJob(...args),
  getRepeatableJobs: () => getQueue('tier-update').getRepeatableJobs(),
};

export const monthlyMiningQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('monthly-mining').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('monthly-mining').getJob(...args),
  getRepeatableJobs: () => getQueue('monthly-mining').getRepeatableJobs(),
};

export const vestingCheckerQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('vesting-checker').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('vesting-checker').getJob(...args),
  getRepeatableJobs: () => getQueue('vesting-checker').getRepeatableJobs(),
};

export const reconciliationQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('reconciliation').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('reconciliation').getJob(...args),
  getRepeatableJobs: () => getQueue('reconciliation').getRepeatableJobs(),
};

export const noShowQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('no-show-processor').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('no-show-processor').getJob(...args),
  getRepeatableJobs: () => getQueue('no-show-processor').getRepeatableJobs(),
};

export const pmsInventorySyncQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('pms-inventory-sync').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('pms-inventory-sync').getJob(...args),
  getRepeatableJobs: () => getQueue('pms-inventory-sync').getRepeatableJobs(),
};

export const pmsNotificationQueue = {
  add: (...args: Parameters<Queue['add']>) => getQueue('pms-notification').add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getQueue('pms-notification').getJob(...args),
  getRepeatableJobs: () => getQueue('pms-notification').getRepeatableJobs(),
};
