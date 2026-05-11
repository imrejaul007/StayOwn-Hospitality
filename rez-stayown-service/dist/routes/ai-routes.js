"use strict";
/**
 * AI Routes for StayOwn - REZ Mind Integration
 *
 * Endpoints:
 * - GET /ai/pricing/:hotelId - Get dynamic price
 * - GET /ai/recommendations/:userId - Get personalized recommendations
 * - GET /ai/insights/:hotelId - Get hotel insights
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const pricing_service_1 = require("../services/pricing.service");
const rez_mind_integration_1 = require("../services/rez-mind-integration");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ─── Validation Schemas ────────────────────────────────────────────────────────
const pricingQuerySchema = zod_1.z.object({
    roomTypeId: zod_1.z.string(),
    checkIn: zod_1.z.string(),
    checkOut: zod_1.z.string(),
    baseRate: zod_1.z.string().transform(Number),
});
const recommendationsQuerySchema = zod_1.z.object({
    city: zod_1.z.string().optional(),
    checkIn: zod_1.z.string().optional(),
    checkOut: zod_1.z.string().optional(),
    budget: zod_1.z.string().optional().transform(v => v ? Number(v) : undefined),
});
const insightsQuerySchema = zod_1.z.object({
    checkIn: zod_1.z.string().optional(),
    checkOut: zod_1.z.string().optional(),
});
// ─── Helper Functions ─────────────────────────────────────────────────────────
async function fetchFromPMS(endpoint) {
    try {
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        const response = await axios.get(`${process.env.HOTEL_PMS_URL || 'http://localhost:3008'}${endpoint}`, {
            timeout: 5000,
            headers: {
                'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
            },
        });
        return response.data;
    }
    catch (error) {
        console.warn(`[AI Routes] PMS fetch failed for ${endpoint}`);
        return null;
    }
}
// ─── Routes ───────────────────────────────────────────────────────────────────
/**
 * GET /ai/pricing/:hotelId
 * Get dynamic pricing for a hotel room
 */
router.get('/pricing/:hotelId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { hotelId } = req.params;
        const query = pricingQuerySchema.parse(req.query);
        const { roomTypeId, checkIn, checkOut, baseRate } = query;
        const userId = req.user?.sub;
        console.log(`[AI Routes] Getting dynamic pricing for ${hotelId}/${roomTypeId}`);
        // Get dynamic price from pricing service
        const priceResponse = await pricing_service_1.pricingService.getPrice({
            hotelId,
            roomTypeId,
            checkIn,
            checkOut,
            baseRate,
            userId,
        });
        res.json({
            success: true,
            data: {
                pricing: priceResponse,
                metadata: {
                    hotelId,
                    roomTypeId,
                    userId: userId || 'anonymous',
                    timestamp: new Date().toISOString(),
                },
            },
        });
    }
    catch (error) {
        console.error('[AI Routes] Dynamic pricing error:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Invalid parameters', errors: error.errors });
            return;
        }
        res.status(500).json({ success: false, message: 'Failed to get dynamic pricing' });
    }
});
/**
 * GET /ai/recommendations/:userId
 * Get personalized hotel recommendations
 */
router.get('/recommendations/:userId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const query = recommendationsQuerySchema.parse(req.query);
        const { city, checkIn, checkOut, budget } = query;
        console.log(`[AI Routes] Getting recommendations for user ${userId}`);
        // Get recommendations from REZ Mind
        const recommendations = await rez_mind_integration_1.rezMindHotel.getRecommendations(userId, {
            city,
            checkIn,
            checkOut,
            budget,
        });
        if (!recommendations) {
            // Fallback to basic recommendations
            res.json({
                success: true,
                data: {
                    recommendedHotels: [],
                    upsells: [],
                    message: 'AI recommendations unavailable',
                    source: 'fallback',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: {
                ...recommendations,
                source: 'rez_mind',
                metadata: {
                    userId,
                    query: { city, checkIn, checkOut, budget },
                    timestamp: new Date().toISOString(),
                },
            },
        });
    }
    catch (error) {
        console.error('[AI Routes] Recommendations error:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Invalid parameters', errors: error.errors });
            return;
        }
        res.status(500).json({ success: false, message: 'Failed to get recommendations' });
    }
});
/**
 * GET /ai/insights/:hotelId
 * Get hotel insights and analytics
 */
