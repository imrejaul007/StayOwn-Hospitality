import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import * as guestImportController from '../controllers/guestImportController.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Admin/Staff routes only
router.use(authorizePolicy('guestImport', 'staffAccess'));

// File upload route
router.post('/upload', 
  validate(mutationBaselineSchema),
  guestImportController.upload.single('file'),
  guestImportController.uploadFile
);

// Import guests
router.post('/import', validate(mutationBaselineSchema), guestImportController.importGuests);

// Validate guest data
router.post('/validate', validate(mutationBaselineSchema), guestImportController.validateGuestData);

// Get import template
router.get('/template', guestImportController.getImportTemplate);

// Download template
router.get('/template/download', guestImportController.downloadTemplate);

// Get import statistics
router.get('/statistics', guestImportController.getImportStatistics);

// Get supported formats
router.get('/formats', guestImportController.getSupportedFormats);

export default router;
