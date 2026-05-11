import express from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import Loyalty from '../models/Loyalty.js';
import Offer from '../models/Offer.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import LoyaltyReconciliationRun from '../models/LoyaltyReconciliationRun.js';
import LoyaltyRuleVersion from '../models/LoyaltyRuleVersion.js';
import LoyaltyBonusCampaign from '../models/LoyaltyBonusCampaign.js';
import LoyaltyOpsAlert from '../models/LoyaltyOpsAlert.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import loyaltyReconciliationService from '../services/loyaltyReconciliationService.js';
import loyaltyExpiryService from '../services/loyaltyExpiryService.js';
import { calculateStayPoints, STAY_COMPLETION_AWARD } from '../services/loyaltyAwardService.js';
import loyaltyOpsMonitoringService from '../services/loyaltyOpsMonitoringService.js';
import loyaltyEventQueueService from '../services/loyaltyEventQueueService.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Helper to check tier hierarchy (aligned with User.updateLoyaltyTier thresholds)
const TIER_VALUES = { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4 };
function getTierValue(tier) {
  return TIER_VALUES[tier] || 0;
}

function offerDateFilter() {
  const now = new Date();
  return {
    $and: [
      {
        $or: [
          { validUntil: { $gt: now } },
          { validUntil: { $exists: false } },
          { validUntil: null }
        ]
      },
      {
        $or: [
          { validFrom: { $lte: now } },
          { validFrom: { $exists: false } },
          { validFrom: null }
        ]
      }
    ]
  };
}

// Helper to check if a lean offer doc is currently valid
function isOfferValid(offer) {
  const now = new Date();
  if (!offer.isActive) return false;
  if (offer.validFrom && now < new Date(offer.validFrom)) return false;
  if (offer.validUntil && now > new Date(offer.validUntil)) return false;
  if (offer.maxRedemptions && offer.currentRedemptions >= offer.maxRedemptions) return false;
  return true;
}

// Helper to check if a user can redeem a lean offer doc
function canRedeemOffer(offer, userTier, userPoints) {
  if (!isOfferValid(offer)) return false;
  if (getTierValue(userTier) < getTierValue(offer.minTier)) return false;
  if (userPoints < offer.pointsRequired) return false;
  return true;
}

