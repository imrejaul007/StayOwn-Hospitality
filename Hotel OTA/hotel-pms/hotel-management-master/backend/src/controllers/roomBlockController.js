import TapeChartModels from '../models/TapeChart.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import CorporateCompany from '../models/CorporateCompany.js';
import { validationResult } from 'express-validator';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

const { RoomBlock } = TapeChartModels;

class RoomBlockController {
  // Create a new room block
  async createRoomBlock(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        blockId,
        blockName,
        groupName,
        corporateId,
        eventType,
        startDate,
        endDate,
        roomIds,
        totalRooms,
        blockRate,
        contactPerson,
        billingInstructions,
        specialInstructions,
        amenities,
        cateringRequirements
      } = req.body;

      // Validate rooms exist and are available (scoped to hotel)
      const hotelId = req.user?.hotelId || req.user?.hotel || req.tenantId;
      const rooms = await Room.find({
        _id: { $in: roomIds },
        isActive: true,
        hotelId
      }).lean().limit(1000);

      if (rooms.length !== roomIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some rooms not found or inactive'
        });
      }

      // Check for conflicting room blocks (scoped to hotel)
      const conflictingBlocks = await RoomBlock.find({
        status: { $in: ['active', 'partially_released'] },
        'rooms.roomId': { $in: roomIds },
        hotelId,
        $or: [
          { startDate: { $lt: endDate, $gte: startDate } },
          { endDate: { $gt: startDate, $lte: endDate } },
          { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
        ]
      }).lean().limit(1000);

      if (conflictingBlocks.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some rooms are already blocked for the selected dates',
          conflictingBlocks: conflictingBlocks.map(block => ({
            blockName: block.blockName,
            startDate: block.startDate,
            endDate: block.endDate
          }))
        });
      }

      // Prepare room data
      const roomData = rooms.map(room => ({
        roomId: room._id,
        roomNumber: room.roomNumber,
        roomType: room.type,
        rate: blockRate || room.currentRate,
        status: 'blocked'
      }));

      // Create room block (scoped to hotel)
      const roomBlock = new RoomBlock({
        blockId,
        blockName,
        groupName,
        corporateId,
        eventType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        rooms: roomData,
        totalRooms: totalRooms || rooms.length,
        blockRate,
        contactPerson,
        billingInstructions,
        specialInstructions,
        amenities: amenities || [],
        cateringRequirements,
        createdBy: req.user._id,
        hotelId
      });

      await roomBlock.save();

      // Populate the created block
      const populatedBlock = await RoomBlock.findById(roomBlock._id)
        .populate('corporateId', 'name')
        .populate('rooms.roomId', 'roomNumber type')
        .populate('createdBy', 'name email').lean();

      res.status(201).json({
        success: true,
        message: 'Room block created successfully',
        data: populatedBlock
      });

    } catch (error) {
      console.error('Create room block error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create room block',
        error: error.message
      });
    }
  }

  // Get all room blocks
  async getRoomBlocks(req, res) {
    try {
      const {
        status,
        eventType,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'startDate',
        sortOrder = 'asc'
      } = req.query;

      const queryHotelId = req.user?.hotelId || req.user?.hotel || req.tenantId;
      const query = { hotelId: queryHotelId };
      if (status) query.status = status;
      if (eventType) query.eventType = eventType;
      
      if (startDate || endDate) {
        query.$or = [];
        if (startDate) {
          query.$or.push({ startDate: { $gte: new Date(startDate) } });
        }
        if (endDate) {
          query.$or.push({ endDate: { $lte: new Date(endDate) } });
        }
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [roomBlocks, total] = await Promise.all([
        RoomBlock.find(query)
          .populate('corporateId', 'name')
          .populate('rooms.roomId', 'roomNumber type')
          .populate('createdBy', 'name email')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        RoomBlock.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: roomBlocks,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      });

    } catch (error) {
      console.error('Get room blocks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room blocks',
        error: error.message
      });
    }
  }

  // Get room block by ID
  async getRoomBlock(req, res) {
    try {
      const { id } = req.params;

      const roomBlock = await RoomBlock.findById(id)
        .populate('corporateId', 'name contactPerson')
        .populate('rooms.roomId', 'roomNumber type floor')
        .populate('rooms.bookingId', 'bookingNumber userId')
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      if (!roomBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      res.json({
        success: true,
        data: roomBlock
      });

    } catch (error) {
      console.error('Get room block error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room block',
        error: error.message
      });
    }
  }

  // Update room block
  async updateRoomBlock(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Build $set with only allowed fields
      const allowedUpdates = [
        'blockName', 'groupName', 'eventType', 'contactPerson',
        'billingInstructions', 'specialInstructions', 'amenities',
        'cateringRequirements', 'paymentTerms', 'status'
      ];

      const setFields = { lastModifiedBy: req.user._id };
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          setFields[field] = updates[field];
        }
      });

      const updatedBlock = await RoomBlock.findOneAndUpdate(
        { _id: id },
        { $set: setFields },
        { new: true, runValidators: true }
      )
        .populate('corporateId', 'name')
        .populate('rooms.roomId', 'roomNumber type')
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email');

      if (!updatedBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      res.json({
        success: true,
        message: 'Room block updated successfully',
        data: updatedBlock
      });

    } catch (error) {
      console.error('Update room block error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update room block',
        error: error.message
      });
    }
  }

  // Release room from block
  async releaseRoom(req, res) {
    try {
      const { id, roomId } = req.params;
      const { reason } = req.body;

      // Atomically update the room status and add a note in one operation
      // Match block by id and the subdocument room by _id where status is not already released
      const roomBlock = await RoomBlock.findOneAndUpdate(
        {
          _id: id,
          'rooms._id': roomId,
          'rooms.status': { $ne: 'released' }
        },
        {
          $set: {
            'rooms.$.status': 'released',
            lastModifiedBy: req.user._id
          },
          $push: {
            notes: {
              content: `Room released. Reason: ${reason || 'Not specified'}`,
              createdBy: req.user._id,
              createdAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (!roomBlock) {
        // Determine whether block not found, room not found, or already released
        const existing = await RoomBlock.findById(id).lean();
        if (!existing) {
          return res.status(404).json({
            success: false,
            message: 'Room block not found'
          });
        }
        const room = existing.rooms?.find(r => r._id.toString() === roomId);
        if (!room) {
          return res.status(404).json({
            success: false,
            message: 'Room not found in block'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Room is already released'
        });
      }

      res.json({
        success: true,
        message: 'Room released successfully',
        data: roomBlock
      });

    } catch (error) {
      console.error('Release room error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to release room',
        error: error.message
      });
    }
  }

  // Book room from block
  async bookRoom(req, res) {
    try {
      const { id, roomId } = req.params;
      const { guestName, specialRequests, bookingId } = req.body;

      // Build the subdocument update fields
      const roomSetFields = {
        'rooms.$.status': 'booked',
        'rooms.$.guestName': guestName,
        'rooms.$.specialRequests': specialRequests,
        lastModifiedBy: req.user._id
      };
      if (bookingId) {
        roomSetFields['rooms.$.bookingId'] = bookingId;
      }

      // Atomically update room status from 'blocked' to 'booked'
      const roomBlock = await RoomBlock.findOneAndUpdate(
        {
          _id: id,
          'rooms._id': roomId,
          'rooms.status': 'blocked'
        },
        {
          $set: roomSetFields,
          $push: {
            notes: {
              content: `Room booked for ${guestName}`,
              createdBy: req.user._id,
              createdAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (!roomBlock) {
        const existing = await RoomBlock.findById(id).lean();
        if (!existing) {
          return res.status(404).json({
            success: false,
            message: 'Room block not found'
          });
        }
        const room = existing.rooms?.find(r => r._id.toString() === roomId);
        if (!room) {
          return res.status(404).json({
            success: false,
            message: 'Room not found in block'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Room is not available for booking'
        });
      }

      res.json({
        success: true,
        message: 'Room booked successfully',
        data: roomBlock
      });

    } catch (error) {
      console.error('Book room error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to book room',
        error: error.message
      });
    }
  }

  // Get room block statistics
  async getRoomBlockStats(req, res) {
    try {
      const hotelId = req.user?.hotelId || req.user?.hotel || req.tenantId;
      const query = { hotelId };

      const stats = await RoomBlock.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRooms: { $sum: '$totalRooms' },
            totalBookedRooms: { $sum: '$roomsBooked' },
            totalReleasedRooms: { $sum: '$roomsReleased' }
          }
        }
      ]);

      const eventTypeStats = await RoomBlock.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            totalRooms: { $sum: '$totalRooms' }
          }
        }
      ]);

      const recentBlocks = await RoomBlock.find(query)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5).lean();

      res.json({
        success: true,
        data: {
          statusStats: stats,
          eventTypeStats,
          recentBlocks
        }
      });

    } catch (error) {
      console.error('Get room block stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch room block statistics',
        error: error.message
      });
    }
  }

  // Add note to room block
  async addNote(req, res) {
    try {
      const { id } = req.params;
      const { content, isInternal = true } = req.body;

      // Atomically push note onto the array
      const roomBlock = await RoomBlock.findOneAndUpdate(
        { _id: id },
        {
          $push: {
            notes: {
              content,
              createdBy: req.user._id,
              isInternal
            }
          }
        },
        { new: true }
      );

      if (!roomBlock) {
        return res.status(404).json({
          success: false,
          message: 'Room block not found'
        });
      }

      const updatedBlock = await RoomBlock.findById(id)
        .populate('notes.createdBy', 'name').lean();

      res.json({
        success: true,
        message: 'Note added successfully',
        data: updatedBlock.notes
      });

    } catch (error) {
      console.error('Add note error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add note',
        error: error.message
      });
    }
  }
}

export default new RoomBlockController();
