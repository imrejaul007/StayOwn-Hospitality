import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

const sanitizeValue = (value) => {
  if (value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const buildSourceDetails = (req) => ({
  apiEndpoint: req?.originalUrl || req?.url,
  userAgent: req?.headers?.['user-agent'],
  ipAddress: req?.ip
});

const buildBookingSnapshot = (booking = {}) => ({
  status: sanitizeValue(booking.status),
  paymentStatus: sanitizeValue(booking.paymentStatus),
  totalAmount: sanitizeValue(booking.totalAmount),
  checkIn: sanitizeValue(booking.checkIn),
  checkOut: sanitizeValue(booking.checkOut),
  roomCount: Array.isArray(booking.rooms) ? booking.rooms.length : 0,
  settlementStatus: sanitizeValue(booking.settlementTracking?.status),
  cancellationReason: sanitizeValue(booking.cancellationReason)
});

const bookingAuditService = {
  async logBookingMutation({
    booking,
    changeType = 'update',
    user,
    req,
    oldValues = {},
    newValues = {},
    metadata = {}
  }) {
    if (!booking?._id || !booking?.hotelId) {
      return;
    }

    try {
      await AuditLog.logChange({
        hotelId: booking.hotelId?._id || booking.hotelId,
        tableName: 'Booking',
        recordId: booking._id,
        changeType,
        oldValues,
        newValues,
        userId: user?._id,
        userEmail: user?.email,
        userRole: user?.role,
        source: 'api',
        sourceDetails: buildSourceDetails(req),
        bookingDetails: {
          bookingNumber: booking.bookingNumber,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          roomType: booking.roomType,
          totalAmount: booking.totalAmount,
          source: booking.source
        },
        metadata
      });
    } catch (error) {
      logger.warn('Failed to persist booking audit log', {
        bookingId: booking._id,
        changeType,
        error: error.message
      });
    }
  },

  buildSnapshot(booking) {
    return buildBookingSnapshot(booking);
  }
};

export default bookingAuditService;
