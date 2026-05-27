import mongoose, { Schema, Document } from 'mongoose';

export interface IWishlist extends Document {
  wishlistId: string;
  userId: string;
  propertyId: string;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema = new Schema<IWishlist>(
  {
    wishlistId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    propertyId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Indexes
WishlistSchema.index({ wishlistId: 1 }, { unique: true });
WishlistSchema.index({ userId: 1, propertyId: 1 }, { unique: true });
WishlistSchema.index({ propertyId: 1, createdAt: -1 });
WishlistSchema.index({ userId: 1, createdAt: -1 });

export const Wishlist = mongoose.model<IWishlist>('Wishlist', WishlistSchema);
