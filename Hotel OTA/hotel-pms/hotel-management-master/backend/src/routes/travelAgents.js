import express from 'express';
import {
  registerTravelAgent,
  getAllTravelAgents,
  getTravelAgentById,
  updateTravelAgent,
  updateTravelAgentStatus,
  getTravelAgentPerformance,
  getMyTravelAgentProfile,
  getMyBookings,
  validateAgentCode,
  exportBookings,
  generateCommissionReport,
  createBatchExport,
  getBookingTrends,
  getRevenueForecast,
  getPerformanceMetrics,
  downloadFile
} from '../controllers/travelAgentController.js';
import {
  createMultiBooking,
  getMultiBookingById,
  updateMultiBookingStatus,
  calculateBulkPricing,
  rollbackFailedBookings,
  getAgentMultiBookings,
  getMultiBookingAnalytics
} from '../controllers/multiBookingController.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate, schemas } from '../middleware/validation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Validation schemas
const registerTravelAgentSchema = Joi.object({
  userId: Joi.string().required(),
  agentCode: Joi.string().min(3).max(10).uppercase(),
  companyName: Joi.string().required().min(2).max(200),
  contactPerson: Joi.string().required().min(2).max(100),
  phone: Joi.string().required().pattern(/^\+?[\d\s-()]+$/),
  email: Joi.string().email().required(),
  address: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    country: Joi.string(),
    zipCode: Joi.string()
  }),
  businessDetails: Joi.object({
    licenseNumber: Joi.string(),
    gstNumber: Joi.string(),
    establishedYear: Joi.number().min(1900).max(new Date().getFullYear()),
    businessType: Joi.string().valid('domestic', 'international', 'both')
  }),
  commissionStructure: Joi.object({
    defaultRate: Joi.number().min(0).max(50),
    roomTypeRates: Joi.array().items(Joi.object({
      roomTypeId: Joi.string(),
      commissionRate: Joi.number().min(0).max(50)
    })),
    seasonalRates: Joi.array().items(Joi.object({
      season: Joi.string().valid('peak', 'high', 'low', 'off'),
      commissionRate: Joi.number().min(0).max(50),
      validFrom: Joi.date(),
      validTo: Joi.date()
    }))
  }),
  bookingLimits: Joi.object({
    maxBookingsPerDay: Joi.number().min(1),
    maxRoomsPerBooking: Joi.number().min(1),
    maxAdvanceBookingDays: Joi.number().min(1)
  }),
  paymentTerms: Joi.object({
    creditLimit: Joi.number().min(0),
    paymentDueDays: Joi.number().min(1),
    preferredPaymentMethod: Joi.string().valid('bank_transfer', 'cheque', 'online', 'cash')
  }),
  hotelId: Joi.string()
});

const updateTravelAgentSchema = Joi.object({
  companyName: Joi.string().min(2).max(200),
  contactPerson: Joi.string().min(2).max(100),
  phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
  email: Joi.string().email(),
  address: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    country: Joi.string(),
    zipCode: Joi.string()
  }),
  businessDetails: Joi.object({
    licenseNumber: Joi.string(),
    gstNumber: Joi.string(),
    establishedYear: Joi.number().min(1900).max(new Date().getFullYear()),
    businessType: Joi.string().valid('domestic', 'international', 'both')
  }),
  commissionStructure: Joi.object({
    defaultRate: Joi.number().min(0).max(50),
    roomTypeRates: Joi.array().items(Joi.object({
      roomTypeId: Joi.string(),
      commissionRate: Joi.number().min(0).max(50)
    })),
    seasonalRates: Joi.array().items(Joi.object({
      season: Joi.string().valid('peak', 'high', 'low', 'off'),
      commissionRate: Joi.number().min(0).max(50),
      validFrom: Joi.date(),
      validTo: Joi.date()
    }))
  }),
  bookingLimits: Joi.object({
    maxBookingsPerDay: Joi.number().min(1),
    maxRoomsPerBooking: Joi.number().min(1),
    maxAdvanceBookingDays: Joi.number().min(1)
  }),
  paymentTerms: Joi.object({
    creditLimit: Joi.number().min(0),
    paymentDueDays: Joi.number().min(1),
    preferredPaymentMethod: Joi.string().valid('bank_transfer', 'cheque', 'online', 'cash')
  }),
  notes: Joi.string().max(1000)
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended', 'pending_approval').required(),
  reason: Joi.string().max(500)
});

