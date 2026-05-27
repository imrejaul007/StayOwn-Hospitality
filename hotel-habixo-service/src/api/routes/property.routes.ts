import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  createProperty,
  getPropertyById,
  updateProperty,
  searchProperties,
  getPropertiesByHost,
  activateProperty,
  deactivateProperty,
  uploadPhoto,
  deletePhoto,
  reorderPhotos,
  getPresignedUrl,
  getPropertyPhotos,
  setPrimaryPhoto,
  updatePhotoCaption,
} from '../../services';
import { logger } from '../../utils/logger';
import { authMiddleware, requireHost } from '../../integrations/rez-auth';

const router = Router();
const propertyLogger = logger.child({ service: 'PropertyRoutes' });

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and HEIC are allowed.'));
    }
  },
});

/**
 * POST /api/habixo/properties
 * Create a new property - Protected (requires host/admin role)
 */
router.post('/', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    // Use authenticated user's ID as hostId
    const propertyData = {
      ...req.body,
      hostId: req.user!.userId,
    };
    const property = await createProperty(propertyData);
    res.status(201).json({
      success: true,
      data: property,
    });
  } catch (error) {
    propertyLogger.error({ error, body: req.body }, 'Failed to create property');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create property',
    });
  }
});

/**
 * GET /api/habixo/properties
 * Search properties
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      city,
      neighborhood,
      brand,
      propertyType,
      roomType,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      guests,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await searchProperties({
      city: city as string,
      neighborhood: neighborhood as string,
      brand: brand as string,
      propertyType: propertyType as string,
      roomType: roomType as string,
      minPrice: minPrice ? parseInt(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      bedrooms: bedrooms ? parseInt(bedrooms as string) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms as string) : undefined,
      guests: guests ? parseInt(guests as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
    });

    res.json({
      success: true,
      data: result.properties,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    propertyLogger.error({ error }, 'Failed to search properties');
    res.status(500).json({
      success: false,
      message: 'Failed to search properties',
    });
  }
});

/**
 * GET /api/habixo/properties/host/:hostId
 * Get properties by host
 */
router.get('/host/:hostId', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.params;
    const properties = await getPropertiesByHost(hostId);
    res.json({
      success: true,
      data: properties,
    });
  } catch (error) {
    propertyLogger.error({ error }, 'Failed to get host properties');
    res.status(500).json({
      success: false,
      message: 'Failed to get host properties',
    });
  }
});

/**
 * GET /api/habixo/properties/:id
 * Get property by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const property = await getPropertyById(req.params.id);
    res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Property not found',
      });
      return;
    }
    propertyLogger.error({ error, id: req.params.id }, 'Failed to get property');
    res.status(500).json({
      success: false,
      message: 'Failed to get property',
    });
  }
});

/**
 * PUT /api/habixo/properties/:id
 * Update property - Protected (requires host/admin role)
 */
router.put('/:id', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    // For admin, allow any property; for hosts, only their own
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';

    if (!isAdmin) {
      // Check ownership
      const property = await getPropertyById(req.params.id);
      if (property.hostId !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'You can only update your own properties',
        });
        return;
      }
    }

    const property = await updateProperty(req.params.id, req.body);
    res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    propertyLogger.error({ error, id: req.params.id }, 'Failed to update property');
    res.status(500).json({
      success: false,
      message: 'Failed to update property',
    });
  }
});

/**
 * POST /api/habixo/properties/:id/activate
 * Activate property - Protected (requires host/admin role)
 */
router.post('/:id/activate', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    // Check ownership for non-admin users
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (!isAdmin) {
      const property = await getPropertyById(req.params.id);
      if (property.hostId !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'You can only activate your own properties',
        });
        return;
      }
    }

    const property = await activateProperty(req.params.id);
    res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    propertyLogger.error({ error, id: req.params.id }, 'Failed to activate property');
    res.status(500).json({
      success: false,
      message: 'Failed to activate property',
    });
  }
});

/**
 * POST /api/habixo/properties/:id/deactivate
 * Deactivate property - Protected (requires host/admin role)
 */
router.post('/:id/deactivate', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    // Check ownership for non-admin users
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (!isAdmin) {
      const property = await getPropertyById(req.params.id);
      if (property.hostId !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'You can only deactivate your own properties',
        });
        return;
      }
    }

    const property = await deactivateProperty(req.params.id);
    res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    propertyLogger.error({ error, id: req.params.id }, 'Failed to deactivate property');
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate property',
    });
  }
});

/**
 * GET /api/habixo/properties/:id/photos
 * Get all photos for a property
 */
router.get('/:id/photos', async (req: Request, res: Response) => {
  try {
    const photos = await getPropertyPhotos(req.params.id);
    res.json({
      success: true,
      data: photos,
    });
  } catch (error) {
    propertyLogger.error({ error, id: req.params.id }, 'Failed to get property photos');
    res.status(500).json({
      success: false,
      message: 'Failed to get property photos',
    });
  }
});

