/**
 * Guest Model
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IGuest extends Document {
  hotelId: string;
  guestId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth?: Date;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  preferences: {
    roomType?: string;
    floor?: string;
    smoking?: boolean;
    pillow?: string;
    amenities?: string[];
  };
  notes?: string;
  tags: string[];
  totalStays: number;
  totalSpend: number;
  lastStay?: Date;
  avgRating?: number;
  vip: boolean;
  blacklisted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GuestSchema = new Schema<IGuest>({
  hotelId: { type: String, required: true, index: true },
  guestId: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  dateOfBirth: { type: Date },
  nationality: { type: String },
  idType: { type: String },
  idNumber: { type: String },
  preferences: {
    roomType: String,
    floor: String,
    smoking: Boolean,
    pillow: String,
    amenities: [String],
  },
  notes: { type: String },
  tags: [String],
  totalStays: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },
  lastStay: { type: Date },
  avgRating: { type: Number },
  vip: { type: Boolean, default: false },
  blacklisted: { type: Boolean, default: false },
}, { timestamps: true });

GuestSchema.index({ hotelId: 1, phone: 1 });
GuestSchema.index({ hotelId: 1, email: 1 });
GuestSchema.index({ hotelId: 1, lastName: 1 });
GuestSchema.index({ totalStays: -1 });
GuestSchema.index({ totalSpend: -1 });

export const Guest = mongoose.model<IGuest>('Guest', GuestSchema);
