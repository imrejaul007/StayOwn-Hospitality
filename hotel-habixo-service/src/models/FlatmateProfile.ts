import mongoose, { Schema, Document } from 'mongoose';

export interface IFlatmateProfile extends Document {
  profileId: string;
  userId: string;
  name?: string;
  avatar?: string;
  lifestyle: {
    vibeTags: string[];
    sleepSchedule: string;
    workFromHome: boolean;
    smoking: string;
    drinking: string;
    pets: boolean;
    allergies?: string[];
  };
  preferences: {
    minBudget?: number;
    maxBudget?: number;
    preferredAreas: string[];
    moveInDate?: Date;
    leaseDuration?: number;
    roommateCount?: {
      min: number;
      max: number;
    };
  };
  trustScore: number;
  verified: boolean;
  status: 'active' | 'inactive';
  notificationsEnabled: boolean;
  matchNotifications: {
    newMatches: boolean;
    messages: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FlatmateProfileSchema = new Schema<IFlatmateProfile>(
  {
    profileId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    name: { type: String },
    avatar: { type: String },
    lifestyle: {
      vibeTags: [{ type: String }],
      sleepSchedule: { type: String, enum: ['early_bird', 'night_owl', 'flexible'], default: 'flexible' },
      workFromHome: { type: Boolean, default: false },
      smoking: { type: String, enum: ['never', 'occasionally', 'regularly'], default: 'never' },
      drinking: { type: String, enum: ['never', 'occasionally', 'socially'], default: 'occasionally' },
      pets: { type: Boolean, default: false },
      allergies: [{ type: String }],
    },
    preferences: {
      minBudget: Number,
      maxBudget: Number,
      preferredAreas: [{ type: String }],
      moveInDate: Date,
      leaseDuration: Number,
      roommateCount: {
        min: { type: Number, default: 1 },
        max: { type: Number, default: 1 },
      },
    },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    notificationsEnabled: { type: Boolean, default: true },
    matchNotifications: {
      newMatches: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Indexes
FlatmateProfileSchema.index({ profileId: 1 }, { unique: true });
FlatmateProfileSchema.index({ userId: 1 }, { unique: true });
FlatmateProfileSchema.index({ status: 1, trustScore: -1 });
FlatmateProfileSchema.index({ 'preferences.preferredAreas': 1 });
FlatmateProfileSchema.index({ 'lifestyle.vibeTags': 1 });

export const FlatmateProfile = mongoose.model<IFlatmateProfile>('FlatmateProfile', FlatmateProfileSchema);
