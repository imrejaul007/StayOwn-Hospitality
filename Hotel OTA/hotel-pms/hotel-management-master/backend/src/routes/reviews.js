import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();
const objectIdSchema = Joi.string().length(24).hex();
const reviewCreateSchema = Joi.object({
  hotelId: objectIdSchema.required(),
  bookingId: objectIdSchema.required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().trim().min(1).max(200).required(),
  content: Joi.string().trim().min(1).max(2000).required(),
  categories: Joi.object({
    cleanliness: Joi.number().integer().min(1).max(5).optional(),
    service: Joi.number().integer().min(1).max(5).optional(),
    location: Joi.number().integer().min(1).max(5).optional(),
    value: Joi.number().integer().min(1).max(5).optional(),
    amenities: Joi.number().integer().min(1).max(5).optional()
  }).optional(),
  visitType: Joi.string().valid('business', 'leisure', 'family', 'couple', 'solo').optional(),
  stayDate: Joi.date().iso().optional(),
  images: Joi.array().items(Joi.string().trim().uri()).max(20).optional(),
  isAnonymous: Joi.boolean().optional()
}).required();
const reviewResponseSchema = Joi.object({
  content: Joi.string().trim().min(1).max(1000).required()
}).required();
const reviewModerationSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'pending').required(),
  notes: Joi.string().trim().allow('').max(2000).optional()
}).required();
const reviewReportSchema = Joi.object({
  reason: Joi.string().trim().allow('').max(1000).optional()
}).optional();

// Apply property access middleware to authenticated routes
// Note: Some routes use optionalAuth and don't require property access

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
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
 *               - rating
 *               - title
 *               - content
 *             properties:
 *               hotelId:
 *                 type: string
 *               bookingId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               categories:
 *                 type: object
 *                 properties:
 *                   cleanliness:
 *                     type: number
 *                   service:
 *                     type: number
 *                   location:
 *                     type: number
 *                   value:
 *                     type: number
 *                   amenities:
 *                     type: number
 *               visitType:
 *                 type: string
 *               stayDate:
 *                 type: string
 *                 format: date
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 */
router.post('/', authenticate, ensureTenantContext, authorizePolicy('reviews', 'baseAccess'), ensurePropertyAccess, validate(reviewCreateSchema), catchAsync(async (req, res) => {
  const {
    hotelId,
    bookingId,
    rating,
    title,
    content,
    categories,
    visitType,
    stayDate,
    images,
    isAnonymous
  } = req.body;

  // Validate required fields
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new ApplicationError('Rating must be an integer between 1 and 5', 400);
  }
  if (!title || !title.trim()) {
    throw new ApplicationError('Review title is required', 400);
  }
  if (!content || !content.trim()) {
    throw new ApplicationError('Review content is required', 400);
  }

  // Validate category ratings if provided
  if (categories) {
    const validCategories = ['cleanliness', 'service', 'location', 'value', 'amenities'];
    for (const [key, value] of Object.entries(categories)) {
      if (!validCategories.includes(key)) {
        throw new ApplicationError(`Invalid category: ${key}`, 400);
      }
      if (value !== undefined && value !== null && (value < 1 || value > 5 || !Number.isInteger(value))) {
        throw new ApplicationError(`Category rating for ${key} must be an integer between 1 and 5`, 400);
      }
    }
  }

  // Validate visitType if provided
  if (visitType && !['business', 'leisure', 'family', 'couple', 'solo'].includes(visitType)) {
    throw new ApplicationError('Invalid visit type', 400);
  }

  // Verify hotel exists
  const hotel = await Hotel.findById(hotelId).lean();
  if (!hotel) {
    throw new ApplicationError('Hotel not found', 404);
  }

  // Check if booking exists and belongs to user (if provided)
  if (bookingId) {
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }
    if (booking.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You can only review your own bookings', 403);
    }
    if (booking.hotelId.toString() !== hotelId) {
      throw new ApplicationError('Booking does not match hotel', 400);
    }
    if (booking.status !== 'checked_out') {
      throw new ApplicationError('Feedback can only be submitted after checkout', 400);
    }

    // Check if review already exists for this booking
    const existingReview = await Review.findOne({ bookingId }).lean();
    if (existingReview) {
      throw new ApplicationError('You have already reviewed this booking', 400);
    }
  } else {
    // Check if user has already reviewed this hotel (without booking)
    const existingReview = await Review.findOne({ 
      hotelId, 
      userId: req.user._id,
      bookingId: { $exists: false }
    }).lean();
    if (existingReview) {
      throw new ApplicationError('You have already reviewed this hotel', 400);
    }
  }

  const review = await Review.create({
    hotelId,
    userId: req.user._id,
    bookingId,
    rating,
    title: title.trim(),
    content: content.trim(),
    categories,
    visitType,
    stayDate,
    images: images || [],
    isAnonymous: !!isAnonymous,
    guestName: isAnonymous ? 'Anonymous Guest' : req.user.name
  });

  await review.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'userId', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { review }
  });
}));

