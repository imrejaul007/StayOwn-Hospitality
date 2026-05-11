/**
 * Tenant Isolation Middleware
 * Ensures all database queries are scoped to the authenticated user's hotel.
 * Prevents cross-tenant data leakage in multi-property deployments.
 */

import { refToHotelIdString } from './propertyAccess.js';

/**
 * Middleware that attaches hotelId to req for downstream use.
 * Must be used AFTER authentication middleware.
 */
const ensureTenantContext = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  // Extract hotelId from authenticated user (may be ObjectId or populated hotel doc)
  const hotelId = req.user.hotelId || req.user.hotel;
  const hotelIdStr = refToHotelIdString(hotelId);

  // Guests and travel agents may book or load data for properties other than their profile hotel.
  // Never overwrite req.body / req.query hotelId for them — that breaks public booking and
  // causes ensurePropertyAccess + populate to run against the wrong tenant.
  if (req.user.role === 'guest' || req.user.role === 'travel_agent') {
    req.tenantId = hotelIdStr || null;
    return next();
  }

  if (!hotelIdStr) {
    return res.status(403).json({
      success: false,
      error: { code: 'NO_TENANT', message: 'User is not associated with any property' },
    });
  }

  // Canonical tenant id string (avoids "[object Object]" from Object.prototype.toString on plain objects)
  req.tenantId = hotelIdStr;

  // For multi-property admins, respect the client-provided hotelId on both read
  // AND write requests so they can operate across any property they manage.
  // ensurePropertyAccess (downstream) validates they actually own / are
  // assigned to the requested property — no IDOR risk.
  const isAdmin = req.user.role === 'admin';
  const hasMultiPropertyAccess =
    req.user.multiPropertyAccess?.enabled === true ||
    (Array.isArray(req.user.properties) && req.user.properties.length > 1);

  if (isAdmin && hasMultiPropertyAccess) {
    const isReadRequest = req.method === 'GET' || req.method === 'HEAD';

    if (isReadRequest) {
      const clientQueryHotelId = refToHotelIdString(req.query?.hotelId);
      if (clientQueryHotelId) {
        // Keep the client-provided hotelId — ensurePropertyAccess validates it.
        return next();
      }
    } else {
      // Write/mutation request — allow admin to specify target hotel in body or query.
      // ensurePropertyAccess will reject the request if they don't own the target hotel.
      const clientBodyHotelId = req.body && typeof req.body === 'object'
        ? refToHotelIdString(req.body.hotelId)
        : null;
      const clientQueryHotelId = refToHotelIdString(req.query?.hotelId);
      const clientHotelId = clientBodyHotelId || clientQueryHotelId;
      if (clientHotelId) {
        // Preserve client-specified hotel; ensurePropertyAccess will enforce ownership.
        req.tenantId = clientHotelId;
        return next();
      }
    }
  }

  // CRITICAL: Override any client-provided hotelId to prevent IDOR.
  // For single-property users (all roles) and multi-property admins who did not
  // explicitly specify a hotel, always scope to the user's primary hotelId.
  if (req.body && typeof req.body === 'object') {
    req.body.hotelId = hotelIdStr;
  }
  if (req.query) {
    req.query.hotelId = hotelIdStr;
  }

  next();
};

/**
 * Higher-order middleware for verifying resource ownership.
 * Ensures the requested resource belongs to the user's hotel.
 *
 * Usage: router.get('/:id', authenticate, ensureTenantContext, verifyResourceOwnership(Booking), getBooking);
 */
const verifyResourceOwnership = (Model, idParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam];
      if (!resourceId) return next();

      const resource = await Model.findById(resourceId).select('hotelId hotel').lean();
      if (!resource) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      }

      const resourceHotelId = refToHotelIdString(resource.hotelId || resource.hotel);
      const userHotelId = req.tenantId ? String(req.tenantId) : null;

      // If resource has a hotelId, it MUST match the user's tenant.
      // If resource has no hotelId, only allow access if user also has no tenant (guest).
      if (resourceHotelId) {
        if (resourceHotelId !== userHotelId) {
          return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
        }
      } else if (userHotelId) {
        // Resource has no hotelId but user is tenant-scoped — deny to prevent orphan access
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Build a tenant-scoped query filter.
 * Use in controllers: const filter = tenantFilter(req, { status: 'active' });
 */
const tenantFilter = (req, additionalFilters = {}) => {
  return {
    hotelId: req.tenantId,
    ...additionalFilters,
  };
};

/**
 * Middleware to validate that bulk operations include tenant scope.
 * Apply before any bulk update/delete endpoints.
 */
const requireTenantInBulkOps = (req, res, next) => {
  const isBulkMutation =
    req.method === 'DELETE' ||
    ((req.method === 'PUT' || req.method === 'PATCH') && req.path.includes('bulk'));
  if (isBulkMutation) {
    if (!req.body?.hotelId && !req.query?.hotelId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TENANT', message: 'Bulk operations must include hotelId filter for safety' },
      });
    }
  }
  next();
};

export {
  ensureTenantContext,
  verifyResourceOwnership,
  tenantFilter,
  requireTenantInBulkOps,
};
