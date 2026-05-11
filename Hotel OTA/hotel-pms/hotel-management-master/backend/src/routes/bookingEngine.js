import express from 'express';
import bookingEngineController from '../controllers/bookingEngineController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true);

// Booking Widget Routes
router.post('/widgets', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.createBookingWidget);
router.get('/widgets', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getBookingWidgets);
router.put('/widgets/:id', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.updateBookingWidget);
router.delete('/widgets/:id', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.deleteBookingWidget);
router.get('/widgets/:widgetId/code', bookingEngineController.getWidgetCode);
router.post('/widgets/:widgetId/booking', validate(mutationBaselineSchema), bookingEngineController.processWidgetBooking);

// Widget Tracking Routes (Public for external websites)
router.post('/widget/track', validate(mutationBaselineSchema), bookingEngineController.trackWidgetEvent);
router.get('/widgets/:widgetId/analytics', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getWidgetAnalytics);
router.get('/widgets/performance/summary', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getWidgetsPerformanceSummary);

// Promo Code Routes
router.post('/promo-codes', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.createPromoCode);
router.get('/promo-codes', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getPromoCodes);
router.put('/promo-codes/:id', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.updatePromoCode);
router.post('/promo-codes/validate', validate(mutationBaselineSchema), bookingEngineController.validatePromoCode);

// Guest CRM Routes
router.get('/crm/guests', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getGuestCRM);
router.get('/crm/guests/:id', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getGuestProfile);
router.put('/crm/guests/:id', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.updateGuestProfile);

// Email Campaign Routes
router.post('/campaigns', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.createEmailCampaign);
router.get('/campaigns', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getEmailCampaigns);
router.put('/campaigns/:id', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.updateEmailCampaign);
router.post('/campaigns/:campaignId/send', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.sendEmailCampaign);
router.get('/campaigns/:id/analytics', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getCampaignAnalytics);

// Loyalty Program Routes
router.post('/loyalty-programs', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.createLoyaltyProgram);
router.get('/loyalty-programs', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, bookingEngineController.getLoyaltyPrograms);
router.post('/loyalty/points', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, bookingEngineController.processLoyaltyPoints);

// Landing Page Routes
router.post('/landing-pages', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.createLandingPage);
router.get('/landing-pages', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getLandingPages);
router.get('/packages', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'readAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getBookingPackages);
router.get('/landing-pages/:id/analytics', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getLandingPageAnalytics);

// Review Management Routes
router.post('/reviews', validate(mutationBaselineSchema), bookingEngineController.createReview);
router.get('/reviews', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getReviews);
router.post('/reviews/:id/respond', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.respondToReview);
router.put('/reviews/:id/moderate', validate(mutationBaselineSchema), authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager']), bookingEngineController.moderateReview);

// Dashboard and Analytics Routes
router.get('/dashboard', authenticate, ensureTenantContext, authorizePolicy('bookingEngine', 'baseAccess'), ensurePropertyAccess, authorize(['admin', 'marketing_manager', 'manager', 'frontdesk']), bookingEngineController.getMarketingDashboard);

export default router;
