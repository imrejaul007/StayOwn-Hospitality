import { ApplicationError } from './errorHandler.js';

/**
 * Role-based access middleware factory.
 * Requires authenticate() to have run first (req.user must be populated).
 *
 * @param {string|string[]} roles - Allowed roles. If empty, all authenticated users pass.
 * @returns {Function} Express middleware.
 */
const roleMiddleware = (roles = []) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return next(new ApplicationError('Authentication required', 401));
    }

    // If no roles were specified, any authenticated user is allowed.
    if (allowedRoles.length === 0) {
      return next();
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

export default roleMiddleware;
