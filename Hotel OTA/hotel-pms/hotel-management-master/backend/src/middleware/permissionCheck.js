import rolePermissionService from '../services/rolePermissionService.js';
import logger from '../utils/logger.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';

/**
 * Middleware to check if user has required permission(s)
 */
export function requirePermission(permission, options = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      // First try the in-memory role assignment lookup
      let hasPermission = rolePermissionService.hasPermission(
        user.id,
        permission,
        options.resource || null
      );

      // Fallback: if user not in the in-memory map, check their JWT role
      // against system role definitions directly
      if (!hasPermission && user.role) {
        const roleKey = user.role.toUpperCase().replace(/[-\s]/g, '_');
        hasPermission = rolePermissionService.hasPermissionByRole(
          roleKey,
          permission
        );
      }

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: user.id,
          userRole: user.role,
          requiredPermission: permission,
          resource: options.resource,
          endpoint: req.path,
          method: req.method
        });

        throw new ForbiddenError(`Insufficient permissions. Required: ${permission}`);
      }

      // Log permission granted for audit
      logger.debug('Permission granted', {
        userId: user.id,
        userRole: user.role,
        permission,
        resource: options.resource,
        endpoint: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user has ALL of the specified permissions
 */
export function requireAllPermissions(permissions, options = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasAllPermissions = rolePermissionService.hasAllPermissions(user.id, permissions);

      if (!hasAllPermissions) {
        // Find which permissions are missing for better error message
        const missingPermissions = permissions.filter(perm => 
          !rolePermissionService.hasPermission(user.id, perm, options.resource)
        );

        logger.warn('Multiple permissions denied', {
          userId: user.id,
          userRole: user.role,
          requiredPermissions: permissions,
          missingPermissions,
          resource: options.resource,
          endpoint: req.path,
          method: req.method
        });

        throw new ForbiddenError(`Insufficient permissions. Missing: ${missingPermissions.join(', ')}`);
      }

      logger.debug('Multiple permissions granted', {
        userId: user.id,
        userRole: user.role,
        permissions,
        resource: options.resource,
        endpoint: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user has ANY of the specified permissions
 */
export function requireAnyPermission(permissions, options = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasAnyPermission = rolePermissionService.hasAnyPermission(user.id, permissions);

      if (!hasAnyPermission) {
        logger.warn('No required permissions found', {
          userId: user.id,
          userRole: user.role,
          requiredPermissions: permissions,
          resource: options.resource,
          endpoint: req.path,
          method: req.method
        });

        throw new ForbiddenError(`Insufficient permissions. Required any of: ${permissions.join(', ')}`);
      }

      logger.debug('Permission granted (any)', {
        userId: user.id,
        userRole: user.role,
        permissions,
        resource: options.resource,
        endpoint: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check role level (hierarchical access)
 */
export function requireRoleLevel(minimumLevel) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      let userRole = rolePermissionService.getUserRole(user.id);

      // Fallback: resolve from JWT role if not in in-memory map
      if (!userRole && user.role) {
        const roleKey = user.role.toUpperCase().replace(/[-\s]/g, '_');
        const systemRole = rolePermissionService.systemRoles[roleKey];
        if (systemRole) {
          userRole = { ...systemRole, effectivePermissions: rolePermissionService.getEffectivePermissions(systemRole) };
        }
      }

      if (!userRole) {
        throw new ForbiddenError('No role assigned');
      }

      if (userRole.level < minimumLevel) {
        logger.warn('Role level insufficient', {
          userId: user.id,
          userRole: userRole.name,
          userLevel: userRole.level,
          requiredLevel: minimumLevel,
          endpoint: req.path,
          method: req.method
        });

        throw new ForbiddenError(`Insufficient role level. Required: ${minimumLevel}, Current: ${userRole.level}`);
      }

      logger.debug('Role level check passed', {
        userId: user.id,
        userRole: userRole.name,
        userLevel: userRole.level,
        requiredLevel: minimumLevel,
        endpoint: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check resource ownership for 'own' permissions
 */
export function requireResourceOwnership(resourceType, resourceIdParam = 'id') {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        throw new ForbiddenError('Resource ID not provided');
      }

      // Check if user has admin permissions to bypass ownership check
      if (rolePermissionService.hasPermission(user.id, `${resourceType}:*`)) {
        return next();
      }

      // Check ownership based on resource type
      const isOwner = await checkResourceOwnership(user.id, resourceType, resourceId);
      
      if (!isOwner) {
        logger.warn('Resource ownership check failed', {
          userId: user.id,
          resourceType,
          resourceId,
          endpoint: req.path,
          method: req.method
        });

        throw new ForbiddenError('Access denied: You can only access your own resources');
      }

      logger.debug('Resource ownership confirmed', {
        userId: user.id,
        resourceType,
        resourceId,
        endpoint: req.path,
        method: req.method
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper function to check resource ownership.
 * Performs real database lookups — no placeholders.
 */
async function checkResourceOwnership(userId, resourceType, resourceId) {
  try {
    switch (resourceType) {
      case 'booking': {
        // Dynamically import to avoid circular deps at module load time
        const { default: Booking } = await import('../models/Booking.js');
        const booking = await Booking.findById(resourceId).select('userId guestId').lean();
        if (!booking) return false;
        const ownerId = (booking.userId || booking.guestId)?.toString();
        return ownerId === userId.toString();
      }

      case 'profile':
        // User can only access their own profile
        return resourceId.toString() === userId.toString();

      case 'invoice': {
        const { default: Invoice } = await import('../models/Invoice.js');
        const invoice = await Invoice.findById(resourceId).select('userId guestId').lean();
        if (!invoice) return false;
        const invoiceOwner = (invoice.userId || invoice.guestId)?.toString();
        return invoiceOwner === userId.toString();
      }

      default:
        // Deny by default for unknown resource types — fail closed
        logger.warn('Unknown resource type in ownership check', { resourceType, resourceId, userId });
        return false;
    }
  } catch (error) {
    logger.error('Resource ownership check failed', {
      error: error.message,
      userId,
      resourceType,
      resourceId
    });
    // Fail closed: if we can't verify, deny
    return false;
  }
}

/**
 * Middleware to add user permissions to request object
 */
export function attachUserPermissions(req, res, next) {
  try {
    const user = req.user;
    if (user) {
      const userRole = rolePermissionService.getUserRole(user.id);
      req.userRole = userRole;
      req.userPermissions = userRole ? userRole.effectivePermissions : [];
    }
    next();
  } catch (error) {
    logger.error('Failed to attach user permissions', {
      error: error.message,
      userId: req.user?.id
    });
    next(); // Continue without permissions
  }
}

/**
 * Helper function to check permission programmatically
 */
export function checkPermission(userId, permission, resource = null) {
  return rolePermissionService.hasPermission(userId, permission, resource);
}

/**
 * Higher-order function for role-based route protection
 */
export function protectRoute(permissions, options = {}) {
  const middlewares = [attachUserPermissions];

  if (Array.isArray(permissions)) {
    if (options.requireAll) {
      middlewares.push(requireAllPermissions(permissions, options));
    } else {
      middlewares.push(requireAnyPermission(permissions, options));
    }
  } else if (typeof permissions === 'string') {
    middlewares.push(requirePermission(permissions, options));
  } else if (typeof permissions === 'number') {
    middlewares.push(requireRoleLevel(permissions));
  }

  return middlewares;
}

/**
 * Dynamic permission checker based on request context
 */
export function dynamicPermissionCheck(permissionResolver) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      const requiredPermission = await permissionResolver(req);
      if (!requiredPermission) {
        return next(); // No permission required
      }

      const hasPermission = rolePermissionService.hasPermission(
        user.id, 
        requiredPermission.permission,
        requiredPermission.resource
      );

      if (!hasPermission) {
        logger.warn('Dynamic permission denied', {
          userId: user.id,
          requiredPermission: requiredPermission.permission,
          resource: requiredPermission.resource,
          endpoint: req.path,
          method: req.method
        });

        throw new ForbiddenError(`Insufficient permissions. Required: ${requiredPermission.permission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default {
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireRoleLevel,
  requireResourceOwnership,
  attachUserPermissions,
  checkPermission,
  protectRoute,
  dynamicPermissionCheck
};
