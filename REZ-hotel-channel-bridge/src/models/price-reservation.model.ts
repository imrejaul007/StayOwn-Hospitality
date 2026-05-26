/**
 * Price Reservation Model
 *
 * Prevents rate changes during booking flow by reserving a price for a limited time.
 * When a user starts the booking process, we reserve the price for 5 minutes.
 * If they don't complete payment, the reservation expires.
 */

import { randomUUID } from 'crypto';
import mongoose, { Schema, Document, Model } from 'mongoose';

export enum ReservationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface IPriceReservation extends Document {
  reservationId: string;
  userId: string;
  hotelId: string;
  roomMappingId: string;
  roomType: string;
  date: Date;
  price: {
    basePrice: number;
    taxes: number;
    totalPrice: number;
    currency: string;
  };
  status: ReservationStatus;
  bookingId?: string; // Set when booking is created
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PriceReservationSchema = new Schema<IPriceReservation>(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    hotelId: {
      type: String,
      required: true,
      index: true,
    },
    roomMappingId: {
      type: String,
      required: true,
      index: true,
    },
    roomType: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    price: {
      basePrice: { type: Number, required: true },
      taxes: { type: Number, default: 0 },
      totalPrice: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
    },
    status: {
      type: String,
      enum: Object.values(ReservationStatus),
      default: ReservationStatus.PENDING,
      index: true,
    },
    bookingId: {
      type: String,
      sparse: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'price_reservations',
  }
);

// Compound indexes for common queries
PriceReservationSchema.index({ userId: 1, status: 1 });
PriceReservationSchema.index({ hotelId: 1, date: 1, status: 1 });
PriceReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-delete expired

// Static methods
PriceReservationSchema.statics.createReservation = async function(
  userId: string,
  hotelId: string,
  roomMappingId: string,
  roomType: string,
  date: Date,
  price: { basePrice: number; taxes: number; totalPrice: number },
  ttlMinutes: number = 5
): Promise<IPriceReservation> {
  // SECURITY: Use crypto.randomUUID() for cryptographically secure reservation IDs
  const reservationId = `PR-${Date.now()}-${randomUUID().substring(0, 9)}`;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const reservation = await this.create({
    reservationId,
    userId,
    hotelId,
    roomMappingId,
    roomType,
    date,
    price: {
      ...price,
      currency: 'INR',
    },
    status: ReservationStatus.PENDING,
    expiresAt,
  });

  return reservation;
};

PriceReservationSchema.statics.completeReservation = async function(
  reservationId: string,
  bookingId: string
): Promise<IPriceReservation | null> {
  return this.findOneAndUpdate(
    {
      reservationId,
      status: ReservationStatus.PENDING,
      expiresAt: { $gt: new Date() }, // Not expired
    },
    {
      status: ReservationStatus.COMPLETED,
      bookingId,
    },
    { new: true }
  );
};

PriceReservationSchema.statics.cancelReservation = async function(
  reservationId: string,
  userId: string
): Promise<IPriceReservation | null> {
  return this.findOneAndUpdate(
    {
      reservationId,
      userId,
      status: ReservationStatus.PENDING,
    },
    {
      status: ReservationStatus.CANCELLED,
    },
    { new: true }
  );
};

PriceReservationSchema.statics.getValidReservation = async function(
  userId: string,
  hotelId: string,
  roomMappingId: string,
  date: Date
): Promise<IPriceReservation | null> {
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  return this.findOne({
    userId,
    hotelId,
    roomMappingId,
    date: normalizedDate,
    status: ReservationStatus.PENDING,
    expiresAt: { $gt: new Date() },
  });
};

export const PriceReservation: Model<IPriceReservation> = mongoose.model<IPriceReservation>(
  'PriceReservation',
  PriceReservationSchema
);
