// Photo Service for Habixo Properties
// Handles photo upload, deletion, and reordering via Cloudinary

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import { PropertyPhoto, IPropertyPhoto, Property } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

const photoLogger = logger.child({ service: 'PhotoService' });

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'habixo-properties';
const CLOUDINARY_FOLDER = 'habixo/properties';

// Allowed file types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PHOTOS_PER_PROPERTY = 50;

export interface UploadPhotoInput {
  file: Buffer | string; // Buffer for server upload, URL string for external upload
  propertyId: string;
  caption?: string;
  isPrimary?: boolean;
  mimeType?: string;
  userId?: string;
}

export interface PhotoUploadResult {
  success: boolean;
  photo?: IPropertyPhoto;
  error?: string;
  url?: string;
}

export interface ReorderPhotosInput {
  propertyId: string;
  photoIds: string[];
}

export interface PresignedUrlResult {
  success: boolean;
  uploadUrl?: string;
  cloudName?: string;
  uploadPreset?: string;
  folder?: string;
  error?: string;
}

/**
 * Generate a unique photo ID
 */
function generatePhotoId(): string {
  return `HABP-${uuidv4().substring(0, 8).toUpperCase()}`;
}

/**
 * Validate file before upload
 */
function validateFile(mimeType: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }
  return { valid: true };
}

/**
 * Upload image to Cloudinary (server-side upload)
 */
