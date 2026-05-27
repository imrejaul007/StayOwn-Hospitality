import mongoose, { Schema, Document } from 'mongoose';
import {
  HabixoBrand,
  PropertyType,
  RoomType,
  RentalType,
} from '../types';

export interface IProperty extends Document {
  propertyId: string;
  hostId: string;
  brand: HabixoBrand;
  title: string;
  description: string;
  propertyType: PropertyType;
  roomType: RoomType;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    pincode?: string;
    lat: number;
    lng: number;
    neighborhood?: string;
  };
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  beds: number;
  amenities: string[];
  pricing: {
    basePrice: number;
    cleaningFee: number;
    serviceFee: number;
    weeklyDiscount: number;
    monthlyDiscount: number;
    currency: string;
  };
  availability: {
    checkInTime: string;
    checkOutTime: string;
    minNights: number;
    maxNights: number;
  };
  rentalType: RentalType;

  // Hourly Booking Support
  hourlyEnabled: boolean;
  hourlyPricing?: {
    minHours: number;
    maxHours: number;
    hourlyRate: number;
    halfDayRate?: number;
    fullDayRate?: number;
    hourlyDiscount?: number;
  };
  hourlyAvailability?: {
    startTime: string;
    endTime: string;
    bufferTime: number;
    advanceBookingHours: number;
  };

  leaseTerms?: {
    minMonths: number;
    maxMonths: number;
    securityDeposit: number;
    furnished: boolean;
  };
  flatmateProfile?: {
    vibeTags: string[];
    sleepSchedule: string;
    workFromHome: boolean;
    smokeFriendly: boolean;
    petFriendly: boolean;
  };
  photos: Array<{
    url: string;
    caption: string;
    isPrimary: boolean;
  }>;
  qualityScore: number;
  trustScore: number;
  verified: boolean;
  status: 'draft' | 'pending' | 'active' | 'inactive' | 'suspended';
  stats: {
    totalBookings: number;
    rating: number;
    reviewCount: number;
    responseRate: number;
    responseTime: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PropertySchema = new Schema<IProperty>(
  {
    propertyId: { type: String, required: true, unique: true },
    hostId: { type: String, required: true, index: true },
    brand: {
      type: String,
      required: true,
      enum: ['habixo_stay', 'habixo_rent', 'habixo_match'],
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 2000 },
    propertyType: {
      type: String,
      required: true,
      enum: ['apartment', 'house', 'room', 'shared'],
    },
    roomType: {
      type: String,
      required: true,
      enum: ['entire_place', 'private_room', 'shared_room'],
    },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      pincode: String,
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      neighborhood: String,
    },
    bedrooms: { type: Number, required: true, min: 0 },
    bathrooms: { type: Number, required: true, min: 0 },
    maxGuests: { type: Number, required: true, min: 1 },
    beds: { type: Number, required: true, min: 1 },
    amenities: [{ type: String }],
    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
      cleaningFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      weeklyDiscount: { type: Number, default: 0, min: 0, max: 100 },
      monthlyDiscount: { type: Number, default: 0, min: 0, max: 100 },
      currency: { type: String, default: 'INR' },
    },
    availability: {
      checkInTime: { type: String, default: '15:00' },
      checkOutTime: { type: String, default: '11:00' },
      minNights: { type: Number, default: 1 },
      maxNights: { type: Number, default: 30 },
    },
    rentalType: {
      type: String,
      required: true,
      enum: ['short_term', 'long_term', 'both'],
    },
    leaseTerms: {
      minMonths: Number,
      maxMonths: Number,
      securityDeposit: Number,
      furnished: Boolean,
    },
    flatmateProfile: {
      vibeTags: [String],
      sleepSchedule: String,
      workFromHome: Boolean,
      smokeFriendly: Boolean,
      petFriendly: Boolean,
    },
    photos: [
      {
        url: String,
        caption: String,
        isPrimary: Boolean,
      },
    ],
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    verified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'inactive', 'suspended'],
      default: 'draft',
      index: true,
    },
    stats: {
      totalBookings: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 },
      reviewCount: { type: Number, default: 0 },
      responseRate: { type: Number, default: 0, min: 0, max: 100 },
      responseTime: { type: String, default: 'within an hour' },
    },
  },
  { timestamps: true }
);

// Indexes
PropertySchema.index({ 'location.city': 1, status: 1 });
PropertySchema.index({ 'location.neighborhood': 1 });
PropertySchema.index({ brand: 1, status: 1 });
PropertySchema.index({ 'pricing.basePrice': 1 });
PropertySchema.index({ 'stats.rating': -1 });
PropertySchema.index({ trustScore: -1 });
PropertySchema.index({ propertyId: 1 }, { unique: true });

// Text index for full-text search on title, description, and location
PropertySchema.index(
  { title: 'text', description: 'text', 'location.city': 'text', 'location.neighborhood': 'text' },
  {
    weights: {
      title: 10,
      'location.city': 5,
      'location.neighborhood': 3,
      description: 1,
    },
    name: 'property_text_search',
  }
);

// Geo index for location-based queries
PropertySchema.index({ 'location.lat': 1, 'location.lng': 1 });

export const Property = mongoose.model<IProperty>('Property', PropertySchema);
