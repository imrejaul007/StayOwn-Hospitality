import express from 'express';
import enhancedBookingController from '../controllers/enhancedBookingController.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('enhancedBookings', 'baseAccess'));

/**
 * @swagger
 * /bookings/enhanced:
 *   post:
 *     summary: Create a new enhanced booking
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hotelId
 *               - checkIn
 *               - checkOut
 *               - guestDetails
 *             properties:
 *               hotelId:
 *                 type: string
 *               checkIn:
 *                 type: string
 *                 format: date
 *               checkOut:
 *                 type: string
 *                 format: date
 *               guestDetails:
 *                 type: object
 *               roomTypeId:
 *                 type: string
 *               roomType:
 *                 type: string
 *               roomRequests:
 *                 type: integer
 *                 default: 1
 *               channel:
 *                 type: string
 *               source:
 *                 type: string
 *                 enum: [direct, booking_com, expedia, airbnb]
 *                 default: direct
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post('/', authenticate, ensurePropertyAccess, validate(mutationBaselineSchema), async (req, res) => {
  await enhancedBookingController.createBooking(req, res);
});

/**
 * @swagger
 * /bookings/enhanced:
 *   get:
 *     summary: Get enhanced bookings with filtering
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: roomTypeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [direct, booking_com, expedia, airbnb]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, checked_in, checked_out, cancelled, no_show]
 *       - in: query
 *         name: checkIn
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOut
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of enhanced bookings
 */
router.get('/', authenticate, ensurePropertyAccess, async (req, res) => {
  await enhancedBookingController.getBookings(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}:
 *   put:
 *     summary: Update enhanced booking
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking updated successfully
 */
router.put('/:id', authenticate, ensurePropertyAccess, validate(mutationBaselineSchema), async (req, res) => {
  await enhancedBookingController.updateBooking(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}/cancel:
 *   post:
 *     summary: Cancel enhanced booking
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               refundAmount:
 *                 type: number
 *               source:
 *                 type: string
 *                 default: manual
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */
router.post('/:id/cancel', authenticate, ensurePropertyAccess, validate(mutationBaselineSchema), async (req, res) => {
  await enhancedBookingController.cancelBooking(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/analytics:
 *   get:
 *     summary: Get booking analytics
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [roomType, channel, status]
 *           default: roomType
 *     responses:
 *       200:
 *         description: Booking analytics data
 */
router.get('/analytics', authenticate, ensurePropertyAccess, async (req, res) => {
  await enhancedBookingController.getBookingAnalytics(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}/history:
 *   get:
 *     summary: Get booking modification history
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking history and modifications
 */
router.get('/:id/history', authenticate, ensurePropertyAccess, async (req, res) => {
  await enhancedBookingController.getBookingHistory(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}/sync:
 *   post:
 *     summary: Sync booking with OTA channels
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Sync results
 */
router.post('/:id/sync', authenticate, ensurePropertyAccess, validate(mutationBaselineSchema), async (req, res) => {
  await enhancedBookingController.syncBookingWithChannels(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/channels:
 *   get:
 *     summary: Get channel bookings with reconciliation
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: needsReconciliation
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Channel bookings data
 */
router.get('/channels', authenticate, ensurePropertyAccess, async (req, res) => {
  await enhancedBookingController.getChannelBookings(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/channel-modification:
 *   post:
 *     summary: Handle booking modification from channel
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channelBookingId
 *               - channel
 *               - modificationType
 *               - newValues
 *             properties:
 *               channelBookingId:
 *                 type: string
 *               channel:
 *                 type: string
 *               modificationType:
 *                 type: string
 *                 enum: [rate_change, date_change, guest_change, cancellation]
 *               newValues:
 *                 type: object
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Modification handled successfully
 */
router.post('/channel-modification', authenticate, ensurePropertyAccess, validate(mutationBaselineSchema), async (req, res) => {
  await enhancedBookingController.handleChannelModification(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/dashboard:
 *   get:
 *     summary: Get booking dashboard with OTA metrics
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Booking dashboard data
 */
router.get('/dashboard', authenticate, ensurePropertyAccess, async (req, res) => {
  await enhancedBookingController.getBookingDashboard(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}/adjust-price:
 *   post:
 *     summary: Apply price adjustment to booking
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required:
 *               - amount
 *               - reason
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Adjustment amount (negative for discount, positive for surcharge)
 *               type:
 *                 type: string
 *                 enum: [discount, surcharge, rate_change, promotion, manual_adjustment]
 *                 default: manual_adjustment
 *               reason:
 *                 type: string
 *                 description: Reason for price adjustment
 *               percentage:
 *                 type: number
 *                 description: Percentage of adjustment if applicable
 *               discountCode:
 *                 type: string
 *                 description: Discount code used if applicable
 *     responses:
 *       200:
 *         description: Price adjustment applied successfully
 *       400:
 *         description: Invalid adjustment data
 *       403:
 *         description: Insufficient authorization for price adjustment
 *       404:
 *         description: Booking not found
 */
router.post('/:id/adjust-price', authenticate, ensurePropertyAccess, authorizePolicy('enhancedBookings', 'priceAdjustAccess'), validate(mutationBaselineSchema), async (req, res) => {
  await enhancedBookingController.adjustBookingPrice(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}/adjustments/{adjustmentId}/reverse:
 *   post:
 *     summary: Reverse a price adjustment
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *       - in: path
 *         name: adjustmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Adjustment ID to reverse
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for reversing the adjustment
 *     responses:
 *       200:
 *         description: Price adjustment reversed successfully
 *       400:
 *         description: Invalid reversal request
 *       403:
 *         description: Only admins and managers can reverse adjustments
 *       404:
 *         description: Booking or adjustment not found
 */
router.post('/:id/adjustments/:adjustmentId/reverse', authenticate, ensurePropertyAccess, authorizePolicy('enhancedBookings', 'priceReverseAccess'), validate(mutationBaselineSchema), async (req, res) => {
  await enhancedBookingController.reversePriceAdjustment(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}:
 *   get:
 *     summary: Get a single enhanced booking by ID
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Booking not found
 */
router.get('/:id', authenticate, ensurePropertyAccess, async (req, res) => {
  await enhancedBookingController.getBookingById(req, res);
});

/**
 * @swagger
 * /bookings/enhanced/{id}/price-history:
 *   get:
 *     summary: Get price adjustment history for a booking
 *     tags: [Enhanced Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Price adjustment history retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Booking not found
 */
router.get('/:id/price-history', authenticate, ensurePropertyAccess, async (req, res) => {
  await enhancedBookingController.getPriceAdjustmentHistory(req, res);
});

export default router;
