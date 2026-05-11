import express from 'express';
import assignmentRulesController from '../controllers/assignmentRulesController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Protect all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /assignment-rules/stats:
 *   get:
 *     summary: Get assignment rules statistics
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assignment rules statistics retrieved successfully
 */
router.get('/stats', 
  authorizePolicy('assignmentRules', 'staffAccess'), 
  catchAsync(assignmentRulesController.getAssignmentRulesStats)
);

/**
 * @swagger
 * /assignment-rules:
 *   get:
 *     summary: Get all assignment rules
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *         description: Filter by priority
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: priority
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Assignment rules retrieved successfully
 */
router.get('/', 
  authorizePolicy('assignmentRules', 'staffAccess'), 
  catchAsync(assignmentRulesController.getAssignmentRules)
);

/**
 * @swagger
 * /assignment-rules:
 *   post:
 *     summary: Create a new assignment rule
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ruleName
 *             properties:
 *               ruleName:
 *                 type: string
 *               priority:
 *                 type: integer
 *                 default: 1
 *               conditions:
 *                 type: object
 *               actions:
 *                 type: object
 *               restrictions:
 *                 type: object
 *     responses:
 *       201:
 *         description: Assignment rule created successfully
 */
router.post('/', 
  authorizePolicy('assignmentRules', 'staffAccess'),
  validate(mutationBaselineSchema),
  catchAsync(assignmentRulesController.createAssignmentRule)
);

/**
 * @swagger
 * /assignment-rules/{id}:
 *   get:
 *     summary: Get assignment rule by ID
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assignment rule ID
 *     responses:
 *       200:
 *         description: Assignment rule retrieved successfully
 *       404:
 *         description: Assignment rule not found
 */
router.get('/:id', 
  authorizePolicy('assignmentRules', 'staffAccess'), 
  catchAsync(assignmentRulesController.getAssignmentRule)
);

/**
 * @swagger
 * /assignment-rules/{id}:
 *   put:
 *     summary: Update assignment rule
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assignment rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ruleName:
 *                 type: string
 *               priority:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               conditions:
 *                 type: object
 *               actions:
 *                 type: object
 *               restrictions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Assignment rule updated successfully
 *       404:
 *         description: Assignment rule not found
 */
router.put('/:id', 
  authorizePolicy('assignmentRules', 'staffAccess'),
  validate(mutationBaselineSchema),
  catchAsync(assignmentRulesController.updateAssignmentRule)
);

/**
 * @swagger
 * /assignment-rules/{id}:
 *   delete:
 *     summary: Delete assignment rule
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assignment rule ID
 *     responses:
 *       200:
 *         description: Assignment rule deleted successfully
 *       404:
 *         description: Assignment rule not found
 */
router.delete('/:id', 
  authorizePolicy('assignmentRules', 'adminAccess'),
  validate(mutationBaselineSchema),
  catchAsync(assignmentRulesController.deleteAssignmentRule)
);

/**
 * @swagger
 * /assignment-rules/{id}/test:
 *   post:
 *     summary: Test assignment rule against criteria
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assignment rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               testCriteria:
 *                 type: object
 *                 properties:
 *                   guestType:
 *                     type: string
 *                   roomType:
 *                     type: string
 *                   lengthOfStay:
 *                     type: integer
 *     responses:
 *       200:
 *         description: Rule test completed successfully
 *       404:
 *         description: Assignment rule not found
 */
router.post('/:id/test',
  authorizePolicy('assignmentRules', 'staffAccess'),
  validate(mutationBaselineSchema),
  catchAsync(assignmentRulesController.testAssignmentRule)
);

/**
 * @swagger
 * /assignment-rules/auto-assign:
 *   post:
 *     summary: Auto-assign rooms based on assignment rules
 *     tags: [Assignment Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               criteria:
 *                 type: object
 *                 properties:
 *                   guestType:
 *                     type: string
 *                   roomType:
 *                     type: string
 *                   priority:
 *                     type: string
 *                     enum: [low, medium, high, vip]
 *                   maxBookings:
 *                     type: integer
 *                     default: 50
 *     responses:
 *       200:
 *         description: Auto-assignment completed successfully
 *       400:
 *         description: Invalid criteria provided
 */
router.post('/auto-assign',
  authorizePolicy('assignmentRules', 'staffAccess'),
  validate(mutationBaselineSchema),
  catchAsync(assignmentRulesController.autoAssignRooms)
);

export default router;