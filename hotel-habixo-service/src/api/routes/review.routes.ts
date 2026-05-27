import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createReview,
  getReviewById,
  getReviewsForProperty,
  getReviewsForHost,
  getReviewsByGuest,
  respondToReview,
  markReviewHelpful,
  searchReviews,
} from '../../services';
import { logger } from '../../utils/logger';

const router = Router();
const reviewLogger = logger.child({ service: 'ReviewRoutes' });

// ── Validation Schemas ──────────────────────────────────────────────────────────

const createReviewSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  reviewerType: z.enum(['guest', 'host']),
  rating: z.number().min(1).max(5),
  ratings: z.object({
    cleanliness: z.number().min(1).max(5).optional(),
    accuracy: z.number().min(1).max(5).optional(),
    checkIn: z.number().min(1).max(5).optional(),
    communication: z.number().min(1).max(5).optional(),
    location: z.number().min(1).max(5).optional(),
    value: z.number().min(1).max(5).optional(),
  }).optional(),
  comment: z.string().min(1, 'Comment is required').max(2000),
});

const reviewResponseSchema = z.object({
  reviewId: z.string().min(1, 'Review ID is required'),
  hostId: z.string().min(1, 'Host ID is required'),
  response: z.string().min(1).max(1000),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/habixo/reviews
 * Create a new review
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createReviewSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const review = await createReview(validation.data);
    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    if (error instanceof Error && error.name === 'ConflictError') {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }
    reviewLogger.error({ error, body: req.body }, 'Failed to create review');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create review',
    });
  }
});

/**
 * GET /api/habixo/reviews/property/:propertyId
 * Get reviews for a property
 */
router.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { page, limit } = req.query;

    const result = await getReviewsForProperty(propertyId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.reviews,
      averageRating: result.averageRating,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    reviewLogger.error({ error, propertyId: req.params.propertyId }, 'Failed to get property reviews');
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews',
    });
  }
});

/**
 * GET /api/habixo/reviews/host/:hostId
 * Get reviews for a host
 */
router.get('/host/:hostId', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.params;
    const { page, limit } = req.query;

    const result = await getReviewsForHost(hostId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.reviews,
      averageRating: result.averageRating,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    reviewLogger.error({ error, hostId: req.params.hostId }, 'Failed to get host reviews');
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews',
    });
  }
});

/**
 * GET /api/habixo/reviews/guest/:guestId
 * Get reviews by a guest
 */
router.get('/guest/:guestId', async (req: Request, res: Response) => {
  try {
    const { guestId } = req.params;
    const { page, limit } = req.query;

    const result = await getReviewsByGuest(guestId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.reviews,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    reviewLogger.error({ error, guestId: req.params.guestId }, 'Failed to get guest reviews');
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews',
    });
  }
});

/**
 * GET /api/habixo/reviews/:reviewId
 * Get review by ID
 */
router.get('/:reviewId', async (req: Request, res: Response) => {
  try {
    const review = await getReviewById(req.params.reviewId);
    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Review not found',
      });
      return;
    }
    reviewLogger.error({ error, reviewId: req.params.reviewId }, 'Failed to get review');
    res.status(500).json({
      success: false,
      message: 'Failed to get review',
    });
  }
});

/**
 * POST /api/habixo/reviews/respond
 * Host responds to a review
 */
router.post('/respond', async (req: Request, res: Response) => {
  try {
    const validation = reviewResponseSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const review = await respondToReview(validation.data);
    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Review not found',
      });
      return;
    }
    if (error instanceof Error && error.name === 'ConflictError') {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }
    reviewLogger.error({ error, body: req.body }, 'Failed to respond to review');
    res.status(500).json({
      success: false,
      message: 'Failed to respond to review',
    });
  }
});

/**
 * POST /api/habixo/reviews/:reviewId/helpful
 * Mark review as helpful
 */
router.post('/:reviewId/helpful', async (req: Request, res: Response) => {
  try {
    const review = await markReviewHelpful(req.params.reviewId);
    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      res.status(404).json({
        success: false,
        message: 'Review not found',
      });
      return;
    }
    reviewLogger.error({ error, reviewId: req.params.reviewId }, 'Failed to mark review helpful');
    res.status(500).json({
      success: false,
      message: 'Failed to mark review helpful',
    });
  }
});

/**
 * GET /api/habixo/reviews/search
 * Search reviews with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      propertyId,
      hostId,
      guestId,
      minRating,
      maxRating,
      page,
      limit,
    } = req.query;

    const result = await searchReviews({
      propertyId: propertyId as string,
      hostId: hostId as string,
      guestId: guestId as string,
      minRating: minRating ? parseInt(minRating as string) : undefined,
      maxRating: maxRating ? parseInt(maxRating as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.reviews,
      pagination: {
        page: result.page,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    reviewLogger.error({ error }, 'Failed to search reviews');
    res.status(500).json({
      success: false,
      message: 'Failed to search reviews',
    });
  }
});

export default router;
