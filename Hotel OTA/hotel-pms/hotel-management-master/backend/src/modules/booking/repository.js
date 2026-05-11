// @ts-check

import Booking from '../../models/Booking.js';
import Room from '../../models/Room.js';
import User from '../../models/User.js';

/** @typedef {import('../../types/contracts').BookingRepositoryContract} BookingRepositoryContract */

/** @type {BookingRepositoryContract} */
const bookingRepository = {
  async findByIdempotencyKey(idempotencyKey) {
    return Booking.findOne({ idempotencyKey }).lean();
  },

  async findActiveRoomsByIds(roomIds, hotelId) {
    return Room.find({
      _id: { $in: roomIds },
      hotelId,
      isActive: true
    }).lean().limit(1000);
  },

  async findOverlappingBookings(roomIds, checkInDate, checkOutDate, options = {}) {
    return Booking.findOverlapping(roomIds, checkInDate, checkOutDate, options);
  },

  async findBookingByIdForUpdate(bookingId) {
    return Booking.findById(bookingId);
  },

  async findUserByNameInsensitive(name) {
    return User.findOne({
      name: { $regex: new RegExp(name, 'i') }
    }).lean();
  },

  async findBookingByUserDateWindow(userId, checkInDate, checkOutDate) {
    return Booking.findOne({
      userId,
      checkIn: {
        $gte: new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000),
        $lte: new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000)
      },
      checkOut: {
        $gte: new Date(checkOutDate.getTime() - 24 * 60 * 60 * 1000),
        $lte: new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });
  },

  async findRoomById(roomId) {
    return Room.findById(roomId).lean();
  }
};

export default bookingRepository;
