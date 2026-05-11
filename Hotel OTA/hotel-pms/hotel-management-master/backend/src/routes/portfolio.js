import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess, getUserPropertyIds } from '../middleware/propertyAccess.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All portfolio routes require authentication and admin/manager authorization
router.use(authenticate);
router.use(ensureTenantContext);
router.use(authorize('admin', 'manager'));

/**
 * Get all accessible property IDs for the current user.
 * Uses getUserPropertyIds which includes owned + assigned + hotelId + allowedProperties.
 */
async function getAccessibleProperties(user) {
  const propertyIds = await getUserPropertyIds(user._id, user);
  if (!propertyIds || propertyIds.length === 0) return { propertyIds: [], properties: [] };
  const properties = await Hotel.find({ _id: { $in: propertyIds }, isActive: { $ne: false } })
    .select('name address')
    .lean()
    .limit(1000);
  return { propertyIds: properties.map(p => p._id), properties };
}

/**
 * @swagger
 * /portfolio/metrics:
 *   get:
 *     summary: Get aggregated metrics across all user's properties
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portfolio metrics
 */
router.get('/metrics', catchAsync(async (req, res) => {
  // Get all accessible properties (owned + assigned + hotelId + allowedProperties)
  const { propertyIds, properties } = await getAccessibleProperties(req.user);

  if (properties.length === 0) {
    return res.json({
      success: true,
      data: {
        totalProperties: 0,
        totalRooms: 0,
        totalBookings: 0,
        totalRevenue: 0,
        avgOccupancy: 0,
        properties: []
      }
    });
  }

  logger.debug('Portfolio metrics', { propertiesFound: properties.length });

  // Get current date for occupancy calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Aggregate metrics across all properties
  const [
    totalRooms,
    totalBookings,
    revenueData,
    occupiedRooms,
    guestCount
  ] = await Promise.all([
    // Total rooms - only count rooms that explicitly have isActive=true or undefined (default active)
    Room.countDocuments({
      hotelId: { $in: propertyIds }
      // Don't filter by isActive - count all rooms for these properties
    }),

    // Total bookings (all statuses)
    Booking.countDocuments({
      hotelId: { $in: propertyIds },
      status: { $in: ['confirmed', 'checked_in', 'checked_out', 'pending'] }
    }),

    // Total revenue
    Booking.aggregate([
      {
        $match: {
          hotelId: { $in: propertyIds },
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]),

    // Current occupancy (rooms currently occupied)
    Booking.aggregate([
      {
        $match: {
          hotelId: { $in: propertyIds },
          status: { $in: ['confirmed', 'checked_in'] },
          checkIn: { $lte: tomorrow },
          checkOut: { $gt: today }
        }
      },
      {
        $unwind: '$rooms'
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }
        }
      }
    ]),

    // Total guests
    User.countDocuments({
      hotelId: { $in: propertyIds },
      role: 'guest'
    })
  ]);

  const totalRevenue = revenueData[0]?.total || 0;
  const occupiedCount = occupiedRooms[0]?.count || 0;
  const avgOccupancy = totalRooms > 0 ? (occupiedCount / totalRooms) * 100 : 0;

  logger.debug('Portfolio metrics calculated', { totalRooms, occupiedCount, totalRevenue });

  res.json({
    success: true,
    data: {
      totalProperties: properties.length,
      totalRooms,
      totalBookings,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOccupancy: Math.round(avgOccupancy * 100) / 100,
      totalGuests: guestCount,
      occupiedRooms: occupiedCount,
      vacantRooms: totalRooms - occupiedCount,
      properties: properties.map(p => ({
        id: p._id,
        name: p.name,
        city: p.address?.city || 'N/A',
        totalRooms: p.totalRooms || 0
      }))
    }
  });
}));

/**
 * @swagger
 * /portfolio/dashboard:
 *   get:
 *     summary: Get consolidated dashboard for all properties
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: 30d
 *         description: Time period (7d, 30d, 90d, 1y)
 *     responses:
 *       200:
 *         description: Portfolio dashboard data
 */
