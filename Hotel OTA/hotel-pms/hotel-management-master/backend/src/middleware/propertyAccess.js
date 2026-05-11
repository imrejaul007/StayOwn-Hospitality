import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import PropertyGroup from '../models/PropertyGroup.js';
import { ApplicationError } from './errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

/**
 * `User.properties` / `primaryProperty` / `hotelId` may be ObjectIds or populated hotel docs.
 * Using `.toString()` on plain objects yields "[object Object]" and breaks `$in` queries.
 * @param {unknown} ref
 * @returns {string|null}
 */
function isObjectIdInstance(ref) {
  return (
    ref instanceof mongoose.Types.ObjectId ||
    ref?.constructor?.name === 'ObjectId' ||
    ref?.constructor?.name === 'ObjectID'
  );
}

export function refToHotelIdString(ref) {
  if (ref == null) return null;
  if (typeof ref === 'string') {
    const t = ref.trim();
    if (t === '' || t === 'undefined' || t === 'null') return null;
    return mongoose.Types.ObjectId.isValid(t) ? t : null;
  }
  if (typeof ref === 'object') {
    // Must run before _id: Mongoose ObjectId defines _id getter and recursing ref._id overflows the stack
    if (isObjectIdInstance(ref)) {
      const s = ref.toString();
      return mongoose.Types.ObjectId.isValid(s) ? s : null;
    }
    if (ref._id != null) return refToHotelIdString(ref._id);
  }
  return null;
}

/**
 * Reject literal "undefined"/"null" from query strings and invalid ObjectIds (avoids CastError on Hotel.findById).
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeHotelId(raw) {
  return refToHotelIdString(raw);
}

/**
 * Property Access Middleware
 *
 * Ensures users can only access properties they own.
 * Critical for multi-property security and data isolation.
 */

/**
 * Middleware: Ensure user has access to the specified property
 *
 * Checks if hotelId exists in query, params, body, or user object and verifies ownership.
 * Should be used on all property-specific endpoints.
 *
 * @example
 * router.get('/rooms', authenticate, ensurePropertyAccess, getRooms);
 * router.post('/rooms/:hotelId', authenticate, ensurePropertyAccess, createRoom);
 */
