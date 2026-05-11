import logger from '../utils/logger.js';
import { createAndDeliverToHotelOps } from './inAppNotificationDeliveryService.js';

/**
 * Hotel operational alerts for admin, manager, and front desk (in-app + real-time).
 */
class DashboardUpdateService {
  /**
   * Notify operations when a new booking is created
   */
  async notifyNewBooking(booking, user) {
    try {
      await createAndDeliverToHotelOps(booking.hotelId, {
        title: 'New Booking Created',
        message: `${user?.name || 'Guest'} created booking ${booking.bookingNumber || ''} (${booking.nights || 0} nights)`,
        type: 'booking_created',
        priority: 'medium',
        metadata: {
          category: 'booking',
          bookingId: booking._id,
          guestId: user?._id,
          amount: booking.totalAmount,
          currency: booking.currency
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      logger.info(`Ops notifications sent for new booking: ${booking.bookingNumber}`);
    } catch (error) {
      logger.error('Failed to notify ops of new booking:', error);
    }
  }

  /**
   * Notify operations when booking payment status changes
   * @param {object} booking
   * @param {string} oldPaymentStatus
   * @param {string} newPaymentStatus
   * @param {object} actorUser — req.user (staff/admin performing update)
   */
  async notifyPaymentUpdate(booking, oldPaymentStatus, newPaymentStatus, actorUser) {
    try {
      if (oldPaymentStatus === newPaymentStatus) return;

      const statusMessage = {
        paid: 'completed payment',
        pending: 'has payment pending',
        failed: 'payment failed',
        refunded: 'received refund'
      };

      const actorName = actorUser?.name || 'Staff';

      await createAndDeliverToHotelOps(booking.hotelId, {
        title: 'Payment Status Updated',
        message: `${actorName} — ${statusMessage[newPaymentStatus] || 'updated payment'} for booking ${booking.bookingNumber}`,
        type: 'payment_update',
        priority: newPaymentStatus === 'paid' ? 'high' : 'medium',
        metadata: {
          category: 'payment',
          bookingId: booking._id,
          guestId: booking.userId,
          amount: booking.totalAmount,
          currency: booking.currency,
          oldStatus: oldPaymentStatus,
          newStatus: newPaymentStatus
        }
      });

      logger.info(
        `Ops notifications sent for payment update: ${booking.bookingNumber} ${oldPaymentStatus} -> ${newPaymentStatus}`
      );
    } catch (error) {
      logger.error('Failed to notify ops of payment update:', error);
    }
  }

  /**
   * Notify operations when booking is cancelled
   */
  async notifyBookingCancellation(booking, user, reason) {
    try {
      await createAndDeliverToHotelOps(booking.hotelId, {
        title: 'Booking Cancelled',
        message: `${user?.name || 'User'} cancelled booking ${booking.bookingNumber}${reason ? `: ${reason}` : ''}`,
        type: 'booking_cancelled',
        priority: 'high',
        metadata: {
          category: 'booking',
          bookingId: booking._id,
          guestId: user?._id,
          amount: booking.totalAmount,
          currency: booking.currency,
          cancellationReason: reason
        }
      });

      logger.info(`Ops notifications sent for booking cancellation: ${booking.bookingNumber}`);
    } catch (error) {
      logger.error('Failed to notify ops of booking cancellation:', error);
    }
  }

  /**
   * Notify operations when a new guest registers
   */
  async notifyNewUserRegistration(user, hotelId) {
    try {
      await createAndDeliverToHotelOps(hotelId, {
        title: 'New Guest Registration',
        message: `${user.name} (${user.email}) registered`,
        type: 'user_registration',
        priority: 'low',
        metadata: {
          category: 'user',
          guestId: user._id,
          guestEmail: user.email,
          loyaltyTier: user.loyalty?.tier || 'bronze'
        }
      });

      logger.info(`Ops notifications sent for new user registration: ${user.email}`);
    } catch (error) {
      logger.error('Failed to notify ops of new user registration:', error);
    }
  }

  /**
   * Notify operations when guest submits a service request
   */
  async notifyServiceRequest(serviceRequest, user) {
    try {
      await createAndDeliverToHotelOps(serviceRequest.hotelId, {
        title: 'New Service Request',
        message: `${user.name} requested ${serviceRequest.serviceType} service`,
        type: 'service_request',
        priority: serviceRequest.priority === 'urgent' ? 'high' : 'medium',
        metadata: {
          category: 'service',
          serviceRequestId: serviceRequest._id,
          guestId: user._id,
          serviceType: serviceRequest.serviceType,
          priority: serviceRequest.priority
        }
      });

      logger.info(`Ops notifications sent for service request: ${serviceRequest._id}`);
    } catch (error) {
      logger.error('Failed to notify ops of service request:', error);
    }
  }

  /**
   * Notify operations when a guest leaves a review
   */
  async notifyNewReview(review, user) {
    try {
      const priority = review.rating <= 2 ? 'high' : review.rating >= 4 ? 'medium' : 'low';

      await createAndDeliverToHotelOps(review.hotelId, {
        title: `New ${review.rating}-Star Review`,
        message: `${user.name} left a ${review.rating}-star review: "${review.title}"`,
        type: 'review_created',
        priority,
        metadata: {
          category: 'review',
          reviewId: review._id,
          guestId: user._id,
          rating: review.rating,
          title: review.title
        }
      });

      logger.info(`Ops notifications sent for new review: ${review._id} (${review.rating} stars)`);
    } catch (error) {
      logger.error('Failed to notify ops of new review:', error);
    }
  }

  /**
   * Log notable user activity for operations (low noise)
   */
  async logUserActivity(user, action, details = {}) {
    try {
      if (!details.hotelId) {
        logger.debug('logUserActivity skipped: no hotelId', { action });
        return;
      }

      await createAndDeliverToHotelOps(details.hotelId, {
        title: 'User Activity',
        message: `${user.name} ${action}`,
        type: 'user_activity',
        priority: 'low',
        metadata: {
          category: 'activity',
          guestId: user._id,
          action,
          details,
          timestamp: new Date()
        }
      });

      logger.info(`User activity logged: ${user.email} ${action}`);
    } catch (error) {
      logger.error('Failed to log user activity notification:', error);
    }
  }

  /**
   * Nudge operational clients that dashboard aggregates may have changed
   */
  async triggerDashboardRefresh(hotelId, dataType = 'all') {
    try {
      logger.info(`Dashboard refresh triggered for hotel ${hotelId}, data type: ${dataType}`);

      await createAndDeliverToHotelOps(hotelId, {
        title: 'Data Updated',
        message: `Dashboard data updated (${dataType})`,
        type: 'data_refresh',
        priority: 'low',
        metadata: {
          category: 'system',
          dataType,
          timestamp: new Date()
        },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
    } catch (error) {
      logger.error('Failed to trigger dashboard refresh notifications:', error);
    }
  }
}

export const dashboardUpdateService = new DashboardUpdateService();
