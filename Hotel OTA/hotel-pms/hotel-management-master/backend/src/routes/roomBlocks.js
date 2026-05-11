import express from 'express';
import Joi from 'joi';
import roomBlockController from '../controllers/roomBlockController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { body } from 'express-validator';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Validation middleware
const validateRoomBlock = [
  body('blockName')
    .notEmpty()
    .withMessage('Block name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Block name must be between 3 and 100 characters'),
  body('groupName')
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Group name must be between 3 and 100 characters'),
  body('hotelId')
    .notEmpty()
    .withMessage('Hotel ID is required')
    .isMongoId()
    .withMessage('Invalid hotel ID'),
  body('eventType')
    .isIn(['conference', 'wedding', 'corporate_event', 'group_booking', 'convention', 'other'])
    .withMessage('Invalid event type'),
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('roomIds')
    .isArray({ min: 1 })
    .withMessage('At least one room is required'),
  body('billingInstructions')
    .notEmpty()
    .withMessage('Billing instructions are required'),
  body('contactPerson.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
];

// Routes
router.post('/',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  validate(mutationBaselineSchema),
  validateRoomBlock,
  roomBlockController.createRoomBlock
);

router.get('/',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  roomBlockController.getRoomBlocks
);

router.get('/stats',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  roomBlockController.getRoomBlockStats
);

router.get('/:id',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  roomBlockController.getRoomBlock
);

router.put('/:id',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  validate(mutationBaselineSchema),
  roomBlockController.updateRoomBlock
);

router.post('/:id/rooms/:roomId/release',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  validate(mutationBaselineSchema),
  roomBlockController.releaseRoom
);

router.post('/:id/rooms/:roomId/book',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  validate(mutationBaselineSchema),
  roomBlockController.bookRoom
);

router.post('/:id/notes',
  authenticate, ensureTenantContext,
  ensurePropertyAccess,
  authorizePolicy('roomBlocks', 'adminStaffAccess'),
  validate(mutationBaselineSchema),
  roomBlockController.addNote
);

export default router;