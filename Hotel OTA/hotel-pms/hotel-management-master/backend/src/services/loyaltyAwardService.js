import mongoose from 'mongoose';
import User from '../models/User.js';
import Loyalty from '../models/Loyalty.js';
import Notification from '../models/Notification.js';
import LoyaltyRuleVersion from '../models/LoyaltyRuleVersion.js';
import logger from '../utils/logger.js';

export const STAY_COMPLETION_AWARD = 'stay_completion';

let cachedRuleVersion = null;
let cacheExpiry = 0;

async function readAwardConfig(hotelId) {
  // Check cache first (5 minute TTL)
  const now = Date.now();
  if (cachedRuleVersion && cacheExpiry > now) {
    return cachedRuleVersion;
  }

  try {
    // Try to read active rule version from database
    const query = { isActive: true };
    if (hotelId) query.hotelId = hotelId;
    const activeRule = await LoyaltyRuleVersion.findOne(query).sort({ version: -1 }).lean();

    if (activeRule && activeRule.rules) {
      const enabled = process.env.LOYALTY_AWARD_ON_CHECKOUT !== 'false';
      const perUnit = activeRule.rules.pointsPerCurrencyUnit ?? 0.1;
      const perNight = activeRule.rules.pointsPerNight ?? 0;
      const maxPerStay = activeRule.rules.maxPointsPerStay ?? 50000;
      const config = {
        enabled: Number.isFinite(perUnit) && perUnit >= 0 ? enabled : false,
        pointsPerCurrencyUnit: Number.isFinite(perUnit) && perUnit >= 0 ? perUnit : 0.1,
        pointsPerNight: Number.isFinite(perNight) && perNight >= 0 ? perNight : 0,
        maxPointsPerStay: Number.isFinite(maxPerStay) && maxPerStay > 0 ? maxPerStay : 50000,
        tierMultipliers: activeRule.rules.tierMultipliers || {
          bronze: 1, silver: 1.25, gold: 1.5, platinum: 2, diamond: 2.5
        }
      };
      cachedRuleVersion = config;
      cacheExpiry = now + 5 * 60 * 1000; // 5 min cache
      return config;
    }
  } catch (err) {
    logger.warn('Failed to load loyalty rules from DB, falling back to env vars:', err.message);
  }

  // Fallback to environment variables
  const enabled = process.env.LOYALTY_AWARD_ON_CHECKOUT !== 'false';
  const perUnit = Number.parseFloat(process.env.LOYALTY_POINTS_PER_CURRENCY_UNIT ?? '0.1');
  const perNight = Number.parseFloat(process.env.LOYALTY_POINTS_PER_NIGHT ?? '0');
  const maxPerStay = Number.parseInt(process.env.LOYALTY_MAX_POINTS_PER_STAY ?? '50000', 10);
  const config = {
    enabled: Number.isFinite(perUnit) && perUnit >= 0 ? enabled : false,
    pointsPerCurrencyUnit: Number.isFinite(perUnit) && perUnit >= 0 ? perUnit : 0.1,
    pointsPerNight: Number.isFinite(perNight) && perNight >= 0 ? perNight : 0,
    maxPointsPerStay: Number.isFinite(maxPerStay) && maxPerStay > 0 ? maxPerStay : 50000,
    tierMultipliers: {
      bronze: 1, silver: 1.25, gold: 1.5, platinum: 2, diamond: 2.5
    }
  };
  cachedRuleVersion = config;
  cacheExpiry = now + 5 * 60 * 1000;
  return config;
}

/**
 * Calculate points for a completed stay (checkout). Uses booking total and nights.
 */
export function calculateStayPoints(booking, cfg) {
  if (!cfg) {
    throw new Error('cfg parameter is required — readAwardConfig() is now async, caller must await and pass the result');
  }
  const totalAmount = Math.max(0, Number(booking.totalAmount) || 0);
  const nights = Math.max(1, Number(booking.nights) || 1);

  let points = Math.floor(totalAmount * cfg.pointsPerCurrencyUnit);
  points += Math.floor(nights * cfg.pointsPerNight);
  points = Math.min(points, cfg.maxPointsPerStay);

  return Math.max(0, points);
}

/**
 * Award loyalty points once per booking on successful checkout.
 * Idempotent: second call is a no-op. Does not throw on failure (logs + returns).
 *
 * @param {import('mongoose').Document | object} bookingDoc — booking after checkout (must include _id, userId, hotelId, totalAmount, nights, bookingNumber)
 * @returns {Promise<{ awarded: boolean, points?: number, reason?: string, loyaltyTransactionId?: import('mongoose').Types.ObjectId }>}
 */
