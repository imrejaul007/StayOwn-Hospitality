import asyncHandler from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import Booking from '../models/Booking.js';
import NotificationAutomationService from '../services/notificationAutomationService.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { validateTransition } from '../utils/bookingStateMachine.js';

/**
 * @desc    Mark booking as no-show
 * @route   POST /api/v1/bookings/:bookingId/no-show
 * @access  Admin, Staff, Manager
 */
export const markAsNoShow = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason, chargeAmount = 0 } = req.body;
  const { user } = req;

  // Validate permissions
  if (!['admin', 'staff', 'manager'].includes(user.role)) {
    throw new ApiError(403, 'You do not have permission to mark bookings as no-show');
  }

  // Find the booking (no .lean() so we can call .save())
  const booking = await Booking.findById(bookingId).populate('hotelId userId');

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Validate status transition using the state machine
  const transition = validateTransition(booking.status, 'no_show');
  if (!transition.valid) {
    throw new ApiError(400, `Cannot mark booking as no-show: ${transition.error}`);
  }

  // Check if check-in date has passed
  const now = new Date();
  const checkInDate = new Date(booking.checkIn);
  const gracePeriodHours = 6; // 6 hours after check-in time
  const gracePeriodEnd = new Date(checkInDate.getTime() + (gracePeriodHours * 60 * 60 * 1000));

  if (now < gracePeriodEnd) {
    throw new ApiError(400, `Cannot mark as no-show yet. Grace period ends at ${gracePeriodEnd.toLocaleString()}`);
  }

  // Update booking status and no-show information
  booking.status = 'no_show';
  booking.noShowRecorded = now;
  booking.noShowReason = reason || 'Guest did not arrive without prior notice';
  booking.noShowMarkedBy = {
    userId: user._id,
    userName: user.name,
    userRole: user.role
  };

  // Apply no-show charge if specified
  if (chargeAmount > 0) {
    booking.noShowChargeAmount = chargeAmount;
    booking.noShowChargeApplied = true;

    // Add to booking history
    booking.statusHistory.push({
      status: 'no_show',
      timestamp: now,
      changedBy: {
        source: 'admin',
        userId: user._id.toString(),
        userName: user.name,
        channel: 'system'
      },
      reason: `No-show marked with charge of ${chargeAmount}. Reason: ${reason}`,
      automaticTransition: false,
      validatedTransition: true
    });
  } else {
    // Add to booking history without charge
    booking.statusHistory.push({
      status: 'no_show',
      timestamp: now,
      changedBy: {
        source: 'admin',
        userId: user._id.toString(),
        userName: user.name,
        channel: 'system'
      },
      reason: `No-show marked. Reason: ${reason}`,
      automaticTransition: false,
      validatedTransition: true
    });
  }

  // Update last status change
  booking.lastStatusChange = {
    from: booking.status,
    to: 'no_show',
    timestamp: now,
    reason: reason || 'Guest did not arrive'
  };

  // Save the booking
  await booking.save();

  // Send notifications
  try {
    // Notify guest about no-show
    await NotificationAutomationService.handleBookingStatusChange(
      booking,
      'no_show',
      'confirmed',
      { triggeredBy: user }
    );

    // Notify hotel staff
    await NotificationAutomationService.notifyStaff({
      type: 'booking_no_show',
      bookingId: booking._id,
      message: `Booking ${booking.bookingNumber} has been marked as no-show`,
      priority: 'medium',
      metadata: {
        guestName: booking.userId?.name,
        chargeAmount: chargeAmount || 0,
        markedBy: user.name
      }
    });
  } catch (notificationError) {
    console.error('Failed to send no-show notifications:', notificationError);
    // Don't fail the operation if notifications fail
  }

  // Return success response
  res.status(200).json(
    new ApiResponse(200, {
      booking: {
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        noShowRecorded: booking.noShowRecorded,
        noShowReason: booking.noShowReason,
        noShowChargeAmount: booking.noShowChargeAmount,
        noShowMarkedBy: booking.noShowMarkedBy
      }
    }, 'Booking successfully marked as no-show')
  );
});

/**
 * @desc    Get no-show statistics
 * @route   GET /api/v1/bookings/no-show/stats
 * @access  Admin, Manager
 */
