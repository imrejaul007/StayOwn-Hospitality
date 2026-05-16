import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  ChannelType,
  RoomType,
  BookingStatus,
  ChannelConfigSchema,
  IChannelConfig,
  IRoomMapping,
  IBookingImport,
  IChannelAdapter
} from '../types/index.js';
import { ChannelConfig, RoomMapping } from '../models/index.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('channelManager');

export class ChannelManager {
  private adapters: Map<ChannelType, IChannelAdapter>;
  private axiosInstances: Map<string, AxiosInstance>;

  constructor() {
    this.adapters = new Map();
    this.axiosInstances = new Map();
  }

  /**
   * Register a new channel configuration
   */
  async registerChannel(config: IChannelConfig): Promise<IChannelConfig> {
    const validated = ChannelConfigSchema.parse(config);

    const existing = await ChannelConfig.findOne({
      channelType: validated.channelType,
      propertyId: validated.propertyId
    });

    if (existing) {
      // Update existing configuration
      Object.assign(existing, validated);
      await existing.save();
      logger.info('Updated channel configuration', {
        channelId: existing.channelId,
        channelType: existing.channelType
      });
      return existing.toObject();
    }

    // Create new configuration
    const newConfig = new ChannelConfig({
      ...validated,
      channelId: uuidv4()
    });
    await newConfig.save();

    logger.info('Registered new channel', {
      channelId: newConfig.channelId,
      channelType: newConfig.channelType,
      name: newConfig.name
    });

    return newConfig.toObject();
  }

  /**
   * Get all active channels for a hotel
   */
  async getHotelChannels(hotelId: string): Promise<IChannelConfig[]> {
    const channels = await ChannelConfig.find({
      propertyId: hotelId,
      isActive: true
    });

    return channels.map(ch => ch.toObject());
  }

  /**
   * Get channel configuration by ID
   */
  async getChannel(channelId: string): Promise<IChannelConfig | null> {
    const channel = await ChannelConfig.findOne({ channelId });
    return channel ? channel.toObject() : null;
  }

  /**
   * Update channel configuration
   */
  async updateChannel(channelId: string, updates: Partial<IChannelConfig>): Promise<IChannelConfig | null> {
    const channel = await ChannelConfig.findOneAndUpdate(
      { channelId },
      { $set: updates },
      { new: true }
    );

    if (channel) {
      logger.info('Updated channel', { channelId, updates: Object.keys(updates) });
      return channel.toObject();
    }
    return null;
  }

  /**
   * Deactivate a channel
   */
  async deactivateChannel(channelId: string): Promise<boolean> {
    const result = await ChannelConfig.findOneAndUpdate(
      { channelId },
      { $set: { isActive: false } }
    );

    if (result) {
      logger.info('Deactivated channel', { channelId });
      return true;
    }
    return false;
  }

  /**
   * Create room mapping between internal room and channel room
   */
  async createRoomMapping(mapping: Omit<IRoomMapping, 'mappingId'>): Promise<IRoomMapping> {
    const existing = await RoomMapping.findOne({
      hotelId: mapping.hotelId,
      channelId: mapping.channelId,
      internalRoomId: mapping.internalRoomId
    });

    if (existing) {
      throw new Error(`Room mapping already exists for internal room ${mapping.internalRoomId}`);
    }

    const newMapping = new RoomMapping({
      ...mapping,
      mappingId: uuidv4()
    });
    await newMapping.save();

    logger.info('Created room mapping', {
      mappingId: newMapping.mappingId,
      hotelId: mapping.hotelId,
      channelId: mapping.channelId
    });

    return newMapping.toObject();
  }

  /**
   * Get room mappings for a hotel
   */
  async getRoomMappings(hotelId: string, channelId?: string): Promise<IRoomMapping[]> {
    const query: Record<string, any> = { hotelId, isActive: true };
    if (channelId) {
      query.channelId = channelId;
    }

    const mappings = await RoomMapping.find(query);
    return mappings.map(m => m.toObject());
  }

