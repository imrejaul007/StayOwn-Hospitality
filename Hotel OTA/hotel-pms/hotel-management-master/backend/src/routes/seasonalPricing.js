import express from 'express';
import seasonalPricingController from '../controllers/seasonalPricingController.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import adminAuth from '../middleware/adminAuth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

const seasonCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(1000).allow(''),
  type: Joi.string().valid('peak', 'high', 'shoulder', 'low', 'off', 'custom').required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  isRecurring: Joi.boolean(),
  recurringPattern: Joi.object({
    type: Joi.string().valid('yearly', 'monthly', 'weekly'),
    interval: Joi.number().integer().min(1)
  }),
  rateAdjustments: Joi.array().items(Joi.object({
    roomType: Joi.string().valid('single', 'double', 'suite', 'deluxe', 'all'),
    adjustmentType: Joi.string().valid('percentage', 'fixed', 'absolute'),
    adjustmentValue: Joi.number().required(),
    currency: Joi.string().max(3)
  })),
  priority: Joi.number().integer().min(0),
  tags: Joi.array().items(Joi.string().max(50)),
  color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
}).options({ stripUnknown: true });

const seasonUpdateSchema = seasonCreateSchema.fork(
  ['name', 'type', 'startDate', 'endDate'],
  (schema) => schema.optional()
);

const specialPeriodCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(1000).allow(''),
  type: Joi.string().valid(
    'holiday', 'festival', 'event', 'conference',
    'wedding_season', 'sports_event', 'blackout',
    'maintenance', 'custom'
  ).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  isRecurring: Joi.boolean(),
  recurringPattern: Joi.object({
    type: Joi.string().valid('yearly', 'monthly', 'weekly'),
    interval: Joi.number().integer().min(1),
    endRecurrence: Joi.date().iso()
  }),
  rateOverrides: Joi.array().items(Joi.object({
    roomType: Joi.string().valid('single', 'double', 'suite', 'deluxe', 'all'),
    overrideType: Joi.string().valid('percentage', 'fixed', 'absolute', 'block'),
    overrideValue: Joi.number().required(),
    currency: Joi.string().max(3)
  })),
  restrictions: Joi.object({
    bookingRestriction: Joi.string().valid('none', 'closed_to_arrival', 'closed_to_departure', 'closed_to_both', 'blocked'),
    minLength: Joi.number().integer().min(1),
    maxLength: Joi.number().integer().min(1),
    mustStayThrough: Joi.boolean()
  }),
  eventDetails: Joi.object({
    eventName: Joi.string().max(200),
    venue: Joi.string().max(200),
    organizer: Joi.string().max(200),
    expectedAttendees: Joi.number().integer().min(0),
    impactRadius: Joi.number().min(0)
  }),
  demand: Joi.object({
    level: Joi.string().valid('very_low', 'low', 'normal', 'high', 'very_high', 'extreme'),
    expectedOccupancy: Joi.number().min(0).max(100),
    competitorImpact: Joi.string().valid('none', 'low', 'medium', 'high')
  }),
  priority: Joi.number().integer().min(0).max(1000),
  tags: Joi.array().items(Joi.string().max(50)),
  color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  alerts: Joi.object({
    emailNotification: Joi.boolean(),
    daysBeforeAlert: Joi.number().integer().min(1),
    recipients: Joi.array().items(Joi.string().email())
  })
}).options({ stripUnknown: true });

const specialPeriodUpdateSchema = specialPeriodCreateSchema.fork(
  ['name', 'type', 'startDate', 'endDate'],
  (schema) => schema.optional()
);

const deleteSchema = Joi.object({}).options({ stripUnknown: true });

// All routes require authentication and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('seasonalPricing', 'baseAccess'));

// Get seasonal adjustment for a specific date and room type
router.get('/adjustment', seasonalPricingController.getSeasonalAdjustment);

// Check booking availability for date range
router.get('/availability', seasonalPricingController.checkBookingAvailability);

// Get pricing calendar for a date range
router.get('/calendar', seasonalPricingController.getPricingCalendar);

// Get seasons by date range
router.get('/seasons/date-range', seasonalPricingController.getSeasonsByDateRange);

// Get special periods by date range
router.get('/special-periods/date-range', seasonalPricingController.getSpecialPeriodsByDateRange);

// Get seasonal analytics
router.get('/analytics', seasonalPricingController.getSeasonalAnalytics);

// Admin-only routes
router.use(adminAuth);

// Season management routes
router.post('/seasons', validate(seasonCreateSchema), seasonalPricingController.createSeason);
router.get('/seasons', seasonalPricingController.getSeasons);
router.get('/seasons/:id', seasonalPricingController.getSeasonById);
router.put('/seasons/:id', validate(seasonUpdateSchema), seasonalPricingController.updateSeason);
router.delete('/seasons/:id', validate(deleteSchema), seasonalPricingController.deleteSeason);

// Special period management routes
router.post('/special-periods', validate(specialPeriodCreateSchema), seasonalPricingController.createSpecialPeriod);
router.get('/special-periods', seasonalPricingController.getSpecialPeriods);
router.get('/special-periods/:id', seasonalPricingController.getSpecialPeriodById);
router.put('/special-periods/:id', validate(specialPeriodUpdateSchema), seasonalPricingController.updateSpecialPeriod);
router.delete('/special-periods/:id', validate(deleteSchema), seasonalPricingController.deleteSpecialPeriod);

// Bulk operations
router.post('/special-periods/bulk', validate(Joi.object({
  periods: Joi.array().items(specialPeriodCreateSchema).min(1).max(50).required()
}).options({ stripUnknown: true })), seasonalPricingController.bulkCreateSpecialPeriods);

// Alert management
router.get('/alerts/upcoming', seasonalPricingController.getUpcomingAlerts);

export default router;