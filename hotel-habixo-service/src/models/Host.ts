/**
 * Host Model
 *
 * Represents a host profile for the Habixo platform.
 * Links to the user account from rez-auth-service via userId.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type HostBusinessType = 'individual' | 'company';
export type HostStatus = 'pending' | 'active' | 'suspended' | 'inactive';

export interface IHost extends Document {
  hostId: string;
  userId: string; // Reference to user in rez-auth-service
  brand: 'habixo_stay' | 'habixo_rent' | 'habixo_match' | 'all';
  status: HostStatus;

  // Profile
  profile: {
    displayName: string;
    bio?: string;
    avatar?: string;
    coverPhoto?: string;
  };

  // Business Info
  business?: {
    businessName?: string;
    businessType?: HostBusinessType;
    taxId?: string;
    gstin?: string;
    pan?: string;
  };

  // Bank Details (encrypted in production)
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };

  // Address
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };

  // Verification
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    documents: Array<{
      type: string;
      url: string;
      status: 'pending' | 'approved' | 'rejected';
      uploadedAt: Date;
    }>;
  };

  // Stats
  stats: {
    totalProperties: number;
    activeProperties: number;
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    averageRating: number;
    totalReviews: number;
    responseRate: number;
    averageResponseTime: number; // in minutes
    totalEarnings: number;
    currency: string;
  };

  // Trust & Karma
  trustScore: number;
  karmaScore: number;

  // Preferences
  preferences: {
    instantBooking: boolean;
    selfCheckIn: boolean;
    requireGuestVerification: boolean;
    maxAdvanceBookingDays: number;
    minNights: number;
    notificationPreferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const HostSchema = new Schema<IHost>(
  {
    hostId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, unique: true, index: true },
    brand: {
      type: String,
      required: true,
      enum: ['habixo_stay', 'habixo_rent', 'habixo_match', 'all'],
      default: 'all',
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'active', 'suspended', 'inactive'],
      default: 'pending',
      index: true,
    },

    profile: {
      displayName: { type: String, required: true },
      bio: { type: String, maxlength: 500 },
      avatar: String,
      coverPhoto: String,
    },

    business: {
      businessName: String,
      businessType: { type: String, enum: ['individual', 'company'] },
      taxId: String,
      gstin: String,
      pan: String,
    },

    bankDetails: {
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
      bankName: String,
    },

    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },

    verification: {
      emailVerified: { type: Boolean, default: false },
      phoneVerified: { type: Boolean, default: false },
      identityVerified: { type: Boolean, default: false },
      documents: [
        {
          type: String,
          url: String,
          status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
    },

    stats: {
      totalProperties: { type: Number, default: 0 },
      activeProperties: { type: Number, default: 0 },
      totalBookings: { type: Number, default: 0 },
      completedBookings: { type: Number, default: 0 },
      cancelledBookings: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0 },
      responseRate: { type: Number, default: 0, min: 0, max: 100 },
      averageResponseTime: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },

    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    karmaScore: { type: Number, default: 0 },

    preferences: {
      instantBooking: { type: Boolean, default: false },
      selfCheckIn: { type: Boolean, default: false },
      requireGuestVerification: { type: Boolean, default: true },
      maxAdvanceBookingDays: { type: Number, default: 365 },
      minNights: { type: Number, default: 1 },
      notificationPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true }
);

// Indexes
HostSchema.index({ hostId: 1 }, { unique: true });
HostSchema.index({ userId: 1 }, { unique: true });
HostSchema.index({ status: 1, brand: 1 });
HostSchema.index({ 'stats.averageRating': -1 });
HostSchema.index({ trustScore: -1 });
HostSchema.index({ createdAt: -1 });

// Virtual for isVerified
HostSchema.virtual('isVerified').get(function () {
  return (
    this.verification.emailVerified &&
    this.verification.phoneVerified &&
    this.verification.identityVerified
  );
});

// Method to check if host can list properties
HostSchema.methods.canListProperty = function (): boolean {
  return this.status === 'active';
};

// Method to update stats
HostSchema.methods.updateStats = async function (): Promise<void> {
  const { Property } = await import('./Property.js');
  const { Booking } = await import('./Booking.js');

  const propertyCount = await Property.countDocuments({ hostId: this.hostId });
  const activePropertyCount = await Property.countDocuments({
    hostId: this.hostId,
    status: 'active',
  });
  const bookingCount = await Booking.countDocuments({ hostId: this.hostId });
  const completedBookings = await Booking.countDocuments({
    hostId: this.hostId,
    status: 'completed',
  });
  const cancelledBookings = await Booking.countDocuments({
    hostId: this.hostId,
    status: 'cancelled',
  });

  this.stats.totalProperties = propertyCount;
  this.stats.activeProperties = activePropertyCount;
  this.stats.totalBookings = bookingCount;
  this.stats.completedBookings = completedBookings;
  this.stats.cancelledBookings = cancelledBookings;

  await this.save();
};

export const Host = mongoose.model<IHost>('Host', HostSchema);
