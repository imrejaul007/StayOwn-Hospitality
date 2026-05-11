import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware to validate user roles
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware function
 */
export const validateRoles = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        throw new ApiError(401, 'Authentication required');
      }

      // Check if user has required role
      if (!allowedRoles.includes(req.user.role)) {
        throw new ApiError(403, `Access denied. Required roles: ${allowedRoles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = validateRoles(['admin']);

/**
 * Middleware to check if user is admin or manager
 */
export const requireAdminOrManager = validateRoles(['admin', 'manager']);

/**
 * Middleware to check if user is admin, manager, or staff
 */
export const requireStaffOrAbove = validateRoles(['admin', 'manager', 'staff']);

/**
 * Middleware to check hotel ownership
 * Ensures user can only access data from their own hotel.
 *
 * SECURITY NOTE: Admin role is NOT given a blanket bypass here. An admin can
 * only access hotels that are in their `hotelId` / `properties` / `multiPropertyAccess`
 * list. The full cross-property check is handled by `ensurePropertyAccess` middleware.
 * This middleware is a lightweight quick-check; use `ensurePropertyAccess` for
 * comprehensive multi-property validation.
 */
export const validateHotelAccess = (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const userHotelId = req.user.hotelId;

    // If no hotelId param, nothing to check — delegate to controller.
    if (!hotelId) {
      return next();
    }

    // If user has no hotelId association, deny access to any specific hotel route.
    if (!userHotelId) {
      throw new ApiError(403, 'Access denied. Your account is not associated with a hotel');
    }

    // All roles — including admin — are tenant-scoped. A user can only access a
    // hotel that matches their primary hotelId. For multi-property admin access use
    // ensurePropertyAccess which validates the full properties/multiPropertyAccess list.
    if (hotelId !== userHotelId.toString()) {
      throw new ApiError(403, 'Access denied. You can only access data from your own hotel');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate resource ownership
 * Ensures user can only modify resources they own or have permission to modify
 */
export const validateResourceOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    try {
      const resourceUserId = req.body[resourceUserIdField] || req.params[resourceUserIdField];
      const currentUserId = req.user._id || req.user.id;

      // Admin can modify any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Manager can modify resources in their hotel
      if (req.user.role === 'manager' && req.user.hotelId) {
        return next();
      }

      // User can only modify their own resources
      if (resourceUserId && resourceUserId !== currentUserId.toString()) {
        throw new ApiError(403, 'Access denied. You can only modify your own resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default {
  validateRoles,
  requireAdmin,
  requireAdminOrManager,
  requireStaffOrAbove,
  validateHotelAccess,
  validateResourceOwnership
};