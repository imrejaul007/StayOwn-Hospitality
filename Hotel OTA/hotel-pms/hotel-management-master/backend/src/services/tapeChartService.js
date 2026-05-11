import mongoose from 'mongoose';
import TapeChart from '../models/TapeChart.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import WaitingList from '../models/WaitingList.js';
import { withDistributedLock } from '../utils/distributedLock.js';
import logger from '../utils/logger.js';

const { 
  RoomConfiguration, 
  RoomStatusHistory, 
  RoomBlock, 
  AdvancedReservation, 
  TapeChartView, 
  RoomAssignmentRules 
} = TapeChart;

/**
 * Safely convert a value to a mongoose ObjectId string.
 * Handles ObjectId instances, populated objects with _id, and plain strings.
 * Returns the string representation or null if invalid.
 */
function safeObjectIdString(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    return mongoose.Types.ObjectId.isValid(val) ? val : null;
  }
  if (val instanceof mongoose.Types.ObjectId || val?.constructor?.name === 'ObjectId') {
    return val.toString();
  }
  if (typeof val === 'object' && val._id != null) {
    return safeObjectIdString(val._id);
  }
  return null;
}

/**
 * Safely create a new mongoose ObjectId from a value.
 * Validates and normalizes the input first.
 * Throws a descriptive error if the value is not a valid ObjectId.
 */
