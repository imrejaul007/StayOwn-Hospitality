/**
 * Room Task Model
 * Housekeeping task assignments
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IRoomTask extends Document {
  hotelId: string;
  roomId: string;
  roomNumber: string;
  taskType: 'cleaning' | 'deep_clean' | 'turndown' | 'maintenance' | 'inspection';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'verified';
  assignedTo?: string;
  assignedToName?: string;
  notes?: string;
  checklist: { item: string; completed: boolean }[];
  dueBy?: Date;
  startedAt?: Date;
  completedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  guestId?: string;
  bookingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoomTaskSchema = new Schema<IRoomTask>({
  hotelId: { type: String, required: true, index: true },
  roomId: { type: String, required: true, index: true },
  roomNumber: { type: String, required: true },
  taskType: {
    type: String,
    enum: ['cleaning', 'deep_clean', 'turndown', 'maintenance', 'inspection'],
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'verified'],
    default: 'pending',
  },
  assignedTo: { type: String, index: true },
  assignedToName: { type: String },
  notes: { type: String },
  checklist: [{
    item: String,
    completed: { type: Boolean, default: false },
  }],
  dueBy: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  verifiedAt: { type: Date },
  verifiedBy: { type: String },
  guestId: { type: String, index: true },
  bookingId: { type: String, index: true },
}, { timestamps: true });

RoomTaskSchema.index({ hotelId: 1, status: 1 });
RoomTaskSchema.index({ hotelId: 1, assignedTo: 1, status: 1 });
RoomTaskSchema.index({ dueBy: 1, status: 1 });

export const RoomTask = mongoose.model<IRoomTask>('RoomTask', RoomTaskSchema);
