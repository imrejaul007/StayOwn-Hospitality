import Loyalty from '../models/Loyalty.js';
import LoyaltyOpsAlert from '../models/LoyaltyOpsAlert.js';
import LoyaltyReconciliationRun from '../models/LoyaltyReconciliationRun.js';

const DEFAULT_THRESHOLDS = {
  maxReconciliationAgeHours: Number.parseInt(process.env.LOYALTY_SLA_MAX_RECON_AGE_HOURS || '30', 10),
  mismatchRatePct: Number.parseFloat(process.env.LOYALTY_SLA_MISMATCH_RATE_PCT || '2.5'),
  driftSpikeCount: Number.parseInt(process.env.LOYALTY_SLA_DRIFT_SPIKE_COUNT || '100', 10),
  expiryBacklogCount: Number.parseInt(process.env.LOYALTY_SLA_EXPIRY_BACKLOG_COUNT || '500', 10)
};

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function createOrUpdateOpenAlert(type, severity, message, metadata = {}) {
  const existing = await LoyaltyOpsAlert.findOne({ type, status: 'open' });
  if (existing) {
    existing.severity = severity;
    existing.message = message;
    existing.metadata = metadata;
    await existing.save();
    return existing;
  }
  return LoyaltyOpsAlert.create({ type, severity, message, metadata });
}

async function evaluateSlaAlerts() {
  const alerts = [];
  const latestRecon = await LoyaltyReconciliationRun.findOne({ status: 'completed' })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestRecon || latestRecon.createdAt < hoursAgo(DEFAULT_THRESHOLDS.maxReconciliationAgeHours)) {
    alerts.push(
      await createOrUpdateOpenAlert(
        'reconciliation_stale',
        'high',
        'Loyalty reconciliation is stale.',
        { latestRunAt: latestRecon?.createdAt || null }
      )
    );
  }

  if (latestRecon && latestRecon.totalUsersChecked > 0) {
    const mismatchRate = (latestRecon.mismatchCount / latestRecon.totalUsersChecked) * 100;
    if (mismatchRate >= DEFAULT_THRESHOLDS.mismatchRatePct) {
      alerts.push(
        await createOrUpdateOpenAlert(
          'mismatch_rate_high',
          mismatchRate >= DEFAULT_THRESHOLDS.mismatchRatePct * 2 ? 'critical' : 'high',
          `Loyalty mismatch rate is high (${mismatchRate.toFixed(2)}%).`,
          { mismatchRate, latestRunId: latestRecon._id }
        )
      );
    }
  }

  const highDriftCount = await LoyaltyReconciliationRun.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: hoursAgo(24) } } },
    { $unwind: '$mismatches' },
    { $match: { 'mismatches.delta': { $gte: 500 } } },
    { $count: 'count' }
  ]);
  const driftCount = highDriftCount[0]?.count || 0;
  if (driftCount >= DEFAULT_THRESHOLDS.driftSpikeCount) {
    alerts.push(
      await createOrUpdateOpenAlert(
        'drift_spike',
        'critical',
        'Large loyalty drift spike detected in last 24h.',
        { driftCount }
      )
    );
  }

  const expiryBacklog = await Loyalty.countDocuments({
    type: 'earned',
    points: { $gt: 0 },
    expiresAt: { $lte: new Date() },
    'metadata.expiryProcessedAt': { $exists: false }
  });
  if (expiryBacklog >= DEFAULT_THRESHOLDS.expiryBacklogCount) {
    alerts.push(
      await createOrUpdateOpenAlert(
        'expiry_backlog',
        'high',
        'Loyalty expiry backlog is above threshold.',
        { expiryBacklog }
      )
    );
  }

  return alerts;
}

export default {
  evaluateSlaAlerts,
  DEFAULT_THRESHOLDS
};