export const ensurePropertyAccess = catchAsync(async (req, res, next) => {
  // Extract hotelId from multiple possible sources
  const rawHotelId = req.params.hotelId ||
                  req.query.hotelId ||
                  req.body.hotelId ||
                  req.user?.hotelId;
  const hotelId = normalizeHotelId(rawHotelId);

  // If no hotelId specified, deny by default for operational roles
  if (!hotelId) {
    // Allow guests and travel agents without hotelId (they access their own data filtered by userId)
    if (req.user && ['guest', 'travel_agent'].includes(req.user.role)) {
      return next();
    }
    // For operational roles, require hotelId
    return res.status(400).json({
      status: 'error',
      message: 'Property context (hotelId) is required for this operation'
    });
  }

  // Admin users can view (GET) all properties for multi-property management
  // But can only modify (POST/PUT/DELETE) properties they own/have access to
  const isReadOnlyRequest = req.method === 'GET';
  const isAdmin = req.user?.role === 'admin';

  if (isReadOnlyRequest && isAdmin) {
    // Admin read access - still verify the admin has this property in their scope
    const property = await Hotel.findById(hotelId).lean();
    if (!property) {
      logger.warn(`Property not found: hotelId=${hotelId}, user=${req.user._id}, endpoint=${req.path}`);
      throw new ApplicationError(
        `Hotel with ID ${hotelId} not found in the system.`,
        404
      );
    }

    const hotelIdStr = hotelId.toString();
    const userProperties = (req.user.properties || []).map(refToHotelIdString).filter(Boolean);
    const allowedProperties = (req.user.multiPropertyAccess?.allowedProperties || []).map(refToHotelIdString).filter(Boolean);
    const primaryProperty = refToHotelIdString(req.user.primaryProperty);
    const userHotelId = refToHotelIdString(req.user.hotelId);

    const isOwner = property.ownerId?.toString() === req.user._id.toString() ||
                    property.createdBy?.toString() === req.user._id.toString();

    const hasPropertyAccess = isOwner ||
      userProperties.includes(hotelIdStr) ||
      allowedProperties.includes(hotelIdStr) ||
      primaryProperty === hotelIdStr ||
      userHotelId === hotelIdStr;

    if (!hasPropertyAccess) {
      logger.debug(
        `Admin access denied to property: hotelId=${hotelIdStr}, user=${req.user._id}, ` +
        `owned=${isOwner}, inProperties=${userProperties.includes(hotelIdStr)}, ` +
        `inAllowed=${allowedProperties.includes(hotelIdStr)}, primary=${primaryProperty}, userHotel=${userHotelId}`
      );
      throw new ApplicationError(
        `Access denied. You do not have permission to access hotel ${hotelIdStr}. ` +
        `Admin must own the property or have it in their multi-property access list.`,
        403
      );
    }

    req.property = property;
    return next();
  }

  // Check if user owns this property OR has it in their properties array
  const property = await Hotel.findOne({
    _id: hotelId,
    $or: [
      { ownerId: req.user._id },
      { createdBy: req.user._id }
    ]
  }).lean();

  // If user owns the property, allow access
  if (property) {
    req.property = property;
    return next();
  }

  // Check if property exists at all (for multi-property users)
  const propertyExists = await Hotel.findById(hotelId).lean();

  const isHotelServicesRouter =
    typeof req.baseUrl === 'string' && req.baseUrl.includes('hotel-services');
  const isGuestOrTravelAgentPublicTenant =
    (req.user?.role === 'guest' || req.user?.role === 'travel_agent') &&
    isHotelServicesRouter;

  if (!propertyExists) {
    // Catalog / self-service: hotelId is tenant filter for the user's own rows; a default ID may
    // not exist in this DB (empty lists) — do not hard-404 before the controller.
    if (isGuestOrTravelAgentPublicTenant) {
      return next();
    }
    logger.warn(
      `Property access denied - property not found: hotelId=${hotelId}, ` +
      `user=${req.user._id}, role=${req.user.role}, method=${req.method}, path=${req.path}`
    );
    throw new ApplicationError(
      `Hotel with ID ${hotelId} not found in the system.`,
      404
    );
  }

  // Public booking / availability: guests and travel agents target a hotel from marketing flows
  // (room catalog, contact list) — not necessarily the same as User.hotelId / User.properties.
  const isBookingsRouter =
    typeof req.baseUrl === 'string' && req.baseUrl.includes('/bookings');
  const isPublicBookingOrAvailabilityPost =
    req.method === 'POST' &&
    isBookingsRouter &&
    (req.path === '/' || req.path === '/check-availability');
  if (
    isPublicBookingOrAvailabilityPost &&
    (req.user?.role === 'guest' || req.user?.role === 'travel_agent')
  ) {
    if (propertyExists.isActive === false) {
      throw new ApplicationError('This property is not accepting bookings.', 403);
    }
    req.property = propertyExists;
    return next();
  }

  // Hotel services (SPA, favorites, amenity bookings): same tenant model as public booking — any
  // active hotel is a valid scope; user rows are still filtered by userId in controllers.
  if (isGuestOrTravelAgentPublicTenant) {
    if (propertyExists.isActive === false) {
      throw new ApplicationError('This property is not accepting bookings.', 403);
    }
    req.property = propertyExists;
    return next();
  }

  // Check if user has this property in their properties array or multiPropertyAccess
  const hotelIdStr = hotelId.toString();
  const userProperties = (req.user.properties || []).map(refToHotelIdString).filter(Boolean);
  const allowedProperties = (req.user.multiPropertyAccess?.allowedProperties || []).map(refToHotelIdString).filter(Boolean);
  const primaryProperty = refToHotelIdString(req.user.primaryProperty);
  const userHotelId = refToHotelIdString(req.user.hotelId);

  const hasAccess =
    userProperties.includes(hotelIdStr) ||
    allowedProperties.includes(hotelIdStr) ||
    primaryProperty === hotelIdStr ||
    userHotelId === hotelIdStr;

  if (!hasAccess) {
    logger.debug(
      `Property access denied for non-admin user: hotelId=${hotelIdStr}, user=${req.user._id}, ` +
      `role=${req.user.role}, inProperties=${userProperties.includes(hotelIdStr)}, ` +
      `inAllowed=${allowedProperties.includes(hotelIdStr)}`
    );
    throw new ApplicationError(
      `Access denied. You do not have permission to access hotel ${hotelIdStr}.`,
      403
    );
  }

  // User has access through multi-property, attach property
  req.property = propertyExists;

  next();
});

/**
 * Middleware: Ensure user has access to the property group
 *
 * Checks if user owns the specified property group.
 * Used on property group management endpoints.
 *
 * @example
 * router.put('/property-groups/:id', authenticate, ensureGroupAccess, updateGroup);
 */
