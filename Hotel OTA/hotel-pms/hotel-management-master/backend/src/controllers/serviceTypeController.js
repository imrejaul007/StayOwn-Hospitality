import ServiceType from '../models/ServiceType.js';
import Hotel from '../models/Hotel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

/**
 * @swagger
 * /admin/service-types:
 *   get:
 *     summary: Get all service types for a hotel
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *         description: Hotel ID (optional, will use user's hotel if not provided)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [room_service, housekeeping, maintenance, concierge, transport, spa, laundry, other]
 *         description: Filter by service type
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Return only active service types
 *     responses:
 *       200:
 *         description: Service types retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
export const getServiceTypes = asyncHandler(async (req, res) => {
  const { hotelId, type, activeOnly = 'true' } = req.query;

  // Use provided hotelId or user's hotel — resolve objects to string IDs
  const rawHotelId = hotelId || req.user.hotelId;
  const targetHotelId = (typeof rawHotelId === 'object' && rawHotelId !== null && rawHotelId._id)
    ? String(rawHotelId._id)
    : String(rawHotelId || '');

  if (!targetHotelId) {
    throw new ApiError(400, 'Hotel ID is required');
  }

  // Verify hotel exists and user has access
  const hotel = await Hotel.findById(targetHotelId).lean();
  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  // Check permissions (admin, manager, or staff of the hotel)
  if (req.user.role === 'guest' ||
      (req.user.role !== 'admin' && req.user.hotelId?.toString() !== targetHotelId.toString())) {
    throw new ApiError(403, 'Access denied');
  }

  const options = {
    activeOnly: activeOnly === 'true',
    type: type || undefined
  };

  const serviceTypes = await ServiceType.getByHotel(targetHotelId, options);

  res.status(200).json(
    new ApiResponse(200, {
      serviceTypes,
      total: serviceTypes.length,
      hotelId: targetHotelId
    }, 'Service types retrieved successfully')
  );
});

/**
 * @swagger
 * /admin/service-types/{id}:
 *   get:
 *     summary: Get a specific service type by ID
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service Type ID
 *     responses:
 *       200:
 *         description: Service type retrieved successfully
 *       404:
 *         description: Service type not found
 */
export const getServiceTypeById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const serviceType = await ServiceType.findById(id).lean();
  if (!serviceType) {
    throw new ApiError(404, 'Service type not found');
  }

  // Check permissions
  if (req.user.role === 'guest' ||
      (req.user.role !== 'admin' && req.user.hotelId?.toString() !== serviceType.hotelId.toString())) {
    throw new ApiError(403, 'Access denied');
  }

  res.status(200).json(
    new ApiResponse(200, { serviceType }, 'Service type retrieved successfully')
  );
});

/**
 * @swagger
 * /admin/service-types:
 *   post:
 *     summary: Create a new service type
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - name
 *               - basePrice
 *             properties:
 *               hotelId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [room_service, housekeeping, maintenance, concierge, transport, spa, laundry, other]
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               basePrice:
 *                 type: number
 *               estimatedDuration:
 *                 type: number
 *               slaTime:
 *                 type: number
 *               variations:
 *                 type: array
 *               templates:
 *                 type: array
 *     responses:
 *       201:
 *         description: Service type created successfully
 *       400:
 *         description: Bad request
 */
export const createServiceType = asyncHandler(async (req, res) => {
  const {
    hotelId,
    type,
    name,
    description,
    basePrice,
    estimatedDuration,
    slaTime,
    variations = [],
    templates = [],
    pricingRules = {},
    slaSettings = {},
    settings = {}
  } = req.body;

  // Use provided hotelId or user's hotel
  const targetHotelId = hotelId || req.user.hotelId;

  if (!targetHotelId) {
    throw new ApiError(400, 'Hotel ID is required');
  }

  // Check permissions (admin or manager only)
  if (req.user.role !== 'admin' &&
      (req.user.role !== 'manager' || req.user.hotelId?.toString() !== targetHotelId.toString())) {
    throw new ApiError(403, 'Access denied. Manager or admin role required');
  }

  // Verify hotel exists
  const hotel = await Hotel.findById(targetHotelId).lean();
  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  // Check if service type already exists for this hotel
  const existingServiceType = await ServiceType.findOne({
    hotelId: targetHotelId,
    type
  }).lean();

  if (existingServiceType) {
    throw new ApiError(400, `Service type '${type}' already exists for this hotel`);
  }

  // Create service type
  const serviceType = new ServiceType({
    hotelId: targetHotelId,
    type,
    name,
    description,
    basePrice,
    estimatedDuration: estimatedDuration || 30,
    slaTime: slaTime || 60,
    variations,
    templates,
    pricingRules: {
      dynamicPricing: false,
      timeBasedPricing: [],
      seasonalPricing: [],
      ...pricingRules
    },
    slaSettings: {
      responseTime: 15,
      completionTime: 60,
      escalationTime: 30,
      autoEscalation: true,
      ...slaSettings
    },
    settings: {
      requireApproval: false,
      allowGuestNotes: true,
      allowScheduling: true,
      maxAdvanceBooking: 7,
      notificationSettings: {
        emailAlerts: true,
        smsAlerts: false,
        pushNotifications: true
      },
      ...settings
    }
  });

  await serviceType.save();

  res.status(201).json(
    new ApiResponse(201, { serviceType }, 'Service type created successfully')
  );
});

