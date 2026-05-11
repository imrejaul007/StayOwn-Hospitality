"use strict";
/**
 * StayOwn Hotel OTA Routes
 *
 * Endpoints for:
 * - Hotel search
 * - Room availability
 * - Booking creation
 * - Booking management
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const rez_mind_integration_1 = require("../services/rez-mind-integration");
const pricing_service_1 = require("../services/pricing.service");
const razorpay_service_1 = require("../services/razorpay.service");
const BookingModel_1 = require("../models/BookingModel");
const PropertySettingsModel_1 = require("../models/PropertySettingsModel");
const logger_1 = require("../config/logger");
const log = logger_1.logger.child({ service: 'stayown' });
const router = (0, express_1.Router)();
// ─── Configuration ─────────────────────────────────────────────────────────────
const HOTEL_PMS_URL = process.env.HOTEL_PMS_URL || 'http://localhost:3008';
const HOTEL_OTA_API = process.env.HOTEL_OTA_API_URL || 'http://localhost:3008';
// ─── Validation Schemas ────────────────────────────────────────────────────────
const searchSchema = zod_1.z.object({
    city: zod_1.z.string().optional(),
    checkIn: zod_1.z.string().optional(),
    checkOut: zod_1.z.string().optional(),
    guests: zod_1.z.string().optional(),
});
const bookingSchema = zod_1.z.object({
    propertyId: zod_1.z.string(),
    roomId: zod_1.z.string(),
    checkIn: zod_1.z.string(),
    checkOut: zod_1.z.string(),
    guests: zod_1.z.number().optional(),
    guestDetails: zod_1.z.array(zod_1.z.object({
        firstName: zod_1.z.string(),
        lastName: zod_1.z.string(),
        email: zod_1.z.string().email().optional(),
        phone: zod_1.z.string().optional(),
    })).optional(),
});
const pricingSchema = zod_1.z.object({
    propertyId: zod_1.z.string(),
    roomId: zod_1.z.string(),
    checkIn: zod_1.z.string(),
    checkOut: zod_1.z.string(),
});
// ─── Demo Properties (fallback when PMS not available) ────────────────────────
const DEMO_PROPERTIES = [
    {
        propertyId: 'P001',
        name: 'The Grand Mumbai',
        description: 'Luxury hotel in the heart of Mumbai',
        address: { line1: '1 MG Road', city: 'Mumbai', state: 'Maharashtra', country: 'India', pincode: '400001' },
        starRating: 5,
        userRating: 4.5,
        reviewCount: 2341,
        amenities: ['Free WiFi', 'Pool', 'Spa', 'Gym', 'Restaurant', 'Bar', 'Room Service'],
        images: ['https://example.com/grand-mumbai-1.jpg'],
        roomTypes: [
            { roomTypeId: 'RT001', name: 'Deluxe Room', bedType: 'King', baseRate: 5500, corporateRate: 4500, discount: 18, maxOccupancy: 2, available: true },
            { roomTypeId: 'RT002', name: 'Executive Suite', bedType: 'King', baseRate: 8500, corporateRate: 7200, discount: 15, maxOccupancy: 3, available: true },
        ],
        gstInfo: { hsnCode: '9963', taxRate: 12 },
        // Free Cancellation Settings
        freeCancellationEnabled: true,
        cancellationHours: 24,
        refundPercentage: 100,
    },
    {
        propertyId: 'P002',
        name: 'ITC Gardenia Bangalore',
        description: 'Premium business hotel',
        address: { line1: 'MG Road', city: 'Bangalore', state: 'Karnataka', country: 'India', pincode: '560001' },
        starRating: 5,
        userRating: 4.6,
        reviewCount: 1892,
        amenities: ['Free WiFi', 'Business Center', 'Gym', 'Restaurant'],
        images: ['https://example.com/itc-gardenia-1.jpg'],
        roomTypes: [
            { roomTypeId: 'RT003', name: 'Executive Room', bedType: 'Queen', baseRate: 7500, corporateRate: 6500, discount: 13, maxOccupancy: 2, available: true },
        ],
        gstInfo: { hsnCode: '9963', taxRate: 12 },
        // Free Cancellation Settings
        freeCancellationEnabled: false,
        cancellationHours: 24,
        refundPercentage: 50,
    },
];
// MongoDB-backed property cancellation settings (via PropertySettings model)
// ─── Helper Functions ─────────────────────────────────────────────────────────
async function fetchFromPMS(endpoint) {
    try {
        const response = await axios_1.default.get(`${HOTEL_PMS_URL}${endpoint}`, {
            timeout: 5000,
            headers: {
                'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
            },
        });
        return response.data;
    }
    catch (error) {
        log.warn(`PMS fetch failed for ${endpoint}`);
        return null;
    }
}
async function postToPMS(endpoint, data) {
    try {
        const response = await axios_1.default.post(`${HOTEL_PMS_URL}${endpoint}`, data, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
            },
        });
        return response.data;
    }
    catch (error) {
        log.error(`PMS post failed for ${endpoint}:`, error);
        return null;
    }
}
function calculatePricing(baseRate, nights) {
    const subtotal = baseRate * nights;
    const taxableAmount = Math.round(subtotal / 1.12);
    const cgstAmount = Math.round(taxableAmount * 0.06);
    const sgstAmount = cgstAmount;
    return {
        baseRate,
        nights,
        subtotal,
        taxableAmount,
        cgstRate: 6,
        cgstAmount,
        sgstRate: 6,
        sgstAmount,
        totalTax: cgstAmount + sgstAmount,
        totalAmount: subtotal,
        itcEligible: true,
    };
}
async function getPropertyCancellationSettings(propertyId) {
    // Check MongoDB store first
    const stored = await PropertySettingsModel_1.PropertySettings.findOne({ propertyId });
    if (stored) {
        return {
            freeCancellationEnabled: stored.freeCancellationEnabled,
            cancellationHours: stored.cancellationHours,
            refundPercentage: stored.refundPercentage,
        };
    }
    // Fall back to DEMO_PROPERTIES
    const property = DEMO_PROPERTIES.find(p => p.propertyId === propertyId);
    return {
        freeCancellationEnabled: property?.freeCancellationEnabled ?? false,
        cancellationHours: property?.cancellationHours ?? 24,
        refundPercentage: property?.refundPercentage ?? 100,
    };
}
async function getBooking(bookingId) {
    // Check MongoDB store first
    const dbBooking = await BookingModel_1.Booking.findOne({ bookingId });
    if (dbBooking) {
        return {
            bookingId: dbBooking.bookingId,
            propertyId: dbBooking.property.propertyId,
            checkIn: dbBooking.dates.checkIn,
            totalAmountPaise: dbBooking.totalAmountPaise,
            status: dbBooking.status,
        };
    }
    // Try PMS
    const pmsBooking = await fetchFromPMS(`/v1/bookings/${bookingId}`);
    if (pmsBooking?.success && pmsBooking?.data) {
        return pmsBooking.data;
    }
    return null;
}
async function processRefund(bookingId, amountPaise) {
    log.info(`[StayOwn] Processing refund for booking ${bookingId}: ${amountPaise} paise`);
    // In production: integrate with payment gateway (Razorpay, Stripe, etc.)
    // POST /v1/payments/refund
}
async function updateBookingStatus(bookingId, status) {
    log.info(`[StayOwn] Updating booking ${bookingId} status to ${status}`);
    // Update in MongoDB
    await BookingModel_1.Booking.findOneAndUpdate({ bookingId }, { status });
    // Also update in PMS if available
    await postToPMS(`/v1/bookings/${bookingId}/status`, { status });
}
// ─── Routes ───────────────────────────────────────────────────────────────────
/**
 * Search hotels
 * GET /api/hotels/search?city=Mumbai
 * Public route - authentication optional for personalization
 * Rate limited: 30 requests per minute
 */