function parseBoundedInt(value, defaultValue, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function nowUtc() {
  return new Date();
}

async function getActiveRuleVersion() {
  let active = await LoyaltyRuleVersion.findOne({ isActive: true }).sort({ version: -1 }).lean();
  if (active) return active;

  const defaultRules = {
    pointsPerCurrencyUnit: Number.parseFloat(process.env.LOYALTY_POINTS_PER_CURRENCY_UNIT ?? '0.1'),
    pointsPerNight: Number.parseFloat(process.env.LOYALTY_POINTS_PER_NIGHT ?? '0'),
    maxPointsPerStay: Number.parseInt(process.env.LOYALTY_MAX_POINTS_PER_STAY ?? '50000', 10)
  };
  active = await LoyaltyRuleVersion.create({
    version: 1,
    isActive: true,
    rules: defaultRules,
    notes: 'Bootstrapped from environment defaults',
    activatedAt: nowUtc()
  });
  return active.toObject();
}

async function getPendingStayPoints(userId) {
  const checkedOutBookings = await Booking.find({
    userId,
    status: 'checked_out'
  })
    .select('_id bookingNumber totalAmount nights currency status')
    .sort({ checkOutTime: -1, updatedAt: -1 })
    .limit(50)
    .lean();

  if (!checkedOutBookings.length) return { points: 0, bookings: [] };

  const bookingIds = checkedOutBookings.map((b) => b._id);
  const awardedRows = await Loyalty.find({
    userId,
    type: 'earned',
    bookingId: { $in: bookingIds },
    'metadata.awardType': STAY_COMPLETION_AWARD
  })
    .select('bookingId')
    .lean();

  const awardedBookingIds = new Set(awardedRows.map((row) => String(row.bookingId)));
  const pendingBookings = checkedOutBookings.filter((b) => !awardedBookingIds.has(String(b._id)));

  // Load active rule version to use as cfg for point calculations
  const activeRule = await getActiveRuleVersion();
  const cfg = {
    enabled: true,
    pointsPerCurrencyUnit: activeRule?.rules?.pointsPerCurrencyUnit ?? 0.1,
    pointsPerNight: activeRule?.rules?.pointsPerNight ?? 0,
    maxPointsPerStay: activeRule?.rules?.maxPointsPerStay ?? 50000
  };

  const points = pendingBookings.reduce((sum, booking) => sum + calculateStayPoints(booking, cfg), 0);
  return {
    points,
    bookings: pendingBookings.slice(0, 10).map((booking) => ({
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      estimatedPoints: calculateStayPoints(booking, cfg)
    }))
  };
}

// Apply authentication, tenant isolation, and property access to all loyalty routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('loyalty', 'baseAccess'));

/**
 * @swagger
 * /loyalty/dashboard:
 *   get:
 *     summary: Get user loyalty dashboard
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         points:
 *                           type: number
 *                         tier:
 *                           type: string
 *                         nextTier:
 *                           type: string
 *                         pointsToNextTier:
 *                           type: number
 *                     recentTransactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Loyalty'
 *                     availableOffers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Offer'
 */
router.get('/dashboard', catchAsync(async (req, res) => {
  // Get user with loyalty data
  const user = await User.findById(req.user._id).select('+loyalty').lean();

  if (!user || !user.loyalty) {
    throw new ApplicationError('Loyalty data not found for user', 404);
  }

  // Get recent transactions (scoped to user)
  const recentTransactions = await Loyalty.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount')
    .populate('offerId', 'title category')
    .populate('hotelId', 'name').lean();

  // FIX: Use paginated query instead of static method that returns up to 1000 docs
  const userTier = user.loyalty.tier;
  const hotelId = user.hotelId;
  const tierValue = getTierValue(userTier);
  const eligibleTiers = Object.entries(TIER_VALUES)
    .filter(([, v]) => v <= tierValue)
    .map(([k]) => k);

  const availableOffers = await Offer.find({
    hotelId,
    isActive: true,
    minTier: { $in: eligibleTiers },
    ...offerDateFilter()
  })
    .sort({ pointsRequired: 1, createdAt: -1 })
    .limit(20)
    .lean();

  const [pointsExpiringSoon, pendingSummary, activeRules] = await Promise.all([
    loyaltyExpiryService.getExpiringSoonSummary(req.user._id, 30),
    getPendingStayPoints(req.user._id),
    getActiveRuleVersion()
  ]);

  res.json({
    status: 'success',
    data: {
      user: {
        points: user.loyalty.points,
        tier: user.loyalty.tier,
        nextTier: getNextTier(user.loyalty.points),
        pointsToNextTier: getPointsToNextTier(user.loyalty.points),
        pointsExpiringSoon,
        pendingPoints: pendingSummary.points,
        pendingBreakdown: pendingSummary.bookings,
        earningFormula: activeRules.rules,
        earningRuleVersion: activeRules.version
      },
      recentTransactions,
      availableOffers
    }
  });
}));

/**
 * @swagger
 * /loyalty/offers:
 *   get:
 *     summary: Get available loyalty offers
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [room, dining, spa, transport, general]
 *         description: Filter offers by category
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Available offers
 */
// FIX: Added pagination to the offers endpoint
router.get('/offers', catchAsync(async (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const parsedPage = parseBoundedInt(page, 1, 1, 10000);
  const parsedLimit = parseBoundedInt(limit, 20, 1, 100);
  const skip = (parsedPage - 1) * parsedLimit;

  const user = await User.findById(req.user._id).select('+loyalty').lean();

  if (!user || !user.loyalty) {
    throw new ApplicationError('Loyalty data not found for user', 404);
  }

  // FIX: Build proper query with hotelId and tier-based filtering instead of broken $lte string compare
  const userTier = user.loyalty.tier;
  const tierValue = getTierValue(userTier);
  const eligibleTiers = Object.entries(TIER_VALUES)
    .filter(([, v]) => v <= tierValue)
    .map(([k]) => k);

  const query = {
    hotelId: user.hotelId,
    isActive: true,
    minTier: { $in: eligibleTiers },
    ...offerDateFilter()
  };

  if (category) {
    query.category = category;
  }

  const [offers, total] = await Promise.all([
    Offer.find(query)
      .sort({ pointsRequired: 1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('hotelId', 'name')
      .lean(),
    Offer.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      offers,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit) || 1,
        totalItems: total,
        itemsPerPage: parsedLimit,
        hasNext: parsedPage * parsedLimit < total,
        hasPrev: parsedPage > 1
      }
    }
  });
}));