  /**
   * Update room mapping
   */
  async updateRoomMapping(mappingId: string, updates: Partial<IRoomMapping>): Promise<IRoomMapping | null> {
    const mapping = await RoomMapping.findOneAndUpdate(
      { mappingId },
      { $set: updates },
      { new: true }
    );

    if (mapping) {
      logger.info('Updated room mapping', { mappingId });
      return mapping.toObject();
    }
    return null;
  }

  /**
   * Delete room mapping
   */
  async deleteRoomMapping(mappingId: string): Promise<boolean> {
    const result = await RoomMapping.findOneAndDelete({ mappingId });
    if (result) {
      logger.info('Deleted room mapping', { mappingId });
      return true;
    }
    return false;
  }

  /**
   * Get channel adapter for a specific channel type
   */
  getAdapter(channelType: ChannelType): IChannelAdapter | null {
    return this.adapters.get(channelType) || null;
  }

  /**
   * Register a channel adapter
   */
  registerAdapter(channelType: ChannelType, adapter: IChannelAdapter): void {
    this.adapters.set(channelType, adapter);
    logger.info('Registered channel adapter', { channelType });
  }

  /**
   * Create axios instance for a channel with proper auth
   */
  async getChannelClient(channel: IChannelConfig): Promise<AxiosInstance> {
    const cacheKey = `${channel.channelId}`;

    if (this.axiosInstances.has(cacheKey)) {
      return this.axiosInstances.get(cacheKey)!;
    }

    const client = axios.create({
      baseURL: channel.apiEndpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(channel.apiKey && { 'Authorization': `Bearer ${channel.apiKey}` })
      }
    });

    // Add response interceptor for error handling
    client.interceptors.response.use(
      response => response,
      error => {
        logger.error('Channel API error', {
          channelId: channel.channelId,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    this.axiosInstances.set(cacheKey, client);
    return client;
  }

  /**
   * Test connection to a channel
   */
  async testConnection(channelId: string): Promise<{ success: boolean; message: string }> {
    const channel = await ChannelConfig.findOne({ channelId }).select('+apiKey +apiSecret');

    if (!channel) {
      return { success: false, message: 'Channel not found' };
    }

    try {
      const client = await this.getChannelClient(channel.toObject());
      // Most channel APIs have a health/ping endpoint
      await client.get('/health', { timeout: 5000 });
      return { success: true, message: 'Connection successful' };
    } catch (error: any) {
      logger.error('Connection test failed', { channelId, error: error.message });
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed'
      };
    }
  }

  /**
   * Sync room mappings to a channel
   */
  async syncRoomMappingsToChannel(channelId: string): Promise<{ synced: number; failed: number }> {
    const mappings = await RoomMapping.find({ channelId, isActive: true });
    const channel = await ChannelConfig.findOne({ channelId });

    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    let synced = 0;
    let failed = 0;

    // In production, this would push mappings to the channel's API
    // For now, we simulate the sync
    for (const mapping of mappings) {
      try {
        logger.info('Syncing room mapping to channel', {
          channelId,
          mappingId: mapping.mappingId,
          internalRoomId: mapping.internalRoomId,
          channelRoomId: mapping.channelRoomId
        });
        synced++;
      } catch (error: any) {
        logger.error('Failed to sync room mapping', {
          channelId,
          mappingId: mapping.mappingId,
          error: error.message
        });
        failed++;
      }
    }

    // Update last sync time
    await ChannelConfig.updateOne(
      { channelId },
      { $set: { lastSyncAt: new Date() } }
    );

    return { synced, failed };
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channelId: string): Promise<{
    totalMappings: number;
    activeMappings: number;
    lastSyncAt: Date | null;
    totalBookings: number;
  }> {
    const channel = await ChannelConfig.findOne({ channelId });
    const mappings = await RoomMapping.find({ channelId });

    return {
      totalMappings: mappings.length,
      activeMappings: mappings.filter(m => m.isActive).length,
      lastSyncAt: channel?.lastSyncAt || null,
      totalBookings: 0 // Would query bookings collection
    };
  }
}

export const channelManager = new ChannelManager();
export default channelManager;
