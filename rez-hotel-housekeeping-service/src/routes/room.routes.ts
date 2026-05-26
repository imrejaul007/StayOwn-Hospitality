/**
 * Room Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getRoomStatuses, updateRoomStatus } from '../services/housekeepingService';

const router = Router();

// Get room statuses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotelId } = req.query;
    const rooms = await getRoomStatuses(hotelId as string);
    res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
});

// Update room status
router.patch('/:roomId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notes } = req.body;
    const room = await updateRoomStatus(req.params.roomId, status, notes);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
});

export { router as roomRoutes };
