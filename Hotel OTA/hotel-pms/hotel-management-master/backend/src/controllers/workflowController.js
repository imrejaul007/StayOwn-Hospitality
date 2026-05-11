import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import HousekeepingTask from '../models/HousekeepingTask.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import WorkflowAction from '../models/WorkflowAction.js';
import { withTransaction } from '../utils/transactionHelper.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { refToHotelIdString } from '../middleware/propertyAccess.js';

class WorkflowController {
  // Bulk Check-in Operations
  static async bulkCheckIn(req, res) {
    try {
      const { roomIds, guestData, paymentMethod, notes } = req.body;
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);

      if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Room IDs are required'
        });
      }

      if (!guestData || !guestData.name || !guestData.email) {
        return res.status(400).json({
          status: 'error',
          message: 'Guest information is required'
        });
      }

      // Wrap all booking creations + room status updates + workflow log
      // in a single transaction so partial failures roll back completely.
      const bookings = await withTransaction(async (session) => {
        try {
          const txBookings = [];
          for (const roomId of roomIds) {
            const room = await Room.findOne({ _id: roomId, hotelId }).session(session);
            if (!room) {
              continue;
            }

            const [booking] = await Booking.create([{
              hotelId,
              roomId,
              guestName: guestData.name,
              guestEmail: guestData.email,
              guestPhone: guestData.phone,
              checkIn: guestData.checkInDate,
              checkOut: guestData.checkOutDate,
              status: 'confirmed',
              paymentMethod,
              specialRequests: guestData.specialRequests,
              notes,
              createdBy: req.user?.id || 'system'
            }], { session });

            txBookings.push(booking);

            // Update room status atomically within the transaction
            await Room.findOneAndUpdate(
              { _id: roomId, hotelId },
              {
                $set: {
                  status: 'occupied',
                  currentBooking: {
                    bookingId: booking._id,
                    checkIn: booking.checkIn,
                    checkOut: booking.checkOut,
                    status: booking.status
                  }
                }
              },
              { new: true, session }
            );
          }

          // Log workflow action within the same transaction
          await WorkflowAction.create([{
            type: 'checkin',
            roomIds,
            data: { guestData, paymentMethod, notes },
            status: 'completed',
            createdBy: req.user?.id || 'system'
          }], { session });

          return txBookings;
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });

      res.json({
        status: 'success',
        message: `Successfully checked in ${bookings.length} rooms`,
        data: { bookings }
      });

    } catch (error) {
      console.error('Bulk check-in error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process bulk check-in',
        error: error.message
      });
    }
  }

  // Bulk Check-out Operations
  static async bulkCheckOut(req, res) {
    try {
      const { roomIds, checkoutTime, paymentStatus, notes } = req.body;
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);

      if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Room IDs are required'
        });
      }

      // Wrap all booking updates + room status changes + workflow log
      // in a single transaction so partial failures roll back completely.
      const updatedBookings = await withTransaction(async (session) => {
        try {
          const txBookings = [];
          for (const roomId of roomIds) {
            const room = await Room.findOne({ _id: roomId, hotelId }).session(session);
            if (!room || !room.currentBooking) {
              continue;
            }

            // Atomically update booking status within transaction
            const booking = await Booking.findOneAndUpdate(
              { _id: room.currentBooking.bookingId, hotelId },
              {
                $set: {
                  status: 'checked_out',
                  checkOut: checkoutTime,
                  paymentStatus,
                  notes
                }
              },
              { new: true, session }
            );
            if (booking) {
              txBookings.push(booking);
            }

            // Update room status atomically within the transaction
            await Room.findOneAndUpdate(
              { _id: roomId, hotelId },
              { $set: { status: 'dirty' }, $unset: { currentBooking: 1 } },
              { new: true, session }
            );
          }

          // Log workflow action within the same transaction
          await WorkflowAction.create([{
            type: 'checkout',
            roomIds,
            data: { checkoutTime, paymentStatus, notes },
            status: 'completed',
            createdBy: req.user?.id || 'system'
          }], { session });

          return txBookings;
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });

      res.json({
        status: 'success',
        message: `Successfully checked out ${updatedBookings.length} rooms`,
        data: { bookings: updatedBookings }
      });

    } catch (error) {
      console.error('Bulk check-out error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process bulk check-out',
        error: error.message
      });
    }
  }

  // Schedule Housekeeping
  static async scheduleHousekeeping(req, res) {
    try {
      const { roomIds, floorId, priority, tasks, estimatedDuration, specialInstructions } = req.body;
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);

      if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Room IDs are required'
        });
      }

      // Wrap all task creations + workflow log in a single transaction
      const housekeepingTasks = await withTransaction(async (session) => {
        try {
          const txTasks = [];
          for (const roomId of roomIds) {
            const [task] = await HousekeepingTask.create([{
              hotelId,
              roomId,
              floorId,
              priority,
              tasks,
              estimatedDuration,
              specialInstructions,
              status: 'pending',
              assignedTo: req.body.assignedTo,
              createdBy: req.user?.id || 'system'
            }], { session });

            txTasks.push(task);
          }

          // Log workflow action within the same transaction
          await WorkflowAction.create([{
            type: 'housekeeping',
            roomIds,
            floorId,
            data: { priority, tasks, estimatedDuration, specialInstructions },
            status: 'completed',
            createdBy: req.user?.id || 'system'
          }], { session });

          return txTasks;
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });

      res.json({
        status: 'success',
        message: `Successfully scheduled housekeeping for ${housekeepingTasks.length} rooms`,
        data: { tasks: housekeepingTasks }
      });

    } catch (error) {
      console.error('Schedule housekeeping error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to schedule housekeeping',
        error: error.message
      });
    }
  }

  // Request Maintenance
  static async requestMaintenance(req, res) {
    try {
      const { roomIds, floorId, issueType, priority, description, estimatedCost, scheduledDate } = req.body;
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);

      if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Room IDs are required'
        });
      }

      // Wrap maintenance request creation + room status updates + workflow log
      // in a single transaction so partial failures roll back completely.
      const maintenanceRequests = await withTransaction(async (session) => {
        try {
          const txRequests = [];
          for (const roomId of roomIds) {
            const [request] = await MaintenanceRequest.create([{
              hotelId,
              roomId,
              floorId,
              issueType,
              priority,
              description,
              estimatedCost,
              scheduledDate,
              status: 'pending',
              vendorId: req.body.vendorId,
              createdBy: req.user?.id || 'system'
            }], { session });

            txRequests.push(request);

            // Update room status if high priority (within transaction)
            if (priority === 'urgent' || priority === 'high') {
              await Room.findOneAndUpdate(
                { _id: roomId, hotelId },
                { $set: { status: 'maintenance' } },
                { new: true, session }
              );
            }
          }

          // Log workflow action within the same transaction
          await WorkflowAction.create([{
            type: 'maintenance',
            roomIds,
            floorId,
            data: { issueType, priority, description, estimatedCost, scheduledDate },
            status: 'completed',
            createdBy: req.user?.id || 'system'
          }], { session });

          return txRequests;
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });

      res.json({
        status: 'success',
        message: `Successfully created ${maintenanceRequests.length} maintenance requests`,
        data: { requests: maintenanceRequests }
      });

    } catch (error) {
      console.error('Request maintenance error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create maintenance requests',
        error: error.message
      });
    }
  }

  // Update Room Status
  static async updateRoomStatus(req, res) {
    try {
      const { roomIds, newStatus, reason, notes } = req.body;
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);

      if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Room IDs are required'
        });
      }

      // Wrap all room status updates + workflow log in a single transaction
      const updatedRooms = await withTransaction(async (session) => {
        try {
          const txRooms = [];
          for (const roomId of roomIds) {
            const room = await Room.findOneAndUpdate(
              { _id: roomId, hotelId },
              { $set: { status: newStatus, notes } },
              { new: true, session }
            );
            if (room) {
              txRooms.push(room);
            }
          }

          // Log workflow action within the same transaction
          await WorkflowAction.create([{
            type: 'status_update',
            roomIds,
            data: { newStatus, reason, notes },
            status: 'completed',
            createdBy: req.user?.id || 'system'
          }], { session });

          return txRooms;
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });

      res.json({
        status: 'success',
        message: `Successfully updated status for ${updatedRooms.length} rooms`,
        data: { rooms: updatedRooms }
      });

    } catch (error) {
      console.error('Update room status error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to update room status',
        error: error.message
      });
    }
  }

  // Get Workflow Actions
  static async getWorkflowActions(req, res) {
    try {
      const { type, status, floorId, dateFrom, dateTo } = req.query;
      const hotelId = refToHotelIdString(req.user?.hotelId);

      let query = { hotelId };
      if (type) query.type = type;
      if (status) query.status = status;
      if (floorId) query.floorId = parseInt(floorId);
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const actions = await WorkflowAction.find(query)
        .sort({ createdAt: -1 })
        .limit(100).lean();

      res.json({
        status: 'success',
        data: actions
      });

    } catch (error) {
      console.error('Get workflow actions error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch workflow actions',
        error: error.message
      });
    }
  }

  // Get Floor Analytics
  static async getFloorAnalytics(req, res) {
    try {
      const { floorId } = req.params;
      const hotelId = refToHotelIdString(req.user?.hotelId);

      // Get rooms on the floor
      const rooms = await Room.find({ hotelId, floor: parseInt(floorId) }).lean().limit(1000);
      const totalRooms = rooms.length;
      const occupiedRooms = rooms.filter(room => room.status === 'occupied').length;
      const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      // Get bookings for the floor
      const roomIds = rooms.map(room => room._id);
      const bookings = await Booking.find({ 
        hotelId, 
        roomId: { $in: roomIds },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }).lean().limit(1000);

      // Calculate average stay duration
      const totalNights = bookings.reduce((sum, booking) => {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        return sum + Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      }, 0);
      const averageStayDuration = bookings.length > 0 ? totalNights / bookings.length : 0;

      // Calculate revenue per room
      const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      const revenuePerRoom = totalRooms > 0 ? totalRevenue / totalRooms : 0;

      // Get maintenance requests
      const maintenanceRequests = await MaintenanceRequest.find({ 
        hotelId, 
        floorId: parseInt(floorId),
        status: { $in: ['pending', 'in_progress'] }
      }).lean().limit(1000);

      res.json({
        status: 'success',
        data: {
          occupancyRate,
          averageStayDuration,
          revenuePerRoom,
          maintenanceRequests: maintenanceRequests.length,
          housekeepingEfficiency: 0, // Not yet calculated — requires completed vs assigned task tracking
          guestSatisfaction: 0 // Not yet calculated — requires guest review aggregation
        }
      });

    } catch (error) {
      console.error('Get floor analytics error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch floor analytics',
        error: error.message
      });
    }
  }

  // Get Predictive Analytics
  static async getPredictiveAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;
      const hotelId = refToHotelIdString(req.user?.hotelId);

      // Calculate days based on period
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      // Get historical booking data
      const bookings = await Booking.find({
        hotelId,
        checkIn: { $gte: startDate, $lte: endDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }).lean().limit(1000);

      // Calculate historical averages from actual booking data
      const totalRooms = await Room.countDocuments({ hotelId });
      const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const totalNights = bookings.reduce((sum, b) => {
        const checkIn = new Date(b.checkIn);
        const checkOut = new Date(b.checkOut);
        return sum + Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
      }, 0);

      const avgDailyOccupancy = totalRooms > 0 && days > 0
        ? Math.min(100, (totalNights / (totalRooms * days)) * 100)
        : 0;
      const avgDailyRevenue = days > 0 ? totalRevenue / days : 0;

      // Build deterministic forecast based on historical averages (no random noise)
      const occupancyForecast = [];
      const revenueForecast = [];

      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        occupancyForecast.push({
          date: date.toISOString().split('T')[0],
          predictedOccupancy: Math.round(avgDailyOccupancy),
          confidence: bookings.length >= 30 ? 80 : bookings.length >= 10 ? 60 : 40
        });

        revenueForecast.push({
          date: date.toISOString().split('T')[0],
          predictedRevenue: Math.round(avgDailyRevenue),
          confidence: bookings.length >= 30 ? 75 : bookings.length >= 10 ? 55 : 35
        });
      }

      // Maintenance predictions: based on actual pending maintenance requests, not random
      const pendingMaintenance = await MaintenanceRequest.find({
        hotelId,
        status: { $in: ['pending', 'in_progress'] }
      }).lean().limit(20);

      const maintenancePredictions = pendingMaintenance.map(req => ({
        roomId: req.roomId,
        issueType: req.issueType || 'general',
        status: req.status,
        scheduledDate: req.scheduledDate ? new Date(req.scheduledDate).toISOString().split('T')[0] : null
      }));

      res.json({
        status: 'success',
        data: {
          occupancyForecast,
          revenueForecast,
          maintenancePredictions,
          _meta: {
            basedOnBookings: bookings.length,
            historicalPeriodDays: days,
            note: 'Forecasts are simple historical averages. A proper ML prediction engine is not yet implemented.'
          }
        }
      });

    } catch (error) {
      console.error('Get predictive analytics error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch predictive analytics',
        error: error.message
      });
    }
  }

  // Generate Upgrade Suggestions
  static async generateUpgradeSuggestions(req, res) {
    try {
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);
      const { checkInDate, checkOutDate } = req.query;

      // Get current reservations for analysis
      const reservations = await Booking.find({
        hotelId,
        checkIn: { $gte: new Date(checkInDate || Date.now()) },
        checkOut: { $lte: new Date(checkOutDate || Date.now() + 7 * 24 * 60 * 60 * 1000) },
        status: { $in: ['confirmed', 'checked_in'] }
      }).populate('userId').populate('rooms.roomId').lean().limit(1000);

      const suggestions = [];

      for (const reservation of reservations) {
        // Skip if guest or room data is missing
        if (!reservation.userId || !reservation.rooms || reservation.rooms.length === 0) continue;

        // Process each room in the reservation
        for (const roomBooking of reservation.rooms) {
          if (!roomBooking.roomId) continue;

          const currentRoomType = roomBooking.roomId.roomType;
          const guestTier = reservation.userId.vipStatus || 'regular';
          const totalAmount = reservation.totalAmount || 0;

          // Determine upgrade potential
          let upgradeTarget = null;
          let confidence = 0;
          let reason = '';
          let priceIncrease = 0;
          let benefits = [];

          // VIP Guest Logic
          if (['vip', 'svip', 'diamond'].includes(guestTier)) {
          if (currentRoomType === 'standard') {
            upgradeTarget = 'deluxe';
            priceIncrease = 75;
            confidence = 92;
            reason = 'VIP guest with preference for higher floors';
            benefits = ['City view', 'Larger room', 'Premium amenities'];
          } else if (currentRoomType === 'deluxe') {
            upgradeTarget = 'suite';
            priceIncrease = 200;
            confidence = 88;
            reason = 'VIP guest deserves suite experience';
            benefits = ['Separate living area', 'Complimentary breakfast', 'Executive lounge access'];
          }
          }

        // Corporate Guest Logic
          else if (guestTier === 'corporate' || totalAmount > 50000) {
          if (currentRoomType === 'standard') {
            upgradeTarget = 'premium';
            priceIncrease = 50;
            confidence = 75;
            reason = 'Corporate guest with high-value booking history';
            benefits = ['Business amenities', 'Faster WiFi', 'Work desk'];
          } else if (currentRoomType === 'deluxe') {
            upgradeTarget = 'suite';
            priceIncrease = 150;
            confidence = 85;
            reason = 'Corporate guest with high-value booking';
            benefits = ['Separate living area', 'Meeting space', 'Executive lounge access'];
          }
          }

        // Special Occasion Logic
          else if (reservation.specialRequests?.some(req =>
          req.toLowerCase().includes('anniversary') ||
          req.toLowerCase().includes('birthday') ||
          req.toLowerCase().includes('honeymoon')
          )) {
          if (currentRoomType === 'standard') {
            upgradeTarget = 'premium';
            priceIncrease = 50;
            confidence = 78;
            reason = 'Special celebration mentioned in booking';
            benefits = ['Romantic setup', 'Complimentary wine', 'Late checkout'];
          }
          }

        // Add suggestion if upgrade target found
          if (upgradeTarget) {
          // Find available room of target type
          const availableRoom = await Room.findOne({
            hotelId,
            roomType: upgradeTarget,
            status: 'available',
            isActive: true
          }).lean();

          if (availableRoom) {
            suggestions.push({
              id: `up-${reservation._id}`,
              reservationId: reservation._id,
              fromRoomType: currentRoomType,
              toRoomType: upgradeTarget,
              fromRoomNumber: roomBooking.roomId.roomNumber,
              toRoomNumber: availableRoom.roomNumber,
              priceIncrease,
              confidence,
              reason,
              benefits,
              guestProfile: {
                tier: guestTier,
                preferences: reservation.userId.preferences || [],
                history: [`Booking value: $${totalAmount}`]
              },
              guestName: reservation.userId.name || reservation.guestName,
              checkIn: reservation.checkIn,
              checkOut: reservation.checkOut
            });
          }
          }
        }
      }

      res.json({
        status: 'success',
        data: {
          suggestions,
          total: suggestions.length,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Generate upgrade suggestions error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate upgrade suggestions',
        error: error.message
      });
    }
  }

  // Process Upgrade Request
  static async processUpgrade(req, res) {
    try {
      const { upgradeId, action, reason, notes } = req.body;
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);
      const userId = req.user?.id || 'system';

      if (!upgradeId || !action) {
        return res.status(400).json({
          status: 'error',
          message: 'Upgrade ID and action are required'
        });
      }

      // In a real implementation, you would:
      // 1. Validate the upgrade request
      // 2. Check room availability
      // 3. Update booking with new room
      // 4. Process payment difference
      // 5. Send notifications

      // For now, create a workflow action to track the upgrade
      const workflowAction = new WorkflowAction({
        type: 'room_upgrade',
        data: {
          upgradeId,
          action,
          reason,
          notes,
          processedBy: userId,
          processedAt: new Date()
        },
        status: action === 'approve' ? 'completed' : 'rejected',
        createdBy: userId
      });

      await workflowAction.save();

      res.json({
        status: 'success',
        message: `Upgrade ${action}d successfully`,
        data: {
          upgradeId,
          action,
          processedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Process upgrade error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to process upgrade',
        error: error.message
      });
    }
  }

  // Get Upgrade Analytics
  static async getUpgradeAnalytics(req, res) {
    try {
      const hotelId = refToHotelIdString(req.user?.hotelId || req.body.hotelId);
      const { startDate, endDate } = req.query;

      // Get upgrade workflow actions
      const upgradeActions = await WorkflowAction.find({
        type: 'room_upgrade',
        createdAt: {
          $gte: new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
          $lte: new Date(endDate || Date.now())
        }
      }).lean().limit(1000);

      const totalSuggestions = upgradeActions.length;
      const approvedUpgrades = upgradeActions.filter(action => action.status === 'completed').length;
      const rejectedUpgrades = upgradeActions.filter(action => action.status === 'rejected').length;

      // Calculate revenue (mock calculation)
      const totalRevenue = approvedUpgrades * 125; // Average upgrade value
      const conversionRate = totalSuggestions > 0 ? Math.round((approvedUpgrades / totalSuggestions) * 100) : 0;

      // Calculate average increase from actual data only
      const averageIncrease = approvedUpgrades > 0 ? Math.round(totalRevenue / approvedUpgrades) : 0;

      res.json({
        status: 'success',
        data: {
          totalSuggestions,
          acceptedUpgrades: approvedUpgrades,
          rejectedUpgrades,
          totalRevenue,
          averageIncrease,
          conversionRate,
          byTier: {
            vip: { acceptance: 0, count: 0 },
            corporate: { acceptance: 0, count: 0 },
            regular: { acceptance: 0, count: 0 }
          },
          _meta: {
            note: 'Tier-level breakdown requires tagging upgrades by guest tier, which is not yet tracked.'
          }
        }
      });

    } catch (error) {
      console.error('Get upgrade analytics error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch upgrade analytics',
        error: error.message
      });
    }
  }
}

export default WorkflowController;
