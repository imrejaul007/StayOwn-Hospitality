"use strict";
/**
 * Guest Feedback Service
 *
 * Handles post-stay survey collection, service ratings, and text comments
 * for the StayOwn hotel booking platform.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackService = exports.Feedback = void 0;
exports.submitFeedback = submitFeedback;
exports.getFeedbackByBookingId = getFeedbackByBookingId;
exports.getHotelRatings = getHotelRatings;
exports.getHotelFeedbackList = getHotelFeedbackList;
exports.getFeedbackResponseRate = getFeedbackResponseRate;
exports.deleteFeedback = deleteFeedback;
const mongoose_1 = __importDefault(require("mongoose"));
// ─── MongoDB Schema ─────────────────────────────────────────────────────────────
const ServiceRatingSchema = new mongoose_1.default.Schema({
    category: {
        type: String,
        required: true,
        enum: ['cleanliness', 'staff', 'amenities', 'food', 'location', 'value', 'checkin', 'checkout'],
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
}, { _id: false });
const FeedbackSchema = new mongoose_1.default.Schema({
    bookingId: {
        type: String,
        required: true,
        index: true,
    },
    hotelId: {
        type: String,
        required: true,
        index: true,
    },
    guestId: {
        type: String,
        required: true,
        index: true,
    },
    guestName: {
        type: String,
    },
    guestEmail: {
        type: String,
    },
    overallRating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        index: true,
    },
    serviceRatings: {
        type: [ServiceRatingSchema],
        default: [],
    },
    textComment: {
        type: String,
        maxlength: 2000,
    },
    textLanguage: {
        type: String,
        enum: ['en', 'hi', 'other'],
        default: 'en',
    },
    recommendLikelihood: {
        type: Number,
        required: true,
        min: 0,
        max: 10,
    },
    stayType: {
        type: String,
        required: true,
        enum: ['business', 'leisure', 'family', 'couple', 'solo'],
    },
    roomType: {
        type: String,
    },
    source: {
        type: String,
        required: true,
        enum: ['post_stay_email', 'checkout_screen', 'in_stay', 'app_survey'],
    },
    deviceType: {
        type: String,
        enum: ['ios', 'android', 'web'],
    },
    isAnonymous: {
        type: Boolean,
        default: false,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, { timestamps: true });
// Compound indexes for common queries
FeedbackSchema.index({ hotelId: 1, submittedAt: -1 });
FeedbackSchema.index({ hotelId: 1, overallRating: -1 });
FeedbackSchema.index({ bookingId: 1 }, { unique: true }); // One feedback per booking
// ─── Model ─────────────────────────────────────────────────────────────────────
exports.Feedback = mongoose_1.default.models.Feedback || mongoose_1.default.model('Feedback', FeedbackSchema);
// ─── Service Functions ─────────────────────────────────────────────────────────
/**
 * Submit guest feedback
 */
async function submitFeedback(input) {
    try {
        // Check if feedback already exists for this booking
        const existing = await exports.Feedback.findOne({ bookingId: input.bookingId });
        if (existing) {
            // Update existing feedback
            existing.overallRating = input.overallRating;
            existing.serviceRatings = input.serviceRatings;
            existing.textComment = input.textComment;
            existing.textLanguage = input.textLanguage;
            existing.recommendLikelihood = input.recommendLikelihood;
            existing.stayType = input.stayType;
            existing.roomType = input.roomType;
            existing.submittedAt = new Date();
            await existing.save();
            return {
                success: true,
                feedbackId: existing._id.toString(),
                thankYouMessage: 'Thank you for updating your feedback!',
            };
        }
        // Create new feedback
        const feedback = new exports.Feedback({
            bookingId: input.bookingId,
            hotelId: input.hotelId,
            guestId: input.guestId,
            guestName: input.isAnonymous ? undefined : input.guestName,
            guestEmail: input.isAnonymous ? undefined : input.guestEmail,
            overallRating: input.overallRating,
            serviceRatings: input.serviceRatings,
            textComment: input.textComment,
            textLanguage: input.textLanguage,
            recommendLikelihood: input.recommendLikelihood,
            stayType: input.stayType,
            roomType: input.roomType,
            source: input.source,
            deviceType: input.deviceType,
            isAnonymous: input.isAnonymous || false,
            submittedAt: new Date(),
        });
        await feedback.save();
        return {
            success: true,
            feedbackId: feedback._id.toString(),
            thankYouMessage: 'Thank you for your feedback! Your input helps us improve.',
        };
    }
    catch (error) {
        console.error('[FeedbackService] Submit error:', error);
        if (error.code === 11000) {
            return {
                success: false,
                error: 'Feedback already submitted for this booking',
            };
        }
        return {
            success: false,
            error: 'Failed to submit feedback',
        };
    }
}
/**
 * Get feedback for a specific booking
 */
async function getFeedbackByBookingId(bookingId) {
    return exports.Feedback.findOne({ bookingId });
}
/**
 * Get aggregated ratings for a hotel
 */
