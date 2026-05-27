import { Router, Request, Response } from 'express';
import { captureIntent, HabixoIntents } from '../../integrations/rez-mind';
import { logger } from '../../utils/logger';

const router = Router();
const webhookLogger = logger.child({ service: 'WebhookRoutes' });

/**
 * POST /webhooks/habixo/stay/search
 * Capture stay search intent
 */
router.post('/webhooks/habixo/stay/search', async (req: Request, res: Response) => {
  try {
    const { userId, city, checkIn, checkOut, guests, propertyType } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    await captureIntent({
      userId,
      ...HabixoIntents.staySearch(city || 'unknown', { checkIn, checkOut, guests, propertyType }),
    });

    res.json({ success: true });
  } catch (error) {
    webhookLogger.error({ error }, 'Failed to capture stay search intent');
    res.status(500).json({ success: false, message: 'Failed to capture intent' });
  }
});

/**
 * POST /webhooks/habixo/stay/view
 * Capture stay view intent
 */
router.post('/webhooks/habixo/stay/view', async (req: Request, res: Response) => {
  try {
    const { userId, propertyId, propertyTitle, city } = req.body;

    if (!userId || !propertyId) {
      res.status(400).json({ success: false, message: 'userId and propertyId are required' });
      return;
    }

    await captureIntent({
      userId,
      ...HabixoIntents.stayView(propertyId, propertyTitle, city),
    });

    res.json({ success: true });
  } catch (error) {
    webhookLogger.error({ error }, 'Failed to capture stay view intent');
    res.status(500).json({ success: false, message: 'Failed to capture intent' });
  }
});

/**
 * POST /webhooks/habixo/rent/search
 * Capture rent search intent
 */
router.post('/webhooks/habixo/rent/search', async (req: Request, res: Response) => {
  try {
    const { userId, city, neighborhood, bedrooms, budget } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    await captureIntent({
      userId,
      ...HabixoIntents.rentSearch(city || 'unknown', neighborhood, { bedrooms, budget }),
    });

    res.json({ success: true });
  } catch (error) {
    webhookLogger.error({ error }, 'Failed to capture rent search intent');
    res.status(500).json({ success: false, message: 'Failed to capture intent' });
  }
});

/**
 * POST /webhooks/habixo/match/search
 * Capture flatmate search intent
 */
router.post('/webhooks/habixo/match/search', async (req: Request, res: Response) => {
  try {
    const { userId, city, vibeTags, budget } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    await captureIntent({
      userId,
      ...HabixoIntents.matchSearch(city || 'unknown', vibeTags),
    });

    res.json({ success: true });
  } catch (error) {
    webhookLogger.error({ error }, 'Failed to capture match search intent');
    res.status(500).json({ success: false, message: 'Failed to capture intent' });
  }
});

export default router;
