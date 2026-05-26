/**
 * Housekeeping Staff Model
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IHousekeepingStaff extends Document {
  hotelId: string;
  staffId: string;
  name: string;
  phone: string;
  role: 'supervisor' | 'housekeeper' | 'porter';
  zones: string[];
  activeTasks: number;
  completedToday: number;
  rating: number;
  status: 'available' | 'busy' | 'offline';
  shiftStart?: string;
  shiftEnd?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HousekeepingStaffSchema = new Schema<IHousekeepingStaff>({
  hotelId: { type: String, required: true, index: true },
  staffId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  role: {
    type: String,
    enum: ['supervisor', 'housekeeper', 'porter'],
    required: true,
  },
  zones: [{ type: String }],
  activeTasks: { type: Number, default: 0 },
  completedToday: { type: Number, default: 0 },
  rating: { type: Number, default: 5 },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'available',
  },
  shiftStart: { type: String },
  shiftEnd: { type: String },
}, { timestamps: true });

HousekeepingStaffSchema.index({ hotelId: 1, status: 1 });
HousekeepingStaffSchema.index({ hotelId: 1, role: 1 });

export const HousekeepingStaff = mongoose.model<IHousekeepingStaff>('HousekeepingStaff', HousekeepingStaffSchema);