/**
 * @swagger
 * /loyalty/transactions:
 *   get:
 *     summary: Get user loyalty transaction history
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [earned, redeemed, expired]
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Transaction history
 */
router.get('/transactions', catchAsync(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const parsedLimit = parseBoundedInt(limit, 20, 1, 100);
  const parsedPage = parseBoundedInt(page, 1, 1, 10000);
  const skip = (parsedPage - 1) * parsedLimit;

  // Single global wallet: do not scope loyalty ledger by hotelId.
  const query = { userId: req.user._id };
  if (type) {
    query.type = type;
  }

  // Get transactions with pagination
  const [transactions, total] = await Promise.all([
    Loyalty.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount')
      .populate('offerId', 'title category')
      .populate('hotelId', 'name').lean(),
    Loyalty.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      transactions,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit) || 1,
        totalItems: total,
        itemsPerPage: parsedLimit,
        hasNext: parsedPage * parsedLimit < total,
        hasPrev: parsedPage > 1
      }
    }
  });
}));

/**
 * @swagger
 * /loyalty/redeem:
 *   post:
 *     summary: Redeem points for an offer
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - offerId
 *             properties:
 *               offerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Points redeemed successfully
 *       400:
 *         description: Invalid redemption request
 */
router.post('/redeem',
  validate(schemas.redeemPoints),
  catchAsync(async (req, res) => {
    logger.debug('Loyalty redeem - starting redemption process', { userId: req.user?._id });

    const { offerId } = req.body;
    const tenantHotelId = req.user?.hotelId || req.tenant?.hotelId;

    // FIX: Do NOT use .lean() -- we need Mongoose documents for instance methods
    const offerQuery = { _id: offerId };
    if (tenantHotelId) {
      offerQuery.hotelId = tenantHotelId;
    }
    const offer = await Offer.findOne(offerQuery);
    if (!offer) {
      logger.debug('Offer not found for redemption', { offerId });
      throw new ApplicationError('Offer not found', 404);
    }
    logger.debug('Offer found for redemption', { offerId, title: offer.title, pointsRequired: offer.pointsRequired });

    // FIX: Do NOT use .lean() -- we need the user document for .save() and .updateLoyaltyTier()
    const user = await User.findById(req.user._id).select('+loyalty');
    if (!user || !user.loyalty) {
      throw new ApplicationError('User loyalty data not found', 404);
    }
    logger.debug('User loyalty status', { userFound: !!user, points: user.loyalty.points, tier: user.loyalty.tier });

    // Validate redemption using the Mongoose document instance method
    logger.debug('Validating redemption eligibility', {
      userPoints: user.loyalty.points,
      userTier: user.loyalty.tier,
      pointsRequired: offer.pointsRequired,
      minTier: offer.minTier,
      isActive: offer.isActive,
      isValid: offer.isValid
    });

    // Check if user already redeemed this offer
    const existingRedemption = await Loyalty.findOne({
      userId: req.user._id,
      type: 'redeemed',
      offerId: offer._id
    }).lean();

    if (existingRedemption) {
      throw new ApplicationError('You have already redeemed this offer', 400);
    }

    const redeemable = offer.canRedeem(user.loyalty.tier, user.loyalty.points);

    if (!redeemable) {
      const now = new Date();
      logger.debug('Cannot redeem offer', {
        pointsCheck: user.loyalty.points >= offer.pointsRequired,
        activeCheck: offer.isActive,
        timeValid: (!offer.validUntil || now <= offer.validUntil),
        redemptionsAvailable: (!offer.maxRedemptions || offer.currentRedemptions < offer.maxRedemptions)
      });

      throw new ApplicationError('Cannot redeem this offer. Check tier requirements and available points.', 400);
    }

    // Wrap all three operations in a MongoDB transaction for atomicity.
    // If any step fails, the entire transaction is rolled back automatically.
    const session = await mongoose.startSession();
    let updatedUser;
    let loyaltyTransaction;

    try {
      await session.withTransaction(async () => {
        // 1. Deduct points from user
        updatedUser = await User.findOneAndUpdate(
          {
            _id: req.user._id,
            'loyalty.points': { $gte: offer.pointsRequired }
          },
          { $inc: { 'loyalty.points': -offer.pointsRequired } },
          { new: true, select: '+loyalty', session }
        );

        if (!updatedUser) {
          throw new ApplicationError('Insufficient points or concurrent redemption detected. Please try again.', 400);
        }

        // Update tier based on new points
        updatedUser.updateLoyaltyTier();
        await updatedUser.save({ session });

        // 2. Increment offer redemption count
        const updatedOffer = await Offer.findOneAndUpdate(
          {
            _id: offer._id,
            ...(tenantHotelId ? { hotelId: tenantHotelId } : {}),
            $or: [
              { maxRedemptions: { $exists: false } },
              { maxRedemptions: null },
              { $expr: { $lt: ['$currentRedemptions', '$maxRedemptions'] } }
            ]
          },
          { $inc: { currentRedemptions: 1 } },
          { new: true, session }
        );

        if (!updatedOffer) {
          throw new ApplicationError('This offer has reached its maximum redemption limit.', 400);
        }

        // 3. Create redemption transaction (array form required for sessions)
        const [createdTransaction] = await Loyalty.create([{
          userId: req.user._id,
          hotelId: offer.hotelId,
          type: 'redeemed',
          points: -offer.pointsRequired,
          description: `Redeemed: ${offer.title}`,
          offerId: offer._id
        }], { session });

        loyaltyTransaction = createdTransaction;
        logger.debug('Loyalty transaction created', { transactionId: loyaltyTransaction._id });
      });
    } finally {
      await session.endSession();
    }

    // Populate transaction data (outside transaction, read-only)
    await loyaltyTransaction.populate([
      { path: 'offerId', select: 'title category' },
      { path: 'hotelId', select: 'name' }
    ]);

    res.json({
      status: 'success',
      data: {
        message: 'Points redeemed successfully',
        transaction: loyaltyTransaction,
        remainingPoints: updatedUser.loyalty.points,
        newTier: updatedUser.loyalty.tier
      }
    });
  })
);

