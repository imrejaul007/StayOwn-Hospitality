import { v4 as uuidv4 } from 'uuid';
import {
  IInventoryUpdate,
  InventoryUpdateSchema,
  SyncStatus,
  RoomType,
  ChannelType
} from '../types/index.js';
import { Inventory, RoomMapping, ChannelConfig, SyncJob } from '../models/index.js';
import { channelManager } from './channelManager.js';
import { createModuleLogger } from '../utils/logger.js';
import { config } from '../config/index.js';

const logger = createModuleLogger('inventorySync');

export interface InventorySyncResult {
  jobId: string;
  hotelId: string;
  channelId: string;
  status: SyncStatus;
  itemsProcessed: number;
  itemsFailed: number;
  errors: Array<{ itemId: string; error: string }>;
  duration: number;
}

export class InventorySyncService {
  private isRunning: boolean = false;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Update inventory for a hotel
   */
  async updateInventory(update: IInventoryUpdate): Promise<void> {
    const validated = InventoryUpdateSchema.parse(update);

    const inventory = await Inventory.findOneAndUpdate(
      {
        hotelId: validated.hotelId,
        roomMappingId: validated.roomMappingId,
        date: new Date(validated.date)
      },
      {
        $set: {
          availableRooms: validated.availableRooms,
          totalRooms: validated.totalRooms,
          minStay: validated.minStay,
          maxStay: validated.maxStay,
          closedToArrival: validated.closedToArrival,
          closedToDeparture: validated.closedToDeparture,
          lastSyncedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Updated inventory', {
      hotelId: validated.hotelId,
      roomMappingId: validated.roomMappingId,
      date: validated.date,
      availableRooms: validated.availableRooms
    });

    // Mark as pending for all active channel syncs
    const mappings = await RoomMapping.find({
      hotelId: validated.hotelId,
      internalRoomId: inventory.roomMappingId.split(':')[0],
      syncAvailability: true,
      isActive: true
    });

    for (const mapping of mappings) {
      const channelSyncStatus = inventory.channelSyncStatus || new Map();
      channelSyncStatus.set(mapping.channelId, 'pending');
      await Inventory.updateOne(
        { _id: inventory._id },
        { $set: { channelSyncStatus } }
      );
    }
  }

  /**
   * Bulk update inventory
   */
  async bulkUpdateInventory(updates: IInventoryUpdate[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const update of updates) {
      try {
        await this.updateInventory(update);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`${update.roomMappingId}: ${error.message}`);
        logger.error('Bulk inventory update failed', {
          roomMappingId: update.roomMappingId,
          error: error.message
        });
      }
    }

    return { success, failed, errors };
  }

