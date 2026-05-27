/**
 * Habixo Notification Service
 *
 * High-level notification service that orchestrates sending notifications
 * for booking, matching, pricing, and messaging events.
 */

import { logger } from '../utils/logger';
import {
  notifyBookingConfirmed,
  notifyBookingReminder,
  notifyPriceDrop,
  notifyMatchFound,
  notifyNewMessage,
  notifyReviewRequest,
  notifyBookingCancelled,
  NotificationResult,
} from '../integrations/rez-notifications';
import { IBooking } from '../models';
import { IFlatmateProfile } from '../models';

const notificationLogger = logger.child({ service: 'HabixoNotificationService' });

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BookingDetails {
  bookingId: string;
  propertyTitle: string;
  propertyImage?: string;
  checkIn: string;
  checkOut: string;
  totalNights: number;
  totalAmount: number;
  currency?: string;
}

export interface PropertyPriceDetails {
  propertyId: string;
  propertyTitle: string;
  propertyImage?: string;
  city?: string;
  oldPrice: number;
  newPrice: number;
  currency?: string;
  discount?: number;
}

export interface MatchProfileDetails {
  profileId: string;
  userId: string;
  name: string;
  avatar?: string;
  compatibilityScore: number;
  sharedInterests: string[];
  city?: string;
}

export interface MessageDetails {
  bookingId: string;
  conversationId: string;
  senderName: string;
  senderAvatar?: string;
  messagePreview: string;
  messageType?: 'text' | 'image' | 'offer';
}

export interface ReviewRequestDetails {
  bookingId: string;
  propertyId: string;
  propertyTitle: string;
  propertyImage?: string;
  hostName?: string;
  checkInDate: string;
  checkOutDate: string;
}

// ─── Notification Service Class ─────────────────────────────────────────────────

