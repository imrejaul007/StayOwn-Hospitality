"use strict";
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
exports.ChannelBooking = exports.Inventory = exports.Channel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ChannelSettingsSchema = new mongoose_1.Schema({
    inventorySync: { type: Boolean, default: true },
    priceSync: { type: Boolean, default: true },
    bookingSync: { type: Boolean, default: true },
    reviewSync: { type: Boolean, default: false },
    autoConfirm: { type: Boolean, default: true },
    commissionRate: { type: Number, default: 15 },
    markupRate: { type: Number, default: 0 }
}, { _id: false });
const CredentialsSchema = new mongoose_1.Schema({
    apiKey: String,
    apiSecret: String,
    propertyId: String,
    username: String,
    password: String
}, { _id: false });
const ChannelSchema = new mongoose_1.Schema({
    hotelId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    otaType: {
        type: String,
        enum: ['booking', 'makemytrip', 'goibibo', 'yatra', 'airbnb', 'agoda', 'custom'],
        required: true
    },
    credentials: CredentialsSchema,
    status: {
        type: String,
        enum: ['connected', 'syncing', 'error', 'disconnected'],
        default: 'disconnected'
    },
    lastSync: Date,
    lastError: String,
    syncInterval: { type: Number, default: 15 },
    enabled: { type: Boolean, default: true },
    settings: { type: ChannelSettingsSchema, default: () => ({}) }
}, { timestamps: true });
ChannelSchema.index({ hotelId: 1, otaType: 1 }, { unique: true });
exports.Channel = mongoose_1.default.models.Channel ||
    mongoose_1.default.model('Channel', ChannelSchema);
const InventorySchema = new mongoose_1.Schema({
    hotelId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    date: { type: Date, required: true, index: true },
    roomTypeId: { type: String, required: true },
    totalRooms: { type: Number, required: true },
    availableRooms: { type: Number, required: true },
    blockedRooms: { type: Number, default: 0 },
    synced: { type: Boolean, default: false },
    syncedAt: Date,
    syncedChannels: [String]
});
InventorySchema.index({ hotelId: 1, date: 1, roomTypeId: 1 }, { unique: true });
exports.Inventory = mongoose_1.default.models.Inventory ||
    mongoose_1.default.model('Inventory', InventorySchema);
const BookingSchema = new mongoose_1.Schema({
    hotelId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    channelBookingId: { type: String, required: true },
    channelType: {
        type: String,
        enum: ['booking', 'makemytrip', 'goibibo', 'yatra', 'airbnb', 'agoda', 'custom'],
        required: true
    },
    guestName: { type: String, required: true },
    guestEmail: String,
    guestPhone: { type: String, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    roomType: { type: String, required: true },
    rooms: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    commission: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    guestRequests: String,
    source: String
}, { timestamps: true });
BookingSchema.index({ hotelId: 1, channelType: 1, checkIn: 1 });
exports.ChannelBooking = mongoose_1.default.models.ChannelBooking ||
    mongoose_1.default.model('ChannelBooking', BookingSchema);
//# sourceMappingURL=ChannelManager.js.map