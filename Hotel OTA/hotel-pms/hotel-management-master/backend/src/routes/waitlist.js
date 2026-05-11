import express from 'express';
import {
  getActiveWaitlist,
  createWaitlistEntry,
  processWaitlistMatches,
  getWaitlistAnalytics,
  handleMatchAction,
  addContactHistory,
  updateWaitlistEntry,
  findMatchCandidates,
  processExpiredEntries,
  getWaitlistEntry
} from '../controllers/waitlistController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validateWaitlistEntry, validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require authentication
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('waitlist', 'baseAccess'));

// Public waitlist routes (guests can create entries)
router.post('/', validate(mutationBaselineSchema), validateWaitlistEntry, createWaitlistEntry);

// Staff-only routes
router.use(authorizePolicy('waitlist', 'baseAccess'));

// Get active waitlist with filtering and pagination
router.get('/', getActiveWaitlist);

// Get waitlist analytics
router.get('/analytics', getWaitlistAnalytics);

// Process matches for all waiting entries
router.post('/process-matches', validate(mutationBaselineSchema), processWaitlistMatches);

// Find match candidates for specific criteria
router.post('/find-candidates', validate(mutationBaselineSchema), findMatchCandidates);

// Process expired entries
router.post('/process-expired', validate(mutationBaselineSchema), processExpiredEntries);

// Get specific waitlist entry
router.get('/:id', getWaitlistEntry);

// Update waitlist entry status
router.patch('/:id', validate(mutationBaselineSchema), updateWaitlistEntry);

// Handle match actions (confirm, decline, contact)
router.post('/:id/match/:matchId/action', validate(mutationBaselineSchema), handleMatchAction);

// Add contact history
router.post('/:id/contact', validate(mutationBaselineSchema), addContactHistory);

export default router;