router.get('/search', rateLimiter_1.rateLimiters.hotelSearch, auth_1.optionalAuth, async (req, res) => {
    try {
        const { city, checkIn, checkOut, guests } = searchSchema.parse(req.query);
        const userId = req.user?.sub;
        let properties = DEMO_PROPERTIES;
        if (city) {
            properties = properties.filter(p => p.address.city.toLowerCase().includes(city.toLowerCase()));
        }
        // Try to fetch from PMS for real data
        const pmsHotels = await fetchFromPMS(`/v1/hotels?city=${city || ''}`);
        if (pmsHotels && pmsHotels.success && pmsHotels.data) {
            properties = pmsHotels.data;
        }
        // Get personalized recommendations from REZ Mind if user is logged in
        let personalizedRecommendations = null;
        if (userId) {
            try {
                const recommendations = await rez_mind_integration_1.rezMindHotel.getRecommendations(userId, {
                    city,
                    checkIn,
                    checkOut,
                });
                if (recommendations) {
                    personalizedRecommendations = recommendations;
                    // Sort properties by recommendation score
                    if (recommendations.recommendedHotels?.length > 0) {
                        const scoreMap = new Map(recommendations.recommendedHotels.map((r) => [r.hotelId, r]));
                        properties = properties.sort((a, b) => {
                            const scoreA = scoreMap.get(a.propertyId)?.score || 0;
                            const scoreB = scoreMap.get(b.propertyId)?.score || 0;
                            return scoreB - scoreA;
                        });
                    }
                }
            }
            catch (error) {
                console.warn('[StayOwn] Could not get personalized recommendations:', error);
            }
        }
        res.json({
            success: true,
            data: {
                hotels: properties,
                total: properties.length,
                filters: { city, checkIn, checkOut, guests },
                recommendations: personalizedRecommendations,
                aiPowered: !!personalizedRecommendations,
            },
        });
        // Emit search_performed event to REZ Mind
        rezMindClient.sendEvent({
            eventType: 'search_performed',
            source: 'stayown',
            userId: userId,
            data: {
                city,
                checkIn,
                checkOut,
                guests: guests ? parseInt(guests, 10) : undefined,
                resultsCount: properties.length,
                aiPowered: !!personalizedRecommendations,
            },
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('[StayOwn] Search error:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Invalid parameters', errors: error.errors });
            return;
        }
        res.status(500).json({ success: false, message: 'Search failed' });
    }
});
/**
 * Get hotel details
 * GET /api/hotels/:propertyId
 * Public route - authentication optional for personalization
 */
