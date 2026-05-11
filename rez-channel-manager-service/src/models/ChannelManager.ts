import mongoose, { Schema, Document } from 'mongoose';

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
  syncInterval: number; // minutes
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

const ChannelSettingsSchema = new Schema({
  inventorySync: { type: Boolean, default: true },
  priceSync: { type: Boolean, default: true },
  bookingSync: { type: Boolean, default: true },
  reviewSync: { type: Boolean, default: false },
  autoConfirm: { type: Boolean, default: true },
  commissionRate: { type: Number, default: 15 },
  markupRate: { type: Number, default: 0 }
}, { _id: false });

const CredentialsSchema = new Schema({
  apiKey: String,
  apiSecret: String,
  propertyId: String,
  username: String,
  password: String
}, { _id: false });

const ChannelSchema = new Schema({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
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

export const Channel = mongoose.models.Channel ||
  mongoose.model<IChannel>('Channel', ChannelSchema);

const InventorySchema = new Schema({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
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

export const Inventory = mongoose.models.Inventory ||
  mongoose.model<IInventory>('Inventory', InventorySchema);

const BookingSchema = new Schema({
  hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
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

export const ChannelBooking = mongoose.models.ChannelBooking ||
  mongoose.model<IBooking>('ChannelBooking', BookingSchema);
