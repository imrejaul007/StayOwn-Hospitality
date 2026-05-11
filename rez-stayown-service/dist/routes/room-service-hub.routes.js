"use strict";
/**
 * Room Service Hub Routes
 *
 * Endpoints for the Room Service Hub mobile app:
 * - GET /api/room-service/:hotelId/:roomId - Get room service info
 * - POST /api/room-service/order - Place service order
 * - GET /api/room-service/menu/:hotelId - Get services menu
 * - GET /api/room-service/bill/:bookingId - Get current bill
 * - POST /api/room-service/checkout - Process checkout
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const room_service_hub_1 = require("../services/room-service-hub");
const feedback_service_1 = require("../services/feedback-service");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const rez_mind_client_1 = require("../services/rez-mind-client");
const router = (0, express_1.Router)();
// ─── Get Room Service Info ─────────────────────────────────────────────────────
/**
 * Get room service info for a booking
 * GET /api/room-service/:hotelId/:roomId?token=xxx
 */
router.get('/:hotelId/:roomId', auth_1.optionalAuth, async (req, res) => {
    try {
        const { hotelId, roomId } = req.params;
        const { token, bookingId } = req.query;
        const info = await room_service_hub_1.roomServiceHub.getRoomServiceInfo({
            hotelId,
            roomId,
            token: token,
            bookingId: bookingId,
        });
        if (!info) {
            res.status(404).json({
                success: false,
                message: 'Room not found or QR invalid',
            });
            return;
        }
        res.json({
            success: true,
            data: info,
        });
    }
    catch (error) {
        console.error('[RoomServiceHub] Get info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get room service info',
        });
    }
});
// ─── Get Services Menu ──────────────────────────────────────────────────────────
/**
 * Get services menu for a hotel
 * GET /api/room-service/menu/:hotelId
 */
router.get('/menu/:hotelId', async (req, res) => {
    try {
        const { hotelId } = req.params;
        const menu = await room_service_hub_1.roomServiceHub.getServicesMenu(hotelId);
        res.json({
            success: true,
            data: menu,
        });
    }
    catch (error) {
        console.error('[RoomServiceHub] Get menu error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get services menu',
        });
    }
});
// ─── Place Service Order ────────────────────────────────────────────────────────
/**
 * Place a room service order
 * POST /api/room-service/order
 */
router.post('/order', rateLimiter_1.rateLimiters.charge, async (req, res) => {
    try {
        const { bookingId, hotelId, roomId, serviceType, items, specialInstructions, } = req.body;
        if (!bookingId || !hotelId || !roomId || !serviceType || !items?.length) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
            return;
        }
        const result = await room_service_hub_1.roomServiceHub.orderService({
            bookingId,
            hotelId,
            roomId,
            serviceType,
            items,
            specialInstructions,
        });
        if (!result.success) {
            res.status(400).json({
                success: false,
                message: result.error || 'Order failed',
            });
            return;
        }
        res.status(201).json({
            success: true,
            data: {
                orderId: result.orderId,
                estimatedTime: result.estimatedTime,
                totalPaise: result.totalPaise,
            },
        });
    }
    catch (error) {
        console.error('[RoomServiceHub] Order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to place order',
        });
    }
});
// ─── Get Current Bill ─────────────────────────────────────────────────────────
/**
 * Get current charges for a booking
 * GET /api/room-service/bill/:bookingId
 */
router.get('/bill/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const bill = await room_service_hub_1.roomServiceHub.getCurrentBill(bookingId);
        if (!bill) {
            res.status(404).json({
                success: false,
                message: 'Bill not found',
            });
            return;
        }
        res.json({
            success: true,
            data: bill,
        });
    }
    catch (error) {
        console.error('[RoomServiceHub] Get bill error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bill',
        });
    }
});
// ─── Process Checkout ───────────────────────────────────────────────────────────
/**
 * Process guest checkout
 * POST /api/room-service/checkout
 */
router.post('/checkout', rateLimiter_1.rateLimiters.checkout, async (req, res) => {
    try {
        const { bookingId, hotelId, roomId, paymentMethod, paymentData } = req.body;
        if (!bookingId || !hotelId || !roomId) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
            return;
        }
        const result = await room_service_hub_1.roomServiceHub.processCheckout({
            bookingId,
            hotelId,
            roomId,
            paymentMethod,
            paymentData,
        });
        if (!result.success) {
            res.status(400).json({
                success: false,
                message: result.error || 'Checkout failed',
                data: {
                    totalAmountPaise: result.totalAmountPaise,
                    balanceDuePaise: result.balanceDuePaise,
                },
            });
            return;
        }
        res.json({
            success: true,
            data: {
                checkoutId: result.checkoutId,
                totalAmountPaise: result.totalAmountPaise,
                serviceChargesPaise: result.serviceChargesPaise,
                roomChargesPaise: result.roomChargesPaise,
                taxesPaise: result.taxesPaise,
                balanceDuePaise: result.balanceDuePaise,
                paymentLink: result.paymentLink,
            },
        });
    }
    catch (error) {
        console.error('[RoomServiceHub] Checkout error:', error);
        res.status(500).json({
            success: false,
            message: 'Checkout failed',
        });
    }
});
// ─── Guest Feedback Endpoints ───────────────────────────────────────────────────
/**
 * Submit guest feedback
 * POST /api/room-service/feedback
 */