/**
 * POST /api/habixo/properties/:id/photos
 * Upload photos to a property - Protected (requires host/admin role)
 * Accepts multiple files via multipart/form-data
 */
router.post('/:id/photos', authMiddleware, requireHost, upload.array('photos', 10), async (req: Request, res: Response) => {
  try {
    const { id: propertyId } = req.params;
    const files = req.files as Express.Multer.File[];
    const { caption, isPrimary } = req.body;

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
      return;
    }

    // Use authenticated user's ID
    const userId = req.user!.userId;

    // Check ownership for non-admin users
    const isAdmin = req.user!.role === 'admin' || req.user!.role === 'super_admin';
    if (!isAdmin) {
      const property = await getPropertyById(propertyId);
      if (property.hostId !== userId) {
        res.status(403).json({
          success: false,
          message: 'You can only upload photos to your own properties',
        });
        return;
      }
    }

    const uploadResults = await Promise.all(
      files.map(async (file, index) => {
        return uploadPhoto({
          file: file.buffer,
          propertyId,
          mimeType: file.mimetype,
          caption: caption || undefined,
          isPrimary: isPrimary === 'true' && index === 0,
          userId: userId,
        });
      })
    );

    const successful = uploadResults.filter((r) => r.success);
    const failed = uploadResults.filter((r) => !r.success);

    if (successful.length === 0) {
      res.status(500).json({
        success: false,
        message: failed[0]?.error || 'Failed to upload photos',
        errors: failed.map((f) => f.error),
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        photos: successful.map((r) => r.photo),
        urls: successful.map((r) => r.url),
      },
      message: `Uploaded ${successful.length} photo(s)`,
      errors: failed.length > 0 ? failed.map((f) => f.error) : undefined,
    });
  } catch (error) {
    propertyLogger.error({ error, id: req.params.id }, 'Failed to upload photos');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to upload photos',
    });
  }
});

/**
 * POST /api/habixo/properties/:id/photos/upload-url
 * Get presigned URL for direct client-side upload - Protected
 */
router.post('/:id/photos/upload-url', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    const result = await getPresignedUrl(req.params.id);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.error,
      });
      return;
    }
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    propertyLogger.error({ error, id: req.params.id }, 'Failed to get presigned URL');
    res.status(500).json({
      success: false,
      message: 'Failed to get presigned URL',
    });
  }
});

/**
 * DELETE /api/habixo/properties/:id/photos/:photoId
 * Delete a photo - Protected (requires host/admin role)
 */
router.delete('/:id/photos/:photoId', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const result = await deletePhoto(photoId);
    if (!result.success) {
      res.status(404).json({
        success: false,
        message: result.error,
      });
      return;
    }
    res.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    propertyLogger.error({ error, photoId: req.params.photoId }, 'Failed to delete photo');
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo',
    });
  }
});

/**
 * PUT /api/habixo/properties/:id/photos/reorder
 * Reorder photos - Protected (requires host/admin role)
 */
router.put('/:id/photos/reorder', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    const { photoIds } = req.body;
    if (!Array.isArray(photoIds)) {
      res.status(400).json({
        success: false,
        message: 'photoIds must be an array',
      });
      return;
    }
    const result = await reorderPhotos({
      propertyId: req.params.id,
      photoIds,
    });
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.error,
      });
      return;
    }
    res.json({
      success: true,
      data: result.photos,
      message: 'Photos reordered successfully',
    });
  } catch (error) {
    propertyLogger.error({ error, id: req.params.id }, 'Failed to reorder photos');
    res.status(500).json({
      success: false,
      message: 'Failed to reorder photos',
    });
  }
});

/**
 * PUT /api/habixo/properties/:id/photos/:photoId/primary
 * Set photo as primary - Protected (requires host/admin role)
 */
router.put('/:id/photos/:photoId/primary', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    const result = await setPrimaryPhoto(req.params.photoId);
    if (!result.success) {
      res.status(404).json({
        success: false,
        message: result.error,
      });
      return;
    }
    res.json({
      success: true,
      message: 'Primary photo updated',
    });
  } catch (error) {
    propertyLogger.error({ error, photoId: req.params.photoId }, 'Failed to set primary photo');
    res.status(500).json({
      success: false,
      message: 'Failed to set primary photo',
    });
  }
});

/**
 * PATCH /api/habixo/properties/:id/photos/:photoId
 * Update photo caption - Protected (requires host/admin role)
 */
router.patch('/:id/photos/:photoId', authMiddleware, requireHost, async (req: Request, res: Response) => {
  try {
    const { caption } = req.body;
    const result = await updatePhotoCaption(req.params.photoId, caption);
    if (!result.success) {
      res.status(404).json({
        success: false,
        message: result.error,
      });
      return;
    }
    res.json({
      success: true,
      message: 'Photo caption updated',
    });
  } catch (error) {
    propertyLogger.error({ error, photoId: req.params.photoId }, 'Failed to update photo caption');
    res.status(500).json({
      success: false,
      message: 'Failed to update photo caption',
    });
  }
});

export default router;