async function uploadToCloudinary(file: Buffer, mimeType: string, filename: string): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary configuration is missing');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = require('crypto')
    .createHash('sha1')
    .update(`folder=${CLOUDINARY_FOLDER}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest('hex');

  const form = new FormData();
  form.append('file', file, { filename, contentType: mimeType });
  form.append('folder', CLOUDINARY_FOLDER);
  form.append('timestamp', String(timestamp));
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('signature', signature);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    form,
    {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 30000,
    }
  );

  return response.data.secure_url;
}

/**
 * Delete image from Cloudinary
 */
async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary configuration is missing');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = require('crypto')
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest('hex');

  await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    {
      public_id: publicId,
      timestamp,
      api_key: CLOUDINARY_API_KEY,
      signature,
    },
    {
      timeout: 10000,
    }
  );
}

/**
 * Extract public ID from Cloudinary URL
 */
function extractPublicIdFromUrl(url: string): string | null {
  const regex = /\/habixo\/properties\/([^/]+)\./;
  const match = url.match(regex);
  return match ? `habixo/properties/${match[1]}` : null;
}

/**
 * Upload a photo for a property
 * Supports both server-side upload (Buffer) and URL-based upload
 */
export async function uploadPhoto(input: UploadPhotoInput): Promise<PhotoUploadResult> {
  const { propertyId, caption, isPrimary = false, userId } = input;

  try {
    // Verify property exists
    const property = await Property.findOne({ propertyId });
    if (!property) {
      throw new NotFoundError('Property', propertyId);
    }

    // Check photo limit
    const existingPhotos = await PropertyPhoto.countDocuments({ propertyId });
    if (existingPhotos >= MAX_PHOTOS_PER_PROPERTY) {
      return {
        success: false,
        error: `Maximum ${MAX_PHOTOS_PER_PROPERTY} photos allowed per property`,
      };
    }

    let imageUrl: string;
    let mimeType = input.mimeType || 'image/jpeg';

    if (Buffer.isBuffer(input.file)) {
      // Server-side upload
      const validation = validateFile(mimeType, input.file.length);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const filename = `${propertyId}_${Date.now()}.jpg`;
      imageUrl = await uploadToCloudinary(input.file, mimeType, filename);
    } else {
      // URL-based upload (already uploaded elsewhere)
      imageUrl = input.file;
    }

    // Get next order number
    const lastPhoto = await PropertyPhoto.findOne({ propertyId })
      .sort({ order: -1 })
      .select('order');
    const order = (lastPhoto?.order ?? -1) + 1;

    // If this is marked as primary, unset other primary photos
    if (isPrimary) {
      await PropertyPhoto.updateMany(
        { propertyId, isPrimary: true },
        { $set: { isPrimary: false } }
      );
    }

    // Create photo record
    const photoId = generatePhotoId();
    const photo = new PropertyPhoto({
      photoId,
      propertyId,
      url: imageUrl,
      caption,
      isPrimary: isPrimary || existingPhotos === 0, // First photo is primary by default
      order,
    });

    await photo.save();

    // Update property photos array
    await Property.findOneAndUpdate(
      { propertyId },
      { $push: { photos: { url: imageUrl, caption, isPrimary: photo.isPrimary } } }
    );

    photoLogger.info({ photoId, propertyId, userId }, 'Photo uploaded successfully');

    return {
      success: true,
      photo,
      url: imageUrl,
    };
  } catch (error) {
    photoLogger.error({ error, propertyId }, 'Failed to upload photo');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload photo',
    };
  }
}

/**
 * Delete a photo
 */
export async function deletePhoto(photoId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const photo = await PropertyPhoto.findOne({ photoId });
    if (!photo) {
      throw new NotFoundError('Photo', photoId);
    }

    const { propertyId, url, isPrimary } = photo;

    // Delete from Cloudinary if it's a Cloudinary URL
    const publicId = extractPublicIdFromUrl(url);
    if (publicId && CLOUDINARY_CLOUD_NAME) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (cloudinaryError) {
        photoLogger.warn({ photoId, error: cloudinaryError }, 'Failed to delete from Cloudinary, continuing with DB deletion');
      }
    }

    // Delete from database
    await PropertyPhoto.deleteOne({ photoId });

    // Update property photos array
    await Property.findOneAndUpdate(
      { propertyId },
      { $pull: { photos: { url } } }
    );

    // If deleted photo was primary, make the first remaining photo primary
    if (isPrimary) {
      const nextPhoto = await PropertyPhoto.findOne({ propertyId }).sort({ order: 1 });
      if (nextPhoto) {
        await PropertyPhoto.updateOne({ photoId: nextPhoto.photoId }, { $set: { isPrimary: true } });
        await Property.findOneAndUpdate(
          { propertyId, 'photos.url': nextPhoto.url },
          { $set: { 'photos.$.isPrimary': true } }
        );
      }
    }

    photoLogger.info({ photoId, propertyId }, 'Photo deleted successfully');

    return { success: true };
  } catch (error) {
    photoLogger.error({ error, photoId }, 'Failed to delete photo');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete photo',
    };
  }
}

/**
 * Reorder photos for a property
 */
export async function reorderPhotos(input: ReorderPhotosInput): Promise<{
  success: boolean;
  photos?: IPropertyPhoto[];
  error?: string;
}> {
  const { propertyId, photoIds } = input;

  try {
    // Verify property exists
    const property = await Property.findOne({ propertyId });
    if (!property) {
      throw new NotFoundError('Property', propertyId);
    }

    // Verify all photos belong to this property
    const photos = await PropertyPhoto.find({ photoId: { $in: photoIds }, propertyId });
    if (photos.length !== photoIds.length) {
      return {
        success: false,
        error: 'Some photos do not belong to this property',
      };
    }

    // Update order for each photo
    await Promise.all(
      photoIds.map((photoId, index) =>
        PropertyPhoto.updateOne({ photoId }, { $set: { order: index } })
      )
    );

    // Update photos array in property
    const updatedPhotos = await PropertyPhoto.find({ propertyId })
      .sort({ order: 1 })
      .lean();

    const photoUrls = updatedPhotos.map((p) => ({
      url: p.url,
      caption: p.caption,
      isPrimary: p.isPrimary,
    }));

    await Property.findOneAndUpdate(
      { propertyId },
      { $set: { photos: photoUrls } }
    );

    photoLogger.info({ propertyId, photoIds }, 'Photos reordered successfully');

    return {
      success: true,
      photos: updatedPhotos as unknown as IPropertyPhoto[],
    };
  } catch (error) {
    photoLogger.error({ error, propertyId }, 'Failed to reorder photos');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reorder photos',
    };
  }
}

/**
 * Get presigned URL for client-side upload
 * Returns the necessary information for the client to upload directly to Cloudinary
 */
export async function getPresignedUrl(propertyId: string): Promise<PresignedUrlResult> {
  try {
    // Verify property exists
    const property = await Property.findOne({ propertyId });
    if (!property) {
      throw new NotFoundError('Property', propertyId);
    }

    // Check photo limit
    const existingPhotos = await PropertyPhoto.countDocuments({ propertyId });
    if (existingPhotos >= MAX_PHOTOS_PER_PROPERTY) {
      return {
        success: false,
        error: `Maximum ${MAX_PHOTOS_PER_PROPERTY} photos allowed per property`,
      };
    }

    // If Cloudinary is configured, return upload URL
    if (CLOUDINARY_CLOUD_NAME) {
      return {
        success: true,
        uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        folder: CLOUDINARY_FOLDER,
      };
    }

    // Fallback: Return base URL for server-side upload
    return {
      success: true,
      uploadUrl: `${config.services.auth}/api/habixo/properties/${propertyId}/photos/upload`,
      cloudName: undefined,
      uploadPreset: undefined,
      folder: undefined,
    };
  } catch (error) {
    photoLogger.error({ error, propertyId }, 'Failed to get presigned URL');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get presigned URL',
    };
  }
}

/**
 * Get all photos for a property
 */
export async function getPropertyPhotos(propertyId: string): Promise<IPropertyPhoto[]> {
  const photos = await PropertyPhoto.find({ propertyId })
    .sort({ order: 1, createdAt: -1 })
    .lean();
  return photos as unknown as IPropertyPhoto[];
}

/**
 * Set a photo as primary
 */
export async function setPrimaryPhoto(
  photoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const photo = await PropertyPhoto.findOne({ photoId });
    if (!photo) {
      throw new NotFoundError('Photo', photoId);
    }

    const { propertyId } = photo;

    // Unset all other primary photos
    await PropertyPhoto.updateMany(
      { propertyId, isPrimary: true },
      { $set: { isPrimary: false } }
    );

    // Set this photo as primary
    await PropertyPhoto.updateOne({ photoId }, { $set: { isPrimary: true } });

    // Update property photos array
    await Property.findOneAndUpdate(
      { propertyId },
      [
        {
          $set: {
            photos: {
              $map: {
                input: '$photos',
                as: 'photo',
                in: {
                  $mergeObjects: [
                    '$$photo',
                    {
                      isPrimary: {
                        $cond: [{ $eq: ['$$photo.url', photo.url] }, true, '$$photo.isPrimary'],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ]
    );

    photoLogger.info({ photoId, propertyId }, 'Primary photo updated');

    return { success: true };
  } catch (error) {
    photoLogger.error({ error, photoId }, 'Failed to set primary photo');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set primary photo',
    };
  }
}

/**
 * Update photo caption
 */
export async function updatePhotoCaption(
  photoId: string,
  caption: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const photo = await PropertyPhoto.findOneAndUpdate(
      { photoId },
      { $set: { caption } },
      { new: true }
    );

    if (!photo) {
      throw new NotFoundError('Photo', photoId);
    }

    // Update in property photos array
    await Property.findOneAndUpdate(
      { propertyId: photo.propertyId, 'photos.url': photo.url },
      { $set: { 'photos.$.caption': caption } }
    );

    photoLogger.info({ photoId }, 'Photo caption updated');

    return { success: true };
  } catch (error) {
    photoLogger.error({ error, photoId }, 'Failed to update photo caption');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update photo caption',
    };
  }
}
