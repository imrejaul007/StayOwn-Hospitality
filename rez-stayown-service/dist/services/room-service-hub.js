"use strict";
/**
 * Room Service Hub Backend
 *
 * API for the Room Service Hub mobile app:
 * - Get hotel and room info
 * - Order room service
 * - Request housekeeping
 * - Concierge requests
 * - Checkout
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomServiceHub = void 0;
const room_qr_1 = require("../room-qr");
const room_qr_2 = require("../room-qr");
const room_qr_3 = require("../room-qr");
const room_qr_4 = require("../room-qr");
const sla_monitor_1 = require("./sla-monitor");
const rez_mind_client_1 = require("./rez-mind-client");
const axios_1 = __importDefault(require("axios"));
const HOTEL_PMS_URL = process.env.HOTEL_PMS_URL || 'http://localhost:3008';
// ─── Service Catalog ────────────────────────────────────────────────────────────
const SERVICE_CATALOG = {
    food: [
        {
            id: 'breakfast',
            name: 'Breakfast',
            icon: 'cafe-outline',
            description: 'Continental & Indian breakfast',
            actionType: 'food',
            estimatedTime: '20-30 mins',
            priceRange: '₹300-800',
        },
        {
            id: 'lunch',
            name: 'Lunch',
            icon: 'restaurant-outline',
            description: 'Multi-cuisine lunch buffet',
            actionType: 'food',
            estimatedTime: '30-45 mins',
            priceRange: '₹500-1200',
        },
        {
            id: 'dinner',
            name: 'Dinner',
            icon: 'moon-outline',
            description: 'Dinner with live counters',
            actionType: 'food',
            estimatedTime: '30-45 mins',
            priceRange: '₹600-1500',
        },
        {
            id: 'late-night',
            name: 'Late Night Snacks',
            icon: 'snow-outline',
            description: 'Sandwiches, noodles, beverages',
            actionType: 'food',
            estimatedTime: '15-20 mins',
            priceRange: '₹200-500',
        },
    ],
    housekeeping: [
        {
            id: 'room-cleaning',
            name: 'Room Cleaning',
            icon: 'sparkles-outline',
            description: 'Full room cleaning service',
            actionType: 'housekeeping',
            estimatedTime: '30-45 mins',
        },
        {
            id: 'extra-towels',
            name: 'Extra Towels',
            icon: 'water-outline',
            description: 'Fresh towels delivered',
            actionType: 'housekeeping',
            estimatedTime: '10-15 mins',
        },
        {
            id: 'turn-down',
            name: 'Turn Down Service',
            icon: 'bed-outline',
            description: 'Evening bed preparation',
            actionType: 'housekeeping',
            estimatedTime: '15-20 mins',
        },
        {
            id: 'amenities',
            name: 'Extra Amenities',
            icon: 'gift-outline',
            description: 'Toiletries, slippers, robes',
            actionType: 'housekeeping',
            estimatedTime: '10-15 mins',
        },
    ],
    laundry: [
        {
            id: 'wash-fold',
            name: 'Wash & Fold',
            icon: 'shirt-outline',
            description: 'Regular laundry service',
            actionType: 'laundry',
            estimatedTime: '4-6 hours',
            priceRange: '₹50-200/item',
        },
        {
            id: 'dry-clean',
            name: 'Dry Cleaning',
            icon: 'briefcase-outline',
            description: 'Premium dry cleaning',
            actionType: 'laundry',
            estimatedTime: '24 hours',
            priceRange: '₹150-500/item',
        },
        {
            id: 'ironing',
            name: 'Express Ironing',
            icon: 'flash-outline',
            description: 'Quick ironing service',
            actionType: 'laundry',
            estimatedTime: '1-2 hours',
            priceRange: '₹30-100/item',
        },
    ],
    concierge: [
        {
            id: 'taxi',
            name: 'Book a Taxi',
            icon: 'car-outline',
            description: 'Airport/station transfers',
            actionType: 'concierge',
            estimatedTime: 'Instant booking',
        },
        {
            id: 'restaurant',
            name: 'Restaurant Booking',
            icon: 'calendar-outline',
            description: 'Book tables at partner restaurants',
            actionType: 'concierge',
            estimatedTime: 'Instant confirmation',
        },
        {
            id: 'tour',
            name: 'City Tours',
            icon: 'map-outline',
            description: 'Guided city tours & sightseeing',
            actionType: 'concierge',
            estimatedTime: 'Varies',
        },
        {
            id: 'medical',
            name: 'Medical Assistance',
            icon: 'medkit-outline',
            description: 'Doctor on call, pharmacy',
            actionType: 'concierge',
            estimatedTime: '30-60 mins',
        },
    ],
    minibar: [
        {
            id: 'beverages',
            name: 'Beverages',
            icon: 'beer-outline',
            description: 'Soft drinks, juices, water',
            actionType: 'minibar',
            estimatedTime: '5-10 mins',
            priceRange: '₹50-300',
        },
        {
            id: 'snacks',
            name: 'Snacks',
            icon: 'pizza-outline',
            description: 'Chips, nuts, chocolates',
            actionType: 'minibar',
            estimatedTime: '5-10 mins',
            priceRange: '₹100-500',
        },
        {
            id: 'liquor',
            name: 'Premium Liquor',
            icon: 'wine-outline',
            description: 'Wines, spirits, beer',
            actionType: 'minibar',
            estimatedTime: '5-10 mins',
            priceRange: '₹300-2000',
        },
    ],
    spa: [
        {
            id: 'massage',
            name: 'Swedish Massage',
            icon: 'hand-right-outline',
            description: '60 min relaxing massage',
            actionType: 'spa',
            estimatedTime: '60 mins',
            priceRange: '₹1500-3000',
        },
        {
            id: 'facial',
            name: 'Facial Treatment',
            icon: 'happy-outline',
            description: 'Rejuvenating facial',
            actionType: 'spa',
            estimatedTime: '45-60 mins',
            priceRange: '₹1200-2500',
        },
        {
            id: 'steam',
            name: 'Steam & Sauna',
            icon: 'thermometer-outline',
            description: 'Access to steam room',
            actionType: 'spa',
            estimatedTime: '30 mins',
            priceRange: '₹500-800',
        },
    ],
    transport: [
        {
            id: 'airport-pickup',
            name: 'Airport Pickup',
            icon: 'airplane-outline',
            description: 'AC car from airport',
            actionType: 'transport',
            estimatedTime: 'Pre-booked',
            priceRange: '₹800-1500',
        },
        {
            id: 'local-tour',
            name: 'Local Sightseeing',
            icon: 'location-outline',
            description: 'AC car for city tour',
            actionType: 'transport',
            estimatedTime: '4-8 hours',
            priceRange: '₹2000-5000',
        },
    ],
};
// ─── Room Service Hub Service ──────────────────────────────────────────────────
exports.roomServiceHub = {
    /**
     * Get room service info for QR scan
     */
    async getRoomServiceInfo(params) {
        try {
            // Try to get from PMS
            try {
                const response = await axios_1.default.get(`${HOTEL_PMS_URL}/v1/room-service/info`, {
                    params: {
                        hotelId: params.hotelId,
                        roomId: params.roomId,
                    },
                    timeout: 5000,
                });
                if (response.data?.success) {
                    return response.data.data;
                }
            }
            catch {
                // Fall through to local lookup
            }
            // Get from local QR record
            let roomQR;
            if (params.token) {
                const validation = await (0, room_qr_1.validateRoomQRToken)(params.token);
                if (validation.valid && validation.bookingId) {
                    roomQR = await (0, room_qr_1.getRoomQRByBookingId)(validation.bookingId);
                }
            }
            else if (params.bookingId) {
                roomQR = await (0, room_qr_1.getRoomQRByBookingId)(params.bookingId);
            }
            if (!roomQR) {
                return null;
            }
            // Get hotel info from PMS
            let hotelName = 'Hotel';
            let amenities = [];
            try {
                const hotelRes = await axios_1.default.get(`${HOTEL_PMS_URL}/v1/hotels/${roomQR.hotelId}`, {
                    timeout: 5000,
                });
                if (hotelRes.data?.success) {
                    hotelName = hotelRes.data.data.name || hotelName;
                    amenities = hotelRes.data.data.amenities || [];
                }
            }
            catch {
                // Use defaults
            }
            // Build services list
            const services = [
                ...SERVICE_CATALOG.food,
                ...SERVICE_CATALOG.housekeeping,
                ...SERVICE_CATALOG.laundry,
                ...SERVICE_CATALOG.concierge,
                ...SERVICE_CATALOG.minibar,
                ...SERVICE_CATALOG.spa,
                ...SERVICE_CATALOG.transport,
            ];
            return {
                hotelId: roomQR.hotelId,
                hotelName,
                roomId: roomQR.roomId,
                roomNumber: roomQR.roomNumber,
                services,
                amenities,
                checkIn: roomQR.checkIn.toISOString(),
                checkOut: roomQR.checkOut.toISOString(),
                guestName: roomQR.guestName,
                bookingId: roomQR.bookingId,
            };
        }
        catch (error) {
            console.error('[RoomServiceHub] Get info failed:', error);
            return null;
        }
    },
    /**
     * Order room service
     */
    async orderService(request) {
        try {
            // Calculate total
            const totalPaise = request.items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
            // Create charge record
            const charge = await (0, room_qr_2.recordServiceCharge)({
                bookingId: request.bookingId,
                hotelId: request.hotelId,
                roomId: request.roomId,
                category: request.serviceType,
                description: `${request.serviceType} order: ${request.items.map(i => i.name).join(', ')}`,
                amountPaise: totalPaise,
                quantity: request.items.reduce((sum, i) => sum + i.quantity, 0),
                unitPricePaise: totalPaise,
                source: 'room_service',
            });
            // Record SLA tracking for this service request
            try {
                await sla_monitor_1.slaMonitor.recordRequestCreated({
                    requestId: charge.id,
                    bookingId: request.bookingId,
                    hotelId: request.hotelId,
                    roomId: request.roomId,
                    roomNumber: '', // Will be filled from room details
                    guestName: '', // Will be filled from booking
                    serviceType: request.serviceType,
                    priority: 'medium',
                });
                console.log(`[RoomServiceHub] SLA tracking started for order ${charge.id}`);
            }
            catch (slaError) {
                // Non-critical: log but don't fail the order
                console.error('[RoomServiceHub] SLA tracking failed:', slaError);
            }
            // Notify PMS
            try {
                await axios_1.default.post(`${HOTEL_PMS_URL}/v1/room-service/request`, {
                    bookingId: request.bookingId,
                    hotelId: request.hotelId,
                    roomId: request.roomId,
                    serviceType: request.serviceType,
                    items: request.items,
                    totalPaise,
                    specialInstructions: request.specialInstructions,
                    slaRequestId: charge.id, // For SLA tracking on PMS side
                }, {
                    timeout: 5000,
                    headers: {
                        'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
                    },
                });
            }
            catch {
                // Continue even if PMS notification fails
            }
            // Emit service_ordered event to REZ Mind
            rez_mind_client_1.rezMindClient.sendEvent({
                eventType: 'service_ordered',
                source: 'stayown',
                data: {
                    bookingId: request.bookingId,
                    hotelId: request.hotelId,
                    roomId: request.roomId,
                    serviceType: request.serviceType,
                    items: request.items,
                    totalPaise,
                    orderId: charge.id,
                    specialInstructions: request.specialInstructions,
                },
                timestamp: new Date(),
            });
            // Estimate time based on service type
            const timeEstimates = {
                food: '20-30 mins',
                housekeeping: '15-45 mins',
                laundry: '2-6 hours',
                concierge: 'Instant-1 hour',
                minibar: '5-10 mins',
                spa: '30-90 mins',
                transport: 'Pre-booked',
            };
            return {
                success: true,
                orderId: charge.id,
                estimatedTime: timeEstimates[request.serviceType] || '30 mins',
                totalPaise,
            };
        }
        catch (error) {
            console.error('[RoomServiceHub] Order failed:', error);
            return {
                success: false,
                error: error.message || 'Failed to place order',
            };
        }
    },
    /**
     * Record staff assignment to a service request (for SLA tracking)
     */
    async assignStaffToRequest(params) {
        try {
            await sla_monitor_1.slaMonitor.recordAssignment({
                requestId: params.requestId,
                staffId: params.staffId,
                staffName: params.staffName,
            });
            // Notify PMS of assignment
            try {
                await axios_1.default.patch(`${HOTEL_PMS_URL}/v1/room-service/request/${params.requestId}/assign`, {
                    staffId: params.staffId,
                    staffName: params.staffName,
                    assignedAt: new Date().toISOString(),
                }, {
                    timeout: 5000,
                    headers: {
                        'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
                    },
                });
            }
            catch {
                // Continue even if PMS notification fails
            }
            return { success: true };
        }
        catch (error) {
            console.error('[RoomServiceHub] Assignment failed:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Record service completion (for SLA tracking)
     */
    async completeServiceRequest(params) {
        try {
            await sla_monitor_1.slaMonitor.recordCompletion({
                requestId: params.requestId,
                notes: params.notes,
            });
            // Notify PMS of completion
            try {
                await axios_1.default.patch(`${HOTEL_PMS_URL}/v1/room-service/request/${params.requestId}/complete`, {
                    completedAt: new Date().toISOString(),
                    notes: params.notes,
                }, {
                    timeout: 5000,
                    headers: {
                        'x-service-key': process.env.INTERNAL_SERVICE_TOKEN || '',
                    },
                });
            }
            catch {
                // Continue even if PMS notification fails
            }
            return { success: true };
        }
        catch (error) {
            console.error('[RoomServiceHub] Complete request failed:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get services menu
     */
    async getServicesMenu(hotelId) {
        // Try to get from PMS first
        try {
            const response = await axios_1.default.get(`${HOTEL_PMS_URL}/v1/room-service/menu/${hotelId}`, {
                timeout: 5000,
            });
            if (response.data?.success) {
                return response.data.data;
            }
        }
        catch {
            // Use default catalog
        }
        return SERVICE_CATALOG;
    },
    /**
     * Get current charges/bill
     */
    async getCurrentBill(bookingId) {
        try {
            const charges = await (0, room_qr_4.getChargesForBooking)(bookingId);
            const subtotalPaise = charges.reduce((sum, c) => sum + c.amountPaise, 0);
            const taxesPaise = Math.round(subtotalPaise * 0.18);
            return {
                charges: charges.map(c => ({
                    id: c.id,
                    description: c.description,
                    amountPaise: c.amountPaise,
                    category: c.category,
                    date: c.createdAt.toISOString(),
                })),
                subtotalPaise,
                taxesPaise,
                totalPaise: subtotalPaise + taxesPaise,
            };
        }
        catch (error) {
            console.error('[RoomServiceHub] Get bill failed:', error);
            return null;
        }
    },
    /**
     * Process checkout
     */
    async processCheckout(request) {
        try {
            // Get checkout summary
            const bill = await (0, room_qr_3.getCheckoutBill)(request.bookingId);
            if (!bill) {
                return {
                    success: false,
                    error: 'Bill not found',
                    totalAmountPaise: 0,
                    serviceChargesPaise: 0,
                    roomChargesPaise: 0,
                    taxesPaise: 0,
                    balanceDuePaise: 0,
                };
            }
            // If payment required, generate payment link
            if (bill.balanceDuePaise > 0) {
                const { paymentService } = await Promise.resolve().then(() => __importStar(require('./payment-service')));
                const payment = await paymentService.initializePayment({
                    bookingId: request.bookingId,
                    hotelId: request.hotelId,
                    amountPaise: bill.balanceDuePaise,
                    customerName: bill.guestName,
                    customerEmail: '',
                    customerPhone: '',
                    description: `Hotel checkout - Room ${bill.roomNumber}`,
                });
                if (!payment.success) {
                    return {
                        success: false,
                        error: payment.error,
                        totalAmountPaise: bill.totalPaise,
                        serviceChargesPaise: bill.serviceCharges.reduce((s, c) => s + c.totalPaise, 0),
                        roomChargesPaise: bill.roomCharges.reduce((s, c) => s + c.totalPaise, 0),
                        taxesPaise: bill.taxesPaise,
                        balanceDuePaise: bill.balanceDuePaise,
                    };
                }
                const response = {
                    success: true,
                    checkoutId: `CHK${Date.now()}`,
                    totalAmountPaise: bill.totalPaise,
                    serviceChargesPaise: bill.serviceCharges.reduce((s, c) => s + c.totalPaise, 0),
                    roomChargesPaise: bill.roomCharges.reduce((s, c) => s + c.totalPaise, 0),
                    taxesPaise: bill.taxesPaise,
                    balanceDuePaise: bill.balanceDuePaise,
                    paymentLink: payment.checkoutUrl,
                };
                // Emit checkout_completed event to REZ Mind
                rez_mind_client_1.rezMindClient.sendEvent({
                    eventType: 'checkout_completed',
                    source: 'stayown',
                    data: {
                        bookingId: request.bookingId,
                        hotelId: request.hotelId,
                        roomId: request.roomId,
                        checkoutId: response.checkoutId,
                        totalAmountPaise: response.totalAmountPaise,
                        serviceChargesPaise: response.serviceChargesPaise,
                        roomChargesPaise: response.roomChargesPaise,
                        taxesPaise: response.taxesPaise,
                        balanceDuePaise: response.balanceDuePaise,
                        paymentMethod: request.paymentMethod,
                        hasPaymentLink: !!response.paymentLink,
                    },
                    timestamp: new Date(),
                });
                return response;
            }
            // No payment needed
            const response = {
                success: true,
                checkoutId: `CHK${Date.now()}`,
                totalAmountPaise: bill.totalPaise,
                serviceChargesPaise: bill.serviceCharges.reduce((s, c) => s + c.totalPaise, 0),
                roomChargesPaise: bill.roomCharges.reduce((s, c) => s + c.totalPaise, 0),
                taxesPaise: bill.taxesPaise,
                balanceDuePaise: 0,
            };
            // Emit checkout_completed event to REZ Mind
            rez_mind_client_1.rezMindClient.sendEvent({
                eventType: 'checkout_completed',
                source: 'stayown',
                data: {
                    bookingId: request.bookingId,
                    hotelId: request.hotelId,
                    roomId: request.roomId,
                    checkoutId: response.checkoutId,
                    totalAmountPaise: response.totalAmountPaise,
                    serviceChargesPaise: response.serviceChargesPaise,
                    roomChargesPaise: response.roomChargesPaise,
                    taxesPaise: response.taxesPaise,
                    balanceDuePaise: response.balanceDuePaise,
                    paymentMethod: request.paymentMethod,
                    hasPaymentLink: false,
                },
                timestamp: new Date(),
            });
            return response;
        }
        catch (error) {
            console.error('[RoomServiceHub] Checkout failed:', error);
            return {
                success: false,
                error: error.message || 'Checkout failed',
                totalAmountPaise: 0,
                serviceChargesPaise: 0,
                roomChargesPaise: 0,
                taxesPaise: 0,
                balanceDuePaise: 0,
            };
        }
    },
};
exports.default = exports.roomServiceHub;
//# sourceMappingURL=room-service-hub.js.map