/**
 * @swagger
 * /loyalty/history:
 *   get:
 *     summary: Get loyalty transaction history
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [earned, redeemed, expired, bonus]
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Transaction history
 */
router.get('/history', catchAsync(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const parsedPage = parseBoundedInt(page, 1, 1, 10000);
  const parsedLimit = parseBoundedInt(limit, 20, 1, 100);
  const options = {
    page: parsedPage,
    limit: parsedLimit
  };

  if (type) {
    options.type = type;
  }

  const result = await Loyalty.getUserHistory(req.user._id, options);

  res.json({
    status: 'success',
    data: result
  });
}));

/**
 * @swagger
 * /loyalty/points:
 *   get:
 *     summary: Get user's current points and tier
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's loyalty status
 */
router.get('/points', catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('+loyalty').lean();

  if (!user || !user.loyalty) {
    throw new ApplicationError('Loyalty data not found for user', 404);
  }

  // Get active points (not expired)
  const activePoints = await Loyalty.getUserActivePoints(req.user._id);

  res.json({
    status: 'success',
    data: {
      totalPoints: user.loyalty.points,
      activePoints,
      tier: user.loyalty.tier,
      nextTier: getNextTier(user.loyalty.points),
      pointsToNextTier: getPointsToNextTier(user.loyalty.points)
    }
  });
}));

/**
 * @swagger
 * /loyalty/offers/{offerId}:
 *   get:
 *     summary: Get specific offer details
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Offer details
 *       404:
 *         description: Offer not found
 */
