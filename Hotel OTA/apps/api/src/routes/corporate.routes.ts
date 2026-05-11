import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateAdmin } from '../middleware/auth';
import { CorporateService } from '../services/corporate/corporate.service';
import { Errors } from '../utils/errors';

const router = Router();

router.use(authenticateAdmin);

// ─── Account CRUD ────────────────────────────────────────────────────────────────

/**
 * POST /admin/corporate/accounts
 */
router.post('/accounts', asyncHandler(async (req: Request, res: Response) => {
  const { company_name, gstin, billing_email, billing_address, credit_limit_paise, payment_terms_days } = req.body;
  if (!company_name) throw Errors.validation('company_name is required');

  const account = await CorporateService.createAccount({
    companyName: company_name,
    gstin,
    billingEmail: billing_email,
    billingAddress: billing_address,
    creditLimitPaise: credit_limit_paise,
    paymentTermsDays: payment_terms_days,
  });

  res.status(201).json(account);
}));

/**
 * GET /admin/corporate/accounts
 */
router.get('/accounts', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const result = await CorporateService.listAccounts(page);
  res.json(result);
}));

/**
 * GET /admin/corporate/accounts/:id
 */
router.get('/accounts/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await CorporateService.getAccountDetail(req.params.id);
  res.json(result);
}));

/**
 * PUT /admin/corporate/accounts/:id
 * Update corporate account details
 */
router.put('/accounts/:id', asyncHandler(async (req: Request, res: Response) => {
  const {
    company_name,
    gstin,
    billing_email,
    billing_address,
    credit_limit_paise,
    payment_terms_days,
    is_active,
  } = req.body;

  const account = await CorporateService.updateAccount(req.params.id, {
    companyName: company_name,
    gstin,
    billingEmail: billing_email,
    billingAddress: billing_address,
    creditLimitPaise: credit_limit_paise,
    paymentTermsDays: payment_terms_days,
    isActive: is_active,
  });

  res.json(account);
}));

/**
 * DELETE /admin/corporate/accounts/:id
 * Deactivate corporate account
 */
router.delete('/accounts/:id', asyncHandler(async (req: Request, res: Response) => {
  const account = await CorporateService.deactivateAccount(req.params.id);
  res.json({ success: true, message: 'Account deactivated', account });
}));

// ─── User Management ─────────────────────────────────────────────────────────────

/**
 * POST /admin/corporate/accounts/:id/users
 */
router.post('/accounts/:id/users', asyncHandler(async (req: Request, res: Response) => {
  const { user_id, role, cost_center } = req.body;
  if (!user_id) throw Errors.validation('user_id is required');

  const result = await CorporateService.addUser(req.params.id, user_id, role || 'traveller', cost_center);
  res.status(201).json(result);
}));

/**
 * PUT /admin/corporate/accounts/:id/users/:userId
 * Update user role or cost center
 */
router.put('/accounts/:id/users/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { role, cost_center, is_active } = req.body;

  const user = await CorporateService.updateUser(req.params.id, req.params.userId, {
    role,
    costCenter: cost_center,
    isActive: is_active,
  });

  res.json(user);
}));

/**
 * DELETE /admin/corporate/accounts/:id/users/:userId
 * Remove user from corporate account
 */
router.delete('/accounts/:id/users/:userId', asyncHandler(async (req: Request, res: Response) => {
  await CorporateService.removeUser(req.params.id, req.params.userId);
  res.json({ success: true, message: 'User removed from account' });
}));

// ─── Bookings & Approvals ────────────────────────────────────────────────────────

/**
 * GET /admin/corporate/accounts/:id/bookings
 * List corporate account bookings
 */
router.get('/accounts/:id/bookings', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await CorporateService.getAccountBookings(req.params.id, page, limit);
  res.json(result);
}));

/**
 * POST /admin/corporate/accounts/:id/approve/:bookingId
 * Approve a corporate booking
 */
router.post('/accounts/:id/approve/:bookingId', asyncHandler(async (req: Request, res: Response) => {
  const result = await CorporateService.approveBooking(req.params.id, req.params.bookingId);
  res.json(result);
}));

/**
 * POST /admin/corporate/accounts/:id/reject/:bookingId
 * Reject a corporate booking
 */
router.post('/accounts/:id/reject/:bookingId', asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  const result = await CorporateService.rejectBooking(req.params.id, req.params.bookingId, reason || 'No reason provided');
  res.json(result);
}));

export default router;
