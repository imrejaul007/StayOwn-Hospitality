import mongoose, { Schema, Document, Model, ClientSession } from 'mongoose';
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

// ─── Static Methods for Atomic Operations ──────────────────────────────────────

export interface InventoryReservation {
  success: boolean;
  availableRooms?: number;
  error?: string;
}

InventorySchema.statics.reserveRoom = async function(
  hotelId: string,
  roomMappingId: string,
  date: Date,
  quantity: number = 1,
  session?: ClientSession
): Promise<InventoryReservation> {
  // Normalize date to start of day
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  // Atomic update with condition check
  const result = await this.findOneAndUpdate(
    {
      hotelId,
      roomMappingId,
      date: normalizedDate,
      availableRooms: { $gte: quantity }, // Ensure enough rooms
      closedToArrival: false,
    },
    {
      $inc: { availableRooms: -quantity },
    },
    {
      new: true,
      session,
    }
  );

  if (!result) {
    // Check why it failed
    const existing = await this.findOne({ hotelId, roomMappingId, date: normalizedDate });
    if (!existing) {
      return { success: false, error: 'Inventory not found for this date' };
    }
    if (existing.availableRooms < quantity) {
      return { success: false, error: 'Not enough rooms available', availableRooms: existing.availableRooms };
    }
    if (existing.closedToArrival) {
      return { success: false, error: 'Closed to arrival' };
    }
    return { success: false, error: 'Unable to reserve room' };
  }

  return { success: true, availableRooms: result.availableRooms };
};

InventorySchema.statics.releaseRoom = async function(
  hotelId: string,
  roomMappingId: string,
  date: Date,
  quantity: number = 1,
  session?: ClientSession
): Promise<InventoryReservation> {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  // Atomic update with max limit
  const result = await this.findOneAndUpdate(
    {
      hotelId,
      roomMappingId,
      date: normalizedDate,
      availableRooms: { $lt: this.totalRooms }, // Can't exceed total
    },
    {
      $inc: { availableRooms: quantity },
    },
    {
      new: true,
      session,
    }
  );

  if (!result) {
    const existing = await this.findOne({ hotelId, roomMappingId, date: normalizedDate });
    if (!existing) {
      return { success: false, error: 'Inventory not found' };
    }
    return { success: false, error: 'Cannot release more rooms than total' };
  }

  return { success: true, availableRooms: result.availableRooms };
};

InventorySchema.statics.checkAvailability = async function(
  hotelId: string,
  roomMappingId: string,
  dates: Date[],
  quantity: number = 1
): Promise<{ available: boolean; unavailableDates: Date[] }> {
  const normalizedDates = dates.map(d => {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n;
  });

  const inventory = await this.find({
    hotelId,
    roomMappingId,
    date: { $in: normalizedDates },
    availableRooms: { $gte: quantity },
  }).lean();

  const availableDates = new Set(inventory.map(i => i.date.getTime()));
  const unavailableDates = normalizedDates.filter(d => !availableDates.has(d.getTime()));

  return {
    available: unavailableDates.length === 0,
    unavailableDates,
  };
};

export const Inventory: Model<IInventoryDocument> = mongoose.model<IInventoryDocument>(
  'Inventory',
  InventorySchema
);