export async function awardStayCompletionPoints(bookingDoc) {
  const cfg = await readAwardConfig();
  if (!cfg.enabled) {
    return { awarded: false, reason: 'disabled' };
  }

  const rawUserId = bookingDoc.userId?._id ?? bookingDoc.userId;
  if (!rawUserId || !mongoose.Types.ObjectId.isValid(rawUserId)) {
    return { awarded: false, reason: 'no_guest_user' };
  }

  const userId = new mongoose.Types.ObjectId(rawUserId);
  const rawHotelId = bookingDoc.hotelId?._id ?? bookingDoc.hotelId;
  if (!rawHotelId || !mongoose.Types.ObjectId.isValid(rawHotelId)) {
    return { awarded: false, reason: 'no_hotel' };
  }
  const hotelId = new mongoose.Types.ObjectId(rawHotelId);

  const bookingId = bookingDoc._id;
  if (!bookingId) {
    return { awarded: false, reason: 'no_booking_id' };
  }
  if (bookingDoc.status !== 'checked_out') {
    return { awarded: false, reason: 'booking_not_checked_out' };
  }

  const points = calculateStayPoints(bookingDoc, cfg);
  if (points < 1) {
    return { awarded: false, reason: 'zero_points' };
  }

  const bookingNumber = bookingDoc.bookingNumber || String(bookingId);
  const description = `Points for stay — booking ${bookingNumber}`;

  const session = await mongoose.startSession();
  let createdTxId;
  let duplicateSkip = false;

  try {
    await session.withTransaction(async () => {
      const duplicate = await Loyalty.findOne({
        userId,
        bookingId,
        type: 'earned',
        'metadata.awardType': STAY_COMPLETION_AWARD
      })
        .session(session)
        .lean();

      if (duplicate) {
        duplicateSkip = true;
        return;
      }

      const incResult = await User.findOneAndUpdate(
        { _id: userId },
        { $inc: { 'loyalty.points': points } },
        { new: true, session, select: '+loyalty' }
      );

      if (!incResult) {
        throw new Error('User not found for loyalty award');
      }

      incResult.updateLoyaltyTier();
      await incResult.save({ session });

      const [tx] = await Loyalty.create(
        [
          {
            userId,
            hotelId,
            type: 'earned',
            points,
            description,
            bookingId,
            metadata: {
              awardType: STAY_COMPLETION_AWARD,
              sourceEvent: 'booking_checked_out',
              sourceId: String(bookingId),
              bookingNumber,
              currency: bookingDoc.currency || 'INR',
              totalAmount: bookingDoc.totalAmount,
              nights: bookingDoc.nights
            }
          }
        ],
        { session }
      );

      createdTxId = tx._id;
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return { awarded: false, reason: 'already_awarded' };
    }
    logger.error('Loyalty award failed', {
      error: err.message,
      bookingId: String(bookingId),
      userId: String(userId)
    });
    return { awarded: false, reason: 'error', error: err.message };
  } finally {
    await session.endSession();
  }

  if (duplicateSkip) {
    return { awarded: false, reason: 'already_awarded' };
  }

  await notifyGuestLoyaltyEarned({
    userId,
    hotelId,
    points,
    bookingNumber,
    loyaltyTransactionId: createdTxId
  }).catch((err) => {
    logger.warn('Loyalty in-app notification failed', { error: err.message, userId: String(userId) });
  });

  try {
    const websocketService = (await import('./websocketService.js')).default;
    const user = await User.findById(userId).select('loyalty').lean();
    websocketService.sendToUser(String(userId), 'loyalty:points_awarded', {
      points,
      bookingId: String(bookingId),
      bookingNumber,
      loyaltyTransactionId: String(createdTxId),
      tier: user?.loyalty?.tier
    });
  } catch (wsErr) {
    logger.debug('Loyalty WebSocket notify skipped', { error: wsErr.message });
  }

  logger.info('Loyalty points awarded for stay completion', {
    userId: String(userId),
    bookingId: String(bookingId),
    points,
    loyaltyTransactionId: String(createdTxId)
  });

  return { awarded: true, points, loyaltyTransactionId: createdTxId };
}

async function notifyGuestLoyaltyEarned({ userId, hotelId, points, bookingNumber, loyaltyTransactionId }) {
  const { createAndDeliverInApp } = await import('./inAppNotificationDeliveryService.js');
  await createAndDeliverInApp({
    userId,
    hotelId,
    type: 'loyalty_points',
    title: 'You earned loyalty points',
    message: `+${points} points for completing stay ${bookingNumber}.`,
    channels: ['in_app', 'push'],
    priority: 'medium',
    metadata: {
      category: 'loyalty',
      loyaltyTransactionId,
      points,
      bookingNumber
    }
  });
}

export default {
  awardStayCompletionPoints,
  calculateStayPoints,
  STAY_COMPLETION_AWARD
};
