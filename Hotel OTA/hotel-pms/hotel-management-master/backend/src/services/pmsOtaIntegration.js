/**
 * PMS → OTA Integration Service
 *
 * High-level wrapper around otaWebhookSender for use in PMS controllers.
 * Handles all 8 event types and provides a clean API for emitting events.
 *
 * Usage:
 *   import pmsOtaIntegration from './services/pmsOtaIntegration.js';
 *   await pmsOtaIntegration.emitBookingConfirmed(hotel, booking, guest);
 */

import logger from '../utils/logger.js';
import otaWebhookSender, { OTA_WEBHOOK_EVENTS } from './otaWebhookSender.js';

/**
 * Check if OTA integration is enabled for a hotel
 */
function isOtaEnabled(hotel) {
  if (!hotel) return false;
  // Check if hotel has OTA connection configured
  return !!(hotel.otaConnections?.rezOta?.isEnabled ||
            hotel.rezOtaHotelId ||
            process.env.HOTEL_OTA_WEBHOOK_URL);
}

/**
 * Get OTA hotel ID from hotel object
 */
function getOtaHotelId(hotel) {
  return hotel?.otaConnections?.rezOta?.hotelId ||
         hotel?.rezOtaHotelId ||
         hotel?._id?.toString();
}

/**
 * PMS → OTA Integration Service
 *
 * Provides a high-level API for controllers to emit OTA webhook events.
 * Handles all 8 event types with proper error handling and logging.
 */
class PMSOTAIntegration {
  constructor() {
    this.sender = otaWebhookSender;
    this.enabled = this.sender.enabled;
  }

