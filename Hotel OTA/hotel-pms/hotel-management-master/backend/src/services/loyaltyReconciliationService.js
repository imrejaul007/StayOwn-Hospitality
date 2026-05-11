import mongoose from 'mongoose';
import User from '../models/User.js';
import Loyalty from '../models/Loyalty.js';
import LoyaltyReconciliationRun from '../models/LoyaltyReconciliationRun.js';
import logger from '../utils/logger.js';

const MAX_MISMATCH_SAMPLES = 200;

async function getActiveLedgerTotalsByUser(userIds) {
  const now = new Date();
  const rows = await Loyalty.aggregate([
    {
      $match: {
        userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
        $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }, { expiresAt: null }]
      }
    },
    { $group: { _id: '$userId', totalPoints: { $sum: '$points' } } }
  ]);

  const totals = new Map();
  rows.forEach((r) => totals.set(String(r._id), Number(r.totalPoints || 0)));
  return totals;
}

async function computeSingleUserDelta(userId) {
  const user = await User.findById(userId).select('+loyalty').lean();
  if (!user || !user.loyalty) {
    return null;
  }
  const totals = await getActiveLedgerTotalsByUser([userId]);
  const ledgerPoints = totals.get(String(userId)) || 0;
  const cachedPoints = Number(user.loyalty.points || 0);
  return {
    userId: String(userId),
    cachedPoints,
    ledgerPoints,
    delta: ledgerPoints - cachedPoints,
    tier: user.loyalty.tier
  };
}

async function applyRepair(userId, ledgerPoints) {
  const user = await User.findById(userId).select('+loyalty');
  if (!user || !user.loyalty) {
    return null;
  }
  user.loyalty.points = ledgerPoints;
  user.updateLoyaltyTier();
  await user.save();
  return user;
}

async function runFullReconciliation({ maxUsers = 1000 } = {}) {
  const run = await LoyaltyReconciliationRun.create({
    status: 'running',
    mode: 'full',
    startedAt: new Date()
  });

  try {
    const users = await User.find({
      'loyalty.points': { $exists: true }
    })
      .select('_id loyalty.points loyalty.tier')
      .sort({ updatedAt: -1 })
      .limit(Math.min(Math.max(1, Number(maxUsers) || 1000), 5000))
      .lean();

    const userIds = users.map((u) => u._id);
    const totals = await getActiveLedgerTotalsByUser(userIds);

    const mismatches = [];
    let largestDelta = 0;

    users.forEach((user) => {
      const ledgerPoints = totals.get(String(user._id)) || 0;
      const cachedPoints = Number(user.loyalty?.points || 0);
      const delta = ledgerPoints - cachedPoints;
      if (delta !== 0) {
        largestDelta = Math.max(largestDelta, Math.abs(delta));
        if (mismatches.length < MAX_MISMATCH_SAMPLES) {
          mismatches.push({
            userId: user._id,
            cachedPoints,
            ledgerPoints,
            delta,
            tier: user.loyalty?.tier
          });
        }
      }
    });

    run.totalUsersChecked = users.length;
    run.mismatchCount = users.filter((u) => (totals.get(String(u._id)) || 0) - Number(u.loyalty?.points || 0) !== 0).length;
    run.largestDelta = largestDelta;
    run.mismatches = mismatches;
    run.status = 'completed';
    run.completedAt = new Date();
    await run.save();

    return run.toObject();
  } catch (error) {
    run.status = 'failed';
    run.error = error.message;
    run.completedAt = new Date();
    await run.save();
    logger.error('Loyalty reconciliation failed', { error: error.message });
    throw error;
  }
}

async function reconcileUser({ userId, applyFix = false }) {
  const run = await LoyaltyReconciliationRun.create({
    status: 'running',
    mode: 'single_user',
    startedAt: new Date()
  });

  try {
    const delta = await computeSingleUserDelta(userId);
    if (!delta) {
      run.totalUsersChecked = 0;
      run.status = 'completed';
      run.completedAt = new Date();
      await run.save();
      return { found: false, run: run.toObject() };
    }

    run.totalUsersChecked = 1;
    run.mismatchCount = delta.delta === 0 ? 0 : 1;
    run.largestDelta = Math.abs(delta.delta);
    run.mismatches = delta.delta === 0 ? [] : [delta];

    let repaired = false;
    if (applyFix && delta.delta !== 0) {
      const repairedUser = await applyRepair(userId, delta.ledgerPoints);
      repaired = Boolean(repairedUser);
      run.repairedCount = repaired ? 1 : 0;
    }

    run.status = 'completed';
    run.completedAt = new Date();
    await run.save();

    return {
      found: true,
      mismatch: delta,
      repaired,
      run: run.toObject()
    };
  } catch (error) {
    run.status = 'failed';
    run.error = error.message;
    run.completedAt = new Date();
    await run.save();
    throw error;
  }
}

async function getHealthSummary() {
  const latestRuns = await LoyaltyReconciliationRun.find({ status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const latest = latestRuns[0] || null;
  const mismatchRate = latest && latest.totalUsersChecked > 0
    ? (latest.mismatchCount / latest.totalUsersChecked) * 100
    : 0;

  return {
    latestRun: latest,
    mismatchRate,
    recentRuns: latestRuns
  };
}

export default {
  runFullReconciliation,
  reconcileUser,
  getHealthSummary
};
