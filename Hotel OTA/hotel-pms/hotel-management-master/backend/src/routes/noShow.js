import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { validate } from '../middleware/validation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import {
  markAsNoShow,
  getNoShowStats,
  reverseNoShow
} from '../controllers/noShowController.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication and property access to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * tags:
 *   name: No-Show Management
 *   description: Booking no-show management endpoints
 */

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/no-show:
 *   post:
 *     summary: Mark booking as no-show
 *     tags: [No-Show Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for marking as no-show
 *               chargeAmount:
 *                 type: number
 *                 minimum: 0
 *                 description: No-show penalty charge amount
 *             example:
 *               reason: "Guest did not arrive and did not contact hotel"
 *               chargeAmount: 100
 *     responses:
 *       200:
 *         description: Booking successfully marked as no-show
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     booking:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         bookingNumber:
 *                           type: string
 *                         status:
 *                           type: string
 *                         noShowRecorded:
 *                           type: string
 *                           format: date-time
 *                         noShowReason:
 *                           type: string
 *                         noShowChargeAmount:
 *                           type: number
 *                         noShowMarkedBy:
 *                           type: object
 *       400:
 *         description: Bad request or validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/no-show', authorizePolicy('noShow', 'staffAccess'), validate(mutationBaselineSchema), markAsNoShow);

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/reverse-no-show:
 *   put:
 *     summary: Reverse no-show status
 *     tags: [No-Show Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for reversing no-show
 *               newStatus:
 *                 type: string
 *                 enum: [confirmed, checked_in, cancelled]
 *                 default: confirmed
 *                 description: New status after reversing no-show
 *             example:
 *               reason: "Guest arrived late and checked in"
 *               newStatus: "checked_in"
 *     responses:
 *       200:
 *         description: No-show status successfully reversed
 *       400:
 *         description: Bad request or validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Booking not found
 */
router.put('/:bookingId/reverse-no-show', authorizePolicy('noShow', 'managerAccess'), validate(mutationBaselineSchema), reverseNoShow);

/**
 * @swagger
 * /api/v1/bookings/no-show/stats:
 *   get:
 *     summary: Get no-show statistics
 *     tags: [No-Show Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *         description: Filter by hotel ID
 *     responses:
 *       200:
 *         description: No-show statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalNoShows:
 *                           type: number
 *                         totalChargesCollected:
 *                           type: number
 *                         totalPotentialRevenue:
 *                           type: number
 *                         averageChargePerNoShow:
 *                           type: number
 *                         recoveryRate:
 *                           type: string
 *                     monthlyTrends:
 *                       type: object
 *                     recentNoShows:
 *                       type: array
 *       403:
 *         description: Insufficient permissions
 */
router.get('/no-show/stats', authorizePolicy('noShow', 'managerAccess'), getNoShowStats);

export default router;