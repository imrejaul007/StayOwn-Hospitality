import { v4 as uuidv4 } from 'uuid';
import {
  IPricingUpdate,
  PricingUpdateSchema,
  SyncStatus,
  RoomType,
  ChannelType,
  IRate
} from '../types/index.js';
import { Pricing, RoomMapping, ChannelConfig, SyncJob } from '../models/index.js';
import { channelManager } from './channelManager.js';
import { createModuleLogger } from '../utils/logger.js';
import { config } from '../config/index.js';

const logger = createModuleLogger('pricingSync');

export interface PricingSyncResult {
  jobId: string;
  hotelId: string;
  channelId: string;
  status: SyncStatus;
  itemsProcessed: number;
  itemsFailed: number;
  errors: Array<{ itemId: string; error: string }>;
  duration: number;
}

export interface RatePlan {
  ratePlanId: string;
  name: string;
  currency: string;
  baseRate: number;
  taxes: number;
  fees: number;
  totalRate: number;
  minLos: number;
  maxLos: number;
}

export class PricingSyncService {
  private isRunning: boolean = false;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Update pricing for a specific date
   */
  async updatePricing(update: IPricingUpdate): Promise<void> {
    const validated = PricingUpdateSchema.parse(update);

    const pricing = await Pricing.findOneAndUpdate(
      {
        hotelId: validated.hotelId,
        roomMappingId: validated.roomMappingId,
        date: new Date(validated.date)
      },
      {
        $set: {
          roomType: validated.roomType,
          rates: validated.rates,
          lastSyncedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Updated pricing', {
      hotelId: validated.hotelId,
      roomMappingId: validated.roomMappingId,
      date: validated.date,
      rateCount: validated.rates.length
    });

    // Mark as pending for channel sync
    const mappings = await RoomMapping.find({
      hotelId: validated.hotelId,
      syncPricing: true,
      isActive: true
    });

    for (const mapping of mappings) {
      await Pricing.updateOne(
        { _id: pricing._id },
        { $set: { [`channelSyncStatus.${mapping.channelId}`]: 'pending' } }
      );
    }
  }

  /**
   * Bulk update pricing
   */
  async bulkUpdatePricing(updates: IPricingUpdate[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const update of updates) {
      try {
        await this.updatePricing(update);
        success++;
      } catch (error: any) {
        failed++;
        errors.push(`${update.roomMappingId}: ${error.message}`);
        logger.error('Bulk pricing update failed', {
          roomMappingId: update.roomMappingId,
          error: error.message
        });
      }
    }

    return { success, failed, errors };
  }

  /**
   * Update rate plan for a room type across date range
   */
  async updateRatePlan(
    hotelId: string,
    roomMappingId: string,
    roomType: RoomType,
    startDate: string,
    endDate: string,
    ratePlan: RatePlan
  ): Promise<{ updated: number }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let updated = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      await Pricing.findOneAndUpdate(
        {
          hotelId,
          roomMappingId,
          date: new Date(dateStr)
        },
        {
          $set: {
            roomType,
            lastSyncedAt: new Date()
          },
          $push: {
            rates: {
              $each: [ratePlan],
              $position: 0
            }
          }
        },
        { upsert: true, new: true }
      );

      updated++;
    }

    logger.info('Updated rate plan', {
      hotelId,
      roomMappingId,
      startDate,
      endDate,
      ratePlanId: ratePlan.ratePlanId,
      updatedDates: updated
    });

