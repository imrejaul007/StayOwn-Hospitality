import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateHotelStaff, authenticateAdmin } from '../middleware/auth';
import { ChannelManagerService } from '../services/integrations/channel-manager.service';
import { Errors } from '../utils/errors';

const router = Router();

// Hotel staff endpoints
router.post('/configure', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const { provider, api_key, api_secret, property_id } = req.body;
  if (!provider) throw Errors.validation('provider is required');

  const config = await ChannelManagerService.configure(req.hotelStaff!.hotelId, {
    provider, apiKey: api_key, apiSecret: api_secret, propertyId: property_id,
  });
  res.json(config);
}));

router.post('/sync', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const results = await ChannelManagerService.pushInventoryToChannel(req.hotelStaff!.hotelId);
  res.json({ results });
}));

router.get('/logs', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const logs = await ChannelManagerService.getSyncLogs(req.hotelStaff!.hotelId);
  res.json({ logs });
}));

// Inbound from channel manager (webhook)
router.post('/webhook/inventory', asyncHandler(async (req: Request, res: Response) => {
  const secret = process.env.CHANNEL_MANAGER_WEBHOOK_SECRET;
  const provided = req.headers['x-webhook-secret'] as string;
  if (!secret || !provided) throw Errors.forbidden();
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);
  if (secretBuf.length !== providedBuf.length || !timingSafeEqual(secretBuf, providedBuf)) throw Errors.forbidden();
  const { hotel_id, provider, updates } = req.body;
  if (!hotel_id || !provider || !updates) throw Errors.validation('hotel_id, provider, updates required');

  const result = await ChannelManagerService.receiveInventoryUpdate(hotel_id, provider, updates);
  res.json(result);
}));

export default router;
