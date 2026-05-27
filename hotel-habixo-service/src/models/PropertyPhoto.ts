import mongoose, { Schema, Document } from 'mongoose';

export interface IPropertyPhoto extends Document {
  photoId: string;
  propertyId: string;
  url: string;
  caption?: string;
  isPrimary: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const PropertyPhotoSchema = new Schema<IPropertyPhoto>(
  {
    photoId: { type: String, required: true, unique: true },
    propertyId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    caption: { type: String, maxlength: 500 },
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes
PropertyPhotoSchema.index({ photoId: 1 }, { unique: true });
PropertyPhotoSchema.index({ propertyId: 1, order: 1 });
PropertyPhotoSchema.index({ propertyId: 1, isPrimary: -1 });

// Only one photo per property can be primary
PropertyPhotoSchema.index({ propertyId: 1, isPrimary: 1 }, { unique: true, partialFilterExpression: { isPrimary: true } });

export const PropertyPhoto = mongoose.model<IPropertyPhoto>('PropertyPhoto', PropertyPhotoSchema);
