import mongoose, { Schema, Document } from 'mongoose';
import { BookingStatus } from '../types';

export interface IBooking extends Document {
  bookingId: string;
  propertyId: string;
  propertyTitle?: string;
  propertyImage?: string;
  hostId: string;
  guestId: string;
  brand: 'habixo_stay' | 'habixo_rent' | 'habixo_hourly';
  checkIn: Date;
  checkOut: Date;
  totalNights: number;

  // Hourly Booking Fields
  bookingType: 'nightly' | 'hourly';
  startTime?: string;      // e.g., "14:00"
  endTime?: string;       // e.g., "18:00"
  totalHours?: number;
  hourlyRate?: number;

  guests: {
    adults: number;
    children: number;
    infants: number;
  };
  pricing: {
    nightlyRate: number;
    cleaningFee: number;
    serviceFee: number;
    taxes: number;
    discount: number;
    subtotal: number;
    total: number;
    currency: string;
  };
  lifecycleHooks: {
    coinsRewarded: boolean;
    streakUpdated: boolean;
    karmaUpdated: boolean;
    nudgeScheduled: boolean;
    notificationSent: boolean;
    reviewRequested: boolean;
  };
  status: BookingStatus;
  source: string;
  guestReview?: {
    rating: number;
    comment: string;
    createdAt: Date;
  };
  hostReview?: {
    rating: number;
    comment: string;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingId: { type: String, required: true, unique: true },
    propertyId: { type: String, required: true, index: true },
    propertyTitle: { type: String },
    propertyImage: { type: String },
    hostId: { type: String, required: true, index: true },
    guestId: { type: String, required: true, index: true },
    brand: {
      type: String,
      required: true,
      enum: ['habixo_stay', 'habixo_rent', 'habixo_hourly'],
    },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    totalNights: { type: Number, default: 0 },
    bookingType: {
      type: String,
      enum: ['nightly', 'hourly'],
      default: 'nightly',
    },
    startTime: { type: String },
    endTime: { type: String },
    totalHours: { type: Number },
    hourlyRate: { type: Number },
    guests: {
      adults: { type: Number, required: true, min: 1 },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 },
    },
    pricing: {
      nightlyRate: { type: Number, required: true },
      cleaningFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      taxes: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      subtotal: { type: Number, required: true },
      total: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
    },
    lifecycleHooks: {
      coinsRewarded: { type: Boolean, default: false },
      streakUpdated: { type: Boolean, default: false },
      karmaUpdated: { type: Boolean, default: false },
      nudgeScheduled: { type: Boolean, default: false },
      notificationSent: { type: Boolean, default: false },
      reviewRequested: { type: Boolean, default: false },
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'disputed'],
      default: 'pending',
      index: true,
    },
    source: { type: String, default: 'app' },
    guestReview: {
      rating: Number,
      comment: String,
      createdAt: Date,
    },
    hostReview: {
      rating: Number,
      comment: String,
      createdAt: Date,
    },
  },
  { timestamps: true }
);

// Indexes
BookingSchema.index({ bookingId: 1 }, { unique: true });
BookingSchema.index({ propertyId: 1, status: 1 });
BookingSchema.index({ hostId: 1, status: 1 });
BookingSchema.index({ guestId: 1, status: 1 });
BookingSchema.index({ checkIn: 1, checkOut: 1 });
BookingSchema.index({ createdAt: -1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