router.get('/insights/:hotelId', auth_1.optionalAuth, async (req, res) => {
    try {
        const { hotelId } = req.params;
        const query = insightsQuerySchema.parse(req.query);
        const { checkIn, checkOut } = query;
        console.log(`[AI Routes] Getting insights for hotel ${hotelId}`);
        // Fetch hotel data from PMS
        const hotelData = await fetchFromPMS(`/v1/hotels/${hotelId}`);
        if (!hotelData?.data) {
            res.status(404).json({ success: false, message: 'Hotel not found' });
            return;
        }
        const hotel = hotelData.data;
        // Gather insights from multiple sources
        const insights = {
            hotel: {
                id: hotel.propertyId || hotelId,
                name: hotel.name,
                location: hotel.address?.city,
                rating: hotel.userRating || hotel.starRating,
                reviewCount: hotel.reviewCount || 0,
            },
            pricing: {
                baseRate: hotel.roomTypes?.[0]?.baseRate || 0,
                averageDiscount: hotel.roomTypes?.[0]?.discount || 0,
                currency: 'INR',
            },
            availability: {
                roomTypes: hotel.roomTypes?.length || 0,
                availableRooms: hotel.roomTypes?.filter((r) => r.available)?.length || 0,
            },
            predictions: {
                occupancyLikelihood: null,
                demandLevel: null,
                recommendedPricing: null,
            },
            factors: [],
        };
        // Try to get SLA predictions for the hotel
        const slaPrediction = await rez_mind_integration_1.rezMindHotel.predictServiceResponseTime(hotelId, 'room_service');
        if (slaPrediction) {
            insights.predictions.occupancyLikelihood = Math.round((1 - slaPrediction.currentLoad) * 100);
            insights.predictions.demandLevel = slaPrediction.currentLoad > 0.8 ? 'high' : slaPrediction.currentLoad > 0.5 ? 'medium' : 'low';
        }
        // Calculate demand factors
        if (checkIn) {
            const date = new Date(checkIn);
            const dayOfWeek = date.getDay();
            insights.factors.push(`Booking day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                insights.factors.push('Weekend - higher demand expected');
            }
        }
        if (hotel.reviewCount > 1000) {
            insights.factors.push('High review volume - established property');
        }
        res.json({
            success: true,
            data: {
                ...insights,
                metadata: {
                    hotelId,
                    checkIn,
                    checkOut,
                    timestamp: new Date().toISOString(),
                },
            },
        });
    }
    catch (error) {
        console.error('[AI Routes] Insights error:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Invalid parameters', errors: error.errors });
            return;
        }
        res.status(500).json({ success: false, message: 'Failed to get insights' });
    }
});
/**
 * POST /ai/track-search
 * Track search behavior for AI learning
 */
router.post('/track-search', auth_1.authenticateToken, async (req, res) => {
    try {
        const { query, city, checkIn, checkOut, guests, resultsCount, selectedHotelId } = req.body;
        const userId = req.user?.sub;
        await rez_mind_integration_1.rezMindHotel.trackSearch({
            userId,
            query,
            city,
            checkIn,
            checkOut,
            guests,
            resultsCount,
            selectedHotelId,
        });
        res.json({ success: true, message: 'Search tracked' });
    }
    catch (error) {
        console.error('[AI Routes] Track search error:', error);
        res.status(500).json({ success: false, message: 'Failed to track search' });
    }
});
/**
 * POST /ai/satisfaction-predict
 * Predict guest satisfaction for a booking
 */
router.post('/satisfaction-predict', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId, checkInTime, serviceResponseTimes, totalCharges, specialRequests } = req.body;
        const prediction = await rez_mind_integration_1.rezMindHotel.predictGuestSatisfaction(bookingId, {
            checkInTime,
            serviceResponseTimes,
            totalCharges,
            specialRequests,
        });
        if (!prediction) {
            res.json({
                success: true,
                data: {
                    score: null,
                    riskFactors: [],
                    recommendations: ['AI prediction unavailable'],
                    source: 'fallback',
                },
            });
            return;
        }
        res.json({
            success: true,
            data: {
                ...prediction,
                source: 'rez_mind',
                bookingId,
            },
        });
    }
    catch (error) {
        console.error('[AI Routes] Satisfaction predict error:', error);
        res.status(500).json({ success: false, message: 'Failed to predict satisfaction' });
    }
});
/**
 * GET /ai/cache-stats
 * Get pricing cache statistics
 */
router.get('/cache-stats', auth_1.authenticateToken, async (req, res) => {
    const stats = pricing_service_1.pricingService.getCacheStats();
    res.json({
        success: true,
        data: {
            cache: stats,
            timestamp: new Date().toISOString(),
        },
    });
});
/**
 * DELETE /ai/cache
 * Clear pricing cache (admin only)
 */
router.delete('/cache', auth_1.authenticateToken, async (req, res) => {
    pricing_service_1.pricingService.clearCache();
    res.json({
        success: true,
        message: 'Cache cleared',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=ai-routes.js.map