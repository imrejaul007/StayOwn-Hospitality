import availabilityService from '../services/availabilityService.js';
import rateManagementService from '../services/rateManagementService.js';
import RoomType from '../models/RoomType.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import mongoose from 'mongoose';

/** Public availability routes must scope by property — legacy check omits hotel filter when absent. */
function requireQueryHotelId(req, res) {
  const raw = req.query.hotelId;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    res.status(400).json({
      success: false,
      message: 'hotelId is required'
    });
    return null;
  }
  return String(raw).trim();
}

class AvailabilityController {
  /**
   * Check room availability for given dates (V2 - OTA-ready)
   */
  async checkAvailability(req, res) {
    try {
      const {
        checkInDate,
        checkOutDate,
        roomType,     // Legacy: room type string
        roomTypeId,   // New: room type ObjectId
        guestCount = 1
      } = req.query;

      const scopedHotelId = requireQueryHotelId(req, res);
      if (!scopedHotelId) return;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: 'Check-in and check-out dates are required'
        });
      }

      let finalRoomTypeId = roomTypeId;

      // Handle legacy roomType parameter
      if (!finalRoomTypeId && roomType && scopedHotelId) {
        const roomTypeObj = await RoomType.findByLegacyType(scopedHotelId, roomType);
        finalRoomTypeId = roomTypeObj?._id;
      }

      // Use new V2 availability checking if we have roomTypeId
      if (finalRoomTypeId && scopedHotelId) {
        const availability = await availabilityService.checkAvailabilityV2({
          hotelId: scopedHotelId,
          roomTypeId: finalRoomTypeId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          roomsRequested: parseInt(guestCount)
        });

        res.json({
          success: true,
          data: availability
        });
      } else {
        // Fall back to legacy method for backward compatibility
        const availability = await availabilityService.checkAvailability(
          checkInDate,
          checkOutDate,
          roomType,
          parseInt(guestCount),
          scopedHotelId
        );

        // Get rates for available rooms
        if (availability.available) {
          const rates = await rateManagementService.getAllAvailableRates(
            roomType || 'single',
            checkInDate,
            checkOutDate
          );
          availability.rates = rates;
        }

        res.json({
          success: true,
          data: availability
        });
      }

    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get availability calendar for a month
   */
  async getAvailabilityCalendar(req, res) {
    try {
      const { year, month, roomType } = req.query;

      const hotelId = requireQueryHotelId(req, res);
      if (!hotelId) return;

      if (!year || !month) {
        return res.status(400).json({
          success: false,
          message: 'Year and month are required'
        });
      }

      const calendar = await availabilityService.getAvailabilityCalendar(
        parseInt(year),
        parseInt(month),
        roomType,
        hotelId
      );

      res.json({
        success: true,
        data: calendar
      });

    } catch (error) {
      console.error('Error getting availability calendar:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get room availability status for specific date range
   */
  async getRoomStatus(req, res) {
    try {
      const { roomId, startDate, endDate } = req.query;

      if (!roomId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Room ID, start date, and end date are required'
        });
      }

      const status = await availabilityService.getRoomAvailabilityStatus(
        roomId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Error getting room status:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Block rooms for maintenance or other reasons
   */
  async blockRooms(req, res) {
    try {
      const { roomIds, startDate, endDate, reason } = req.body;

      if (!roomIds || !Array.isArray(roomIds) || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Room IDs array, start date, and end date are required'
        });
      }

      const blocks = await availabilityService.blockRooms(
        roomIds,
        startDate,
        endDate,
        reason,
        req.user.id
      );

      res.status(201).json({
        success: true,
        data: blocks,
        message: `Successfully blocked ${roomIds.length} room(s)`
      });

    } catch (error) {
      console.error('Error blocking rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Unblock rooms
   */
  async unblockRooms(req, res) {
    try {
      const { roomIds, startDate, endDate } = req.body;

      if (!roomIds || !Array.isArray(roomIds) || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Room IDs array, start date, and end date are required'
        });
      }

      const result = await availabilityService.unblockRooms(
        roomIds,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: result,
        message: `Successfully unblocked ${result.deletedCount} room block(s)`
      });

    } catch (error) {
      console.error('Error unblocking rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Calculate occupancy rate
   */
  async getOccupancyRate(req, res) {
    try {
      const { startDate, endDate, hotelId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const occupancy = await availabilityService.calculateOccupancyRate(
        startDate,
        endDate,
        hotelId
      );

      res.json({
        success: true,
        data: occupancy
      });

    } catch (error) {
      console.error('Error calculating occupancy rate:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Find alternative rooms
   */
  async findAlternatives(req, res) {
    try {
      const { checkIn, checkOut, roomType, guestCount = 1 } = req.query;

      if (!checkIn || !checkOut || !roomType) {
        return res.status(400).json({
          success: false,
          message: 'Check-in date, check-out date, and room type are required'
        });
      }

      const alternatives = await availabilityService.findAlternativeRooms(
        checkIn,
        checkOut,
        roomType,
        parseInt(guestCount)
      );

      // Get rates for alternative rooms
      for (const alternative of alternatives) {
        const rates = await rateManagementService.getAllAvailableRates(
          alternative.roomType,
          checkIn,
          checkOut
        );
        alternative.rates = rates;
      }

      res.json({
        success: true,
        data: alternatives
      });

    } catch (error) {
      console.error('Error finding alternative rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Check for overbooking
   */
  async checkOverbooking(req, res) {
    try {
      const { date, roomType } = req.query;

      const hotelId = requireQueryHotelId(req, res);
      if (!hotelId) return;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required'
        });
      }

      const overbookingInfo = await availabilityService.handleOverbooking(
        new Date(date),
        roomType,
        hotelId
      );

      res.json({
        success: true,
        data: overbookingInfo
      });

    } catch (error) {
      console.error('Error checking overbooking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get comprehensive availability and rate information
   */
  async getAvailabilityWithRates(req, res) {
    try {
      const {
        checkInDate,
        checkOutDate,
        guestCount = 1
      } = req.query;

      const hotelId = requireQueryHotelId(req, res);
      if (!hotelId) return;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: 'Check-in and check-out dates are required'
        });
      }

      const roomTypes = ['single', 'double', 'suite', 'deluxe'];
      const availabilityWithRates = [];

      for (const roomType of roomTypes) {
        const availability = await availabilityService.checkAvailability(
          checkInDate,
          checkOutDate,
          roomType,
          parseInt(guestCount),
          hotelId
        );

        if (availability.available) {
          const rates = await rateManagementService.getAllAvailableRates(
            roomType,
            checkInDate,
            checkOutDate,
            true
          );

          const bestRate = await rateManagementService.calculateBestRate(
            roomType,
            checkInDate,
            checkOutDate,
            parseInt(guestCount)
          );

          availabilityWithRates.push({
            roomType,
            available: true,
            availableRooms: availability.availableRooms,
            rooms: availability.rooms.slice(0, 3), // Show max 3 rooms per type
            bestRate,
            allRates: rates
          });
        }
      }

      res.json({
        success: true,
        data: {
          checkInDate,
          checkOutDate,
          guestCount: parseInt(guestCount),
          availableRoomTypes: availabilityWithRates
        }
      });

    } catch (error) {
      console.error('Error getting availability with rates:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Search rooms with filters
   */
  async searchRooms(req, res) {
    try {
      const {
        checkInDate,
        checkOutDate,
        guestCount = 1,
        minPrice,
        maxPrice,
        amenities,
        floor,
        roomType
      } = req.query;

      const hotelId = requireQueryHotelId(req, res);
      if (!hotelId) return;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: 'Check-in and check-out dates are required'
        });
      }

      // Get basic availability
      const availability = await availabilityService.checkAvailability(
        checkInDate,
        checkOutDate,
        roomType,
        parseInt(guestCount),
        hotelId
      );

      if (!availability.available) {
        return res.json({
          success: true,
          data: {
            rooms: [],
            message: 'No rooms available for selected dates'
          }
        });
      }

      // Apply filters
      let filteredRooms = availability.rooms;

      // Filter by floor
      if (floor) {
        filteredRooms = filteredRooms.filter(room => room.floor === parseInt(floor));
      }

      // Filter by amenities
      if (amenities) {
        const requestedAmenities = amenities.split(',');
        filteredRooms = filteredRooms.filter(room =>
          requestedAmenities.every(amenity =>
            room.amenities?.includes(amenity.trim())
          )
        );
      }

      // Get rates and apply price filter
      const roomsWithRates = [];
      for (const room of filteredRooms) {
        const bestRate = await rateManagementService.calculateBestRate(
          room.type,
          checkInDate,
          checkOutDate,
          parseInt(guestCount)
        );

        if (bestRate) {
          const plain = typeof room.toObject === 'function' ? room.toObject() : { ...room };
          const roomWithRate = {
            ...plain,
            bestRate
          };

          // Apply price filter
          if (minPrice && bestRate.finalRate < parseFloat(minPrice)) continue;
          if (maxPrice && bestRate.finalRate > parseFloat(maxPrice)) continue;

          roomsWithRates.push(roomWithRate);
        }
      }

      // Sort by price
      roomsWithRates.sort((a, b) => a.bestRate.finalRate - b.bestRate.finalRate);

      res.json({
        success: true,
        data: {
          rooms: roomsWithRates,
          totalFound: roomsWithRates.length,
          checkInDate,
          checkOutDate,
          filters: {
            guestCount: parseInt(guestCount),
            minPrice,
            maxPrice,
            amenities,
            floor,
            roomType
          }
        }
      });

    } catch (error) {
      console.error('Error searching rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  /**
   * Get overbooking statistics for the dashboard
   */
  async getOverbookingStats(req, res) {
    try {
      const hotelId = requireQueryHotelId(req, res);
      if (!hotelId) return;

      if (!mongoose.Types.ObjectId.isValid(hotelId)) {
        return res.status(400).json({ success: false, message: 'Invalid hotelId format' });
      }
      const hotelOid = new mongoose.Types.ObjectId(hotelId);

      // Get room types with overbooking settings
      const roomTypes = await RoomType.find({ hotelId, isActive: true })
        .select('name settings')
        .lean()
        .limit(200);

      const totalRoomTypes = roomTypes.length;
      const overbookingEnabled = roomTypes.filter(
        rt => rt.settings?.allowOverbooking
      ).length;

      // Count total rooms and current bookings for occupancy metrics
      const totalRooms = await Room.countDocuments({ hotelId, isActive: true });

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Current occupancy (today)
      const todayBookings = await Booking.countDocuments({
        hotelId: hotelOid,
        status: { $in: ['confirmed', 'checked_in'] },
        checkIn: { $lt: tomorrow },
        checkOut: { $gt: now },
      });

      const baseOccupancy = totalRooms > 0
        ? Math.round((todayBookings / totalRooms) * 1000) / 10
        : 0;

      // Room counts per RoomType (uses roomTypeId ObjectId ref)
      const roomsByType = await Room.aggregate([
        { $match: { hotelId: hotelOid, isActive: true, roomTypeId: { $ne: null } } },
        { $group: { _id: '$roomTypeId', count: { $sum: 1 } } },
      ]);
      const capacityMap = {};
      for (const rt of roomsByType) {
        if (rt._id) capacityMap[rt._id.toString()] = rt.count;
      }

      // Find dates with overbooking in the last 30 days
      let successfulOverbooks = 0;
      let totalOverbookRevenue = 0;

      const enabledRoomTypes = roomTypes.filter(rt => rt.settings?.allowOverbooking);

      for (const rt of enabledRoomTypes) {
        const capacity = capacityMap[rt._id.toString()] || 0;
        if (capacity === 0) continue;
        const rtIdStr = rt._id.toString();

        // For each day in last 30 days, check if bookings exceeded capacity
        for (let d = 0; d < 30; d++) {
          const date = new Date(thirtyDaysAgo.getTime() + d * 24 * 60 * 60 * 1000);
          const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

          const bookingCount = await Booking.countDocuments({
            hotelId: hotelOid,
            'rooms.roomTypeId': rtIdStr,
            status: { $in: ['confirmed', 'checked_in', 'completed'] },
            checkIn: { $lt: nextDay },
            checkOut: { $gt: date },
          });

          if (bookingCount > capacity) {
            const overbooked = bookingCount - capacity;
            successfulOverbooks += overbooked;

            // Get average rate for revenue calculation
            const revenueAgg = await Booking.aggregate([
              {
                $match: {
                  hotelId: hotelOid,
                  'rooms.roomTypeId': rtIdStr,
                  status: { $in: ['confirmed', 'checked_in', 'completed'] },
                  checkIn: { $lt: nextDay },
                  checkOut: { $gt: date },
                },
              },
              { $group: { _id: null, avgRate: { $avg: '$totalAmount' } } },
            ]);
            const avgRate = revenueAgg[0]?.avgRate || 0;
            totalOverbookRevenue += overbooked * avgRate;
          }
        }
      }

      const avgRevenuePerOverbook = successfulOverbooks > 0
        ? Math.round(totalOverbookRevenue / successfulOverbooks)
        : 0;

      // Estimate occupancy boost from overbooking
      const totalCapacityDays = totalRooms * 30;
      const occupancyBoost = totalCapacityDays > 0
        ? Math.round((successfulOverbooks / totalCapacityDays) * 1000) / 10
        : 0;
      const withOverbookingOccupancy = Math.min(100,
        Math.round((baseOccupancy + occupancyBoost) * 10) / 10
      );

      // Count active alerts (upcoming dates with overbooking)
      let activeAlerts = 0;
      for (const rt of enabledRoomTypes) {
        const capacity = capacityMap[rt._id.toString()] || 0;
        if (capacity === 0) continue;
        const rtIdStr = rt._id.toString();

        for (let d = 0; d < 7; d++) {
          const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
          const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

          const bookingCount = await Booking.countDocuments({
            hotelId: hotelOid,
            'rooms.roomTypeId': rtIdStr,
            status: { $in: ['confirmed', 'checked_in'] },
            checkIn: { $lt: nextDay },
            checkOut: { $gt: date },
          });

          if (bookingCount > capacity) {
            activeAlerts++;
          }
        }
      }

      res.json({
        success: true,
        data: {
          totalRoomTypes,
          overbookingEnabled,
          activeAlerts,
          revenueFromOverbooking: Math.round(totalOverbookRevenue),
          occupancyImprovement: occupancyBoost,
          baseOccupancy,
          withOverbookingOccupancy,
          successfulOverbooks,
          avgRevenuePerOverbook,
        },
      });
    } catch (error) {
      console.error('Error getting overbooking stats:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get overbooking alerts for upcoming dates
   */
  async getOverbookingAlerts(req, res) {
    try {
      const hotelId = requireQueryHotelId(req, res);
      if (!hotelId) return;

      if (!mongoose.Types.ObjectId.isValid(hotelId)) {
        return res.status(400).json({ success: false, message: 'Invalid hotelId format' });
      }
      const days = Math.min(parseInt(req.query.days) || 14, 30);
      const hotelOid = new mongoose.Types.ObjectId(hotelId);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Get room types with overbooking enabled
      const roomTypes = await RoomType.find({
        hotelId,
        isActive: true,
        'settings.allowOverbooking': true,
      })
        .select('name settings')
        .lean()
        .limit(200);

      if (roomTypes.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Get room counts per type (using roomTypeId ObjectId ref)
      const roomsByType = await Room.aggregate([
        { $match: { hotelId: hotelOid, isActive: true, roomTypeId: { $ne: null } } },
        { $group: { _id: '$roomTypeId', count: { $sum: 1 } } },
      ]);
      const capacityMap = {};
      for (const rt of roomsByType) {
        if (rt._id) capacityMap[rt._id.toString()] = rt.count;
      }

      const alerts = [];

      for (const rt of roomTypes) {
        const capacity = capacityMap[rt._id.toString()] || 0;
        if (capacity === 0) continue;

        const overbookingLimit = rt.settings?.overbookingLimit || 0;
        const rtIdStr = rt._id.toString();

        for (let d = 0; d < days; d++) {
          const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
          const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

          const currentBookings = await Booking.countDocuments({
            hotelId: hotelOid,
            'rooms.roomTypeId': rtIdStr,
            status: { $in: ['confirmed', 'checked_in'] },
            checkIn: { $lt: nextDay },
            checkOut: { $gt: date },
          });

          // Alert when bookings exceed capacity (even within limit)
          if (currentBookings > capacity) {
            const overbookingLevel = currentBookings - capacity;
            let severity = 'low';
            if (overbookingLevel > overbookingLimit) {
              severity = 'critical';
            } else if (overbookingLevel >= overbookingLimit * 0.8) {
              severity = 'high';
            } else if (overbookingLevel >= overbookingLimit * 0.5) {
              severity = 'medium';
            }

            alerts.push({
              id: `${rt._id}-${date.toISOString().split('T')[0]}`,
              roomTypeId: rt._id.toString(),
              roomTypeName: rt.name,
              date: date.toISOString().split('T')[0],
              currentBookings,
              availableRooms: capacity,
              overbookingLevel,
              overbookingLimit,
              severity,
              status: 'active',
            });
          } else if (currentBookings >= capacity * 0.9) {
            // Near-capacity warning
            alerts.push({
              id: `${rt._id}-${date.toISOString().split('T')[0]}`,
              roomTypeId: rt._id.toString(),
              roomTypeName: rt.name,
              date: date.toISOString().split('T')[0],
              currentBookings,
              availableRooms: capacity,
              overbookingLevel: 0,
              overbookingLimit,
              severity: 'low',
              status: 'active',
            });
          }
        }
      }

      // Sort by severity (critical first) then date
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      alerts.sort((a, b) => {
        const sevDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
        if (sevDiff !== 0) return sevDiff;
        return a.date.localeCompare(b.date);
      });

      res.json({
        success: true,
        data: alerts.slice(0, 50),
      });
    } catch (error) {
      console.error('Error getting overbooking alerts:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new AvailabilityController();