async function getHotelRatings(hotelId, period = 'all_time') {
    let dateFilter = {};
    if (period === '30_days') {
        dateFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }
    else if (period === '7_days') {
        dateFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    }
    const matchStage = { hotelId };
    if (Object.keys(dateFilter).length > 0) {
        matchStage.submittedAt = dateFilter;
    }
    // Get all feedback for aggregation
    const feedbackDocs = await exports.Feedback.find(matchStage).lean();
    const totalReviews = feedbackDocs.length;
    if (totalReviews === 0) {
        return {
            hotelId,
            period,
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            averageServiceRatings: {},
            npsScore: 0,
            recentTrend: 'stable',
            lastUpdated: new Date(),
        };
    }
    // Calculate average overall rating
    const totalRating = feedbackDocs.reduce((sum, f) => sum + f.overallRating, 0);
    const averageRating = totalRating / totalReviews;
    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbackDocs.forEach(f => {
        const rating = Math.round(f.overallRating);
        const normalizedRating = Math.min(5, Math.max(1, rating));
        ratingDistribution[normalizedRating]++;
    });
    // Calculate NPS score (Net Promoter Score)
    const promoters = feedbackDocs.filter(f => f.recommendLikelihood >= 9).length;
    const detractors = feedbackDocs.filter(f => f.recommendLikelihood <= 6).length;
    const npsScore = Math.round(((promoters - detractors) / totalReviews) * 100);
    // Calculate average service ratings
    const serviceRatingSums = {};
    feedbackDocs.forEach(f => {
        f.serviceRatings?.forEach((sr) => {
            if (!serviceRatingSums[sr.category]) {
                serviceRatingSums[sr.category] = { sum: 0, count: 0 };
            }
            serviceRatingSums[sr.category].sum += sr.rating;
            serviceRatingSums[sr.category].count++;
        });
    });
    const averageServiceRatings = {};
    Object.entries(serviceRatingSums).forEach(([category, data]) => {
        averageServiceRatings[category] = Math.round((data.sum / data.count) * 10) / 10;
    });
    // Calculate recent trend (compare last 7 days vs previous 7 days)
    let recentTrend = 'stable';
    if (period === 'all_time' || period === '30_days') {
        const now = Date.now();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const recentFeedback = feedbackDocs.filter(f => new Date(f.submittedAt) >= sevenDaysAgo);
        const previousFeedback = feedbackDocs.filter(f => {
            const date = new Date(f.submittedAt);
            return date >= fourteenDaysAgo && date < sevenDaysAgo;
        });
        if (recentFeedback.length >= 3 && previousFeedback.length >= 3) {
            const recentAvg = recentFeedback.reduce((s, f) => s + f.overallRating, 0) / recentFeedback.length;
            const previousAvg = previousFeedback.reduce((s, f) => s + f.overallRating, 0) / previousFeedback.length;
            if (recentAvg > previousAvg + 0.2) {
                recentTrend = 'improving';
            }
            else if (recentAvg < previousAvg - 0.2) {
                recentTrend = 'declining';
            }
        }
    }
    return {
        hotelId,
        period,
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        averageServiceRatings,
        npsScore,
        recentTrend,
        lastUpdated: new Date(),
    };
}
/**
 * Get paginated feedback list for a hotel
 */
async function getHotelFeedbackList(hotelId, options = {}) {
    const { page = 1, limit = 10, minRating, sortBy = 'recent', } = options;
    const query = { hotelId };
    if (minRating) {
        query.overallRating = { $gte: minRating };
    }
    let sortQuery = { submittedAt: -1 };
    if (sortBy === 'rating_high') {
        sortQuery = { overallRating: -1, submittedAt: -1 };
    }
    else if (sortBy === 'rating_low') {
        sortQuery = { overallRating: 1, submittedAt: -1 };
    }
    const skip = (page - 1) * limit;
    const [feedbackDocs, total] = await Promise.all([
        exports.Feedback.find(query)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .lean(),
        exports.Feedback.countDocuments(query),
    ]);
    const feedback = feedbackDocs.map(f => ({
        id: f._id?.toString() || '',
        bookingId: f.bookingId,
        guestName: f.isAnonymous ? 'Anonymous Guest' : (f.guestName || 'Guest'),
        overallRating: f.overallRating,
        textComment: f.textComment,
        recommendLikelihood: f.recommendLikelihood,
        stayType: f.stayType,
        serviceRatings: f.serviceRatings,
        submittedAt: f.submittedAt,
        isAnonymous: f.isAnonymous,
    }));
    return {
        feedback,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}
/**
 * Get feedback response rate for a hotel
 */
async function getFeedbackResponseRate(hotelId, totalBookings30Days) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalFeedback = await exports.Feedback.countDocuments({
        hotelId,
        submittedAt: { $gte: thirtyDaysAgo },
    });
    const responseRate = totalBookings30Days > 0
        ? Math.round((totalFeedback / totalBookings30Days) * 100)
        : 0;
    return {
        totalBookings: totalBookings30Days,
        totalFeedback,
        responseRate,
    };
}
/**
 * Delete feedback (admin function)
 */
async function deleteFeedback(feedbackId) {
    try {
        const result = await exports.Feedback.findByIdAndDelete(feedbackId);
        return !!result;
    }
    catch {
        return false;
    }
}
// ─── Export ─────────────────────────────────────────────────────────────────────
exports.feedbackService = {
    submitFeedback,
    getFeedbackByBookingId,
    getHotelRatings,
    getHotelFeedbackList,
    getFeedbackResponseRate,
    deleteFeedback,
};
exports.default = exports.feedbackService;
//# sourceMappingURL=feedback-service.js.map