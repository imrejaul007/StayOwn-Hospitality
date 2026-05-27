import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document } from 'mongoose';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const wishlistLogger = logger.child({ service: 'WishlistService' });

// ── Wishlist Model ──────────────────────────────────────────────────────────────

export interface IWishlist extends Document {
  wishlistId: string;
  userId: string;
  name: string;
  items: Array<{
    propertyId: string;
    addedAt: Date;
    notes?: string;
  }>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistItemSchema = new Schema({
  propertyId: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
  notes: { type: String },
});

const WishlistSchema = new Schema<IWishlist>(
  {
    wishlistId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    items: [WishlistItemSchema],
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

WishlistSchema.index({ wishlistId: 1 }, { unique: true });
WishlistSchema.index({ userId: 1, name: 1 });

export const Wishlist = mongoose.model<IWishlist>('Wishlist', WishlistSchema);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AddToWishlistInput {
  userId: string;
  propertyId: string;
  wishlistId?: string;
  notes?: string;
}

export interface CreateWishlistInput {
  userId: string;
  name: string;
}

// ── Service Functions ───────────────────────────────────────────────────────────

/**
 * Create a new wishlist
 */
export async function createWishlist(input: CreateWishlistInput): Promise<IWishlist> {
  const wishlistId = `WISHL-${uuidv4().substring(0, 8).toUpperCase()}`;

  // Check if user already has a wishlist with the same name
  const existing = await Wishlist.findOne({
    userId: input.userId,
    name: input.name,
  });

  if (existing) {
    throw new ConflictError(`Wishlist "${input.name}" already exists`);
  }

  // Check if this is the user's first wishlist (make it default)
  const existingCount = await Wishlist.countDocuments({ userId: input.userId });
  const isDefault = existingCount === 0;

  const wishlist = new Wishlist({
    wishlistId,
    userId: input.userId,
    name: input.name,
    items: [],
    isDefault,
  });

  await wishlist.save();
  wishlistLogger.info({ wishlistId, userId: input.userId }, 'Wishlist created');

  return wishlist;
}

/**
 * Get wishlist by ID
 */
export async function getWishlistById(wishlistId: string): Promise<IWishlist> {
  const wishlist = await Wishlist.findOne({ wishlistId }).lean();
  if (!wishlist) {
    throw new NotFoundError('Wishlist', wishlistId);
  }
  return wishlist as unknown as IWishlist;
}

/**
 * Get all wishlists for a user
 */
export async function getWishlistsByUser(userId: string): Promise<IWishlist[]> {
  return (await Wishlist.find({ userId }).sort({ createdAt: -1 }).lean()) as unknown as IWishlist[];
}

/**
 * Add item to wishlist
 */
export async function addToWishlist(input: AddToWishlistInput): Promise<IWishlist> {
  const { userId, propertyId, wishlistId, notes } = input;

  let wishlist: IWishlist | null;

  if (wishlistId) {
    wishlist = await Wishlist.findOne({ wishlistId, userId });
    if (!wishlist) {
      throw new NotFoundError('Wishlist', wishlistId);
    }
  } else {
    // Find user's default wishlist or create one
    wishlist = await Wishlist.findOne({ userId, isDefault: true });
    if (!wishlist) {
      wishlist = await createWishlist({ userId, name: 'Saved' });
    }
  }

  // Check if property already in wishlist
  const alreadyExists = wishlist.items.some(
    (item) => item.propertyId === propertyId
  );

  if (alreadyExists) {
    throw new ConflictError('Property already in wishlist');
  }

  wishlist.items.push({
    propertyId,
    addedAt: new Date(),
    notes,
  });

  await wishlist.save();
  wishlistLogger.info({ wishlistId: wishlist.wishlistId, propertyId, userId }, 'Item added to wishlist');

  return wishlist;
}

/**
 * Remove item from wishlist
 */
export async function removeFromWishlist(
  wishlistId: string,
  propertyId: string,
  userId: string
): Promise<IWishlist> {
  const wishlist = await Wishlist.findOne({ wishlistId, userId });
  if (!wishlist) {
    throw new NotFoundError('Wishlist', wishlistId);
  }

  const initialLength = wishlist.items.length;
  wishlist.items = wishlist.items.filter(
    (item) => item.propertyId !== propertyId
  );

  if (wishlist.items.length === initialLength) {
    throw new NotFoundError('Item', propertyId);
  }

  await wishlist.save();
  wishlistLogger.info({ wishlistId, propertyId, userId }, 'Item removed from wishlist');

  return wishlist;
}

/**
 * Delete a wishlist
 */
export async function deleteWishlist(wishlistId: string, userId: string): Promise<void> {
  const wishlist = await Wishlist.findOneAndDelete({ wishlistId, userId });
  if (!wishlist) {
    throw new NotFoundError('Wishlist', wishlistId);
  }

  // If deleted wishlist was default, make another one default
  if (wishlist.isDefault) {
    const nextWishlist = await Wishlist.findOne({ userId }).sort({ createdAt: 1 });
    if (nextWishlist) {
      nextWishlist.isDefault = true;
      await nextWishlist.save();
    }
  }

  wishlistLogger.info({ wishlistId, userId }, 'Wishlist deleted');
}

/**
 * Get all wishlisted property IDs for a user
 */
export async function getUserWishlistPropertyIds(userId: string): Promise<string[]> {
  const wishlists = await Wishlist.find({ userId }).lean();
  const propertyIds = new Set<string>();

  for (const wishlist of wishlists) {
    for (const item of wishlist.items) {
      propertyIds.add(item.propertyId);
    }
  }

  return Array.from(propertyIds);
}

/**
 * Check if property is in user's wishlist
 */
export async function isPropertyInWishlist(
  userId: string,
  propertyId: string
): Promise<boolean> {
  const count = await Wishlist.countDocuments({
    userId,
    'items.propertyId': propertyId,
  });
  return count > 0;
}
