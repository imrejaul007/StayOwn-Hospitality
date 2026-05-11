import Booking from '../../models/Booking.js';
import { ApplicationError } from '../../middleware/errorHandler.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { validateTransition } from '../../utils/bookingStateMachine.js';
import bookingService from './service.js';
import bookingAuditService from '../../services/bookingAuditService.js';
import logger from '../../utils/logger.js';

const getSettlement = catchAsync(async (req, res) => {
  const { id } = req.params;
  const scopedHotelId = req.tenantId || req.user?.hotelId;

  const booking = await Booking.findById(id);
  bookingService.assertResourceInScopedHotel(booking, scopedHotelId, 'Booking');

  const settlement = booking.calculateSettlement();

  res.json({
    status: 'success',
    data: {
      settlement,
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        guestName: booking.userId ? booking.userId.name : 'N/A',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status
      }
    }
  });
});

const addSettlementAdjustment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { type, amount, description } = req.body;
  const scopedHotelId = req.tenantId || req.user?.hotelId;

  bookingService.assertSettlementAdjustmentInput({ type, amount, description });

  const booking = await Booking.findById(id);
  bookingService.assertResourceInScopedHotel(booking, scopedHotelId, 'Booking');

  bookingService.assertBookingInUserHotel(booking, req.user);

  const userContext = {
    userId: req.user._id,
    userName: req.user.name,
    userRole: req.user.role
  };

  const previousSettlementStatus = booking.settlementTracking?.status;
  const adjustment = booking.addSettlementAdjustment({ type, amount, description }, userContext);

  await booking.save();

  await bookingAuditService.logBookingMutation({
    booking,
    changeType: 'update',
    user: req.user,
    req,
    oldValues: {
      settlementStatus: previousSettlementStatus
    },
    newValues: bookingAuditService.buildSnapshot(booking),
    metadata: {
      priority: 'high',
      tags: ['settlement_adjustment'],
      adjustmentType: type,
      adjustmentAmount: amount
    }
  });

  res.json({
    status: 'success',
    data: {
      adjustment,
      updatedSettlement: booking.settlementTracking,
      message: 'Settlement adjustment added successfully'
    }
  });
});

const paySettlement = catchAsync(async (req, res) => {
  const { paymentMethods, amount } = req.body;
  const { id } = req.params;
  const scopedHotelId = req.tenantId || req.user?.hotelId;

  const booking = await Booking.findById(id);
  bookingService.assertResourceInScopedHotel(booking, scopedHotelId, 'Booking');

  const { totalPaid } = bookingService.assertSettlementPaymentInput({ paymentMethods, amount });

  if (!booking.paymentDetails) {
    booking.paymentDetails = {
      paymentMethods: [],
      totalPaid: 0,
      remainingAmount: booking.totalAmount || 0,
      collectedAt: new Date(),
      collectedBy: req.user._id
    };
  }

  if (!booking.paymentDetails.paymentMethods) {
    booking.paymentDetails.paymentMethods = [];
  }

  if (!booking.settlementTracking || booking.settlementTracking.status === 'not_required') {
    booking.calculateSettlement();
  }

  const previousBalance = booking.settlementTracking.outstandingBalance || 0;
  const previousSettlementStatus = booking.settlementTracking.status;
  const userContext = {
    userId: req.user._id,
    userName: req.user.name,
    userRole: req.user.role
  };

  const processedPayments = paymentMethods.map((payment) => booking.processSettlementPayment({
    method: payment.method,
    amount: payment.amount,
    reference: payment.reference || `${payment.method}-${Date.now()}`,
    notes: payment.notes || `Settlement payment via ${payment.method}`
  }, userContext));

  if (!booking.paymentHistory) {
    booking.paymentHistory = [];
  }

  paymentMethods.forEach((pm) => {
    booking.paymentHistory.push({
      amount: pm.amount || 0,
      method: pm.method || 'cash',
      reference: pm.reference || '',
      notes: pm.notes || 'Settlement payment',
      collectedBy: req.user._id,
      collectedAt: new Date(),
      status: 'completed',
      type: 'settlement'
    });
  });

  logger.info('Settlement payment processed', {
    bookingNumber: booking.bookingNumber,
    paymentAmount: totalPaid
  });

  await booking.save();

  await bookingAuditService.logBookingMutation({
    booking,
    changeType: 'update',
    user: req.user,
    req,
    oldValues: {
      settlementStatus: previousSettlementStatus,
      settlementOutstandingBalance: previousBalance
    },
    newValues: bookingAuditService.buildSnapshot(booking),
    metadata: {
      priority: 'high',
      tags: ['settlement_payment'],
      settlementPaymentAmount: totalPaid
    }
  });

  await booking.populate([
    { path: 'userId', select: 'name email phone' },
    { path: 'rooms.roomId', select: 'roomNumber type' }
  ]);

  res.json({
    status: 'success',
    data: {
      booking,
      settlementTracking: booking.settlementTracking,
      paymentSummary: {
        totalPaid,
        previousBalance,
        remainingBalance: booking.settlementTracking.outstandingBalance,
        paymentMethods: processedPayments
      },
      message: 'Settlement payment processed successfully'
    }
  });
});

