import mongoose from 'mongoose';
import { ApplicationError } from './errorHandler.js';
import logger from '../utils/logger.js';

/**
 * IDOR (Insecure Direct Object Reference) Protection Middleware
 *
 * Ensures that any resource accessed by ID belongs to the authenticated user's
 * hotel context (hotelId), preventing cross-tenant data access.
 *
 * Usage:
 *   router.get('/:id', verifyHotelOwnership('Invoice'), controller.getInvoice);
 *   router.put('/:id', verifyHotelOwnership('Booking', 'bookingId'), controller.updateBooking);
 */

/**
 * Factory: creates middleware that verifies a document belongs to the user's hotel.
 *
 * @param {string} modelName - Mongoose model name (e.g., 'Invoice', 'Booking')
 * @param {string} paramName - The request param name containing the document ID (default: 'id')
 * @param {string} hotelField - The field on the document that holds the hotelId (default: 'hotelId')
 * @returns Express middleware
 */
export function verifyHotelOwnership(modelName, paramName = 'id', hotelField = 'hotelId') {
  return async (req, res, next) => {
    try {
      const documentId = req.params[paramName];
      if (!documentId) return next();

      // Validate it's a valid ObjectId to prevent NoSQL injection
      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        throw new ApplicationError('Invalid resource ID format', 400);
      }

      const userHotelId = req.user?.hotelId;
      if (!userHotelId) {
        // If no hotelId on user, skip (admin users may not have one)
        if (req.user?.role === 'admin') return next();
        throw new ApplicationError('Hotel context required', 403);
      }

      const Model = mongoose.model(modelName);
      const document = await Model.findById(documentId).select(hotelField).lean();

      if (!document) {
        throw new ApplicationError(`${modelName} not found`, 404);
      }

      const docHotelId = document[hotelField]?.toString();
      const reqHotelId = userHotelId.toString();

      if (docHotelId && docHotelId !== reqHotelId) {
        logger.warn('IDOR attempt detected', {
          userId: req.user?.id,
          userRole: req.user?.role,
          userHotelId: reqHotelId,
          documentId,
          documentHotelId: docHotelId,
          model: modelName,
          endpoint: `${req.method} ${req.originalUrl}`,
          ip: req.ip
        });
        throw new ApplicationError(`${modelName} not found`, 404);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: Ensures query parameters include hotelId filter
 * to prevent unscoped database queries that could leak cross-tenant data.
 *
 * Use on list/search endpoints.
 */
export function enforceHotelScope(req, res, next) {
  const userHotelId = req.user?.hotelId;

  // Admin users can query across hotels
  if (req.user?.role === 'admin') return next();

  if (!userHotelId) {
    return next(new ApplicationError('Hotel context required for this operation', 403));
  }

  // Inject hotelId into query params so controllers always filter by hotel
  req.query.hotelId = userHotelId.toString();

  // Also inject into body for POST/PUT operations
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    req.body.hotelId = userHotelId;
  }

  next();
}

export default {
  verifyHotelOwnership,
  enforceHotelScope
};
