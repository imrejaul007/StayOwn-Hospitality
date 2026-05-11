import express from 'express';
import DashboardConfig from '../models/DashboardConfig.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// GET /dashboard-configs — list user's dashboards
router.get('/', authorize('admin', 'manager', 'frontdesk'), catchAsync(async (req, res) => {
  const hotelId = req.query.hotelId || req.user.hotelId;
  const dashboards = await DashboardConfig.find({
    hotelId,
    $or: [{ userId: req.user._id }, { isPublic: true }],
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  res.json({ success: true, data: dashboards });
}));

// GET /dashboard-configs/:id
router.get('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const hotelId = req.query.hotelId || req.user.hotelId;
  const dashboard = await DashboardConfig.findOne({
    _id: req.params.id,
    hotelId,
  }).lean();
  if (!dashboard) throw new ApplicationError('Dashboard not found', 404);
  res.json({ success: true, data: dashboard });
}));

// POST /dashboard-configs — create
router.post('/', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const { name, description, widgets, isDefault, isPublic, tags } = req.body;
  const hotelId = req.body.hotelId || req.query.hotelId || req.user.hotelId;

  if (isDefault) {
    await DashboardConfig.updateMany({ hotelId, userId: req.user._id, isDefault: true }, { isDefault: false });
  }

  const dashboard = await DashboardConfig.create({
    hotelId,
    userId: req.user._id,
    name,
    description,
    widgets: widgets || [],
    isDefault: isDefault || false,
    isPublic: isPublic || false,
    tags: tags || [],
  });

  res.status(201).json({ success: true, data: dashboard });
}));

// PUT /dashboard-configs/:id — update
router.put('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const dashboard = await DashboardConfig.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!dashboard) throw new ApplicationError('Dashboard not found or not owned by user', 404);
  res.json({ success: true, data: dashboard });
}));

// DELETE /dashboard-configs/:id
router.delete('/:id', authorize('admin', 'manager'), catchAsync(async (req, res) => {
  const result = await DashboardConfig.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!result) throw new ApplicationError('Dashboard not found or not owned by user', 404);
  res.json({ success: true, message: 'Dashboard deleted' });
}));

export default router;
