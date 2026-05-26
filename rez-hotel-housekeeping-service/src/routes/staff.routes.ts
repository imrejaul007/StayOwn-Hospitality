/**
 * Staff Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getStaff, createStaff } from '../services/housekeepingService';

const router = Router();

// Get all staff
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotelId } = req.query;
    const staff = await getStaff(hotelId as string);
    res.json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
});

// Create staff
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const staff = await createStaff(req.body);
    res.status(201).json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
});

export { router as staffRoutes };
