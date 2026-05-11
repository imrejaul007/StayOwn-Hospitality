import express from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';

const router = express.Router();

// All routes require authentication and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Dashboard counts endpoint
router.get('/counts', authorize(['admin', 'manager', 'staff', 'frontdesk']), dashboardController.getDashboardCounts);

// Room status summary
router.get('/room-status', authorize(['admin', 'manager', 'staff', 'frontdesk']), dashboardController.getRoomStatusSummary);

// Recent activities
router.get('/activities', authorize(['admin', 'manager', 'staff', 'frontdesk']), dashboardController.getRecentActivities);

export default router;