function toObjectId(val, fieldName = 'id') {
  const str = safeObjectIdString(val);
  if (!str) {
    throw new Error(`Invalid ${fieldName}: expected a valid 24-character hex ObjectId but received ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
  }
  return new mongoose.Types.ObjectId(str);
}

class TapeChartService {
  // Room Configuration Management
  async createRoomConfiguration(configData) {
    try {
      const config = new RoomConfiguration(configData);
      await config.save();
      return config;
    } catch (error) {
      throw new Error(`Failed to create room configuration: ${error.message}`);
    }
  }

  async getRoomConfigurations(filters = {}) {
    try {
      const query = {};
      // hotelId is required for multi-tenancy isolation
      if (filters.hotelId) query.hotelId = filters.hotelId;
      if (filters.floor) query.floor = filters.floor;
      if (filters.building) query.building = filters.building;
      if (filters.wing) query.wing = filters.wing;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      return await RoomConfiguration.find(query).sort({ floor: 1, sortOrder: 1 }).lean().limit(1000);
    } catch (error) {
      throw new Error(`Failed to fetch room configurations: ${error.message}`);
    }
  }

  async updateRoomConfiguration(configId, updateData) {
    try {
      return await RoomConfiguration.findByIdAndUpdate(
        configId,
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Failed to update room configuration: ${error.message}`);
    }
  }

  // Room Status Management
  async updateRoomStatus(roomId, statusData, userId) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        try {
          const room = await Room.findById(roomId).session(session);
          if (!room) {
            throw new Error('Room not found');
          }

          const previousStatus = room.status;

          // Create status history entry
          const historyEntry = new RoomStatusHistory({
            roomId,
            date: new Date(),
            status: statusData.status,
            previousStatus,
            bookingId: statusData.bookingId,
            guestName: statusData.guestName,
            checkIn: statusData.checkIn,
            checkOut: statusData.checkOut,
            notes: statusData.notes,
            changedBy: userId,
            changeReason: statusData.changeReason,
            priority: statusData.priority || 'medium'
          });

          await historyEntry.save({ session });

          // Update room status
          room.status = statusData.status;
          room.lastUpdated = new Date();
          await room.save({ session });

          result = { room, history: historyEntry };
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to update room status: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  async getRoomStatusHistory(roomId, dateRange = {}) {
    try {
      const query = { roomId };

      if (dateRange.startDate && dateRange.endDate) {
        query.date = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate)
        };
      }

      return await RoomStatusHistory.find(query)
        .populate('roomId', 'roomNumber roomType')
        .populate('bookingId', 'bookingNumber guestName')
        .populate('changedBy', 'name email')
        .sort({ date: -1 }).lean().limit(1000);
    } catch (error) {
      throw new Error(`Failed to fetch room status history: ${error.message}`);
    }
  }

  async getAvailableRooms(hotelId, filters = {}) {
    try {
      const { checkIn, checkOut, roomType, floor, guestCount } = filters;

      // Build room query
      const roomQuery = { hotelId, isActive: true };
      if (roomType) roomQuery.type = roomType;
      if (floor) roomQuery.floor = floor;
      if (guestCount) roomQuery.capacity = { $gte: guestCount };

      // Get all rooms matching criteria
      const rooms = await Room.find(roomQuery).lean().limit(1000);

      // If dates are provided, filter out rooms that are already booked
      if (checkIn && checkOut) {
        const startDate = new Date(checkIn);
        const endDate = new Date(checkOut);

        // Find rooms that are booked during this period
        const bookedRoomIds = await Booking.aggregate([
          {
            $match: {
              hotelId,
              status: { $in: ['confirmed', 'checked_in'] },
              $or: [
                { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } }
              ]
            }
          },
          {
            $unwind: '$rooms'
          },
          {
            $group: {
              _id: '$rooms.roomId'
            }
          }
        ]);

        const bookedRoomIdsSet = new Set(bookedRoomIds.map(item => item._id.toString()));

        // Filter out booked rooms and add assignment scores
        const availableRooms = rooms
          .filter(room => !bookedRoomIdsSet.has(room._id.toString()))
          .map(room => ({
            id: room._id,
            roomNumber: room.roomNumber,
            roomType: room.type,
            floor: room.floor,
            status: room.status,
            features: room.amenities || [],
            baseRate: room.currentRate || room.baseRate,
            maxOccupancy: room.capacity,
            bedType: room.bedType || 'Standard',
            size: room.size || 300,
            view: room.view,
            lastCleaned: room.lastCleaned,
            maintenanceNotes: room.maintenanceNotes,
            assignmentScore: this.calculateAssignmentScore(room, filters)
          }));

        return availableRooms;
      }

      // If no dates provided, return all rooms with status info
      return rooms.map(room => ({
        id: room._id,
        roomNumber: room.roomNumber,
        roomType: room.type,
        floor: room.floor,
        status: room.status,
        features: room.amenities || [],
        baseRate: room.currentRate || room.baseRate,
        maxOccupancy: room.capacity,
        bedType: room.bedType || 'Standard',
        size: room.size || 300,
        view: room.view,
        lastCleaned: room.lastCleaned,
        maintenanceNotes: room.maintenanceNotes,
        assignmentScore: this.calculateAssignmentScore(room, filters)
      }));

    } catch (error) {
      throw new Error(`Failed to fetch available rooms: ${error.message}`);
    }
  }

  calculateAssignmentScore(room, filters) {
    let score = 50; // Base score

    // Room type match
    if (filters.roomType && room.type === filters.roomType) {
      score += 30;
    }

    // Capacity match
    if (filters.guestCount && room.capacity >= filters.guestCount) {
      score += 20;
    }

    // Floor preference
    if (filters.floor && room.floor === filters.floor) {
      score += 10;
    }

    // Room condition boost
    if (room.status === 'clean') score += 5;
    if (room.status === 'maintenance' || room.status === 'dirty') score -= 20;

    // Higher floor rooms get slight boost
    if (room.floor >= 3) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  // Room Block Management
  async createRoomBlock(blockData, userId) {
    try {
      const roomBlock = new RoomBlock({
        ...blockData,
        createdBy: userId
      });

      await roomBlock.save();

      // Update room statuses for blocked rooms
      if (blockData.rooms && blockData.rooms.length > 0) {
        await Promise.all(
          blockData.rooms.map(async (room) => {
            try {
              await this.updateRoomStatus(
                room.roomId,
                {
                  status: 'reserved',
                  notes: `Blocked for group: ${blockData.groupName}`,
                  changeReason: 'group_block'
                },
                userId
              );
          
            } catch (error) {
              console.error('Operation failed:', error.message);
              throw error;
            }
          })
        );
      }

      return roomBlock;
    } catch (error) {
      throw new Error(`Failed to create room block: ${error.message}`);
    }
  }

  async getRoomBlocks(filters = {}) {
    try {
      const query = {};

      // hotelId is required for multi-tenancy isolation
      if (filters.hotelId) query.hotelId = filters.hotelId;
      if (filters.status) query.status = filters.status;
      if (filters.eventType) query.eventType = filters.eventType;
      if (filters.startDate && filters.endDate) {
        query.$or = [
          {
            startDate: {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate)
            }
          },
          {
            endDate: {
              $gte: new Date(filters.startDate),
              $lte: new Date(filters.endDate)
            }
          }
        ];
      }

      return await RoomBlock.find(query)
        .populate('rooms.roomId', 'roomNumber roomType')
        .populate('corporateId', 'companyName')
        .populate('createdBy', 'name email')
        .sort({ startDate: 1 }).lean().limit(1000);
    } catch (error) {
      throw new Error(`Failed to fetch room blocks: ${error.message}`);
    }
  }

  async updateRoomBlock(blockId, updateData) {
    try {
      return await RoomBlock.findByIdAndUpdate(
        blockId,
        updateData,
        { new: true, runValidators: true }
      ).populate('rooms.roomId', 'roomNumber roomType');
    } catch (error) {
      throw new Error(`Failed to update room block: ${error.message}`);
    }
  }

  async releaseRoomBlock(blockId, userId) {
    try {
      const block = await RoomBlock.findById(blockId);
      if (!block) {
        throw new Error('Room block not found');
      }

      // Release all blocked rooms
      await Promise.all(
        block.rooms.map(async (room) => {
          try {
            if (room.status === 'blocked') {
              await this.updateRoomStatus(
                room.roomId,
                {
                  status: 'available',
                  notes: `Released from block: ${block.groupName}`,
                  changeReason: 'block_release'
                },
                userId
              );
            }
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        })
      );

      block.status = 'expired';
      block.roomsReleased = block.rooms.filter(r => r.status === 'blocked').length;
      await block.save();

      return block;
    } catch (error) {
      throw new Error(`Failed to release room block: ${error.message}`);
    }
  }

  // Advanced Reservation Management
  async createAdvancedReservation(reservationData) {
    try {
      const reservation = new AdvancedReservation(reservationData);
      await reservation.save();

      // Apply auto room assignment if applicable
      if (reservationData.autoAssign) {
        await this.autoAssignRooms(reservation._id);
      }

      return reservation;
    } catch (error) {
      throw new Error(`Failed to create advanced reservation: ${error.message}`);
    }
  }

  async getAdvancedReservations(filters = {}) {
    try {
      const query = {};

      // hotelId is required for multi-tenancy isolation
      if (filters.hotelId) query.hotelId = filters.hotelId;
      if (filters.reservationType) query.reservationType = filters.reservationType;
      if (filters.priority) query.priority = filters.priority;
      if (filters.vipStatus) query['guestProfile.vipStatus'] = filters.vipStatus;

      return await AdvancedReservation.find(query)
        .populate('bookingId', 'bookingNumber guestName checkIn checkOut')
        .populate('roomAssignments.roomId', 'roomNumber roomType')
        .populate('roomAssignments.assignedBy', 'name')
        .sort({ createdAt: -1 }).lean().limit(1000);
    } catch (error) {
      throw new Error(`Failed to fetch advanced reservations: ${error.message}`);
    }
  }

  async assignRoom(reservationId, roomAssignment, userId) {
    const lockKey = `room_assignment_lock:${roomAssignment.roomId}`;
    return await withDistributedLock(lockKey, async () => {
      try {
        const reservation = await AdvancedReservation.findById(reservationId);
        if (!reservation) {
          throw new Error('Reservation not found');
        }

        const assignment = {
          ...roomAssignment,
          assignedDate: new Date(),
          assignedBy: userId
        };

        reservation.roomAssignments.push(assignment);
        await reservation.save();

        // Update room status
        await this.updateRoomStatus(
          roomAssignment.roomId,
          {
            status: 'reserved',
            bookingId: reservation.bookingId,
            notes: `Assigned to reservation ${reservation.reservationId}`,
            changeReason: 'room_assignment'
          },
          userId
        );

        return reservation;
      } catch (error) {
        throw new Error(`Failed to assign room: ${error.message}`);
      }
    });
  }

  async autoAssignRooms(reservationId) {
    const lockKey = `auto_assign_lock:${reservationId}`;
    return await withDistributedLock(lockKey, async () => {
      try {
        const reservation = await AdvancedReservation.findById(reservationId)
          .populate('bookingId').lean();

        if (!reservation) {
          throw new Error('Reservation not found');
        }

      const booking = reservation.bookingId;
      const rules = await this.getApplicableRules(reservation);
      
      // Find available rooms based on preferences and rules
      const availableRooms = await this.findAvailableRooms({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomType: booking.roomType,
        preferences: reservation.roomPreferences,
        rules
      });

      if (availableRooms.length === 0) {
        throw new Error('No suitable rooms available for auto-assignment');
      }

      // Apply assignment logic
      const selectedRoom = await this.selectBestRoom(availableRooms, reservation, rules);
      
      // Assign the room
      await this.assignRoom(
        reservationId,
        {
          roomId: selectedRoom._id,
          roomNumber: selectedRoom.roomNumber,
          assignmentType: 'auto'
        },
        'system'
      );

      return selectedRoom;
    } catch (error) {
      throw new Error(`Auto assignment failed: ${error.message}`);
    }
    });
  }

  async processUpgrade(reservationId, upgradeData, userId) {
    const lockKey = `room_upgrade_lock:${reservationId}`;
    return await withDistributedLock(lockKey, async () => {
      try {
        const reservation = await AdvancedReservation.findById(reservationId);
        if (!reservation) {
          throw new Error('Reservation not found');
        }

        const upgrade = {
          ...upgradeData,
          upgradeDate: new Date(),
          approvedBy: userId
        };

        reservation.upgrades.push(upgrade);

        // If room assignment exists, update it
        if (upgradeData.newRoomId && reservation.roomAssignments.length > 0) {
          const latestAssignment = reservation.roomAssignments[reservation.roomAssignments.length - 1];

          // Release old room
          await this.updateRoomStatus(
            latestAssignment.roomId,
            {
              status: 'available',
              notes: `Upgraded to ${upgradeData.toRoomType}`,
              changeReason: 'room_upgrade'
            },
            userId
          );

          // Assign new room
          await this.assignRoom(
            reservationId,
            {
              roomId: upgradeData.newRoomId,
              roomNumber: upgradeData.newRoomNumber,
              assignmentType: 'upgrade',
              notes: `Upgraded from ${upgradeData.fromRoomType}`
            },
            userId
          );
        }

        await reservation.save();
        return reservation;
      } catch (error) {
        throw new Error(`Failed to process upgrade: ${error.message}`);
      }
    });
  }

  // Tape Chart View Management
  async createTapeChartView(viewData, userId) {
    try {
      const view = new TapeChartView({
        ...viewData,
        createdBy: userId
      });
      await view.save();
      return view;
    } catch (error) {
      throw new Error(`Failed to create tape chart view: ${error.message}`);
    }
  }

  async getTapeChartViews(userId, hotelId) {
    try {
      // Build query scoped by hotelId for multi-tenancy isolation
      const viewQuery = {
        $or: [
          { createdBy: userId },
          { isSystemDefault: true }
        ]
      };
      if (hotelId) viewQuery.hotelId = hotelId;

      let views = await TapeChartView.find(viewQuery).sort({ isSystemDefault: -1, viewName: 1 }).lean().limit(1000);

      // Create default view if none exist (upsert to avoid duplicate key errors)
      if (views.length === 0 && hotelId) {
        const defaultView = await TapeChartView.findOneAndUpdate(
          { hotelId, viewId: 'default-view' },
          {
            $setOnInsert: {
              hotelId,
              viewId: 'default-view',
              viewName: 'Default View',
              viewType: 'daily',
              dateRange: { defaultDays: 7 },
              displaySettings: {
                showWeekends: true,
                colorCoding: {
                  available: '#10B981',
                  occupied: '#EF4444',
                  reserved: '#F59E0B',
                  maintenance: '#8B5CF6',
                  out_of_order: '#6B7280',
                  dirty: '#F97316',
                  clean: '#06B6D4'
                },
                roomSorting: 'floor',
                showGuestNames: true,
                showRoomTypes: true,
                showRates: false,
                compactView: false
              },
              filters: {},
              isSystemDefault: true,
              createdBy: userId
            }
          },
          { upsert: true, new: true, lean: true }
        );
        views = [defaultView];
      }

      return views;
    } catch (error) {
      throw new Error(`Failed to fetch tape chart views: ${error.message}`);
    }
  }

  async updateTapeChartView(viewId, updateData) {
    try {
      return await TapeChartView.findByIdAndUpdate(
        viewId,
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Failed to update tape chart view: ${error.message}`);
    }
  }

  async deleteTapeChartView(viewId) {
    try {
      await TapeChartView.findByIdAndDelete(viewId);
    } catch (error) {
      throw new Error(`Failed to delete tape chart view: ${error.message}`);
    }
  }

  // Generate Tape Chart Data
  async generateTapeChartData(viewId, dateRange, hotelId) {
    try {
      // Validate viewId — frontend may send synthetic IDs like 'default-week' or 'fallback-view'
      const isValidViewId = mongoose.Types.ObjectId.isValid(viewId);
      let view = null;
      if (isValidViewId) {
        view = await TapeChartView.findById(viewId).lean();
      }
      // If view not found (invalid id or missing in DB), use a default config
      if (!view) {
        view = {
          _id: viewId,
          viewName: 'Default View',
          viewType: 'daily',
          dateRange: { defaultDays: 7 },
          displaySettings: {
            showWeekends: true,
            colorCoding: {
              available: '#10B981',
              occupied: '#EF4444',
              reserved: '#F59E0B',
              maintenance: '#8B5CF6',
              out_of_order: '#6B7280',
              dirty: '#F97316',
              clean: '#06B6D4'
            },
            roomSorting: 'floor',
            showGuestNames: true,
          },
          filters: {},
          isSystemDefault: true
        };
      }

      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Build hotelId filter for tenant isolation
      const hotelIdStr = safeObjectIdString(hotelId);
      const hotelFilter = hotelIdStr ? { hotelId: hotelIdStr } : {};

      // Get room configurations — scoped by hotelId for tenant isolation
      let roomConfigs = await this.getRoomConfigurations({
        isActive: true,
        ...view.filters,
        ...(hotelIdStr ? { hotelId: hotelIdStr } : {})
      });

      // If no room configurations exist, create them from existing rooms
      if (!roomConfigs || roomConfigs.length === 0) {
        const rooms = await Room.find({ ...hotelFilter, isActive: true }).sort({ roomNumber: 1 }).lean().limit(1000);
        roomConfigs = [];

        for (const room of rooms) {
          // Create a basic room configuration for each room
          const config = {
            _id: new mongoose.Types.ObjectId(),
            roomId: room._id,
            roomNumber: room.roomNumber,
            roomType: room.type,
            floor: room.floor || 1,
            building: room.building || 'Main',
            wing: room.wing || 'A',
            position: { row: Math.floor(roomConfigs.length / 10), column: roomConfigs.length % 10 },
            displaySettings: {
              color: '#3B82F6',
              width: 120,
              height: 60,
              showRoomNumber: true,
              showGuestName: true,
              showRoomType: true
            },
            isActive: true,
            sortOrder: roomConfigs.length
          };
          roomConfigs.push(config);
        }
      } else {
      }

      // Get ALL bookings for the date range (don't filter by status in database)
      const allBookings = await Booking.find({
        ...hotelFilter,
        $or: [
          {
            checkIn: { $gte: startDate, $lte: endDate }
          },
          {
            checkOut: { $gte: startDate, $lte: endDate }
          },
          {
            checkIn: { $lt: startDate },
            checkOut: { $gte: endDate }
          }
        ]
      })
      .populate('rooms.roomId', 'roomNumber type')
      .populate('userId', 'name email phone').lean().limit(1000);

      
      // Filter bookings by status — only show ACTIVE bookings on tape chart
      // Checked-out bookings should NOT occupy grid cells (room is now available)
      const bookings = allBookings.filter(booking => {
        const isActiveStatus = ['confirmed', 'checked_in', 'pending', 'modified'].includes(booking.status);
        return isActiveStatus;
      });



      // Get room blocks — scoped by hotelId for tenant isolation
      const blocks = await this.getRoomBlocks({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'active',
        ...(hotelIdStr ? { hotelId: hotelIdStr } : {})
      });

      // Generate chart data
      const chartData = {
        view,
        dateRange: { startDate, endDate },
        rooms: [],
        summary: {
          totalRooms: roomConfigs.length,
          occupiedRooms: 0,
          availableRooms: 0,
          reservedRooms: 0,
          maintenanceRooms: 0,
          dirtyRooms: 0,
          blockedRooms: 0,
          occupancyRate: 0
        }
      };

      // Batch: fetch all rooms in a single query
      const roomNumbers = roomConfigs.filter(c => c.roomNumber).map(c => c.roomNumber);
      const roomIds = roomConfigs.filter(c => c.roomId).map(c => c.roomId);
      const allRooms = await Room.find({
        ...hotelFilter,
        $or: [
          ...(roomNumbers.length > 0 ? [{ roomNumber: { $in: roomNumbers } }] : []),
          ...(roomIds.length > 0 ? [{ _id: { $in: roomIds } }] : [])
        ],
        isActive: true
      }).limit(1000).lean();
      const roomByNumber = new Map(allRooms.map(r => [r.roomNumber, r]));
      const roomById = new Map(allRooms.map(r => [r._id.toString(), r]));

      // Track rooms with stale "occupied" status for batch DB correction
      let staleOccupiedRoomIds = [];

      // Process each room
      for (const config of roomConfigs) {
        const room = roomByNumber.get(config.roomNumber) || roomById.get(config.roomId?.toString());
        if (!room) continue;

        // Sync config roomType with actual Room model to prevent stale data
        if (room.type && config.roomType !== room.type) {
          config.roomType = room.type;
        }

        // Match bookings to this room — handle both populated objects and raw ObjectIds,
        // and fall back to roomNumber matching for resilience
        const roomIdStr = room._id.toString();
        const roomNum = room.roomNumber || config.roomNumber;
        const roomBookings = bookings.filter(b => b.rooms && b.rooms.some(r => {
          // Match by roomId (populated object or raw ObjectId)
          if (r.roomId) {
            if (typeof r.roomId === 'object' && r.roomId._id) {
              if (r.roomId._id.toString() === roomIdStr) return true;
              // Also match by populated roomNumber
              if (roomNum && r.roomId.roomNumber === roomNum) return true;
            } else {
              if (r.roomId.toString() === roomIdStr) return true;
            }
          }
          // Fallback: match by roomNumber field on the booking room entry
          if (roomNum && r.roomNumber === roomNum) return true;
          return false;
        }));
        const roomBlocks = blocks.filter(b => b.rooms.some(r => {
          if (!r.roomId) return false;
          if (typeof r.roomId === 'object' && r.roomId._id) {
            return r.roomId._id.toString() === roomIdStr;
          }
          return r.roomId.toString() === roomIdStr;
        }));
        

        // Determine if the room has an active (checked_in) booking covering today
        const now = new Date();
        const todayStartForStatus = new Date();
        todayStartForStatus.setUTCHours(0, 0, 0, 0);

        const hasActiveBookingToday = roomBookings.some(booking => {
          if (booking.status === 'checked_out' || booking.status === 'cancelled') return false;
          if (!['checked_in'].includes(booking.status)) return false;
          const checkIn = new Date(booking.checkIn);
          const checkOut = new Date(booking.checkOut);
          return checkIn <= now && checkOut >= todayStartForStatus;
        });

        // Fix stale status: if room.status is "occupied" but no active booking covers today,
        // the status is stale and should be treated as "available"
        let correctedCurrentStatus = this.mapRoomStatusToTapeChart(room.status);
        if (room.status === 'occupied' && !hasActiveBookingToday) {
          correctedCurrentStatus = 'available';
          // Track this room for batch DB correction
          staleOccupiedRoomIds.push(room._id);
        }

        const roomData = {
          config,
          room,
          timeline: [],
          currentStatus: correctedCurrentStatus,
          bookings: roomBookings,
          blocks: roomBlocks
        };

        // Generate timeline for date range (use UTC methods to avoid timezone drift)
        for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          // Normalize loop date to UTC midnight for reliable comparison
          const dayStart = new Date(d);
          dayStart.setUTCHours(0, 0, 0, 0);

          const dayBooking = roomData.bookings.find(b => {
            const bookingCheckIn = new Date(b.checkIn);
            const bookingCheckOut = new Date(b.checkOut);

            // Normalize to UTC to avoid timezone mismatch with ISO date strings
            bookingCheckIn.setUTCHours(0, 0, 0, 0);
            bookingCheckOut.setUTCHours(23, 59, 59, 999);

            // Include both check-in and check-out dates in the booking display
            // For Sep 23-25 booking: show on Sep 23, 24, and 25
            return bookingCheckIn <= dayStart && bookingCheckOut >= dayStart;
          });

          const dayBlock = roomData.blocks.find(b => {
            const blockStart = new Date(b.startDate);
            const blockEnd = new Date(b.endDate);
            blockStart.setUTCHours(0, 0, 0, 0);
            blockEnd.setUTCHours(23, 59, 59, 999);
            return blockStart <= dayStart && blockEnd >= dayStart;
          });

          let status = 'available';
          let guestName = null;
          let bookingId = null;
          let rate = null;

          if (dayBooking) {
            status = dayBooking.status === 'checked_in' ? 'occupied' : 'reserved';
            guestName = dayBooking.userId?.name || 'Unknown Guest';
            bookingId = dayBooking._id;
            const stayDurationMs = new Date(dayBooking.checkOut) - new Date(dayBooking.checkIn);
            const stayNights = stayDurationMs / (1000 * 60 * 60 * 24);
            rate = stayNights > 0 ? dayBooking.totalAmount / stayNights : dayBooking.totalAmount || 0;
          } else if (dayBlock) {
            status = 'blocked';
            guestName = dayBlock.groupName;
          } else if (room.status === 'maintenance' || room.status === 'out_of_order') {
            status = this.mapRoomStatusToTapeChart(room.status);
          }

          roomData.timeline.push({
            date: dateStr,
            status,
            guestName,
            bookingId,
            rate,
            // Real booking data for visual indicators
            gender: dayBooking ? this.inferGuestGender(dayBooking.userId?.name) : null,
            bookingType: dayBooking ? this.inferBookingType(dayBooking) : null,
            aiPrediction: status === 'available' ? {
              demandLevel: this.calculateDemandLevel(dayStart, bookings),
              profitabilityScore: this.calculateProfitabilityScore(room, dayStart),
              recommendedRate: this.calculateRecommendedRate(room, dayStart),
              confidence: 85 // Static confidence for now
            } : null,
            preferences: dayBooking ? this.extractGuestPreferences(dayBooking) : null,
            vipStatus: dayBooking ? this.determineVipStatus(dayBooking) : 'none'
          });
        }

        chartData.rooms.push(roomData);

        // Update summary based on booking-aware corrected status
        // Use correctedCurrentStatus which already accounts for stale "occupied" rooms,
        // and override to 'occupied' only if there is a verified active booking today
        let finalStatus = correctedCurrentStatus;
        if (hasActiveBookingToday) {
          finalStatus = 'occupied';
        }

        switch (finalStatus) {
          case 'occupied':
            chartData.summary.occupiedRooms++;
            break;
          case 'available':
            chartData.summary.availableRooms++;
            break;
          case 'reserved':
            chartData.summary.reservedRooms++;
            break;
          case 'maintenance':
          case 'out_of_order':
            chartData.summary.maintenanceRooms++;
            break;
          case 'dirty':
            chartData.summary.dirtyRooms++;
            break;
        }
      }

      // Self-healing: batch-update stale "occupied" rooms back to "vacant" in the DB
      // Fire-and-forget to avoid blocking the response
      if (staleOccupiedRoomIds.length > 0) {
        logger.info(`Fixing ${staleOccupiedRoomIds.length} stale occupied room(s): ${staleOccupiedRoomIds.map(id => id.toString()).join(', ')}`);
        Room.updateMany(
          { _id: { $in: staleOccupiedRoomIds } },
          { $set: { status: 'vacant' } }
        ).then(result => {
          logger.info(`Self-healed ${result.modifiedCount} stale occupied room(s) to vacant`);
        }).catch(err => {
          logger.error('Failed to self-heal stale occupied rooms:', err);
        });
      }

      // Recalculate available rooms based on corrected occupied count
      const calculatedAvailable = chartData.summary.totalRooms -
                                  chartData.summary.occupiedRooms -
                                  chartData.summary.reservedRooms -
                                  chartData.summary.maintenanceRooms -
                                  chartData.summary.dirtyRooms -
                                  chartData.summary.blockedRooms;

      // Override the available count with calculated value
      chartData.summary.availableRooms = Math.max(0, calculatedAvailable);


      // Debug: Log final summary data being sent to frontend
      logger.debug('🔧 BACKEND DEBUG - Final summary data:', {
        totalRooms: chartData.summary.totalRooms,
        occupiedRooms: chartData.summary.occupiedRooms,
        availableRooms: chartData.summary.availableRooms,
        reservedRooms: chartData.summary.reservedRooms,
        maintenanceRooms: chartData.summary.maintenanceRooms,
        dirtyRooms: chartData.summary.dirtyRooms,
        blockedRooms: chartData.summary.blockedRooms
      });

      // Calculate occupancy rate
      const availableForOccupancy = chartData.summary.totalRooms - chartData.summary.maintenanceRooms;
      if (availableForOccupancy > 0) {
        chartData.summary.occupancyRate =
          ((chartData.summary.occupiedRooms + chartData.summary.reservedRooms) / availableForOccupancy) * 100;
      }


      return chartData;
    } catch (error) {
      logger.error('Error generating tape chart data:', error);
      logger.error('Stack trace:', error.stack);
      throw new Error(`Failed to generate tape chart data: ${error.message}`);
    }
  }

  // Room Assignment Rules
  async createAssignmentRule(ruleData, userId) {
    try {
      const rule = new RoomAssignmentRules({
        ...ruleData,
        createdBy: userId,
        lastModifiedBy: userId
      });
      await rule.save();
      return rule;
    } catch (error) {
      throw new Error(`Failed to create assignment rule: ${error.message}`);
    }
  }

  async getAssignmentRules(filters = {}) {
    try {
      const query = {};
      if (filters.isActive !== undefined) query.isActive = filters.isActive;

      return await RoomAssignmentRules.find(query)
        .populate('createdBy lastModifiedBy', 'name email')
        .sort({ priority: 1, ruleName: 1 }).lean().limit(1000);
    } catch (error) {
      throw new Error(`Failed to fetch assignment rules: ${error.message}`);
    }
  }

  async getApplicableRules(reservation) {
    try {
      const rules = await RoomAssignmentRules.find({ isActive: true })
        .sort({ priority: 1 }).lean().limit(1000);

      return rules.filter(rule => {
        // Check if rule applies to this reservation
        const conditions = rule.conditions;
        
        if (conditions.guestType && conditions.guestType.length > 0) {
          if (!conditions.guestType.includes(reservation.guestProfile.vipStatus)) {
            return false;
          }
        }

        if (conditions.reservationType && conditions.reservationType.length > 0) {
          if (!conditions.reservationType.includes(reservation.reservationType)) {
            return false;
          }
        }

        // Add more condition checks as needed

        return true;
      });
    } catch (error) {
      throw new Error(`Failed to get applicable rules: ${error.message}`);
    }
  }

  async findAvailableRooms(criteria) {
    try {
      const query = {
        roomType: criteria.roomType,
        status: { $in: ['available', 'clean'] },
        isActive: true
      };

      // Apply preferences
      if (criteria.preferences.preferredFloor) {
        query.floor = criteria.preferences.preferredFloor;
      }

      if (criteria.preferences.preferredRooms && criteria.preferences.preferredRooms.length > 0) {
        query.roomNumber = { $in: criteria.preferences.preferredRooms };
      }

      // Check availability for date range
      const conflictingBookings = await Booking.find({
        $or: [
          {
            checkIn: { $lt: criteria.checkOut },
            checkOut: { $gte: criteria.checkIn }
          }
        ],
        status: { $in: ['confirmed', 'checked_in'] }
      }).lean().limit(1000);

      const unavailableRoomIds = conflictingBookings.map(b => b.roomId.toString());
      if (unavailableRoomIds.length > 0) {
        query._id = { $nin: unavailableRoomIds };
      }

      return await Room.find(query).sort({ floor: 1, roomNumber: 1 }).lean().limit(1000);
    } catch (error) {
      throw new Error(`Failed to find available rooms: ${error.message}`);
    }
  }

  async selectBestRoom(availableRooms, reservation, rules) {
    try {
      let scoredRooms = availableRooms.map(room => ({
        room,
        score: 0
      }));

      // Apply rule-based scoring
      for (const rule of rules) {
        for (const scoredRoom of scoredRooms) {
          const room = scoredRoom.room;

          // Preferred floors
          if (rule.actions.preferredFloors && rule.actions.preferredFloors.includes(room.floor)) {
            scoredRoom.score += 10;
          }

          // Preferred room numbers
          if (rule.actions.preferredRoomNumbers && rule.actions.preferredRoomNumbers.includes(room.roomNumber)) {
            scoredRoom.score += 15;
          }

          // Avoid room numbers
          if (rule.actions.avoidRoomNumbers && rule.actions.avoidRoomNumbers.includes(room.roomNumber)) {
            scoredRoom.score -= 20;
          }
        }
      }

      // Apply preference-based scoring
      const preferences = reservation.roomPreferences;
      
      for (const scoredRoom of scoredRooms) {
        const room = scoredRoom.room;

        if (preferences.preferredFloor && room.floor === preferences.preferredFloor) {
          scoredRoom.score += 8;
        }

        if (preferences.preferredRooms && preferences.preferredRooms.includes(room.roomNumber)) {
          scoredRoom.score += 12;
        }

        // Add more preference scoring logic
      }

      // Sort by score and return best room
      scoredRooms.sort((a, b) => b.score - a.score);
      return scoredRooms[0].room;
    } catch (error) {
      throw new Error(`Failed to select best room: ${error.message}`);
    }
  }

  // Waitlist Management
  async addToWaitlist(reservationId, waitlistData) {
    try {
      const reservation = await AdvancedReservation.findById(reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Get current waitlist position
      const waitlistCount = await AdvancedReservation.countDocuments({
        'waitlistInfo.waitlistPosition': { $exists: true, $ne: null }
      });

      reservation.waitlistInfo = {
        ...waitlistData,
        waitlistPosition: waitlistCount + 1,
        waitlistDate: new Date()
      };

      await reservation.save();
      return reservation;
    } catch (error) {
      throw new Error(`Failed to add to waitlist: ${error.message}`);
    }
  }

  async processWaitlist() {
    try {
      const waitlistReservations = await AdvancedReservation.find({
        'waitlistInfo.waitlistPosition': { $exists: true, $ne: null }
      })
      .populate('bookingId')
      .sort({ 'waitlistInfo.waitlistPosition': 1 }).lean().limit(1000);

      const processed = [];

      for (const reservation of waitlistReservations) {
        try {
          const availableRooms = await this.findAvailableRooms({
            checkIn: reservation.bookingId.checkIn,
            checkOut: reservation.bookingId.checkOut,
            roomType: reservation.waitlistInfo.preferredRoomTypes || [reservation.bookingId.roomType],
            preferences: reservation.roomPreferences
          });

          if (availableRooms.length > 0) {
            // Auto-confirm if preference is set
            if (reservation.waitlistInfo.autoConfirm) {
              const selectedRoom = availableRooms[0];
              await this.assignRoom(
                reservation._id,
                {
                  roomId: selectedRoom._id,
                  roomNumber: selectedRoom.roomNumber,
                  assignmentType: 'waitlist_auto'
                },
                'system'
              );

              // Remove from waitlist
              reservation.waitlistInfo = undefined;
              await reservation.save();

              processed.push({
                reservationId: reservation._id,
                action: 'auto_confirmed',
                room: selectedRoom
              });
            } else {
              // Send notification about availability
              processed.push({
                reservationId: reservation._id,
                action: 'notify_available',
                rooms: availableRooms
              });
            }
          }
        } catch (error) {
          logger.error(`Error processing waitlist reservation ${reservation._id}:`, error);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Failed to process waitlist: ${error.message}`);
    }
  }

  // Analytics and Reporting
  async generateOccupancyReport(dateRange, groupBy = 'day', hotelId = null) {
    try {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Build match filter — scoped by hotelId for multi-tenancy
      const matchFilter = { date: { $gte: startDate, $lte: endDate } };
      if (hotelId) matchFilter.hotelId = hotelId;

      const pipeline = [
        {
          $match: matchFilter
        },
        {
          $lookup: {
            from: 'rooms',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room'
          }
        },
        {
          $unwind: '$room'
        },
        {
          $group: {
            _id: {
              date: groupBy === 'day' ? 
                { $dateToString: { format: '%Y-%m-%d', date: '$date' } } :
                { $dateToString: { format: '%Y-%m', date: '$date' } },
              status: '$status'
            },
            count: { $sum: 1 },
            rooms: { $addToSet: '$room.roomNumber' }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            statusCounts: {
              $push: {
                status: '$_id.status',
                count: '$count',
                rooms: '$rooms'
              }
            },
            totalRooms: { $sum: '$count' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];

      const data = await RoomStatusHistory.aggregate(pipeline);

      return {
        dateRange,
        groupBy,
        data: data.map(item => ({
          date: item._id,
          ...item.statusCounts.reduce((acc, curr) => {
            acc[curr.status] = curr.count;
            return acc;
          }, {}),
          totalRooms: item.totalRooms,
          occupancyRate: item.statusCounts.find(s => s.status === 'occupied')?.count / item.totalRooms * 100 || 0
        }))
      };
    } catch (error) {
      throw new Error(`Failed to generate occupancy report: ${error.message}`);
    }
  }

  // Room Utilization Stats
  async getRoomUtilizationStats(dateRange = {}, hotelId = null) {
    try {
      const startDate = dateRange.startDate ? new Date(dateRange.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();

      // Build hotelId match filter for multi-tenancy
      const roomMatch = hotelId ? { $match: { hotelId } } : null;
      const historyMatch = { date: { $gte: startDate, $lte: endDate } };
      if (hotelId) historyMatch.hotelId = hotelId;

      // Get total rooms by type
      const roomPipeline = [
        ...(roomMatch ? [roomMatch] : []),
        {
          $group: {
            _id: '$roomType',
            totalRooms: { $sum: 1 },
            availableRooms: {
              $sum: {
                $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
              }
            }
          }
        }
      ];
      const roomsByType = await Room.aggregate(roomPipeline);

      // Get occupancy data
      const occupancyData = await RoomStatusHistory.aggregate([
        {
          $match: historyMatch
        },
        {
          $lookup: {
            from: 'rooms',
            localField: 'roomId',
            foreignField: '_id',
            as: 'room'
          }
        },
        {
          $unwind: '$room'
        },
        {
          $group: {
            _id: {
              roomType: '$room.roomType',
              status: '$status'
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$revenue' }
          }
        }
      ]);

      // Calculate utilization metrics
      const utilization = roomsByType.map(roomType => {
        const occupiedCount = occupancyData.find(
          o => o._id.roomType === roomType._id && o._id.status === 'occupied'
        )?.count || 0;
        
        const reservedCount = occupancyData.find(
          o => o._id.roomType === roomType._id && o._id.status === 'reserved'
        )?.count || 0;

        const totalRevenue = occupancyData
          .filter(o => o._id.roomType === roomType._id)
          .reduce((sum, o) => sum + (o.totalRevenue || 0), 0);

        const utilizationRate = ((occupiedCount + reservedCount) / roomType.totalRooms) * 100;
        const averageRevenue = roomType.totalRooms > 0 ? totalRevenue / roomType.totalRooms : 0;

        return {
          roomType: roomType._id,
          totalRooms: roomType.totalRooms,
          occupiedRooms: occupiedCount,
          reservedRooms: reservedCount,
          availableRooms: roomType.availableRooms,
          utilizationRate,
          totalRevenue,
          averageRevenue,
          revPAR: (utilizationRate / 100) * averageRevenue
        };
      });

      return {
        period: { startDate, endDate },
        utilization,
        summary: {
          totalRooms: utilization.reduce((sum, u) => sum + u.totalRooms, 0),
          totalOccupied: utilization.reduce((sum, u) => sum + u.occupiedRooms, 0),
          totalRevenue: utilization.reduce((sum, u) => sum + u.totalRevenue, 0),
          overallUtilization: utilization.reduce((sum, u) => sum + u.utilizationRate, 0) / utilization.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to get room utilization stats: ${error.message}`);
    }
  }

  // Generate Financial Dashboard for Tape Chart
  async generateTapeChartDashboard() {
    try {
      // Get current room status summary
      const roomSummary = await Room.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get today's bookings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayBookings = await Booking.find({
        checkInDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'checked_in'] }
      }).lean().limit(1000);

      const checkouts = await Booking.find({
        checkOut: { $gte: today, $lt: tomorrow },
        status: 'checked_in'
      }).lean().limit(1000);

      // Calculate reserved rooms from confirmed bookings
      const reservedRoomsCount = await Booking.aggregate([
        {
          $match: {
            status: 'confirmed',
            checkIn: { $gte: today },
            checkOut: { $gte: today }
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
      ]);

      const reservedCount = reservedRoomsCount[0]?.count || 0;

      // Room blocks
      const activeBlocks = await RoomBlock.countDocuments({
        status: 'active',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });

      const blockedRooms = await RoomBlock.aggregate([
        {
          $match: {
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
          }
        },
        {
          $group: {
            _id: null,
            totalBlocked: { $sum: '$totalRooms' }
          }
        }
      ]);

      // Advanced reservations
      const vipReservations = await AdvancedReservation.countDocuments({
        'guestProfile.vipStatus': { $ne: 'none' }
      });

      const upgradesAvailable = await AdvancedReservation.countDocuments({
        upgrades: { $exists: true, $not: { $size: 0 } }
      });

      const specialRequests = await AdvancedReservation.aggregate([
        {
          $project: {
            requestCount: { $size: '$specialRequests' }
          }
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: '$requestCount' }
          }
        }
      ]);

      // Waitlist
      const waitlistCount = await AdvancedReservation.countDocuments({
        'waitlistInfo.waitlistPosition': { $exists: true, $ne: null }
      });

      // Calculate metrics with proper status mapping
      const summary = {
        totalRooms: roomSummary.reduce((sum, r) => sum + r.count, 0),
        availableRooms: roomSummary.find(r => r._id === 'vacant')?.count || 0,
        occupiedRooms: roomSummary.find(r => r._id === 'occupied')?.count || 0,
        reservedRooms: reservedCount,
        maintenanceRooms: (roomSummary.find(r => r._id === 'maintenance')?.count || 0) + (roomSummary.find(r => r._id === 'out_of_order')?.count || 0),
        dirtyRooms: roomSummary.find(r => r._id === 'dirty')?.count || 0,
        occupancyRate: 0,
        adr: await this.calculateADR(hotelId, new Date()),
        revpar: await this.calculateRevPAR(hotelId, new Date())
      };

      summary.occupancyRate = ((summary.occupiedRooms + summary.reservedRooms) / summary.totalRooms) * 100;

      return {
        summary,
        roomBlocks: {
          activeBlocks,
          blockedRooms: blockedRooms[0]?.totalBlocked || 0,
          upcomingReleases: await this.getUpcomingReleases(hotelId, new Date())
        },
        reservations: {
          totalReservations: todayBookings.length,
          vipReservations,
          upgradesAvailable,
          specialRequests: specialRequests[0]?.totalRequests || 0
        },
        waitlist: {
          totalOnWaitlist: waitlistCount,
          availableMatches: await this.getAvailableWaitlistMatches(hotelId, new Date())
        },
        alerts: [
          {
            type: 'maintenance',
            message: 'Rooms requiring maintenance attention',
            severity: 'warning',
            count: summary.maintenanceRooms
          },
          {
            type: 'checkout',
            message: 'Pending checkouts today',
            severity: 'info',
            count: checkouts.length
          }
        ].filter(alert => alert.count > 0),
        recentActivity: [
          {
            time: new Date().toLocaleTimeString(),
            action: 'Room Status Updated',
            details: 'Room 101 marked as clean',
            user: 'Housekeeping Staff'
          },
          {
            time: new Date(Date.now() - 300000).toLocaleTimeString(),
            action: 'Check-in Completed',
            details: 'Guest Smith checked into Room 205',
            user: 'Front Desk'
          },
          {
            time: new Date(Date.now() - 600000).toLocaleTimeString(),
            action: 'Room Assignment',
            details: 'VIP guest assigned to premium suite',
            user: 'Manager'
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to generate tape chart dashboard: ${error.message}`);
    }
  }

  // Bulk Operations
  async bulkUpdateRoomStatus(updates, userId) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const result = await this.updateRoomStatus(update.roomId, {
            status: update.status,
            notes: update.notes,
            changeReason: update.changeReason || 'bulk_update'
          }, userId);
          
          results.push({
            roomId: update.roomId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            roomId: update.roomId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        processed: updates.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      throw new Error(`Failed to bulk update room status: ${error.message}`);
    }
  }

  async bulkRoomAssignment(assignments, userId) {
    try {
      const results = [];

      for (const assignment of assignments) {
        try {
          const result = await this.assignRoom(
            assignment.reservationId,
            {
              roomId: assignment.roomId,
              roomNumber: assignment.roomNumber,
              assignmentType: assignment.assignmentType || 'manual',
              notes: assignment.notes
            },
            userId
          );
          
          results.push({
            reservationId: assignment.reservationId,
            roomId: assignment.roomId,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            reservationId: assignment.reservationId,
            roomId: assignment.roomId,
            success: false,
            error: error.message
          });
        }
      }

      return {
        processed: assignments.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      throw new Error(`Failed to bulk assign rooms: ${error.message}`);
    }
  }

  // Real-time Updates
  async getRoomStatusUpdates(since, hotelId = null) {
    try {
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 300000); // Last 5 minutes

      // Build query — scoped by hotelId for multi-tenancy
      const query = { createdAt: { $gte: sinceDate } };
      if (hotelId) query.hotelId = hotelId;

      const updates = await RoomStatusHistory.find(query)
      .populate('roomId', 'roomNumber roomType')
      .populate('changedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50).lean();

      return {
        since: sinceDate,
        updates: updates.map(update => ({
          id: update._id,
          roomId: update.roomId._id,
          roomNumber: update.roomId.roomNumber,
          roomType: update.roomId.roomType,
          status: update.status,
          previousStatus: update.previousStatus,
          guestName: update.guestName,
          changedBy: update.changedBy?.name || 'System',
          changeReason: update.changeReason,
          timestamp: update.createdAt,
          notes: update.notes
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get room status updates: ${error.message}`);
    }
  }

  // Status mapping helper
  mapRoomStatusToTapeChart(roomStatus) {
    const statusMapping = {
      'vacant': 'available',
      'occupied': 'occupied',
      'dirty': 'dirty',
      'maintenance': 'maintenance',
      'out_of_order': 'out_of_order'
    };
    return statusMapping[roomStatus] || 'available';
  }

  // Real data inference helpers for tape chart visual features
  inferGuestGender(guestName) {
    if (!guestName) return null;
    
    // Basic name-based gender inference (could be enhanced with a proper service)
    const firstName = guestName.split(' ')[0].toLowerCase();
    const maleNames = ['john', 'mike', 'david', 'robert', 'james', 'william', 'richard', 'charles', 'joseph', 'thomas'];
    const femaleNames = ['mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'sarah', 'susan', 'jessica', 'nancy', 'karen'];
    
    if (maleNames.some(name => firstName.includes(name))) return 'male';
    if (femaleNames.some(name => firstName.includes(name))) return 'female';
    
    // Check for family indicators
    if (guestName.toLowerCase().includes('family') || guestName.toLowerCase().includes('&')) return 'family';
    
    return 'other'; // Default when uncertain
  }

  inferBookingType(booking) {
    // Determine booking type based on booking data
    if (booking.corporateBooking?.corporateCompanyId) return 'corporate';
    if (booking.source === 'booking_com' || booking.source === 'expedia') return 'travel_agent';
    if (booking.guestDetails?.adults > 6 || booking.nights > 7) return 'group';
    return 'individual';
  }

  calculateDemandLevel(date, allBookings) {
    // Calculate demand based on actual booking density for the date
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const dayBookings = allBookings.filter(b =>
      new Date(b.checkIn) <= date && new Date(b.checkOut) >= date  // Include bookings checking out today
    );
    
    const occupancyRate = dayBookings.length / 100; // Assuming 100 rooms
    
    if (occupancyRate > 0.8) return 'high';
    if (occupancyRate > 0.6) return 'medium';
    return 'low';
  }

  calculateProfitabilityScore(room, date) {
    // Calculate profitability based on room rate vs base rate
    const baseRate = room.baseRate || 10000;
    const currentRate = room.currentRate || baseRate;
    const rateRatio = currentRate / baseRate;
    
    // Weekend bonus
    const dayOfWeek = date.getDay();
    const weekendBonus = (dayOfWeek === 0 || dayOfWeek === 6) ? 10 : 0;
    
    return Math.min(100, Math.floor(rateRatio * 80) + weekendBonus);
  }

  calculateRecommendedRate(room, date) {
    const baseRate = room.baseRate || 10000;
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Weekend premium
    const weekendMultiplier = isWeekend ? 1.2 : 1.0;
    return Math.floor(baseRate * weekendMultiplier);
  }

  determineVipStatus(booking) {
    // Determine VIP status based on booking value and type
    if (booking.corporateBooking?.corporateCompanyId) return 'corporate';
    if (booking.totalAmount > 25000) return 'svip';
    if (booking.totalAmount > 15000) return 'vip';
    return 'none';
  }

  extractGuestPreferences(booking) {
    // Extract preferences from booking special requests
    const specialRequests = booking.guestDetails?.specialRequests || '';
    return {
      roomTemp: specialRequests.includes('temperature') ? 22 : null,
      pillow: specialRequests.includes('pillow') ? 'soft' : null,
      wakeUpCall: specialRequests.includes('wake') || specialRequests.includes('call'),
      newspaper: specialRequests.includes('newspaper') || specialRequests.includes('paper')
    };
  }

  // Dashboard Data Generation
  async generateTapeChartDashboard(hotelId) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      // Get all rooms with real-time status (like Room Management)
      const roomsResult = await Room.getRoomsWithRealTimeStatus(hotelId, { limit: 1000 });
      const rooms = roomsResult.rooms;

      // Debug: Check if we're getting the same data as Room Management
      logger.debug('🔧 TAPECHART DEBUG - Hotel ID:', hotelId);
      logger.debug('🔧 TAPECHART DEBUG - Total rooms from getRoomsWithRealTimeStatus:', rooms.length);

      // Debug: Check housekeeping tasks directly
      const Housekeeping = mongoose.model('Housekeeping');
      const housekeepingTasks = await Housekeeping.find({
        roomId: { $in: rooms.map(r => r._id) },
        status: { $in: ['pending', 'in_progress'] }
      }).select('roomId status').lean().limit(1000);
      logger.debug('🔧 TAPECHART DEBUG - Housekeeping tasks found:', housekeepingTasks.length);
      housekeepingTasks.forEach(task => {
        const room = rooms.find(r => r._id.toString() === task.roomId.toString());
        logger.debug(`🔧 HOUSEKEEPING TASK: Room ${room?.roomNumber || task.roomId} - Status: ${task.status}`);
      });

      // Get today's bookings
      const bookings = await Booking.find({
        hotelId,
        $or: [
          { checkIn: { $lte: endOfDay }, checkOut: { $gte: startOfDay } },
          { status: { $in: ['confirmed', 'checked_in'] } }
        ]
      }).populate('rooms.roomId').lean().limit(1000);

      // Calculate room statistics using computedStatus (real-time status)
      const totalRooms = rooms.length;

      const roomsByStatus = rooms.reduce((acc, room) => {
        const status = room.computedStatus || room.status;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Debug: Log room statuses to see what we're getting
      logger.debug('🔧 BACKEND DEBUG - roomsByStatus:', roomsByStatus);
      rooms.forEach(room => {
        if (room.status === 'dirty' || room.computedStatus === 'dirty') {
          logger.debug(`🔧 DIRTY ROOM FOUND: ${room.roomNumber} - status: ${room.status}, computedStatus: ${room.computedStatus}`);
        }
      });


      // Calculate occupied rooms from active bookings (like Admin Dashboard)
      const now = new Date();
      // Reset today to UTC start of day for consistent comparison
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);

      const occupiedRooms = bookings.filter(booking => {
        return ['confirmed', 'checked_in'].includes(booking.status) &&
               new Date(booking.checkIn) <= now &&
               new Date(booking.checkOut) >= todayUTC; // Use >= like Admin Dashboard fix
      }).length;
      const availableRooms = roomsByStatus.vacant || 0;
      const maintenanceRooms = (roomsByStatus.maintenance || 0) + (roomsByStatus.out_of_order || 0);
      const dirtyRooms = roomsByStatus.dirty || 0;
      const blockedRooms = roomsByStatus.blocked || 0;

      // Reserved rooms are future bookings (checkIn > todayUTC)
      const reservedRooms = bookings.filter(booking => {
        return ['confirmed', 'checked_in'].includes(booking.status) &&
               new Date(booking.checkIn) > todayUTC;
      }).length;


      const actualOccupiedRooms = Math.max(occupiedRooms, reservedRooms);
      const occupancyRate = totalRooms > 0 ? (actualOccupiedRooms / totalRooms) * 100 : 0;

      // Calculate revenue metrics
      const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      const totalRoomNights = bookings.reduce((sum, booking) => sum + (booking.nights || 0), 0);
      const adr = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
      const revpar = totalRooms > 0 ? totalRevenue / totalRooms : 0;

      // Get room blocks
      const roomBlocks = await RoomBlock.find({
        hotelId,
        status: 'active',
        startDate: { $lte: endOfDay },
        endDate: { $gte: startOfDay }
      }).lean().limit(1000);

      // Reservation statistics
      const reservationsToday = bookings.filter(b =>
        new Date(b.checkIn).toDateString() === today.toDateString()
      );

      const vipReservations = bookings.filter(b =>
        b.guestDetails?.vipStatus || b.totalAmount > 20000
      );

      // Generate alerts
      const alerts = [];
      if (occupancyRate > 90) {
        alerts.push({
          type: 'occupancy',
          message: 'High occupancy rate - consider overbooking management',
          severity: 'warning',
          count: 1
        });
      }
      if (maintenanceRooms > totalRooms * 0.1) {
        alerts.push({
          type: 'maintenance',
          message: `${maintenanceRooms} rooms under maintenance`,
          severity: 'info',
          count: maintenanceRooms
        });
      }
      if (dirtyRooms > 5) {
        alerts.push({
          type: 'housekeeping',
          message: `${dirtyRooms} rooms need cleaning`,
          severity: 'warning',
          count: dirtyRooms
        });
      }

      // Recent activity from real data sources
      const recentActivity = await this.getRecentActivity(hotelId);

      return {
        summary: {
          totalRooms,
          availableRooms,
          occupiedRooms: actualOccupiedRooms,
          reservedRooms,
          maintenanceRooms,
          dirtyRooms,
          occupancyRate: Math.round(occupancyRate * 100) / 100,
          adr: Math.round(adr),
          revpar: Math.round(revpar)
        },
        roomBlocks: {
          activeBlocks: roomBlocks.length,
          blockedRooms,
          upcomingReleases: roomBlocks.filter(block =>
            new Date(block.endDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000)
          ).length
        },
        reservations: {
          totalReservations: bookings.length,
          vipReservations: vipReservations.length,
          upgradesAvailable: await this.getAvailableUpgrades(hotelId, new Date()),
          specialRequests: bookings.filter(b => b.specialRequests?.length > 0).length
        },
        waitlist: {
          totalOnWaitlist: await this.getWaitlistCount(hotelId),
          availableMatches: await this.getAvailableWaitlistMatches(hotelId, new Date())
        },
        alerts,
        recentActivity
      };

    } catch (error) {
      logger.error('Error generating dashboard data:', error);
      throw error;
    }
  }

  // Helper methods for real data calculations
  async getUpcomingReleases(hotelId, date) {
    try {
      const sevenDaysFromNow = new Date(date);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Count room blocks that will be released in the next 7 days
      const { RoomBlock } = TapeChart;
      const upcomingReleases = await RoomBlock.countDocuments({
        hotelId: toObjectId(hotelId, 'hotelId'),
        releaseDate: { $gte: date, $lte: sevenDaysFromNow },
        status: 'active'
      });

      return upcomingReleases;
    } catch (error) {
      logger.error('Error getting upcoming releases:', error);
      return 0;
    }
  }

  async getWaitlistCount(hotelId) {
    try {
      const count = await WaitingList.countDocuments({
        hotelId: toObjectId(hotelId, 'hotelId'),
        status: { $in: ['waiting', 'active'] }
      });
      return count;
    } catch (error) {
      logger.error('Error getting waitlist count:', error);
      return 0;
    }
  }

  async getAvailableWaitlistMatches(hotelId, date) {
    try {
      // Get available rooms for the requested dates
      const waitlistEntries = await WaitingList.find({
        hotelId: toObjectId(hotelId, 'hotelId'),
        status: { $in: ['waiting', 'active'] }
      }).lean().limit(1000);

      // Batch: get counts for all room types at once using aggregation
      const roomTypes = [...new Set(waitlistEntries.map(e => e.roomType))];
      const vacantCounts = await Room.aggregate([
        { $match: { hotelId: toObjectId(hotelId, 'hotelId'), type: { $in: roomTypes }, status: 'vacant' } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);
      const vacantByType = new Map(vacantCounts.map(v => [v._id, v.count]));

      let matches = 0;
      for (const entry of waitlistEntries) {
        if ((vacantByType.get(entry.roomType) || 0) > 0) {
          matches++;
        }
      }

      return matches;
    } catch (error) {
      logger.error('Error getting available waitlist matches:', error);
      return 0;
    }
  }

  async getAvailableUpgrades(hotelId, date) {
    try {
      // Get current bookings for today that could be upgraded
      const todayBookings = await Booking.find({
        hotelId: toObjectId(hotelId, 'hotelId'),
        checkIn: { $lte: date },
        checkOut: { $gte: date },
        status: { $in: ['confirmed', 'checked_in'] }
      }).populate('rooms.roomId', 'type').lean().limit(1000);

      // Get available higher-tier rooms for upgrades
      const availableUpgradeRooms = await Room.find({
        hotelId: toObjectId(hotelId, 'hotelId'),
        status: 'vacant'
      }).lean().limit(1000);

      let upgradeCount = 0;
      for (const booking of todayBookings) {
        // Check if booking has rooms and get room type
        const currentRoomType = booking.rooms?.[0]?.roomId?.type || booking.roomType;

        // Check if there are available rooms of higher tier
        const upgradeAvailable = availableUpgradeRooms.some(room => {
          return this.isUpgrade(currentRoomType, room.type);
        });

        if (upgradeAvailable) {
          upgradeCount++;
        }
      }

      return upgradeCount;
    } catch (error) {
      logger.error('Error getting available upgrades:', error);
      return 0;
    }
  }

  // Helper method to determine if one room type is an upgrade from another
  isUpgrade(currentType, newType) {
    const hierarchy = {
      'Standard Room': 1,
      'Deluxe Room': 2,
      'Executive Room': 3,
      'Deluxe Suite': 4,
      'Presidential Suite': 5
    };

    return (hierarchy[newType] || 0) > (hierarchy[currentType] || 0);
  }

  async calculateADR(hotelId, date) {
    try {
      // Average Daily Rate calculation - total room revenue / occupied rooms
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const bookings = await Booking.find({
        hotelId: toObjectId(hotelId, 'hotelId'),
        checkIn: { $lte: endDate },
        checkOut: { $gte: startDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }).lean().limit(1000);

      if (bookings.length === 0) return 0;

      const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      const totalRoomNights = bookings.reduce((sum, booking) => sum + (booking.nights || 1), 0);

      return totalRoomNights > 0 ? Math.round((totalRevenue / totalRoomNights) * 100) / 100 : 0;
    } catch (error) {
      logger.error('Error calculating ADR:', error);
      return 0;
    }
  }

  async calculateRevPAR(hotelId, date) {
    try {
      // Revenue Per Available Room - total room revenue / total available rooms
      const adr = await this.calculateADR(hotelId, date);

      const totalRooms = await Room.countDocuments({
        hotelId: toObjectId(hotelId, 'hotelId')
      });

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const occupiedRooms = await Booking.countDocuments({
        hotelId: toObjectId(hotelId, 'hotelId'),
        checkIn: { $lte: endDate },
        checkOut: { $gte: startDate },  // Include bookings checking out on start date
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });

      const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0;
      return Math.round(adr * occupancyRate * 100) / 100;
    } catch (error) {
      logger.error('Error calculating RevPAR:', error);
      return 0;
    }
  }

  async getRecentActivity(hotelId) {
    try {
      // Get recent bookings and room status changes
      const recentBookings = await Booking.find({
        hotelId: toObjectId(hotelId, 'hotelId'),
        createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Last 2 hours
      }).sort({ createdAt: -1 }).limit(5).populate('userId', 'username email').lean();

      const activities = [];

      for (const booking of recentBookings) {
        activities.push({
          time: booking.createdAt.toISOString(),
          action: 'New Booking',
          details: `Booking ${booking.bookingId || booking._id} created${booking.roomNumber ? ` for room ${booking.roomNumber}` : ''}`,
          user: booking.userId?.username || booking.userId?.email || 'Guest'
        });
      }

      // Add fallback if no recent activity
      if (activities.length === 0) {
        activities.push({
          time: new Date().toISOString(),
          action: 'System Status',
          details: 'No recent activity in the last 2 hours',
          user: 'System'
        });
      }

      return activities.slice(0, 3); // Return top 3 activities
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return [{
        time: new Date().toISOString(),
        action: 'System Status',
        details: 'Unable to load recent activity',
        user: 'System'
      }];
    }
  }
}

export default TapeChartService;