/**
 * @swagger
 * /reviews/hotel/{hotelId}:
 *   get:
 *     summary: Get reviews for a specific hotel
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
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
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest, oldest, highest_rated, lowest_rated, most_helpful]
 *     responses:
 *       200:
 *         description: Hotel reviews and summary
 */
router.get('/hotel/:hotelId', optionalAuth, catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const { rating, sortBy = 'newest' } = req.query;

  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    throw new ApplicationError('Invalid hotel ID', 400);
  }

  logger.debug('Reviews API request', { hotelId, page, limit, rating, sortBy });

  const query = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isPublished: true,
    moderationStatus: 'approved'
  };

  if (rating) {
    const parsedRating = parseInt(rating);
    if (parsedRating >= 1 && parsedRating <= 5) {
      query.rating = parsedRating;
    }
  }

  // Sort options
  let sortOption = '-createdAt'; // newest by default
  switch (sortBy) {
    case 'oldest':
      sortOption = 'createdAt';
      break;
    case 'highest_rated':
      sortOption = '-rating';
      break;
    case 'lowest_rated':
      sortOption = 'rating';
      break;
    case 'most_helpful':
      sortOption = '-helpfulVotes';
      break;
  }

  const skip = (page - 1) * limit;

  const [reviews, total, summary] = await Promise.all([
    Review.find(query)
      .populate('hotelId', 'name address')
      .populate('userId', 'name')
      .populate('bookingId', 'bookingNumber checkIn checkOut')
      .populate('response.respondedBy', 'name role')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
    Review.getHotelRatingSummary(hotelId)
  ]);

  logger.debug('Reviews query results', { found: reviews.length, total });

  res.json({
    status: 'success',
    data: {
      reviews,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /reviews/hotel/{hotelId}/summary:
 *   get:
 *     summary: Get hotel rating summary
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel rating summary
 */
router.get('/hotel/:hotelId/summary', optionalAuth, catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  
  const summary = await Review.getHotelRatingSummary(hotelId);
  
  if (!summary) {
    return res.json({
      status: 'success',
      data: {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryAverages: {}
      }
    });
  }

  res.json({
    status: 'success',
    data: summary
  });
}));

/**
 * @swagger
 * /reviews/pending:
 *   get:
 *     summary: Get pending reviews for moderation (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Pending reviews
 */
router.get('/pending', authenticate, ensureTenantContext, authorize('admin'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  const skip = (page - 1) * limit;

  // Tenant isolation: scope pending reviews to the admin's hotel
  const filter = { moderationStatus: 'pending' };
  if (req.user.hotelId) {
    filter.hotelId = req.user.hotelId;
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('hotelId', 'name')
      .populate('userId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter)
  ]);

  res.json({
    status: 'success',
    data: {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /reviews/user/my-reviews:
 *   get:
 *     summary: Get current user's reviews
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: User's reviews
 */
router.get('/user/my-reviews', authenticate, ensureTenantContext, ensurePropertyAccess, catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

  const skip = (page - 1) * limit;
  const reviewQuery = { userId: req.user._id };
  if (req.user.hotelId) {
    reviewQuery.hotelId = req.user.hotelId;
  }

  const [reviews, total] = await Promise.all([
    Review.find(reviewQuery)
      .populate('hotelId', 'name address')
      .populate('bookingId', 'bookingNumber checkIn checkOut')
      .populate('response.respondedBy', 'name role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(reviewQuery)
  ]);

  res.json({
    status: 'success',
    data: {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     summary: Get specific review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review details
 */
router.get('/:id', optionalAuth, catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Review not found', 404);
  }
  const review = await Review.findById(req.params.id)
    .populate('hotelId', 'name address')
    .populate('userId', 'name')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('response.respondedBy', 'name role').lean();

  if (!review || (!review.isPublished && review.moderationStatus !== 'approved')) {
    throw new ApplicationError('Review not found', 404);
  }

  res.json({
    status: 'success',
    data: { review }
  });
}));

/**
 * @swagger
 * /reviews/{id}/response:
 *   post:
 *     summary: Add response to review (staff/admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response added successfully
 */
router.post('/:id/response', authenticate, ensureTenantContext, authorizePolicy('reviews', 'staffAccess'), ensurePropertyAccess, validate(reviewResponseSchema), catchAsync(async (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    throw new ApplicationError('Response content is required', 400);
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Review not found', 404);
  }
  // Do NOT use .lean() here -- we need the Mongoose document instance for .addResponse()
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw new ApplicationError('Review not found', 404);
  }

  // Staff can only respond to reviews for their hotel
  if (req.user.role === 'staff' && review.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only respond to reviews for your hotel', 403);
  }

  await review.addResponse(content, req.user._id);

  await review.populate([
    { path: 'response.respondedBy', select: 'name role' }
  ]);

  res.json({
    status: 'success',
    message: 'Response added successfully',
    data: { review }
  });
}));

/**
 * @swagger
 * /reviews/{id}/helpful:
 *   post:
 *     summary: Mark review as helpful
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review marked as helpful
 */
router.post('/:id/helpful', authenticate, ensureTenantContext, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }

    // Check if user already voted
    if (review.helpfulVotedBy && review.helpfulVotedBy.some(id => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ status: 'error', message: 'You have already voted on this review' });
    }

    // Add vote atomically
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { helpfulVotes: 1 },
        $addToSet: { helpfulVotedBy: req.user._id }
      },
      { new: true }
    );

    res.json({ status: 'success', data: { helpfulVotes: updatedReview.helpfulVotes } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to record vote' });
  }
});

/**
 * @swagger
 * /reviews/{id}/report:
 *   post:
 *     summary: Report review as inappropriate
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review reported successfully
 */
router.post('/:id/report', authenticate, ensureTenantContext, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ status: 'error', message: 'Review not found' });
    }

    // Check if user already reported
    if (review.reportedBy && review.reportedBy.some(r => r.userId.toString() === req.user._id.toString())) {
      return res.status(400).json({ status: 'error', message: 'You have already reported this review' });
    }

    // Add report
    const update = {
      $inc: { reportedCount: 1 },
      $push: { reportedBy: { userId: req.user._id, reason: reason || 'No reason provided', reportedAt: new Date() } }
    };

    // Auto-hide at 5+ reports
    const newCount = (review.reportedCount || 0) + 1;
    if (newCount >= 5) {
      update.$set = { moderationStatus: 'pending', isPublished: false };
    }

    await Review.findByIdAndUpdate(req.params.id, update);

    res.json({ status: 'success', message: 'Report submitted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to submit report' });
  }
});

/**
 * @swagger
 * /reviews/{id}/moderate:
 *   patch:
 *     summary: Moderate review (admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, pending]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review moderated successfully
 */
router.patch('/:id/moderate', authenticate, ensureTenantContext, authorizePolicy('reviews', 'adminAccess'), ensurePropertyAccess, validate(reviewModerationSchema), catchAsync(async (req, res) => {
  const { status, notes } = req.body;

  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    throw new ApplicationError('Valid moderation status is required (approved, rejected, pending)', 400);
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Review not found', 404);
  }
  // Do NOT use .lean() here -- we need the Mongoose document instance for .moderate()
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw new ApplicationError('Review not found', 404);
  }

  // Tenant isolation: admin can only moderate reviews for their hotel
  if (req.user.hotelId && review.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only moderate reviews for your hotel', 403);
  }

  await review.moderate(status, notes);

  res.json({
    status: 'success',
    message: 'Review moderated successfully',
    data: { review }
  });
}));

export default router;