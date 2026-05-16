import mongoose, { Schema, Document, Model } from 'mongoose';
import { RoomType } from '../types/index.js';

export interface IRate {
  ratePlanId: string;
  currency: string;
  baseRate: number;
  taxes: number;
  fees: number;
  totalRate: number;
  minLos: number;
  maxLos: number;
}

export interface IPricingDocument extends Document {
  hotelId: string;
  roomMappingId: string;
  roomType: string;
  date: Date;
  rates: IRate[];
  lastSyncedAt: Date;
  channelSyncStatus: Map<string, 'synced' | 'pending' | 'failed'>;
  createdAt: Date;
  updatedAt: Date;
}

const RateSchema = new Schema<IRate>({
  ratePlanId: { type: String, required: true },
  currency: { type: String, required: true, default: 'USD', maxlength: 3 },
  baseRate: { type: Number, required: true, min: 0 },
  taxes: { type: Number, default: 0, min: 0 },
  fees: { type: Number, default: 0, min: 0 },
  totalRate: { type: Number, required: true, min: 0 },
  minLos: { type: Number, default: 1, min: 1 },
  maxLos: { type: Number, default: 30, min: 1 }
}, { _id: false });

const PricingSchema = new Schema<IPricingDocument>(
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
    rates: {
      type: [RateSchema],
      required: true,
      validate: {
        validator: (v: IRate[]) => v.length > 0,
        message: 'At least one rate plan is required'
      }
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
    collection: 'pricing'
  }
);

// Compound indexes
PricingSchema.index({ hotelId: 1, date: 1 });
PricingSchema.index({ hotelId: 1, roomMappingId: 1, date: 1 });
PricingSchema.index({ hotelId: 1, roomType: 1, date: 1 });

// TTL index for old pricing data (keep 2 years)
PricingSchema.index({ date: 1 }, { expireAfterSeconds: 63072000 });

export const Pricing: Model<IPricingDocument> = mongoose.model<IPricingDocument>(
  'Pricing',
  PricingSchema
);
