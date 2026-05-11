import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Payment from '../models/Payment.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import KPI from '../models/KPI.js';
import KPICalculationService from '../services/kpiCalculationService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Review from '../models/Review.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

const resolveHotelIdFromRequest = (req) => req.query.hotelId || req.body.hotelId || req.user?.hotelId;

const getValidatedHotelObjectId = (req) => {
  const resolvedHotelId = resolveHotelIdFromRequest(req);
  if (!resolvedHotelId) {
    return { error: { status: 400, body: { status: 'error', message: 'Hotel context required' } } };
  }
  if (!mongoose.Types.ObjectId.isValid(resolvedHotelId)) {
    return { error: { status: 400, body: { status: 'error', message: 'Invalid hotelId' } } };
  }
  return { hotelObjectId: new mongoose.Types.ObjectId(resolvedHotelId) };
};

// Checkout Inventory Analytics Report
router.get('/checkout-inventory', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    groupBy = 'day', // day, month, year
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  // Build aggregation pipeline to filter by hotel through booking relationship
  const pipeline = [
    { $match: matchQuery },
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking'
      }
    }
  ];

  // Mandatory hotel filtering for tenant isolation
  const resolvedHotelId = req.query.hotelId || req.body.hotelId || req.user?.hotelId;
  if (!resolvedHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  if (!mongoose.Types.ObjectId.isValid(resolvedHotelId)) {
    return res.status(400).json({ status: 'error', message: 'Invalid hotelId format' });
  }
  pipeline.push({ $match: { 'booking.hotelId': new mongoose.Types.ObjectId(resolvedHotelId) } });

  // Group by date format
  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'year':
      dateFormat = '%Y';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  pipeline.push({
    $group: {
      _id: {
        date: { $dateToString: { format: dateFormat, date: '$createdAt' } }
      },
      totalCheckouts: { $sum: 1 },
      totalRevenue: { $sum: '$totalAmount' },
      avgAmount: { $avg: '$totalAmount' },
      roomsCheckedOut: { $addToSet: '$roomId' }
    }
  });

  pipeline.push({ $sort: { '_id.date': 1 } });

  const checkoutData = await CheckoutInventory.aggregate(pipeline);

  // Get summary statistics
  const summaryPipeline = [...pipeline.slice(0, -2)]; // Remove grouping and sorting
  summaryPipeline.push({
    $group: {
      _id: null,
      totalCheckouts: { $sum: 1 },
      totalRevenue: { $sum: '$totalAmount' },
      avgAmount: { $avg: '$totalAmount' },
      uniqueRooms: { $addToSet: '$roomId' }
    }
  });

  const [summary] = await CheckoutInventory.aggregate(summaryPipeline);

  res.json({
    status: 'success',
    data: {
      checkoutData: checkoutData.map(item => ({
        date: item._id.date,
        checkouts: item.totalCheckouts,
        revenue: Math.round(item.totalRevenue || 0),
        avgAmount: Math.round(item.avgAmount || 0),
        uniqueRooms: item.roomsCheckedOut.length
      })),
      summary: {
        totalCheckouts: summary?.totalCheckouts || 0,
        totalRevenue: Math.round(summary?.totalRevenue || 0),
        avgAmount: Math.round(summary?.avgAmount || 0),
        uniqueRooms: summary?.uniqueRooms?.length || 0
      },
      period: { startDate, endDate }
    }
  });
}));

// Revenue report
router.get('/revenue', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    groupBy = 'day', // day, month, year
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  // Mandatory hotel filtering for tenant isolation
  const { hotelObjectId: revenueHotelObjectId, error: revenueHotelError } = getValidatedHotelObjectId(req);
  if (revenueHotelError) {
    return res.status(revenueHotelError.status).json(revenueHotelError.body);
  }
  matchQuery.hotelId = revenueHotelObjectId;

  // Group by format
  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'year':
      dateFormat = '%Y';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          hotelId: '$hotelId'
        },
        totalRevenue: { $sum: '$totalAmount' },
        bookingCount: { $sum: 1 },
        averageBookingValue: { $avg: '$totalAmount' }
      }
    },
    { $sort: { '_id.date': 1 } }
  ];

  logger.debug('Revenue report query executing');

  const results = await Booking.aggregate(pipeline);
  logger.debug('Revenue report results', { count: results.length });

  // Calculate totals
  const summary = {
    totalRevenue: results.reduce((sum, item) => sum + item.totalRevenue, 0),
    totalBookings: results.reduce((sum, item) => sum + item.bookingCount, 0),
    averageBookingValue: results.length > 0 ? 
      results.reduce((sum, item) => sum + item.averageBookingValue, 0) / results.length : 0
  };

  res.json({
    status: 'success',
    data: {
      summary,
      breakdown: results,
      period: { startDate, endDate, groupBy }
    }
  });
}));