export const getNoShowStats = asyncHandler(async (req, res) => {
  const { user } = req;
  const { startDate, endDate, hotelId } = req.query;

  // Validate permissions
  if (!['admin', 'manager'].includes(user.role)) {
    throw new ApiError(403, 'You do not have permission to view no-show statistics');
  }

  // Build query — mandatory tenant isolation
  const resolvedHotelId = hotelId || user.hotelId;
  if (!resolvedHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  const query = { status: 'no_show' };
  query.hotelId = resolvedHotelId;

  if (startDate && endDate) {
    query.noShowRecorded = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // Get no-show bookings
  const noShowBookings = await Booking.find(query)
    .populate('hotelId', 'name')
    .populate('userId', 'name email')
    .select('bookingNumber noShowRecorded noShowReason noShowChargeAmount totalAmount checkIn checkOut')
    .sort({ noShowRecorded: -1 }).lean().limit(1000);

  // Calculate statistics
  const totalNoShows = noShowBookings.length;
  const totalChargesCollected = noShowBookings.reduce((sum, booking) => sum + (booking.noShowChargeAmount || 0), 0);
  const totalPotentialRevenue = noShowBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const averageChargePerNoShow = totalNoShows > 0 ? totalChargesCollected / totalNoShows : 0;

  // Group by month for trend analysis
  const monthlyStats = {};
  noShowBookings.forEach(booking => {
    const month = booking.noShowRecorded.toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyStats[month]) {
      monthlyStats[month] = {
        count: 0,
        chargesCollected: 0,
        potentialRevenue: 0
      };
    }
    monthlyStats[month].count++;
    monthlyStats[month].chargesCollected += booking.noShowChargeAmount || 0;
    monthlyStats[month].potentialRevenue += booking.totalAmount;
  });

  res.status(200).json(
    new ApiResponse(200, {
      summary: {
        totalNoShows,
        totalChargesCollected,
        totalPotentialRevenue,
        averageChargePerNoShow,
        recoveryRate: totalPotentialRevenue > 0 ? (totalChargesCollected / totalPotentialRevenue * 100).toFixed(2) : 0
      },
      monthlyTrends: monthlyStats,
      recentNoShows: noShowBookings.slice(0, 10) // Latest 10 no-shows
    }, 'No-show statistics retrieved successfully')
  );
});

/**
 * @desc    Reverse no-show status
 * @route   PUT /api/v1/bookings/:bookingId/reverse-no-show
 * @access  Admin, Manager
 */
export const reverseNoShow = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { reason, newStatus = 'confirmed' } = req.body;
  const { user } = req;

  // Validate permissions - only admin and manager can reverse no-show
  if (!['admin', 'manager'].includes(user.role)) {
    throw new ApiError(403, 'You do not have permission to reverse no-show status');
  }

  // Find the booking
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Check if booking is currently no-show
  if (booking.status !== 'no_show') {
    throw new ApiError(400, 'Booking is not marked as no-show');
  }

  // Validate new status
  const allowedNewStatuses = ['confirmed', 'checked_in', 'cancelled'];
  if (!allowedNewStatuses.includes(newStatus)) {
    throw new ApiError(400, `Invalid new status: ${newStatus}`);
  }

  const now = new Date();

  // Update booking status
  booking.status = newStatus;

  // Clear no-show fields
  booking.noShowRecorded = null;
  booking.noShowReason = null;
  booking.noShowMarkedBy = null;
  booking.noShowChargeAmount = 0;
  booking.noShowChargeApplied = false;

  // Add to booking history
  booking.statusHistory.push({
    status: newStatus,
    timestamp: now,
    changedBy: {
      source: 'admin',
      userId: user._id.toString(),
      userName: user.name,
      channel: 'system'
    },
    reason: `No-show status reversed to ${newStatus}. Reason: ${reason}`,
    automaticTransition: false,
    validatedTransition: true
  });

  // Update last status change
  booking.lastStatusChange = {
    from: 'no_show',
    to: newStatus,
    timestamp: now,
    reason: reason || 'No-show status reversed'
  };

  // Save the booking
  await booking.save();

  res.status(200).json(
    new ApiResponse(200, {
      booking: {
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        lastStatusChange: booking.lastStatusChange
      }
    }, `No-show status successfully reversed to ${newStatus}`)
  );
});

export default {
  markAsNoShow,
  getNoShowStats,
  reverseNoShow
};