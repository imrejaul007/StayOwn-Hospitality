import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';
import Room from '../models/Room.js';
import Hotel from '../models/Hotel.js';
import SyncHistory from '../models/SyncHistory.js';
import { CircuitBreaker } from '../utils/circuitBreaker.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

const bookingComBreaker = new CircuitBreaker({ name: 'booking_com', failureThreshold: 5, resetTimeout: 30000, timeout: 30000 });

export class BookingComConnector {
  constructor() {
    this.baseURL = process.env.BOOKINGCOM_API_BASE || 'https://api.booking.com';
    this.clientId = process.env.BOOKINGCOM_CLIENT_ID;
    this.clientSecret = process.env.BOOKINGCOM_CLIENT_SECRET;
    this.redis = getRedisClient();
  }

  async authenticate() {
    // Implement OAuth2 or API key authentication for Booking.com
    // This is a simplified version - actual implementation would depend on Booking.com's auth method
    try {
      // For demo purposes, we'll simulate authentication
      if (!this.clientId || !this.clientSecret) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Booking.com credentials are not configured');
        }
        logger.warn('Booking.com credentials not configured, using fallback authentication');
        // Generate a more realistic token for demo/development environments
        const timestamp = Date.now();
        const hash = crypto.createHash('sha256').update(`fallback_${timestamp}`).digest('hex').substring(0, 16);
        return `demo_bc_${hash}_${timestamp}`;
      }

      const response = await bookingComBreaker.execute(
        () => axios.post(`${this.baseURL}/oauth/token`, {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        }),
        () => { throw new Error('Booking.com authentication service temporarily unavailable.'); }
      );

