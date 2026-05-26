/**
 * Stay Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { recordStay, getGuestStays, addFeedback } from '../services/crmService';

const router = Router();

// Record a stay
router.post('/record', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stay = await recordStay(req.body);
    res.status(201).json({ success: true, data: stay });
  } catch (error) {
    next(error);
  }
});

// Get guest stays
router.get('/guest/:guestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stays = await getGuestStays(req.params.guestId);
    res.json({ success: true, data: stays });
  } catch (error) {
    next(error);
  }
});

// Add feedback
router.post('/feedback/:bookingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rating, comment } = req.body;
    const stay = await addFeedback(req.params.bookingId, rating, comment);
    if (!stay) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: stay });
  } catch (error) {
    next(error);
  }
});

export { router as stayRoutes };
