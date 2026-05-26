/**
 * Stay Model
 * Guest stay records
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IStay extends Document {
  hotelId: string;
  guestId: string;
  bookingId: string;
  roomId: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  totalAmount: number;
  status: 'upcoming' | 'checked_in' | 'checked_out' | 'cancelled';
  feedback?: {
    rating: number;
    comment?: string;
    submittedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StaySchema = new Schema<IStay>({
  hotelId: { type: String, required: true, index: true },
  guestId: { type: String, required: true, index: true },
  bookingId: { type: String, required: true, index: true },
  roomId: { type: String, required: true },
  roomNumber: { type: String, required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'checked_in', 'checked_out', 'cancelled'],
    default: 'upcoming',
  },
  feedback: {
    rating: Number,
    comment: String,
    submittedAt: Date,
  },
}, { timestamps: true });

StaySchema.index({ hotelId: 1, guestId: 1 });
StaySchema.index({ checkIn: -1 });
StaySchema.index({ checkOut: -1 });

export const Stay = mongoose.model<IStay>('Stay', StaySchema);