// Public route for agent code validation (no auth required)
router.get('/validate-code/:code', validateAgentCode);

// Apply authentication to all other routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Travel agent specific routes
router.get('/me', getMyTravelAgentProfile);
router.get('/me/bookings', getMyBookings);

// Admin/Staff routes for managing travel agents
router.post('/',
  authorizePolicy('travelAgents', 'manageAccess'),
  validate(registerTravelAgentSchema),
  registerTravelAgent
);

router.get('/',
  authorizePolicy('travelAgents', 'opsAccess'),
  getAllTravelAgents
);

router.get('/:id',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  getTravelAgentById
);

router.put('/:id',
  authorizePolicy('travelAgents', 'agentManageAccess'),
  validate(updateTravelAgentSchema),
  updateTravelAgent
);

router.patch('/:id/status',
  authorizePolicy('travelAgents', 'manageAccess'),
  validate(updateStatusSchema),
  updateTravelAgentStatus
);

router.get('/:id/performance',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  getTravelAgentPerformance
);

// Multi-booking routes
router.post('/multi-booking',
  authorizePolicy('travelAgents', 'agentManageAccess'),
  (req, res, next) => {
    // Custom validation for multi-booking
    const { error } = schemas.createMultiBooking.validate(req.body);
    
    if (error) {
      // For travel agents, don't require travelAgentId in request body
      if (req.user.role === 'travel_agent') {
        const filteredErrors = error.details.filter(detail => 
          !detail.path.includes('travelAgentId')
        );
        if (filteredErrors.length > 0) {
          const message = filteredErrors.map(detail => detail.message).join(', ');
          return next(new ApplicationError(message, 400));
        }
      } else {
        // For admin/manager, require travelAgentId
        const message = error.details.map(detail => detail.message).join(', ');
        return next(new ApplicationError(message, 400));
      }
    }
    
    next();
  },
  createMultiBooking
);

router.get('/multi-booking',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  getAgentMultiBookings
);

router.get('/multi-booking/analytics',
  authorizePolicy('travelAgents', 'opsAccess'),
  getMultiBookingAnalytics
);

router.post('/multi-booking/calculate-pricing',
  authorizePolicy('travelAgents', 'frontdeskAgentAccess'),
  (req, res, next) => {
    // Custom validation for bulk pricing calculation
    const { error } = schemas.calculateBulkPricing.validate(req.body);

    if (error) {
      // For travel agents, don't require travelAgentId in request body
      if (req.user.role === 'travel_agent') {
        const filteredErrors = error.details.filter(detail =>
          !detail.path.includes('travelAgentId')
        );
        if (filteredErrors.length > 0) {
          const message = filteredErrors.map(detail => detail.message).join(', ');
          return next(new ApplicationError(message, 400));
        }
      } else {
        // For admin/manager, require travelAgentId
        const message = error.details.map(detail => detail.message).join(', ');
        return next(new ApplicationError(message, 400));
      }
    }

    next();
  },
  calculateBulkPricing
);

router.get('/multi-booking/:id',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  getMultiBookingById
);

router.patch('/multi-booking/:id/status',
  authorizePolicy('travelAgents', 'manageAccess'),
  validate(schemas.updateMultiBookingStatus),
  updateMultiBookingStatus
);

router.post('/multi-booking/:id/rollback',
  authorizePolicy('travelAgents', 'manageAccess'),
  validate(schemas.rollbackMultiBooking),
  rollbackFailedBookings
);

// Export routes
router.post('/export/bookings',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  validate(mutationBaselineSchema),
  exportBookings
);

router.post('/export/commission-report',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  validate(mutationBaselineSchema),
  generateCommissionReport
);

router.post('/export/batch',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  validate(mutationBaselineSchema),
  createBatchExport
);

// Analytics routes
router.get('/analytics/trends',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  getBookingTrends
);

router.get('/analytics/forecast',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  getRevenueForecast
);

router.get('/analytics/performance',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  getPerformanceMetrics
);

// Download route
router.get('/download/:filename',
  authorizePolicy('travelAgents', 'allAgentAccess'),
  downloadFile
);

export default router;