router.get('/dashboard', catchAsync(async (req, res) => {
  const { period = '30d' } = req.query;

  // Get all accessible properties (owned + assigned + hotelId + allowedProperties)
  const { propertyIds, properties } = await getAccessibleProperties(req.user);

  if (properties.length === 0) {
    return res.json({
      success: true,
      data: {
        metrics: {},
        trends: [],
        propertyBreakdown: []
      }
    });
  }

  // Calculate date range based on period
  const endDate = new Date();
  const startDate = new Date();
  const days = parseInt(period.replace(/[^0-9]/g, ''));

  if (period.includes('d')) {
    startDate.setDate(startDate.getDate() - days);
  } else if (period.includes('y')) {
    startDate.setFullYear(startDate.getFullYear() - days);
  }

  // Get daily revenue and booking trends
  const dailyTrends = await Booking.aggregate([
    {
      $match: {
        hotelId: { $in: propertyIds },
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        revenue: {
          $sum: {
            $cond: [
              { $eq: ['$paymentStatus', 'paid'] },
              '$totalAmount',
              0
            ]
          }
        },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  // Get property-wise breakdown
  const propertyBreakdown = await Promise.all(
    properties.map(async (property) => {
      const [bookingCount, revenue, occupancy] = await Promise.all([
        Booking.countDocuments({
          hotelId: property._id,
          createdAt: { $gte: startDate, $lte: endDate }
        }),

        Booking.aggregate([
          {
            $match: {
              hotelId: property._id,
              paymentStatus: 'paid',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalAmount' }
            }
          }
        ]),

        // Calculate average occupancy for period
        calculatePropertyOccupancyRate(property._id, startDate, endDate)
      ]);

      return {
        property: {
          id: property._id,
          name: property.name,
          city: property.address?.city || 'N/A',
          totalRooms: property.totalRooms || 0
        },
        metrics: {
          bookings: bookingCount,
          revenue: revenue[0]?.total || 0,
          occupancy: Math.round(occupancy * 100) / 100
        }
      };
    })
  );

  res.json({
    success: true,
    data: {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      trends: dailyTrends.map(t => ({
        date: t._id.date,
        revenue: t.revenue,
        bookings: t.bookings
      })),
      propertyBreakdown,
      summary: {
        totalRevenue: propertyBreakdown.reduce((sum, p) => sum + p.metrics.revenue, 0),
        totalBookings: propertyBreakdown.reduce((sum, p) => sum + p.metrics.bookings, 0),
        avgOccupancy: propertyBreakdown.length > 0
          ? propertyBreakdown.reduce((sum, p) => sum + p.metrics.occupancy, 0) / propertyBreakdown.length
          : 0
      }
    }
  });
}));

/**
 * @swagger
 * /portfolio/revenue:
 *   get:
 *     summary: Get revenue breakdown across properties
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Revenue breakdown
 */
router.get('/revenue', catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ApplicationError('Start date and end date are required', 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get all accessible properties
  const { propertyIds } = await getAccessibleProperties(req.user);

  // Get revenue breakdown by property
  const revenueByProperty = await Booking.aggregate([
    {
      $match: {
        hotelId: { $in: propertyIds },
        paymentStatus: 'paid',
        createdAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: '$hotelId',
        revenue: { $sum: '$totalAmount' },
        bookings: { $sum: 1 },
        avgBookingValue: { $avg: '$totalAmount' }
      }
    },
    {
      $lookup: {
        from: 'hotels',
        localField: '_id',
        foreignField: '_id',
        as: 'hotel'
      }
    },
    {
      $unwind: '$hotel'
    },
    {
      $project: {
        propertyId: '$_id',
        propertyName: '$hotel.name',
        city: '$hotel.address.city',
        revenue: 1,
        bookings: 1,
        avgBookingValue: { $round: ['$avgBookingValue', 2] }
      }
    },
    {
      $sort: { revenue: -1 }
    }
  ]);

  const totalRevenue = revenueByProperty.reduce((sum, p) => sum + p.revenue, 0);

  res.json({
    success: true,
    data: {
      dateRange: { startDate, endDate },
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      breakdown: revenueByProperty,
      topProperty: revenueByProperty[0] || null,
      bottomProperty: revenueByProperty[revenueByProperty.length - 1] || null
    }
  });
}));

/**
 * @swagger
 * /portfolio/bookings:
 *   get:
 *     summary: Get all bookings across properties
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of bookings across all properties
 */
router.get('/bookings', catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  // Get all accessible properties
  const { propertyIds } = await getAccessibleProperties(req.user);

  // Build query
  const query = { hotelId: { $in: propertyIds } };
  if (status) {
    query.status = status;
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get bookings
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('hotelId', 'name address.city')
      .populate('userId', 'name email phone')
      .populate('rooms.roomId', 'roomNumber type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),

    Booking.countDocuments(query)
  ]);

  res.json({
    success: true,
    results: bookings.length,
    data: {
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

/**
 * @swagger
 * /portfolio/occupancy:
 *   get:
 *     summary: Get aggregated occupancy data
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           default: 30d
 *     responses:
 *       200:
 *         description: Occupancy data
 */
router.get('/occupancy', catchAsync(async (req, res) => {
  const { period = '30d' } = req.query;

  // Get all accessible properties
  const { propertyIds, properties } = await getAccessibleProperties(req.user);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  const days = parseInt(period.replace('d', ''));
  startDate.setDate(startDate.getDate() - days);

  // Get daily occupancy trends
  const occupancyTrends = await calculateDailyOccupancy(propertyIds, startDate, endDate);

  // Get property-wise occupancy
  const propertyOccupancy = await Promise.all(
    properties.map(async (property) => {
      const occupancy = await calculatePropertyOccupancyRate(property._id, startDate, endDate);

      return {
        property: {
          id: property._id,
          name: property.name,
          totalRooms: property.totalRooms || 0
        },
        occupancy: Math.round(occupancy * 100) / 100
      };
    })
  );

  const avgOccupancy = occupancyTrends.length > 0
    ? occupancyTrends.reduce((sum, d) => sum + d.occupancy, 0) / occupancyTrends.length
    : 0;

  res.json({
    success: true,
    data: {
      period,
      avgOccupancy: Math.round(avgOccupancy * 100) / 100,
      trends: occupancyTrends,
      byProperty: propertyOccupancy
    }
  });
}));

// Helper functions

/**
 * Calculate property occupancy rate for a date range
 */
async function calculatePropertyOccupancyRate(propertyId, startDate, endDate) {
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  const [totalRooms, occupiedRoomDays] = await Promise.all([
    Room.countDocuments({ hotelId: propertyId }),

    Booking.aggregate([
      {
        $match: {
          hotelId: propertyId,
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
          checkIn: { $lt: endDate },
          checkOut: { $gt: startDate }
        }
      },
      {
        $project: {
          nights: {
            $min: [
              {
                $divide: [
                  { $subtract: ['$checkOut', { $max: ['$checkIn', startDate] }] },
                  1000 * 60 * 60 * 24
                ]
              },
              days
            ]
          },
          roomCount: { $size: '$rooms' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$nights', '$roomCount'] } }
        }
      }
    ])
  ]);

  const totalAvailableRoomDays = totalRooms * days;
  const occupiedDays = occupiedRoomDays[0]?.total || 0;

  return totalAvailableRoomDays > 0 ? (occupiedDays / totalAvailableRoomDays) * 100 : 0;
}

/**
 * Calculate daily occupancy across properties
 */
async function calculateDailyOccupancy(propertyIds, startDate, endDate) {
  const dailyData = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const [totalRooms, occupiedRooms] = await Promise.all([
      Room.countDocuments({ hotelId: { $in: propertyIds } }),

      Booking.aggregate([
        {
          $match: {
            hotelId: { $in: propertyIds },
            status: { $in: ['confirmed', 'checked_in'] },
            checkIn: { $lte: dayEnd },
            checkOut: { $gt: dayStart }
          }
        },
        {
          $unwind: '$rooms'
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const occupiedCount = occupiedRooms[0]?.count || 0;
    const occupancy = totalRooms > 0 ? (occupiedCount / totalRooms) * 100 : 0;

    dailyData.push({
      date: currentDate.toISOString().split('T')[0],
      occupancy: Math.round(occupancy * 100) / 100,
      occupiedRooms: occupiedCount,
      totalRooms
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dailyData;
}

export default router;
