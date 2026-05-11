import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateHotelStaff, authenticateAdmin } from '../middleware/auth';
import { PricingService } from '../services/pricing/pricing.service';

const router = Router();

// Hotel panel endpoints
router.get('/suggestions', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const suggestions = await PricingService.getSuggestions(req.hotelStaff!.hotelId);
  res.json({ suggestions });
}));

router.post('/suggestions/:id/accept', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const result = await PricingService.acceptSuggestion(req.params.id);
  res.json(result);
}));

router.post('/suggestions/:id/reject', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.pricingSuggestion.update({ where: { id: req.params.id }, data: { status: 'rejected' } });
  await prisma.$disconnect();
  res.json({ rejected: true });
}));

router.get('/forecast', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const forecast = await PricingService.getForecast(req.hotelStaff!.hotelId);
  res.json({ forecast });
}));

// Admin trigger endpoints
router.post('/admin/generate-suggestions/:hotelId', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const count = await PricingService.generateSuggestions(req.params.hotelId);
  res.json({ generated: count });
}));

router.post('/admin/generate-forecast/:hotelId', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const count = await PricingService.generateForecast(req.params.hotelId);
  res.json({ generated: count });
}));

export default router;
