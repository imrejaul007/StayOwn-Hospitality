import express from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import OfferFavorite from '../models/OfferFavorite.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication, tenant isolation, and property access to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * Get personalized recommendations (must be before /:param routes)
 */
router.get('/recommendations', authorizePolicy('offerFavorites', 'memberAccess'), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { limit = 12, excludeFavorites = 'true' } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 12, 50);

    const recommendations = await OfferFavorite.getUserRecommendations(userId, {
        limit: parsedLimit,
        excludeFavorites: excludeFavorites !== 'false',
        hotelId: req.user.hotelId
    });

    res.status(200).json({
        status: 'success',
        data: recommendations
    });
}));

/**
 * Get popular offers (must be before /:param routes)
 */
router.get('/popular', authorizePolicy('offerFavorites', 'memberAccess'), catchAsync(async (req, res) => {
    const { limit = 12, category, timeframe = 'month', minFavorites = 1 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 12, 50);

    const popular = await OfferFavorite.getPopularOffers({
        limit: parsedLimit,
        category: category || undefined,
        timeframe: timeframe || undefined,
        minFavorites: parseInt(minFavorites) || 1,
        hotelId: req.user.hotelId
    });

    res.status(200).json({
        status: 'success',
        data: popular
    });
}));

/**
 * Get favorites statistics (must be before /:param routes)
 */
router.get('/stats', authorizePolicy('offerFavorites', 'memberAccess'), catchAsync(async (req, res) => {
    const userId = req.user._id;

    const pipeline = [
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $lookup: {
                from: 'offers',
                localField: 'offerId',
                foreignField: '_id',
                as: 'offer'
            }
        },
        { $unwind: { path: '$offer', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: null,
                totalFavorites: { $sum: 1 },
                avgPointsRequired: { $avg: { $ifNull: ['$offer.pointsRequired', 0] } },
                categories: { $addToSet: '$offer.category' },
                types: { $addToSet: '$offer.type' },
                categoryList: { $push: '$offer.category' },
                typeList: { $push: '$offer.type' },
                earliestFavorite: { $min: '$createdAt' }
            }
        }
    ];

    const result = await OfferFavorite.aggregate(pipeline);
    const stats = result[0];

    if (!stats) {
        return res.status(200).json({
            status: 'success',
            data: {
                totalFavorites: 0,
                categoryBreakdown: {},
                typeBreakdown: {},
                avgPointsRequired: 0,
                daysSinceFavoriting: 0
            }
        });
    }

    // Build breakdowns
    const categoryBreakdown = {};
    (stats.categoryList || []).forEach(cat => {
        if (cat) categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    const typeBreakdown = {};
    (stats.typeList || []).forEach(t => {
        if (t) typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    });

    const daysSinceFavoriting = stats.earliestFavorite
        ? Math.floor((Date.now() - new Date(stats.earliestFavorite).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    res.status(200).json({
        status: 'success',
        data: {
            totalFavorites: stats.totalFavorites || 0,
            categoryBreakdown,
            typeBreakdown,
            avgPointsRequired: Math.round(stats.avgPointsRequired || 0),
            daysSinceFavoriting
        }
    });
}));

/**
 * Check if offer is in favorites (must be before /:param routes)
 */
router.get('/check/:offerId', authorizePolicy('offerFavorites', 'memberAccess'), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { offerId } = req.params;

    const favorite = await OfferFavorite.findOne({ userId, offerId }).lean();

    res.status(200).json({
        status: 'success',
        data: {
            isFavorite: !!favorite,
            favorite: favorite || null
        }
    });
}));

/**
 * Get user's favorite offers
 */
router.get('/', authorizePolicy('offerFavorites', 'memberAccess'), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const {
        page = 1,
        limit = 20,
        category,
        type,
        sortBy = 'createdAt',
        sortOrder = -1
    } = req.query;

    const clampedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const pageNum = Math.max(parseInt(page) || 1, 1);

    const result = await OfferFavorite.getUserFavorites(userId, {
        page: pageNum,
        limit: clampedLimit,
        category,
        type,
        sortBy,
        sortOrder: parseInt(sortOrder) || -1
    });

    // FIX: Return nested structure that frontend expects: { data: { favorites, pagination } }
    res.status(200).json({
        status: 'success',
        data: {
            favorites: result.favorites,
            pagination: result.pagination
        }
    });
}));