router.post('/feedback', rateLimiter_1.rateLimiters.general, async (req, res) => {
    try {
        const { bookingId, hotelId, guestId, guestName, guestEmail, overallRating, serviceRatings, textComment, textLanguage, recommendLikelihood, stayType, roomType, source, deviceType, isAnonymous, } = req.body;
        // Validate required fields
        if (!bookingId || !hotelId || !guestId) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: bookingId, hotelId, guestId',
            });
            return;
        }
        if (!overallRating || overallRating < 1 || overallRating > 5) {
            res.status(400).json({
                success: false,
                message: 'Overall rating must be between 1 and 5',
            });
            return;
        }
        if (!stayType || !['business', 'leisure', 'family', 'couple', 'solo'].includes(stayType)) {
            res.status(400).json({
                success: false,
                message: 'Invalid stay type',
            });
            return;
        }
        if (recommendLikelihood !== undefined && (recommendLikelihood < 0 || recommendLikelihood > 10)) {
            res.status(400).json({
                success: false,
                message: 'Recommend likelihood must be between 0 and 10',
            });
            return;
        }
        // Validate service ratings
        const validCategories = ['cleanliness', 'staff', 'amenities', 'food', 'location', 'value', 'checkin', 'checkout'];
        if (serviceRatings && Array.isArray(serviceRatings)) {
            for (const sr of serviceRatings) {
                if (!validCategories.includes(sr.category)) {
                    res.status(400).json({
                        success: false,
                        message: `Invalid service category: ${sr.category}`,
                    });
                    return;
                }
                if (sr.rating < 1 || sr.rating > 5) {
                    res.status(400).json({
                        success: false,
                        message: 'Service ratings must be between 1 and 5',
                    });
                    return;
                }
            }
        }
        const result = await feedback_service_1.feedbackService.submitFeedback({
            bookingId,
            hotelId,
            guestId,
            guestName,
            guestEmail,
            overallRating,
            serviceRatings: serviceRatings || [],
            textComment,
            textLanguage: textLanguage || 'en',
            recommendLikelihood: recommendLikelihood ?? 7,
            stayType,
            roomType,
            source: source || 'checkout_screen',
            deviceType,
            isAnonymous,
        });
        if (!result.success) {
            res.status(400).json({
                success: false,
                message: result.error,
            });
            return;
        }
        res.status(201).json({
            success: true,
            data: {
                feedbackId: result.feedbackId,
                thankYouMessage: result.thankYouMessage,
            },
        });
        // Emit feedback_submitted event to REZ Mind
        rez_mind_client_1.rezMindClient.sendEvent({
            eventType: 'feedback_submitted',
            source: 'stayown',
            userId: isAnonymous ? undefined : guestId,
            data: {
                feedbackId: result.feedbackId,
                bookingId,
                hotelId,
                overallRating,
                serviceRatings: serviceRatings || [],
                recommendLikelihood: recommendLikelihood ?? 7,
                stayType,
                roomType,
                source: source || 'checkout_screen',
                textComment: textComment || null,
            },
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('[Feedback] Submit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback',
        });
    }
});
/**
 * Get feedback for a booking
 * GET /api/room-service/feedback/:bookingId
 */
router.get('/feedback/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const feedback = await feedback_service_1.feedbackService.getFeedbackByBookingId(bookingId);
        if (!feedback) {
            res.status(404).json({
                success: false,
                message: 'Feedback not found for this booking',
            });
            return;
        }
        res.json({
            success: true,
            data: {
                id: feedback._id,
                bookingId: feedback.bookingId,
                hotelId: feedback.hotelId,
                overallRating: feedback.overallRating,
                serviceRatings: feedback.serviceRatings,
                textComment: feedback.textComment,
                textLanguage: feedback.textLanguage,
                recommendLikelihood: feedback.recommendLikelihood,
                stayType: feedback.stayType,
                roomType: feedback.roomType,
                source: feedback.source,
                submittedAt: feedback.submittedAt,
            },
        });
    }
    catch (error) {
        console.error('[Feedback] Get error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get feedback',
        });
    }
});
/**
 * Get aggregated ratings for a hotel
 * GET /api/room-service/feedback/hotel/:hotelId/ratings
 */
router.get('/feedback/hotel/:hotelId/ratings', async (req, res) => {
    try {
        const { hotelId } = req.params;
        const { period } = req.query;
        const validPeriods = ['all_time', '30_days', '7_days'];
        const selectedPeriod = validPeriods.includes(period)
            ? period
            : 'all_time';
        const ratings = await feedback_service_1.feedbackService.getHotelRatings(hotelId, selectedPeriod);
        res.json({
            success: true,
            data: ratings,
        });
    }
    catch (error) {
        console.error('[Feedback] Ratings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get ratings',
        });
    }
});
/**
 * Get feedback list for a hotel (merchant view)
 * GET /api/room-service/feedback/hotel/:hotelId
 */
router.get('/feedback/hotel/:hotelId', async (req, res) => {
    try {
        const { hotelId } = req.params;
        const { page, limit, minRating, sortBy } = req.query;
        const result = await feedback_service_1.feedbackService.getHotelFeedbackList(hotelId, {
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 10,
            minRating: minRating ? parseInt(minRating, 10) : undefined,
            sortBy: sortBy,
        });
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('[Feedback] List error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get feedback list',
        });
    }
});
exports.default = router;
//# sourceMappingURL=room-service-hub.routes.js.map