import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import RoomAvailability from '../models/RoomAvailability.js';
import AuditLog from '../models/AuditLog.js';
import availabilityService from '../services/availabilityService.js';
import rateManagementService from '../services/rateManagementService.js';
import { v4 as uuidv4 } from 'uuid';
import { validateTransition, atomicStatusTransition } from '../utils/bookingStateMachine.js';
import { withTransaction } from '../utils/transactionHelper.js';

class EnhancedBookingController {
  /**
   * Create booking using new OTA-ready system
   */
  async createBooking(req, res) {
    try {
      const {
        hotelId,
        checkIn,
        checkOut,
        guestDetails,
        roomTypeId, // New: using room type ID
        roomType,   // Legacy: room type string
        roomRequests = 1,
        channel,
        channelBookingId,
        channelReservationId,
        source = 'direct',
        totalAmount,
        currency = 'INR',
        paymentMethod,
        specialRequests,
        ratePlanId
      } = req.body;

      if (!hotelId || !checkIn || !checkOut || !guestDetails) {
        return res.status(400).json({
          success: false,
          message: 'Missing required booking information'
        });
      }

      let finalRoomTypeId = roomTypeId;
      let selectedRoomType;

      // Handle room type resolution (legacy vs new)
      if (!finalRoomTypeId && roomType) {
        selectedRoomType = await RoomType.findByLegacyType(hotelId, roomType);
        finalRoomTypeId = selectedRoomType?._id;
      } else if (finalRoomTypeId) {
        selectedRoomType = await RoomType.findById(finalRoomTypeId).lean();
      }

      if (!selectedRoomType) {
        return res.status(400).json({
          success: false,
          message: 'Invalid room type specified'
        });
      }

      // Wrap availability check, booking creation, and room reservation in a
      // single transaction so that a concurrent request cannot grab the same
      // rooms between the availability check and the reservation write.
      const { booking, selectedRooms } = await withTransaction(async (session) => {
        try {
          // Check availability using V2 system if room type ID is available
          let availabilityResult;
          if (finalRoomTypeId) {
            availabilityResult = await availabilityService.checkAvailabilityV2({
              hotelId,
              roomTypeId: finalRoomTypeId,
              checkIn,
              checkOut,
              roomsRequested: roomRequests,
              session
            });
          } else {
            // Fallback to legacy system
            availabilityResult = await availabilityService.checkAvailability(
              checkIn,
              checkOut,
              roomType,
              roomRequests,
              hotelId,
              session
            );
          }

          if (!availabilityResult.available || availabilityResult.availableRooms.length < roomRequests) {
            throw Object.assign(
              new Error('Insufficient room availability for selected dates'),
              { statusCode: 409, availableRooms: availabilityResult.availableRooms.length }
            );
          }

          // Calculate rates using rate management system
          let finalRate;
          if (totalAmount) {
            // Use provided total amount
            finalRate = totalAmount / roomRequests;
          } else if (ratePlanId) {
            // Calculate from rate plan
            const rateResult = await rateManagementService.calculateRateFromPlan(
              ratePlanId,
              checkIn,
              checkOut,
              roomRequests
            );
            finalRate = rateResult.finalRate;
          } else {
            // Calculate best available rate
            const bestRate = await rateManagementService.calculateBestRate(
              roomType || selectedRoomType.legacyType,
              checkIn,
              checkOut,
              roomRequests
            );
            finalRate = bestRate ? bestRate.finalRate : selectedRoomType.basePrice;
          }

          // Select specific rooms
          const txSelectedRooms = availabilityResult.availableRooms.slice(0, roomRequests);
          const bookingRooms = txSelectedRooms.map(room => ({
            roomId: room._id,
            rate: finalRate
          }));

          // Create booking
          const bookingData = {
            hotelId,
            userId: req.user._id,
            rooms: bookingRooms,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            guestDetails: {
              adults: guestDetails.adults || 1,
              children: guestDetails.children || 0,
              specialRequests: specialRequests || guestDetails.specialRequests
            },
            totalAmount: finalRate * roomRequests,
            currency,
            source,
            idempotencyKey: req.headers['idempotency-key'] || uuidv4()
          };

          // Add legacy room type for backward compatibility
          if (selectedRoomType.legacyType) {
            bookingData.roomType = selectedRoomType.legacyType;
          }

          // Add OTA-specific data if applicable
          if (channel) {
            bookingData.channel = channel;
            bookingData.channelBookingId = channelBookingId;
            bookingData.channelReservationId = channelReservationId;

            if (req.body.channelData) {
              bookingData.channelData = req.body.channelData;
            }
          }

          const [txBooking] = await Booking.create([bookingData], { session });

          // Reserve the rooms in inventory system
          if (finalRoomTypeId) {
            await availabilityService.reserveRoomsV2({
              hotelId,
              roomTypeId: finalRoomTypeId,
              checkIn,
              checkOut,
              roomsToReserve: roomRequests,
              bookingId: txBooking._id,
              session
            });
          } else {
            // Fallback to legacy reservation
            await availabilityService.reserveRooms(
              txSelectedRooms.map(r => r._id),
              checkIn,
              checkOut,
              txBooking._id,
              session
            );
          }

          // Log the booking creation
          await AuditLog.logChange({
            hotelId,
            tableName: 'Booking',
            recordId: txBooking._id,
            changeType: 'create',
            newValues: txBooking.toObject(),
            userId: req.user._id,
            userEmail: req.user.email,
            source: source,
            metadata: {
              roomTypeId: finalRoomTypeId,
              channel: channel || 'direct',
              tags: ['booking_creation', 'ota_ready']
            },
            session
          });

          return { booking: txBooking, selectedRooms: txSelectedRooms };
      
        } catch (error) {
          console.error('Operation failed:', error.message);
          throw error;
        }
      });

      // Populate booking for response
      await booking.populate([
        { path: 'hotelId', select: 'name address contact' },
        { path: 'rooms.roomId', select: 'roomNumber type floor' },
        { path: 'userId', select: 'name email phone' }
      ]);

      res.status(201).json({
        success: true,
        data: {
          booking,
          roomType: selectedRoomType,
          reservedRooms: selectedRooms
        },
        message: 'Booking created successfully'
      });

    } catch (error) {
      console.error('Error creating booking:', error);
      const statusCode = error.statusCode || 500;
      const response = { success: false, message: error.message };
      if (error.availableRooms !== undefined) {
        response.availableRooms = error.availableRooms;
      }
      res.status(statusCode).json(response);
    }
  }