router.get('/:propertyId', auth_1.optionalAuth, async (req, res) => {
    try {
        const { propertyId } = req.params;
        // Try PMS first
        const pmsHotel = await fetchFromPMS(`/v1/hotels/${propertyId}`);
        if (pmsHotel && pmsHotel.success && pmsHotel.data) {
            res.json({ success: true, data: pmsHotel.data });
            return;
        }
        // Demo property
        const property = DEMO_PROPERTIES.find(p => p.propertyId === propertyId);
        if (!property) {
            res.status(404).json({ success: false, message: 'Property not found' });
            return;
        }
        res.json({ success: true, data: property });
    }
    catch (error) {
        console.error('[StayOwn] Get hotel error:', error);
        res.status(500).json({ success: false, message: 'Failed to get hotel details' });
    }
});
/**
 * Get room availability
 * GET /api/hotels/:propertyId/availability
 * Public route - authentication optional for personalization
 */
router.get('/:propertyId/availability', auth_1.optionalAuth, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { checkIn, checkOut } = req.query;
        const userId = req.user?.sub;
        // Try PMS for real availability
        const pmsAvailability = await fetchFromPMS(`/v1/hotels/${propertyId}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
        if (pmsAvailability && pmsAvailability.success && pmsAvailability.data) {
            // Enrich with dynamic pricing from REZ Mind
            if (pmsAvailability.data.roomTypes && checkIn && checkOut) {
                const roomPrices = await pricing_service_1.pricingService.getRoomPrices(propertyId, pmsAvailability.data.roomTypes.map((r) => ({
                    roomTypeId: r.roomTypeId || r.id,
                    baseRate: r.baseRate || r.corporateRate || 0,
                })), checkIn, checkOut, userId);
                // Merge pricing into room types
                pmsAvailability.data.roomTypes = pmsAvailability.data.roomTypes.map((room) => {
                    const price = roomPrices.find(p => p.roomTypeId === (room.roomTypeId || room.id));
                    return {
                        ...room,
                        dynamicPricing: price || null,
                    };
                });
            }
            res.json({ success: true, data: pmsAvailability.data });
            return;
        }
        // Demo availability
        const property = DEMO_PROPERTIES.find(p => p.propertyId === propertyId);
        if (!property) {
            res.status(404).json({ success: false, message: 'Property not found' });
            return;
        }
        const availableRooms = property.roomTypes.filter(r => r.available);
        // Get dynamic pricing for available rooms
        let roomsWithPricing = availableRooms;
        if (checkIn && checkOut) {
            const roomPrices = await pricing_service_1.pricingService.getRoomPrices(propertyId, availableRooms.map(r => ({
                roomTypeId: r.roomTypeId,
                baseRate: r.baseRate,
            })), checkIn, checkOut, userId);
            roomsWithPricing = availableRooms.map(room => {
                const price = roomPrices.find(p => p.roomTypeId === room.roomTypeId);
                return {
                    ...room,
                    dynamicPricing: price || null,
                };
            });
        }
        res.json({
            success: true,
            data: {
                propertyId,
                checkIn,
                checkOut,
                roomTypes: roomsWithPricing,
                total: roomsWithPricing.length,
                pricingSource: 'rez_mind',
            },
        });
    }
    catch (error) {
        console.error('[StayOwn] Availability error:', error);
        res.status(500).json({ success: false, message: 'Failed to check availability' });
    }
});
/**
 * Get all bookings
 * GET /api/hotels/bookings
 * Protected route - requires JWT authentication
 */
router.get('/bookings', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.sub;
        // Try PMS for user's bookings
        const pmsBookings = await fetchFromPMS(`/v1/bookings?userId=${userId}`);
        if (pmsBookings && pmsBookings.success && pmsBookings.data) {
            res.json({ success: true, data: pmsBookings.data });
            return;
        }
        res.json({ success: true, data: [] });
    }
    catch (error) {
        console.error('[StayOwn] Get bookings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get bookings' });
    }
});
/**
 * Get booking details
 * GET /api/hotels/bookings/:bookingId
 * Protected route - requires JWT authentication
 */
router.get('/bookings/:bookingId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        // Try PMS first
        const pmsBooking = await fetchFromPMS(`/v1/bookings/${bookingId}`);
        if (pmsBooking && pmsBooking.success && pmsBooking.data) {
            res.json({ success: true, data: pmsBooking.data });
            return;
        }
        res.status(404).json({ success: false, message: 'Booking not found' });
    }
    catch (error) {
        console.error('[StayOwn] Get booking error:', error);
        res.status(500).json({ success: false, message: 'Failed to get booking' });
    }
});
// ─── Free Cancellation Routes ─────────────────────────────────────────────────
/**
 * Get Free Cancellation Settings
 * GET /api/hotels/:propertyId/free-cancellation
 * Public route - authentication optional for personalization
 */
router.get('/:propertyId/free-cancellation', auth_1.optionalAuth, async (req, res) => {
    try {
        const { propertyId } = req.params;
        // Try PMS first
        const pmsSettings = await fetchFromPMS(`/v1/hotels/${propertyId}/cancellation-settings`);
        if (pmsSettings?.success && pmsSettings?.data) {
            res.json({
                success: true,
                data: {
                    freeCancellationEnabled: pmsSettings.data.freeCancellationEnabled,
                    cancellationHours: pmsSettings.data.cancellationHours,
                    refundPercentage: pmsSettings.data.refundPercentage,
                    message: pmsSettings.data.freeCancellationEnabled
                        ? `Free cancellation up to ${pmsSettings.data.cancellationHours} hours before check-in`
                        : 'Cancellation charges apply',
                },
            });
            return;
        }
        // Use MongoDB or fallback to DEMO_PROPERTIES
        const settings = await getPropertyCancellationSettings(propertyId);
        res.json({
            success: true,
            data: {
                freeCancellationEnabled: settings.freeCancellationEnabled,
                cancellationHours: settings.cancellationHours,
                refundPercentage: settings.refundPercentage,
                message: settings.freeCancellationEnabled
                    ? `Free cancellation up to ${settings.cancellationHours} hours before check-in`
                    : 'Cancellation charges apply',
            },
        });
    }
    catch (error) {
        console.error('[StayOwn] Get free cancellation settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to get cancellation settings' });
    }
});
/**
 * Update Free Cancellation Settings
 * PUT /api/hotels/:propertyId/free-cancellation
 * Protected route - requires JWT authentication (admin/hotel owner)
 */
router.put('/:propertyId/free-cancellation', auth_1.authenticateToken, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { freeCancellationEnabled, cancellationHours, refundPercentage } = req.body;
        // Validate inputs
        if (typeof freeCancellationEnabled !== 'boolean') {
            res.status(400).json({ success: false, message: 'freeCancellationEnabled must be a boolean' });
            return;
        }
        if (cancellationHours !== undefined && (typeof cancellationHours !== 'number' || cancellationHours < 0)) {
            res.status(400).json({ success: false, message: 'cancellationHours must be a non-negative number' });
            return;
        }
        if (refundPercentage !== undefined && (typeof refundPercentage !== 'number' || refundPercentage < 0 || refundPercentage > 100)) {
            res.status(400).json({ success: false, message: 'refundPercentage must be between 0 and 100' });
            return;
        }
        const settings = {
            freeCancellationEnabled,
            cancellationHours: cancellationHours ?? 24,
            refundPercentage: refundPercentage ?? 100,
        };
        // Store in MongoDB (upsert - update if exists, insert if not)
        await PropertySettingsModel_1.PropertySettings.findOneAndUpdate({ propertyId }, { ...settings, updatedBy: req.user?.sub }, { upsert: true, new: true });
        // Also update in PMS if available
        await postToPMS(`/v1/hotels/${propertyId}/cancellation-settings`, settings);
        res.json({
            success: true,
            data: {
                ...settings,
                message: settings.freeCancellationEnabled
                    ? `Free cancellation enabled: up to ${settings.cancellationHours} hours before check-in`
                    : 'Free cancellation disabled',
            },
        });
    }
    catch (error) {
        console.error('[StayOwn] Update free cancellation settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update cancellation settings' });
    }
});
/**
 * Check Cancellation Eligibility
 * GET /api/hotels/bookings/:bookingId/cancellation
 * Protected route - requires JWT authentication
 */
router.get('/bookings/:bookingId/cancellation', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await getBooking(bookingId);
        if (!booking) {
            res.status(404).json({ success: false, message: 'Booking not found' });
            return;
        }
        const cancellationSettings = await getPropertyCancellationSettings(booking.propertyId);
        const hoursUntilCheckin = (new Date(booking.checkIn).getTime() - new Date().getTime()) / (1000 * 60 * 60);
        let eligible;
        let refundPercentage;
        if (cancellationSettings.freeCancellationEnabled && hoursUntilCheckin > cancellationSettings.cancellationHours) {
            eligible = true;
            refundPercentage = cancellationSettings.refundPercentage;
        }
        else if (hoursUntilCheckin > cancellationSettings.cancellationHours) {
            eligible = false;
            refundPercentage = cancellationSettings.refundPercentage; // Standard refund without free cancellation
        }
        else {
            eligible = false;
            refundPercentage = 0; // No refund for late cancellation
        }
        const refundAmountPaise = Math.floor(booking.totalAmountPaise * (refundPercentage / 100));
        const cancellationFeePaise = booking.totalAmountPaise - refundAmountPaise;
        res.json({
            success: true,
            data: {
                eligible,
                refundAmountPaise,
                cancellationFeePaise,
                refundPercentage,
                hoursUntilCheckin: Math.max(0, hoursUntilCheckin),
                message: eligible
                    ? `Free cancellation available (${refundPercentage}% refund)`
                    : hoursUntilCheckin <= cancellationSettings.cancellationHours
                        ? `Cancellation deadline passed (${cancellationSettings.cancellationHours} hours before check-in)`
                        : `Only ${refundPercentage}% refund available`,
            },
        });
    }
    catch (error) {
        console.error('[StayOwn] Check cancellation eligibility error:', error);
        res.status(500).json({ success: false, message: 'Failed to check cancellation eligibility' });
    }
});
/**
 * Cancel Booking
 * POST /api/hotels/bookings/:bookingId/cancel
 * Protected route - requires JWT authentication
 */
router.post('/bookings/:bookingId/cancel', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;
        const booking = await getBooking(bookingId);
        if (!booking) {
            res.status(404).json({ success: false, message: 'Booking not found' });
            return;
        }
        if (booking.status === 'cancelled') {
            res.status(400).json({ success: false, message: 'Booking is already cancelled' });
            return;
        }
        const cancellationSettings = await getPropertyCancellationSettings(booking.propertyId);
        const hoursUntilCheckin = (new Date(booking.checkIn).getTime() - new Date().getTime()) / (1000 * 60 * 60);
        let refundAmountPaise;
        if (cancellationSettings.freeCancellationEnabled && hoursUntilCheckin > cancellationSettings.cancellationHours) {
            // Free cancellation: full refund
            refundAmountPaise = booking.totalAmountPaise;
        }
        else if (hoursUntilCheckin > cancellationSettings.cancellationHours) {
            // After free cancellation window (no free cancellation enabled): partial refund
            refundAmountPaise = Math.floor(booking.totalAmountPaise * (cancellationSettings.refundPercentage / 100));
        }
        else {
            // Within 24 hours of check-in: no refund
            refundAmountPaise = 0;
        }
        // Process refund if applicable
        let refundStatus = 'not_applicable';
        if (refundAmountPaise > 0) {
            await processRefund(bookingId, refundAmountPaise);
            refundStatus = 'processing';
        }
        // Update booking status
        await updateBookingStatus(bookingId, 'cancelled');
        // Update in MongoDB for booking records
        await BookingModel_1.Booking.findOneAndUpdate({ bookingId }, { status: 'cancelled' });
        res.json({
            success: true,
            data: {
                bookingId,
                status: 'cancelled',
                refundAmountPaise,
                refundStatus,
                cancellationFeePaise: booking.totalAmountPaise - refundAmountPaise,
                reason: reason || null,
                cancelledAt: new Date().toISOString(),
                message: refundAmountPaise === booking.totalAmountPaise
                    ? 'Booking cancelled. Full refund initiated.'
                    : refundAmountPaise > 0
                        ? `Booking cancelled. ${refundAmountPaise} paise refund initiated.`
                        : 'Booking cancelled. No refund available for late cancellation.',
            },
        });
        // Emit booking_cancelled event to REZ Mind
        rezMindClient.sendEvent({
            eventType: 'booking_cancelled',
            source: 'stayown',
            userId: req.user?.sub,
            data: {
                bookingId,
                propertyId: booking.propertyId,
                refundAmountPaise,
                reason,
            },
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('[StayOwn] Cancel booking error:', error);
        res.status(500).json({ success: false, message: 'Cancellation failed' });
    }
});
/**
 * Calculate pricing
 * POST /api/hotels/pricing/calculate
 *
 * Uses REZ Mind for dynamic pricing with caching and fallback
 * Public route - authentication optional for personalization
 */
router.post('/pricing/calculate', auth_1.optionalAuth, async (req, res) => {
    try {
        const data = pricingSchema.parse(req.body);
        const { propertyId, roomId, checkIn, checkOut } = data;
        const userId = req.user?.sub;
        // Find property and room
        const property = DEMO_PROPERTIES.find(p => p.propertyId === propertyId);
        if (!property) {
            // Try PMS
            const pmsPricing = await postToPMS('/v1/pricing/calculate', data);
            if (pmsPricing && pmsPricing.success && pmsPricing.data) {
                // Enhance PMS pricing with dynamic pricing from REZ Mind
                if (pmsPricing.data.baseRate) {
                    const dynamicPrice = await pricing_service_1.pricingService.getPrice({
                        hotelId: propertyId,
                        roomTypeId: roomId,
                        checkIn,
                        checkOut,
                        baseRate: pmsPricing.data.baseRate,
                        userId,
                    });
                    pmsPricing.data.dynamicPricing = dynamicPrice;
                    pmsPricing.data.pricingSource = dynamicPrice.pricingSource;
                }
                res.json({ success: true, data: pmsPricing.data });
                return;
            }
            res.status(404).json({ success: false, message: 'Property not found' });
            return;
        }
        const room = property.roomTypes.find(r => r.roomTypeId === roomId);
        if (!room) {
            res.status(404).json({ success: false, message: 'Room type not found' });
            return;
        }
        // Get dynamic pricing from REZ Mind with caching
        const dynamicPrice = await pricing_service_1.pricingService.getPrice({
            hotelId: propertyId,
            roomTypeId: roomId,
            checkIn,
            checkOut,
            baseRate: room.baseRate,
            userId,
        });
        res.json({
            success: true,
            data: {
                propertyId,
                roomTypeId: roomId,
                roomName: room.name,
                baseRate: room.baseRate,
                corporateRate: room.corporateRate,
                discount: room.discount,
                // Dynamic pricing from REZ Mind
                dynamicPricing: {
                    dynamicRate: dynamicPrice.dynamicRate,
                    discountPercent: dynamicPrice.discountPercent,
                    adjustedRate: dynamicPrice.adjustedRate,
                    finalRate: dynamicPrice.finalRate,
                    reason: dynamicPrice.reason,
                },
                nights: dynamicPrice.nights,
                subtotal: dynamicPrice.subtotal,
                taxableAmount: dynamicPrice.taxableAmount,
                cgstRate: dynamicPrice.cgstRate,
                cgstAmount: dynamicPrice.cgstAmount,
                sgstRate: dynamicPrice.sgstRate,
                sgstAmount: dynamicPrice.sgstAmount,
                totalTax: dynamicPrice.totalTax,
                totalAmount: dynamicPrice.totalAmount,
                itcEligible: true,
                pricingSource: dynamicPrice.pricingSource,
                cachedAt: dynamicPrice.cachedAt,
                expiresAt: dynamicPrice.expiresAt,
            },
        });
    }
    catch (error) {
        console.error('[StayOwn] Pricing error:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Invalid pricing data', errors: error.errors });
            return;
        }
        res.status(500).json({ success: false, message: 'Pricing calculation failed' });
    }
});
// ─── Payment Options Routes ──────────────────────────────────────────────────
/**
 * Payment Options for Booking
 * GET /api/hotels/:propertyId/payment-options
 */
router.get('/:propertyId/payment-options', auth_1.optionalAuth, async (req, res) => {
    try {
        const property = DEMO_PROPERTIES.find(p => p.propertyId === req.params.propertyId);
        // Get prepay discount from property or use default
        const prepayDiscount = property?.roomTypes[0]?.discount ?? 5;
        res.json({
            success: true,
            data: {
                options: [
                    {
                        id: 'prepay',
                        name: 'Pay Now',
                        description: 'Prepay and save more',
                        discount: prepayDiscount,
                        icon: 'card',
                        popular: true,
                    },
                    {
                        id: 'pay_at_hotel',
                        name: 'Pay at Hotel',
                        description: 'Pay when you arrive',
                        discount: 0,
                        icon: 'cash',
                        popular: false,
                        requiresCreditCard: true, // For incidentals
                    },
                    {
                        id: 'partial',
                        name: 'Partial Payment',
                        description: 'Pay 30% now, rest at checkout',
                        discount: 2,
                        icon: 'wallet',
                        popular: false,
                    },
                ],
                defaultOption: 'prepay',
            },
        });
    }
    catch (error) {
        console.error('[StayOwn] Payment options error:', error);
        res.status(500).json({ success: false, message: 'Failed to get payment options' });
    }
});
/**
 * Create booking with payment option
 * POST /api/hotels/bookings
 * Protected route - requires JWT authentication
 * Rate limited: 10 requests per minute
 */
router.post('/bookings', rateLimiter_1.rateLimiters.hotelBooking, auth_1.authenticateToken, async (req, res) => {
    try {
        // Extended schema for payment options
        const extendedBookingSchema = bookingSchema.extend({
            paymentOption: zod_1.z.enum(['prepay', 'pay_at_hotel', 'partial']).optional().default('prepay'),
        });
        const data = extendedBookingSchema.parse(req.body);
        const { propertyId, roomId, checkIn, checkOut, guests, guestDetails, paymentOption = 'prepay', } = data;
        // Find property and room
        const property = DEMO_PROPERTIES.find(p => p.propertyId === propertyId);
        if (!property) {
            res.status(404).json({ success: false, message: 'Property not found' });
            return;
        }
        const room = property.roomTypes.find(r => r.roomTypeId === roomId);
        if (!room) {
            res.status(404).json({ success: false, message: 'Room not found' });
            return;
        }
        // Calculate pricing
        const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
        const basePricing = calculatePricing(room.corporateRate, nights);
        // Calculate pricing based on payment option
        let totalAmount = basePricing.totalAmount;
        let upfrontAmount = totalAmount;
        let payAtHotelAmount = 0;
        // Apply payment option discounts
        switch (paymentOption) {
            case 'prepay':
                // Full payment now with discount
                upfrontAmount = totalAmount;
                break;
            case 'pay_at_hotel':
                // 10% booking fee now, rest at hotel
                upfrontAmount = Math.floor(totalAmount * 0.1);
                payAtHotelAmount = totalAmount - upfrontAmount;
                break;
            case 'partial':
                // 30% now, 70% at checkout
                upfrontAmount = Math.floor(totalAmount * 0.3);
                payAtHotelAmount = totalAmount - upfrontAmount;
                break;
        }
        // Create local booking record
        const bookingId = `HB${Date.now()}`;
        const confirmationNumber = `MCB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${crypto_1.default.randomUUID().split('-')[0]}`;
        // Save booking to MongoDB
        const dbBooking = await BookingModel_1.Booking.create({
            bookingId,
            confirmationNumber,
            userId: req.user?.sub || 'anonymous',
            paymentOption,
            totalAmountPaise: totalAmount,
            upfrontAmountPaise: upfrontAmount,
            payAtHotelAmountPaise: payAtHotelAmount,
            paymentOptionDetails: {
                description: paymentOption === 'prepay'
                    ? 'Full payment made'
                    : paymentOption === 'pay_at_hotel'
                        ? `Pay ₹${(payAtHotelAmount / 100).toFixed(0)} at hotel`
                        : `Pay ₹${(payAtHotelAmount / 100).toFixed(0)} at checkout`,
            },
            status: 'confirmed',
            property: {
                propertyId,
                name: property.name,
                address: `${property.address.line1}, ${property.address.city}`,
            },
            room: {
                roomTypeId: roomId,
                name: room.name,
                bedType: room.bedType,
            },
            guest: guestDetails?.[0] || { firstName: 'Guest', lastName: 'User' },
            dates: { checkIn, checkOut, nights },
            pricing: basePricing,
        });
        // Create Razorpay order for upfront amount (for prepay and partial)
        let razorpayOrderId = null;
        if (upfrontAmount > 0 && paymentOption !== 'pay_at_hotel') {
            try {
                const razorpayOrder = await (0, razorpay_service_1.createRazorpayOrder)({
                    amountPaise: upfrontAmount,
                    bookingId,
                    customerEmail: guestDetails?.[0]?.email,
                    customerPhone: guestDetails?.[0]?.phone,
                    notes: { propertyName: property.name, roomType: room.name },
                });
                razorpayOrderId = razorpayOrder.id;
                // Update booking with razorpay order ID
                await BookingModel_1.Booking.findOneAndUpdate({ bookingId }, { razorpayOrderId });
            }
            catch (error) {
                console.error('[StayOwn] Failed to create Razorpay order:', error);
                // Continue without payment - booking is in 'confirmed' state but payment pending
            }
        }
        res.status(201).json({
            success: true,
            data: {
                bookingId,
                confirmationNumber,
                paymentOption,
                totalAmountPaise: totalAmount,
                upfrontAmountPaise: upfrontAmount,
                payAtHotelAmountPaise: payAtHotelAmount,
                razorpayOrderId,
                paymentOptionDetails: dbBooking.paymentOptionDetails,
                status: 'confirmed',
                property: dbBooking.property,
                room: dbBooking.room,
                guest: dbBooking.guest,
                dates: dbBooking.dates,
                pricing: basePricing,
            },
        });
        // Emit booking_created event to REZ Mind
        rezMindClient.sendEvent({
            eventType: 'booking_created',
            source: 'stayown',
            userId: req.user?.sub,
            data: {
                bookingId,
                confirmationNumber,
                propertyId,
                propertyName: property.name,
                roomTypeId: roomId,
                roomName: room.name,
                checkIn,
                checkOut,
                nights,
                totalAmountPaise: totalAmount,
                paymentOption,
                guestDetails: guestDetails?.[0] || null,
            },
            timestamp: new Date(),
        });
    }
    catch (error) {
        console.error('[StayOwn] Booking error:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Invalid booking data', errors: error.errors });
            return;
        }
        res.status(500).json({ success: false, message: 'Booking failed' });
    }
});
exports.default = router;
//# sourceMappingURL=stayownRoutes.js.map