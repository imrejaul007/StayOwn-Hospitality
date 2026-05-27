import { Router, Request, Response } from 'express';
import { getTrustScoreResponse } from '../../services';
import { logger } from '../../utils/logger';
import { optionalAuthMiddleware } from '../../integrations/rez-auth';

const router = Router();
const trustLogger = logger.child({ service: 'TrustRoutes' });

/**
 * GET /api/habixo/trust/:entityId
 * Get trust score - Optional auth (personalized if logged in)
 */
router.get('/:entityId', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const { type } = req.query;

    if (!type || !['property', 'host', 'guest'].includes(type as string)) {
      res.status(400).json({
        success: false,
        message: 'type query param (property|host|guest) is required',
      });
      return;
    }

    const trust = await getTrustScoreResponse(entityId, type as 'property' | 'host' | 'guest');

    res.json({
      success: true,
      data: trust,
    });
  } catch (error) {
    trustLogger.error({ error }, 'Failed to get trust score');
    res.status(500).json({
      success: false,
      message: 'Failed to get trust score',
    });
  }
});

export default router;
