import mongoose, { Schema, Document } from 'mongoose';

export interface IAvailability extends Document {
  propertyId: string;
  date: Date;
  available: boolean;
  bookedBy?: string;
  bookingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AvailabilitySchema = new Schema<IAvailability>(
  {
    propertyId: { type: String, required: true },
    date: { type: Date, required: true },
    available: { type: Boolean, default: true },
    bookedBy: { type: String },
    bookingId: { type: String },
  },
  { timestamps: true }
);

// Indexes
AvailabilitySchema.index({ propertyId: 1, date: 1 }, { unique: true });
AvailabilitySchema.index({ propertyId: 1, available: 1, date: 1 });
AvailabilitySchema.index({ date: 1, available: 1 });
AvailabilitySchema.index({ bookedBy: 1, date: 1 });

// Compound index for calendar queries
AvailabilitySchema.index({ propertyId: 1, date: 1, available: 1 });

export const Availability = mongoose.model<IAvailability>('Availability', AvailabilitySchema);
