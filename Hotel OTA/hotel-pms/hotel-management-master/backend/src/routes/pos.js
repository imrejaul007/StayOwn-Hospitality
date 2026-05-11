import express from 'express';
import posController from '../controllers/posController.js';
import posTaxRoutes from './posTax.js';
import measurementUnitRoutes from './measurementUnits.js';
import posAttributeRoutes from './posAttributes.js';
import billMessageRoutes from './billMessages.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate, schemas } from '../middleware/validation.js';
import financialRateLimiter from '../middleware/financialRateLimiter.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Rate limiting for POS financial operations
router.use(financialRateLimiter);
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('pos', 'baseAccess'));

// Outlet routes
router.post('/outlets', authenticate, ensureTenantContext, authorizePolicy('pos', 'manageAccess'), ensurePropertyAccess, validate(mutationBaselineSchema), posController.createOutlet);
router.get('/outlets', authenticate, ensureTenantContext, ensurePropertyAccess, posController.getOutlets);
router.put('/outlets/:id', authenticate, ensureTenantContext, authorizePolicy('pos', 'manageAccess'), ensurePropertyAccess, validate(mutationBaselineSchema), posController.updateOutlet);

// Menu routes
router.post('/menus', authenticate, ensureTenantContext, authorizePolicy('pos', 'manageAccess'), ensurePropertyAccess, validate(mutationBaselineSchema), posController.createMenu);
router.get('/menus/outlet/:outletId', authenticate, ensureTenantContext, ensurePropertyAccess, posController.getMenusByOutlet);
router.post('/menus/:menuId/items', authenticate, ensureTenantContext, authorizePolicy('pos', 'manageAccess'), ensurePropertyAccess, validate(mutationBaselineSchema), posController.addMenuItem);

// Order routes
router.post('/orders', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), posController.createOrder);
router.get('/orders', authenticate, ensureTenantContext, ensurePropertyAccess, posController.getOrders);
router.put('/orders/:id/status', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), posController.updateOrderStatus);
router.put('/orders/:id/payment', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), posController.processPayment);

// Dashboard routes
router.get('/dashboard/stats', authenticate, ensureTenantContext, ensurePropertyAccess, posController.getDashboardStats);

// Calculation routes
router.post('/calculate/order-totals', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), posController.calculateOrderTotals);
router.post('/calculate/billing-totals', authenticate, ensureTenantContext, ensurePropertyAccess, validate(mutationBaselineSchema), posController.calculateBillingTotals);

// Reporting routes
router.get('/reports/sales', authenticate, ensureTenantContext, authorizePolicy('pos', 'manageAccess'), ensurePropertyAccess, posController.getSalesReport);

// Tax management routes
router.use('/taxes', posTaxRoutes);

// Measurement unit routes
router.use('/measurement-units', measurementUnitRoutes);

// POS attribute routes
router.use('/attributes', posAttributeRoutes);

// Bill message routes
router.use('/bill-messages', billMessageRoutes);

export default router;