/**
 * Add offer to favorites (supports both body and param offerId)
 */
router.post('/', authorizePolicy('offerFavorites', 'memberAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { offerId, notifyOnExpiry, notifyOnUpdate, notes } = req.body;

    if (!offerId) {
        throw new ApplicationError('offerId is required', 400);
    }

    // Check if already favorited
    const existing = await OfferFavorite.findOne({ userId, offerId }).lean();
    if (existing) {
        return res.status(409).json({
            status: 'error',
            message: 'Offer is already in favorites'
        });
    }

    const favorite = await OfferFavorite.create({
        userId,
        offerId,
        notifyOnExpiry: notifyOnExpiry !== undefined ? notifyOnExpiry : true,
        notifyOnUpdate: notifyOnUpdate !== undefined ? notifyOnUpdate : false,
        notes
    });

    const populated = await OfferFavorite.findById(favorite._id)
        .populate({ path: 'offerId', select: 'title description pointsRequired type category validUntil discountPercentage discountAmount' })
        .lean();

    res.status(201).json({
        status: 'success',
        message: 'Offer added to favorites',
        data: populated
    });
}));

router.post('/:offerId', authorizePolicy('offerFavorites', 'memberAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { offerId } = req.params;
    const { notifyOnExpiry, notifyOnUpdate, notes } = req.body;

    // Check if already favorited
    const existing = await OfferFavorite.findOne({ userId, offerId }).lean();
    if (existing) {
        return res.status(409).json({
            status: 'error',
            message: 'Offer is already in favorites'
        });
    }

    const favorite = await OfferFavorite.create({
        userId,
        offerId,
        notifyOnExpiry: notifyOnExpiry !== undefined ? notifyOnExpiry : true,
        notifyOnUpdate: notifyOnUpdate !== undefined ? notifyOnUpdate : false,
        notes
    });

    const populated = await OfferFavorite.findById(favorite._id)
        .populate({ path: 'offerId', select: 'title description pointsRequired type category validUntil discountPercentage discountAmount' })
        .lean();

    res.status(201).json({
        status: 'success',
        message: 'Offer added to favorites',
        data: populated
    });
}));

/**
 * Update favorite settings
 */
router.put('/:favoriteId', authorizePolicy('offerFavorites', 'memberAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { favoriteId } = req.params;
    const { notifyOnExpiry, notifyOnUpdate, notes } = req.body;

    const favorite = await OfferFavorite.findOne({ _id: favoriteId, userId });

    if (!favorite) {
        throw new ApplicationError('Favorite not found', 404);
    }

    if (notifyOnExpiry !== undefined) favorite.notifyOnExpiry = notifyOnExpiry;
    if (notifyOnUpdate !== undefined) favorite.notifyOnUpdate = notifyOnUpdate;
    if (notes !== undefined) favorite.notes = notes;

    await favorite.save();

    const populated = await OfferFavorite.findById(favorite._id)
        .populate({ path: 'offerId', select: 'title description pointsRequired type category validUntil discountPercentage discountAmount' })
        .lean();

    res.status(200).json({
        status: 'success',
        data: populated
    });
}));

/**
 * Remove offer from favorites by offer ID
 */
router.delete('/offer/:offerId', authorizePolicy('offerFavorites', 'memberAccess'), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { offerId } = req.params;

    const deleted = await OfferFavorite.findOneAndDelete({ userId, offerId });

    if (!deleted) {
        return res.status(404).json({
            status: 'error',
            message: 'Offer not found in favorites'
        });
    }

    res.status(200).json({
        status: 'success',
        message: 'Offer removed from favorites'
    });
}));

/**
 * Remove from favorites by favorite ID or offer ID
 */
router.delete('/:id', authorizePolicy('offerFavorites', 'memberAccess'), catchAsync(async (req, res) => {
    const userId = req.user._id;
    const { id } = req.params;

    // Try deleting by favorite _id first, then by offerId
    let deleted = await OfferFavorite.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
        deleted = await OfferFavorite.findOneAndDelete({ userId, offerId: id });
    }

    if (!deleted) {
        return res.status(404).json({
            status: 'error',
            message: 'Favorite not found'
        });
    }

    res.status(200).json({
        status: 'success',
        message: 'Offer removed from favorites'
    });
}));

export default router;