router.get('/offers/:offerId', catchAsync(async (req, res) => {
  const { offerId } = req.params;
  const tenantHotelId = req.user?.hotelId || req.tenant?.hotelId;

  // FIX: Use .lean() and local helper instead of instance method
  const offerQuery = { _id: offerId };
  if (tenantHotelId) {
    offerQuery.hotelId = tenantHotelId;
  }
  const offer = await Offer.findOne(offerQuery)
    .populate('hotelId', 'name').lean();

  if (!offer) {
    throw new ApplicationError('Offer not found', 404);
  }

  const user = await User.findById(req.user._id).select('+loyalty').lean();

  if (!user || !user.loyalty) {
    throw new ApplicationError('Loyalty data not found for user', 404);
  }

  // FIX: Use local helper function instead of instance method on lean doc
  const redeemable = canRedeemOffer(offer, user.loyalty.tier, user.loyalty.points);

  res.json({
    status: 'success',
    data: {
      offer,
      canRedeem: redeemable,
      userPoints: user.loyalty.points,
      userTier: user.loyalty.tier
    }
  });
}));

// Admin Loyalty Manager APIs
router.get('/admin/health',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (req, res) => {
    const summary = await loyaltyReconciliationService.getHealthSummary();
    const latestReconciliation = summary.latestRun;
    const latestRuns = summary.recentRuns || [];
    const latestExpiry = await Loyalty.find({
      type: 'expired'
    })
      .sort({ createdAt: -1 })
      .limit(1)
      .select('createdAt metadata points')
      .lean();

    const totalLedgerLiability = await Loyalty.aggregate([
      {
        $match: {
          $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }, { expiresAt: null }]
        }
      },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);
    const openAlerts = await LoyaltyOpsAlert.countDocuments({ status: 'open' });

    res.json({
      status: 'success',
      data: {
        totalLedgerLiability: totalLedgerLiability[0]?.total || 0,
        latestReconciliation,
        mismatchRate: summary.mismatchRate,
        latestExpiryRunAt: latestExpiry[0]?.createdAt || null,
        recentRuns: latestRuns,
        openAlerts
      }
    });
  })
);

router.get('/admin/reconciliation-runs',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (req, res) => {
    const page = parseBoundedInt(req.query.page, 1, 1, 10000);
    const limit = parseBoundedInt(req.query.limit, 20, 1, 100);
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      LoyaltyReconciliationRun.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoyaltyReconciliationRun.countDocuments({})
    ]);

    res.json({
      status: 'success',
      data: {
        runs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit) || 1,
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  })
);

router.post('/admin/reconciliation/run',
  authorizePolicy('loyalty', 'operationsRun'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const maxUsers = parseBoundedInt(req.body.maxUsers, 1000, 1, 5000);
    const result = await loyaltyReconciliationService.runFullReconciliation({ maxUsers });
    res.json({ status: 'success', data: result });
  })
);

router.post('/admin/reconcile/:userId',
  authorizePolicy('loyalty', 'walletRepair'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { userId } = req.params;
    const applyFix = Boolean(req.body.applyFix);
    const result = await loyaltyReconciliationService.reconcileUser({ userId, applyFix });
    res.json({ status: 'success', data: result });
  })
);

router.post('/admin/expiry/run',
  authorizePolicy('loyalty', 'operationsRun'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const limit = parseBoundedInt(req.body.limit, 300, 1, 2000);
    const result = await loyaltyExpiryService.runExpiryBatch({ limit });
    res.json({ status: 'success', data: result });
  })
);

router.get('/admin/alerts',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (req, res) => {
    const page = parseBoundedInt(req.query.page, 1, 1, 10000);
    const limit = parseBoundedInt(req.query.limit, 20, 1, 100);
    const status = req.query.status;
    const query = {};
    if (status) query.status = status;
    const skip = (page - 1) * limit;
    const [alerts, total] = await Promise.all([
      LoyaltyOpsAlert.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LoyaltyOpsAlert.countDocuments(query)
    ]);
    res.json({
      status: 'success',
      data: {
        alerts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit) || 1,
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  })
);

router.post('/admin/alerts/evaluate',
  authorizePolicy('loyalty', 'operationsRun'),
  validate(mutationBaselineSchema),
  catchAsync(async (_req, res) => {
    const alerts = await loyaltyOpsMonitoringService.evaluateSlaAlerts();
    res.json({ status: 'success', data: { createdOrUpdated: alerts.length, alerts } });
  })
);

router.post('/admin/alerts/:alertId/ack',
  authorizePolicy('loyalty', 'operationsRun'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const alert = await LoyaltyOpsAlert.findByIdAndUpdate(
      req.params.alertId,
      {
        $set: {
          status: 'acknowledged',
          acknowledgedBy: req.user._id,
          acknowledgedAt: nowUtc()
        }
      },
      { new: true }
    );
    if (!alert) throw new ApplicationError('Alert not found', 404);
    res.json({ status: 'success', data: alert });
  })
);

