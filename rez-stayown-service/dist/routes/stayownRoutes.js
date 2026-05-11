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
const auth_1 = require("../middleware/auth");
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
    },
];
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
        console.warn(`[StayOwn] PMS fetch failed for ${endpoint}`);
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
        console.error(`[StayOwn] PMS post failed for ${endpoint}:`, error);
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
// ─── Routes ───────────────────────────────────────────────────────────────────
/**
 * Search hotels
 * GET /api/hotels/search?city=Mumbai
 */
router.get('/search', auth_1.authenticateToken, async (req, res) => {
    try {
        const { city, checkIn, checkOut, guests } = searchSchema.parse(req.query);
        let properties = DEMO_PROPERTIES;
        if (city) {
            properties = properties.filter(p => p.address.city.toLowerCase().includes(city.toLowerCase()));
        }
        // Try to fetch from PMS for real data
        const pmsHotels = await fetchFromPMS(`/v1/hotels?city=${city || ''}`);
        if (pmsHotels && pmsHotels.success && pmsHotels.data) {
            properties = pmsHotels.data;
        }
        res.json({
            success: true,
            data: {
                hotels: properties,
                total: properties.length,
                filters: { city, checkIn, checkOut, guests },
            },
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
 */
router.get('/:propertyId', auth_1.authenticateToken, async (req, res) => {
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
 */
router.get('/:propertyId/availability', auth_1.authenticateToken, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { checkIn, checkOut } = req.query;
        // Try PMS for real availability
        const pmsAvailability = await fetchFromPMS(`/v1/hotels/${propertyId}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
        if (pmsAvailability && pmsAvailability.success && pmsAvailability.data) {
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
        res.json({
            success: true,
            data: {
                propertyId,
                checkIn,
                checkOut,
                roomTypes: availableRooms,
                total: availableRooms.length,
            },
        });
    }
    catch (error) {
        console.error('[StayOwn] Availability error:', error);
        res.status(500).json({ success: false, message: 'Failed to check availability' });
    }
});
/**
 * Create booking
 * POST /api/hotels/bookings
 */
router.post('/bookings', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = bookingSchema.parse(req.body);
        const { propertyId, roomId, checkIn, checkOut, guests, guestDetails } = data;
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
        const pricing = calculatePricing(room.corporateRate, nights);
        // Try to create booking in PMS
        const pmsBooking = await postToPMS('/v1/bookings/hold', {
            propertyId,
            roomTypeId: roomId,
            checkIn,
            checkOut,
            guestDetails,
            pricing,
        });
        // Create local booking record
        const bookingId = `HB${Date.now()}`;
        const confirmationNumber = `MCB${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        const booking = {
            bookingId,
            confirmationNumber,
            pmsBookingId: pmsBooking?.data?.bookingId || null,
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
            pricing,
            createdAt: new Date().toISOString(),
        };
        res.status(201).json({
            success: true,
            data: booking,
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
/**
 * Get all bookings
 * GET /api/hotels/bookings
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
/**
 * Cancel booking
 * POST /api/hotels/bookings/:bookingId/cancel
 */
router.post('/bookings/:bookingId/cancel', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bookingId } = req.params;
        // Try PMS cancellation
        const result = await postToPMS(`/v1/bookings/${bookingId}/cancel`, {});
        if (result?.success) {
            res.json({ success: true, data: result.data });
            return;
        }
        res.status(404).json({ success: false, message: 'Booking not found or cancellation failed' });
    }
    catch (error) {
        console.error('[StayOwn] Cancel booking error:', error);
        res.status(500).json({ success: false, message: 'Cancellation failed' });
    }
});
/**
 * Calculate pricing
 * POST /api/hotels/pricing/calculate
 */
router.post('/pricing/calculate', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = pricingSchema.parse(req.body);
        const { propertyId, roomId, checkIn, checkOut } = data;
        // Find property and room
        const property = DEMO_PROPERTIES.find(p => p.propertyId === propertyId);
        if (!property) {
            // Try PMS
            const pmsPricing = await postToPMS('/v1/pricing/calculate', data);
            if (pmsPricing && pmsPricing.success && pmsPricing.data) {
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
        const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
        const pricing = calculatePricing(room.corporateRate, nights);
        res.json({
            success: true,
            data: {
                propertyId,
                roomTypeId: roomId,
                roomName: room.name,
                baseRate: room.baseRate,
                corporateRate: room.corporateRate,
                discount: room.discount,
                nights: pricing.nights,
                subtotal: pricing.subtotal,
                taxableAmount: pricing.taxableAmount,
                cgstRate: pricing.cgstRate,
                cgstAmount: pricing.cgstAmount,
                sgstRate: pricing.sgstRate,
                sgstAmount: pricing.sgstAmount,
                totalTax: pricing.totalTax,
                totalAmount: pricing.totalAmount,
                itcEligible: pricing.itcEligible,
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
exports.default = router;
//# sourceMappingURL=stayownRoutes.js.map