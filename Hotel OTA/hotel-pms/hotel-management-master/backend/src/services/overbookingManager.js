import logger from '../utils/logger.js';

/**
 * Overbooking Manager
 * Handles the strategy when overbookings materialize.
 * Hotels often intentionally overbook by 5-10% to account for no-shows/cancellations.
 * When ALL rooms are occupied, this service manages the overflow.
 */
class OverbookingManager {
  constructor({ Booking, Room, RoomType, Hotel, Notification }) {
    this.Booking = Booking;
    this.Room = Room;
    this.RoomType = RoomType;
    this.Hotel = Hotel;
    this.Notification = Notification;
  }

  /**
   * Check if a hotel is overbooked for a given date range.
   */
  async checkOverbookingStatus(hotelId, checkIn, checkOut) {
    try {
      const totalRooms = await this.Room.countDocuments({ hotelId, isActive: true });

      const bookedRooms = await this.Booking.countDocuments({
        hotelId,
        status: { $in: ['confirmed', 'checked_in'] },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      });

      const overbookingRate = totalRooms > 0 ? ((bookedRooms / totalRooms) * 100).toFixed(1) : 0;
      const isOverbooked = bookedRooms > totalRooms;
      const overflowCount = Math.max(0, bookedRooms - totalRooms);

      return {
        totalRooms,
        bookedRooms,
        availableRooms: Math.max(0, totalRooms - bookedRooms),
        overbookingRate: Number(overbookingRate),
        isOverbooked,
        overflowCount,
      };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get resolution options for overbooked guests.
   */
  async getResolutionOptions(hotelId, booking) {
    try {
      const options = [];

      // Option 1: Upgrade to a higher room type (if available)
      const availableUpgrades = await this.Room.find({
        hotelId,
        status: 'available',
        roomType: { $ne: booking.roomType },
      }).populate('roomType').lean();

      if (availableUpgrades.length > 0) {
        options.push({
          type: 'upgrade',
          description: 'Complimentary room upgrade',
          rooms: availableUpgrades.slice(0, 3).map(r => ({
            roomNumber: r.roomNumber,
            roomType: r.roomType?.name,
          })),
          estimatedCost: 0, // Complimentary
        });
      }

      // Option 2: Walk the guest to a nearby partner hotel
      options.push({
        type: 'relocation',
        description: 'Relocate to partner hotel (hotel pays for the stay + transport)',
        estimatedCost: booking.totalAmount * 1.5,
        includes: ['Accommodation at partner hotel', 'Transport', 'Meal voucher'],
      });

      // Option 3: Waitlist + compensation
      options.push({
        type: 'waitlist_compensate',
        description: 'Waitlist with compensation (late check-in guests may free up rooms)',
        compensation: {
          discount: '50% off next stay',
          voucher: 'Complimentary dinner for 2',
          upgrade: 'Guaranteed upgrade on rebooked stay',
        },
      });

      return options;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Execute a resolution for an overbooked guest.
   */
  async resolveOverbooking(hotelId, bookingId, resolutionType, details = {}) {
    try {
      const booking = await this.Booking.findOne({ _id: bookingId, hotelId });
      if (!booking) throw new Error('Booking not found');

      const resolution = {
        type: resolutionType,
        resolvedAt: new Date(),
        details,
      };

      switch (resolutionType) {
        case 'upgrade': {
          const { newRoomId } = details;
          booking.room = newRoomId;
          booking.isUpgraded = true;
          booking.upgradeReason = 'overbooking_compensation';
          break;
        }
        case 'relocation': {
          booking.status = 'relocated';
          booking.relocationDetails = details;
          break;
        }
        case 'waitlist_compensate': {
          booking.isWaitlisted = true;
          booking.compensationDetails = details;
          break;
        }
        default:
          throw new Error(`Unknown resolution type: ${resolutionType}`);
      }

      booking.overbookingResolution = resolution;
      await booking.save();

      try {
        const { createAndDeliverToHotelOps } = await import('./inAppNotificationDeliveryService.js');
        await createAndDeliverToHotelOps(hotelId, {
          type: 'overbooking_resolved',
          title: `Overbooking resolved: ${resolutionType}`,
          message: `Booking ${booking.bookingNumber || bookingId} resolved via ${resolutionType}`,
          priority: 'high',
          metadata: {
            category: 'operations',
            bookingId: booking._id || bookingId,
            resolutionType
          }
        });
      } catch (notifyErr) {
        logger.warn('Overbooking ops notification failed', { error: notifyErr.message });
      }

      return { success: true, bookingId, resolution };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }
}

export { OverbookingManager };