/**
 * @swagger
 * /admin/service-types/{id}:
 *   put:
 *     summary: Update a service type
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service Type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Service type updated successfully
 *       404:
 *         description: Service type not found
 */
export const updateServiceType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const serviceType = await ServiceType.findById(id);
  if (!serviceType) {
    throw new ApiError(404, 'Service type not found');
  }

  // Check permissions
  if (req.user.role !== 'admin' &&
      (req.user.role !== 'manager' || req.user.hotelId?.toString() !== serviceType.hotelId.toString())) {
    throw new ApiError(403, 'Access denied. Manager or admin role required');
  }

  // Don't allow changing hotelId or type after creation
  delete updateData.hotelId;
  delete updateData.type;

  // Update service type
  Object.keys(updateData).forEach(key => {
    if (key === 'variations' || key === 'templates' || key === 'pricingRules' || key === 'slaSettings' || key === 'settings') {
      serviceType[key] = { ...serviceType[key], ...updateData[key] };
    } else {
      serviceType[key] = updateData[key];
    }
  });

  await serviceType.save();

  res.status(200).json(
    new ApiResponse(200, { serviceType }, 'Service type updated successfully')
  );
});

/**
 * @swagger
 * /admin/service-types/{id}:
 *   delete:
 *     summary: Delete a service type
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service Type ID
 *     responses:
 *       200:
 *         description: Service type deleted successfully
 *       404:
 *         description: Service type not found
 */
export const deleteServiceType = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const serviceType = await ServiceType.findById(id);
  if (!serviceType) {
    throw new ApiError(404, 'Service type not found');
  }

  // Check permissions (admin or manager only)
  if (req.user.role !== 'admin' &&
      (req.user.role !== 'manager' || req.user.hotelId?.toString() !== serviceType.hotelId.toString())) {
    throw new ApiError(403, 'Access denied. Manager or admin role required');
  }

  // Soft delete by setting isActive to false
  serviceType.isActive = false;
  await serviceType.save();

  res.status(200).json(
    new ApiResponse(200, null, 'Service type deleted successfully')
  );
});

/**
 * @swagger
 * /admin/service-types/{id}/variations:
 *   post:
 *     summary: Add a variation to a service type
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service Type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - additionalPrice
 *             properties:
 *               name:
 *                 type: string
 *               additionalPrice:
 *                 type: number
 *               description:
 *                 type: string
 *               estimatedDuration:
 *                 type: number
 *     responses:
 *       200:
 *         description: Variation added successfully
 */
export const addVariation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, additionalPrice, description, estimatedDuration } = req.body;

  const serviceType = await ServiceType.findById(id);
  if (!serviceType) {
    throw new ApiError(404, 'Service type not found');
  }

  // Check permissions
  if (req.user.role !== 'admin' &&
      (req.user.role !== 'manager' || req.user.hotelId?.toString() !== serviceType.hotelId.toString())) {
    throw new ApiError(403, 'Access denied. Manager or admin role required');
  }

  // Check if variation with same name already exists
  const existingVariation = serviceType.variations.find(v => v.name === name);
  if (existingVariation) {
    throw new ApiError(400, 'Variation with this name already exists');
  }

  // Add variation
  serviceType.variations.push({
    name,
    additionalPrice,
    description,
    estimatedDuration,
    isActive: true
  });

  await serviceType.save();

  res.status(200).json(
    new ApiResponse(200, { serviceType }, 'Variation added successfully')
  );
});

/**
 * @swagger
 * /admin/service-types/{id}/templates:
 *   post:
 *     summary: Add a template to a service type
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service Type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - totalPrice
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               totalPrice:
 *                 type: number
 *               estimatedDuration:
 *                 type: number
 *               priority:
 *                 type: number
 *     responses:
 *       200:
 *         description: Template added successfully
 */