  /**
   * Get inventory for a date range
   */
  async getInventory(
    hotelId: string,
    startDate: string,
    endDate: string,
    roomMappingId?: string
  ): Promise<any[]> {
    const query: Record<string, any> = {
      hotelId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (roomMappingId) {
      query.roomMappingId = roomMappingId;
    }

    const inventory = await Inventory.find(query).sort({ date: 1 });
    return inventory.map(inv => ({
      hotelId: inv.hotelId,
      roomMappingId: inv.roomMappingId,
      date: inv.date.toISOString().split('T')[0],
      availableRooms: inv.availableRooms,
      totalRooms: inv.totalRooms,
      minStay: inv.minStay,
      maxStay: inv.maxStay,
      closedToArrival: inv.closedToArrival,
      closedToDeparture: inv.closedToDeparture,
      lastSyncedAt: inv.lastSyncedAt
    }));
  }

  /**
   * Sync inventory to a specific channel
   */
  async syncToChannel(
    hotelId: string,
    channelId: string,
    startDate: string,
    endDate: string
  ): Promise<InventorySyncResult> {
    const jobId = uuidv4();
    const startTime = Date.now();

    // Create sync job record
    const syncJob = new SyncJob({
      jobId,
      hotelId,
      channelId,
      syncType: 'inventory',
      status: SyncStatus.IN_PROGRESS,
      startTime: new Date()
    });
    await syncJob.save();

    logger.info('Starting inventory sync to channel', { jobId, hotelId, channelId });

    const errors: Array<{ itemId: string; error: string }> = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;

    try {
      // Get channel configuration
      const channel = await ChannelConfig.findOne({ channelId });
      if (!channel || !channel.isActive) {
        throw new Error(`Channel ${channelId} is not active`);
      }

      // Get room mappings for this channel
      const mappings = await RoomMapping.find({
        hotelId,
        channelId,
        syncAvailability: true,
        isActive: true
      });

      if (mappings.length === 0) {
        logger.warn('No active room mappings for sync', { hotelId, channelId });
      }

      // Get inventory data for each mapping
      for (const mapping of mappings) {
        const inventory = await this.getInventory(
          hotelId,
          startDate,
          endDate,
          mapping.mappingId
        );

        // Process in batches
        const batchSize = config.sync.batchSize;
        for (let i = 0; i < inventory.length; i += batchSize) {
          const batch = inventory.slice(i, i + batchSize);

          try {
            // Push to channel (simulated - in production this would call the channel API)
            await this.pushToChannel(channel, mapping, batch);

            // Update sync status
            for (const item of batch) {
              await Inventory.updateOne(
                {
                  hotelId,
                  roomMappingId: mapping.mappingId,
                  date: new Date(item.date)
                },
                {
                  $set: {
                    [`channelSyncStatus.${channelId}`]: 'synced',
                    lastSyncedAt: new Date()
                  }
                }
              );
              itemsProcessed++;
            }
          } catch (error: any) {
            logger.error('Failed to sync batch to channel', {
              mappingId: mapping.mappingId,
              error: error.message
            });

            for (const item of batch) {
              errors.push({
                itemId: `${mapping.mappingId}:${item.date}`,
                error: error.message
              });
              itemsFailed++;
            }
          }
        }
      }

      // Update job status
      const duration = Date.now() - startTime;
      await SyncJob.findOneAndUpdate(
        { jobId },
        {
          $set: {
            status: itemsFailed > 0 ? SyncStatus.FAILED : SyncStatus.COMPLETED,
            endTime: new Date(),
            itemsProcessed,
            itemsFailed,
            errors: errors.map(e => ({
              itemId: e.itemId,
              error: e.error,
              timestamp: new Date()
            }))
          }
        }
      );

      logger.info('Inventory sync completed', {
        jobId,
        itemsProcessed,
        itemsFailed,
        duration
      });

      return {
        jobId,
        hotelId,
        channelId,
        status: itemsFailed > 0 ? SyncStatus.FAILED : SyncStatus.COMPLETED,
        itemsProcessed,
        itemsFailed,
        errors,
        duration
      };
    } catch (error: any) {
      await SyncJob.findOneAndUpdate(
        { jobId },
        {
          $set: {
            status: SyncStatus.FAILED,
            endTime: new Date(),
            itemsProcessed,
            itemsFailed: 1,
            errors: [{
              itemId: 'sync',
              error: error.message,
              timestamp: new Date()
            }]
          }
        }
      );

      logger.error('Inventory sync failed', { jobId, error: error.message });

      return {
        jobId,
        hotelId,
        channelId,
        status: SyncStatus.FAILED,
        itemsProcessed,
        itemsFailed: 1,
        errors: [{ itemId: 'sync', error: error.message }],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Push inventory data to channel (adapter pattern)
   */
  private async pushToChannel(
    channel: any,
    mapping: any,
    inventory: any[]
  ): Promise<void> {
    const adapter = channelManager.getAdapter(channel.channelType as ChannelType);

    if (adapter) {
      await adapter.updateAvailability(channel.propertyId, inventory);
    } else {
      // Generic push using HTTP client
      const client = await channelManager.getChannelClient(channel.toObject());

      // Channel-specific payload transformation would happen here
      const payload = {
        property_id: channel.propertyId,
        room_id: mapping.channelRoomId,
        availability: inventory.map(inv => ({
          date: inv.date,
          rooms_available: inv.availableRooms,
          min_stay: inv.minStay,
          max_stay: inv.maxStay,
          closed_to_arrival: inv.closedToArrival,
          closed_to_departure: inv.closedToDeparture
        }))
      };

      await client.post('/availability/update', payload);
    }
  }

  /**
   * Pull inventory from channel
   */
  async pullFromChannel(
    hotelId: string,
    channelId: string,
    startDate: string,
    endDate: string
  ): Promise<{ imported: number; errors: string[] }> {
    const channel = await ChannelConfig.findOne({ channelId });
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const mappings = await RoomMapping.find({
      hotelId,
      channelId,
      syncAvailability: true,
      isActive: true
    });

    let imported = 0;
    const errors: string[] = [];

    for (const mapping of mappings) {
      try {
        const adapter = channelManager.getAdapter(channel.channelType as ChannelType);

        let channelInventory;
        if (adapter) {
          channelInventory = await adapter.getAvailability(
            channel.propertyId,
            startDate,
            endDate
          );
        } else {
          // Generic pull using HTTP client
          const client = await channelManager.getChannelClient(channel.toObject());
          const response = await client.get(
            `/availability/${channel.propertyId}/${mapping.channelRoomId}`,
            { params: { start_date: startDate, end_date: endDate } }
          );
          channelInventory = response.data;
        }

        // Transform and save inventory
        for (const inv of channelInventory) {
          await this.updateInventory({
            hotelId,
            roomMappingId: mapping.mappingId,
            date: inv.date,
            availableRooms: inv.availableRooms,
            totalRooms: inv.totalRooms,
            minStay: inv.minStay,
            maxStay: inv.maxStay,
            closedToArrival: inv.closedToArrival,
            closedToDeparture: inv.closedToDeparture
          });
          imported++;
        }
      } catch (error: any) {
        errors.push(`${mapping.mappingId}: ${error.message}`);
        logger.error('Failed to pull inventory from channel', {
          mappingId: mapping.mappingId,
          error: error.message
        });
      }
    }

    return { imported, errors };
  }

  /**
   * Start automatic sync for a hotel's channels
   */
  startAutoSync(hotelId: string): void {
    const intervalKey = `auto-${hotelId}`;
    if (this.syncIntervals.has(intervalKey)) {
      logger.warn('Auto sync already running for hotel', { hotelId });
      return;
    }

    const intervalMs = config.sync.inventoryIntervalMinutes * 60 * 1000;

    const runSync = async () => {
      const channels = await ChannelConfig.find({
        propertyId: hotelId,
        isActive: true
      });

      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 90);

      for (const channel of channels) {
        try {
          await this.syncToChannel(
            hotelId,
            channel.channelId,
            today.toISOString().split('T')[0],
            futureDate.toISOString().split('T')[0]
          );
        } catch (error: any) {
          logger.error('Auto sync failed for channel', {
            hotelId,
            channelId: channel.channelId,
            error: error.message
          });
        }
      }
    };

    // Run immediately, then on interval
    runSync();
    const interval = setInterval(runSync, intervalMs);
    this.syncIntervals.set(intervalKey, interval);

    logger.info('Started auto sync for hotel', {
      hotelId,
      intervalMinutes: config.sync.inventoryIntervalMinutes
    });
  }

  /**
   * Stop automatic sync for a hotel
   */
  stopAutoSync(hotelId: string): void {
    const intervalKey = `auto-${hotelId}`;
    const interval = this.syncIntervals.get(intervalKey);

    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(intervalKey);
      logger.info('Stopped auto sync for hotel', { hotelId });
    }
  }

  /**
   * Get sync status for a hotel
   */
  async getSyncStatus(hotelId: string): Promise<{
    lastSync: Date | null;
    pendingUpdates: number;
    failedUpdates: number;
    channels: Array<{
      channelId: string;
      status: string;
      lastSync: Date | null;
    }>;
  }> {
    const channels = await ChannelConfig.find({ propertyId: hotelId });
    const lastJob = await SyncJob.findOne({
      hotelId,
      syncType: 'inventory'
    }).sort({ startTime: -1 });

    const pendingUpdates = await Inventory.countDocuments({
      hotelId,
      'channelSyncStatus.pending': { $exists: true }
    });

    const failedUpdates = await Inventory.countDocuments({
      hotelId,
      'channelSyncStatus.failed': { $exists: true }
    });

    return {
      lastSync: lastJob?.startTime || null,
      pendingUpdates,
      failedUpdates,
      channels: channels.map(ch => ({
        channelId: ch.channelId,
        status: ch.isActive ? 'active' : 'inactive',
        lastSync: ch.lastSyncAt || null
      }))
    };
  }
}

export const inventorySyncService = new InventorySyncService();
export default inventorySyncService;
