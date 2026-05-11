import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import GuestService from '../models/GuestService.js';
import InventoryItem from '../models/InventoryItem.js';
import logger from '../utils/logger.js';

class DashboardController {
  // Get real-time dashboard counts
  async getDashboardCounts(req, res) {
    try {
      const hotelId = (req.user.role === 'admin' || req.user.role === 'manager')
        ? (req.query.hotelId || req.user.hotelId)
        : req.user.hotelId;
      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'hotelId is required'
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Front Desk Counts — all queries scoped to hotelId
      const checkInsToday = await Booking.countDocuments({
        hotelId,
        checkIn: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      const checkOutsToday = await Booking.countDocuments({
        hotelId,
        checkOut: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      });

      // Total reservations (active bookings)
      const totalReservations = await Booking.countDocuments({
        hotelId,
        status: { $in: ['confirmed', 'checked_in', 'pending'] },
        checkOut: { $gte: today }
      });

      // Available rooms (clean + vacant)
      const totalRooms = await Room.countDocuments({ hotelId, isActive: true });
      const occupiedRooms = await Room.countDocuments({ hotelId, status: 'occupied' });
      const dirtyRooms = await Room.countDocuments({ hotelId, status: 'dirty' });
      const maintenanceRooms = await Room.countDocuments({ hotelId, status: { $in: ['maintenance', 'out_of_order'] } });
      const availableRooms = Math.max(0, totalRooms - occupiedRooms - dirtyRooms - maintenanceRooms);

      // Housekeeping tasks
      const housekeepingTasks = await Room.countDocuments({
        hotelId,
        status: { $in: ['dirty', 'maintenance', 'out_of_order'] }
      });

      // Guest services pending
      const pendingGuestServices = await GuestService.countDocuments({
        hotelId,
        status: { $in: ['pending', 'in_progress'] }
      });

      // VIP guests currently in house
      const vipGuests = await Booking.countDocuments({
        hotelId,
        status: 'checked_in',
        checkOut: { $gte: today },
        totalAmount: { $gte: 15000 } // VIP threshold
      });

      // Corporate bookings
      const corporateBookings = await Booking.countDocuments({
        hotelId,
        'corporateBooking.corporateCompanyId': { $exists: true, $ne: null },
        status: { $in: ['confirmed', 'checked_in'] },
        checkOut: { $gte: today }
      });

      // Maintenance requests
      const maintenanceRequests = await Room.countDocuments({
        hotelId,
        status: { $in: ['maintenance', 'out_of_order'] }
      });

      // Low stock items
      const lowStockItems = await InventoryItem.countDocuments({
        hotelId,
        $expr: { $lte: ['$quantity', '$minStockLevel'] }
      });

      const dashboardCounts = {
        frontDesk: {
          total: checkInsToday + checkOutsToday,
          checkIn: checkInsToday,
          checkOut: checkOutsToday,
          availableRooms
        },
        reservations: {
          total: totalReservations,
          confirmed: await Booking.countDocuments({
            hotelId,
            status: 'confirmed',
            checkOut: { $gte: today }
          }),
          pending: await Booking.countDocuments({
            hotelId,
            status: 'pending',
            checkOut: { $gte: today }
          }),
          checkedIn: await Booking.countDocuments({
            hotelId,
            status: 'checked_in'
          })
        },
        housekeeping: {
          total: housekeepingTasks,
          dirty: await Room.countDocuments({ hotelId, status: 'dirty' }),
          maintenance: maintenanceRequests,
          outOfOrder: await Room.countDocuments({ hotelId, status: 'out_of_order' })
        },
        guestServices: {
          total: pendingGuestServices,
          pending: await GuestService.countDocuments({ hotelId, status: 'pending' }),
          inProgress: await GuestService.countDocuments({ hotelId, status: 'in_progress' }),
          vipGuests,
          corporate: corporateBookings
        },
        maintenance: {
          total: maintenanceRequests,
          urgent: await Room.countDocuments({
            hotelId,
            status: 'out_of_order'
          }),
          scheduled: await Room.countDocuments({
            hotelId,
            status: 'maintenance'
          })
        },
        inventory: {
          total: lowStockItems,
          critical: await InventoryItem.countDocuments({
            hotelId,
            quantity: { $eq: 0 }
          }),
          lowStock: lowStockItems
        }
      };

      res.json({
        success: true,
        data: dashboardCounts,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Dashboard counts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard counts',
        error: error.message
      });
    }
  }

  // Get room status summary
  async getRoomStatusSummary(req, res) {
    try {
      const hotelId = (req.user.role === 'admin' || req.user.role === 'manager')
        ? (req.query.hotelId || req.user.hotelId)
        : req.user.hotelId;
      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'hotelId is required'
        });
      }

      // Aggregation pipeline requires ObjectId for hotelId match
      const hotelOid = typeof hotelId === 'string' ? new mongoose.Types.ObjectId(hotelId) : hotelId;
      const roomMatchStage = { $match: { hotelId: hotelOid, isActive: true } };
      const roomSummary = await Room.aggregate([
        roomMatchStage,
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Use the same ObjectId for countDocuments for consistency
      const totalRooms = await Room.countDocuments({ hotelId: hotelOid, isActive: true });

      const summary = {
        total: totalRooms,
        byStatus: roomSummary.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        occupancyRate: 0
      };

      // Calculate occupancy rate — guard against division by zero
      const occupiedRooms = (summary.byStatus.occupied || 0);

      if (totalRooms > 0) {
        summary.occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);
      }

      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      logger.error('Room status summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room status summary',
        error: error.message
      });
    }
  }

  // Get recent activities for dashboard
  async getRecentActivities(req, res) {
    try {
      const hotelId = (req.user.role === 'admin' || req.user.role === 'manager')
        ? (req.query.hotelId || req.user.hotelId)
        : req.user.hotelId;
      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'hotelId is required'
        });
      }

      const limit = Math.min(parseInt(req.query.limit) || 10, 100);
      const halfLimit = Math.max(1, Math.ceil(limit / 2));

      // Get recent bookings — scoped to hotelId
      const recentBookings = await Booking.find({
        hotelId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
      .populate('userId', 'name email')
      .populate('rooms.roomId', 'roomNumber')
      .sort({ createdAt: -1 })
      .limit(halfLimit).lean();

      // Get recent guest services — scoped to hotelId
      const recentServices = await GuestService.find({
        hotelId,
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
      .populate('guestId', 'name')
      .populate('roomId', 'roomNumber')
      .sort({ updatedAt: -1 })
      .limit(halfLimit).lean();

      const activities = [
        ...recentBookings.map(booking => ({
          id: booking._id,
          type: 'booking',
          title: `New booking: ${booking.userId?.name || 'Guest'}`,
          description: `Room ${booking.rooms?.[0]?.roomId?.roomNumber || '—'} - ${booking.status}`,
          timestamp: booking.createdAt,
          status: booking.status
        })),
        ...recentServices.map(service => ({
          id: service._id,
          type: 'service',
          title: `${service.serviceType || 'Service'}: ${service.guestId?.name || 'Guest'}`,
          description: `Room ${service.roomId?.roomNumber || '—'} - ${service.status}`,
          timestamp: service.updatedAt,
          status: service.status
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

      res.json({
        success: true,
        data: activities
      });

    } catch (error) {
      logger.error('Recent activities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent activities',
        error: error.message
      });
    }
  }
}

export default new DashboardController();
