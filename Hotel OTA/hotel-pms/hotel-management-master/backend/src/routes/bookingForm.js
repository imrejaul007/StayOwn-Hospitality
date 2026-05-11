import express from 'express';
import Joi from 'joi';
import { body, param, query } from 'express-validator';
import bookingFormController from '../controllers/bookingFormController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

const router = express.Router();
const adminRouter = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Rate limiting for form submissions
const formSubmissionLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 form submissions per windowMs
  message: {
    success: false,
    error: 'Too many form submissions from this IP, please try again later.'
  }
});

// Rate limiting for form rendering
const formRenderLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 form renders per minute
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

// Validation schemas
const createTemplateValidation = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name must be less than 100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('category')
    .isIn(['booking', 'inquiry', 'registration', 'survey', 'custom'])
    .withMessage('Invalid category'),
  
  body('fields')
    .isArray()
    .withMessage('Fields must be an array')
    .notEmpty()
    .withMessage('At least one field is required'),
  
  body('fields.*.id')
    .notEmpty()
    .withMessage('Field ID is required'),
  
  body('fields.*.type')
    .isIn([
      'text', 'email', 'tel', 'phone', 'number', 'date', 'time', 'datetime',
      'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'file', 'hidden',
      'password', 'url', 'color', 'range', 'section', 'divider', 'heading', 'html'
    ])
    .withMessage('Invalid field type'),
  
  body('fields.*.label')
    .optional()
    .custom((value, { req, path }) => {
      // Extract the field index from the path (e.g., 'fields[0].label' → 0)
      const match = path.match(/fields\[(\d+)\]/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const fieldType = req.body.fields?.[idx]?.type;
        // Divider, html, and hidden fields don't require labels
        if (['divider', 'html', 'hidden'].includes(fieldType)) return true;
      }
      if (!value || !value.trim()) throw new Error('Field label is required');
      return true;
    }),
  
  body('styling.theme.colors.primary')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Primary color must be a valid hex color'),

  body('styling.theme.colors.secondary')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Secondary color must be a valid hex color'),
  
  body('settings.submitUrl')
    .optional()
    .isURL()
    .withMessage('Submit URL must be a valid URL'),
  
  body('status')
    .optional()
    .isIn(['draft', 'active', 'published', 'archived'])
    .withMessage('Invalid status')
];

const updateTemplateValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),

  body('name')
    .optional()
    .notEmpty()
    .withMessage('Template name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Template name must be less than 100 characters'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),

  body('category')
    .optional()
    .isIn(['booking', 'inquiry', 'registration', 'survey', 'custom'])
    .withMessage('Invalid category'),

  body('fields')
    .optional()
    .isArray()
    .withMessage('Fields must be an array'),

  body('fields.*.id')
    .optional()
    .notEmpty()
    .withMessage('Field ID is required'),

  body('fields.*.type')
    .optional()
    .isIn([
      'text', 'email', 'tel', 'phone', 'number', 'date', 'time', 'datetime',
      'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'file', 'hidden',
      'password', 'url', 'color', 'range', 'section', 'divider', 'heading', 'html'
    ])
    .withMessage('Invalid field type'),

  body('fields.*.label')
    .optional()
    .notEmpty()
    .withMessage('Field label is required'),

  body('status')
    .optional()
    .isIn(['draft', 'active', 'published', 'archived'])
    .withMessage('Invalid status')
];

const templateIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['all', 'draft', 'active', 'published', 'archived'])
    .withMessage('Invalid status filter'),
  
  query('category')
    .optional()
    .isIn(['all', 'booking', 'inquiry', 'registration', 'survey', 'custom'])
    .withMessage('Invalid category filter'),
  
  query('sortBy')
    .optional()
    .isIn(['name', 'createdAt', 'updatedAt', 'status', 'category'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

const duplicateValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),
  
  body('name')
    .notEmpty()
    .withMessage('New template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name must be less than 100 characters')
];

const formSubmissionValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),
  
  body()
    .isObject()
    .withMessage('Form data must be an object')
];

const analyticsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  query('groupBy')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Group by must be hour, day, week, or month')
];

const exportValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),
  
  query('format')
    .optional()
    .isIn(['json', 'csv', 'xml'])
    .withMessage('Format must be json, csv, or xml')
];

const importValidation = [
  body('data')
    .notEmpty()
    .withMessage('Template data is required'),
  
  body('overwrite')
    .optional()
    .isBoolean()
    .withMessage('Overwrite must be a boolean')
];

const abTestValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),
  
  body('variantId')
    .notEmpty()
    .withMessage('Variant ID is required'),
  
  body('action')
    .isIn(['view', 'submit', 'abandon'])
    .withMessage('Action must be view, submit, or abandon')
];

// =============================================
// PUBLIC routes — no authentication required
// MUST be mounted BEFORE the admin auth middleware
// =============================================
const publicRouter = express.Router();

// Form rendering - with rate limiting
publicRouter.get('/forms/:id/render',
  formRenderLimit,
  templateIdValidation,
  [
    query('preview')
      .optional()
      .isBoolean()
      .withMessage('Preview must be a boolean')
  ],
  bookingFormController.renderForm
);

// Form submission - with rate limiting and validation
publicRouter.post('/forms/:id/submit',
  formSubmissionLimit,
  validate(mutationBaselineSchema),
  formSubmissionValidation,
  bookingFormController.submitForm
);

// Form validation - for real-time validation
publicRouter.post('/forms/:id/validate',
  formRenderLimit,
  validate(mutationBaselineSchema),
  formSubmissionValidation,
  bookingFormController.validateForm
);

router.use('/public', publicRouter);

// =============================================
// ADMIN routes — require authentication + admin role
// =============================================
adminRouter.use(authenticate, ensureTenantContext, ensurePropertyAccess, authorizePolicy('bookingForm', 'adminAccess'));

// Template CRUD operations
adminRouter.post('/templates', validate(mutationBaselineSchema), createTemplateValidation, bookingFormController.createTemplate);
adminRouter.get('/templates', paginationValidation, bookingFormController.getTemplates);
adminRouter.get('/templates/:id', templateIdValidation, bookingFormController.getTemplate);
adminRouter.put('/templates/:id', validate(mutationBaselineSchema), updateTemplateValidation, bookingFormController.updateTemplate);
adminRouter.delete('/templates/:id', validate(mutationBaselineSchema), templateIdValidation, bookingFormController.deleteTemplate);

// Template operations
adminRouter.post('/templates/:id/duplicate', validate(mutationBaselineSchema), duplicateValidation, bookingFormController.duplicateTemplate);
adminRouter.get('/templates/:id/export', exportValidation, bookingFormController.exportTemplate);
adminRouter.post('/templates/import', validate(mutationBaselineSchema), importValidation, bookingFormController.importTemplate);

// Analytics and A/B testing
adminRouter.get('/templates/:id/analytics', analyticsValidation, bookingFormController.getAnalytics);
adminRouter.post('/templates/:id/ab-test', validate(mutationBaselineSchema), abTestValidation, bookingFormController.testABVariant);

router.use('/', adminRouter);

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('Booking form route error', { error: error.message });
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }))
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Template name already exists'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

export default router;
