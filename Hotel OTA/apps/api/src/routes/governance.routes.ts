import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateAdmin, authenticateHotelStaff } from '../middleware/auth';
import { GovernanceService } from '../services/governance/governance.service';
import { Errors } from '../utils/errors';
import { q } from '../utils/query';

const router = Router();

// Admin endpoints
router.post('/proposals', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { title, description, proposal_type, voting_start_at, voting_end_at } = req.body;
  if (!title || !description || !proposal_type) throw Errors.validation('title, description, proposal_type required');

  const proposal = await GovernanceService.createProposal({
    title, description, proposalType: proposal_type,
    proposedBy: req.admin!.adminId,
    votingStartAt: voting_start_at ? new Date(voting_start_at) : undefined,
    votingEndAt: voting_end_at ? new Date(voting_end_at) : undefined,
  });
  res.status(201).json(proposal);
}));

router.get('/proposals', asyncHandler(async (req: Request, res: Response) => {
  const status = q(req, 'status');
  const proposals = await GovernanceService.listProposals(status);
  res.json({ proposals });
}));

router.post('/proposals/:id/tally', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const result = await GovernanceService.tallyVotes(req.params.id);
  res.json(result);
}));

// Hotel voting
router.post('/proposals/:id/vote', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const { vote } = req.body;
  if (!['for', 'against', 'abstain'].includes(vote)) throw Errors.validation('vote must be for, against, or abstain');

  const result = await GovernanceService.castVote(req.params.id, req.hotelStaff!.hotelId, vote);
  res.json(result);
}));

// Dividends
router.post('/dividends', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { period_year, total_amount_paise } = req.body;
  if (!period_year || !total_amount_paise) throw Errors.validation('period_year and total_amount_paise required');

  const result = await GovernanceService.createDividend(period_year, total_amount_paise);
  res.json(result);
}));

router.get('/dividends/hotel', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const dividends = await GovernanceService.getHotelDividends(req.hotelStaff!.hotelId);
  res.json({ dividends });
}));

export default router;