// Occupancy report
router.get('/occupancy', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    hotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const matchQuery = {
    $or: [
      { 
        checkIn: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      },
      {
        checkOut: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }
    ]
  };

  // Mandatory hotel filtering for tenant isolation
  const resolvedOccupancyHotelId = req.query.hotelId || req.body.hotelId || req.user?.hotelId;
  if (!resolvedOccupancyHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  matchQuery.hotelId = new mongoose.Types.ObjectId(resolvedOccupancyHotelId);

  // Get bookings in the period
  const bookings = await Booking.find(matchQuery)
    .populate('rooms.roomId', 'type')
    .populate('hotelId', 'name').lean().limit(500);

  // Get total rooms by hotel
  const roomsQuery = { hotelId: resolvedOccupancyHotelId, isActive: true };

  const totalRooms = await Room.countDocuments(roomsQuery);

  // Calculate occupied room nights
  let totalRoomNights = 0;
  const occupancyByType = {};

  bookings.forEach(booking => {
    const nights = booking.nights;
    const roomCount = booking.rooms.length;
    
    totalRoomNights += nights * roomCount;

    booking.rooms.forEach(room => {
      const roomType = room.roomId.type;
      if (!occupancyByType[roomType]) {
        occupancyByType[roomType] = { roomNights: 0, bookings: 0 };
      }
      occupancyByType[roomType].roomNights += nights;
      occupancyByType[roomType].bookings += 1;
    });
  });

  // Calculate date range in days
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
  const totalPossibleRoomNights = totalRooms * daysDiff;

  const occupancyRate = totalPossibleRoomNights > 0 
    ? (totalRoomNights / totalPossibleRoomNights * 100).toFixed(2)
    : 0;

  res.json({
    status: 'success',
    data: {
      summary: {
        occupancyRate: parseFloat(occupancyRate),
        totalRoomNights,
        totalPossibleRoomNights,
        totalRooms,
        periodDays: daysDiff
      },
      occupancyByType,
      period: { startDate, endDate }
    }
  });
}));

// Booking status report
router.get('/bookings', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    hotelId
  } = req.query;

  const matchQuery = {};
  
  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // Mandatory hotel filtering for tenant isolation
  const { hotelObjectId: bookingsHotelObjectId, error: bookingsHotelError } = getValidatedHotelObjectId(req);
  if (bookingsHotelError) {
    return res.status(bookingsHotelError.status).json(bookingsHotelError.body);
  }
  matchQuery.hotelId = bookingsHotelObjectId;

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { count: -1 } }
  ];

  const results = await Booking.aggregate(pipeline);

  const totalBookings = results.reduce((sum, item) => sum + item.count, 0);
  const totalRevenue = results.reduce((sum, item) => sum + item.totalRevenue, 0);

  res.json({
    status: 'success',
    data: {
      summary: {
        totalBookings,
        totalRevenue
      },
      breakdown: results,
      period: startDate && endDate ? { startDate, endDate } : null
    }
  });
}));

// Booking stats for admin dashboard
router.get('/bookings/stats', authenticate, ensureTenantContext, authorize('admin', 'staff', 'frontdesk'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    hotelId
  } = req.query;

  const matchQuery = {};
  
  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // Mandatory hotel filtering for tenant isolation
  const { hotelObjectId: statsHotelObjectId, error: statsHotelError } = getValidatedHotelObjectId(req);
  if (statsHotelError) {
    return res.status(statsHotelError.status).json(statsHotelError.body);
  }
  matchQuery.hotelId = statsHotelObjectId;

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageBookingValue: { $avg: '$totalAmount' },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        confirmed: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
        },
        checkedIn: {
          $sum: { $cond: [{ $eq: ['$status', 'checked_in'] }, 1, 0] }
        },
        checkedOut: {
          $sum: { $cond: [{ $eq: ['$status', 'checked_out'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    }
  ];

  const results = await Booking.aggregate(pipeline);
  logger.debug('Booking stats results', { count: results.length });

  const stats = results.length > 0 ? results[0] : {
    total: 0,
    totalRevenue: 0,
    averageBookingValue: 0,
    pending: 0,
    confirmed: 0,
    checkedIn: 0,
    checkedOut: 0,
    cancelled: 0
  };

  res.json({
    status: 'success',
    data: {
      stats
    }
  });
}));