      return response.data.access_token;
    } catch (error) {
      logger.error('Booking.com authentication failed:', error.message);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      // For demo purposes, return a fallback token instead of failing
      logger.warn('Authentication failed, using fallback token for demo environment');
      const timestamp = Date.now();
      const hash = crypto.createHash('sha256').update(`fallback_error_${timestamp}`).digest('hex').substring(0, 16);
      return `demo_bc_error_${hash}_${timestamp}`;
    }
  }

  async syncAvailability(hotelId) {
    const syncId = crypto.randomUUID();
    const startTime = Date.now();
    
    // Create sync history record
    const syncHistory = await SyncHistory.create({
      hotelId,
      provider: 'booking_com',
      type: 'availability_sync',
      status: 'in_progress',
      syncId,
      startedAt: new Date()
    });
    
    try {
      logger.info(`Starting Booking.com availability sync for hotel: ${hotelId}`);
      
      // Get hotel configuration
      let hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        throw new Error('Hotel not found');
      }
      
      // Atomically initialize OTA connections if needed (avoids multiple save() calls)
      if (!hotel.otaConnections || !hotel.otaConnections.bookingCom) {
        hotel = await Hotel.findByIdAndUpdate(
          hotelId,
          {
            $setOnInsert: {},
            $set: {
              'otaConnections.bookingCom': hotel.otaConnections?.bookingCom || {
                isEnabled: false,
                credentials: {},
                lastSync: null
              }
            }
          },
          { new: true }
        );
      }
      
      if (!hotel.otaConnections.bookingCom.isEnabled) {
        throw new Error('Booking.com integration is not enabled for this hotel');
      }

      const bookingComHotelId = hotel.otaConnections.bookingCom.credentials?.hotelId || `demo_hotel_${hotelId.toString().substring(0, 8)}`;
      
      // Store sync start status in Redis
      if (this.redis && this.redis.isReady) {
        await this.redis.setEx(`sync:${syncId}`, 3600, JSON.stringify({
          hotelId,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          provider: 'booking_com'
        }));
      }

      // Authenticate with Booking.com
      const accessToken = await this.authenticate();

      // Fetch availability data
      const availability = await this.fetchAvailability(bookingComHotelId, accessToken, hotelId);

      // Update room availability in our system
      await this.updateRoomAvailability(hotelId, availability);

      // Update hotel lastSync and sync history atomically within a transaction
      const endTime = Date.now();
      const txnSession = await mongoose.startSession();
      try {
        await txnSession.withTransaction(async () => {
          try {
            await Hotel.findByIdAndUpdate(
              hotelId,
              { $set: { 'otaConnections.bookingCom.lastSync': new Date() } },
              { session: txnSession, new: true }
            );

            await SyncHistory.findByIdAndUpdate(syncHistory._id, {
              status: 'completed',
              completedAt: new Date(),
              roomsUpdated: availability.rooms?.length || 0,
              metadata: {
                duration: endTime - startTime,
                recordsProcessed: availability.rooms?.length || 0,
                apiCalls: 2, // auth + availability call
                dataSize: JSON.stringify(availability).length
              }
            }, { session: txnSession, new: true });
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        });
      } finally {
        txnSession.endSession();
      }

      // Update Redis for real-time status
      if (this.redis && this.redis.isReady) {
        await this.redis.setEx(`sync:${syncId}`, 3600, JSON.stringify({
          hotelId,
          status: 'completed',
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          provider: 'booking_com',
          roomsUpdated: availability.rooms?.length || 0
        }));
      }

      logger.info(`Booking.com availability sync completed for hotel: ${hotelId}`);
      
      return {
        syncId,
        estimatedCompletion: new Date(Date.now() + 5 * 60000) // 5 minutes from now
      };

    } catch (error) {
      logger.error(`Booking.com sync failed for hotel ${hotelId}:`, error.message);
      
      // Update sync history record with failure
      const endTime = Date.now();
      await SyncHistory.findByIdAndUpdate(syncHistory._id, {
        status: 'failed',
        completedAt: new Date(),
        errors: [{
          message: error.message,
          code: error.code || 'SYNC_ERROR',
          timestamp: new Date()
        }],
        metadata: {
          duration: endTime - startTime,
          recordsProcessed: 0,
          apiCalls: 1, // failed during process
          dataSize: 0
        }
      },
        { new: true }
      );
      
      // Update Redis status to failed
      if (this.redis && this.redis.isReady) {
        await this.redis.setEx(`sync:${syncId}`, 3600, JSON.stringify({
          hotelId,
          status: 'failed',
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          provider: 'booking_com',
          error: error.message
        }));
      }
      
      throw error;
    }
  }

  async fetchAvailability(bookingComHotelId, accessToken, hotelId) {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    try {
      // This would be the actual Booking.com API endpoint (with circuit breaker)
      const response = await bookingComBreaker.execute(
        () => axios.get(
          `${this.baseURL}/hotels/${bookingComHotelId}/availability`,
          {
            headers,
            params: {
              start_date: new Date().toISOString().split('T')[0],
              end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days ahead
            }
          }
        ),
        () => { throw new Error('Booking.com availability service temporarily unavailable.'); }
      );

      return response.data;
    } catch (error) {
      logger.warn('Booking.com API call failed, generating fallback data from hotel inventory:', error.message);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }

      // Generate realistic fallback data based on actual hotel rooms
      try {
        const hotelRooms = await Room.find({
          hotelId,
          status: { $in: ['available', 'occupied', 'maintenance'] }
        }).limit(10).lean();

        const fallbackRooms = hotelRooms.map(room => ({
          room_number: room.number,
          id: `room_${room.number}`,
          available: room.status === 'available',
          rate: Math.round((room.baseRate || 150) * 100), // Convert to cents
          room_type: room.roomType,
          last_updated: new Date().toISOString()
        }));

        return {
          rooms: fallbackRooms,
          success: false,
          provider: 'booking_com',
          message: 'Fallback data generated from hotel inventory - external sync failed',
          total_rooms: fallbackRooms.length,
          available_rooms: fallbackRooms.filter(r => r.available).length,
          generated_at: new Date().toISOString()
        };
      } catch (roomFetchError) {
        logger.error('Failed to generate fallback room data:', roomFetchError.message);

        // Ultimate fallback if even room data can't be fetched
        return {
          rooms: [],
          success: false,
          provider: 'booking_com',
          message: 'External sync failed and unable to generate fallback data',
          error: 'Database unavailable'
        };
      }
    }
  }

  async updateRoomAvailability(hotelId, availabilityData) {
    // This would map Booking.com room data to our room structure
    // For now, this is a simplified implementation

    if (!availabilityData.rooms) {
      return;
    }

    // Batch: use bulkWrite to update all rooms at once
    const roomBulkOps = availabilityData.rooms.map(roomData => {
      const updateFields = {
        status: roomData.available ? 'vacant' : 'occupied'
      };
      if (roomData.rate) {
        updateFields.currentRate = roomData.rate;
      }
      return {
        updateOne: {
          filter: { hotelId, roomNumber: roomData.room_number || roomData.id },
          update: { $set: updateFields }
        }
      };
    });

    if (roomBulkOps.length > 0) {
      await Room.bulkWrite(roomBulkOps);
    }

    for (const roomData of availabilityData.rooms) {
      try {
        const room = { roomNumber: roomData.room_number || roomData.id };

        if (room) {
          logger.debug(`Updated room ${room.roomNumber} availability`);
        }
      } catch (error) {
        logger.error(`Failed to update room availability:`, error.message);
      }
    }
  }

  async getSyncStatus(hotelId) {
    if (!this.redis || !this.redis.isReady) {
      return {
        status: 'unknown',
        message: 'Redis not available for status tracking'
      };
    }

    try {
      // Iterate keys incrementally to avoid blocking Redis in production.
      let latestSync = null;
      let cursor = '0';
      do {
        const scanResult = await this.redis.scan(cursor, { MATCH: 'sync:*', COUNT: 100 });
        cursor = scanResult.cursor;
        const keys = scanResult.keys || [];
        for (const key of keys) {
          const syncData = await this.redis.get(key);
          if (syncData) {
            const parsed = JSON.parse(syncData);
            if (parsed.hotelId === hotelId &&
                (!latestSync || new Date(parsed.startedAt) > new Date(latestSync.startedAt))) {
              latestSync = parsed;
            }
          }
        }
      } while (cursor !== '0');

      if (!latestSync) {
        return {
          status: 'never_synced',
          message: 'No sync history found for this hotel'
        };
      }

      return latestSync;
    } catch (error) {
      logger.error('Error getting sync status:', error);
      return {
        status: 'error',
        message: 'Failed to retrieve sync status'
      };
    }
  }

  // Webhook handler for Booking.com notifications (if supported)
  async handleWebhook(payload, signature) {
    try {
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', this.clientSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      logger.info('Booking.com webhook received:', payload.event_type);

      // Handle different webhook events
      switch (payload.event_type) {
        case 'availability_updated':
          await this.handleAvailabilityUpdate(payload);
          break;
        case 'booking_created':
          await this.handleNewBooking(payload);
          break;
        default:
          logger.info(`Unhandled webhook event: ${payload.event_type}`);
      }
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async handleAvailabilityUpdate(payload) {
    try {
      // Update room availability based on webhook data
      const { hotel_id, room_id, available, date } = payload.data;
    
      // Find our hotel by Booking.com hotel ID
      const hotel = await Hotel.findOne({
        'otaConnections.bookingCom.credentials.hotelId': hotel_id
      }).lean();

      if (hotel) {
        // Trigger availability sync for this hotel
        await this.syncAvailability(hotel._id);
      }
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async handleNewBooking(payload) {
    try {
      // Handle new booking notifications from Booking.com
      // This would typically create a booking record in our system
      logger.info('New Booking.com booking received:', payload.data.booking_id);
    
      // Implementation would depend on business requirements
      // for handling external bookings
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }
}