const markNoShow = catchAsync(async (req, res) => {
  const { reason, chargeAmount = 0 } = req.body;
  const { id } = req.params;
  const scopedHotelId = req.tenantId || req.user?.hotelId;

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new ApplicationError('Reason is required for marking a booking as no-show', 400);
  }

  if (reason.length > 500) {
    throw new ApplicationError('Reason cannot exceed 500 characters', 400);
  }

  if (chargeAmount < 0) {
    throw new ApplicationError('Charge amount cannot be negative', 400);
  }

  const booking = await Booking.findById(id)
    .populate('userId', 'name email phone')
    .populate('rooms.roomId', 'roomNumber type');

  bookingService.assertResourceInScopedHotel(booking, scopedHotelId, 'Booking');

  const bookingBeforeNoShow = bookingAuditService.buildSnapshot(booking);
  const noShowTransition = validateTransition(booking.status, 'no_show');
  if (!noShowTransition.valid) {
    throw new ApplicationError(
      `Cannot mark booking as no-show. ${noShowTransition.error}`,
      400
    );
  }

  if (chargeAmount > booking.totalAmount) {
    throw new ApplicationError(
      `Charge amount (${chargeAmount}) cannot exceed total booking amount (${booking.totalAmount})`,
      400
    );
  }

  booking.status = 'no_show';
  booking.noShowRecorded = new Date();
  booking.noShowReason = reason.trim();
  booking.noShowMarkedBy = {
    userId: req.user._id,
    userName: req.user.name,
    userRole: req.user.role
  };
  booking.noShowChargeAmount = chargeAmount;
  booking.noShowChargeApplied = chargeAmount > 0;

  if (chargeAmount > 0) {
    booking.addSettlementAdjustment({
      type: 'penalty',
      amount: chargeAmount,
      description: `No-show charge: ${reason.substring(0, 200)}`
    }, {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    });
  }

  if (!booking.statusHistory) {
    booking.statusHistory = [];
  }

  booking.statusHistory.push({
    status: 'no_show',
    timestamp: new Date(),
    changedBy: {
      source: 'manual',
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role
    },
    reason: reason.substring(0, 200)
  });

  logger.info('No-show marked', {
    bookingNumber: booking.bookingNumber,
    chargeAmount,
    markedBy: req.user._id
  });

  await booking.save();

  await bookingAuditService.logBookingMutation({
    booking,
    changeType: 'update',
    user: req.user,
    req,
    oldValues: bookingBeforeNoShow,
    newValues: bookingAuditService.buildSnapshot(booking),
    metadata: {
      priority: chargeAmount > 0 ? 'high' : 'medium',
      tags: ['booking_no_show'],
      noShowChargeAmount: chargeAmount
    }
  });

  const noShowDetails = {
    markedAt: booking.noShowRecorded,
    markedBy: {
      userId: booking.noShowMarkedBy.userId,
      userName: booking.noShowMarkedBy.userName,
      userRole: booking.noShowMarkedBy.userRole
    },
    reason: booking.noShowReason,
    chargeAmount: booking.noShowChargeAmount,
    charged: booking.noShowChargeApplied
  };

  res.json({
    status: 'success',
    data: {
      booking,
      message: chargeAmount > 0
        ? `Booking marked as no-show successfully with a charge of Rs ${chargeAmount}`
        : 'Booking marked as no-show successfully',
      noShowDetails
    }
  });
});

export {
  getSettlement,
  addSettlementAdjustment,
  paySettlement,
  markNoShow
};
