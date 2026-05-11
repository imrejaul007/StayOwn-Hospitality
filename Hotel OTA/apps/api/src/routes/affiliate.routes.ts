import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateAdmin } from '../middleware/auth';
import { AffiliateService } from '../services/marketing/affiliate.service';
import { Errors } from '../utils/errors';

const router = Router();

router.post('/partners', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name, code, commission_pct, type, contact_email } = req.body;
  if (!name || !code || !commission_pct || !type) throw Errors.validation('name, code, commission_pct, type required');

  const partner = await AffiliateService.createPartner({
    name, code, commissionPct: commission_pct, type, contactEmail: contact_email,
  });
  res.status(201).json(partner);
}));

router.get('/partners', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const partners = await AffiliateService.listPartners();
  res.json({ partners });
}));

router.get('/partners/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const stats = await AffiliateService.getPartnerStats(req.params.id);
  res.json(stats);
}));

// Public tracking endpoint (no auth — called from tracking links)
router.get('/track/:code', asyncHandler(async (req: Request, res: Response) => {
  await AffiliateService.trackClick(req.params.code);
  // Redirect to OTA homepage with affiliate cookie
  res.redirect(302, `/?ref=${req.params.code}`);
}));

export default router;
