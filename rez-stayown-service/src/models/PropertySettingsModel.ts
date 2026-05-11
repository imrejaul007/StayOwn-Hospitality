/**
 * Property Settings Model for StayOwn Service
 *
 * Stores property-specific settings like cancellation policies with MongoDB persistence.
 * Replaces in-memory propertyCancellationSettings Map.
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IPropertySettings extends Document {
  propertyId: string;
  freeCancellationEnabled: boolean;
  cancellationHours: number;
  refundPercentage: number;
  updatedAt: Date;
  updatedBy?: string;
}

const PropertySettingsSchema = new Schema<IPropertySettings>(
  {
    propertyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    freeCancellationEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    cancellationHours: {
      type: Number,
      required: true,
      default: 24,
      min: 0,
    },
    refundPercentage: {
      type: Number,
      required: true,
      default: 100,
      min: 0,
      max: 100,
    },
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true },
);

// Index for querying by cancellation settings
PropertySettingsSchema.index({ freeCancellationEnabled: 1 });

export const PropertySettings = mongoose.model<IPropertySettings>('PropertySettings', PropertySettingsSchema);
