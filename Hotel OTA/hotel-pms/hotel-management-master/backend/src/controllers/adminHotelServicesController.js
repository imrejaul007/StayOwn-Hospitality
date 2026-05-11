import mongoose from 'mongoose';
import HotelService from '../models/HotelService.js';
import ServiceBooking from '../models/ServiceBooking.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import websocketService from '../services/websocketService.js';
import logger from '../utils/logger.js';

function resolveActorHotelId(req) {
  const resolvedHotelId = req.user?.hotelId || req.query?.hotelId;
  if (!resolvedHotelId) {
    throw new ApplicationError('Hotel context required', 400);
  }
  return resolvedHotelId;
}

async function emitHotelServiceEvent(eventName, serviceDoc, extra = {}) {
  if (!serviceDoc) return;
  const hotelId = serviceDoc.hotelId?._id || serviceDoc.hotelId;
  if (!hotelId) return;
  await websocketService.broadcastToHotel(
    hotelId.toString(),
    eventName,
    {
      service: serviceDoc,
      ...extra
    }
  ).catch(err => logger.warn(`WebSocket broadcast failed for ${eventName}:`, err.message));
}

async function enforceFeaturedLimit(hotelId, currentServiceId = null) {
  const featuredMax = Math.max(1, Number.parseInt(process.env.HOTEL_SERVICE_MAX_FEATURED || '12', 10));
  const query = { hotelId, featured: true, isActive: true };
  if (currentServiceId) {
    query._id = { $ne: currentServiceId };
  }
  const count = await HotelService.countDocuments(query);
  if (count >= featuredMax) {
    throw new ApplicationError(`Featured services limit reached (${featuredMax})`, 400);
  }
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/services';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ApplicationError('Only image files are allowed', 400), false);
  }
};

export const uploadImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).array('images', 5); // Allow up to 5 images

/**
 * @swagger
 * /admin/hotel-services:
 *   get:
 *     summary: Get all hotel services (Admin only)
 *     tags: [Admin - Hotel Services]
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
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: List of hotel services with pagination
 */
