import mongoose from 'mongoose';
import RoomType from '../models/RoomType.js';
import Room from '../models/Room.js';
import RoomAvailability from '../models/RoomAvailability.js';
import AuditLog from '../models/AuditLog.js';
import roomTypeTranslationService from '../services/roomTypeTranslationService.js';
import Language from '../models/Language.js';
import { v4 as uuidv4 } from 'uuid';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

class RoomTypeController {
  /**
   * Get all room types for a hotel
   */
  async getRoomTypes(req, res) {
    try {
      const { hotelId } = req.params;
      const { isActive, includeStats } = req.query;
      
      // Validate hotel ID is a proper ObjectId
      if (!mongoose.Types.ObjectId.isValid(hotelId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hotel ID format. Please provide a valid ObjectId.'
        });
      }
      
      const filter = { hotelId };
      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      const roomTypes = await RoomType.find(filter)
        .sort({ name: 1 }).lean().limit(1000);

      // Include room count stats if requested
      if (includeStats === 'true') {
        for (const roomType of roomTypes) {
          if (!roomType.totalRooms) {
            // Count actual rooms linked to this room type
            roomType.totalRooms = await Room.countDocuments({ roomTypeId: roomType._id, hotelId });
          }
        }
      }

      // Transform data for frontend compatibility
      const transformedRoomTypes = roomTypes.map(rt => ({
        ...rt,
        basePrice: rt.baseRate || 0,
        maxOccupancy: rt.specifications?.maxOccupancy || 2,
        totalRooms: rt.totalRooms || 0
      }));

      res.json({
        success: true,
        data: transformedRoomTypes
      });

    } catch (error) {
      console.error('Error getting room types:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get room type options for dropdowns
   */
  async getRoomTypeOptions(req, res) {
    try {
      const { hotelId } = req.params;
      
      // Validate hotel ID is a proper ObjectId
      if (!mongoose.Types.ObjectId.isValid(hotelId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hotel ID format. Please provide a valid ObjectId.'
        });
      }
      
      const roomTypes = await RoomType.find({ 
        hotelId, 
        isActive: true 
      }).select('_id name code baseRate totalRooms specifications.maxOccupancy').lean().limit(1000);

      const options = roomTypes.map(rt => ({
        id: rt._id.toString(), // Frontend expects 'id', not '_id'
        _id: rt._id,
        roomTypeId: rt._id.toString(),
        name: rt.name,
        code: rt.code,
        basePrice: rt.baseRate, // Map baseRate to basePrice for frontend compatibility
        baseRate: rt.baseRate,  // Keep baseRate as well for any legacy usage
        totalRooms: rt.totalRooms,
        maxOccupancy: rt.specifications?.maxOccupancy || 2,
        legacyType: rt.code.toLowerCase()
      }));

      res.json({
        success: true,
        data: options
      });

    } catch (error) {
      console.error('❌ [RoomTypeController] Error getting room type options:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get single room type by ID
   */
  async getRoomType(req, res) {
    try {
      const { id } = req.params;

      const roomType = await RoomType.findById(id);

      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      // Get additional stats - getTotalRooms is an instance method, requires non-lean document
      const totalRooms = typeof roomType.getTotalRooms === 'function'
        ? await roomType.getTotalRooms()
        : await Room.countDocuments({ roomTypeId: roomType._id, hotelId: roomType.hotelId });
      const roomTypeData = roomType.toObject();
      roomTypeData.totalRooms = totalRooms;

      res.json({
        success: true,
        data: roomTypeData
      });

    } catch (error) {
      console.error('Error getting room type:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create new room type
   */
  async createRoomType(req, res) {
    try {
      // Ensure required fields have default values
      const roomTypeData = {
        ...req.body,
        roomTypeId: req.body.roomTypeId || uuidv4(),
        // Required fields with defaults - map basePrice to baseRate for backend compatibility
        baseRate: req.body.baseRate || req.body.basePrice || 1000,
        totalRooms: req.body.totalRooms || 1,
        specifications: {
          maxOccupancy: 2,
          bedType: 'double',
          bedCount: 1,
          smokingPolicy: 'non_smoking',
          ...req.body.specifications,
          // Ensure maxOccupancy is always present
          maxOccupancy: req.body.specifications?.maxOccupancy || 2
        },
        // Content settings with defaults
        content: {
          baseLanguage: 'EN',
          autoTranslate: true,
          translationPriority: 'medium',
          ...req.body.content
        }
      };

      const roomType = new RoomType(roomTypeData);
      await roomType.save();

      // Log the creation
      await AuditLog.logChange({
        hotelId: roomType.hotelId,
        tableName: 'RoomType',
        recordId: roomType._id,
        changeType: 'create',
        newValues: roomType.toObject(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'manual'
      });

      res.status(201).json({
        success: true,
        data: roomType,
        message: 'Room type created successfully'
      });

    } catch (error) {
      console.error('Error creating room type:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Room type with this code already exists for this hotel'
        });
      }

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update room type
   */
  async updateRoomType(req, res) {
    try {
      const { id } = req.params;

      const existingRoomType = await RoomType.findById(id).lean();
      if (!existingRoomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      // lean() returns a plain object, no need for .toObject()
      const oldValues = { ...existingRoomType };

      // Map basePrice to baseRate for backend compatibility
      const updateData = { ...req.body };
      if (updateData.basePrice !== undefined) {
        updateData.baseRate = updateData.basePrice;
        delete updateData.basePrice;
      }

      // Map maxOccupancy to specifications.maxOccupancy for backend model compatibility
      if (updateData.maxOccupancy !== undefined) {
        if (!updateData.specifications) {
          updateData.specifications = { ...existingRoomType.specifications };
        }
        updateData.specifications.maxOccupancy = Number(updateData.maxOccupancy);
        delete updateData.maxOccupancy;
      }
      
      const roomType = await RoomType.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      // Log the update
      await AuditLog.logChange({
        hotelId: roomType.hotelId,
        tableName: 'RoomType',
        recordId: roomType._id,
        changeType: 'update',
        oldValues,
        newValues: roomType.toObject(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'manual'
      });

      res.json({
        success: true,
        data: roomType,
        message: 'Room type updated successfully'
      });

    } catch (error) {
      console.error('Error updating room type:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete (deactivate) room type
   */
  async deleteRoomType(req, res) {
    try {
      const { id } = req.params;
      
      const roomType = await RoomType.findById(id).lean();
      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      // Check if there are rooms using this room type
      const roomCount = await Room.countDocuments({ 
        roomTypeId: id, 
        isActive: true 
      });

      if (roomCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete room type. ${roomCount} rooms are still using this room type.`
        });
      }

      // lean() returns a plain object, no need for .toObject()
      const oldValues = { ...roomType };

      // Actually delete the room type instead of just deactivating
      await RoomType.findByIdAndDelete(id);

      // Log the deletion
      await AuditLog.logChange({
        hotelId: roomType.hotelId,
        tableName: 'RoomType',
        recordId: roomType._id,
        changeType: 'delete',
        oldValues,
        newValues: null,
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'manual'
      });

      res.json({
        success: true,
        message: 'Room type deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting room type:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Add channel mapping to room type
   */
  async addChannelMapping(req, res) {
    try {
      const { id } = req.params;
      const { channel, channelRoomTypeId, channelRoomTypeName } = req.body;

      // Atomically push channel mapping only if it doesn't already exist
      const roomType = await RoomType.findOneAndUpdate(
        {
          _id: id,
          'channels.channel': { $ne: channel }
        },
        {
          $push: {
            channels: {
              channel,
              channelRoomTypeId,
              name: channelRoomTypeName,
              isActive: true
            }
          }
        },
        { new: true, runValidators: true }
      );

      if (!roomType) {
        // Check if not found or duplicate channel
        const existing = await RoomType.findById(id).lean();
        if (!existing) {
          return res.status(404).json({
            success: false,
            message: 'Room type not found'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Channel mapping already exists for this room type'
        });
      }

      // Log the update
      await AuditLog.logChange({
        hotelId: roomType.hotelId,
        tableName: 'RoomType',
        recordId: roomType._id,
        changeType: 'update',
        newValues: roomType.toObject(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'room_mapping',
        metadata: {
          tags: ['channel_mapping']
        }
      });

      res.json({
        success: true,
        data: roomType,
        message: 'Channel mapping added successfully'
      });

    } catch (error) {
      console.error('Error adding channel mapping:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Remove channel mapping from room type
   */
  async removeChannelMapping(req, res) {
    try {
      const { id, channelId } = req.params;

      // Atomically pull the channel mapping from the array
      const roomType = await RoomType.findOneAndUpdate(
        { _id: id },
        { $pull: { channels: { channel: channelId } } },
        { new: true }
      );

      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      // Log the update
      await AuditLog.logChange({
        hotelId: roomType.hotelId,
        tableName: 'RoomType',
        recordId: roomType._id,
        changeType: 'update',
        newValues: roomType.toObject(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'room_mapping',
        metadata: {
          tags: ['channel_mapping_removal']
        }
      });

      res.json({
        success: true,
        message: 'Channel mapping removed successfully'
      });

    } catch (error) {
      console.error('Error removing channel mapping:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get room type by legacy type (for migration/backward compatibility)
   */
  async getRoomTypeByLegacy(req, res) {
    try {
      const { hotelId, legacyType } = req.params;
      
      const roomType = await RoomType.findByLegacyType(hotelId, legacyType);
      
      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found for legacy type'
        });
      }

      res.json({
        success: true,
        data: roomType
      });

    } catch (error) {
      console.error('Error getting room type by legacy:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Migrate existing rooms to use room types
   */
  async migrateRoomsToRoomTypes(req, res) {
    try {
      const { hotelId } = req.params;
      
      // Get valid roomTypeIds that belong to THIS hotel
      const validRoomTypeIds = await RoomType.find({ hotelId }).select('_id').lean();
      const validIds = new Set(validRoomTypeIds.map(rt => rt._id.toString()));

      // Get rooms that need migration:
      // 1. No roomTypeId at all
      // 2. roomTypeId is null
      // 3. roomTypeId references a room type from a DIFFERENT hotel (data inconsistency)
      const allRooms = await Room.find({
        hotelId,
        type: { $exists: true, $ne: null }
      }).limit(1000);

      const roomsToMigrate = allRooms.filter(room => {
        if (!room.roomTypeId) return true; // No roomTypeId
        return !validIds.has(room.roomTypeId.toString()); // roomTypeId belongs to different hotel
      });

      let migratedCount = 0;
      const results = [];

      for (const room of roomsToMigrate) {
        try {
          const typeCode = (room.type || 'standard').toUpperCase().substring(0, 5);

          // Find existing room type for this hotel by matching code or name
          let roomType = await RoomType.findOne({
            hotelId,
            $or: [
              { code: typeCode },
              { code: room.type?.toUpperCase() },
              { name: new RegExp(`^${room.type}$`, 'i') }
            ]
          });

          if (!roomType) {
            // Create new room type based on legacy room type
            const typeName = (room.type || 'standard').charAt(0).toUpperCase() + (room.type || 'standard').slice(1);
            roomType = new RoomType({
              hotelId,
              name: typeName,
              code: typeCode,
              baseRate: room.baseRate || room.currentRate || 1000,
              totalRooms: 1,
              specifications: {
                maxOccupancy: room.capacity || 2,
              },
              description: `Auto-created from room type: ${room.type}`,
              isActive: true,
            });

            await roomType.save();
          }

          // Link room to room type
          await Room.updateOne({ _id: room._id }, { $set: { roomTypeId: roomType._id } });

          migratedCount++;
          results.push({
            roomId: room._id,
            roomNumber: room.roomNumber,
            legacyType: room.type,
            roomTypeId: roomType._id,
            status: 'migrated'
          });

        } catch (error) {
          results.push({
            roomId: room._id,
            roomNumber: room.roomNumber,
            legacyType: room.type,
            status: 'failed',
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: {
          totalRooms: roomsToMigrate.length,
          migratedCount,
          results
        },
        message: `Successfully migrated ${migratedCount} out of ${roomsToMigrate.length} rooms`
      });

    } catch (error) {
      console.error('Error migrating rooms:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Helper method to get display name for legacy room types
   */
  getLegacyTypeName(legacyType) {
    const names = {
      'single': 'Single Room',
      'double': 'Double Room',
      'suite': 'Suite',
      'deluxe': 'Deluxe Room'
    };
    
    return names[legacyType] || `${legacyType.charAt(0).toUpperCase() + legacyType.slice(1)} Room`;
  }

  /**
   * Bulk create inventory for room type
   */
  async createInventoryForRoomType(req, res) {
    try {
      const { id } = req.params;
      const { year, month, totalRooms, baseRate } = req.body;

      const roomType = await RoomType.findById(id).lean();
      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      const inventory = await RoomAvailability.createInventoryForMonth(
        roomType.hotelId,
        roomType._id,
        year,
        month,
        totalRooms,
        baseRate
      );

      res.json({
        success: true,
        data: {
          roomTypeId: roomType._id,
          year,
          month,
          recordsCreated: inventory.length
        },
        message: `Created inventory for ${inventory.length} days`
      });

    } catch (error) {
      console.error('Error creating inventory:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ===== MULTILINGUAL ENDPOINTS =====

  /**
   * Get localized room types for hotel
   */
  async getLocalizedRoomTypes(req, res) {
    try {
      const { hotelId } = req.params;
      const { language = 'EN', includeStats = false, category, isActive } = req.query;
      
      const options = {
        published: req.query.published !== false,
        filter: {}
      };

      if (category) options.filter.category = category;
      if (isActive !== undefined) options.filter.isActive = isActive === 'true';

      const roomTypes = await roomTypeTranslationService.getHotelRoomTypes(
        hotelId, 
        language.toUpperCase(), 
        options
      );

      // Include additional stats if requested
      if (includeStats === 'true') {
        for (const roomType of roomTypes) {
          const translationProgress = await roomTypeTranslationService.getTranslationProgress(roomType._id);
          roomType.translationProgress = translationProgress;
        }
      }

      res.json({
        success: true,
        data: roomTypes,
        meta: {
          language: language.toUpperCase(),
          total: roomTypes.length
        }
      });

    } catch (error) {
      console.error('Error getting localized room types:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get single room type with localization
   */
  async getLocalizedRoomType(req, res) {
    try {
      const { id } = req.params;
      const { language = 'EN' } = req.query;

      const roomType = await roomTypeTranslationService.getLocalizedRoomType(
        id, 
        language.toUpperCase()
      );

      if (!roomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      // Get translation progress
      const translationProgress = await roomTypeTranslationService.getTranslationProgress(id);
      roomType.translationProgress = translationProgress;

      res.json({
        success: true,
        data: roomType,
        meta: {
          language: language.toUpperCase()
        }
      });

    } catch (error) {
      console.error('Error getting localized room type:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Initialize translations for room type
   */
  async initializeTranslations(req, res) {
    try {
      const { id } = req.params;
      const { targetLanguages = [], autoTranslate = true } = req.body;

      // Validate target languages
      const activeLanguages = await Language.getActiveLanguages();
      const validLanguages = targetLanguages.filter(lang => 
        activeLanguages.some(activeLang => activeLang.code === lang.toUpperCase())
      );

      if (validLanguages.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid target languages provided'
        });
      }

      const result = await roomTypeTranslationService.initializeRoomTypeTranslations(
        id,
        validLanguages.map(lang => lang.toUpperCase()),
        req.user?.id
      );

      // Update room type auto-translate setting
      if (autoTranslate !== undefined) {
        await RoomType.findByIdAndUpdate(id, {
          'content.autoTranslate': autoTranslate
        },
          { new: true }
        );
      }

      res.json({
        success: true,
        data: result,
        message: `Translations initialized for ${validLanguages.length} languages`
      });

    } catch (error) {
      console.error('Error initializing translations:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get translation progress for room type
   */
  async getTranslationProgress(req, res) {
    try {
      const { id } = req.params;
      const { language } = req.query;

      const progress = await roomTypeTranslationService.getTranslationProgress(
        id, 
        language ? language.toUpperCase() : null
      );

      res.json({
        success: true,
        data: progress
      });

    } catch (error) {
      console.error('Error getting translation progress:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Bulk initialize translations for multiple room types
   */
  async bulkInitializeTranslations(req, res) {
    try {
      const { hotelId } = req.params;
      const { roomTypeIds, targetLanguages, autoTranslate = true } = req.body;

      if (!roomTypeIds || roomTypeIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Room type IDs are required'
        });
      }

      if (!targetLanguages || targetLanguages.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Target languages are required'
        });
      }

      // Validate room types belong to hotel
      const roomTypes = await RoomType.find({
        _id: { $in: roomTypeIds },
        hotelId,
        isActive: true
      }).lean().limit(1000);

      if (roomTypes.length !== roomTypeIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some room types not found or do not belong to this hotel'
        });
      }

      const results = await roomTypeTranslationService.bulkInitializeTranslations(
        roomTypeIds,
        targetLanguages.map(lang => lang.toUpperCase()),
        req.user?.id
      );

      // Update auto-translate setting for all room types (scoped to hotel)
      if (autoTranslate !== undefined) {
        await RoomType.updateMany(
          { _id: { $in: roomTypeIds }, hotelId },
          { 'content.autoTranslate': autoTranslate }
        );
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: failCount,
            targetLanguages: targetLanguages.length
          }
        },
        message: `Bulk translation initialization completed: ${successCount} successful, ${failCount} failed`
      });

    } catch (error) {
      console.error('Error bulk initializing translations:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get room types with translation status
   */
  async getRoomTypesWithTranslationStatus(req, res) {
    try {
      const { hotelId } = req.params;
      const { category, isActive } = req.query;

      const options = {
        filter: {}
      };

      if (category) options.filter.category = category;
      if (isActive !== undefined) options.filter.isActive = isActive === 'true';

      const roomTypesWithStatus = await roomTypeTranslationService.getRoomTypesWithTranslationStatus(
        hotelId,
        options
      );

      res.json({
        success: true,
        data: roomTypesWithStatus,
        meta: {
          total: roomTypesWithStatus.length
        }
      });

    } catch (error) {
      console.error('Error getting room types with translation status:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create room type with automatic translation initialization
   */
  async createRoomTypeWithTranslations(req, res) {
    try {
      const roomTypeData = {
        ...req.body,
        code: req.body.code || uuidv4().substring(0, 8).toUpperCase(),
        createdBy: req.user?.id,
        updatedBy: req.user?.id,
        // Required fields with defaults - map basePrice to baseRate for backend compatibility
        baseRate: req.body.baseRate || req.body.basePrice || 1000,
        totalRooms: req.body.totalRooms || 1,
        specifications: {
          maxOccupancy: 2,
          bedType: 'double',
          bedCount: 1,
          smokingPolicy: 'non_smoking',
          ...req.body.specifications,
          // Ensure maxOccupancy is always present
          maxOccupancy: req.body.specifications?.maxOccupancy || 2
        }
      };

      // Set content configuration
      if (!roomTypeData.content) {
        roomTypeData.content = {};
      }
      
      roomTypeData.content.baseLanguage = roomTypeData.content.baseLanguage || 'EN';
      roomTypeData.content.autoTranslate = roomTypeData.content.autoTranslate !== false;
      roomTypeData.content.translationPriority = roomTypeData.content.translationPriority || 'medium';

      const roomType = new RoomType(roomTypeData);
      await roomType.save();

      // Initialize translations if target languages provided
      const { targetLanguages = [] } = req.body;
      let translationResult = null;

      if (targetLanguages.length > 0) {
        try {
          translationResult = await roomTypeTranslationService.initializeRoomTypeTranslations(
            roomType._id,
            targetLanguages.map(lang => lang.toUpperCase()),
            req.user?.id
          );
        } catch (translationError) {
          console.warn('Failed to initialize translations:', translationError.message);
          // Continue without translations
        }
      }

      // Initialize amenity translations if amenities provided
      if (roomType.amenities && roomType.amenities.length > 0) {
        for (const amenity of roomType.amenities) {
          if (amenity.name && targetLanguages.length > 0) {
            try {
              await roomTypeTranslationService.initializeAmenityTranslations(
                amenity.code,
                amenity.name,
                targetLanguages.map(lang => lang.toUpperCase()),
                req.user?.id
              );
            } catch (amenityError) {
              console.warn('Failed to initialize amenity translations:', amenityError.message);
            }
          }
        }
      }

      // Log the creation
      await AuditLog.logChange({
        hotelId: roomType.hotelId,
        tableName: 'RoomType',
        recordId: roomType._id,
        changeType: 'create',
        newValues: roomType.toObject(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'manual'
      });

      const response = {
        success: true,
        data: roomType.toObject(),
        message: 'Room type created successfully'
      };

      if (translationResult) {
        response.data.translationStatus = translationResult;
        response.message += ` with ${translationResult.translationsCreated} translations initialized`;
      }

      res.status(201).json(response);

    } catch (error) {
      console.error('Error creating room type with translations:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Room type with this code already exists for this hotel'
        });
      }

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update room type and handle translation updates
   */
  async updateRoomTypeWithTranslations(req, res) {
    try {
      const { id } = req.params;
      const { updateTranslations = false, targetLanguages = [] } = req.body;
      
      const existingRoomType = await RoomType.findById(id).lean();
      if (!existingRoomType) {
        return res.status(404).json({
          success: false,
          message: 'Room type not found'
        });
      }

      // lean() returns a plain object, no need for .toObject()
      const oldValues = { ...existingRoomType };

      // Update room type
      const updatedData = { ...req.body };
      delete updatedData.updateTranslations;
      delete updatedData.targetLanguages;
      updatedData.updatedBy = req.user?.id;

      const roomType = await RoomType.findByIdAndUpdate(
        id,
        updatedData,
        { new: true, runValidators: true }
      );

      // Handle translation updates if content changed and updateTranslations is true
      let translationResult = null;
      if (updateTranslations && targetLanguages.length > 0) {
        const contentChanged = (
          oldValues.name !== roomType.name ||
          oldValues.description !== roomType.description ||
          oldValues.shortDescription !== roomType.shortDescription ||
          JSON.stringify(oldValues.amenities) !== JSON.stringify(roomType.amenities) ||
          JSON.stringify(oldValues.images) !== JSON.stringify(roomType.images)
        );

        if (contentChanged) {
          try {
            translationResult = await roomTypeTranslationService.initializeRoomTypeTranslations(
              roomType._id,
              targetLanguages.map(lang => lang.toUpperCase()),
              req.user?.id
            );
          } catch (translationError) {
            console.warn('Failed to update translations:', translationError.message);
          }
        }
      }

      // Log the update
      await AuditLog.logChange({
        hotelId: roomType.hotelId,
        tableName: 'RoomType',
        recordId: roomType._id,
        changeType: 'update',
        oldValues,
        newValues: roomType.toObject(),
        userId: req.user?.id,
        userEmail: req.user?.email,
        source: 'manual'
      });

      const response = {
        success: true,
        data: roomType.toObject(),
        message: 'Room type updated successfully'
      };

      if (translationResult) {
        response.data.translationStatus = translationResult;
        response.message += ` with ${translationResult.translationsCreated} translations updated`;
      }

      res.json(response);

    } catch (error) {
      console.error('Error updating room type with translations:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get localized room types for a hotel
   */
  async getLocalizedRoomTypes(req, res) {
    try {
      const { hotelId } = req.params;
      const { language = 'EN', isActive, published } = req.query;
      
      const filter = { hotelId };
      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }
      if (published !== undefined) {
        filter.isPublished = published === 'true';
      }

      const roomTypes = await RoomType.find(filter)
        .sort({ name: 1 }).lean().limit(1000);

      // Apply localization if needed (lean() returns plain objects, spread instead of .toObject())
      const localizedRoomTypes = roomTypes.map(roomType => {
        const localized = { ...roomType };

        // If language is not EN, try to get translated content
        if (language !== 'EN' && roomType.content?.translations) {
          const translation = roomType.content.translations.find(t => t.language === language);
          if (translation) {
            if (translation.name) localized.name = translation.name;
            if (translation.description) localized.description = translation.description;
            if (translation.shortDescription) localized.shortDescription = translation.shortDescription;
          }
        }

        return localized;
      });

      res.json({
        success: true,
        data: localizedRoomTypes,
        language,
        count: localizedRoomTypes.length
      });

    } catch (error) {
      console.error('Error getting localized room types:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new RoomTypeController();
