import logger from '../utils/logger.js';
import loyaltyReconciliationService from '../services/loyaltyReconciliationService.js';
import loyaltyExpiryService from '../services/loyaltyExpiryService.js';
import loyaltyOpsMonitoringService from '../services/loyaltyOpsMonitoringService.js';

let intervalRef = null;

function getIntervalMs() {
  const hours = Number.parseInt(process.env.LOYALTY_MAINTENANCE_INTERVAL_HOURS || '24', 10);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return safeHours * 60 * 60 * 1000;
}

async function runMaintenanceCycle() {
  try {
    const expiry = await loyaltyExpiryService.runExpiryBatch();
    const reconciliation = await loyaltyReconciliationService.runFullReconciliation({
      maxUsers: Number.parseInt(process.env.LOYALTY_RECON_MAX_USERS || '1000', 10)
    });
    const alerts = await loyaltyOpsMonitoringService.evaluateSlaAlerts();

    logger.info('Loyalty maintenance cycle completed', {
      expiryProcessed: expiry.processed,
      expiryScanned: expiry.scanned,
      reconciliationUsers: reconciliation.totalUsersChecked,
      reconciliationMismatches: reconciliation.mismatchCount,
      alertCount: alerts.length
    });
  } catch (error) {
    logger.error('Loyalty maintenance cycle failed', { error: error.message });
  }
}

function start() {
  if (process.env.LOYALTY_MAINTENANCE_ENABLED === 'false') {
    logger.info('Loyalty maintenance job disabled');
    return;
  }
  if (intervalRef) return;

  const intervalMs = getIntervalMs();
  intervalRef = setInterval(() => {
    runMaintenanceCycle().catch((error) => {
      logger.error('Loyalty maintenance interval execution failed', { error: error.message });
    });
  }, intervalMs);

  logger.info('Loyalty maintenance job started', { intervalMs });
}

function stop() {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
}

export default {
  start,
  stop,
  runMaintenanceCycle
};