router.post('/admin/queue/enqueue',
  authorizePolicy('loyalty', 'operationsRun'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const type = req.body.type;
    if (!type) throw new ApplicationError('type is required', 400);
    const result = await loyaltyEventQueueService.enqueue(type, req.body.payload || {}, { requestedBy: req.user._id });
    res.json({ status: 'success', data: result });
  })
);

router.get('/admin/queue/stats',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (_req, res) => {
    const depth = await loyaltyEventQueueService.getDepth();
    res.json({ status: 'success', data: { depth } });
  })
);

router.get('/admin/rules',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (_req, res) => {
    const versions = await LoyaltyRuleVersion.find({}).sort({ version: -1 }).limit(20).lean();
    const active = versions.find((v) => v.isActive) || null;
    res.json({ status: 'success', data: { active, versions } });
  })
);

router.post('/admin/rules',
  authorizePolicy('loyalty', 'rulesManage'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const pointsPerCurrencyUnit = Number.parseFloat(req.body?.rules?.pointsPerCurrencyUnit ?? req.body?.pointsPerCurrencyUnit ?? 0.1);
    const pointsPerNight = Number.parseFloat(req.body?.rules?.pointsPerNight ?? req.body?.pointsPerNight ?? 0);
    const maxPointsPerStay = parseBoundedInt(req.body?.rules?.maxPointsPerStay ?? req.body?.maxPointsPerStay, 50000, 1, 2000000);
    if (!Number.isFinite(pointsPerCurrencyUnit) || pointsPerCurrencyUnit < 0) {
      throw new ApplicationError('Invalid pointsPerCurrencyUnit', 400);
    }
    if (!Number.isFinite(pointsPerNight) || pointsPerNight < 0) {
      throw new ApplicationError('Invalid pointsPerNight', 400);
    }

    const latest = await LoyaltyRuleVersion.findOne({}).sort({ version: -1 }).lean();
    const nextVersion = (latest?.version || 0) + 1;

    await LoyaltyRuleVersion.updateMany({ isActive: true }, { $set: { isActive: false } });
    const created = await LoyaltyRuleVersion.create({
      version: nextVersion,
      isActive: true,
      activatedAt: nowUtc(),
      notes: req.body?.notes || '',
      createdBy: req.user._id,
      rules: { pointsPerCurrencyUnit, pointsPerNight, maxPointsPerStay }
    });

    res.json({ status: 'success', data: created });
  })
);

router.post('/admin/rules/simulate',
  authorizePolicy('loyalty', 'simulationAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const sampleUsers = parseBoundedInt(req.body.sampleUsers, 100, 1, 5000);
    const avgStayAmount = Number.parseFloat(req.body.avgStayAmount ?? 5000);
    const avgNights = Number.parseFloat(req.body.avgNights ?? 2);
    const monthlyCompletedStays = parseBoundedInt(req.body.monthlyCompletedStays, 1000, 1, 1000000);
    const current = await getActiveRuleVersion();

    const candidateRules = {
      pointsPerCurrencyUnit: Number.parseFloat(req.body?.rules?.pointsPerCurrencyUnit ?? current.rules.pointsPerCurrencyUnit),
      pointsPerNight: Number.parseFloat(req.body?.rules?.pointsPerNight ?? current.rules.pointsPerNight),
      maxPointsPerStay: parseBoundedInt(req.body?.rules?.maxPointsPerStay, current.rules.maxPointsPerStay, 1, 2000000)
    };

    const perStayCurrent = Math.min(
      Math.floor(avgStayAmount * current.rules.pointsPerCurrencyUnit) + Math.floor(avgNights * current.rules.pointsPerNight),
      current.rules.maxPointsPerStay
    );
    const perStayCandidate = Math.min(
      Math.floor(avgStayAmount * candidateRules.pointsPerCurrencyUnit) + Math.floor(avgNights * candidateRules.pointsPerNight),
      candidateRules.maxPointsPerStay
    );

    const projectedMonthlyCurrent = perStayCurrent * monthlyCompletedStays;
    const projectedMonthlyCandidate = perStayCandidate * monthlyCompletedStays;

    res.json({
      status: 'success',
      data: {
        assumptions: { sampleUsers, avgStayAmount, avgNights, monthlyCompletedStays },
        currentRules: current.rules,
        candidateRules,
        projection: {
          pointsPerStayCurrent: perStayCurrent,
          pointsPerStayCandidate: perStayCandidate,
          monthlyLiabilityCurrent: projectedMonthlyCurrent,
          monthlyLiabilityCandidate: projectedMonthlyCandidate,
          delta: projectedMonthlyCandidate - projectedMonthlyCurrent
        }
      }
    });
  })
);