// Revenue breakdown - detailed breakdown of revenue sources
router.get('/revenue-breakdown', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    month,
    year,
    hotelId
  } = req.query;

  // Default to current month if not provided
  const currentDate = new Date();
  const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth(); // JS months are 0-based
  const targetYear = year ? parseInt(year) : currentDate.getFullYear();

  // Create start and end dates for the month
  const startDate = new Date(targetYear, targetMonth, 1);
  const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59); // Last day of month

  logger.debug('Revenue breakdown query', { startDate, endDate, hotelId });

  const matchQuery = {
    status: { $in: ['checked_out', 'confirmed', 'checked_in'] },
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  };

  // Mandatory hotel filtering for tenant isolation
  const resolvedBreakdownHotelId = req.query.hotelId || req.body.hotelId || req.user?.hotelId;
  if (!resolvedBreakdownHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  matchQuery.hotelId = new mongoose.Types.ObjectId(resolvedBreakdownHotelId);

  // Get detailed booking data
  const bookings = await Booking.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'rooms',
        localField: 'rooms.roomId',
        foreignField: '_id',
        as: 'roomDetails'
      }
    },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'bookingId',
        as: 'payments'
      }
    },
    {
      $project: {
        _id: 1,
        totalAmount: 1,
        status: 1,
        checkIn: 1,
        checkOut: 1,
        createdAt: 1,
        roomDetails: 1,
        payments: 1,
        rooms: 1
      }
    }
  ]);

  logger.debug('Revenue breakdown bookings found', { count: bookings.length });

  // Calculate breakdown
  let roomRevenue = 0;
  let taxRevenue = 0;
  let serviceRevenue = 0;
  let extraCharges = 0;
  let refunds = 0;

  const revenueByRoomType = {
    single: 0,
    double: 0,
    suite: 0,
    deluxe: 0
  };

  const revenueByWeek = [0, 0, 0, 0, 0]; // 5 weeks max in a month
  const revenueByStatus = {
    confirmed: 0,
    checked_in: 0,
    checked_out: 0
  };

  bookings.forEach(booking => {
    const bookingRevenue = booking.totalAmount || 0;
    
    // Base room revenue (80% of total)
    const baseRoom = bookingRevenue * 0.8;
    roomRevenue += baseRoom;
    
    // Tax (18% of base)
    const tax = baseRoom * 0.18;
    taxRevenue += tax;
    
    // Service charges (10% of base)
    const service = baseRoom * 0.1;
    serviceRevenue += service;
    
    // Extra charges (remaining)
    const extra = bookingRevenue - baseRoom - tax - service;
    extraCharges += Math.max(0, extra);

    // Revenue by room type
    if (booking.roomDetails && booking.roomDetails.length > 0) {
      booking.roomDetails.forEach(room => {
        const roomTypeRevenue = bookingRevenue / booking.roomDetails.length;
        if (revenueByRoomType[room.type] !== undefined) {
          revenueByRoomType[room.type] += roomTypeRevenue;
        }
      });
    }

    // Revenue by week (based on check-in date)
    const checkInDate = new Date(booking.checkIn);
    const weekOfMonth = Math.ceil(checkInDate.getDate() / 7) - 1;
    if (weekOfMonth >= 0 && weekOfMonth < 5) {
      revenueByWeek[weekOfMonth] += bookingRevenue;
    }

    // Revenue by status
    if (revenueByStatus[booking.status] !== undefined) {
      revenueByStatus[booking.status] += bookingRevenue;
    }
  });

  // Handle any refunds from payments
  bookings.forEach(booking => {
    if (booking.payments) {
      booking.payments.forEach(payment => {
        if (payment.status === 'refunded') {
          refunds += payment.amount || 0;
        }
      });
    }
  });

  const totalRevenue = roomRevenue + taxRevenue + serviceRevenue + extraCharges - refunds;

  const breakdown = {
    total: totalRevenue,
    components: {
      roomRevenue: {
        amount: roomRevenue,
        percentage: totalRevenue > 0 ? (roomRevenue / totalRevenue * 100).toFixed(1) : 0,
        label: 'Room Charges'
      },
      taxRevenue: {
        amount: taxRevenue,
        percentage: totalRevenue > 0 ? (taxRevenue / totalRevenue * 100).toFixed(1) : 0,
        label: 'Taxes & GST'
      },
      serviceRevenue: {
        amount: serviceRevenue,
        percentage: totalRevenue > 0 ? (serviceRevenue / totalRevenue * 100).toFixed(1) : 0,
        label: 'Service Charges'
      },
      extraCharges: {
        amount: extraCharges,
        percentage: totalRevenue > 0 ? (extraCharges / totalRevenue * 100).toFixed(1) : 0,
        label: 'Extra Services'
      }
    },
    byRoomType: Object.entries(revenueByRoomType).map(([type, amount]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      amount,
      percentage: totalRevenue > 0 ? (amount / totalRevenue * 100).toFixed(1) : 0
    })).filter(item => item.amount > 0),
    byWeek: revenueByWeek.map((amount, index) => ({
      week: index + 1,
      amount,
      percentage: totalRevenue > 0 ? (amount / totalRevenue * 100).toFixed(1) : 0
    })).filter(item => item.amount > 0),
    byStatus: Object.entries(revenueByStatus).map(([status, amount]) => ({
      status: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      amount,
      percentage: totalRevenue > 0 ? (amount / totalRevenue * 100).toFixed(1) : 0
    })).filter(item => item.amount > 0),
    metrics: {
      totalBookings: bookings.length,
      averageBookingValue: bookings.length > 0 ? totalRevenue / bookings.length : 0,
      refunds: refunds,
      netRevenue: totalRevenue - refunds
    },
    period: {
      month: targetMonth + 1,
      year: targetYear,
      monthName: new Date(targetYear, targetMonth, 1).toLocaleString('en-US', { month: 'long' })
    }
  };

  logger.debug('Revenue breakdown calculated');

  res.json({
    status: 'success',
    data: breakdown
  });
}));