    return { updated };
  }

  /**
   * Get pricing for a date range
   */
  async getPricing(
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

    const pricing = await Pricing.find(query).sort({ date: 1 });
    return pricing.map(p => ({
      hotelId: p.hotelId,
      roomMappingId: p.roomMappingId,
      roomType: p.roomType,
      date: p.date.toISOString().split('T')[0],
      rates: p.rates,
      lastSyncedAt: p.lastSyncedAt
    }));
  }

  /**
   * Get minimum rate for a room type across date range
   */
  async getMinimumRate(
    hotelId: string,
    roomType: RoomType,
    startDate: string,
    endDate: string
  ): Promise<{ minRate: number; currency: string } | null> {
    const pricing = await Pricing.find({
      hotelId,
      roomType,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    if (pricing.length === 0) {
      return null;
    }

    let minRate = Infinity;
    let currency = 'USD';

    for (const p of pricing) {
      for (const rate of p.rates) {
        if (rate.totalRate < minRate) {
          minRate = rate.totalRate;
          currency = rate.currency;
        }
      }
    }

    return { minRate: minRate === Infinity ? 0 : minRate, currency };
  }

  /**
   * Calculate total price for a stay
   */
  async calculateStayPrice(
    hotelId: string,
    roomMappingId: string,
    checkIn: string,
    checkOut: string,
    ratePlanId: string
  ): Promise<{
    totalNights: number;
    breakdown: Array<{ date: string; rate: number; currency: string }>;
    totalAmount: number;
    currency: string;
  }> {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    const pricing = await Pricing.find({
      hotelId,
      roomMappingId,
      date: {
        $gte: checkInDate,
        $lt: checkOutDate
      }
    }).sort({ date: 1 });

    const breakdown: Array<{ date: string; rate: number; currency: string }> = [];
    let totalAmount = 0;
    let currency = 'USD';

    for (const p of pricing) {
      const rate = p.rates.find(r => r.ratePlanId === ratePlanId);
      if (rate) {
        breakdown.push({
          date: p.date.toISOString().split('T')[0],
          rate: rate.totalRate,
          currency: rate.currency
        });
        totalAmount += rate.totalRate;
        currency = rate.currency;
      }
    }

    return {
      totalNights: nights,
      breakdown,
      totalAmount,
      currency
    };
  }

  /**
   * Sync pricing to a specific channel
   */
  async syncToChannel(
    hotelId: string,
    channelId: string,
    startDate: string,
    endDate: string
  ): Promise<PricingSyncResult> {
    const jobId = uuidv4();
    const startTime = Date.now();

    const syncJob = new SyncJob({
      jobId,
      hotelId,
      channelId,
      syncType: 'pricing',
      status: SyncStatus.IN_PROGRESS,
      startTime: new Date()
    });
    await syncJob.save();

    logger.info('Starting pricing sync to channel', { jobId, hotelId, channelId });

    const errors: Array<{ itemId: string; error: string }> = [];
    let itemsProcessed = 0;
    let itemsFailed = 0;

    try {
      const channel = await ChannelConfig.findOne({ channelId });
      if (!channel || !channel.isActive) {
        throw new Error(`Channel ${channelId} is not active`);
      }

      const mappings = await RoomMapping.find({
        hotelId,
        channelId,
        syncPricing: true,
        isActive: true
      });

      for (const mapping of mappings) {
        const pricing = await this.getPricing(
          hotelId,
          startDate,
          endDate,
          mapping.mappingId
        );

        const batchSize = config.sync.batchSize;
        for (let i = 0; i < pricing.length; i += batchSize) {
          const batch = pricing.slice(i, i + batchSize);

          try {
            await this.pushPricingToChannel(channel, mapping, batch);

            for (const item of batch) {
              await Pricing.updateOne(
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
            logger.error('Failed to sync pricing batch', {
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

      logger.info('Pricing sync completed', { jobId, itemsProcessed, itemsFailed, duration });

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
   * Push pricing to channel
   */
  private async pushPricingToChannel(channel: any, mapping: any, pricing: any[]): Promise<void> {
    const adapter = channelManager.getAdapter(channel.channelType as ChannelType);

    if (adapter) {
      await adapter.updatePricing(channel.propertyId, pricing);
    } else {
      const client = await channelManager.getChannelClient(channel.toObject());

      const payload = {
        property_id: channel.propertyId,
        room_id: mapping.channelRoomId,
        rates: pricing.flatMap(p =>
          p.rates.map((r: IRate) => ({
            date: p.date,
            rate_plan_id: r.ratePlanId,
            currency: r.currency,
            base_rate: r.baseRate,
            taxes: r.taxes,
            fees: r.fees,
            total_rate: r.totalRate,
            min_los: r.minLos,
            max_los: r.maxLos
          }))
        )
      };

      await client.post('/rates/update', payload);
    }
  }

  /**
   * Pull pricing from channel
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
      syncPricing: true,
      isActive: true
    });

    let imported = 0;
    const errors: string[] = [];

    for (const mapping of mappings) {
      try {
        const adapter = channelManager.getAdapter(channel.channelType as ChannelType);

        let channelPricing;
        if (adapter) {
          channelPricing = await adapter.getPricing(
            channel.propertyId,
            startDate,
            endDate
          );
        } else {
          const client = await channelManager.getChannelClient(channel.toObject());
          const response = await client.get(
            `/rates/${channel.propertyId}/${mapping.channelRoomId}`,
            { params: { start_date: startDate, end_date: endDate } }
          );
          channelPricing = response.data;
        }

        for (const price of channelPricing) {
          await this.updatePricing({
            hotelId,
            roomMappingId: mapping.mappingId,
            date: price.date,
            roomType: price.roomType,
            rates: price.rates
          });
          imported++;
        }
      } catch (error: any) {
        errors.push(`${mapping.mappingId}: ${error.message}`);
        logger.error('Failed to pull pricing from channel', {
          mappingId: mapping.mappingId,
          error: error.message
        });
      }
    }

    return { imported, errors };
  }

  /**
   * Start automatic pricing sync
   */
  startAutoSync(hotelId: string): void {
    const intervalKey = `pricing-${hotelId}`;
    if (this.syncIntervals.has(intervalKey)) {
      return;
    }

    const intervalMs = config.sync.pricingIntervalMinutes * 60 * 1000;

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
          logger.error('Auto pricing sync failed', {
            hotelId,
            channelId: channel.channelId,
            error: error.message
          });
        }
      }
    };

    runSync();
    const interval = setInterval(runSync, intervalMs);
    this.syncIntervals.set(intervalKey, interval);

    logger.info('Started auto pricing sync', {
      hotelId,
      intervalMinutes: config.sync.pricingIntervalMinutes
    });
  }

  /**
   * Stop automatic pricing sync
   */
  stopAutoSync(hotelId: string): void {
    const intervalKey = `pricing-${hotelId}`;
    const interval = this.syncIntervals.get(intervalKey);

    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(intervalKey);
      logger.info('Stopped auto pricing sync', { hotelId });
    }
  }

  /**
   * Get pricing sync status
   */
  async getSyncStatus(hotelId: string): Promise<{
    lastSync: Date | null;
    pendingUpdates: number;
    channels: Array<{ channelId: string; status: string; lastSync: Date | null }>;
  }> {
    const channels = await ChannelConfig.find({ propertyId: hotelId });
    const lastJob = await SyncJob.findOne({
      hotelId,
      syncType: 'pricing'
    }).sort({ startTime: -1 });

    const pendingUpdates = await Pricing.countDocuments({
      hotelId,
      'channelSyncStatus.pending': { $exists: true }
    });

    return {
      lastSync: lastJob?.startTime || null,
      pendingUpdates,
      channels: channels.map(ch => ({
        channelId: ch.channelId,
        status: ch.isActive ? 'active' : 'inactive',
        lastSync: ch.lastSyncAt || null
      }))
    };
  }
}

export const pricingSyncService = new PricingSyncService();
export default pricingSyncService;
