import mongoose, { Schema, Document, Model } from 'mongoose';
import { BookingStatus, RoomType } from '../types/index.js';

export interface IBookingRoom {
  roomMappingId: string;
  roomType: string;
  ratePlanId?: string;
  nightlyRate: number;
  totalNights: number;
  totalAmount: number;
}

export interface IBookingDocument extends Document {
  bookingId: string;
  channelId: string;
  externalBookingId: string;
  hotelId: string;
  internalRoomId: string;
  guestName: {
    first: string;
    last: string;
  };
  guestEmail?: string;
  guestPhone?: string;
  checkIn: Date;
  checkOut: Date;
  totalGuests: number;
  rooms: IBookingRoom[];
  totalAmount: number;
  currency: string;
  status: string;
  specialRequests?: string;
  metadata?: Record<string, any>;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingRoomSchema = new Schema<IBookingRoom>({
  roomMappingId: { type: String, required: true },
  roomType: { type: String, enum: Object.values(RoomType), required: true },
  ratePlanId: { type: String },
  nightlyRate: { type: Number, required: true, min: 0 },
  totalNights: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 }
}, { _id: false });

const BookingSchema = new Schema<IBookingDocument>(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    channelId: {
      type: String,
      required: true,
      index: true
    },
    externalBookingId: {
      type: String,
      required: true
    },
    hotelId: {
      type: String,
      required: true,
      index: true
    },
    internalRoomId: {
      type: String,
      required: true
    },
    guestName: {
      first: { type: String, required: true },
      last: { type: String, required: true }
    },
    guestEmail: {
      type: String
    },
    guestPhone: {
      type: String
    },
    checkIn: {
      type: Date,
      required: true,
      index: true
    },
    checkOut: {
      type: Date,
      required: true,
      index: true
    },
    totalGuests: {
      type: Number,
      required: true,
      min: 1
    },
    rooms: {
      type: [BookingRoomSchema],
      required: true,
      validate: {
        validator: (v: IBookingRoom[]) => v.length > 0,
        message: 'At least one room is required'
      }
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      maxlength: 3
    },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      required: true,
      default: BookingStatus.CONFIRMED,
      index: true
    },
    specialRequests: {
      type: String
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    lastSyncedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: 'bookings'
  }
);

// Compound indexes for efficient queries
BookingSchema.index({ hotelId: 1, checkIn: 1 });
BookingSchema.index({ hotelId: 1, checkOut: 1 });
BookingSchema.index({ channelId: 1, externalBookingId: 1 }, { unique: true });
BookingSchema.index({ status: 1, checkIn: 1 });
BookingSchema.index({ externalBookingId: 1, channelId: 1 });

// TTL index for completed bookings older than 5 years
BookingSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 157680000,
    partialFilterExpression: { status: BookingStatus.COMPLETED }
  }
);

export const Booking: Model<IBookingDocument> = mongoose.model<IBookingDocument>(
  'Booking',
  BookingSchema
);