// Occupancy breakdown - detailed occupancy analysis
router.get('/occupancy-breakdown', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    month,
    year,
    hotelId
  } = req.query;

  // Use UTC dates to match booking dates (which are stored in UTC)
  const currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0); // Start of today in UTC

  // For current occupancy, we only care about bookings that are active TODAY
  const matchQuery = {
    status: { $in: ['confirmed', 'checked_in'] }, // Only active bookings
    checkIn: { $lte: currentDate }, // Check-in date has passed
    checkOut: { $gte: currentDate }  // Check-out date is today or in the future (guest stays until end of day)
  };

  // Mandatory hotel filtering for tenant isolation
  const resolvedOccBreakdownHotelId = req.query.hotelId || req.body.hotelId || req.user?.hotelId;
  if (!resolvedOccBreakdownHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  matchQuery.hotelId = new mongoose.Types.ObjectId(resolvedOccBreakdownHotelId);

  // Get bookings and rooms data
  const [bookings, rooms] = await Promise.all([
    Booking.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'rooms',
          localField: 'rooms.roomId',
          foreignField: '_id',
          as: 'roomDetails'
        }
      }
    ]),
    Room.find({
      hotelId: resolvedOccBreakdownHotelId,
      isActive: true
    })
  ]);
  
  logger.debug('Current occupancy query result', { totalRooms: rooms.length, activeBookings: bookings.length });

  const totalRooms = rooms.length;
  
  // Count currently occupied rooms
  let currentlyOccupiedRooms = 0;
  const occupiedRoomsByType = {};
  const occupiedRoomsList = [];
  const availableRoomsList = [];
  
  // Initialize room type tracking with all available room types
  rooms.forEach(room => {
    if (!occupiedRoomsByType[room.type]) {
      occupiedRoomsByType[room.type] = {
        occupied: 0,
        total: 0
      };
    }
    occupiedRoomsByType[room.type].total++;
  });

  // Track which specific rooms are occupied
  const occupiedRoomIds = new Set();
  const roomBookingMap = new Map(); // Track which booking each room belongs to

  bookings.forEach(booking => {
    if (booking.roomDetails && booking.roomDetails.length > 0) {
      booking.roomDetails.forEach(room => {
        const roomIdStr = room._id.toString();

        // Only count each room once, even if it appears in multiple bookings
        if (!occupiedRoomIds.has(roomIdStr)) {
          occupiedRoomIds.add(roomIdStr);
          currentlyOccupiedRooms++;

          if (occupiedRoomsByType[room.type]) {
            occupiedRoomsByType[room.type].occupied++;
          }

          // Store the booking info for this room
          roomBookingMap.set(roomIdStr, {
            roomNumber: room.roomNumber,
            type: room.type,
            guestName: booking.guestName || 'Guest',
            status: booking.status,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut
          });
        }
      });
    }
  });

  // Convert the room booking map to the occupied rooms list (no duplicates)
  occupiedRoomsList.push(...Array.from(roomBookingMap.values()));
  
  // Get available rooms
  rooms.forEach(room => {
    if (!occupiedRoomIds.has(room._id.toString())) {
      availableRoomsList.push({
        roomNumber: room.roomNumber,
        type: room.type,
        status: 'available'
      });
    }
  });

  const currentOccupancyRate = totalRooms > 0 ? (currentlyOccupiedRooms / totalRooms * 100) : 0;
    
  logger.debug('Current occupancy results', { totalRooms, currentlyOccupiedRooms, occupancyRate: currentOccupancyRate.toFixed(1) });

  const breakdown = {
    overall: {
      rate: currentOccupancyRate,
      totalRooms,
      occupiedRooms: currentlyOccupiedRooms,
      availableRooms: totalRooms - currentlyOccupiedRooms
    },
    byRoomType: Object.entries(occupiedRoomsByType).map(([type, data]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      rate: data.total > 0 ? (data.occupied / data.total * 100) : 0,
      occupiedRooms: data.occupied,
      totalRooms: data.total,
      percentage: currentlyOccupiedRooms > 0 ? ((data.occupied / currentlyOccupiedRooms) * 100).toFixed(1) : '0.0'
    })),
    occupiedRooms: occupiedRoomsList,
    availableRooms: availableRoomsList.slice(0, 10), // Limit to first 10 for display
    peakDays: [], // Not relevant for current occupancy
    metrics: {
      averageRate: currentOccupancyRate,
      peakOccupancy: currentOccupancyRate, // Current is the "peak" for now
      lowestOccupancy: currentOccupancyRate, // Current is the "lowest" for now
      roomNights: currentlyOccupiedRooms
    },
    period: {
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      monthName: currentDate.toLocaleString('en-US', { month: 'long' }),
      currentTime: currentDate.toLocaleString()
    }
  };

  res.json({
    status: 'success',
    data: breakdown
  });
}));

