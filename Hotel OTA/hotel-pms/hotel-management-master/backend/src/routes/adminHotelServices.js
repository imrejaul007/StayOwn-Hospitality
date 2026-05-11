import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  deleteServiceImage,
  bulkOperations,
  uploadImages,
  getServiceStaff,
  assignStaffToService,
  removeStaffFromService,
  getAvailableStaff,
  getFulfillmentQueue,
  assignBookingStaff,
  updateBookingStatus,
  getServiceAnalyticsSummary,
  exportServiceAnalyticsCsv
} from '../controllers/adminHotelServicesController.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const objectId = Joi.string().hex().length(24);
const serviceTypes = ['dining', 'spa', 'gym', 'transport', 'entertainment', 'business', 'wellness', 'recreation'];
const createOrUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().min(3).max(5000),
  type: Joi.string().valid(...serviceTypes),
  price: Joi.number().min(0),
  currency: Joi.string().trim().length(3),
  duration: Joi.number().integer().min(1).max(1440),
  capacity: Joi.number().integer().min(1).max(1000),
  location: Joi.string().trim().max(200),
  specialInstructions: Joi.string().trim().allow('').max(2000),
  amenities: Joi.alternatives().try(Joi.array().items(Joi.string().trim().max(80)), Joi.string().allow('')),
  tags: Joi.alternatives().try(Joi.array().items(Joi.string().trim().max(80)), Joi.string().allow('')),
  featured: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')),
  featuredPriority: Joi.number().integer().min(0).max(1000),
  featuredFrom: Joi.date().iso(),
  featuredUntil: Joi.date().iso(),
  isActive: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')),
  operatingHoursOpen: Joi.string().trim().max(16),
  operatingHoursClose: Joi.string().trim().max(16),
  contactPhone: Joi.string().trim().max(30).allow(''),
  contactEmail: Joi.string().email().allow(''),
  hotelId: objectId.optional()
}).unknown(true);
const bulkOperationsSchema = Joi.object({
  operation: Joi.string().valid('activate', 'deactivate', 'feature', 'unfeature', 'delete').required(),
  serviceIds: Joi.array().items(objectId.required()).min(1).max(1000).required()
});
const staffAssignmentSchema = Joi.object({
  staffId: objectId.required(),
  role: Joi.string().valid('manager', 'supervisor', 'attendant', 'specialist').default('attendant'),
  primaryContact: Joi.boolean().default(false)
});
const bookingStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'completed', 'cancelled').required(),
  reason: Joi.string().trim().allow('').max(200).optional()
});
const assignBookingStaffSchema = Joi.object({
  staffId: objectId.required()
});

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(authorizePolicy('adminHotelServices', 'baseAccess'));
router.use(ensurePropertyAccess);

/**
 * @swagger
 * tags:
 *   name: Admin - Hotel Services
 *   description: Admin management of hotel services and experiences
 */

// Bulk operations
router.post('/bulk-operations', validate(bulkOperationsSchema), bulkOperations);

// Staff management
router.get('/available-staff', getAvailableStaff);
router.get('/bookings/queue', getFulfillmentQueue);
router.patch('/bookings/:bookingId/assign-staff', validate(assignBookingStaffSchema), assignBookingStaff);
router.patch('/bookings/:bookingId/status', validate(bookingStatusSchema), updateBookingStatus);
router.get('/analytics/summary', getServiceAnalyticsSummary);
router.get('/analytics/export.csv', exportServiceAnalyticsCsv);

// CRUD operations
router.route('/')
  .get(getAllServices)
  .post(validate(createOrUpdateSchema), uploadImages, createService);

router.route('/:id')
  .get(getServiceById)
  .put(validate(createOrUpdateSchema), uploadImages, updateService)
  .delete(deleteService);

// Service status toggle
router.patch('/:id/toggle-status', toggleServiceStatus);

// Staff assignment routes
router.route('/:id/staff')
  .get(getServiceStaff)
  .post(validate(staffAssignmentSchema), assignStaffToService);

router.delete('/:id/staff/:staffId', removeStaffFromService);

// Image management
router.delete('/:id/images/:imageIndex', deleteServiceImage);

export default router;
