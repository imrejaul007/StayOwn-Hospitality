import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createWishlist,
  getWishlistsByUser,
  getWishlistById,
  addToWishlist,
  removeFromWishlist,
  deleteWishlist,
  getUserWishlistPropertyIds,
  isPropertyInWishlist,
} from '../../services';
import { logger } from '../../utils/logger';
import { authMiddleware, AuthenticatedRequest } from '../../integrations/rez-auth';

const router = Router();
const wishlistLogger = logger.child({ service: 'WishlistRoutes' });

// ── Validation Schemas ──────────────────────────────────────────────────────────

const createWishlistSchema = z.object({
  // userId from auth, not body
  name: z.string().min(1, 'Name is required').max(100),
});

const addToWishlistSchema = z.object({
  // userId from auth, not body
  propertyId: z.string().min(1, 'Property ID is required'),
  wishlistId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/habixo/wishlists
 * Create a new wishlist
 * Requires authentication
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // SECURITY: Use authenticated user ID, ignore body userId
    const authenticatedUserId = req.user?.userId || req.user?.id;
    if (!authenticatedUserId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const validation = createWishlistSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const wishlist = await createWishlist({
      userId: authenticatedUserId,
      ...validation.data,
    });
    res.status(201).json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    wishlistLogger.error({ error, body: req.body }, 'Failed to create wishlist');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create wishlist',
    });
  }
});

/**
 * GET /api/habixo/wishlists/user/:userId
 * Get all wishlists for a user
 * Requires authentication - users can only access their own wishlists
 */
router.get('/user/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authenticatedUserId = req.user?.userId || req.user?.id;
    const requestedUserId = req.params.userId;

    // SECURITY: Users can only access their own wishlists (unless admin)
    if (authenticatedUserId !== requestedUserId && req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    const wishlists = await getWishlistsByUser(requestedUserId);
    res.json({
      success: true,
      data: wishlists,
    });
  } catch (error) {
    wishlistLogger.error({ error, userId: req.params.userId }, 'Failed to get user wishlists');
    res.status(500).json({
      success: false,
      message: 'Failed to get wishlists',
    });
  }
});

/**
 * GET /api/habixo/wishlists/:wishlistId
 * Get wishlist by ID
 */
router.get('/:wishlistId', async (req: Request, res: Response) => {
  try {
    const wishlist = await getWishlistById(req.params.wishlistId);
    res.json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
      return;
    }
    wishlistLogger.error({ error, wishlistId: req.params.wishlistId }, 'Failed to get wishlist');
    res.status(500).json({
      success: false,
      message: 'Failed to get wishlist',
    });
  }
});

/**
 * POST /api/habixo/wishlists/items
 * Add item to wishlist
 */
router.post('/items', async (req: Request, res: Response) => {
  try {
    const validation = addToWishlistSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const wishlist = await addToWishlist(validation.data);
    res.status(201).json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ConflictError') {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
      return;
    }
    wishlistLogger.error({ error, body: req.body }, 'Failed to add to wishlist');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add to wishlist',
    });
  }
});

/**
 * DELETE /api/habixo/wishlists/:wishlistId/items/:propertyId
 * Remove item from wishlist
 */
router.delete('/:wishlistId/items/:propertyId', async (req: Request, res: Response) => {
  try {
    const { wishlistId, propertyId } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId query parameter is required',
      });
      return;
    }

    const wishlist = await removeFromWishlist(wishlistId, propertyId, userId);
    res.json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }
    wishlistLogger.error({ error, params: req.params }, 'Failed to remove from wishlist');
    res.status(500).json({
      success: false,
      message: 'Failed to remove from wishlist',
    });
  }
});

/**
 * DELETE /api/habixo/wishlists/:wishlistId
 * Delete a wishlist
 */
router.delete('/:wishlistId', async (req: Request, res: Response) => {
  try {
    const { wishlistId } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId query parameter is required',
      });
      return;
    }

    await deleteWishlist(wishlistId, userId);
    res.json({
      success: true,
      message: 'Wishlist deleted',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Wishlist not found',
      });
      return;
    }
    wishlistLogger.error({ error, wishlistId: req.params.wishlistId }, 'Failed to delete wishlist');
    res.status(500).json({
      success: false,
      message: 'Failed to delete wishlist',
    });
  }
});

/**
 * GET /api/habixo/wishlists/user/:userId/property-ids
 * Get all wishlisted property IDs for a user
 */
router.get('/user/:userId/property-ids', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const propertyIds = await getUserWishlistPropertyIds(userId);
    res.json({
      success: true,
      data: propertyIds,
    });
  } catch (error) {
    wishlistLogger.error({ error, userId: req.params.userId }, 'Failed to get wishlist property IDs');
    res.status(500).json({
      success: false,
      message: 'Failed to get wishlist property IDs',
    });
  }
});

/**
 * GET /api/habixo/wishlists/user/:userId/check/:propertyId
 * Check if property is in user's wishlist
 */
router.get('/user/:userId/check/:propertyId', async (req: Request, res: Response) => {
  try {
    const { userId, propertyId } = req.params;
    const isInWishlist = await isPropertyInWishlist(userId, propertyId);
    res.json({
      success: true,
      data: { isInWishlist },
    });
  } catch (error) {
    wishlistLogger.error({ error, params: req.params }, 'Failed to check wishlist');
    res.status(500).json({
      success: false,
      message: 'Failed to check wishlist',
    });
  }
});

export default router;
