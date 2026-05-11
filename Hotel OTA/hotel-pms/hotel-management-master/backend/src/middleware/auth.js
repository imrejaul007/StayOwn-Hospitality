import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

export const authenticate = catchAsync(async (req, res, next) => {
  // Get token from cookies (primary) or Authorization header (API clients fallback)
  let token;
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApplicationError('You are not logged in! Please log in to get access.', 401));
  }

  // Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Check if user still exists and populate multi-property fields
  const currentUser = await User.findById(decoded.id)
    .select('+role +passwordChangedAt')
    .populate({
      path: 'properties',
      select: 'name address',
    })
    .populate({
      path: 'primaryProperty',
      select: 'name address',
    })
    .populate({
      path: 'hotelId',
      select: 'name address',
    }).lean();

  if (!currentUser) {
    return next(new ApplicationError('The user belonging to this token does no longer exist.', 401));
  }

  if (!currentUser.isActive) {
    return next(new ApplicationError('Your account has been deactivated. Please contact support.', 401));
  }

  // SECURITY: Invalidate token if password was changed after it was issued.
  // This ensures that if an admin resets a compromised account's password, all
  // existing sessions are immediately invalidated.
  if (currentUser.passwordChangedAt && decoded.iat) {
    const passwordChangedTimestamp = Math.floor(
      new Date(currentUser.passwordChangedAt).getTime() / 1000
    );
    if (decoded.iat < passwordChangedTimestamp) {
      return next(
        new ApplicationError('Password was recently changed. Please log in again.', 401)
      );
    }
  }

  // Store populated hotel as separate field for frontend consumption via /auth/me
  // Normalize hotelId back to string for all backend logic (services, queries, etc.)
  if (currentUser.hotelId && typeof currentUser.hotelId === 'object' && currentUser.hotelId._id) {
    currentUser.hotelIdPopulated = currentUser.hotelId;
    currentUser.hotelId = currentUser.hotelId._id.toString();
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
});

export const authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten the roles array in case it's nested
    const flatRoles = Array.isArray(roles[0]) ? roles[0] : roles;
    logger.debug('Authorization check', { allowedRoles: flatRoles, userRole: req.user.role });
    if (!flatRoles.includes(req.user.role)) {
      return next(new ApplicationError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

export const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id)
        .select('+role +passwordChangedAt')
        .populate({
          path: 'properties',
          select: 'name address',
        })
        .populate({
          path: 'primaryProperty',
          select: 'name address',
        })
        .populate({
          path: 'hotelId',
          select: 'name address',
        }).lean();

      if (currentUser && currentUser.isActive) {
        // Apply the same password-changed-at check as authenticate().
        // An expired token should not grant even optional access.
        if (currentUser.passwordChangedAt && decoded.iat) {
          const passwordChangedTimestamp = Math.floor(
            new Date(currentUser.passwordChangedAt).getTime() / 1000
          );
          if (decoded.iat >= passwordChangedTimestamp) {
            if (currentUser.hotelId && typeof currentUser.hotelId === 'object' && currentUser.hotelId._id) {
              currentUser.hotelIdPopulated = currentUser.hotelId;
              currentUser.hotelId = currentUser.hotelId._id.toString();
            }
            req.user = currentUser;
          }
          // else: token predates password change — treat as unauthenticated
        } else {
          if (currentUser.hotelId && typeof currentUser.hotelId === 'object' && currentUser.hotelId._id) {
            currentUser.hotelIdPopulated = currentUser.hotelId;
            currentUser.hotelId = currentUser.hotelId._id.toString();
          }
          req.user = currentUser;
        }
      }
      // If currentUser is null or inactive, silently continue without setting req.user
    } catch (error) {
      // Token is malformed/expired — silently continue without user for optional routes.
      // Do not log token content but do log that an invalid token was presented.
      logger.debug('optionalAuth: invalid or expired token presented', {
        ip: req.ip,
        path: req.path,
        errorType: error.name
      });
    }
  }

  next();
});
