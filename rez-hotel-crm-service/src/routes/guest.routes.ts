/**
 * Guest Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createGuest,
  getGuest,
  getGuestByPhone,
  updateGuest,
  searchGuests,
  getVipGuests,
  getBlacklistedGuests,
  toggleVip,
  blacklistGuest,
  addGuestNote,
} from '../services/crmService';

const router = Router();

// Create guest
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = await createGuest(req.body);
    res.status(201).json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
});

// Search guests
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotelId, q } = req.query;
    const guests = await searchGuests(hotelId as string, q as string);
    res.json({ success: true, data: guests });
  } catch (error) {
    next(error);
  }
});

// Get VIP guests
router.get('/vip/:hotelId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guests = await getVipGuests(req.params.hotelId);
    res.json({ success: true, data: guests });
  } catch (error) {
    next(error);
  }
});

// Get blacklisted guests
router.get('/blacklist/:hotelId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guests = await getBlacklistedGuests(req.params.hotelId);
    res.json({ success: true, data: guests });
  } catch (error) {
    next(error);
  }
});

// Get guest by phone
router.get('/phone/:hotelId/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = await getGuestByPhone(req.params.hotelId, req.params.phone);
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
});

// Get single guest
router.get('/:guestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = await getGuest(req.params.guestId);
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
});

// Update guest
router.put('/:guestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = await updateGuest(req.params.guestId, req.body);
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
});

// Add note
router.post('/:guestId/notes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note } = req.body;
    const guest = await addGuestNote(req.params.guestId, note);
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
});

// Toggle VIP
router.post('/:guestId/vip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = await toggleVip(req.params.guestId);
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
});

// Blacklist guest
router.post('/:guestId/blacklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = await blacklistGuest(req.params.guestId);
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }
    res.json({ success: true, data: guest });
  } catch (error) {
    next(error);
  }
});

export { router as guestRoutes };