// Bookings breakdown - detailed bookings analysis
router.get('/bookings-breakdown', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    month,
    year,
    hotelId
  } = req.query;

  const currentDate = new Date();
  const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
  const targetYear = year ? parseInt(year) : currentDate.getFullYear();

  const startDate = new Date(targetYear, targetMonth, 1);
  const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

  const matchQuery = {
    createdAt: { $gte: startDate, $lte: endDate }
  };

  // Mandatory hotel filtering for tenant isolation
  const resolvedBkgBreakdownHotelId = req.query.hotelId || req.body.hotelId || req.user?.hotelId;
  if (!resolvedBkgBreakdownHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  matchQuery.hotelId = new mongoose.Types.ObjectId(resolvedBkgBreakdownHotelId);

  const bookings = await Booking.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'rooms',
        localField: 'rooms.roomId',
        foreignField: '_id',
        as: 'roomDetails'
      }
    }
  ]);

  const statusBreakdown = {};
  const sourceBreakdown = { direct: 0, ota: 0, walk_in: 0 };
  const weeklyBookings = [0, 0, 0, 0, 0];
  const roomTypeBookings = {};
  
  let totalRevenue = 0;
  let cancelledBookings = 0;
  let noShowBookings = 0;

  bookings.forEach(booking => {
    // Status breakdown
    const status = booking.status;
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    
    if (status === 'cancelled') cancelledBookings++;
    if (status === 'no_show') noShowBookings++;
    
    // Revenue calculation
    totalRevenue += booking.totalAmount || 0;
    
    // Source breakdown (mock data for now)
    const source = booking.source || 'direct';
    if (sourceBreakdown[source] !== undefined) {
      sourceBreakdown[source]++;
    } else {
      sourceBreakdown.direct++;
    }
    
    // Weekly breakdown
    const weekOfMonth = Math.ceil(new Date(booking.createdAt).getDate() / 7) - 1;
    if (weekOfMonth >= 0 && weekOfMonth < 5) {
      weeklyBookings[weekOfMonth]++;
    }
    
    // Room type breakdown
    booking.roomDetails?.forEach(room => {
      const type = room.type;
      roomTypeBookings[type] = (roomTypeBookings[type] || 0) + 1;
    });
  });

  const breakdown = {
    total: bookings.length,
    byStatus: Object.entries(statusBreakdown).map(([status, count]) => ({
      status: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count,
      percentage: bookings.length > 0 ? (count / bookings.length * 100).toFixed(1) : 0,
      revenue: (booking => {
        const statusRevenue = bookings
          .filter(b => b.status === status)
          .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        return statusRevenue;
      })()
    })),
    bySource: Object.entries(sourceBreakdown).map(([source, count]) => ({
      source: source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count,
      percentage: bookings.length > 0 ? (count / bookings.length * 100).toFixed(1) : 0,
      averageValue: count > 0 ? totalRevenue / count : 0
    })),
    weekly: weeklyBookings.map((count, index) => ({
      week: index + 1,
      count,
      revenue: bookings
        .filter(b => Math.ceil(new Date(b.createdAt).getDate() / 7) - 1 === index)
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      averageValue: count > 0 ? (bookings
        .filter(b => Math.ceil(new Date(b.createdAt).getDate() / 7) - 1 === index)
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0) / count) : 0
    })).filter(item => item.count > 0),
    metrics: {
      totalRevenue,
      averageBookingValue: bookings.length > 0 ? totalRevenue / bookings.length : 0,
      confirmationRate: bookings.length > 0 ? ((bookings.length - cancelledBookings) / bookings.length * 100) : 0,
      cancellationRate: bookings.length > 0 ? (cancelledBookings / bookings.length * 100) : 0
    },
    period: {
      month: targetMonth + 1,
      year: targetYear,
      monthName: new Date(targetYear, targetMonth, 1).toLocaleString('en-US', { month: 'long' })
    }
  };

  res.json({
    status: 'success',
    data: breakdown
  });
}));