export const ensureGroupAccess = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return next();
  }

  // Check if user owns this property group
  const group = await PropertyGroup.findOne({
    _id: id,
    ownerId: req.user._id
  }).lean();

  if (!group) {
    throw new ApplicationError(
      'Access denied. You do not have permission to access this property group.',
      403
    );
  }

  // Attach group to request for use in controller
  req.propertyGroup = group;

  next();
});

/**
 * Middleware: Filter query to only user's properties
 *
 * Automatically adds property ownership filter to database queries.
 * Ensures users only see their own properties' data.
 *
 * Usage: Add to routes that should be automatically filtered
 *
 * @example
 * router.get('/bookings', authenticate, filterByUserProperties, getBookings);
 */
export const filterByUserProperties = catchAsync(async (req, res, next) => {
  // Extract hotelId from multiple possible sources
  const rawHotelId = req.params.hotelId ||
                  req.query.hotelId ||
                  req.body.hotelId;
  const hotelId = normalizeHotelId(rawHotelId);

  // If hotelId specified, verify access
  if (hotelId) {
    // First check if user owns the property
    const hasOwnership = await Hotel.exists({
      _id: hotelId,
      $or: [
        { ownerId: req.user._id },
        { createdBy: req.user._id }
      ]
    });

    if (hasOwnership) {
      return next();
    }

    // Check if user has access through multi-property
    const hotelIdStr = hotelId.toString();
    const userProperties = (req.user.properties || []).map(refToHotelIdString).filter(Boolean);
    const allowedProperties = (req.user.multiPropertyAccess?.allowedProperties || []).map(refToHotelIdString).filter(Boolean);
    const primaryProperty = refToHotelIdString(req.user.primaryProperty);
    const userHotelId = refToHotelIdString(req.user.hotelId);

    const hasAccess =
      userProperties.includes(hotelIdStr) ||
      allowedProperties.includes(hotelIdStr) ||
      primaryProperty === hotelIdStr ||
      userHotelId === hotelIdStr;

    if (!hasAccess) {
      throw new ApplicationError(
        'Access denied. You do not have permission to access this property.',
        403
      );
    }

    // User has access, allow the query
    return next();
  }

  // No hotelId specified - get all user's properties (owned + assigned)
  const ownedProperties = await Hotel.find({
    $or: [
      { ownerId: req.user._id },
      { createdBy: req.user._id }
    ]
  }).select('_id').lean().limit(1000);

  // Combine owned properties with user's assigned properties
  const ownedPropertyIds = ownedProperties.map(p => p._id.toString());
  const assignedPropertyIds = (req.user.properties || []).map(refToHotelIdString).filter(Boolean);
  const allowedPropertyIds = (req.user.multiPropertyAccess?.allowedProperties || []).map(refToHotelIdString).filter(Boolean);
  const primaryP = refToHotelIdString(req.user.primaryProperty);
  const tenantH = refToHotelIdString(req.user.hotelId);

  const allPropertyIds = [
    ...new Set([
      ...ownedPropertyIds,
      ...assignedPropertyIds,
      ...allowedPropertyIds,
      ...(primaryP ? [primaryP] : []),
      ...(tenantH ? [tenantH] : [])
    ])
  ].filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (allPropertyIds.length === 0) {
    // User has no properties, return empty results
    req.userPropertyIds = [];
    return next();
  }

  // Attach user's property IDs to request
  req.userPropertyIds = allPropertyIds;

  next();
});

/**
 * Helper: Check if user has access to specific property
 *
 * Can be called directly in controllers for custom logic.
 *
 * @param {string} userId - User ID
 * @param {string} hotelId - Property ID
 * @param {object} user - Full user object (optional, for multi-property check)
 * @returns {Promise<boolean>} - True if user has access
 */
export const checkPropertyAccess = async (userId, hotelId, user = null) => {
  try {
    const id = normalizeHotelId(hotelId);
    if (!id) {
      return false;
    }

    // Check ownership first
    const hasOwnership = await Hotel.exists({
      _id: id,
      $or: [
        { ownerId: userId },
        { createdBy: userId }
      ]
    });

    if (hasOwnership) {
      return true;
    }

    // If user object provided, check multi-property access
    if (user) {
      const hotelIdStr = id.toString();
      const userProperties = (user.properties || []).map(refToHotelIdString).filter(Boolean);
      const allowedProperties = (user.multiPropertyAccess?.allowedProperties || []).map(refToHotelIdString).filter(Boolean);
      const primaryProperty = refToHotelIdString(user.primaryProperty);
      const userHotelId = refToHotelIdString(user.hotelId);

      return (
        userProperties.includes(hotelIdStr) ||
        allowedProperties.includes(hotelIdStr) ||
        primaryProperty === hotelIdStr ||
        userHotelId === hotelIdStr
      );
    }

    return false;

  } catch (error) {
    logger.error('Operation failed:', error.message);
    throw error;
  }
};

