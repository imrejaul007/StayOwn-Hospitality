import express from 'express';
import searchController from '../controllers/searchController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';

const router = express.Router();

// Public search routes (no auth required)
router.get('/global', searchController.globalSearch);
router.get('/suggestions', searchController.getSearchSuggestions);

// Protected routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

export default router;