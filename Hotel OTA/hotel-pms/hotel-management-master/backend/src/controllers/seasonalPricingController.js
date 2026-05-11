import seasonalPricingService from '../services/seasonalPricingService.js';
import Season from '../models/Season.js';
import SpecialPeriod from '../models/SpecialPeriod.js';

class SeasonalPricingController {
  /**
   * Get seasonal adjustment for a specific date and room type
   */
  async getSeasonalAdjustment(req, res) {
    try {
      const { roomType, date, ratePlanId } = req.query;
      const hotelId = req.user?.hotelId;

      if (!roomType || !date) {
        return res.status(400).json({
          success: false,
          message: 'Room type and date are required'
        });
      }

      const adjustment = await seasonalPricingService.calculateSeasonalAdjustment(
        hotelId,
        roomType,
        date,
        ratePlanId
      );

      res.json({
        success: true,
        data: adjustment
      });

    } catch (error) {
      console.error('Error getting seasonal adjustment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get seasonal adjustment'
      });
    }
  }

  /**
   * Check if booking is allowed for date range
   */
  async checkBookingAvailability(req, res) {
    try {
      const { arrivalDate, departureDate, roomType } = req.query;
      const hotelId = req.user?.hotelId;

      if (!arrivalDate || !departureDate || !roomType) {
        return res.status(400).json({
          success: false,
          message: 'Arrival date, departure date, and room type are required'
        });
      }

      const availability = await seasonalPricingService.isBookingAllowed(
        hotelId,
        arrivalDate,
        departureDate,
        roomType
      );

      res.json({
        success: true,
        data: availability
      });

    } catch (error) {
      console.error('Error checking booking availability:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check booking availability'
      });
    }
  }

  /**
   * Get pricing calendar for a date range
   */
  async getPricingCalendar(req, res) {
    try {
      const { startDate, endDate, roomType = 'all' } = req.query;
      const hotelId = req.user?.hotelId;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      // Limit date range to 90 days to prevent N+1 performance issues
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        return res.status(400).json({
          success: false,
          message: 'Date range cannot exceed 90 days'
        });
      }

      const calendar = await seasonalPricingService.getPricingCalendar(
        hotelId,
        startDate,
        endDate,
        roomType
      );

      res.json({
        success: true,
        data: calendar
      });

    } catch (error) {
      console.error('Error getting pricing calendar:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pricing calendar'
      });
    }
  }

  /**
   * Create a new season
   */
  async createSeason(req, res) {
    try {
      const hotelId = req.user?.hotelId;
      const { name, description, type, startDate, endDate, isRecurring, recurringPattern,
              rateAdjustments, applicableRatePlans, restrictions, bookingWindow,
              priority, tags, color } = req.body;

      const seasonData = {
        hotelId,
        name, description, type, startDate, endDate, isRecurring, recurringPattern,
        rateAdjustments, applicableRatePlans, restrictions, bookingWindow,
        priority, tags, color,
        createdBy: req.user?.id
      };

      const season = await seasonalPricingService.createSeason(seasonData);

      res.status(201).json({
        success: true,
        data: season,
        message: 'Season created successfully'
      });

    } catch (error) {
      console.error('Error creating season:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create season'
      });
    }
  }

  /**
   * Get all seasons
   */
  async getSeasons(req, res) {
    try {
      const { type, isActive, year, page = 1, limit = 20 } = req.query;
      const hotelId = req.user?.hotelId;
      const filter = { hotelId };

      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      if (year) {
        const parsedYear = parseInt(year);
        if (isNaN(parsedYear)) {
          return res.status(400).json({ success: false, message: 'Invalid year parameter' });
        }
        const startOfYear = new Date(parsedYear, 0, 1);
        const endOfYear = new Date(parsedYear, 11, 31);
        filter.$or = [
          { startDate: { $gte: startOfYear, $lte: endOfYear } },
          { endDate: { $gte: startOfYear, $lte: endOfYear } },
          { startDate: { $lte: startOfYear }, endDate: { $gte: endOfYear } }
        ];
      }

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [seasons, totalCount] = await Promise.all([
        Season.find(filter)
          .populate('createdBy', 'firstName lastName')
          .populate('updatedBy', 'firstName lastName')
          .sort({ startDate: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Season.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: seasons,
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      });

    } catch (error) {
      console.error('Error getting seasons:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get seasons'
      });
    }
  }

  /**
   * Get a specific season by ID
   */
  async getSeasonById(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user?.hotelId;

      const season = await Season.findOne({ _id: id, hotelId })
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName').lean();

      if (!season) {
        return res.status(404).json({
          success: false,
          message: 'Season not found'
        });
      }

      res.json({
        success: true,
        data: season
      });

    } catch (error) {
      console.error('Error getting season:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get season'
      });
    }
  }

  /**
   * Update a season
   */
  async updateSeason(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user?.hotelId;
      const { name, description, type, startDate, endDate, isRecurring, recurringPattern,
              rateAdjustments, applicableRatePlans, restrictions, bookingWindow,
              priority, tags, color, isActive } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
      if (recurringPattern !== undefined) updateData.recurringPattern = recurringPattern;
      if (rateAdjustments !== undefined) updateData.rateAdjustments = rateAdjustments;
      if (applicableRatePlans !== undefined) updateData.applicableRatePlans = applicableRatePlans;
      if (restrictions !== undefined) updateData.restrictions = restrictions;
      if (bookingWindow !== undefined) updateData.bookingWindow = bookingWindow;
      if (priority !== undefined) updateData.priority = priority;
      if (tags !== undefined) updateData.tags = tags;
      if (color !== undefined) updateData.color = color;
      if (isActive !== undefined) updateData.isActive = isActive;
      updateData.updatedBy = req.user?.id;

      // Validate date range on update (fetch existing to compare partial updates)
      if (updateData.startDate || updateData.endDate) {
        const existing = await Season.findOne({ _id: id, hotelId }).lean();
        if (!existing) {
          return res.status(404).json({ success: false, message: 'Season not found' });
        }
        const effectiveStart = new Date(updateData.startDate || existing.startDate);
        const effectiveEnd = new Date(updateData.endDate || existing.endDate);
        if (effectiveEnd <= effectiveStart) {
          return res.status(400).json({ success: false, message: 'End date must be after start date' });
        }
      }

      const season = await Season.findOneAndUpdate(
        { _id: id, hotelId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!season) {
        return res.status(404).json({
          success: false,
          message: 'Season not found'
        });
      }

      res.json({
        success: true,
        data: season,
        message: 'Season updated successfully'
      });

    } catch (error) {
      console.error('Error updating season:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update season'
      });
    }
  }

  /**
   * Delete a season (soft delete)
   */
  async deleteSeason(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user?.hotelId;

      const season = await Season.findOneAndUpdate(
        { _id: id, hotelId },
        { isActive: false, updatedBy: req.user?.id },
        { new: true }
      );

      if (!season) {
        return res.status(404).json({
          success: false,
          message: 'Season not found'
        });
      }

      res.json({
        success: true,
        message: 'Season deactivated successfully'
      });

    } catch (error) {
      console.error('Error deleting season:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete season'
      });
    }
  }

  /**
   * Create a new special period
   */
  async createSpecialPeriod(req, res) {
    try {
      const hotelId = req.user?.hotelId;
      const { name, description, type, startDate, endDate, isRecurring, recurringPattern,
              rateOverrides, restrictions, applicableRatePlans, eventDetails,
              demand, priority, tags, color, alerts } = req.body;

      const periodData = {
        hotelId,
        name, description, type, startDate, endDate, isRecurring, recurringPattern,
        rateOverrides, restrictions, applicableRatePlans, eventDetails,
        demand, priority, tags, color, alerts,
        createdBy: req.user?.id
      };

      const period = await seasonalPricingService.createSpecialPeriod(periodData);

      res.status(201).json({
        success: true,
        data: period,
        message: 'Special period created successfully'
      });

    } catch (error) {
      console.error('Error creating special period:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create special period'
      });
    }
  }

  /**
   * Get all special periods
   */
  async getSpecialPeriods(req, res) {
    try {
      const { type, isActive, year, page = 1, limit = 20 } = req.query;
      const hotelId = req.user?.hotelId;
      const filter = { hotelId };

      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      if (year) {
        const parsedYear = parseInt(year);
        if (isNaN(parsedYear)) {
          return res.status(400).json({ success: false, message: 'Invalid year parameter' });
        }
        const startOfYear = new Date(parsedYear, 0, 1);
        const endOfYear = new Date(parsedYear, 11, 31);
        filter.$or = [
          { startDate: { $gte: startOfYear, $lte: endOfYear } },
          { endDate: { $gte: startOfYear, $lte: endOfYear } },
          { startDate: { $lte: startOfYear }, endDate: { $gte: endOfYear } }
        ];
      }

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [periods, totalCount] = await Promise.all([
        SpecialPeriod.find(filter)
          .populate('createdBy', 'firstName lastName')
          .populate('updatedBy', 'firstName lastName')
          .sort({ startDate: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SpecialPeriod.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: periods,
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      });

    } catch (error) {
      console.error('Error getting special periods:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get special periods'
      });
    }
  }

  /**
   * Get a specific special period by ID
   */
  async getSpecialPeriodById(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user?.hotelId;

      const period = await SpecialPeriod.findOne({ _id: id, hotelId })
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName').lean();

      if (!period) {
        return res.status(404).json({
          success: false,
          message: 'Special period not found'
        });
      }

      res.json({
        success: true,
        data: period
      });

    } catch (error) {
      console.error('Error getting special period:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get special period'
      });
    }
  }

  /**
   * Update a special period
   */
  async updateSpecialPeriod(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user?.hotelId;
      const { name, description, type, startDate, endDate, isRecurring, recurringPattern,
              rateOverrides, restrictions, applicableRatePlans, eventDetails,
              demand, priority, tags, color, alerts, isActive } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
      if (recurringPattern !== undefined) updateData.recurringPattern = recurringPattern;
      if (rateOverrides !== undefined) updateData.rateOverrides = rateOverrides;
      if (restrictions !== undefined) updateData.restrictions = restrictions;
      if (applicableRatePlans !== undefined) updateData.applicableRatePlans = applicableRatePlans;
      if (eventDetails !== undefined) updateData.eventDetails = eventDetails;
      if (demand !== undefined) updateData.demand = demand;
      if (priority !== undefined) updateData.priority = priority;
      if (tags !== undefined) updateData.tags = tags;
      if (color !== undefined) updateData.color = color;
      if (alerts !== undefined) updateData.alerts = alerts;
      if (isActive !== undefined) updateData.isActive = isActive;
      updateData.updatedBy = req.user?.id;

      // Validate date range on update (fetch existing to compare partial updates)
      if (updateData.startDate || updateData.endDate) {
        const existing = await SpecialPeriod.findOne({ _id: id, hotelId }).lean();
        if (!existing) {
          return res.status(404).json({ success: false, message: 'Special period not found' });
        }
        const effectiveStart = new Date(updateData.startDate || existing.startDate);
        const effectiveEnd = new Date(updateData.endDate || existing.endDate);
        if (effectiveEnd < effectiveStart) {
          return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
        }
      }

      const period = await SpecialPeriod.findOneAndUpdate(
        { _id: id, hotelId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!period) {
        return res.status(404).json({
          success: false,
          message: 'Special period not found'
        });
      }

      res.json({
        success: true,
        data: period,
        message: 'Special period updated successfully'
      });

    } catch (error) {
      console.error('Error updating special period:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update special period'
      });
    }
  }

  /**
   * Delete a special period (soft delete)
   */
  async deleteSpecialPeriod(req, res) {
    try {
      const { id } = req.params;
      const hotelId = req.user?.hotelId;

      const period = await SpecialPeriod.findOneAndUpdate(
        { _id: id, hotelId },
        { isActive: false, updatedBy: req.user?.id },
        { new: true }
      );

      if (!period) {
        return res.status(404).json({
          success: false,
          message: 'Special period not found'
        });
      }

      res.json({
        success: true,
        message: 'Special period deactivated successfully'
      });

    } catch (error) {
      console.error('Error deleting special period:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete special period'
      });
    }
  }

  /**
   * Get seasons by date range
   */
  async getSeasonsByDateRange(req, res) {
    try {
      const { startDate, endDate, includeInactive = false } = req.query;
      const hotelId = req.user?.hotelId;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const seasons = await seasonalPricingService.getSeasonsByDateRange(
        hotelId,
        new Date(startDate),
        new Date(endDate),
        includeInactive === 'true'
      );

      res.json({
        success: true,
        data: seasons
      });

    } catch (error) {
      console.error('Error getting seasons by date range:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get seasons by date range'
      });
    }
  }

  /**
   * Get special periods by date range
   */
  async getSpecialPeriodsByDateRange(req, res) {
    try {
      const { startDate, endDate, includeInactive = false } = req.query;
      const hotelId = req.user?.hotelId;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const periods = await seasonalPricingService.getSpecialPeriodsByDateRange(
        hotelId,
        new Date(startDate),
        new Date(endDate),
        includeInactive === 'true'
      );

      res.json({
        success: true,
        data: periods
      });

    } catch (error) {
      console.error('Error getting special periods by date range:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get special periods by date range'
      });
    }
  }

  /**
   * Get seasonal analytics
   */
  async getSeasonalAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const hotelId = req.user?.hotelId;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const analytics = await seasonalPricingService.getSeasonalAnalytics(
        hotelId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error getting seasonal analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get seasonal analytics'
      });
    }
  }

  /**
   * Bulk create special periods
   */
  async bulkCreateSpecialPeriods(req, res) {
    try {
      const { periods } = req.body;
      const hotelId = req.user?.hotelId;

      if (!periods || !Array.isArray(periods)) {
        return res.status(400).json({
          success: false,
          message: 'Periods array is required'
        });
      }

      const results = [];

      for (const periodData of periods) {
        try {
          const period = await seasonalPricingService.createSpecialPeriod({
            ...periodData,
            hotelId,
            createdBy: req.user?.id
          });
          results.push({ success: true, data: period });
        } catch (error) {
          results.push({ success: false, error: 'Failed to create period', data: { name: periodData.name } });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Processed ${periods.length} special periods`
      });

    } catch (error) {
      console.error('Error bulk creating special periods:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk create special periods'
      });
    }
  }

  /**
   * Get upcoming special periods requiring alerts
   */
  async getUpcomingAlerts(req, res) {
    try {
      const { days = 30 } = req.query;
      const hotelId = req.user?.hotelId;

      const parsedDays = parseInt(days);
      if (isNaN(parsedDays) || parsedDays < 1) {
        return res.status(400).json({ success: false, message: 'Invalid days parameter' });
      }

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parsedDays);

      // Do NOT use .lean() here because we need the shouldTriggerAlert() instance method
      const alertFilter = {
        isActive: true,
        startDate: { $gte: new Date(), $lte: futureDate },
        'alerts.emailNotification': true
      };
      if (hotelId) alertFilter.hotelId = hotelId;

      const periods = await SpecialPeriod.find(alertFilter).sort({ startDate: 1 }).limit(100);

      const alerts = periods.filter(period => period.shouldTriggerAlert());

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      console.error('Error getting upcoming alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upcoming alerts'
      });
    }
  }
}

export default new SeasonalPricingController();