class NotificationService {
  /**
   * Send booking confirmation notification
   * Called when a booking is successfully created
   */
  async notifyBookingConfirmed(booking: IBooking): Promise<NotificationResult> {
    try {
      const bookingDetails: BookingDetails = {
        bookingId: booking.bookingId,
        propertyTitle: booking.propertyTitle || 'Your booked property',
        propertyImage: booking.propertyImage,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        totalNights: booking.totalNights,
        totalAmount: booking.pricing.total,
        currency: booking.pricing.currency || 'INR',
      };

      const result = await notifyBookingConfirmed(booking.guestId, bookingDetails);

      notificationLogger.info(
        {
          bookingId: booking.bookingId,
          guestId: booking.guestId,
          success: result.success,
        },
        'Booking confirmation notification sent'
      );

      return result;
    } catch (error) {
      notificationLogger.error(
        { error, bookingId: booking.bookingId },
        'Failed to send booking confirmation notification'
      );
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send booking reminder notification
   * Called X days before check-in
   */
  async notifyBookingReminder(
    booking: IBooking,
    daysBefore: number
  ): Promise<NotificationResult> {
    try {
      const bookingDetails = {
        bookingId: booking.bookingId,
        propertyTitle: booking.propertyTitle || 'Your booked property',
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
      };

      const result = await notifyBookingReminder(booking.guestId, bookingDetails, daysBefore);

      notificationLogger.info(
        {
          bookingId: booking.bookingId,
          guestId: booking.guestId,
          daysBefore,
          success: result.success,
        },
        'Booking reminder notification sent'
      );

      return result;
    } catch (error) {
      notificationLogger.error(
        { error, bookingId: booking.bookingId, daysBefore },
        'Failed to send booking reminder notification'
      );
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send price drop notification
   * Called when a property price decreases for users who viewed/wishlisted it
   */
  async notifyPriceDrop(
    userId: string,
    property: PropertyPriceDetails
  ): Promise<NotificationResult> {
    try {
      const result = await notifyPriceDrop(userId, property);

      notificationLogger.info(
        {
          userId,
          propertyId: property.propertyId,
          oldPrice: property.oldPrice,
          newPrice: property.newPrice,
          success: result.success,
        },
        'Price drop notification sent'
      );

      return result;
    } catch (error) {
      notificationLogger.error(
        { error, userId, propertyId: property.propertyId },
        'Failed to send price drop notification'
      );
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send match found notification
   * Called when a compatible flatmate profile is found
   */
  async notifyMatchFound(
    userId: string,
    matchProfile: IFlatmateProfile | MatchProfileDetails
  ): Promise<NotificationResult> {
    try {
      // Handle both IFlatmateProfile and MatchProfileDetails
      const matchDetails: MatchProfileDetails =
        'profileId' in matchProfile
          ? matchProfile
          : {
              profileId: matchProfile.profileId,
              userId: matchProfile.userId,
              name: matchProfile.name || 'A potential roommate',
              avatar: matchProfile.avatar,
              compatibilityScore: matchProfile.compatibilityScore || 0,
              sharedInterests: matchProfile.sharedInterests || [],
              city: matchProfile.city,
            };

      const result = await notifyMatchFound(userId, matchDetails);

      notificationLogger.info(
        {
          userId,
          matchProfileId: matchDetails.profileId,
          compatibilityScore: matchDetails.compatibilityScore,
          success: result.success,
        },
        'Match found notification sent'
      );

      return result;
    } catch (error) {
      notificationLogger.error(
        { error, userId },
        'Failed to send match found notification'
      );
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send new message notification
   * Called when a new message is received in a booking conversation
   */
  async notifyNewMessage(
    userId: string,
    message: MessageDetails
  ): Promise<NotificationResult> {
    try {
      const result = await notifyNewMessage(userId, message);

      notificationLogger.info(
        {
          userId,
          bookingId: message.bookingId,
          conversationId: message.conversationId,
          senderName: message.senderName,
          success: result.success,
        },
        'New message notification sent'
      );

      return result;
    } catch (error) {
      notificationLogger.error(
        { error, userId, bookingId: message.bookingId },
        'Failed to send new message notification'
      );
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send review request notification
   * Called after check-out to request a review
   */
  async notifyReviewRequest(
    userId: string,
    reviewDetails: ReviewRequestDetails
  ): Promise<NotificationResult> {
    try {
      const result = await notifyReviewRequest(userId, reviewDetails);

      notificationLogger.info(
        {
          userId,
          bookingId: reviewDetails.bookingId,
          propertyId: reviewDetails.propertyId,
          success: result.success,
        },
        'Review request notification sent'
      );

      return result;
    } catch (error) {
      notificationLogger.error(
        { error, userId, bookingId: reviewDetails.bookingId },
        'Failed to send review request notification'
      );
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send booking cancellation notification
   * Called when a booking is cancelled by guest or host
   */
  async notifyBookingCancellation(
    booking: IBooking,
    cancelledBy: 'guest' | 'host',
    additionalDetails?: {
      refundAmount?: number;
      cancellationReason?: string;
    }
  ): Promise<NotificationResult> {
    try {
      const bookingDetails = {
        bookingId: booking.bookingId,
        propertyTitle: booking.propertyTitle || 'Your booked property',
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        refundAmount: additionalDetails?.refundAmount,
        currency: booking.pricing.currency || 'INR',
        cancelledBy,
        cancellationReason: additionalDetails?.cancellationReason,
      };

      // Notify the guest if cancelled by host, or the host if cancelled by guest
      const notifyUserId = cancelledBy === 'guest' ? booking.hostId : booking.guestId;

      const result = await notifyBookingCancelled(notifyUserId, bookingDetails);

      notificationLogger.info(
        {
          bookingId: booking.bookingId,
          notifyUserId,
          cancelledBy,
          success: result.success,
        },
        'Booking cancellation notification sent'
      );

      return result;
    } catch (error) {
      notificationLogger.error(
        { error, bookingId: booking.bookingId },
        'Failed to send booking cancellation notification'
      );
      return { success: false, error: String(error) };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