// Guest satisfaction breakdown - detailed satisfaction analysis
router.get('/satisfaction-breakdown', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    month,
    year,
    hotelId
  } = req.query;

  const currentDate = new Date();
  const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
  const targetYear = year ? parseInt(year) : currentDate.getFullYear();

  const startDate = new Date(targetYear, targetMonth, 1);
  const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

  // Build hotel filter with mandatory tenant isolation
  const resolvedSatisfactionHotelId = req.query.hotelId || req.body.hotelId || req.user?.hotelId;
  if (!resolvedSatisfactionHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }
  const reviewFilter = { createdAt: { $gte: startDate, $lte: endDate } };
  reviewFilter.hotelId = new mongoose.Types.ObjectId(resolvedSatisfactionHotelId);

  // Aggregate real reviews from the Review model
  const reviews = await Review.find(reviewFilter).lean().limit(1000);
  const totalReviews = reviews.length;

  // Calculate overall rating
  const overallRating = totalReviews > 0
    ? Math.round((reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews) * 10) / 10
    : 0;

  // Build rating distribution
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => {
    const rounded = Math.round(r.rating || 0);
    if (rounded >= 1 && rounded <= 5) distribution[rounded]++;
  });

  // Calculate category averages from review categories field
  const categoryKeys = ['cleanliness', 'service', 'location', 'value', 'amenities'];
  const categoryRatings = categoryKeys.map(key => {
    const rated = reviews.filter(r => r.categories && r.categories[key]);
    const avg = rated.length > 0
      ? Math.round((rated.reduce((sum, r) => sum + r.categories[key], 0) / rated.length) * 10) / 10
      : 0;
    return {
      category: key.charAt(0).toUpperCase() + key.slice(1),
      rating: avg,
      reviews: rated.length
    };
  });

  // Calculate trend vs previous month
  const prevMonthStart = new Date(targetYear, targetMonth - 1, 1);
  const prevMonthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59);
  const prevFilter = { ...reviewFilter, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } };
  const prevReviews = await Review.find(prevFilter).lean().limit(1000);
  const prevRating = prevReviews.length > 0
    ? Math.round((prevReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / prevReviews.length) * 10) / 10
    : 0;
  const improvement = Math.round((overallRating - prevRating) * 10) / 10;

  // Generate insights from real data
  const insights = [];
  if (totalReviews === 0) {
    insights.push('No reviews found for this period.');
  } else {
    const bestCategory = categoryRatings.reduce((best, c) => c.rating > best.rating ? c : best, { rating: 0, category: 'N/A' });
    const worstCategory = categoryRatings.filter(c => c.rating > 0).reduce((worst, c) => c.rating < worst.rating ? c : worst, { rating: 6, category: 'N/A' });
    if (bestCategory.rating > 0) insights.push(`${bestCategory.category} rated highest at ${bestCategory.rating}/5`);
    if (worstCategory.rating < 6) insights.push(`${worstCategory.category} needs improvement at ${worstCategory.rating}/5`);
    const goodReviews = reviews.filter(r => r.rating >= 4).length;
    insights.push(`${totalReviews > 0 ? Math.round((goodReviews / totalReviews) * 100) : 0}% of guests rate their experience as good or excellent`);
  }

  const breakdown = {
    overallRating,
    totalReviews,
    ratingDistribution: Object.entries(distribution).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
      percentage: totalReviews > 0 ? (count / totalReviews * 100).toFixed(1) : '0.0'
    })).reverse(),
    categoryRatings,
    trends: {
      monthlyChange: improvement,
      trend: improvement >= 0 ? 'up' : 'down'
    },
    insights,
    period: {
      month: targetMonth + 1,
      year: targetYear,
      monthName: new Date(targetYear, targetMonth, 1).toLocaleString('en-US', { month: 'long' })
    }
  };

  res.json({
    status: 'success',
    data: breakdown
  });
}));

// Enhanced KPI Reports - Calculate and retrieve comprehensive KPIs
router.post('/kpi/calculate', authenticate, ensureTenantContext, authorizePolicy('reports', 'staffAccess'), ensurePropertyAccess, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { date, period = 'daily' } = req.body;
  
  if (!date) {
    throw new ApplicationError('Date is required for KPI calculation', 400);
  }

  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const kpi = await KPICalculationService.calculateKPIs(hotelId, new Date(date), period);

  res.json({
    status: 'success',
    data: {
      kpi,
      message: `KPI calculated successfully for ${period} period on ${date}`
    }
  });
}));

// Get KPI data for a specific period
router.get('/kpi', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    startDate,
    endDate,
    period = 'daily',
    hotelId: requestedHotelId
  } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const hotelId = req.user.role === 'staff' ? req.user.hotelId : requestedHotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const kpis = await KPI.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    period
  }).sort({ date: 1 }).lean().limit(1000);

  // Get aggregated data for the period
  const aggregated = await KPI.getAggregatedKPIs(hotelId, startDate, endDate, period);

  res.json({
    status: 'success',
    data: {
      kpis,
      aggregated,
      summary: {
        totalRecords: kpis.length,
        period: { startDate, endDate, period }
      }
    }
  });
}));