/**
 * Helper: Get all property IDs owned by user
 *
 * @param {string} userId - User ID
 * @param {object} user - Full user object (optional, for multi-property)
 * @returns {Promise<string[]>} - Array of property IDs
 */
export const getUserPropertyIds = async (userId, user = null) => {
  try {
    // Get owned properties
    const ownedProperties = await Hotel.find({
      $or: [
        { ownerId: userId },
        { createdBy: userId }
      ]
    }).select('_id').lean().limit(1000);

    const ownedPropertyIds = ownedProperties
      .map((p) => refToHotelIdString(p._id))
      .filter(Boolean);

    // If user object provided, include assigned properties
    if (user) {
      const assignedPropertyIds = (user.properties || []).map(refToHotelIdString).filter(Boolean);
      const allowedPropertyIds = (user.multiPropertyAccess?.allowedProperties || []).map(refToHotelIdString).filter(Boolean);
      const primaryP = refToHotelIdString(user.primaryProperty);
      const tenantH = refToHotelIdString(user.hotelId);

      const allPropertyIds = [
        ...new Set([
          ...ownedPropertyIds,
          ...assignedPropertyIds,
          ...allowedPropertyIds,
          ...(primaryP ? [primaryP] : []),
          ...(tenantH ? [tenantH] : [])
        ])
      ].filter((id) => mongoose.Types.ObjectId.isValid(id));

      return allPropertyIds;
    }

    return ownedPropertyIds;

  } catch (error) {
    logger.error('Operation failed:', error.message);
    throw error;
  }
};

/**
 * Middleware: Ensure property belongs to group
 *
 * Used when performing group operations on properties.
 *
 * @example
 * router.post('/property-groups/:groupId/properties/:propertyId',
 *   authenticate,
 *   ensureGroupAccess,
 *   ensurePropertyInGroup,
 *   addPropertyToGroup
 * );
 */
export const ensurePropertyInGroup = catchAsync(async (req, res, next) => {
  const { groupId, propertyId } = req.params;

  if (!groupId || !propertyId) {
    return next();
  }

  // Check if property belongs to this group
  const property = await Hotel.findOne({
    _id: propertyId,
    propertyGroupId: groupId
  }).lean();

  if (!property) {
    throw new ApplicationError(
      'This property does not belong to the specified group.',
      400
    );
  }

  req.propertyInGroup = property;
  next();
});

/**
 * Verify user may operate as this hotel (multi-property switch, API tenant alignment).
 */
export async function assertUserCanAccessHotel(user, hotelId) {
  const idStr = refToHotelIdString(hotelId);
  if (!idStr) {
    throw new ApplicationError('Invalid hotel id', 400);
  }
  const property = await Hotel.findById(idStr).lean();
  if (!property) {
    throw new ApplicationError('Hotel not found', 404);
  }
  const hotelIdStr = property._id.toString();
  const uid = user._id.toString();
  const isOwner =
    property.ownerId?.toString() === uid ||
    property.createdBy?.toString() === uid;
  const userProperties = (user.properties || []).map(refToHotelIdString).filter(Boolean);
  const allowedProperties = (user.multiPropertyAccess?.allowedProperties || [])
    .map(refToHotelIdString)
    .filter(Boolean);
  const primaryProperty = refToHotelIdString(user.primaryProperty);
  const userHotelId = refToHotelIdString(user.hotelId);
  const hasAccess =
    isOwner ||
    userProperties.includes(hotelIdStr) ||
    allowedProperties.includes(hotelIdStr) ||
    primaryProperty === hotelIdStr ||
    userHotelId === hotelIdStr;
  if (!hasAccess) {
    throw new ApplicationError('Access denied to this property', 403);
  }
}

export default {
  ensurePropertyAccess,
  ensureGroupAccess,
  filterByUserProperties,
  checkPropertyAccess,
  getUserPropertyIds,
  ensurePropertyInGroup
};
