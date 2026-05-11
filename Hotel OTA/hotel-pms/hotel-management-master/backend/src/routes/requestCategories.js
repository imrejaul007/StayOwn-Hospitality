import express from 'express';
import RequestCategory from '../models/RequestCategory.js';
import RequestTemplate from '../models/RequestTemplate.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require authentication
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

/**
 * @swagger
 * /api/v1/request-categories:
 *   get:
 *     summary: Get request categories
 *     tags: [Request Categories]
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department
 */
router.get('/', catchAsync(async (req, res) => {
  const { department, page = 1, limit = 50 } = req.query;
  const { hotelId } = req.user;

  const filter = { hotelId, isActive: true };

  if (department) {
    filter.department = department;
  }

  const categories = await RequestCategory.find(filter)
    .populate('createdBy', 'username email')
    .sort({ sortOrder: 1, name: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit).lean();

  // Batch: get template counts for all categories in a single aggregation
  const categoryNames = categories.map(c => c.name.toLowerCase());
  const templateCounts = await RequestTemplate.aggregate([
    { $match: { hotelId, category: { $in: categoryNames }, isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  const countMap = new Map(templateCounts.map(tc => [tc._id, tc.count]));

  const categoriesWithTemplates = categories.map(category => ({
    ...category.toObject(),
    templateCount: countMap.get(category.name.toLowerCase()) || 0
  }));

  const total = await RequestCategory.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    data: {
      categories: categoriesWithTemplates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/request-categories/{id}:
 *   get:
 *     summary: Get request category by ID
 *     tags: [Request Categories]
 */
router.get('/:id', catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const category = await RequestCategory.findOne({
    _id: req.params.id,
    hotelId,
    isActive: true
  }).populate('createdBy', 'username email').lean();

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  // Get templates for this category
  const templates = await RequestTemplate.find({
    hotelId,
    category: category.name.toLowerCase(),
    isActive: true
  }).select('name description estimatedBudget useCount').lean().limit(1000);

  res.status(200).json({
    status: 'success',
    data: {
      category: {
        ...category.toObject(),
        templates
      }
    }
  });
}));

/**
 * @swagger
 * /api/v1/request-categories:
 *   post:
 *     summary: Create new request category
 *     tags: [Request Categories]
 */
router.post('/', authorizePolicy('requestCategories', 'manageAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  const categoryData = {
    ...req.body,
    hotelId,
    createdBy: userId
  };

  const category = await RequestCategory.create(categoryData);

  res.status(201).json({
    status: 'success',
    data: { category },
    message: 'Category created successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-categories/{id}:
 *   put:
 *     summary: Update request category
 *     tags: [Request Categories]
 */
router.put('/:id', authorizePolicy('requestCategories', 'manageAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;

  const category = await RequestCategory.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { ...req.body, updatedBy: userId },
    { new: true, runValidators: true }
  );

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { category },
    message: 'Category updated successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-categories/{id}:
 *   delete:
 *     summary: Deactivate request category
 *     tags: [Request Categories]
 */
router.delete('/:id', authorizePolicy('requestCategories', 'manageAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const category = await RequestCategory.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { isActive: false },
    { new: true }
  );

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Category deactivated successfully'
  });
}));

/**
 * @swagger
 * /api/v1/request-categories/{id}/budget:
 *   put:
 *     summary: Update category budget
 *     tags: [Request Categories]
 */
router.put('/:id/budget', authorizePolicy('requestCategories', 'manageAccess'), validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { budgetAllocated, budgetUsed } = req.body;

  const category = await RequestCategory.findOneAndUpdate(
    { _id: req.params.id, hotelId },
    { budgetAllocated, budgetUsed },
    { new: true, runValidators: true }
  );

  if (!category) {
    throw new ApplicationError('Category not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { category },
    message: 'Category budget updated successfully'
  });
}));

export default router;