// Get comprehensive business intelligence dashboard data
router.get('/business-intelligence', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    month,
    year,
    hotelId: requestedHotelId
  } = req.query;

  const currentDate = new Date();
  const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
  const targetYear = year ? parseInt(year) : currentDate.getFullYear();

  const startDate = new Date(targetYear, targetMonth, 1);
  const endDate = new Date(targetYear, targetMonth + 1, 0);

  const hotelId = req.user.role === 'staff' ? req.user.hotelId : requestedHotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Get monthly KPI data
  const monthlyKPI = await KPI.findOne({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    date: startDate,
    period: 'monthly'
  }).lean();

  // If monthly KPI doesn't exist, calculate it
  let kpiData = monthlyKPI;
  if (!kpiData) {
    kpiData = await KPICalculationService.calculateKPIs(hotelId, startDate, 'monthly');
  }

  // Get trend data for key metrics (last 12 months)
  const trendStartDate = new Date(targetYear, targetMonth - 11, 1);
  const trends = await Promise.all([
    KPI.getTrendData(hotelId, 'rates.adr', 365),
    KPI.getTrendData(hotelId, 'occupancy.occupancyRate', 365),
    KPI.getTrendData(hotelId, 'revenue.totalRevenue', 365),
    KPI.getTrendData(hotelId, 'risk.guestSatisfaction.averageRating', 365)
  ]);

  // Use actual trend data if available; return empty array if no historical data exists
  // (do not generate fake trend data with random noise)
  const trendData = {
    adr: trends[0].length > 0 ? trends[0] : [],
    occupancy: trends[1].length > 0 ? trends[1] : [],
    revenue: trends[2].length > 0 ? trends[2] : [],
    satisfaction: trends[3].length > 0 ? trends[3] : []
  };

  // Performance score
  const performanceScore = kpiData ? kpiData.getPerformanceScore() : 0;

  // Key insights
  const insights = [];
  if (kpiData) {
    if (kpiData.occupancy.occupancyRate > 80) {
      insights.push('Excellent occupancy rate - consider rate optimization');
    }
    if (kpiData.rates.adr > 4000) {
      insights.push('Strong ADR performance - premium positioning effective');
    }
    if (kpiData.risk.guestSatisfaction.averageRating < 3.5) {
      insights.push('Guest satisfaction needs attention - review service quality');
    }
    if (kpiData.profitability.gop / kpiData.revenue.totalRevenue > 0.3) {
      insights.push('Healthy profit margins - efficient operations');
    }
  }

  const businessIntelligence = {
    overview: {
      performanceScore: Math.round(performanceScore),
      period: {
        month: targetMonth + 1,
        year: targetYear,
        monthName: new Date(targetYear, targetMonth, 1).toLocaleString('en-US', { month: 'long' })
      }
    },
    
    // Revenue metrics with formulas from task.md
    revenue: kpiData ? {
      roomRevenue: kpiData.revenue.roomRevenue,
      adr: kpiData.rates.adr,
      revpar: kpiData.rates.revpar,
      totalRevenue: kpiData.revenue.totalRevenue,
      averageRoomProfit: kpiData.calculateAverageRoomProfit(),
      breakdown: {
        roomRevenue: kpiData.revenue.roomRevenue,
        nonRoomRevenue: kpiData.revenue.nonRoomRevenue,
        addOns: kpiData.revenue.addOns,
        discounts: kpiData.revenue.discounts,
        taxes: kpiData.revenue.taxes
      }
    } : null,
    
    // Occupancy metrics
    occupancy: kpiData ? {
      occupancyRate: kpiData.occupancy.occupancyRate,
      roomNightsSold: kpiData.occupancy.roomNightsSold,
      availableRoomNights: kpiData.occupancy.availableRoomNights
    } : null,
    
    // Profitability metrics
    profitability: kpiData ? {
      gop: kpiData.profitability.gop,
      goppar: kpiData.profitability.goppar,
      cpor: kpiData.profitability.cpor,
      marginPercent: kpiData.revenue.totalRevenue > 0 ? 
        (kpiData.profitability.gop / kpiData.revenue.totalRevenue * 100) : 0
    } : null,
    
    // Productivity metrics
    productivity: kpiData ? {
      housekeeping: {
        cleanedRoomsPerHour: kpiData.productivity.housekeeping.productivity,
        cleanedRooms: kpiData.productivity.housekeeping.cleanedRooms,
        efficiency: kpiData.productivity.housekeeping.productivity > 1.5 ? 'High' : 
                   kpiData.productivity.housekeeping.productivity > 1 ? 'Medium' : 'Low'
      },
      maintenance: {
        workOrdersPerHour: kpiData.productivity.maintenance.productivity,
        workOrdersClosed: kpiData.productivity.maintenance.workOrdersClosed,
        efficiency: kpiData.productivity.maintenance.productivity > 0.5 ? 'High' : 
                   kpiData.productivity.maintenance.productivity > 0.25 ? 'Medium' : 'Low'
      },
      frontDesk: {
        transactionsPerHour: kpiData.productivity.frontDesk.productivity,
        totalTransactions: kpiData.productivity.frontDesk.checkIns + kpiData.productivity.frontDesk.checkOuts,
        efficiency: kpiData.productivity.frontDesk.productivity > 2 ? 'High' : 
                   kpiData.productivity.frontDesk.productivity > 1 ? 'Medium' : 'Low'
      }
    } : null,
    
    // Risk & Quality metrics
    risk: kpiData ? {
      noShowRate: kpiData.risk.noShowRate,
      cancellationRate: kpiData.risk.cancellationRate,
      guestSatisfaction: kpiData.risk.guestSatisfaction.averageRating,
      npsScore: kpiData.risk.guestSatisfaction.npsScore,
      fiveStarPercentage: kpiData.risk.guestSatisfaction.fiveStarPercentage
    } : null,
    
    // Floor-wise performance
    floorMetrics: kpiData ? kpiData.floorMetrics.map(floor => ({
      floor: floor.floor,
      profit: floor.floorProfit,
      revenue: floor.roomRevenue,
      profitMargin: floor.roomRevenue > 0 ? (floor.floorProfit / floor.roomRevenue * 100) : 0
    })) : [],
    
    // Trends
    trends: trendData,
    
    // Key insights
    insights,
    
    // Recommendations
    recommendations: [
      kpiData && kpiData.occupancy.occupancyRate < 60 ? 'Focus on marketing and rate optimization' : null,
      kpiData && kpiData.rates.adr < 3000 ? 'Consider premium service additions to increase ADR' : null,
      kpiData && kpiData.risk.guestSatisfaction.averageRating < 4 ? 'Implement guest feedback improvement program' : null,
      kpiData && kpiData.productivity.housekeeping.productivity < 1 ? 'Optimize housekeeping workflows and training' : null
    ].filter(Boolean)
  };

  res.json({
    status: 'success',
    data: businessIntelligence
  });
}));

