/**
 * Booking Model for StayOwn Service
 *
 * Stores hotel booking records with MongoDB persistence.
 * Replaces in-memory bookingsStore Map.
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  bookingId: string;
  confirmationNumber: string;
  pmsBookingId?: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  property: {
    propertyId: string;
    name: string;
    address: string;
  };
  room: {
    roomTypeId: string;
    name: string;
    bedType: string;
  };
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  dates: {
    checkIn: string;
    checkOut: string;
    nights: number;
  };
  pricing: {
    baseRate: number;
    nights: number;
    subtotal: number;
    taxableAmount: number;
    cgstRate: number;
    cgstAmount: number;
    sgstRate: number;
    sgstAmount: number;
    totalTax: number;
    totalAmount: number;
    itcEligible: boolean;
  };
  paymentOption?: 'prepay' | 'pay_at_hotel' | 'partial';
  totalAmountPaise: number;
  upfrontAmountPaise?: number;
  payAtHotelAmountPaise?: number;
  paymentOptionDetails?: {
    description: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    confirmationNumber: { type: String, required: true, index: true },
    pmsBookingId: { type: String, sparse: true },
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
    },
    property: {
      propertyId: { type: String, required: true },
      name: { type: String, required: true },
      address: { type: String, required: true },
    },
    room: {
      roomTypeId: { type: String, required: true },
      name: { type: String, required: true },
      bedType: { type: String, required: true },
    },
    guest: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: String,
      phone: String,
    },
    dates: {
      checkIn: { type: String, required: true },
      checkOut: { type: String, required: true },
      nights: { type: Number, required: true },
    },
    pricing: {
      baseRate: { type: Number, required: true },
      nights: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      taxableAmount: { type: Number, required: true },
      cgstRate: { type: Number, required: true },
      cgstAmount: { type: Number, required: true },
      sgstRate: { type: Number, required: true },
      sgstAmount: { type: Number, required: true },
      totalTax: { type: Number, required: true },
      totalAmount: { type: Number, required: true },
      itcEligible: { type: Boolean, default: true },
    },
    paymentOption: {
      type: String,
      enum: ['prepay', 'pay_at_hotel', 'partial'],
    },
    totalAmountPaise: { type: Number, required: true },
    upfrontAmountPaise: Number,
    payAtHotelAmountPaise: Number,
    paymentOptionDetails: {
      description: String,
    },
  },
  { timestamps: true },
);

// Compound indexes for common query patterns
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ 'property.propertyId': 1, status: 1 });
BookingSchema.index({ status: 1, createdAt: -1 });

// Index for PMS booking ID lookups
BookingSchema.index({ pmsBookingId: 1 }, { sparse: true });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
