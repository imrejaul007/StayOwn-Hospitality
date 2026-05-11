import mongoose from 'mongoose';
import Loyalty from '../models/Loyalty.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const BATCH_LIMIT = 300;

async function runExpiryBatch({ now = new Date(), limit = BATCH_LIMIT } = {}) {
  const expiredEarnedRows = await Loyalty.find({
    type: 'earned',
    points: { $gt: 0 },
    expiresAt: { $lte: now },
    'metadata.awardType': { $exists: true },
    'metadata.expiryProcessedAt': { $exists: false }
  })
    .sort({ expiresAt: 1 })
    .limit(Math.min(Math.max(1, Number(limit) || BATCH_LIMIT), 2000))
    .lean();

  let processed = 0;
  let skipped = 0;

  for (const earnedTx of expiredEarnedRows) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const duplicate = await Loyalty.findOne({
          userId: earnedTx.userId,
          type: 'expired',
          'metadata.expirySourceTxId': String(earnedTx._id)
        })
          .session(session)
          .lean();

        if (duplicate) {
          skipped += 1;
          await Loyalty.updateOne(
            { _id: earnedTx._id },
            { $set: { 'metadata.expiryProcessedAt': now } },
            { session }
          );
          return;
        }

        const expiryPoints = -Math.abs(Number(earnedTx.points || 0));
        if (expiryPoints === 0) {
          skipped += 1;
          await Loyalty.updateOne(
            { _id: earnedTx._id },
            { $set: { 'metadata.expiryProcessedAt': now } },
            { session }
          );
          return;
        }

        await Loyalty.create(
          [
            {
              userId: earnedTx.userId,
              hotelId: earnedTx.hotelId,
              type: 'expired',
              points: expiryPoints,
              description: `Points expired: ${earnedTx.description || 'Loyalty points'}`,
              bookingId: earnedTx.bookingId,
              metadata: {
                expirySourceTxId: String(earnedTx._id),
                sourceAwardType: earnedTx.metadata?.awardType || 'unknown',
                expiredAt: now.toISOString()
              }
            }
          ],
          { session }
        );

        const user = await User.findByIdAndUpdate(
          earnedTx.userId,
          { $inc: { 'loyalty.points': expiryPoints } },
          { new: true, session, select: '+loyalty' }
        );
        if (user) {
          user.updateLoyaltyTier();
          await user.save({ session });
        }

        await Loyalty.updateOne(
          { _id: earnedTx._id },
          { $set: { 'metadata.expiryProcessedAt': now } },
          { session }
        );

        processed += 1;
      });
    } catch (error) {
      logger.error('Loyalty expiry row processing failed', {
        earnedTxId: String(earnedTx._id),
        userId: String(earnedTx.userId),
        error: error.message
      });
    } finally {
      await session.endSession();
    }
  }

  return {
    scanned: expiredEarnedRows.length,
    processed,
    skipped,
    runAt: now
  };
}

async function getExpiringSoonSummary(userId, days = 30) {
  const now = new Date();
  const threshold = new Date(now.getTime() + Math.max(1, days) * 24 * 60 * 60 * 1000);

  const rows = await Loyalty.find({
    userId,
    type: 'earned',
    points: { $gt: 0 },
    expiresAt: { $gt: now, $lte: threshold }
  })
    .select('points expiresAt description metadata')
    .sort({ expiresAt: 1 })
    .limit(20)
    .lean();

  return {
    totalPoints: rows.reduce((sum, row) => sum + (row.points || 0), 0),
    items: rows.map((row) => ({
      points: row.points,
      expiresAt: row.expiresAt,
      description: row.description,
      awardType: row.metadata?.awardType || null
    }))
  };
}

export default {
  runExpiryBatch,
  getExpiringSoonSummary
};