  /**
   * Get bookings with enhanced filtering
   */
  async getBookings(req, res) {
    try {
      const {
        hotelId,
        roomTypeId,
        channel,
        source,
        status,
        checkIn,
        checkOut,
        page = 1,
        limit = 10
      } = req.query;

      // Enforce max limit to prevent unbounded queries
      const parsedLimit = Math.min(parseInt(limit) || 10, 100);

      // Build query based on user role and filters
      const query = {};

      if (req.user.role === 'guest') {
        query.userId = req.user._id;
      } else if (req.user.hotelId) {
        // All non-guest roles (admin, manager, staff, frontdesk, housekeeping) are scoped to their hotel
        query.hotelId = req.user.hotelId;
      }

      if (status) query.status = status;
      if (source) query.source = source;
      if (channel) query.channel = channel;

      if (checkIn) {
        query.checkIn = { $gte: new Date(checkIn) };
      }

      if (checkOut) {
        query.checkOut = { $lte: new Date(checkOut) };
      }

      // Filter by room type if specified
      if (roomTypeId) {
        const roomsInType = await Room.find({ 
          roomTypeId, 
          isActive: true 
        }).select('_id').lean().limit(1000);
        
        query['rooms.roomId'] = { 
          $in: roomsInType.map(r => r._id) 
        };
      }

      const parsedPage = parseInt(page) || 1;
      const skip = (parsedPage - 1) * parsedLimit;

      const bookings = await Booking.find(query)
        .populate('userId', 'name email phone')
        .populate('rooms.roomId', 'roomNumber type roomTypeId floor')
        .populate('hotelId', 'name address contact')
        .populate('channel', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit).lean();

      // Batch-fetch all room types to avoid N+1 queries
      const roomTypeIds = [...new Set(
        bookings.flatMap(b =>
          (b.rooms || [])
            .map(r => r.roomId?.roomTypeId)
            .filter(Boolean)
            .map(id => id.toString())
        )
      )];
      const roomTypesMap = {};
      if (roomTypeIds.length > 0) {
        const roomTypes = await RoomType.find({ _id: { $in: roomTypeIds } })
          .select('name code basePrice maxOccupancy').lean().limit(1000);
        for (const rt of roomTypes) {
          roomTypesMap[rt._id.toString()] = rt;
        }
      }

      const enhancedBookings = bookings.map((booking) => {
        const bookingObj = { ...booking };
        for (let room of bookingObj.rooms || []) {
          if (room.roomId?.roomTypeId) {
            room.roomType = roomTypesMap[room.roomId.roomTypeId.toString()] || null;
          }
        }
        return bookingObj;
      });

      const total = await Booking.countDocuments(query);

      res.json({
        success: true,
        results: bookings.length,
        pagination: {
          current: parsedPage,
          limit: parsedLimit,
          pages: Math.ceil(total / parsedLimit) || 1,
          total
        },
        data: enhancedBookings
      });

    } catch (error) {
      console.error('Error getting bookings:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get a single booking by ID with enhanced data
   */
  async getBookingById(req, res) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id)
        .populate('userId', 'name email phone')
        .populate('rooms.roomId', 'roomNumber type roomTypeId floor baseRate currentRate')
        .populate('hotelId', 'name address contact policies')
        .populate('channel', 'name category')
        .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions - guests can only see their own bookings
      if (req.user.role === 'guest' && booking.userId?._id?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Enforce tenant isolation for non-guest roles
      const bookingHotelId = typeof booking.hotelId === 'object' && booking.hotelId?._id
        ? booking.hotelId._id.toString()
        : booking.hotelId?.toString?.() || '';
      const userHotelId = req.user?.hotelId?.toString?.() || '';
      if (req.user.role !== 'guest' && bookingHotelId && userHotelId && bookingHotelId !== userHotelId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Enrich room data with room type info
      const roomTypeIds = [...new Set(
        (booking.rooms || [])
          .map(r => r.roomId?.roomTypeId)
          .filter(Boolean)
          .map(rtId => rtId.toString())
      )];
      if (roomTypeIds.length > 0) {
        const roomTypes = await RoomType.find({ _id: { $in: roomTypeIds } })
          .select('name code basePrice maxOccupancy').lean().limit(100);
        const roomTypesMap = {};
        for (const rt of roomTypes) {
          roomTypesMap[rt._id.toString()] = rt;
        }
        for (const room of booking.rooms || []) {
          if (room.roomId?.roomTypeId) {
            room.roomType = roomTypesMap[room.roomId.roomTypeId.toString()] || null;
          }
        }
      }

      res.json({
        success: true,
        data: booking
      });

    } catch (error) {
      console.error('Error getting booking by ID:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update booking with OTA sync
   */
  async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingBooking = await Booking.findById(id).lean();
      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest' && existingBooking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (req.user.role === 'staff' && existingBooking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const oldValues = existingBooking.toObject();

      // Handle date changes - need to update inventory
      if (updateData.checkIn || updateData.checkOut) {
        const newCheckIn = updateData.checkIn ? new Date(updateData.checkIn) : existingBooking.checkIn;
        const newCheckOut = updateData.checkOut ? new Date(updateData.checkOut) : existingBooking.checkOut;

        // Check availability for new dates
        const roomIds = existingBooking.rooms.map(r => r.roomId);
        const roomTypeId = await this.getRoomTypeFromRooms(roomIds);

        if (roomTypeId) {
          const availability = await availabilityService.checkAvailabilityV2({
            hotelId: existingBooking.hotelId,
            roomTypeId,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            roomsRequested: existingBooking.rooms.length
          });

          if (!availability.available) {
            return res.status(409).json({
              success: false,
              message: 'Rooms not available for new dates'
            });
          }
        }

        // Release old inventory and reserve new
        if (roomTypeId) {
          await availabilityService.releaseRoomsV2({
            hotelId: existingBooking.hotelId,
            roomTypeId,
            checkIn: existingBooking.checkIn,
            checkOut: existingBooking.checkOut,
            roomsToRelease: existingBooking.rooms.length,
            bookingId: existingBooking._id
          });

          await availabilityService.reserveRoomsV2({
            hotelId: existingBooking.hotelId,
            roomTypeId,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            roomsToReserve: existingBooking.rooms.length,
            bookingId: existingBooking._id
          });
        }
      }

      // Handle price changes
      if (updateData.totalAmount && updateData.totalAmount !== existingBooking.totalAmount) {
        // Check authorization for price changes
        const userRole = req.user.role;
        const adjustmentAmount = updateData.totalAmount - existingBooking.totalAmount;

        if (!existingBooking.canAdjustPrice(userRole, adjustmentAmount)) {
          return res.status(403).json({
            success: false,
            message: `Insufficient authorization for price adjustment of ${adjustmentAmount > 0 ? '+' : ''}${adjustmentAmount}`
          });
        }

        // Apply price adjustment
        const adjustmentData = {
          amount: adjustmentAmount,
          type: updateData.adjustmentType || 'manual_adjustment',
          reason: updateData.adjustmentReason || 'Price updated via booking modification',
          percentage: updateData.adjustmentPercentage,
          discountCode: updateData.discountCode
        };

        const userContext = {
          userId: req.user._id,
          userName: req.user.name || req.user.email,
          userRole: req.user.role
        };

        try {
          existingBooking.applyPriceAdjustment(adjustmentData, userContext);
          // Remove totalAmount from updateData to prevent double update
          delete updateData.totalAmount;
        } catch (adjustmentError) {
          return res.status(400).json({
            success: false,
            message: `Price adjustment failed: ${adjustmentError.message}`
          });
        }
      }

      // Update booking
      const booking = await Booking.findByIdAndUpdate(
        id,
        {
          ...updateData,
          'syncStatus.needsSync': true // Mark for channel sync
        },
        { new: true, runValidators: true }
      );

      // Log modification
      const modificationEntry = {
        modificationId: uuidv4(),
        modificationType: 'amendment',
        modificationDate: new Date(),
        modifiedBy: {
          source: req.body.source || 'manual',
          userId: req.user._id.toString(),
          channel: req.body.channel || null
        },
        oldValues,
        newValues: booking.toObject(),
        reason: updateData.modificationReason || 'Booking updated'
      };

      booking.modifications.push(modificationEntry);
      await booking.save();

      // Log audit trail
      await AuditLog.logChange({
        hotelId: booking.hotelId,
        tableName: 'Booking',
        recordId: booking._id,
        changeType: 'update',
        oldValues,
        newValues: booking.toObject(),
        userId: req.user._id,
        userEmail: req.user.email,
        source: req.body.source || 'manual',
        metadata: {
          modificationType: modificationEntry.modificationType,
          tags: ['booking_update', 'ota_ready']
        }
      });

      await booking.populate([
        { path: 'hotelId', select: 'name address contact' },
        { path: 'rooms.roomId', select: 'roomNumber type roomTypeId floor' },
        { path: 'userId', select: 'name email phone' },
        { path: 'channel', select: 'name category' }
      ]);

      res.json({
        success: true,
        data: booking,
        message: 'Booking updated successfully'
      });

    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Cancel booking with inventory release
   */
  async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const { reason, refundAmount, source = 'manual' } = req.body;

      const booking = await Booking.findById(id).lean();
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check if booking can be cancelled
      if (!booking.canCancel()) {
        return res.status(400).json({
          success: false,
          message: 'Booking cannot be cancelled (too close to check-in or already processed)'
        });
      }

      const oldValues = booking.toObject();

      // Release inventory
      const roomIds = booking.rooms.map(r => r.roomId);
      const roomTypeId = await this.getRoomTypeFromRooms(roomIds);

      if (roomTypeId) {
        await availabilityService.releaseRoomsV2({
          hotelId: booking.hotelId,
          roomTypeId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          roomsToRelease: booking.rooms.length,
          bookingId: booking._id
        });
      } else {
        // Fallback to legacy release
        await availabilityService.releaseRooms(
          roomIds,
          booking.checkIn,
          booking.checkOut
        );
      }

      // Validate and atomically transition booking status to cancelled
      const transition = validateTransition(booking.status, 'cancelled');
      if (!transition.valid) {
        return res.status(409).json({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: transition.error }
        });
      }

      const cancellationEntry = {
        modificationId: uuidv4(),
        modificationType: 'cancellation',
        modificationDate: new Date(),
        modifiedBy: {
          source: source,
          userId: req.user._id.toString()
        },
        oldValues,
        newValues: {
          status: 'cancelled',
          cancellationReason: reason,
          refundAmount
        },
        reason: reason || 'Booking cancelled'
      };

      let updatedBooking;
      try {
        updatedBooking = await atomicStatusTransition(Booking, booking._id, booking.status, 'cancelled', {
          cancellationReason: reason,
          'syncStatus.needsSync': true,
          $push: { modifications: cancellationEntry }
        });
      } catch (transitionError) {
        return res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: transitionError.message }
        });
      }

      // Re-assign booking reference for downstream usage
      Object.assign(booking, updatedBooking.toObject());

      // Log audit trail
      await AuditLog.logChange({
        hotelId: booking.hotelId,
        tableName: 'Booking',
        recordId: booking._id,
        changeType: 'update',
        oldValues,
        newValues: booking.toObject(),
        userId: req.user._id,
        userEmail: req.user.email,
        source: source,
        metadata: {
          action: 'cancellation',
          reason,
          refundAmount,
          tags: ['booking_cancellation', 'inventory_release']
        }
      });

      res.json({
        success: true,
        data: booking,
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get booking analytics by room type
   */
  async getBookingAnalytics(req, res) {
    try {
      const { 
        hotelId, 
        startDate, 
        endDate, 
        groupBy = 'roomType' 
      } = req.query;

      if (!hotelId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID, start date, and end date are required'
        });
      }

      const matchStage = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        status: { $ne: 'cancelled' }
      };

      let groupStage = {};
      let lookupStages = [];

      switch (groupBy) {
        case 'roomType':
          // Need to lookup room type through rooms
          lookupStages = [
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
                from: 'roomtypes',
                localField: 'roomDetails.roomTypeId',
                foreignField: '_id',
                as: 'roomTypeDetails'
              }
            }
          ];

          groupStage = {
            _id: {
              roomTypeName: '$roomTypeDetails.name',
              roomTypeCode: '$roomTypeDetails.code'
            },
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalRooms: { $sum: { $size: '$rooms' } },
            averageRate: { $avg: '$totalAmount' },
            channels: { $addToSet: '$source' }
          };
          break;

        case 'channel':
          groupStage = {
            _id: '$source',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalRooms: { $sum: { $size: '$rooms' } },
            averageRate: { $avg: '$totalAmount' }
          };
          break;

        case 'status':
          groupStage = {
            _id: '$status',
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            totalRooms: { $sum: { $size: '$rooms' } }
          };
          break;
      }