export const getAllServices = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    search,
    status,
    hotelId
  } = req.query;

  const query = {};

  // Resolve hotel context — mandatory for tenant isolation
  const resolvedHotelId = hotelId || req.user.hotelId;
  if (!resolvedHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  query.hotelId = resolvedHotelId;

  if (type) query.type = type;

  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  if (search && typeof search === 'string') {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
    if (safeSearch) {
      const regex = new RegExp(safeSearch, 'i');
      query.$or = [
        { name: regex },
        { description: regex },
        { tags: regex }
      ];
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [services, total] = await Promise.all([
    HotelService.find(query)
      .populate('hotelId', 'name address')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    HotelService.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      services,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}:
 *   get:
 *     summary: Get specific hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel service details
 *       404:
 *         description: Service not found
 */
export const getServiceById = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const service = await HotelService.findOne({ _id: req.params.id, hotelId: actorHotelId })
    .populate('hotelId', 'name address contact').lean();

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  res.json({
    status: 'success',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services:
 *   post:
 *     summary: Create new hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - type
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [dining, spa, gym, transport, entertainment, business, wellness, recreation]
 *               price:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: INR
 *               duration:
 *                 type: number
 *               capacity:
 *                 type: number
 *               location:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Service created successfully
 */
export const createService = catchAsync(async (req, res) => {
  const {
    name,
    description,
    type,
    price,
    currency = 'INR',
    duration,
    capacity,
    location,
    specialInstructions,
    amenities,
    tags,
    featured = false,
    featuredPriority = 0,
    featuredFrom,
    featuredUntil,
    isActive = true
  } = req.body;

  // Parse arrays from form data
  const parsedAmenities = amenities ?
    (Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim())) : [];
  const parsedTags = tags ?
    (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [];

  // Handle uploaded images
  const images = req.files ? req.files.map(file => `/uploads/services/${file.filename}`) : [];

  // Parse operating hours if provided
  let operatingHours;
  if (req.body.operatingHoursOpen && req.body.operatingHoursClose) {
    operatingHours = {
      open: req.body.operatingHoursOpen,
      close: req.body.operatingHoursClose
    };
  }

  // Parse contact info if provided
  let contactInfo = {};
  if (req.body.contactPhone) contactInfo.phone = req.body.contactPhone;
  if (req.body.contactEmail) contactInfo.email = req.body.contactEmail;

  const serviceData = {
    hotelId: req.user.hotelId,
    name,
    description,
    type,
    price: parseFloat(price),
    currency,
    duration: duration ? parseInt(duration) : undefined,
    capacity: capacity ? parseInt(capacity) : undefined,
    location,
    specialInstructions,
    amenities: parsedAmenities,
    tags: parsedTags,
    featured: featured === 'true' || featured === true,
    featuredPriority: Number.isFinite(Number(featuredPriority)) ? Number(featuredPriority) : 0,
    featuredFrom: featuredFrom ? new Date(featuredFrom) : undefined,
    featuredUntil: featuredUntil ? new Date(featuredUntil) : undefined,
    isActive: isActive === 'true' || isActive === true,
    images,
    operatingHours,
    contactInfo: Object.keys(contactInfo).length > 0 ? contactInfo : undefined,
    rating: {
      average: 0,
      count: 0
    }
  };
  if (serviceData.featured) {
    await enforceFeaturedLimit(serviceData.hotelId);
  }

  const service = await HotelService.create(serviceData);

  await service.populate('hotelId', 'name');
  await emitHotelServiceEvent('hotel-service:created', service.toObject());

  res.status(201).json({
    status: 'success',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}:
 *   put:
 *     summary: Update hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *               price:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Service updated successfully
 */
export const updateService = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const service = await HotelService.findOne({ _id: req.params.id, hotelId: actorHotelId });

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  const {
    name,
    description,
    type,
    price,
    currency,
    duration,
    capacity,
    location,
    specialInstructions,
    amenities,
    tags,
    featured,
    featuredPriority,
    featuredFrom,
    featuredUntil,
    isActive
  } = req.body;

  // Parse arrays from form data
  const parsedAmenities = amenities ?
    (Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim())) : undefined;
  const parsedTags = tags ?
    (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : undefined;

  // Handle new uploaded images
  if (req.files && req.files.length > 0) {
    // Add new images to existing ones
    const newImages = req.files.map(file => `/uploads/services/${file.filename}`);
    service.images = [...service.images, ...newImages];
  }

  // Parse operating hours if provided
  if (req.body.operatingHoursOpen && req.body.operatingHoursClose) {
    service.operatingHours = {
      open: req.body.operatingHoursOpen,
      close: req.body.operatingHoursClose
    };
  }

  // Parse contact info if provided
  if (req.body.contactPhone || req.body.contactEmail) {
    service.contactInfo = service.contactInfo || {};
    if (req.body.contactPhone) service.contactInfo.phone = req.body.contactPhone;
    if (req.body.contactEmail) service.contactInfo.email = req.body.contactEmail;
  }

  // Update fields
  if (name !== undefined) service.name = name;
  if (description !== undefined) service.description = description;
  if (type !== undefined) service.type = type;
  if (price !== undefined) service.price = parseFloat(price);
  if (currency !== undefined) service.currency = currency;
  if (duration !== undefined) service.duration = parseInt(duration);
  if (capacity !== undefined) service.capacity = parseInt(capacity);
  if (location !== undefined) service.location = location;
  if (specialInstructions !== undefined) service.specialInstructions = specialInstructions;
  if (parsedAmenities !== undefined) service.amenities = parsedAmenities;
  if (parsedTags !== undefined) service.tags = parsedTags;
  if (featured !== undefined) service.featured = featured === 'true' || featured === true;
  if (featuredPriority !== undefined) service.featuredPriority = Number.parseInt(featuredPriority, 10) || 0;
  if (featuredFrom !== undefined) service.featuredFrom = featuredFrom ? new Date(featuredFrom) : undefined;
  if (featuredUntil !== undefined) service.featuredUntil = featuredUntil ? new Date(featuredUntil) : undefined;
  if (isActive !== undefined) service.isActive = isActive === 'true' || isActive === true;

  if (service.featured) {
    await enforceFeaturedLimit(actorHotelId, service._id);
  }
  await service.save();
  await service.populate('hotelId', 'name');
  await emitHotelServiceEvent('hotel-service:updated', service.toObject());

  res.json({
    status: 'success',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}:
 *   delete:
 *     summary: Delete hotel service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service deleted successfully
 */
export const deleteService = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const service = await HotelService.findOne({ _id: req.params.id, hotelId: actorHotelId }).lean();

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Delete service images from filesystem
  if (service.images && service.images.length > 0) {
    service.images.forEach(imagePath => {
      const fullPath = path.join(process.cwd(), imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  }

  await HotelService.findOneAndDelete({ _id: req.params.id, hotelId: actorHotelId });
  await emitHotelServiceEvent('hotel-service:updated', service, { deleted: true });

  res.json({
    status: 'success',
    message: 'Service deleted successfully'
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/toggle-status:
 *   patch:
 *     summary: Toggle service active status (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service status updated successfully
 */
export const toggleServiceStatus = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  // First read to check access and get current status
  const existing = await HotelService.findOne({ _id: req.params.id, hotelId: actorHotelId }).lean();

  if (!existing) {
    throw new ApplicationError('Service not found', 404);
  }

  // Atomic toggle using findOneAndUpdate
  const service = await HotelService.findOneAndUpdate(
    { _id: req.params.id, hotelId: actorHotelId },
    { $set: { isActive: !existing.isActive } },
    { new: true, runValidators: true }
  ).populate('hotelId', 'name');
  await emitHotelServiceEvent(
    service.isActive ? 'hotel-service:updated' : 'hotel-service:unavailable',
    service.toObject(),
    { availabilityChanged: true }
  );

  res.json({
    status: 'success',
    data: service,
    message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/images/{imageIndex}:
 *   delete:
 *     summary: Delete specific service image (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: imageIndex
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Image deleted successfully
 */
export const deleteServiceImage = catchAsync(async (req, res) => {
  const { id, imageIndex } = req.params;
  const actorHotelId = resolveActorHotelId(req);
  const service = await HotelService.findOne({ _id: id, hotelId: actorHotelId });

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  const index = parseInt(imageIndex);
  if (index < 0 || index >= service.images.length) {
    throw new ApplicationError('Invalid image index', 400);
  }

  // Delete image file from filesystem
  const imagePath = service.images[index];
  const fullPath = path.join(process.cwd(), imagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  // Remove image from array
  service.images.splice(index, 1);
  await service.save();
  await emitHotelServiceEvent('hotel-service:updated', service.toObject());

  res.json({
    status: 'success',
    message: 'Image deleted successfully',
    data: service
  });
});

/**
 * @swagger
 * /admin/hotel-services/bulk-operations:
 *   post:
 *     summary: Perform bulk operations on services (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operation
 *               - serviceIds
 *             properties:
 *               operation:
 *                 type: string
 *                 enum: [activate, deactivate, delete, feature, unfeature]
 *               serviceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 */
export const bulkOperations = catchAsync(async (req, res) => {
  const { operation, serviceIds } = req.body;
  const actorHotelId = resolveActorHotelId(req);

  if (!operation || !serviceIds || !Array.isArray(serviceIds)) {
    throw new ApplicationError('Operation and serviceIds array are required', 400);
  }

  const services = await HotelService.find({
    _id: { $in: serviceIds },
    hotelId: actorHotelId
  }).lean().limit(1000);

  if (services.length !== serviceIds.length) {
    throw new ApplicationError('Some services not found or access denied', 404);
  }

  let updateData = {};
  let message = '';

  switch (operation) {
    case 'activate':
      updateData = { isActive: true };
      message = 'Services activated successfully';
      break;
    case 'deactivate':
      updateData = { isActive: false };
      message = 'Services deactivated successfully';
      break;
    case 'feature':
      updateData = { featured: true };
      message = 'Services featured successfully';
      break;
    case 'unfeature':
      updateData = { featured: false };
      message = 'Services unfeatured successfully';
      break;
    case 'delete':
      // Delete images from filesystem
      for (const service of services) {
        if (service.images && service.images.length > 0) {
          service.images.forEach(imagePath => {
            const fullPath = path.join(process.cwd(), imagePath);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          });
        }
      }
      await HotelService.deleteMany({ _id: { $in: serviceIds }, hotelId: actorHotelId });
      for (const service of services) {
        await emitHotelServiceEvent('hotel-service:updated', service, { deleted: true });
      }
      return res.json({
        status: 'success',
        message: 'Services deleted successfully'
      });
    default:
      throw new ApplicationError('Invalid operation', 400);
  }

  await HotelService.updateMany(
    { _id: { $in: serviceIds }, hotelId: actorHotelId },
    updateData
  );
  const updatedServices = await HotelService.find({ _id: { $in: serviceIds }, hotelId: actorHotelId })
    .populate('hotelId', 'name')
    .lean();
  for (const service of updatedServices) {
    await emitHotelServiceEvent(
      service.isActive ? 'hotel-service:updated' : 'hotel-service:unavailable',
      service,
      { bulkOperation: operation, availabilityChanged: operation === 'deactivate' || operation === 'activate' }
    );
  }

  res.json({
    status: 'success',
    message
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/staff:
 *   get:
 *     summary: Get assigned staff for a service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned staff
 */
export const getServiceStaff = catchAsync(async (req, res) => {
  // Do NOT use .lean() — we need instance methods (getActiveStaff, hasAdequateStaffing)
  const service = await HotelService.findById(req.params.id)
    .populate('assignedStaff.staffId', 'name email phone department');

  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Tenant isolation — check for all roles
  if (req.user.hotelId && service.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied to this service', 403);
  }

  const activeStaff = typeof service.getActiveStaff === 'function'
    ? service.getActiveStaff()
    : (service.assignedStaff || []).filter(s => s.isActive !== false);

  const isAdequatelyStaffed = typeof service.hasAdequateStaffing === 'function'
    ? service.hasAdequateStaffing()
    : activeStaff.length >= (service.staffRequirements?.minimumStaff || 1);

  res.json({
    status: 'success',
    data: {
      serviceId: service._id,
      serviceName: service.name,
      assignedStaff: activeStaff,
      staffingStatus: {
        isAdequatelyStaffed,
        minimumRequired: service.staffRequirements?.minimumStaff || 1,
        currentStaffCount: activeStaff.length
      }
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/staff:
 *   post:
 *     summary: Assign staff to a service (Admin only)
 *     tags: [Admin - Hotel Services]
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
 *               - staffId
 *             properties:
 *               staffId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [manager, supervisor, attendant, specialist]
 *               primaryContact:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Staff assigned successfully
 */
export const assignStaffToService = catchAsync(async (req, res) => {
  const { staffId, role = 'attendant', primaryContact = false } = req.body;
  const actorHotelId = resolveActorHotelId(req);

  const service = await HotelService.findOne({ _id: req.params.id, hotelId: actorHotelId });
  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  // Verify staff member exists and belongs to the same hotel
  const User = mongoose.model('User');
  const staffMember = await User.findOne({
    _id: staffId,
    hotelId: service.hotelId,
    role: 'staff',
    isActive: true
  }).lean();

  if (!staffMember) {
    throw new ApplicationError('Staff member not found or not active', 404);
  }

  // Assign staff to service
  service.assignStaff(staffId, role, primaryContact);
  await service.save();

  // Populate the updated service
  await service.populate('assignedStaff.staffId', 'name email department');
  await emitHotelServiceEvent('hotel-service:updated', service.toObject());

  res.json({
    status: 'success',
    message: 'Staff assigned successfully',
    data: {
      service,
      assignedStaff: service.getActiveStaff()
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/{id}/staff/{staffId}:
 *   delete:
 *     summary: Remove staff assignment from service (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Staff assignment removed successfully
 */
export const removeStaffFromService = catchAsync(async (req, res) => {
  const { id: serviceId, staffId } = req.params;
  const actorHotelId = resolveActorHotelId(req);

  const service = await HotelService.findOne({ _id: serviceId, hotelId: actorHotelId });
  if (!service) {
    throw new ApplicationError('Service not found', 404);
  }

  service.unassignStaff(staffId);
  await service.save();

  await service.populate('assignedStaff.staffId', 'name email department');
  await emitHotelServiceEvent('hotel-service:updated', service.toObject());

  res.json({
    status: 'success',
    message: 'Staff assignment removed successfully',
    data: {
      service,
      assignedStaff: service.getActiveStaff()
    }
  });
});

/**
 * @swagger
 * /admin/hotel-services/available-staff:
 *   get:
 *     summary: Get available staff for service assignment (Admin only)
 *     tags: [Admin - Hotel Services]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available staff members
 */
export const getAvailableStaff = catchAsync(async (req, res) => {
  const User = mongoose.model('User');

  const hotelId = req.query.hotelId || req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const availableStaff = await User.find({
    hotelId: hotelId,
    role: 'staff',
    isActive: true
  }).select('_id name email phone department specializations')
    .sort({ name: 1 }).lean().limit(1000);

  res.json({
    status: 'success',
    data: availableStaff
  });
});

export const getFulfillmentQueue = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const rawPage = Number.parseInt(String(req.query.page ?? 1), 10);
  const rawLimit = Number.parseInt(String(req.query.limit ?? 20), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 20;
  const skip = (page - 1) * limit;
  const status = req.query.status;
  const query = { hotelId: actorHotelId };
  if (status) {
    query.status = status;
  } else {
    query.status = { $in: ['pending', 'confirmed'] };
  }

  const [bookings, totalCount] = await Promise.all([
    ServiceBooking.find(query)
      .sort({ bookingDate: 1 })
      .skip(skip)
      .limit(limit)
      .populate('serviceId', 'name type location')
      .populate('userId', 'name email phone')
      .populate('assignedStaffId', 'name email')
      .lean(),
    ServiceBooking.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      bookings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1
      }
    }
  });
});

export const assignBookingStaff = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const { bookingId } = req.params;
  const { staffId } = req.body;

  const booking = await ServiceBooking.findOne({ _id: bookingId, hotelId: actorHotelId });
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }
  if (booking.status === 'cancelled' || booking.status === 'completed') {
    throw new ApplicationError('Cannot assign staff for closed booking', 400);
  }

  const User = mongoose.model('User');
  const staff = await User.findOne({ _id: staffId, hotelId: actorHotelId, role: 'staff', isActive: true }).lean();
  if (!staff) {
    throw new ApplicationError('Staff member not found or inactive', 404);
  }

  booking.assignedStaffId = staffId;
  booking.assignedAt = new Date();
  if (booking.status === 'pending') {
    booking.status = 'confirmed';
  }
  await booking.save();
  await websocketService.broadcastToHotel(String(actorHotelId), 'hotel-service-booking:updated', { bookingId: booking._id, status: booking.status, assignedStaffId: staffId }).catch(err => logger.warn('WebSocket broadcast failed for hotel-service-booking:updated:', err.message));

  res.json({ status: 'success', data: booking });
});

export const updateBookingStatus = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const { bookingId } = req.params;
  const { status, reason } = req.body;
  const booking = await ServiceBooking.findOne({ _id: bookingId, hotelId: actorHotelId });
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  if (status === 'confirmed' && booking.status !== 'pending') {
    throw new ApplicationError('Only pending booking can be confirmed', 400);
  }
  if (status === 'completed' && !['confirmed', 'pending'].includes(booking.status)) {
    throw new ApplicationError('Only active booking can be completed', 400);
  }
  if (status === 'cancelled' && booking.status === 'completed') {
    throw new ApplicationError('Completed booking cannot be cancelled', 400);
  }

  booking.status = status;
  if (status === 'completed') {
    booking.fulfilledAt = new Date();
  }
  if (status === 'cancelled') {
    booking.cancellationReason = reason || 'Cancelled by operations';
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user._id;
  }
  await booking.save();
  await websocketService.broadcastToHotel(String(actorHotelId), 'hotel-service-booking:updated', { bookingId: booking._id, status: booking.status }).catch(err => logger.warn('WebSocket broadcast failed for hotel-service-booking:updated:', err.message));

  res.json({ status: 'success', data: booking });
});

export const getServiceAnalyticsSummary = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const match = { hotelId: new mongoose.Types.ObjectId(String(actorHotelId)), createdAt: { $gte: from, $lte: to } };

  const [kpis, topServices, topTypes] = await Promise.all([
    ServiceBooking.aggregate([
      { $match: match },
      { $group: { _id: null, totalBookings: { $sum: 1 }, totalRevenue: { $sum: '$totalAmount' }, completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, cancelledBookings: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }
    ]),
    ServiceBooking.aggregate([
      { $match: match },
      { $group: { _id: '$serviceId', bookings: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'hotelservices', localField: '_id', foreignField: '_id', as: 'service' } },
      { $project: { _id: 1, bookings: 1, revenue: 1, serviceName: { $ifNull: [{ $arrayElemAt: ['$service.name', 0] }, 'Unknown Service'] } } }
    ]),
    ServiceBooking.aggregate([
      { $match: match },
      { $lookup: { from: 'hotelservices', localField: 'serviceId', foreignField: '_id', as: 'service' } },
      { $project: { totalAmount: 1, serviceType: { $ifNull: [{ $arrayElemAt: ['$service.type', 0] }, 'unknown'] } } },
      { $group: { _id: '$serviceType', bookings: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { revenue: -1 } }
    ])
  ]);

  const summary = kpis[0] || { totalBookings: 0, totalRevenue: 0, completedBookings: 0, cancelledBookings: 0 };
  const conversionRate = summary.totalBookings > 0 ? (summary.completedBookings / summary.totalBookings) * 100 : 0;
  const cancellationRate = summary.totalBookings > 0 ? (summary.cancelledBookings / summary.totalBookings) * 100 : 0;

  res.json({
    status: 'success',
    data: {
      range: { from, to },
      summary: {
        ...summary,
        conversionRate: Math.round(conversionRate * 10) / 10,
        cancellationRate: Math.round(cancellationRate * 10) / 10
      },
      topServices,
      topTypes
    }
  });
});

export const exportServiceAnalyticsCsv = catchAsync(async (req, res) => {
  const actorHotelId = resolveActorHotelId(req);
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const rows = await ServiceBooking.find({ hotelId: actorHotelId, createdAt: { $gte: from, $lte: to } })
    .populate('serviceId', 'name type')
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .lean()
    .limit(5000);
  const header = 'bookingId,serviceName,serviceType,guestName,guestEmail,status,bookingDate,totalAmount,currency,createdAt';
  const lines = rows.map((r) => [
    r._id,
    `"${(r.serviceId?.name || '').replace(/"/g, '""')}"`,
    r.serviceId?.type || '',
    `"${(r.userId?.name || '').replace(/"/g, '""')}"`,
    r.userId?.email || '',
    r.status || '',
    r.bookingDate ? new Date(r.bookingDate).toISOString() : '',
    r.totalAmount ?? 0,
    r.currency || 'INR',
    r.createdAt ? new Date(r.createdAt).toISOString() : ''
  ].join(','));
  const csv = [header, ...lines].join('\n');
  logger.info('Service analytics CSV exported', { hotelId: String(actorHotelId), rowCount: rows.length });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=\"service-analytics-${Date.now()}.csv\"`);
  res.status(200).send(csv);
});
