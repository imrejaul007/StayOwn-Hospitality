import GroupBooking from '../models/GroupBooking.js';
import CorporateCompany from '../models/CorporateCompany.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import APIFeatures from '../utils/apiFeatures.js';
import { validateTransition, atomicStatusTransition } from '../utils/bookingStateMachine.js';
import { withTransaction } from '../utils/transactionHelper.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

/**
 * @swagger
 * tags:
 *   name: Group Bookings
 *   description: Corporate group booking management
 */

/**
 * @swagger
 * /api/v1/corporate/group-bookings:
 *   post:
 *     summary: Create a new group booking
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GroupBooking'
 *     responses:
 *       201:
 *         description: Group booking created successfully
 *       400:
 *         description: Invalid input data
 */
export const createGroupBooking = catchAsync(async (req, res, next) => {
  const groupBooking = await withTransaction(async (session) => {
    try {
      // Verify corporate company exists and has sufficient credit
      const company = await CorporateCompany.findOne({
        _id: req.body.corporateCompanyId,
        hotelId: req.user.hotelId,
        isActive: true
      }).session(session);

      if (!company) {
        throw new ApplicationError('Corporate company not found or inactive', 404);
      }

      // Add hotel ID and creator info
      const groupBookingData = {
        ...req.body,
        hotelId: req.user.hotelId,
        'metadata.createdBy': req.user.id
      };

      // Check room availability for the requested dates
      const { checkIn, checkOut, rooms } = req.body;
      const requestedRoomTypes = rooms.map(room => room.roomType);

      // Get available rooms for each requested type
      for (const roomType of [...new Set(requestedRoomTypes)]) {
        const availableRooms = await Room.find({
          hotelId: req.user.hotelId,
          type: roomType,
          isActive: true
        }).session(session).limit(1000);

        const requestedCount = requestedRoomTypes.filter(type => type === roomType).length;

        if (availableRooms.length < requestedCount) {
          throw new ApplicationError(`Not enough ${roomType} rooms available. Requested: ${requestedCount}, Available: ${availableRooms.length}`, 400);
        }
      }

      const [booking] = await GroupBooking.create([groupBookingData], { session });

      // Check if company has sufficient credit for estimated amount
      if (company.availableCredit < booking.totalAmount &&
          booking.paymentMethod === 'corporate_credit') {
        throw new ApplicationError(`Insufficient corporate credit. Required: ₹${booking.totalAmount}, Available: ₹${company.availableCredit}`, 400);
      }

      return booking;
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  });

  res.status(201).json({
    status: 'success',
    data: {
      groupBooking
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings:
 *   get:
 *     summary: Get all group bookings
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by booking status
 *       - in: query
 *         name: corporateCompanyId
 *         schema:
 *           type: string
 *         description: Filter by corporate company
 *     responses:
 *       200:
 *         description: List of group bookings
 */
export const getAllGroupBookings = catchAsync(async (req, res, next) => {
  const filter = { hotelId: req.user.hotelId };

  const features = new APIFeatures(GroupBooking.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const groupBookings = await features.query
    .populate('corporateCompanyId', 'name email phone')
    .populate('rooms.bookingId')
    .lean();

  const totalCount = await GroupBooking.countDocuments(filter);
  const page = features.page || 1;
  const limit = features.limit || 20;

  res.status(200).json({
    status: 'success',
    results: groupBookings.length,
    data: {
      groupBookings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings/{id}:
 *   get:
 *     summary: Get a group booking by ID
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group booking ID
 *     responses:
 *       200:
 *         description: Group booking details
 *       404:
 *         description: Group booking not found
 */
export const getGroupBooking = catchAsync(async (req, res, next) => {
  const groupBooking = await GroupBooking.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  })
  .populate('corporateCompanyId')
  .populate('rooms.roomId')
  .populate('rooms.bookingId').lean();
  
  if (!groupBooking) {
    return next(new ApplicationError('Group booking not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      groupBooking
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings/{id}:
 *   patch:
 *     summary: Update a group booking
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GroupBooking'
 *     responses:
 *       200:
 *         description: Group booking updated successfully
 *       404:
 *         description: Group booking not found
 */
export const updateGroupBooking = catchAsync(async (req, res, next) => {
  const updateData = {
    ...req.body,
    'metadata.lastModifiedBy': req.user.id
  };
  
  const groupBooking = await GroupBooking.findOneAndUpdate(
    { _id: req.params.id, hotelId: req.user.hotelId },
    updateData,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!groupBooking) {
    return next(new ApplicationError('Group booking not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      groupBooking
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings/{id}/confirm:
 *   patch:
 *     summary: Confirm group booking and create individual bookings
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group booking ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomIndices:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Array of room indices to confirm (if not provided, all rooms will be confirmed)
 *     responses:
 *       200:
 *         description: Group booking confirmed successfully
 *       404:
 *         description: Group booking not found
 */
export const confirmGroupBooking = catchAsync(async (req, res, next) => {
  const result = await withTransaction(async (session) => {
    try {
      const groupBooking = await GroupBooking.findOne({
        _id: req.params.id,
        hotelId: req.user.hotelId
      }).populate('corporateCompanyId').session(session);

      if (!groupBooking) {
        throw new ApplicationError('Group booking not found', 404);
      }

      const { roomIndices } = req.body;
      const indicesToConfirm = roomIndices || groupBooking.rooms.map((_, index) => index);

      // Create individual bookings for each room
      const createdBookings = [];

      for (const index of indicesToConfirm) {
        const roomData = groupBooking.rooms[index];
        if (!roomData) continue;

        // Find available room of the requested type
        const availableRoom = await Room.findOne({
          hotelId: req.user.hotelId,
          type: roomData.roomType,
          isActive: true
        }).session(session);

        if (!availableRoom) {
          throw new ApplicationError(`No available ${roomData.roomType} rooms`, 400);
        }

        // Create individual booking
        const bookingData = {
          hotelId: req.user.hotelId,
          userId: req.user.id,
          rooms: [{
            roomId: availableRoom._id,
            rate: roomData.rate
          }],
          checkIn: groupBooking.checkIn,
          checkOut: groupBooking.checkOut,
          nights: groupBooking.nights,
          status: 'confirmed',
          paymentStatus: 'pending',
          totalAmount: roomData.rate * groupBooking.nights,
          currency: 'INR',
          guestDetails: {
            adults: 1,
            children: 0,
            specialRequests: roomData.specialRequests
          },
          corporateBooking: {
            corporateCompanyId: groupBooking.corporateCompanyId._id,
            groupBookingId: groupBooking._id,
            employeeId: roomData.employeeId,
            department: roomData.department,
            paymentMethod: groupBooking.paymentMethod,
            billingEmail: groupBooking.corporateCompanyId.primaryHRContact?.email
          }
        };

        const [booking] = await Booking.create([bookingData], { session });
        createdBookings.push(booking);

        // Update group booking room with individual booking ID
        groupBooking.rooms[index].bookingId = booking._id;
        groupBooking.rooms[index].roomId = availableRoom._id;
        // Validate room status transition: only 'pending' rooms can be confirmed
        const currentRoomStatus = groupBooking.rooms[index].status;
        if (currentRoomStatus && currentRoomStatus !== 'pending') {
          throw new ApplicationError(
            `Cannot confirm room: invalid transition from '${currentRoomStatus}' to 'confirmed'`,
            400
          );
        }
        groupBooking.rooms[index].status = 'confirmed';
      }

      // Update group booking status
      await groupBooking.confirmRooms(indicesToConfirm);

      return { groupBooking, createdBookings };
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      groupBooking: result.groupBooking,
      createdBookings: result.createdBookings,
      message: `${result.createdBookings.length} individual bookings created successfully`
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel group booking or specific rooms
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomIndices:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Array of room indices to cancel
 *               reason:
 *                 type: string
 *                 description: Cancellation reason
 *     responses:
 *       200:
 *         description: Group booking cancelled successfully
 *       404:
 *         description: Group booking not found
 */
export const cancelGroupBooking = catchAsync(async (req, res, next) => {
  const { roomIndices, reason } = req.body;
  
  const groupBooking = await GroupBooking.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).lean();
  
  if (!groupBooking) {
    return next(new ApplicationError('Group booking not found', 404));
  }
  
  const indicesToCancel = roomIndices || groupBooking.rooms.map((_, index) => index);
  
  // Batch: fetch all individual bookings in a single query
  const bookingIdsToCancel = indicesToCancel
    .map(i => groupBooking.rooms[i])
    .filter(r => r && r.bookingId)
    .map(r => r.bookingId);
  const individualBookings = bookingIdsToCancel.length > 0
    ? await Booking.find({ _id: { $in: bookingIdsToCancel } }).lean()
    : [];
  const bookingMap = new Map(individualBookings.map(b => [b._id.toString(), b]));

  for (const index of indicesToCancel) {
    const roomData = groupBooking.rooms[index];
    if (roomData && roomData.bookingId) {
      const individualBooking = bookingMap.get(roomData.bookingId.toString());
      if (individualBooking) {
        const validation = validateTransition(individualBooking.status, 'cancelled');
        if (validation.valid) {
          try {
            await atomicStatusTransition(Booking, roomData.bookingId, individualBooking.status, 'cancelled', {
              cancellationReason: reason || 'Cancelled via group booking'
            });
          } catch (transitionError) {
            // Log but continue — the booking may have already been cancelled by another request
            console.warn(`Could not cancel booking ${roomData.bookingId}: ${transitionError.message}`);
          }
        }
      }
    }
  }
  
  // Update group booking
  await groupBooking.cancelRooms(indicesToCancel, reason);
  
  res.status(200).json({
    status: 'success',
    data: {
      groupBooking,
      cancelledRooms: indicesToCancel.length,
      message: 'Group booking cancelled successfully'
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings/upcoming:
 *   get:
 *     summary: Get upcoming group bookings
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *         description: Number of days ahead to look (default: 30)
 *     responses:
 *       200:
 *         description: List of upcoming group bookings
 */
export const getUpcomingGroupBookings = catchAsync(async (req, res, next) => {
  const days = parseInt(req.query.days) || 30;
  
  const upcomingBookings = await GroupBooking.findUpcomingBookings(req.user.hotelId, days);
  
  res.status(200).json({
    status: 'success',
    results: upcomingBookings.length,
    data: {
      groupBookings: upcomingBookings,
      lookAheadDays: days
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings/{id}/rooms/{roomIndex}:
 *   patch:
 *     summary: Update specific room in group booking
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group booking ID
 *       - in: path
 *         name: roomIndex
 *         required: true
 *         schema:
 *           type: number
 *         description: Room index in the group booking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guestName:
 *                 type: string
 *               guestEmail:
 *                 type: string
 *               specialRequests:
 *                 type: string
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       404:
 *         description: Group booking or room not found
 */
export const updateGroupBookingRoom = catchAsync(async (req, res, next) => {
  const { id, roomIndex } = req.params;
  const roomIndex_num = parseInt(roomIndex);

  const groupBooking = await GroupBooking.findOne({
    _id: id,
    hotelId: req.user.hotelId
  });

  if (!groupBooking) {
    return next(new ApplicationError('Group booking not found', 404));
  }

  if (!groupBooking.rooms[roomIndex_num]) {
    return next(new ApplicationError('Room not found in group booking', 404));
  }

  // Update room details — whitelist only safe fields
  const allowedRoomFields = [
    'roomType', 'checkInDate', 'checkOutDate', 'adults', 'children', 'infants',
    'ratePlan', 'roomRate', 'extraBed', 'extraBedCharge', 'mealPlan', 'mealCharge',
    'pickupRequired', 'dropRequired', 'specialRequests', 'status', 'allocatedRoomNumber',
    'bookingSource', 'corporateDiscount', 'confirmationNumber', 'notes'
  ];
  Object.keys(req.body).forEach(key => {
    if (allowedRoomFields.includes(key) && req.body[key] !== undefined) {
      groupBooking.rooms[roomIndex_num][key] = req.body[key];
    }
  });

  groupBooking.metadata.lastModifiedBy = req.user.id;
  await groupBooking.save();

  res.status(200).json({
    status: 'success',
    data: {
      groupBooking,
      updatedRoom: groupBooking.rooms[roomIndex_num]
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/group-bookings/{id}/toggle-status:
 *   patch:
 *     summary: Toggle group booking status
 *     tags: [Group Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Group booking ID
 *     responses:
 *       200:
 *         description: Group booking status toggled successfully
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Group booking not found
 */
export const toggleGroupBookingStatus = catchAsync(async (req, res, next) => {
  // Do NOT use .lean() here — we need a Mongoose document to call .save()
  const groupBooking = await GroupBooking.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).populate('corporateCompanyId');

  if (!groupBooking) {
    return next(new ApplicationError('Group booking not found', 404));
  }

  let newStatus;
  let statusMessage;

  switch (groupBooking.status) {
    case 'draft':
      // Draft can be confirmed or cancelled
      newStatus = 'confirmed';
      statusMessage = 'Group booking confirmed successfully';

      // Check corporate company is active
      if (!groupBooking.corporateCompanyId?.isActive) {
        return next(new ApplicationError('Cannot confirm booking for inactive corporate company', 400));
      }

      // Check if company has sufficient credit for corporate credit bookings
      if (groupBooking.paymentMethod === 'corporate_credit' &&
          groupBooking.corporateCompanyId?.availableCredit < groupBooking.totalAmount) {
        return next(new ApplicationError(
          `Insufficient corporate credit. Required: ₹${groupBooking.totalAmount}, Available: ₹${groupBooking.corporateCompanyId?.availableCredit ?? 0}`,
          400
        ));
      }
      break;

    case 'confirmed':
      // Confirmed can be cancelled (if not checked in) or checked in
      if (groupBooking.rooms.some(room => room.status === 'checked_in')) {
        return next(new ApplicationError('Cannot change status of group booking with checked-in rooms', 400));
      }
      newStatus = 'cancelled';
      statusMessage = 'Group booking cancelled successfully';
      break;

    case 'partially_confirmed':
      // Partially confirmed can be fully cancelled
      if (groupBooking.rooms.some(room => room.status === 'checked_in')) {
        return next(new ApplicationError('Cannot cancel group booking with checked-in rooms', 400));
      }
      newStatus = 'cancelled';
      statusMessage = 'Group booking cancelled successfully';
      break;

    case 'cancelled':
      // Cancelled can be reactivated to draft
      newStatus = 'draft';
      statusMessage = 'Group booking reactivated successfully';
      break;

    case 'checked_in':
    case 'checked_out':
      return next(new ApplicationError('Cannot change status of checked-in or checked-out group booking', 400));

    default:
      return next(new ApplicationError('Invalid group booking status', 400));
  }

  // Update the status
  groupBooking.status = newStatus;
  if (groupBooking.metadata) {
    groupBooking.metadata.lastModifiedBy = req.user.id;
  }

  // If cancelling, update all room statuses (validate each transition)
  if (newStatus === 'cancelled') {
    const cancellableStatuses = ['pending', 'confirmed', 'partially_confirmed'];
    groupBooking.rooms.forEach(room => {
      if (cancellableStatuses.includes(room.status)) {
        room.status = 'cancelled';
      }
      // checked_in and checked_out rooms are intentionally left unchanged
    });
  }

  // If reactivating, reset room statuses (only cancelled -> pending is valid)
  if (newStatus === 'draft') {
    groupBooking.rooms.forEach(room => {
      if (room.status === 'cancelled') {
        room.status = 'pending';
      }
    });
  }

  await groupBooking.save();

  res.status(200).json({
    status: 'success',
    data: {
      groupBooking,
      message: statusMessage
    }
  });
});
