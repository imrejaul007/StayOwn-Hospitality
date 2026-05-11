// @ts-check

import crypto from 'crypto';
import { ApplicationError } from '../../middleware/errorHandler.js';
import bookingRepository from './repository.js';

/** @typedef {import('../../types/contracts').AuthenticatedUser} AuthenticatedUser */
/** @typedef {import('../../types/contracts').BookingCreationPreparationInput} BookingCreationPreparationInput */
/** @typedef {import('../../types/contracts').BookingIdempotencyInput} BookingIdempotencyInput */
/** @typedef {import('../../types/contracts').BookingUpdateBody} BookingUpdateBody */
/** @typedef {import('../../types/contracts').ResolveRoomsAndRatesInput} ResolveRoomsAndRatesInput */
/** @typedef {import('../../types/contracts').RoomAssignmentLookupInput} RoomAssignmentLookupInput */
/** @typedef {import('../../types/contracts').SettlementAdjustmentInput} SettlementAdjustmentInput */
/** @typedef {import('../../types/contracts').SettlementPaymentInput} SettlementPaymentInput */

const FINAL_BOOKING_STATES = ['checked_out', 'cancelled', 'no_show'];

const bookingService = {
  /**
   * @param {BookingIdempotencyInput} params
   * @returns {string}
   */
  buildIdempotencyKey({
    clientIdempotencyKey,
    userId,
    roomIds,
    checkIn,
    checkOut,
    totalAmount
  }) {
    if (clientIdempotencyKey) {
      return clientIdempotencyKey;
    }

    return crypto
      .createHash('sha256')
      .update(`${userId || ''}-${JSON.stringify(roomIds || [])}-${checkIn}-${checkOut}-${totalAmount}`)
      .digest('hex');
  },

  /**
   * @param {string} idempotencyKey
   * @param {import('../../types/contracts').ObjectIdLike} requestedUserId
   * @returns {Promise<void>}
   */
  async assertIdempotencyIsSafe(idempotencyKey, requestedUserId) {
    const existingBooking = await bookingRepository.findByIdempotencyKey(idempotencyKey);
    if (!existingBooking) {
      return;
    }

    const isOldBooking = (Date.now() - existingBooking.createdAt.getTime()) > (60 * 60 * 1000);
    const isFinalState = FINAL_BOOKING_STATES.includes(existingBooking.status);
    const isSameUser = existingBooking.userId.toString() === requestedUserId.toString();

    if (!isSameUser) {
      throw new ApplicationError(
        'Booking conflict detected. This booking reference is already in use by another user. Please refresh the page and try again.',
        409
      );
    }

    if (!isOldBooking && !isFinalState) {
      const timeSinceCreated = Math.round((Date.now() - existingBooking.createdAt.getTime()) / (1000 * 60));
      throw new ApplicationError(
        `Duplicate booking detected. You already have booking ${existingBooking.bookingNumber} created ${timeSinceCreated} minutes ago. If you want to make a different booking, please wait a few minutes or contact support.`,
        409
      );
    }
  },

  /**
   * @param {ResolveRoomsAndRatesInput} params
   * @returns {Promise<{ rooms: any[], roomsWithRates: Array<{ roomId: any, rate: number }> }>}
   */
  async resolveRoomsAndRates({
    roomIds,
    hotelId,
    checkInDate,
    checkOutDate,
    session
  }) {
    if (!roomIds || roomIds.length === 0) {
      return { rooms: [], roomsWithRates: [] };
    }

    const rooms = await bookingRepository.findActiveRoomsByIds(roomIds, hotelId);
    if (rooms.length !== roomIds.length) {
      throw new ApplicationError('One or more rooms not found or not available', 404);
    }

    const overlappingBookings = await bookingRepository.findOverlappingBookings(
      roomIds,
      checkInDate,
      checkOutDate,
      { hotelId, session }
    );

    if (overlappingBookings.length > 0) {
      const conflictingRooms = overlappingBookings.map((booking) => {
        const conflictedRoom = rooms.find((room) =>
          booking.rooms.some((bookingRoom) => bookingRoom.roomId.toString() === room._id.toString())
        );
        return {
          roomNumber: conflictedRoom?.roomNumber || 'Unknown',
          conflictingBooking: booking.bookingNumber,
          conflictDates: `${booking.checkIn.toDateString()} - ${booking.checkOut.toDateString()}`,
          status: booking.status
        };
      });

      const roomDetails = conflictingRooms
        .map((room) => `Room ${room.roomNumber} (conflicting with booking ${room.conflictingBooking}, ${room.conflictDates}, status: ${room.status})`)
        .join('; ');

      throw new ApplicationError(
        `Room availability conflict detected. The following rooms are already booked for overlapping dates: ${roomDetails}. Please select different dates or contact support if you believe this is an error.`,
        409
      );
    }

    const roomsWithRates = rooms.map((room) => ({
      roomId: room._id,
      rate: room.currentRate
    }));

    return { rooms, roomsWithRates };
  },

  /**
   * @param {BookingCreationPreparationInput} params
   * @returns {Promise<{
   *   idempotencyKey: string,
   *   checkInDate: Date,
   *   checkOutDate: Date,
   *   rooms: any[],
   *   roomsWithRates: Array<{ roomId: any, rate: number }>,
   *   nights: number,
   *   calculatedTotal: number
   * }>}
   */
  async prepareBookingCreation({
    clientIdempotencyKey,
    requestedUserId,
    userId,
    roomIds,
    hotelId,
    checkIn,
    checkOut,
    totalAmount,
    session
  }) {
    const idempotencyKey = this.buildIdempotencyKey({
      clientIdempotencyKey,
      userId,
      roomIds,
      checkIn,
      checkOut,
      totalAmount
    });

    await this.assertIdempotencyIsSafe(idempotencyKey, requestedUserId);

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const { rooms, roomsWithRates } = await this.resolveRoomsAndRates({
      roomIds,
      hotelId,
      checkInDate,
      checkOutDate,
      session
    });

    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const calculatedTotal = roomsWithRates.length > 0
      ? roomsWithRates.reduce((total, room) => total + room.rate, 0) * nights
      : 0;

    return {
      idempotencyKey,
      checkInDate,
      checkOutDate,
      rooms,
      roomsWithRates,
      nights,
      calculatedTotal
    };
  },

  /**
   * @param {any} booking
   * @param {AuthenticatedUser} user
   * @param {string} [action='modify']
   * @returns {void}
   */
  assertCanModifyBooking(booking, user, action = 'modify') {
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    if (user.role === 'guest' && booking.userId.toString() !== user._id.toString()) {
      throw new ApplicationError(`You do not have permission to ${action} this booking`, 403);
    }

    if (
      (user.role === 'staff' || user.role === 'frontdesk') &&
      booking.hotelId.toString() !== user.hotelId.toString()
    ) {
      throw new ApplicationError(`You do not have permission to ${action} this booking`, 403);
    }
  },

  /**
   * @param {BookingUpdateBody} body
   * @param {string} userRole
   * @returns {Record<string, unknown>}
   */
  buildBookingUpdateData(body, userRole) {
    const allowedFields = userRole === 'guest' ? ['guestDetails'] : Object.keys(body || {});
    const updateData = {};

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    return updateData;
  },

  /**
   * @param {RoomAssignmentLookupInput} params
   * @returns {Promise<any>}
   */
  async findBookingForRoomChange({
    bookingId,
    guestName,
    checkIn,
    checkOut
  }) {
    let booking = null;

    if (bookingId) {
      booking = await bookingRepository.findBookingByIdForUpdate(bookingId);
    }

    if (!booking && guestName) {
      const user = await bookingRepository.findUserByNameInsensitive(guestName);
      if (user) {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        checkInDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(23, 59, 59, 999);
        booking = await bookingRepository.findBookingByUserDateWindow(user._id, checkInDate, checkOutDate);
      }
    }

    if (!booking) {
      throw new ApplicationError(`Booking not found for ${guestName || bookingId}`, 404);
    }

    if (!booking.rooms) {
      booking.rooms = [];
    }

    if (FINAL_BOOKING_STATES.includes(booking.status)) {
      throw new ApplicationError(
        `Cannot assign rooms to a booking in terminal state "${booking.status}". Please create a new booking.`,
        400
      );
    }

    return booking;
  },

  async validateRoomAssignment({
    booking,
    newRoomId,
    newRoomNumber
  }) {
    const room = await bookingRepository.findRoomById(newRoomId);
    if (!room) {
      throw new ApplicationError(`Room not found: ${newRoomNumber}`, 404);
    }

    if (booking.roomType && room.roomType) {
      const bookingRoomType = booking.roomType.toLowerCase();
      const actualRoomType = room.roomType.toLowerCase();
      const isCompatible = bookingRoomType === actualRoomType;

      if (!isCompatible) {
        throw new ApplicationError(
          `Room type mismatch: Booking requires ${booking.roomType} but room ${newRoomNumber} is ${room.roomType}`,
          400
        );
      }
    }

    if (!room.isActive) {
      throw new ApplicationError(`Room ${newRoomNumber} is not active`, 400);
    }

    return room;
  },

  assertRoomChangeDateWithinBooking({
    booking,
    newCheckInDate
  }) {
    if (!newCheckInDate) {
      return;
    }

    const targetDate = new Date(newCheckInDate);
    const bookingCheckIn = new Date(booking.checkIn);
    const bookingCheckOut = new Date(booking.checkOut);
    targetDate.setHours(0, 0, 0, 0);
    bookingCheckIn.setHours(0, 0, 0, 0);
    bookingCheckOut.setHours(0, 0, 0, 0);

    if (targetDate < bookingCheckIn || targetDate >= bookingCheckOut) {
      throw new ApplicationError(
        `Date mismatch: Cannot assign guest to ${targetDate.toDateString()}. Booking is only valid from ${bookingCheckIn.toDateString()} to ${new Date(bookingCheckOut.getTime() - 1).toDateString()}`,
        400
      );
    }
  },

  applyRoomAssignment({
    booking,
    newRoomId,
    roomRate,
    newRoomNumber,
    actorName,
    reason
  }) {
    if (booking.rooms.length > 0) {
      booking.rooms[0].roomId = newRoomId;
      booking.rooms[0].rate = roomRate;
    } else {
      booking.rooms.push({
        roomId: newRoomId,
        rate: roomRate
      });
    }

    if (!booking.notes) {
      booking.notes = [];
    }

    booking.notes.push(
      `Room assigned/changed to ${newRoomNumber} on ${new Date().toISOString()} by ${actorName}. Reason: ${reason}`
    );
  },

  applyExistingRoomChange({
    booking,
    newRoomId,
    newRoomNumber,
    actorName,
    reason
  }) {
    if (!booking || !Array.isArray(booking.rooms) || booking.rooms.length === 0) {
      throw new ApplicationError('Booking has no rooms to change', 400);
    }

    booking.rooms[0].roomId = newRoomId;

    if (!booking.notes) {
      booking.notes = [];
    }
    booking.notes.push(
      `Room changed to ${newRoomNumber} on ${new Date().toISOString()} by ${actorName}. Reason: ${reason}`
    );
  },

  assertModificationAccess(booking, user, action = 'modify') {
    const bookingUserId = booking?.userId?._id?.toString?.() || booking?.userId?.toString?.();
    const requestUserId = user?._id?.toString?.();
    const isOwner = bookingUserId && requestUserId && bookingUserId === requestUserId;
    const isStaff = ['admin', 'staff', 'manager', 'frontdesk'].includes(user.role);

    if (!isOwner && !isStaff) {
      throw new ApplicationError(`You are not authorized to ${action} this booking`, 403);
    }
  },

  buildModificationRequest({
    booking,
    modificationType,
    requestedChanges,
    reason,
    user,
    ip
  }) {
    return {
      modificationId: crypto.randomUUID(),
      modificationType,
      modificationDate: new Date(),
      modifiedBy: {
        source: ['admin', 'staff', 'frontdesk'].includes(user.role) ? 'admin' : 'guest',
        userId: user._id.toString(),
        userName: user.name,
        ipAddress: ip || 'unknown'
      },
      oldValues: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomType: booking.roomType,
        totalAmount: booking.totalAmount,
        guestDetails: booking.guestDetails
      },
      newValues: requestedChanges,
      reason,
      autoApproved: false
    };
  },

  findModificationRequestOrThrow(booking, requestId) {
    const modificationRequest = (booking.modifications || []).find(
      (mod) => mod.modificationId === requestId
    );

    if (!modificationRequest) {
      throw new ApplicationError('Modification request not found', 404);
    }

    if (modificationRequest.reason && modificationRequest.reason.includes('REVIEWED:')) {
      throw new ApplicationError('Modification request has already been reviewed', 400);
    }

    return modificationRequest;
  },

  applyApprovedModificationChanges({
    booking,
    modificationRequest,
    action,
    reviewNotes,
    approvedChanges,
    reviewer
  }) {
    modificationRequest.reason = `${modificationRequest.reason || ''} REVIEWED: ${action.toUpperCase()} by ${reviewer.name}. ${reviewNotes || ''}`.trim();

    if (action === 'approve' && approvedChanges) {
      modificationRequest.approvedChanges = approvedChanges;

      if (approvedChanges.checkIn) booking.checkIn = new Date(approvedChanges.checkIn);
      if (approvedChanges.checkOut) booking.checkOut = new Date(approvedChanges.checkOut);
      if (approvedChanges.totalAmount) booking.totalAmount = approvedChanges.totalAmount;
      if (approvedChanges.guestDetails) {
        booking.guestDetails = { ...booking.guestDetails, ...approvedChanges.guestDetails };
      }

      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date(),
        changedBy: {
          source: 'staff',
          userId: reviewer._id,
          userName: reviewer.name
        },
        reason: `Booking modified: ${modificationRequest.modificationType}`,
        automaticTransition: false,
        validatedTransition: true
      });
    }
  },

  assertCanCheckInBooking(booking, user) {
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    if (
      (user.role === 'staff' || user.role === 'frontdesk') &&
      booking.hotelId.toString() !== user.hotelId.toString()
    ) {
      throw new ApplicationError('You do not have permission to check-in this booking', 403);
    }
  },

  assertBookingCanBeCheckedIn(booking) {
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      throw new ApplicationError(
        `Cannot check-in booking with status '${booking.status}'. Only pending or confirmed bookings can be checked in.`,
        400
      );
    }

    if (!booking.rooms || booking.rooms.length === 0 || !booking.rooms.some((room) => room.roomId)) {
      throw new ApplicationError('Cannot check in: no room assigned to this booking. Please assign a room first.', 400);
    }
  },

  assertBookingCanBeCheckedOut(booking) {
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    if (booking.status !== 'checked_in') {
      throw new ApplicationError('Only checked-in bookings can be checked out', 400);
    }
  },

  getCheckoutBalanceInfo(booking) {
    const totalAmount = booking.totalAmount || 0;
    const totalPaid = booking.paymentDetails?.totalPaid || 0;
    const outstandingBalance = totalAmount - totalPaid;

    return {
      totalAmount,
      totalPaid,
      outstandingBalance
    };
  },

  assertSettlementAdjustmentInput({ type, amount, description }) {
    if (!type || amount === undefined || !description) {
      throw new ApplicationError('Type, amount, and description are required', 400);
    }
  },

  assertSettlementPaymentInput({ paymentMethods, amount }) {
    if (!paymentMethods || paymentMethods.length === 0) {
      throw new ApplicationError('At least one payment method is required', 400);
    }

    const totalPaid = paymentMethods.reduce((sum, payment) => sum + payment.amount, 0);
    if (Math.abs(totalPaid - amount) > 0.01) {
      throw new ApplicationError('Payment amounts do not match total', 400);
    }

    return { totalPaid };
  },

  assertBookingInUserHotel(booking, user) {
    if (booking.hotelId.toString() !== user.hotelId.toString()) {
      throw new ApplicationError('Booking not found in your hotel', 404);
    }
  },

  assertResourceInScopedHotel(resource, scopedHotelId, resourceName = 'Resource') {
    if (!resource) {
      throw new ApplicationError(`${resourceName} not found`, 404);
    }

    if (!scopedHotelId) {
      return;
    }

    if (resource.hotelId?.toString?.() !== scopedHotelId.toString()) {
      throw new ApplicationError(`${resourceName} not found`, 404);
    }
  }
};

export default bookingService;
