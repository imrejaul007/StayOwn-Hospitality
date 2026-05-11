import { ApplicationError } from './errorHandler.js';

/**
 * Role-based authorization middleware.
 * Requires authenticate() to have run first (req.user must be set).
 *
 * @param {string|string[]} roles - A single role string or array of allowed roles.
 */
export const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApplicationError('Authentication required', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApplicationError(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
          403
        )
      );
    }
    next();
  };
};

/**
 * Permission-based authorization middleware.
 * Checks req.user.permissions array (if present) for the given permission string.
 * Falls back to role-level checks when no fine-grained permissions are stored.
 *
 * @param {string} permission - Permission key to check (e.g. 'bookings:read').
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApplicationError('Authentication required', 401));
    }
    // If the user model carries explicit permissions, check those.
    if (Array.isArray(req.user.permissions) && req.user.permissions.length > 0) {
      if (!req.user.permissions.includes(permission)) {
        return next(
          new ApplicationError(
            `Access denied. Required permission: ${permission}`,
            403
          )
        );
      }
      return next();
    }
    // No fine-grained permissions stored — admins pass, everyone else is denied.
    if (req.user.role !== 'admin') {
      return next(
        new ApplicationError(
          `Access denied. Required permission: ${permission}`,
          403
        )
      );
    }
    next();
  };
};

export default {
  requireRole,
  requirePermission
};
