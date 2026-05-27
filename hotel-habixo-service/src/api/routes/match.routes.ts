import { Router, Request, Response } from 'express';
import { createFlatmateProfile, findMatches, getFlatmateProfile, onMatchView } from '../../services';
import { logger } from '../../utils/logger';
import { authMiddleware, optionalAuthMiddleware } from '../../integrations/rez-auth';

const router = Router();
const matchLogger = logger.child({ service: 'MatchRoutes' });

/**
 * POST /api/habixo/match/profile
 * Create flatmate profile - Protected
 */
router.post('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Use authenticated user's ID
    const profileData = {
      ...req.body,
      userId: req.user!.userId,
    };
    const profile = await createFlatmateProfile(profileData);
    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    matchLogger.error({ error }, 'Failed to create flatmate profile');
    res.status(500).json({
      success: false,
      message: 'Failed to create flatmate profile',
    });
  }
});

/**
 * GET /api/habixo/match/profile/:userId
 * Get flatmate profile
 */
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const profile = await getFlatmateProfile(req.params.userId);
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    matchLogger.error({ error, userId: req.params.userId }, 'Failed to get flatmate profile');
    res.status(404).json({
      success: false,
      message: 'Flatmate profile not found',
    });
  }
});

/**
 * GET /api/habixo/match/suggestions
 * Find matching flatmates - Optional auth (uses authed user if present)
 */
router.get('/suggestions', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { city, minBudget, maxBudget, vibeTags, sleepSchedule, workFromHome, smoking, petFriendly, page, limit } = req.query;

    // Use authenticated user ID if no explicit userId provided
    let userId = req.query.userId as string | undefined;
    if (!userId && req.isAuthenticated) {
      userId = req.user!.userId;
    }

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required',
      });
      return;
    }

    const result = await findMatches(userId, {
      city: city as string,
      minBudget: minBudget ? parseInt(minBudget as string) : undefined,
      maxBudget: maxBudget ? parseInt(maxBudget as string) : undefined,
      vibeTags: vibeTags ? (Array.isArray(vibeTags) ? vibeTags as string[] : [vibeTags as string]) : undefined,
      sleepSchedule: sleepSchedule as string,
      workFromHome: workFromHome === 'true',
      smoking: smoking as string,
      petFriendly: petFriendly === 'true',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.matches,
      pagination: {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (parseInt(limit as string) || 20)),
      },
    });
  } catch (error) {
    matchLogger.error({ error }, 'Failed to find matches');
    res.status(500).json({
      success: false,
      message: 'Failed to find matches',
    });
  }
});

/**
 * POST /api/habixo/match/view
 * Record match view (for intent tracking) - Protected
 */
router.post('/view', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { flatmateId, compatibilityScore } = req.body;

    // Use authenticated user's ID as viewerId
    const viewerId = req.user!.userId;

    if (!flatmateId) {
      res.status(400).json({
        success: false,
        message: 'flatmateId is required',
      });
      return;
    }

    await onMatchView(viewerId, flatmateId, compatibilityScore || 0);

    res.json({
      success: true,
    });
  } catch (error) {
    matchLogger.error({ error }, 'Failed to record match view');
    res.status(500).json({
      success: false,
      message: 'Failed to record match view',
    });
  }
});

export default router;
