import {
  RatePlan,
  SeasonalRate,
  DynamicPricing,
  RateOverride,
  YieldManagement,
  Package
} from '../models/RateManagement.js';
import Room from '../models/Room.js';
import availabilityService from './availabilityService.js';
import seasonalPricingService from './seasonalPricingService.js';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import logger from '../utils/logger.js';

class RateManagementService {
  /**
   * Calculate the best available rate for a room
   */
  async calculateBestRate(roomType, checkIn, checkOut, guestCount = 1, promoCode = null) {
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      // Get all active rate plans
      const ratePlans = await this.getApplicableRatePlans(
        roomType,
        checkInDate,
        checkOutDate,
        promoCode
      );

      if (ratePlans.length === 0) {
        // Fallback to base rate
        const room = await Room.findOne({ type: roomType }).lean();
        return {
          rate: room?.baseRate || 0,
          planName: 'Standard Rate',
          totalAmount: (room?.baseRate || 0) * nights
        };
      }

      // Calculate rates for each plan
      const ratesWithAdjustments = [];
      
      for (const plan of ratePlans) {
        const baseRate = this.getBaseRateForRoomType(plan, roomType);
        
        // Apply seasonal adjustments using new seasonal pricing service
        const seasonalData = await seasonalPricingService.calculateSeasonalAdjustment(
          null,
          roomType,
          checkInDate,
          plan.planId
        );
        const seasonalAdjustment = seasonalData.totalAdjustment;
        
        // Apply dynamic pricing
        const dynamicAdjustment = await this.getDynamicPricingAdjustment(
          roomType,
          checkInDate,
          checkOutDate
        );
        
        // Apply length of stay discounts
        const losDiscount = this.getLengthOfStayDiscount(plan, nights);
        
        // Apply early bird or last minute discounts
        const bookingDiscount = this.getBookingWindowDiscount(plan, checkInDate);
        
        // Calculate final rate using Decimal.js for financial precision
        const base = new Decimal(baseRate);
        let finalRateDecimal = base
          .plus(base.mul(seasonalAdjustment).div(100))
          .plus(base.mul(dynamicAdjustment).div(100))
          .minus(base.mul(losDiscount).div(100))
          .minus(base.mul(bookingDiscount).div(100));

        // Check for rate overrides
        const override = await this.getRateOverride(roomType, checkInDate, plan.planId);
        if (override) {
          finalRateDecimal = new Decimal(override.overrideRate);
        }

        // Enforce rate guardrails if configured
        if (plan.rateGuardrails) {
          const guardrails = plan.rateGuardrails;
          if (guardrails.absoluteFloor && finalRateDecimal.lt(guardrails.absoluteFloor)) {
            finalRateDecimal = new Decimal(guardrails.absoluteFloor);
          }
          if (guardrails.absoluteCeiling && finalRateDecimal.gt(guardrails.absoluteCeiling)) {
            finalRateDecimal = new Decimal(guardrails.absoluteCeiling);
          }
        }

        const finalRate = finalRateDecimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

        ratesWithAdjustments.push({
          planId: plan.planId,
          planName: plan.name,
          planType: plan.type,
          baseRate,
          finalRate,
          totalAmount: finalRateDecimal.mul(nights).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
          nights,
          adjustments: {
            seasonal: seasonalAdjustment,
            seasonalDetails: seasonalData.appliedAdjustments,
            dynamic: dynamicAdjustment,
            lengthOfStay: losDiscount,
            bookingWindow: bookingDiscount
          },
          mealPlan: plan.mealPlan,
          cancellationPolicy: plan.cancellationPolicy
        });
      }
      
      // Sort by final rate and return the best
      ratesWithAdjustments.sort((a, b) => a.finalRate - b.finalRate);
      
      return ratesWithAdjustments[0] || null;
      
    } catch (error) {
      logger.error('Error calculating best rate', { roomType, error: error.message });
      throw error;
    }
  }

  /**
   * Check if booking is allowed based on seasonal restrictions
   */
  async checkSeasonalBookingRestrictions(arrivalDate, departureDate, roomType) {
    try {
      return await seasonalPricingService.isBookingAllowed(
        null,
        arrivalDate,
        departureDate,
        roomType
      );
    } catch (error) {
      logger.error('Error checking seasonal booking restrictions', { roomType, error: error.message });
      return { allowed: true, warning: 'Could not verify seasonal restrictions' };
    }
  }

  /**
   * Get all rates for display (for rate shopping)
   */
  async getAllAvailableRates(roomType, checkIn, checkOut, includeDetails = false) {
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      const ratePlans = await this.getApplicableRatePlans(
        roomType,
        checkInDate,
        checkOutDate
      );
      
      const availableRates = [];
      
      for (const plan of ratePlans) {
        const rateDetails = await this.calculateBestRate(
          roomType,
          checkIn,
          checkOut,
          1,
          plan.promoCode
        );
        
        if (rateDetails) {
          const rateInfo = {
            planId: plan.planId,
            planName: plan.name,
            planType: plan.type,
            rate: rateDetails.finalRate,
            totalAmount: rateDetails.totalAmount,
            mealPlan: plan.mealPlan,
            cancellationPolicy: plan.cancellationPolicy
          };
          
          if (includeDetails) {
            rateInfo.details = {
              description: plan.description,
              minNights: plan.stayRestrictions.minNights,
              maxNights: plan.stayRestrictions.maxNights,
              adjustments: rateDetails.adjustments
            };
          }
          
          availableRates.push(rateInfo);
        }
      }
      
      return availableRates.sort((a, b) => a.rate - b.rate);
      
    } catch (error) {
      logger.error('Error getting all available rates', { roomType, error: error.message });
      throw error;
    }
  }

  /**
   * Get applicable rate plans for given criteria
   */
  async getApplicableRatePlans(roomType, checkIn, checkOut, promoCode = null) {
    try {
      const dayOfWeek = checkIn.getDay();
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
    
      const query = {
        isActive: true,
        'baseRates.roomType': roomType,
        [`applicableDays.${dayName}`]: true,
        $or: [
          { 'validity.startDate': { $lte: checkIn }, 'validity.endDate': { $gte: checkOut } },
          { 'validity.startDate': null, 'validity.endDate': null }
        ]
      };
    
      if (promoCode) {
        query.$or = [
          { 'restrictions.requirePromoCode': false },
          { 'restrictions.promoCode': promoCode }
        ];
      } else {
        query['restrictions.requirePromoCode'] = false;
      }
    
      const plans = await RatePlan.find(query).sort({ priority: -1 }).lean().limit(1000);
    
      // Filter by booking window
      const now = new Date();
      const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);
      const daysUntilCheckIn = hoursUntilCheckIn / 24;
    
      return plans.filter(plan => {
        const minAdvance = plan.bookingWindow.minAdvanceBooking || 0;
        const maxAdvance = plan.bookingWindow.maxAdvanceBooking || 365;
      
        return hoursUntilCheckIn >= minAdvance && daysUntilCheckIn <= maxAdvance;
      });
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get base rate for specific room type from rate plan
   */
  getBaseRateForRoomType(ratePlan, roomType) {
    const rateConfig = ratePlan.baseRates.find(r => r.roomType === roomType);
    return rateConfig ? rateConfig.rate : 0;
  }

  /**
   * Get seasonal adjustment
   */
  async getSeasonalAdjustment(roomType, date, ratePlanId) {
    try {
      const seasonalRates = await SeasonalRate.find({
        isActive: true,
        startDate: { $lte: date },
        endDate: { $gte: date },
        $or: [
          { applicableRatePlans: ratePlanId },
          { applicableRatePlans: { $size: 0 } }
        ]
      }).sort({ priority: -1 }).lean().limit(1000);
    
      if (seasonalRates.length === 0) return 0;
    
      const adjustment = seasonalRates[0].rateAdjustments.find(
        adj => adj.roomType === roomType || !adj.roomType
      );
    
      if (!adjustment) return 0;
    
      return adjustment.adjustmentType === 'percentage' 
        ? adjustment.adjustmentValue 
        : 0; // Fixed adjustments handled separately
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get dynamic pricing adjustment
   */
  async getDynamicPricingAdjustment(roomType, checkIn, checkOut) {
    try {
      // Get current occupancy
      const occupancyData = await availabilityService.calculateOccupancyRate(
        checkIn,
        checkOut
      );
      
      // Get active dynamic pricing rules
      const rules = await DynamicPricing.find({
        isActive: true,
        $or: [
          { 'applicableRooms': roomType },
          { 'applicableRooms': 'all' }
        ]
      }).sort({ priority: -1 }).lean().limit(1000);
      
      let totalAdjustment = 0;
      
      for (const rule of rules) {
        // Occupancy-based adjustment
        if (rule.triggers.occupancyBased?.enabled) {
          const threshold = rule.triggers.occupancyBased.thresholds.find(
            t => occupancyData.occupancyRate >= t.minOccupancy && 
                 occupancyData.occupancyRate <= t.maxOccupancy
          );
          
          if (threshold) {
            totalAdjustment += threshold.priceAdjustment;
          }
        }
        
        // Add other trigger types as needed
      }
      
      // Apply constraints
      const constraints = rules[0]?.constraints;
      if (constraints?.maxDailyChange) {
        totalAdjustment = Math.min(
          Math.max(totalAdjustment, -constraints.maxDailyChange),
          constraints.maxDailyChange
        );
      }
      
      return totalAdjustment;
      
    } catch (error) {
      logger.error('Error getting dynamic pricing adjustment', { roomType, error: error.message });
      return 0;
    }
  }

  /**
   * Get length of stay discount
   */
  getLengthOfStayDiscount(ratePlan, nights) {
    if (!ratePlan.discounts?.lengthOfStay) return 0;
    
    const applicableDiscounts = ratePlan.discounts.lengthOfStay
      .filter(d => nights >= d.minNights)
      .sort((a, b) => b.minNights - a.minNights);
    
    return applicableDiscounts.length > 0 
      ? applicableDiscounts[0].discountPercentage 
      : 0;
  }

  /**
   * Get booking window discount (early bird or last minute)
   */
  getBookingWindowDiscount(ratePlan, checkInDate) {
    const now = new Date();
    const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);
    const daysUntilCheckIn = hoursUntilCheckIn / 24;
    
    // Early bird discount
    if (ratePlan.discounts?.earlyBird?.enabled) {
      if (daysUntilCheckIn >= ratePlan.discounts.earlyBird.daysInAdvance) {
        return ratePlan.discounts.earlyBird.discountPercentage;
      }
    }
    
    // Last minute discount
    if (ratePlan.discounts?.lastMinute?.enabled) {
      if (hoursUntilCheckIn <= ratePlan.discounts.lastMinute.hoursBeforeCheckIn) {
        return ratePlan.discounts.lastMinute.discountPercentage;
      }
    }
    
    return 0;
  }

  /**
   * Get rate override for specific date
   */
  async getRateOverride(roomType, date, ratePlanId = null) {
    try {
      const query = {
        roomType,
        date: {
          $gte: new Date(date.setHours(0, 0, 0, 0)),
          $lt: new Date(date.setHours(23, 59, 59, 999))
        },
        isActive: true
      };
    
      if (ratePlanId) {
        query.ratePlanId = ratePlanId;
      }
    
      return await RateOverride.findOne(query).lean();
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Create or update rate plan
   */
  async upsertRatePlan(ratePlanData) {
    try {
      if (!ratePlanData.planId) {
        ratePlanData.planId = uuidv4();
      }
      
      const ratePlan = await RatePlan.findOneAndUpdate(
        { planId: ratePlanData.planId },
        ratePlanData,
        { upsert: true, new: true, runValidators: true }
      );
      
      return ratePlan;
    } catch (error) {
      logger.error('Error upserting rate plan', { planId: ratePlanData?.planId, error: error.message });
      throw error;
    }
  }

  /**
   * Create seasonal rate
   */
  async createSeasonalRate(seasonalRateData) {
    try {
      seasonalRateData.seasonId = seasonalRateData.seasonId || uuidv4();
      
      const seasonalRate = new SeasonalRate(seasonalRateData);
      await seasonalRate.save();
      
      return seasonalRate;
    } catch (error) {
      logger.error('Error creating seasonal rate', { seasonId: seasonalRateData?.seasonId, error: error.message });
      throw error;
    }
  }

  /**
   * Override rate for specific date
   */
  async overrideRate(overrideData) {
    try {
      overrideData.overrideId = overrideData.overrideId || uuidv4();
      
      const override = await RateOverride.findOneAndUpdate(
        {
          date: overrideData.date,
          roomType: overrideData.roomType,
          ratePlanId: overrideData.ratePlanId
        },
        overrideData,
        { upsert: true, new: true, runValidators: true }
      );
      
      return override;
    } catch (error) {
      logger.error('Error overriding rate', { roomType: overrideData?.roomType, error: error.message });
      throw error;
    }
  }

  /**
   * Update yield management metrics
   */
  async updateYieldMetrics(date, roomType) {
    try {
      const occupancyData = await availabilityService.calculateOccupancyRate(
        date,
        new Date(date.getTime() + 24 * 60 * 60 * 1000)
      );
      
      const bestRate = await this.calculateBestRate(
        roomType,
        date,
        new Date(date.getTime() + 24 * 60 * 60 * 1000)
      );
      
      const metrics = {
        date,
        roomType,
        metrics: {
          occupancyRate: occupancyData.occupancyRate,
          averageDailyRate: bestRate?.finalRate || 0,
          revPAR: (occupancyData.occupancyRate / 100) * (bestRate?.finalRate || 0)
        },
        forecast: {
          expectedOccupancy: occupancyData.occupancyRate, // This should use ML in production
          recommendedRate: bestRate?.finalRate || 0
        },
        calculatedAt: new Date()
      };
      
      await YieldManagement.findOneAndUpdate(
        { date, roomType },
        metrics,
        { upsert: true, new: true }
      );
      
      return metrics;
    } catch (error) {
      logger.error('Error updating yield metrics', { roomType, error: error.message });
      throw error;
    }
  }

  /**
   * Get revenue forecast
   */
  async getRevenueForecast(startDate, endDate, roomType = null) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const forecast = [];
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const availability = await availabilityService.checkAvailability(
          date,
          new Date(date.getTime() + 24 * 60 * 60 * 1000),
          roomType
        );
        
        const roomTypes = roomType ? [roomType] : ['single', 'double', 'suite', 'deluxe'];
        let dailyRevenue = 0;
        
        for (const type of roomTypes) {
          const rate = await this.calculateBestRate(
            type,
            date,
            new Date(date.getTime() + 24 * 60 * 60 * 1000)
          );
          
          const roomsOfType = availability.rooms.filter(r => r.type === type).length;
          dailyRevenue += (rate?.finalRate || 0) * roomsOfType * 0.8; // Assume 80% occupancy
        }
        
        forecast.push({
          date: new Date(date),
          estimatedRevenue: dailyRevenue,
          availableRooms: availability.availableRooms
        });
      }
      
      return {
        startDate: start,
        endDate: end,
        forecast,
        totalEstimatedRevenue: forecast.reduce((sum, day) => sum + day.estimatedRevenue, 0)
      };
      
    } catch (error) {
      logger.error('Error getting revenue forecast', { error: error.message });
      throw error;
    }
  }
}

export default new RateManagementService();