// Batch calculate KPIs for a date range
router.post('/kpi/batch-calculate', authenticate, ensureTenantContext, authorizePolicy('reports', 'adminAccess'), ensurePropertyAccess, validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { startDate, endDate, period = 'daily', hotelId } = req.body;
  
  if (!startDate || !endDate || !hotelId) {
    throw new ApplicationError('Start date, end date, and hotel ID are required', 400);
  }

  const results = await KPICalculationService.batchCalculateKPIs(
    hotelId, 
    new Date(startDate), 
    new Date(endDate), 
    period
  );

  res.json({
    status: 'success',
    data: {
      calculatedKPIs: results.length,
      results,
      message: `Batch calculated ${results.length} KPI records`
    }
  });
}));

// Get performance comparison between periods
router.get('/kpi/compare', authenticate, ensureTenantContext, authorize('admin', 'staff'), ensurePropertyAccess, catchAsync(async (req, res) => {
  const {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    period = 'daily',
    hotelId: requestedHotelId
  } = req.query;

  if (!currentStart || !currentEnd || !previousStart || !previousEnd) {
    throw new ApplicationError('All date parameters are required for comparison', 400);
  }

  const hotelId = req.user.role === 'staff' ? req.user.hotelId : requestedHotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [currentPeriod, previousPeriod] = await Promise.all([
    KPI.getAggregatedKPIs(hotelId, currentStart, currentEnd, period),
    KPI.getAggregatedKPIs(hotelId, previousStart, previousEnd, period)
  ]);

  // Calculate percentage changes
  const comparison = {
    revenue: {
      current: currentPeriod.totalRoomRevenue || 0,
      previous: previousPeriod.totalRoomRevenue || 0,
      change: previousPeriod.totalRoomRevenue ? 
        ((currentPeriod.totalRoomRevenue - previousPeriod.totalRoomRevenue) / previousPeriod.totalRoomRevenue * 100) : 0
    },
    occupancy: {
      current: currentPeriod.avgOccupancy || 0,
      previous: previousPeriod.avgOccupancy || 0,
      change: previousPeriod.avgOccupancy ? 
        ((currentPeriod.avgOccupancy - previousPeriod.avgOccupancy) / previousPeriod.avgOccupancy * 100) : 0
    },
    adr: {
      current: currentPeriod.avgADR || 0,
      previous: previousPeriod.avgADR || 0,
      change: previousPeriod.avgADR ? 
        ((currentPeriod.avgADR - previousPeriod.avgADR) / previousPeriod.avgADR * 100) : 0
    },
    revpar: {
      current: currentPeriod.avgRevPAR || 0,
      previous: previousPeriod.avgRevPAR || 0,
      change: previousPeriod.avgRevPAR ? 
        ((currentPeriod.avgRevPAR - previousPeriod.avgRevPAR) / previousPeriod.avgRevPAR * 100) : 0
    },
    guestSatisfaction: {
      current: currentPeriod.avgGuestSatisfaction || 0,
      previous: previousPeriod.avgGuestSatisfaction || 0,
      change: previousPeriod.avgGuestSatisfaction ? 
        ((currentPeriod.avgGuestSatisfaction - previousPeriod.avgGuestSatisfaction) / previousPeriod.avgGuestSatisfaction * 100) : 0
    }
  };

  res.json({
    status: 'success',
    data: {
      comparison,
      periods: {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd }
      },
      summary: {
        improvedMetrics: Object.keys(comparison).filter(key => comparison[key].change > 0).length,
        declinedMetrics: Object.keys(comparison).filter(key => comparison[key].change < 0).length
      }
    }
  });
}));

export default router;