  /**
   * Emit booking_confirmed event to OTA
   *
   * Call this after a booking is confirmed in PMS
   *
   * @param {Object} hotel - Hotel document with otaConnections.rezOta.hotelId
   * @param {Object} booking - Booking document
   * @param {Object} guest - Guest/User document (optional)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitBookingConfirmed(hotel, booking, guest = null) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping booking_confirmed');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping booking_confirmed');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      logger.info('[PMS→OTA] Emitting booking_confirmed', {
        hotelId: hotel._id,
        otaHotelId,
        bookingId: booking._id,
        reservationId: booking.channelReservationId,
      });

      const result = await this.sender.sendBookingConfirmed(hotel, booking, guest);

      if (result.success) {
        logger.info('[PMS→OTA] booking_confirmed emitted successfully', {
          eventId: result.eventId,
          bookingId: booking._id,
        });
      } else {
        logger.warn('[PMS→OTA] booking_confirmed failed', {
          error: result.error,
          bookingId: booking._id,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] booking_confirmed error', {
        error: error.message,
        bookingId: booking._id,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit check_in event to OTA
   *
   * Call this when a guest checks in
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} booking - Booking document
   * @param {Object} guest - Guest/User document
   * @param {Object} room - Room document (optional, for room number)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitCheckIn(hotel, booking, guest, room = null) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping check_in');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping check_in');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      logger.info('[PMS→OTA] Emitting check_in', {
        hotelId: hotel._id,
        otaHotelId,
        bookingId: booking._id,
        roomNumber: room?.roomNumber,
      });

      const result = await this.sender.sendCheckIn(hotel, booking, guest, room);

      if (result.success) {
        logger.info('[PMS→OTA] check_in emitted successfully', {
          eventId: result.eventId,
          bookingId: booking._id,
        });
      } else {
        logger.warn('[PMS→OTA] check_in failed', {
          error: result.error,
          bookingId: booking._id,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] check_in error', {
        error: error.message,
        bookingId: booking._id,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit check_out event to OTA (awards brand coins)
   *
   * Call this when a guest checks out
   * The OTA will award brand coins based on booking value
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} booking - Booking document
   * @param {Object} guest - Guest/User document
   * @param {Object} room - Room document (optional)
   * @param {number} bookingValuePaise - Total booking value in paise
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitCheckOut(hotel, booking, guest, room = null, bookingValuePaise = null) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping check_out');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping check_out');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);

      // Calculate booking value in paise if not provided
      const valueInPaise = bookingValuePaise ||
        Math.round((booking.totalAmount || 0) * 100);

      logger.info('[PMS→OTA] Emitting check_out', {
        hotelId: hotel._id,
        otaHotelId,
        bookingId: booking._id,
        roomNumber: room?.roomNumber,
        bookingValuePaise: valueInPaise,
      });

      const result = await this.sender.sendCheckOut(
        hotel,
        booking,
        guest,
        room,
        valueInPaise
      );

      if (result.success) {
        logger.info('[PMS→OTA] check_out emitted successfully', {
          eventId: result.eventId,
          bookingId: booking._id,
        });
      } else {
        logger.warn('[PMS→OTA] check_out failed', {
          error: result.error,
          bookingId: booking._id,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] check_out error', {
        error: error.message,
        bookingId: booking._id,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit room_status_change event to OTA
   *
   * Call this when a room's status changes (e.g., dirty → clean)
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} room - Room document
   * @param {string} previousStatus - Previous room status
   * @param {string} newStatus - New room status
   * @param {Object} changedBy - Staff who made the change (optional)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitRoomStatusChange(hotel, room, previousStatus, newStatus, changedBy = null) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping room_status_change');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping room_status_change');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      logger.info('[PMS→OTA] Emitting room_status_change', {
        hotelId: hotel._id,
        otaHotelId,
        roomNumber: room.roomNumber,
        previousStatus,
        newStatus,
      });

      const result = await this.sender.sendRoomStatusChange(
        hotel,
        room,
        previousStatus,
        newStatus,
        changedBy
      );

      if (result.success) {
        logger.info('[PMS→OTA] room_status_change emitted successfully', {
          eventId: result.eventId,
          roomNumber: room.roomNumber,
        });
      } else {
        logger.warn('[PMS→OTA] room_status_change failed', {
          error: result.error,
          roomNumber: room.roomNumber,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] room_status_change error', {
        error: error.message,
        roomNumber: room.roomNumber,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit guest_data_updated event to OTA
   *
   * Call this when guest data or loyalty status changes
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} guest - Guest/User document
   * @param {string[]} updatedFields - List of fields that were updated
   * @param {Object} preferences - Guest preferences (optional)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitGuestDataUpdated(hotel, guest, updatedFields = [], preferences = null) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping guest_data_updated');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping guest_data_updated');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      logger.info('[PMS→OTA] Emitting guest_data_updated', {
        hotelId: hotel._id,
        otaHotelId,
        guestId: guest._id,
        guestEmail: guest.email,
        updatedFields,
      });

      const result = await this.sender.sendGuestDataUpdated(
        hotel,
        guest,
        updatedFields,
        preferences
      );

      if (result.success) {
        logger.info('[PMS→OTA] guest_data_updated emitted successfully', {
          eventId: result.eventId,
          guestId: guest._id,
        });
      } else {
        logger.warn('[PMS→OTA] guest_data_updated failed', {
          error: result.error,
          guestId: guest._id,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] guest_data_updated error', {
        error: error.message,
        guestId: guest._id,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit pricing_changed event to OTA
   *
   * Call this when room rates change
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} roomType - Room type document
   * @param {Date|string} date - Date for the rate change
   * @param {number} previousRate - Previous rate
   * @param {number} newRate - New rate
   * @param {number} previousAvailability - Previous availability
   * @param {number} newAvailability - New availability
   * @param {string} reason - Reason for the change (optional)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitPricingChanged(
    hotel,
    roomType,
    date,
    previousRate,
    newRate,
    previousAvailability = null,
    newAvailability = null,
    reason = null
  ) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping pricing_changed');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping pricing_changed');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      const dateStr = date instanceof Date
        ? date.toISOString().split('T')[0]
        : date;

      logger.info('[PMS→OTA] Emitting pricing_changed', {
        hotelId: hotel._id,
        otaHotelId,
        roomTypeId: roomType._id,
        roomTypeName: roomType.name,
        date: dateStr,
        previousRate,
        newRate,
      });

      const result = await this.sender.sendPricingChanged(
        hotel,
        roomType,
        date,
        previousRate,
        newRate,
        previousAvailability,
        newAvailability,
        reason
      );

      if (result.success) {
        logger.info('[PMS→OTA] pricing_changed emitted successfully', {
          eventId: result.eventId,
          roomTypeId: roomType._id,
        });
      } else {
        logger.warn('[PMS→OTA] pricing_changed failed', {
          error: result.error,
          roomTypeId: roomType._id,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] pricing_changed error', {
        error: error.message,
        roomTypeId: roomType._id,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit housekeeping_status event to OTA
   *
   * Call this when housekeeping status changes for a room
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} room - Room document
   * @param {string} previousStatus - Previous HK status
   * @param {string} newStatus - New HK status
   * @param {Object} assignedTo - Staff assigned (optional)
   * @param {string} notes - Notes (optional)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitHousekeepingStatus(
    hotel,
    room,
    previousStatus,
    newStatus,
    assignedTo = null,
    notes = null
  ) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping housekeeping_status');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping housekeeping_status');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      logger.info('[PMS→OTA] Emitting housekeeping_status', {
        hotelId: hotel._id,
        otaHotelId,
        roomNumber: room.roomNumber,
        previousStatus,
        newStatus,
      });

      const result = await this.sender.sendHousekeepingStatus(
        hotel,
        room,
        previousStatus,
        newStatus,
        assignedTo,
        notes
      );

      if (result.success) {
        logger.info('[PMS→OTA] housekeeping_status emitted successfully', {
          eventId: result.eventId,
          roomNumber: room.roomNumber,
        });
      } else {
        logger.warn('[PMS→OTA] housekeeping_status failed', {
          error: result.error,
          roomNumber: room.roomNumber,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] housekeeping_status error', {
        error: error.message,
        roomNumber: room.roomNumber,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit inventory_updated event to OTA
   *
   * Call this when room availability changes
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} roomType - Room type document
   * @param {Date|string} date - Date for the inventory change
   * @param {number} previousAvailable - Previous available rooms
   * @param {number} newAvailable - New available rooms
   * @param {number} totalRooms - Total rooms for this type
   * @param {number} ratePaise - Current rate in paise (optional)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitInventoryUpdated(
    hotel,
    roomType,
    date,
    previousAvailable,
    newAvailable,
    totalRooms = null,
    ratePaise = null
  ) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping inventory_updated');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping inventory_updated');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      logger.info('[PMS→OTA] Emitting inventory_updated', {
        hotelId: hotel._id,
        otaHotelId,
        roomTypeId: roomType._id,
        roomTypeName: roomType.name,
        date,
        previousAvailable,
        newAvailable,
        totalRooms,
      });

      const result = await this.sender.sendInventoryUpdated(
        hotel,
        roomType,
        date,
        previousAvailable,
        newAvailable,
        totalRooms,
        ratePaise
      );

      if (result.success) {
        logger.info('[PMS→OTA] inventory_updated emitted successfully', {
          eventId: result.eventId,
          roomTypeId: roomType._id,
        });
      } else {
        logger.warn('[PMS→OTA] inventory_updated failed', {
          error: result.error,
          roomTypeId: roomType._id,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] inventory_updated error', {
        error: error.message,
        roomTypeId: roomType._id,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit reservation_cancelled event to OTA
   *
   * Call this when a reservation is cancelled
   *
   * @param {Object} hotel - Hotel document
   * @param {Object} booking - Booking document
   * @param {Object} guest - Guest/User document (optional)
   * @param {string} cancellationReason - Reason for cancellation (optional)
   * @param {number} refundAmount - Refund amount if applicable (optional)
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emitReservationCancelled(
    hotel,
    booking,
    guest = null,
    cancellationReason = null,
    refundAmount = null
  ) {
    if (!this.enabled) {
      logger.debug('[PMS→OTA] Integration disabled, skipping reservation_cancelled');
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      logger.debug('[PMS→OTA] OTA not enabled for hotel, skipping reservation_cancelled');
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      logger.info('[PMS→OTA] Emitting reservation_cancelled', {
        hotelId: hotel._id,
        otaHotelId,
        bookingId: booking._id,
        reservationId: booking.channelReservationId,
        cancellationReason,
      });

      const result = await this.sender.sendReservationCancelled(
        hotel,
        booking,
        guest,
        cancellationReason,
        refundAmount
      );

      if (result.success) {
        logger.info('[PMS→OTA] reservation_cancelled emitted successfully', {
          eventId: result.eventId,
          bookingId: booking._id,
        });
      } else {
        logger.warn('[PMS→OTA] reservation_cancelled failed', {
          error: result.error,
          bookingId: booking._id,
        });
      }

      return result;
    } catch (error) {
      logger.error('[PMS→OTA] reservation_cancelled error', {
        error: error.message,
        bookingId: booking._id,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Emit a raw event (advanced usage)
   *
   * For events not covered by the typed methods
   *
   * @param {string} eventType - Event type from OTA_WEBHOOK_EVENTS
   * @param {Object} hotel - Hotel document
   * @param {Object} data - Event-specific data
   * @returns {Promise<{success: boolean, eventId?: string, error?: string}>}
   */
  async emit(eventType, hotel, data) {
    if (!this.enabled) {
      return { success: false, error: 'Integration disabled' };
    }

    if (!isOtaEnabled(hotel)) {
      return { success: false, error: 'OTA not enabled for hotel' };
    }

    try {
      const otaHotelId = getOtaHotelId(hotel);
      return await this.sender.send(eventType, hotel._id, otaHotelId, data);
    } catch (error) {
      logger.error('[PMS→OTA] emit error', {
        error: error.message,
        eventType,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if integration is configured and ready
   *
   * @returns {{configured: boolean, reason?: string}}
   */
  getStatus() {
    return {
      configured: this.enabled,
      reason: this.enabled ? undefined : 'HOTEL_OTA_WEBHOOK_URL or REZ_OTA_WEBHOOK_SECRET not set',
    };
  }
}

// Create singleton instance
const pmsOtaIntegration = new PMSOTAIntegration();

export default pmsOtaIntegration;
export { PMSOTAIntegration, OTA_WEBHOOK_EVENTS };