router.get('/admin/campaigns',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (req, res) => {
    const page = parseBoundedInt(req.query.page, 1, 1, 10000);
    const limit = parseBoundedInt(req.query.limit, 20, 1, 100);
    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      LoyaltyBonusCampaign.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LoyaltyBonusCampaign.countDocuments({})
    ]);
    res.json({
      status: 'success',
      data: {
        campaigns,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit) || 1,
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  })
);

router.post('/admin/campaigns',
  authorizePolicy('loyalty', 'campaignManage'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const startsAt = new Date(req.body.startsAt);
    const endsAt = new Date(req.body.endsAt);
    if (!req.body.name || !req.body.code) throw new ApplicationError('name and code are required', 400);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new ApplicationError('Invalid campaign date range', 400);
    }
    const campaign = await LoyaltyBonusCampaign.create({
      name: req.body.name,
      code: String(req.body.code).toUpperCase(),
      points: parseBoundedInt(req.body.points, 100, 1, 1000000),
      startsAt,
      endsAt,
      maxTotalAwards: parseBoundedInt(req.body.maxTotalAwards, 100000, 1, 10000000),
      maxAwardsPerUser: parseBoundedInt(req.body.maxAwardsPerUser, 1, 1, 1000),
      isActive: req.body.isActive !== false,
      metadata: req.body.metadata || {},
      createdBy: req.user._id
    });
    res.json({ status: 'success', data: campaign });
  })
);

router.post('/admin/campaigns/:campaignId/award',
  authorizePolicy('loyalty', 'campaignManage'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { campaignId } = req.params;
    const { userId, reference } = req.body;
    if (!userId) throw new ApplicationError('userId is required', 400);

    const campaign = await LoyaltyBonusCampaign.findById(campaignId);
    if (!campaign) throw new ApplicationError('Campaign not found', 404);
    const now = nowUtc();
    if (!campaign.isActive || now < campaign.startsAt || now > campaign.endsAt) {
      throw new ApplicationError('Campaign is not active right now', 400);
    }
    if (campaign.totalAwardsCount >= campaign.maxTotalAwards) {
      throw new ApplicationError('Campaign total award cap reached', 400);
    }

    const userAwardCount = await Loyalty.countDocuments({
      userId,
      type: 'bonus',
      'metadata.campaignId': campaign._id
    });
    if (userAwardCount >= campaign.maxAwardsPerUser) {
      throw new ApplicationError('User bonus cap reached for this campaign', 400);
    }

    if (reference) {
      const dup = await Loyalty.findOne({
        userId,
        type: 'bonus',
        'metadata.campaignId': campaign._id,
        'metadata.reference': reference
      }).lean();
      if (dup) {
        return res.json({ status: 'success', data: { duplicate: true, transaction: dup } });
      }
    }

    const user = await User.findByIdAndUpdate(userId, { $inc: { 'loyalty.points': campaign.points } }, { new: true, select: '+loyalty' });
    if (!user) throw new ApplicationError('User not found', 404);
    user.updateLoyaltyTier();
    await user.save();

    const tx = await Loyalty.create({
      userId: user._id,
      hotelId: user.hotelId,
      type: 'bonus',
      points: campaign.points,
      description: `Campaign bonus: ${campaign.name}`,
      metadata: {
        campaignId: campaign._id,
        campaignCode: campaign.code,
        reference: reference || null
      }
    });

    campaign.totalAwardsCount += 1;
    await campaign.save();

    res.json({
      status: 'success',
      data: { transaction: tx, remainingCampaignAwards: Math.max(campaign.maxTotalAwards - campaign.totalAwardsCount, 0) }
    });
  })
);

