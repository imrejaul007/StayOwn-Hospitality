import cron from 'node-cron';
import dynamicPricingService from '../services/dynamicPricingService.js';
import revenueManagementService from '../services/revenueManagementService.js';
import PricingStrategy from '../models/PricingStrategy.js';
import DemandForecast from '../models/DemandForecast.js';
import RoomType from '../models/RoomType.js';
import logger from '../utils/logger.js';

/**
 * Pricing Automation Scheduler
 * Handles automated pricing updates, forecasting, and revenue optimization
 */
class PricingScheduler {
  
  constructor() {
    this.isRunning = false;
    this.scheduledJobs = new Map();
  }

  /**
   * Start all pricing-related scheduled jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn('Pricing scheduler is already running');
      return;
    }

    try {
      logger.info('🤖 Starting pricing automation scheduler...');

      // Schedule dynamic pricing updates (every 2 hours)
      const dynamicPricingJob = cron.schedule('0 */2 * * *', async () => {
        await this.runDynamicPricingUpdate();
      }, {
        scheduled: false,
        name: 'dynamic-pricing-update'
      });

      // Schedule demand forecasting (daily at 3 AM)
      const forecastingJob = cron.schedule('0 3 * * *', async () => {
        await this.generateDailyForecasts();
      }, {
        scheduled: false,
        name: 'demand-forecasting'
      });

      // Schedule revenue KPI calculation (daily at 2 AM)
      const revenueKpiJob = cron.schedule('0 2 * * *', async () => {
        await this.calculateDailyRevenue();
      }, {
        scheduled: false,
        name: 'revenue-kpi-calculation'
      });

      // Schedule competitor rate monitoring (every 6 hours)
      const competitorJob = cron.schedule('0 */6 * * *', async () => {
        await this.updateCompetitorRates();
      }, {
        scheduled: false,
        name: 'competitor-monitoring'
      });

      // Schedule pricing strategy evaluation (daily at 1 AM)
      const strategyEvalJob = cron.schedule('0 1 * * *', async () => {
        await this.evaluatePricingStrategies();
      }, {
        scheduled: false,
        name: 'strategy-evaluation'
      });

      // Start all jobs
      dynamicPricingJob.start();
      forecastingJob.start();
      revenueKpiJob.start();
      competitorJob.start();
      strategyEvalJob.start();

      // Store jobs for management
      this.scheduledJobs.set('dynamic-pricing', dynamicPricingJob);
      this.scheduledJobs.set('forecasting', forecastingJob);
      this.scheduledJobs.set('revenue-kpi', revenueKpiJob);
      this.scheduledJobs.set('competitor-monitoring', competitorJob);
      this.scheduledJobs.set('strategy-evaluation', strategyEvalJob);

      this.isRunning = true;
      logger.info('✅ Pricing scheduler started successfully');

      // Log next execution times
      this.logNextExecutions();

    } catch (error) {
      logger.error('Failed to start pricing scheduler:', error);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Pricing scheduler is not running');
      return;
    }

    try {
      logger.info('🛑 Stopping pricing scheduler...');

      for (const [name, job] of this.scheduledJobs) {
        job.stop();
        logger.info(`Stopped job: ${name}`);
      }

      this.scheduledJobs.clear();
      this.isRunning = false;

      logger.info('✅ Pricing scheduler stopped successfully');

    } catch (error) {
      logger.error('Error stopping pricing scheduler:', error);
    }
  }

  /**
   * Run dynamic pricing updates for all hotels
   */
  async runDynamicPricingUpdate() {
    try {
      logger.info('🎯 Running automated dynamic pricing update...');

      // Get all hotels with active pricing strategies
      const activeStrategies = await PricingStrategy.distinct('hotelId', {
        isActive: true,
        'dynamicPricing.enabled': true
      });

      if (activeStrategies.length === 0) {
        logger.info('No hotels with active dynamic pricing found');
        return;
      }

      const results = [];

      for (const hotelId of activeStrategies) {
        try {
          logger.info(`Processing dynamic pricing for hotel ${hotelId}`);

          const result = await dynamicPricingService.runAutomatedPricing(hotelId, {
            daysAhead: 7, // Focus on next 7 days for frequent updates
            autoApply: true, // Auto-apply high-confidence changes
            minRecommendationScore: 75 // Higher threshold for auto-application
          });

          results.push({
            hotelId,
            success: result.success,
            appliedChanges: result.summary?.appliedChanges || 0,
            revenueImpact: result.summary?.totalRevenueImpact || 0
          });

          if (result.success) {
            logger.info(`✅ Hotel ${hotelId}: Applied ${result.summary?.appliedChanges || 0} pricing changes`);
          } else {
            logger.warn(`⚠️ Hotel ${hotelId}: Pricing update failed - ${result.error}`);
          }

        } catch (hotelError) {
          logger.error(`Error processing hotel ${hotelId}:`, hotelError);
          results.push({
            hotelId,
            success: false,
            error: hotelError.message
          });
        }
      }

      const totalChanges = results.reduce((sum, r) => sum + (r.appliedChanges || 0), 0);
      const totalRevenue = results.reduce((sum, r) => sum + (r.revenueImpact || 0), 0);

      logger.info(`🎉 Dynamic pricing update completed: ${totalChanges} changes applied, ₹${Math.round(totalRevenue)} revenue impact`);

    } catch (error) {
      logger.error('Error in dynamic pricing update:', error);
    }
  }

  /**
   * Generate daily demand forecasts
   */
  async generateDailyForecasts() {
    try {
      logger.info('🔮 Generating daily demand forecasts...');

      // Get all active room types
      const roomTypes = await RoomType.find({ isActive: true }).lean().limit(1000);
      const hotelIds = [...new Set(roomTypes.map(rt => rt.hotelId.toString()))];

      let totalForecasts = 0;

      for (const hotelId of hotelIds) {
        try {
          const hotelRoomTypes = roomTypes.filter(rt => rt.hotelId.toString() === hotelId);

          // Generate forecasts for next 30 days
          const forecastDates = [];
          for (let i = 1; i <= 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            forecastDates.push(date);
          }

          // Batch: check existing forecasts for all roomType+date combos in a single query
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const existingForecasts = await DemandForecast.find({
            hotelId,
            roomTypeId: { $in: hotelRoomTypes.map(rt => rt._id) },
            date: { $in: forecastDates },
            createdAt: { $gte: todayStart }
          }).select('roomTypeId date').lean();

          const existingSet = new Set(existingForecasts.map(f =>
            f.roomTypeId.toString() + '_' + f.date.toISOString()
          ));

          for (const roomType of hotelRoomTypes) {
            for (const date of forecastDates) {
              try {
                const key = roomType._id.toString() + '_' + date.toISOString();
                if (!existingSet.has(key)) {
                  await DemandForecast.generateForecast(hotelId, roomType._id, date);
                  totalForecasts++;
                }
              } catch (forecastError) {
                logger.error(`Error generating forecast for ${roomType.name} on ${date}:`, forecastError);
              }
            }
          }

        } catch (hotelError) {
          logger.error(`Error generating forecasts for hotel ${hotelId}:`, hotelError);
        }
      }

      logger.info(`✅ Generated ${totalForecasts} new demand forecasts`);

    } catch (error) {
      logger.error('Error generating daily forecasts:', error);
    }
  }

  /**
   * Calculate daily revenue KPIs
   */
  async calculateDailyRevenue() {
    try {
      logger.info('📊 Calculating daily revenue KPIs...');

      // Get all unique hotel IDs
      const roomTypes = await RoomType.distinct('hotelId', { isActive: true });

      for (const hotelId of roomTypes) {
        try {
          // Calculate KPIs for yesterday
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);

          const endDate = new Date(yesterday);
          endDate.setHours(23, 59, 59, 999);

          await revenueManagementService.calculateRevenueKPIs(
            hotelId,
            yesterday,
            endDate,
            { skipCache: true }
          );

          logger.info(`✅ Calculated KPIs for hotel ${hotelId}`);

        } catch (hotelError) {
          logger.error(`Error calculating KPIs for hotel ${hotelId}:`, hotelError);
        }
      }

      logger.info('✅ Daily revenue KPI calculation completed');

    } catch (error) {
      logger.error('Error in daily revenue calculation:', error);
    }
  }

  /**
   * Update competitor rates (placeholder for now)
   */
  async updateCompetitorRates() {
    try {
      logger.info('🕵️ Updating competitor rates...');

      // This would integrate with competitor monitoring service
      // For now, we'll just log that it's scheduled
      
      logger.info('📊 Competitor rate monitoring scheduled (integration needed)');

    } catch (error) {
      logger.error('Error updating competitor rates:', error);
    }
  }

  /**
   * Evaluate pricing strategy performance
   */
  async evaluatePricingStrategies() {
    try {
      logger.info('📈 Evaluating pricing strategy performance...');

      const strategies = await PricingStrategy.find({ isActive: true }).lean().limit(1000);
      let evaluatedStrategies = 0;

      // Process strategies and collect updates for bulkWrite
      const bulkOps = [];
      for (const strategy of strategies) {
        try {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          const kpis = await revenueManagementService.calculateRevenueKPIs(
            strategy.hotelId,
            new Date(yesterday.setDate(yesterday.getDate() - 30)),
            yesterday
          );

          if (kpis.success) {
            bulkOps.push({
              updateOne: {
                filter: { _id: strategy._id },
                update: {
                  $set: {
                    'performance.totalRevenue': kpis.kpis.totalRevenue,
                    'performance.averageRate': kpis.kpis.adr,
                    'performance.occupancyRate': kpis.kpis.occupancyRate,
                    'performance.revPAR': kpis.kpis.revPAR,
                    'performance.lastCalculated': new Date()
                  }
                }
              }
            });
            evaluatedStrategies++;
          }

        } catch (strategyError) {
          logger.error(`Error evaluating strategy ${strategy.name}:`, strategyError);
        }
      }

      // Batch: apply all strategy updates with bulkWrite
      if (bulkOps.length > 0) {
        await PricingStrategy.bulkWrite(bulkOps);
      }

      logger.info(`✅ Evaluated ${evaluatedStrategies} pricing strategies`);

    } catch (error) {
      logger.error('Error evaluating pricing strategies:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    const jobStatuses = {};
    
    for (const [name, job] of this.scheduledJobs) {
      jobStatuses[name] = {
        running: job.running,
        lastExecution: job.lastExecution,
        nextExecution: job.nextExecution
      };
    }

    return {
      isRunning: this.isRunning,
      totalJobs: this.scheduledJobs.size,
      jobs: jobStatuses
    };
  }

  /**
   * Run specific job manually
   */
  async runJob(jobName) {
    try {
      logger.info(`🎯 Manually executing job: ${jobName}`);

      switch (jobName) {
        case 'dynamic-pricing':
          await this.runDynamicPricingUpdate();
          break;
        case 'forecasting':
          await this.generateDailyForecasts();
          break;
        case 'revenue-kpi':
          await this.calculateDailyRevenue();
          break;
        case 'competitor-monitoring':
          await this.updateCompetitorRates();
          break;
        case 'strategy-evaluation':
          await this.evaluatePricingStrategies();
          break;
        default:
          throw new Error(`Unknown job: ${jobName}`);
      }

      logger.info(`✅ Job ${jobName} completed successfully`);
      return { success: true };

    } catch (error) {
      logger.error(`Error running job ${jobName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log next execution times for all jobs
   */
  logNextExecutions() {
    logger.info('📅 Scheduled job execution times:');
    
    for (const [name, job] of this.scheduledJobs) {
      if (job.nextExecution) {
        logger.info(`  ${name}: ${job.nextExecution()}`);
      }
    }
  }
}

// Create singleton instance
const pricingScheduler = new PricingScheduler();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Start scheduler after a short delay to ensure database connection
  setTimeout(() => {
    pricingScheduler.start();
  }, 5000);
}

export default pricingScheduler;