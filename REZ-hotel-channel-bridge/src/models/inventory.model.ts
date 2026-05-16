import mongoose, { Schema, Document, Model } from 'mongoose';
import { RoomType } from '../types/index.js';

export interface IInventoryDocument extends Document {
  hotelId: string;
  roomMappingId: string;
  roomType: string;
  date: Date;
  availableRooms: number;
  totalRooms: number;
  minStay?: number;
  maxStay?: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  lastSyncedAt: Date;
  channelSyncStatus: Map<string, 'synced' | 'pending' | 'failed'>;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventoryDocument>(
  {
    hotelId: {
      type: String,
      required: true,
      index: true
    },
    roomMappingId: {
      type: String,
      required: true,
      index: true
    },
    roomType: {
      type: String,
      enum: Object.values(RoomType),
      required: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    availableRooms: {
      type: Number,
      required: true,
      min: 0
    },
    totalRooms: {
      type: Number,
      required: true,
      min: 1
    },
    minStay: {
      type: Number,
      min: 0
    },
    maxStay: {
      type: Number,
      min: 1
    },
    closedToArrival: {
      type: Boolean,
      default: false
    },
    closedToDeparture: {
      type: Boolean,
      default: false
    },
    lastSyncedAt: {
      type: Date
    },
    channelSyncStatus: {
      type: Map,
      of: String,
      default: new Map()
    }
  },
  {
    timestamps: true,
    collection: 'inventory'
  }
);

// Compound indexes for efficient queries
InventorySchema.index({ hotelId: 1, date: 1 });
InventorySchema.index({ hotelId: 1, roomMappingId: 1, date: 1 });
InventorySchema.index({ hotelId: 1, roomType: 1, date: 1 });
InventorySchema.index({ date: 1, availableRooms: 1 });

// TTL index to auto-delete old inventory records (keep 2 years)
InventorySchema.index({ date: 1 }, { expireAfterSeconds: 63072000 });

export const Inventory: Model<IInventoryDocument> = mongoose.model<IInventoryDocument>(
  'Inventory',
  InventorySchema
);
