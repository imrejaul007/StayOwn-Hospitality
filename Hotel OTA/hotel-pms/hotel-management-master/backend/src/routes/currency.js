import express from 'express';
import currencyController from '../controllers/currencyController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Validation schemas
const createCurrencyValidation = [
  body('code')
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency code must be exactly 3 characters')
    .isAlpha()
    .withMessage('Currency code must contain only letters')
    .toUpperCase(),
  body('name')
    .notEmpty()
    .withMessage('Currency name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Currency name must be between 2 and 100 characters'),
  body('symbol')
    .notEmpty()
    .withMessage('Currency symbol is required')
    .isLength({ min: 1, max: 5 })
    .withMessage('Currency symbol must be between 1 and 5 characters'),
  body('exchangeRate')
    .optional()
    .isFloat({ min: 0.000001 })
    .withMessage('Exchange rate must be a positive number'),
  body('decimalPlaces')
    .optional()
    .isInt({ min: 0, max: 8 })
    .withMessage('Decimal places must be between 0 and 8'),
  body('isBaseCurrency')
    .optional()
    .isBoolean()
    .withMessage('isBaseCurrency must be a boolean'),
  validate
];

const updateCurrencyValidation = [
  param('code')
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency code must be exactly 3 characters')
    .isAlpha()
    .withMessage('Currency code must contain only letters')
    .toUpperCase(),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Currency name must be between 2 and 100 characters'),
  body('symbol')
    .optional()
    .isLength({ min: 1, max: 5 })
    .withMessage('Currency symbol must be between 1 and 5 characters'),
  body('exchangeRate')
    .optional()
    .isFloat({ min: 0.000001 })
    .withMessage('Exchange rate must be a positive number'),
  body('decimalPlaces')
    .optional()
    .isInt({ min: 0, max: 8 })
    .withMessage('Decimal places must be between 0 and 8'),
  validate
];

const currencyParamValidation = [
  param('code')
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency code must be exactly 3 characters')
    .isAlpha()
    .withMessage('Currency code must contain only letters')
    .toUpperCase(),
  validate
];

const conversionValidation = [
  query('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  query('from')
    .isLength({ min: 3, max: 3 })
    .withMessage('From currency must be exactly 3 characters')
    .isAlpha()
    .withMessage('From currency must contain only letters')
    .toUpperCase(),
  query('to')
    .isLength({ min: 3, max: 3 })
    .withMessage('To currency must be exactly 3 characters')
    .isAlpha()
    .withMessage('To currency must contain only letters')
    .toUpperCase(),
  validate
];

const exchangeRateParamValidation = [
  param('from')
    .isLength({ min: 3, max: 3 })
    .withMessage('From currency must be exactly 3 characters')
    .isAlpha()
    .withMessage('From currency must contain only letters')
    .toUpperCase(),
  param('to')
    .isLength({ min: 3, max: 3 })
    .withMessage('To currency must be exactly 3 characters')
    .isAlpha()
    .withMessage('To currency must contain only letters')
    .toUpperCase(),
  validate
];

// Public routes (no authentication required)
router.get('/', currencyController.getCurrencies);
router.get('/active', currencyController.getCurrencies);
router.get('/convert', conversionValidation, currencyController.convertCurrency);
router.get('/rate/:from/:to', exchangeRateParamValidation, currencyController.getExchangeRate);
router.get('/conversion-rates', currencyController.getConversionRates);
router.get('/format', currencyController.formatAmount);
router.get('/stats', currencyController.getCurrencyStats);
router.get('/channel/:channel', currencyController.getChannelCurrencies);

// Currency details (public)
router.get('/:code', currencyParamValidation, currencyController.getCurrency);

// Protected routes (authentication required)
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Currency management (admin only)
router.post('/', 
  authorizePolicy('currency', 'manageAccess'),
  validate(mutationBaselineSchema),
  createCurrencyValidation, 
  currencyController.createCurrency
);

router.put('/:code', 
  authorizePolicy('currency', 'manageAccess'),
  validate(mutationBaselineSchema),
  updateCurrencyValidation, 
  currencyController.updateCurrency
);

router.delete('/:code', 
  authorizePolicy('currency', 'adminAccess'),
  validate(mutationBaselineSchema),
  currencyParamValidation, 
  currencyController.deleteCurrency
);

// Exchange rate management
router.post('/rates/update', 
  authorizePolicy('currency', 'manageAccess'),
  validate(mutationBaselineSchema),
  currencyController.updateExchangeRates
);

router.get('/providers/status', 
  authorizePolicy('currency', 'manageAccess'), 
  currencyController.getProviderStatus
);

// Channel support management
router.post('/:code/channels', 
  authorizePolicy('currency', 'manageAccess'),
  validate(mutationBaselineSchema),
  [
    ...currencyParamValidation,
    body('channel')
      .notEmpty()
      .withMessage('Channel is required')
      .isIn(['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'trivago'])
      .withMessage('Invalid channel'),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean'),
    validate
  ],
  currencyController.addChannelSupport
);

// Batch operations
router.post('/batch/convert', 
  authorizePolicy('currency', 'batchAccess'),
  validate(mutationBaselineSchema),
  [
    body('conversions')
      .isArray({ min: 1 })
      .withMessage('Conversions must be a non-empty array'),
    body('conversions.*.amount')
      .isFloat({ min: 0 })
      .withMessage('Each conversion amount must be a positive number'),
    body('conversions.*.fromCurrency')
      .isLength({ min: 3, max: 3 })
      .withMessage('Each conversion fromCurrency must be exactly 3 characters')
      .toUpperCase(),
    body('targetCurrency')
      .isLength({ min: 3, max: 3 })
      .withMessage('Target currency must be exactly 3 characters')
      .isAlpha()
      .withMessage('Target currency must contain only letters')
      .toUpperCase(),
    validate
  ],
  currencyController.batchConvert
);

export default router;