export const addTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, services = [], totalPrice, estimatedDuration, priority = 0 } = req.body;

  const serviceType = await ServiceType.findById(id);
  if (!serviceType) {
    throw new ApiError(404, 'Service type not found');
  }

  // Check permissions
  if (req.user.role !== 'admin' &&
      (req.user.role !== 'manager' || req.user.hotelId?.toString() !== serviceType.hotelId.toString())) {
    throw new ApiError(403, 'Access denied. Manager or admin role required');
  }

  // Check if template with same name already exists
  const existingTemplate = serviceType.templates.find(t => t.name === name);
  if (existingTemplate) {
    throw new ApiError(400, 'Template with this name already exists');
  }

  // Add template
  serviceType.templates.push({
    name,
    description,
    services,
    totalPrice,
    estimatedDuration,
    priority,
    isActive: true
  });

  await serviceType.save();

  res.status(200).json(
    new ApiResponse(200, { serviceType }, 'Template added successfully')
  );
});

/**
 * @swagger
 * /admin/service-types/{type}/calculate-price:
 *   post:
 *     summary: Calculate price for a service with variations
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Service type
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hotelId:
 *                 type: string
 *               variations:
 *                 type: array
 *                 items:
 *                   type: string
 *               multiplier:
 *                 type: number
 *                 default: 1
 *     responses:
 *       200:
 *         description: Price calculated successfully
 */
export const calculatePrice = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { hotelId, variations = [], multiplier = 1 } = req.body;

  // Use provided hotelId or user's hotel
  const targetHotelId = hotelId || req.user.hotelId;

  const serviceType = await ServiceType.getByTypeAndHotel(type, targetHotelId);
  if (!serviceType) {
    throw new ApiError(404, 'Service type not found');
  }

  const calculatedPrice = serviceType.calculatePrice(variations, multiplier);

  res.status(200).json(
    new ApiResponse(200, {
      basePrice: serviceType.basePrice,
      variations: variations.map(variationName => {
        const variation = serviceType.variations.find(v => v.name === variationName && v.isActive);
        return variation ? {
          name: variation.name,
          additionalPrice: variation.additionalPrice
        } : null;
      }).filter(Boolean),
      multiplier,
      totalPrice: calculatedPrice,
      currency: serviceType.currency
    }, 'Price calculated successfully')
  );
});

/**
 * @swagger
 * /admin/service-types/stats:
 *   get:
 *     summary: Get service type statistics for a hotel
 *     tags: [Admin - Service Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *         description: Hotel ID (optional, will use user's hotel if not provided)
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
export const getServiceTypeStats = asyncHandler(async (req, res) => {
  const { hotelId } = req.query;

  // Resolve hotelId — may be an object from req.user.hotelId
  const rawHotelId = hotelId || req.user.hotelId;
  const targetHotelId = (typeof rawHotelId === 'object' && rawHotelId !== null && rawHotelId._id)
    ? String(rawHotelId._id)
    : String(rawHotelId || '');

  if (!targetHotelId) {
    throw new ApiError(400, 'Hotel ID is required');
  }

  // Check permissions
  const userHid = typeof req.user.hotelId === 'object' && req.user.hotelId?._id
    ? String(req.user.hotelId._id)
    : String(req.user.hotelId || '');
  if (req.user.role === 'guest' ||
      (req.user.role !== 'admin' && userHid !== targetHotelId)) {
    throw new ApiError(403, 'Access denied');
  }

  const serviceTypes = await ServiceType.find({ hotelId: targetHotelId, isActive: true }).lean().limit(1000);

  const stats = {
    totalServiceTypes: serviceTypes.length,
    totalRequests: serviceTypes.reduce((sum, st) => sum + (st.stats?.totalRequests || 0), 0),
    totalCompletedRequests: serviceTypes.reduce((sum, st) => sum + (st.stats?.completedRequests || 0), 0),
    averageRating: serviceTypes.length > 0
      ? serviceTypes.reduce((sum, st) => sum + (st.stats?.averageRating || 0), 0) / serviceTypes.length
      : 0,
    averageResponseTime: serviceTypes.length > 0
      ? serviceTypes.reduce((sum, st) => sum + (st.stats?.averageResponseTime || 0), 0) / serviceTypes.length
      : 0,
    averageCompletionTime: serviceTypes.length > 0
      ? serviceTypes.reduce((sum, st) => sum + (st.stats?.averageCompletionTime || 0), 0) / serviceTypes.length
      : 0,
    serviceTypeBreakdown: serviceTypes.map(st => {
      const total = st.stats?.totalRequests || 0;
      const completed = st.stats?.completedRequests || 0;
      // Compute completionRate inline since .lean() strips virtuals
      const completionRate = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0;
      return {
        type: st.type,
        name: st.name,
        totalRequests: total,
        completedRequests: completed,
        completionRate,
        averageRating: st.stats?.averageRating || 0,
        basePrice: st.basePrice
      };
    })
  };

  res.status(200).json(
    new ApiResponse(200, { stats }, 'Service type statistics retrieved successfully')
  );
});