/**
 * Room Status Model
 * Track room cleaning status
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IRoomStatus extends Document {
  hotelId: string;
  roomId: string;
  roomNumber: string;
  status: 'vacant_clean' | 'vacant_dirty' | 'occupied' | 'out_of_order' | 'cleaning';
  lastCleaned?: Date;
  lastCleanedBy?: string;
  cleaningStarted?: Date;
  cleaningAssignedTo?: string;
  nextGuest?: string;
  nextCheckout?: Date;
  notes?: string;
  updatedAt: Date;
}

const RoomStatusSchema = new Schema<IRoomStatus>({
  hotelId: { type: String, required: true, index: true },
  roomId: { type: String, required: true, unique: true },
  roomNumber: { type: String, required: true },
  status: {
    type: String,
    enum: ['vacant_clean', 'vacant_dirty', 'occupied', 'out_of_order', 'cleaning'],
    default: 'vacant_dirty',
  },
  lastCleaned: { type: Date },
  lastCleanedBy: { type: String },
  cleaningStarted: { type: Date },
  cleaningAssignedTo: { type: String },
  nextGuest: { type: String },
  nextCheckout: { type: Date },
  notes: { type: String },
}, { timestamps: true });

RoomStatusSchema.index({ hotelId: 1, status: 1 });

export const RoomStatus = mongoose.model<IRoomStatus>('RoomStatus', RoomStatusSchema);
