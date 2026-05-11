"use strict";
/**
 * Booking Model for StayOwn Service
 *
 * Stores hotel booking records with MongoDB persistence.
 * Replaces in-memory bookingsStore Map.
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
exports.Booking = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BookingSchema = new mongoose_1.Schema({
    bookingId: { type: String, required: true, unique: true, index: true },
    confirmationNumber: { type: String, required: true, index: true },
    pmsBookingId: { type: String, sparse: true },
    userId: { type: String, required: true, index: true },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'confirmed',
    },
    property: {
        propertyId: { type: String, required: true },
        name: { type: String, required: true },
        address: { type: String, required: true },
    },
    room: {
        roomTypeId: { type: String, required: true },
        name: { type: String, required: true },
        bedType: { type: String, required: true },
    },
    guest: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: String,
        phone: String,
    },
    dates: {
        checkIn: { type: String, required: true },
        checkOut: { type: String, required: true },
        nights: { type: Number, required: true },
    },
    pricing: {
        baseRate: { type: Number, required: true },
        nights: { type: Number, required: true },
        subtotal: { type: Number, required: true },
        taxableAmount: { type: Number, required: true },
        cgstRate: { type: Number, required: true },
        cgstAmount: { type: Number, required: true },
        sgstRate: { type: Number, required: true },
        sgstAmount: { type: Number, required: true },
        totalTax: { type: Number, required: true },
        totalAmount: { type: Number, required: true },
        itcEligible: { type: Boolean, default: true },
    },
    paymentOption: {
        type: String,
        enum: ['prepay', 'pay_at_hotel', 'partial'],
    },
    totalAmountPaise: { type: Number, required: true },
    upfrontAmountPaise: Number,
    payAtHotelAmountPaise: Number,
    paymentOptionDetails: {
        description: String,
    },
}, { timestamps: true });
// Compound indexes for common query patterns
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ 'property.propertyId': 1, status: 1 });
BookingSchema.index({ status: 1, createdAt: -1 });
// Index for PMS booking ID lookups
BookingSchema.index({ pmsBookingId: 1 }, { sparse: true });
exports.Booking = mongoose_1.default.model('Booking', BookingSchema);
//# sourceMappingURL=BookingModel.js.map