router.get('/admin/compliance/retention-report',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (req, res) => {
    const months = parseBoundedInt(req.query.months, 12, 1, 60);
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const stats = await Loyalty.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            y: { $year: '$createdAt' },
            m: { $month: '$createdAt' },
            type: '$type'
          },
          count: { $sum: 1 },
          points: { $sum: '$points' }
        }
      },
      { $sort: { '_id.y': -1, '_id.m': -1 } }
    ]);

    res.json({
      status: 'success',
      data: {
        periodMonths: months,
        rows: stats.map((s) => ({
          year: s._id.y,
          month: s._id.m,
          type: s._id.type,
          count: s.count,
          points: s.points
        }))
      }
    });
  })
);

router.get('/admin/finance/monthly-liability',
  authorizePolicy('loyalty', 'simulationAccess'),
  catchAsync(async (req, res) => {
    const year = parseBoundedInt(req.query.year, new Date().getFullYear(), 2000, 2100);
    const month = parseBoundedInt(req.query.month, new Date().getMonth() + 1, 1, 12);
    const format = req.query.format || 'json';

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const [issuance, redemption, expiry] = await Promise.all([
      Loyalty.aggregate([
        { $match: { type: { $in: ['earned', 'bonus'] }, createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: '$type', points: { $sum: '$points' }, count: { $sum: 1 } } }
      ]),
      Loyalty.aggregate([
        { $match: { type: 'redeemed', createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: '$type', points: { $sum: '$points' }, count: { $sum: 1 } } }
      ]),
      Loyalty.aggregate([
        { $match: { type: 'expired', createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: '$type', points: { $sum: '$points' }, count: { $sum: 1 } } }
      ])
    ]);

    const liability = await Loyalty.aggregate([
      {
        $match: {
          $or: [{ expiresAt: { $gt: end } }, { expiresAt: { $exists: false } }, { expiresAt: null }],
          createdAt: { $lt: end }
        }
      },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);

    const data = {
      period: { year, month },
      issuance,
      redemption,
      expiry,
      closingLiabilityPoints: liability[0]?.total || 0
    };

    if (format === 'csv') {
      const rows = [
        ['metric', 'value'],
        ['year', String(year)],
        ['month', String(month)],
        ['closingLiabilityPoints', String(data.closingLiabilityPoints)],
        ...issuance.map((x) => [`issuance_${x._id}_points`, String(x.points)]),
        ...redemption.map((x) => [`redemption_${x._id}_points`, String(x.points)]),
        ...expiry.map((x) => [`expiry_${x._id}_points`, String(x.points)])
      ];
      const csv = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=\"loyalty-liability-${year}-${String(month).padStart(2, '0')}.csv\"`);
      return res.send(csv);
    }

    res.json({ status: 'success', data });
  })
);

// Tier thresholds — must match User.updateLoyaltyTier() in models/User.js
const TIER_THRESHOLDS = {
  diamond: 25000,
  platinum: 10000,
  gold: 5000,
  silver: 1000,
  bronze: 0
};

// Helper functions
function getNextTier(points) {
  if (points >= TIER_THRESHOLDS.diamond) return null;
  if (points >= TIER_THRESHOLDS.platinum) return 'diamond';
  if (points >= TIER_THRESHOLDS.gold) return 'platinum';
  if (points >= TIER_THRESHOLDS.silver) return 'gold';
  return 'silver';
}

function getPointsToNextTier(points) {
  if (points >= TIER_THRESHOLDS.diamond) return 0;
  if (points >= TIER_THRESHOLDS.platinum) return TIER_THRESHOLDS.diamond - points;
  if (points >= TIER_THRESHOLDS.gold) return TIER_THRESHOLDS.platinum - points;
  if (points >= TIER_THRESHOLDS.silver) return TIER_THRESHOLDS.gold - points;
  return TIER_THRESHOLDS.silver - points;
}

export default router;