      const pipeline = [
        { $match: matchStage },
        ...lookupStages,
        { $group: groupStage },
        { $sort: { totalRevenue: -1 } }
      ];

      const analytics = await Booking.aggregate(pipeline);

      res.json({
        success: true,
        data: {
          analytics,
          period: { startDate, endDate },
          groupBy
        }
      });

    } catch (error) {
      console.error('Error getting booking analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Helper method to get room type from room IDs
  async getRoomTypeFromRooms(roomIds) {
    try {
      const room = await Room.findById(roomIds[0]).select('roomTypeId').lean();
      return room?.roomTypeId;
  
    } catch (error) {
      console.error('Operation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get booking history with modifications
   */
  async getBookingHistory(req, res) {
    try {
      const { id } = req.params;
      const booking = await Booking.findById(id)
        .populate('userId', 'name email phone')
        .populate('rooms.roomId', 'roomNumber type roomTypeId floor')
        .populate('hotelId', 'name address contact').lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          booking,
          modifications: booking.modifications || [],
          auditTrail: [] // Placeholder for audit trail
        }
      });

    } catch (error) {
      console.error('Error getting booking history:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Sync booking with OTA channels
   */
  async syncBookingWithChannels(req, res) {
    try {
      const { id } = req.params;
      const { channels } = req.body;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Channel sync is not configured — no OTA channel manager is connected.
      // Report honestly that sync was not performed rather than faking success.
      const requestedChannels = channels || ['booking_com', 'expedia'];
      const syncResults = requestedChannels.map(channel => ({
        channel,
        status: 'not_configured',
        message: `Channel sync for ${channel} is not configured. Connect an OTA channel manager to enable sync.`
      }));

      // Mark as still needing sync since nothing was actually synced
      booking.syncStatus = {
        ...booking.syncStatus,
        needsSync: true
      };

      await booking.save();

      res.json({
        success: true,
        data: {
          syncResults,
          notice: 'No OTA channel manager is configured. Sync results reflect configuration status, not actual synchronization.'
        }
      });

    } catch (error) {
      console.error('Error syncing booking with channels:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get channel bookings with reconciliation
   */
  async getChannelBookings(req, res) {
    try {
      const {
        hotelId,
        channel,
        startDate,
        endDate,
        status,
        needsReconciliation,
        page = 1,
        limit = 10
      } = req.query;

      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      // Build query
      const query = { hotelId };
      if (channel) query.channel = channel;
      if (status) query.status = status;
      if (startDate) query.checkIn = { $gte: new Date(startDate) };
      if (endDate) query.checkOut = { $lte: new Date(endDate) };
      if (needsReconciliation !== undefined) {
        query['syncStatus.needsSync'] = needsReconciliation === 'true';
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const bookings = await Booking.find(query)
        .populate('userId', 'name email phone')
        .populate('rooms.roomId', 'roomNumber type roomTypeId floor')
        .populate('hotelId', 'name address contact')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)).lean();

      const total = await Booking.countDocuments(query);

      res.json({
        success: true,
        results: bookings.length,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        },
        data: bookings
      });

    } catch (error) {
      console.error('Error getting channel bookings:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Handle booking modification from channel
   */
  async handleChannelModification(req, res) {
    try {
      const {
        channelBookingId,
        channel,
        modificationType,
        newValues,
        reason
      } = req.body;

      // Find booking by channel booking ID
      const booking = await Booking.findOne({
        'channelBookingId': channelBookingId,
        'channel': channel
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found for this channel'
        });
      }

      // Check permissions
      if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const oldValues = booking.toObject();

      // Apply modifications based on type
      switch (modificationType) {
        case 'rate_change':
          if (newValues.totalAmount) {
            booking.totalAmount = newValues.totalAmount;
          }
          break;
        case 'date_change':
          if (newValues.checkIn) {
            booking.checkIn = new Date(newValues.checkIn);
          }
          if (newValues.checkOut) {
            booking.checkOut = new Date(newValues.checkOut);
          }
          break;
        case 'guest_change':
          if (newValues.guestDetails) {
            booking.guestDetails = { ...booking.guestDetails, ...newValues.guestDetails };
          }
          break;
        case 'cancellation': {
          const cancellationValidation = validateTransition(booking.status, 'cancelled');
          if (!cancellationValidation.valid) {
            return res.status(409).json({
              success: false,
              error: { code: 'INVALID_TRANSITION', message: cancellationValidation.error }
            });
          }

          const channelCancelModification = {
            modificationId: uuidv4(),
            modificationType,
            modificationDate: new Date(),
            modifiedBy: {
              source: channel,
              userId: req.user._id.toString(),
              channel
            },
            oldValues,
            newValues: { status: 'cancelled', cancellationReason: reason || 'Cancelled by channel' },
            reason: reason || `Modified by ${channel}`
          };

          let cancelledBooking;
          try {
            cancelledBooking = await atomicStatusTransition(Booking, booking._id, booking.status, 'cancelled', {
              cancellationReason: reason || 'Cancelled by channel',
              'syncStatus.needsSync': false,
              $push: { modifications: channelCancelModification }
            });
          } catch (transitionError) {
            return res.status(409).json({
              success: false,
              error: { code: 'CONFLICT', message: transitionError.message }
            });
          }

          // Release room availability for cancelled dates
          if (booking.rooms && booking.rooms.length > 0) {
            const RoomAvailability = (await import('../models/RoomAvailability.js')).default;
            if (RoomAvailability) {
              await RoomAvailability.updateMany(
                { bookingId: booking._id },
                { $set: { status: 'available', bookingId: null } }
              ).catch(err => console.warn('Failed to release room inventory:', err.message));
            }
          }

          return res.json({
            success: true,
            data: cancelledBooking,
            message: 'Channel modification handled successfully'
          });
        }
      }

      // Add modification entry (for non-cancellation modifications)
      const modificationEntry = {
        modificationId: uuidv4(),
        modificationType,
        modificationDate: new Date(),
        modifiedBy: {
          source: channel,
          userId: req.user._id.toString(),
          channel
        },
        oldValues,
        newValues: booking.toObject(),
        reason: reason || `Modified by ${channel}`
      };

      booking.modifications.push(modificationEntry);
      booking.syncStatus.needsSync = false; // Mark as synced
      await booking.save();

      res.json({
        success: true,
        data: booking,
        message: 'Channel modification handled successfully'
      });

    } catch (error) {
      console.error('Error handling channel modification:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get booking dashboard with OTA metrics
   */
  async getBookingDashboard(req, res) {
    try {
      const { hotelId, period = '30d' } = req.query;

      if (!hotelId) {
        return res.status(400).json({
          success: false,
          message: 'Hotel ID is required'
        });
      }

      // Calculate date range based on period
      const endDate = new Date();
      let startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Get basic metrics
      const totalBookings = await Booking.countDocuments({
        hotelId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const totalRevenue = await Booking.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' }
          }
        }
      ]);

      const averageRate = totalBookings > 0 ? (totalRevenue[0]?.total || 0) / totalBookings : 0;

      // Get channel breakdown
      const channelBreakdown = await Booking.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: '$source',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]);

      // Get room type breakdown
      const roomTypeBreakdown = await Booking.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
          }
        },
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
            from: 'roomtypes',
            localField: 'roomDetails.roomTypeId',
            foreignField: '_id',
            as: 'roomTypeDetails'
          }
        },
        {
          $group: {
            _id: '$roomTypeDetails.name',
            bookings: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]);

      // Get recent bookings
      const recentBookings = await Booking.find({
        hotelId,
        createdAt: { $gte: startDate, $lte: endDate }
      })
        .populate('userId', 'name email')
        .populate('rooms.roomId', 'roomNumber type')
        .sort({ createdAt: -1 })
        .limit(5).lean();

      // Calculate pending modifications
      const pendingModifications = await Booking.countDocuments({
        hotelId,
        'modifications.modificationType': { $in: ['rate_change', 'date_change', 'guest_change'] },
        status: { $ne: 'cancelled' }
      });

      // Calculate sync issues
      const syncIssues = await Booking.countDocuments({
        hotelId,
        'syncStatus.needsSync': true
      });

      // Calculate occupancy rate from real room data
      let occupancyRate = 0;
      const totalRooms = await Room.countDocuments({ hotelId, isActive: true });
      if (totalRooms > 0) {
        const today = new Date();
        const occupiedRooms = await Booking.countDocuments({
          hotelId,
          status: { $in: ['confirmed', 'checked_in'] },
          checkIn: { $lte: today },
          checkOut: { $gt: today }
        });
        occupancyRate = Math.round((occupiedRooms / totalRooms) * 100 * 10) / 10;
      }

      res.json({
        success: true,
        data: {
          totalBookings,
          totalRevenue: totalRevenue[0]?.total || 0,
          averageRate,
          occupancyRate,
          channelBreakdown: channelBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              bookings: item.bookings,
              revenue: item.revenue,
              percentage: totalBookings > 0 ? (item.bookings / totalBookings) * 100 : 0
            };
            return acc;
          }, {}),
          roomTypeBreakdown: roomTypeBreakdown.reduce((acc, item) => {
            acc[item._id] = {
              bookings: item.bookings,
              revenue: item.revenue,
              percentage: totalBookings > 0 ? (item.bookings / totalBookings) * 100 : 0
            };
            return acc;
          }, {}),
          recentBookings,
          pendingModifications,
          syncIssues
        }
      });

    } catch (error) {
      console.error('Error getting booking dashboard:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Apply price adjustment to booking
   */
  async adjustBookingPrice(req, res) {
    try {
      const { id } = req.params;
      const {
        amount,
        type = 'manual_adjustment',
        reason,
        percentage,
        discountCode,
        authorizedBy
      } = req.body;

      // Validation
      if (!amount || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Amount and reason are required for price adjustment'
        });
      }

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (req.user.role === 'staff' && booking.hotelId.toString() !== req.user.hotelId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check authorization for price adjustment
      if (!booking.canAdjustPrice(req.user.role, amount)) {
        return res.status(403).json({
          success: false,
          message: `Insufficient authorization for price adjustment of ${amount > 0 ? '+' : ''}${amount}. Contact manager for approval.`
        });
      }

      const adjustmentData = {
        amount: parseFloat(amount),
        type,
        reason,
        percentage: percentage ? parseFloat(percentage) : undefined,
        discountCode,
        authorizedBy
      };

      const userContext = {
        userId: req.user._id,
        userName: req.user.name || req.user.email,
        userRole: req.user.role
      };

      try {
        const adjustment = booking.applyPriceAdjustment(adjustmentData, userContext);
        await booking.save();

        // Log audit trail
        await AuditLog.logChange({
          hotelId: booking.hotelId,
          tableName: 'Booking',
          recordId: booking._id,
          changeType: 'price_adjustment',
          oldValues: { totalAmount: adjustment.previousAmount },
          newValues: { totalAmount: adjustment.newAmount },
          userId: req.user._id,
          userEmail: req.user.email,
          source: 'manual',
          metadata: {
            adjustmentType: adjustment.adjustmentType,
            adjustmentAmount: adjustment.amount,
            reason: adjustment.reason,
            tags: ['price_adjustment', 'booking_modification']
          }
        });

        res.json({
          success: true,
          data: {
            booking: {
              _id: booking._id,
              totalAmount: booking.totalAmount,
              originalAmount: booking.originalAmount,
              discountAmount: booking.discountAmount,
              surchargeAmount: booking.surchargeAmount
            },
            adjustment,
            message: 'Price adjustment applied successfully'
          }
        });

      } catch (adjustmentError) {
        return res.status(400).json({
          success: false,
          message: `Price adjustment failed: ${adjustmentError.message}`
        });
      }

    } catch (error) {
      console.error('Error adjusting booking price:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Reverse price adjustment
   */
  async reversePriceAdjustment(req, res) {
    try {
      const { id, adjustmentId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Reason is required for reversing price adjustment'
        });
      }

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions (only admin and manager can reverse adjustments)
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only admins and managers can reverse price adjustments'
        });
      }

      const userContext = {
        userId: req.user._id,
        userName: req.user.name || req.user.email
      };

      try {
        const reversedAdjustment = booking.reversePriceAdjustment(adjustmentId, reason, userContext);
        await booking.save();

        // Log audit trail
        await AuditLog.logChange({
          hotelId: booking.hotelId,
          tableName: 'Booking',
          recordId: booking._id,
          changeType: 'price_adjustment_reversal',
          oldValues: { adjustmentReversed: false },
          newValues: { adjustmentReversed: true },
          userId: req.user._id,
          userEmail: req.user.email,
          source: 'manual',
          metadata: {
            adjustmentId,
            reverseReason: reason,
            originalAmount: reversedAdjustment.amount,
            tags: ['price_adjustment_reversal', 'booking_modification']
          }
        });

        res.json({
          success: true,
          data: {
            booking: {
              _id: booking._id,
              totalAmount: booking.totalAmount,
              originalAmount: booking.originalAmount,
              discountAmount: booking.discountAmount,
              surchargeAmount: booking.surchargeAmount
            },
            reversedAdjustment,
            message: 'Price adjustment reversed successfully'
          }
        });

      } catch (reverseError) {
        return res.status(400).json({
          success: false,
          message: `Failed to reverse adjustment: ${reverseError.message}`
        });
      }

    } catch (error) {
      console.error('Error reversing price adjustment:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get price adjustment history for a booking
   */
  async getPriceAdjustmentHistory(req, res) {
    try {
      const { id } = req.params;

      // Do NOT use .lean() here because we need the getTotalAdjustments() model method
      const booking = await Booking.findById(id)
        .populate('priceAdjustments.adjustedBy.userId', 'name email')
        .populate('priceAdjustments.authorizedBy.userId', 'name email')
        .populate('priceAdjustments.reversedBy.userId', 'name email');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check permissions - guests can only see their own bookings
      if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Enforce tenant isolation for all non-guest roles
      const bookingHotelId = booking.hotelId?.toString?.() || '';
      const userHotelId = req.user?.hotelId?.toString?.() || '';
      if (req.user.role !== 'guest' && bookingHotelId && userHotelId && bookingHotelId !== userHotelId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const adjustmentSummary = typeof booking.getTotalAdjustments === 'function'
        ? booking.getTotalAdjustments()
        : { totalDiscount: booking.discountAmount || 0, totalSurcharge: booking.surchargeAmount || 0 };

      res.json({
        success: true,
        data: {
          bookingId: booking._id,
          adjustmentSummary,
          adjustmentHistory: booking.priceAdjustments || [],
          currentAmount: booking.totalAmount
        }
      });

    } catch (error) {
      console.error('Error getting price adjustment history:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new EnhancedBookingController();
