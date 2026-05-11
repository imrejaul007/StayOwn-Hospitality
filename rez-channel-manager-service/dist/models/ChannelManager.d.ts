import mongoose, { Document } from 'mongoose';
export type ChannelStatus = 'connected' | 'syncing' | 'error' | 'disconnected';
export type OTAType = 'booking' | 'makemytrip' | 'goibibo' | 'yatra' | 'airbnb' | 'agoda' | 'custom';
export interface IChannel extends Document {
    _id: mongoose.Types.ObjectId;
    hotelId: mongoose.Types.ObjectId;
    otaType: OTAType;
    credentials: {
        apiKey?: string;
        apiSecret?: string;
        propertyId?: string;
        username?: string;
        password?: string;
    };
    status: ChannelStatus;
    lastSync?: Date;
    lastError?: string;
    syncInterval: number;
    enabled: boolean;
    settings: IChannelSettings;
    createdAt: Date;
    updatedAt: Date;
}
export interface IChannelSettings {
    inventorySync: boolean;
    priceSync: boolean;
    bookingSync: boolean;
    reviewSync: boolean;
    autoConfirm: boolean;
    commissionRate: number;
    markupRate: number;
}
export interface IInventory extends Document {
    _id: mongoose.Types.ObjectId;
    hotelId: mongoose.Types.ObjectId;
    date: Date;
    roomTypeId: string;
    totalRooms: number;
    availableRooms: number;
    blockedRooms: number;
    synced: boolean;
    syncedAt?: Date;
    syncedChannels: string[];
}
export interface IBooking extends Document {
    _id: mongoose.Types.ObjectId;
    hotelId: mongoose.Types.ObjectId;
    channelBookingId: string;
    channelType: OTAType;
    guestName: string;
    guestEmail?: string;
    guestPhone: string;
    checkIn: Date;
    checkOut: Date;
    roomType: string;
    rooms: number;
    totalAmount: number;
    commission: number;
    netAmount: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    guestRequests?: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Channel: mongoose.Model<any, {}, {}, {}, any, any, any>;
export declare const Inventory: mongoose.Model<any, {}, {}, {}, any, any, any>;
export declare const ChannelBooking: mongoose.Model<any, {}, {}, {}, any, any, any>;
//# sourceMappingURL=ChannelManager.d.ts.map