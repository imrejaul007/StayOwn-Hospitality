import cron from 'node-cron';
import mongoose from 'mongoose';
import NotificationAutomationService from './notificationAutomationService.js';
import emailService from './emailService.js';
import logger from '../utils/logger.js';

/**
 * Notification Scheduler Service
 * Handles scheduled notifications and overdue detection
 */
class NotificationScheduler {

  static isInitialized = false;

  /**
   * Initialize all scheduled notification jobs
   */
  static initializeScheduledJobs() {
    if (this.isInitialized) {
      logger.debug('📅 Notification scheduler already initialized');
      return;
    }

    logger.debug('📅 Initializing notification scheduler...');

    // Every 30 minutes - Check for overdue daily checks
    cron.schedule('*/30 * * * *', () => {
      this.checkOverdueDailyRoutineChecks();
    });

    // Every hour - Check for overdue maintenance requests
    cron.schedule('0 * * * *', () => {
      this.checkOverdueMaintenanceRequests();
    });

    // Every hour - Check for overdue maintenance tasks
    cron.schedule('0 * * * *', () => {
      this.checkOverdueMaintenanceTasks();
    });

    // Every 2 hours - Check for overdue guest services
    cron.schedule('0 */2 * * *', () => {
      this.checkOverdueGuestServices();
    });

    // Every 4 hours - Check inventory levels during business hours
    cron.schedule('0 6-22/4 * * *', () => {
      this.checkInventoryLevels();
    });

    // Daily at 6 AM - Send daily operations summary
    cron.schedule('0 6 * * *', () => {
      this.sendDailyOperationsSummary();
    });

    // Daily at 8 PM - Send end-of-day summary
    cron.schedule('0 20 * * *', () => {
      this.sendEndOfDaySummary();
    });

    // Daily at 7 AM - Check for rooms due for deep cleaning
    cron.schedule('0 7 * * *', () => {
      this.checkDeepCleaningSchedule();
    });

    // Every 15 minutes during business hours - Send scheduled notifications
    cron.schedule('*/15 6-22 * * *', () => {
      this.processScheduledNotifications();
    });

    // Phase 6: Operational Intelligence Notifications
    // Every 2 hours during business hours - Check staff performance
    cron.schedule('0 8-20/2 * * *', () => {
      this.checkStaffPerformance();
    });

    // Every hour during business hours - Check revenue impact from out-of-order rooms
    cron.schedule('0 8-22 * * *', () => {
      this.checkRevenueImpact();
    });

    // Every 6 hours - Check guest satisfaction scores
    cron.schedule('0 */6 * * *', () => {
      this.checkGuestSatisfaction();
    });

    // Daily at 3 AM - Check equipment failure patterns
    cron.schedule('0 3 * * *', () => {
      this.checkEquipmentFailurePatterns();
    });

    // Daily at 9 AM - Send check-in reminders for tomorrow's arrivals
    cron.schedule('0 9 * * *', () => {
      this.sendCheckInReminders();
    });

    // Every 5 minutes - Expire stale pending reservations
    cron.schedule('*/5 * * * *', () => {
      this.expirePendingReservations();
    });

    this.isInitialized = true;
    logger.debug('✅ Notification scheduler initialized successfully');
  }

  /**
   * Check for overdue daily routine checks
   */
  static async checkOverdueDailyRoutineChecks() {
    try {
      logger.debug('🔍 Checking for overdue daily routine checks...');

      const DailyRoutineCheck = mongoose.model('DailyRoutineCheck');
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      // Find daily checks that are overdue (pending/in_progress for more than 2 hours)
      const overdueChecks = await DailyRoutineCheck.find({
        status: { $in: ['pending', 'in_progress'] },
        checkDate: { $lt: twoHoursAgo }, // Check date was more than 2 hours ago
        createdAt: { $lt: twoHoursAgo } // Created more than 2 hours ago
      }).populate('roomId', 'roomNumber').populate('hotelId', '_id').limit(1000).lean();

      logger.debug(`📋 Found ${overdueChecks.length} overdue daily checks`);

      // Batch update all overdue checks to 'overdue' status
      if (overdueChecks.length > 0) {
        const overdueCheckIds = overdueChecks.map(c => c._id);
        await DailyRoutineCheck.updateMany(
          { _id: { $in: overdueCheckIds } },
          { $set: { status: 'overdue' } }
        );

        // Send notifications in parallel
        const now = new Date();
        await Promise.all(overdueChecks.map(check => {
          const overdueHours = Math.floor((now - check.checkDate) / (1000 * 60 * 60));
          return NotificationAutomationService.triggerNotification(
            'daily_check_overdue',
            {
              roomNumber: check.roomId?.roomNumber || 'Unknown',
              checkId: check._id,
              assignedTo: check.checkedBy,
              overdueHours,
              checkDate: check.checkDate
            },
            'auto',
            'high',
            check.hotelId
          );
        }));
      }

    } catch (error) {
      logger.error('❌ Error checking overdue daily routine checks:', error);
    }
  }

  /**
   * Check for overdue maintenance requests
   */
  static async checkOverdueMaintenanceRequests() {
    try {
      logger.debug('🔍 Checking for overdue maintenance requests...');

      const MaintenanceRequest = mongoose.model('MaintenanceRequest');
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const urgentThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours for urgent

      // Find maintenance requests that are overdue
      const overdueMaintenanceRequests = await MaintenanceRequest.find({
        $or: [
          {
            status: { $in: ['pending', 'in_progress'] },
            priority: 'urgent',
            createdAt: { $lt: urgentThreshold }
          },
          {
            status: { $in: ['pending', 'in_progress'] },
            priority: { $ne: 'urgent' },
            createdAt: { $lt: oneDayAgo }
          },
          {
            status: { $in: ['pending', 'in_progress'] },
            scheduledDate: { $lt: new Date() } // Past scheduled date
          }
        ]
      }).populate('roomId', 'roomNumber').lean().limit(1000);

      logger.debug(`🔧 Found ${overdueMaintenanceRequests.length} overdue maintenance requests`);

      for (const request of overdueMaintenanceRequests) {
        const now = new Date();
        const overdueHours = Math.floor((now - request.createdAt) / (1000 * 60 * 60));

        await NotificationAutomationService.triggerNotification(
          'maintenance_overdue',
          {
            roomNumber: request.roomId?.roomNumber || 'Unknown',
            requestId: request._id,
            issueType: request.issueType,
            description: request.description,
            priority: request.priority,
            assignedTo: request.assignedTo,
            overdueHours,
            createdAt: request.createdAt
          },
          'auto',
          request.priority === 'urgent' ? 'urgent' : 'high',
          request.hotelId
        );
      }

    } catch (error) {
      logger.error('❌ Error checking overdue maintenance requests:', error);
    }
  }

  /**
   * Check for overdue maintenance tasks
   */
  static async checkOverdueMaintenanceTasks() {
    try {
      logger.debug('🔍 Checking for overdue maintenance tasks...');

      const MaintenanceTask = mongoose.model('MaintenanceTask');
      const now = new Date();

      // Find maintenance tasks that are overdue based on their dueDate
      const overdueTasks = await MaintenanceTask.find({
        dueDate: { $lt: now },
        status: { $in: ['pending', 'assigned', 'in_progress'] }
      }).populate('roomId', 'roomNumber').lean().limit(1000);

      logger.debug(`🔧 Found ${overdueTasks.length} overdue maintenance tasks`);

      for (const task of overdueTasks) {
        const overdueHours = Math.floor((now - task.dueDate) / (1000 * 60 * 60));
        let roomNumber = 'General';
        if (task.roomId && task.roomId.roomNumber) {
          roomNumber = task.roomId.roomNumber;
        }

        await NotificationAutomationService.triggerNotification(
          'maintenance_overdue',
          {
            roomNumber,
            taskId: task._id,
            issueType: task.type,
            description: task.description || task.title,
            priority: task.priority,
            assignedTo: task.assignedTo,
            overdueHours,
            dueDate: task.dueDate,
            category: task.category
          },
          'auto',
          task.priority === 'emergency' ? 'urgent' : 'high',
          task.hotelId
        );

        // Log overdue task for monitoring
        logger.debug(`⚠️ Task ${task.title} (${task.type}) is ${overdueHours}h overdue in ${roomNumber}`);
      }

    } catch (error) {
      logger.error('❌ Error checking overdue maintenance tasks:', error);
    }
  }

  /**
   * Check for overdue guest service requests
   */
  static async checkOverdueGuestServices() {
    try {
      logger.debug('🔍 Checking for overdue guest service requests...');

      const GuestService = mongoose.model('GuestService');
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const urgentThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes for urgent

      const overdueServices = await GuestService.find({
        $or: [
          {
            status: { $in: ['pending', 'assigned', 'in_progress'] },
            priority: { $in: ['urgent', 'now'] },
            createdAt: { $lt: urgentThreshold }
          },
          {
            status: { $in: ['pending', 'assigned'] },
            priority: { $nin: ['urgent', 'now'] },
            createdAt: { $lt: twoHoursAgo }
          }
        ]
      }).populate('bookingId', 'rooms').lean().limit(1000);

      logger.debug(`🛎️ Found ${overdueServices.length} overdue guest service requests`);

      for (const service of overdueServices) {
        // Get room number
        let roomNumber = 'Unknown';
        try {
          const booking = await mongoose.model('Booking').findById(service.bookingId).populate('rooms.roomId');
          if (booking && booking.rooms && booking.rooms[0]) {
            roomNumber = booking.rooms[0].roomId?.roomNumber || 'Unknown';
          }
        } catch (error) {
          logger.debug('Could not fetch room number for overdue service');
        }

        const now = new Date();
        const overdueMinutes = Math.floor((now - service.createdAt) / (1000 * 60));

        await NotificationAutomationService.triggerNotification(
          'guest_service_overdue',
          {
            roomNumber,
            serviceType: service.serviceType,
            serviceVariation: service.serviceVariation,
            requestId: service._id,
            assignedTo: service.assignedTo,
            overdueMinutes,
            priority: service.priority,
            createdAt: service.createdAt
          },
          'auto',
          service.priority === 'urgent' || service.priority === 'now' ? 'urgent' : 'high',
          service.hotelId
        );
      }

    } catch (error) {
      logger.error('❌ Error checking overdue guest service requests:', error);
    }
  }

  /**
   * Check inventory levels and send low stock alerts
   */
  static async checkInventoryLevels() {
    try {
      logger.debug('🔍 Checking inventory levels...');

      const InventoryItem = mongoose.model('InventoryItem');

      // Get all hotels to check their inventory
      const Hotel = mongoose.model('Hotel');
      const hotels = await Hotel.find({ isActive: true }).select('_id').lean().limit(1000);

      for (const hotel of hotels) {
        // Find items with low stock (using stockThreshold instead of reorderPoint)
        const lowStockItems = await InventoryItem.find({
          hotelId: hotel._id,
          $expr: { $lte: ['$currentStock', '$stockThreshold'] },
          currentStock: { $gt: 0 }, // Not completely out of stock
          isActive: true
        }).lean().limit(1000);

        // Find items that are out of stock
        const outOfStockItems = await InventoryItem.find({
          hotelId: hotel._id,
          currentStock: { $lte: 0 },
          isActive: true
        }).lean().limit(1000);

        // Find items that need reordering
        const reorderItems = await InventoryItem.find({
          hotelId: hotel._id,
          isActive: true,
          'reorderSettings.autoReorderEnabled': true,
          $expr: {
            $and: [
              { $ne: ['$reorderSettings.reorderPoint', null] },
              { $lte: ['$currentStock', '$reorderSettings.reorderPoint'] }
            ]
          }
        }).lean().limit(1000);

        logger.debug(`📦 Hotel ${hotel._id}: ${lowStockItems.length} low stock, ${outOfStockItems.length} out of stock, ${reorderItems.length} need reordering`);

        // Send low stock notifications (deduplicated - only if not in reorder list)
        for (const item of lowStockItems) {
          const needsReorder = reorderItems.some(r => r._id.toString() === item._id.toString());
          if (!needsReorder) {
            await NotificationAutomationService.triggerNotification(
              'inventory_low_stock',
              {
                itemName: item.name,
                category: item.category,
                currentStock: item.currentStock,
                stockThreshold: item.stockThreshold,
                itemId: item._id,
                supplier: item.supplier?.name || 'Unknown',
                estimatedCost: item.estimatedReorderCost || 0,
                daysUntilStockOut: item.reorderUrgency || 'Unknown'
              },
              'auto',
              item.currentStock <= (item.stockThreshold * 0.5) ? 'high' : 'medium',
              hotel._id
            );
          }
        }

        // Send out of stock notifications
        for (const item of outOfStockItems) {
          await NotificationAutomationService.triggerNotification(
            'inventory_out_of_stock',
            {
              itemName: item.name,
              category: item.category,
              itemId: item._id,
              lastKnownStock: item.stockThreshold || 0,
              supplier: item.supplier?.name || 'Unknown',
              urgentReorder: item.isUrgentReorder ? item.isUrgentReorder() : true
            },
            'auto',
            'urgent',
            hotel._id
          );
        }

        // Send reorder notifications
        for (const item of reorderItems) {
          const priority = item.isUrgentReorder ? item.isUrgentReorder() ? 'urgent' : 'high' : 'high';

          await NotificationAutomationService.triggerNotification(
            'inventory_reorder_needed',
            {
              itemName: item.name,
              category: item.category,
              currentStock: item.currentStock,
              reorderPoint: item.reorderSettings.reorderPoint,
              reorderQuantity: item.reorderSettings.reorderQuantity || 0,
              estimatedCost: item.estimatedReorderCost || 0,
              supplier: item.reorderSettings?.preferredSupplier?.name || item.supplier?.name || 'Unknown',
              supplierContact: item.reorderSettings?.preferredSupplier?.contact || item.supplier?.contact,
              leadTime: item.reorderSettings?.preferredSupplier?.leadTime || 'Unknown',
              itemId: item._id,
              urgent: item.isUrgentReorder ? item.isUrgentReorder() : false
            },
            'auto',
            priority,
            hotel._id
          );
        }
      }

    } catch (error) {
      logger.error('❌ Error checking inventory levels:', error);
    }
  }

  /**
   * Send daily operations summary
   */
  static async sendDailyOperationsSummary() {
    try {
      logger.debug('📊 Generating daily operations summary...');

      // Get all active hotels
      const Hotel = mongoose.model('Hotel');
      const hotels = await Hotel.find({ isActive: true }).select('_id name').lean().limit(1000);

      for (const hotel of hotels) {
        const summary = await this.generateDailyOperationsSummary(hotel._id);

        await NotificationAutomationService.triggerNotification(
          'daily_operations_summary',
          {
            hotelName: hotel.name,
            completedTasks: summary.completedTasks,
            pendingTasks: summary.pendingTasks,
            overdueItems: summary.overdueItems,
            maintenanceRequests: summary.maintenanceRequests,
            guestServices: summary.guestServices,
            roomsOutOfOrder: summary.roomsOutOfOrder,
            inventoryAlerts: summary.inventoryAlerts
          },
          'auto',
          'low',
          hotel._id
        );
      }

    } catch (error) {
      logger.error('❌ Error sending daily operations summary:', error);
    }
  }

  /**
   * Generate daily operations summary data
   */
  static async generateDailyOperationsSummary(hotelId) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    try {
      // Daily routine checks
      const DailyRoutineCheck = mongoose.model('DailyRoutineCheck');
      const completedChecks = await DailyRoutineCheck.countDocuments({
        hotelId,
        status: 'completed',
        checkDate: { $gte: startOfDay, $lte: endOfDay }
      });
      const pendingChecks = await DailyRoutineCheck.countDocuments({
        hotelId,
        status: { $in: ['pending', 'in_progress'] },
        checkDate: { $gte: startOfDay, $lte: endOfDay }
      });

      // Maintenance requests
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');
      const completedMaintenance = await MaintenanceRequest.countDocuments({
        hotelId,
        status: 'completed',
        completedDate: { $gte: startOfDay, $lte: endOfDay }
      });
      const pendingMaintenance = await MaintenanceRequest.countDocuments({
        hotelId,
        status: { $in: ['pending', 'in_progress'] }
      });

      // Guest services
      const GuestService = mongoose.model('GuestService');
      const completedServices = await GuestService.countDocuments({
        hotelId,
        status: 'completed',
        completedTime: { $gte: startOfDay, $lte: endOfDay }
      });
      const pendingServices = await GuestService.countDocuments({
        hotelId,
        status: { $in: ['pending', 'assigned', 'in_progress'] }
      });

      // Room status
      const Room = mongoose.model('Room');
      const roomsOutOfOrder = await Room.countDocuments({
        hotelId,
        status: 'out_of_order'
      });

      // Inventory alerts (items below reorder point)
      const InventoryItem = mongoose.model('InventoryItem');
      const inventoryAlerts = await InventoryItem.countDocuments({
        hotelId,
        $expr: { $lte: ['$currentStock', '$reorderPoint'] }
      });

      return {
        completedTasks: completedChecks + completedMaintenance + completedServices,
        pendingTasks: pendingChecks + pendingServices,
        overdueItems: 0, // This would need specific overdue logic
        maintenanceRequests: {
          completed: completedMaintenance,
          pending: pendingMaintenance
        },
        guestServices: {
          completed: completedServices,
          pending: pendingServices
        },
        roomsOutOfOrder,
        inventoryAlerts
      };

    } catch (error) {
      logger.error('Error generating daily summary:', error);
      return {
        completedTasks: 0,
        pendingTasks: 0,
        overdueItems: 0,
        maintenanceRequests: { completed: 0, pending: 0 },
        guestServices: { completed: 0, pending: 0 },
        roomsOutOfOrder: 0,
        inventoryAlerts: 0
      };
    }
  }

  /**
   * Send end-of-day summary
   */
  static async sendEndOfDaySummary() {
    try {
      logger.debug('🌅 Sending end-of-day summary...');

      const Hotel = mongoose.model('Hotel');
      const hotels = await Hotel.find({ isActive: true }).select('_id name').lean().limit(1000);

      for (const hotel of hotels) {
        const summary = await this.generateEndOfDaySummary(hotel._id);

        // Only send if there are notable items to report
        if (summary.totalIssues > 0) {
          await NotificationAutomationService.triggerNotification(
            'daily_operations_summary',
            {
              hotelName: hotel.name,
              type: 'end-of-day',
              pendingMaintenance: summary.pendingMaintenance,
              pendingServices: summary.pendingServices,
              roomsNeedingAttention: summary.roomsNeedingAttention,
              totalIssues: summary.totalIssues
            },
            'auto',
            'low',
            hotel._id
          );
        }
      }

    } catch (error) {
      logger.error('❌ Error sending end-of-day summary:', error);
    }
  }

  /**
   * Generate end-of-day summary data
   */
  static async generateEndOfDaySummary(hotelId) {
    try {
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');
      const GuestService = mongoose.model('GuestService');
      const Room = mongoose.model('Room');

      const pendingMaintenance = await MaintenanceRequest.countDocuments({
        hotelId,
        status: { $in: ['pending', 'in_progress'] }
      });

      const pendingServices = await GuestService.countDocuments({
        hotelId,
        status: { $in: ['pending', 'assigned', 'in_progress'] }
      });

      const roomsNeedingAttention = await Room.countDocuments({
        hotelId,
        status: { $in: ['dirty', 'maintenance', 'out_of_order'] }
      });

      return {
        pendingMaintenance,
        pendingServices,
        roomsNeedingAttention,
        totalIssues: pendingMaintenance + pendingServices + roomsNeedingAttention
      };

    } catch (error) {
      logger.error('Error generating end-of-day summary:', error);
      return {
        pendingMaintenance: 0,
        pendingServices: 0,
        roomsNeedingAttention: 0,
        totalIssues: 0
      };
    }
  }

  /**
   * Check for rooms due for deep cleaning
   */
  static async checkDeepCleaningSchedule() {
    try {
      logger.debug('🧽 Checking deep cleaning schedule...');

      const Room = mongoose.model('Room');
      const Housekeeping = mongoose.model('Housekeeping');
      const Hotel = mongoose.model('Hotel');

      // Define deep cleaning frequency (30 days default)
      const deepCleaningInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      const deepCleaningDueDate = new Date(Date.now() - deepCleaningInterval);

      // Find ALL rooms across all active hotels due for deep cleaning in a single query
      const roomsDueForDeepCleaning = await Room.find({
        hotelId: { $in: (await Hotel.find({ isActive: true }).select('_id').lean().limit(1000)).map(h => h._id) },
        isActive: true,
        $or: [
          { lastCleaned: { $lt: deepCleaningDueDate } },
          { lastCleaned: { $exists: false } }
        ]
      }).select('_id roomNumber hotelId lastCleaned').lean().limit(10000);

      if (roomsDueForDeepCleaning.length > 0) {
        // Batch check for existing deep cleaning tasks using $in
        const roomIds = roomsDueForDeepCleaning.map(r => r._id);
        const existingTasks = await Housekeeping.find({
          roomId: { $in: roomIds },
          taskType: 'deep_clean',
          status: { $in: ['pending', 'assigned', 'in_progress'] }
        }).select('roomId').limit(1000).lean();

        const roomsWithExistingTasks = new Set(existingTasks.map(t => t.roomId.toString()));

        // Send notifications in parallel only for rooms without existing tasks
        const notificationPromises = roomsDueForDeepCleaning
          .filter(room => !roomsWithExistingTasks.has(room._id.toString()))
          .map(room => {
            logger.debug(`🧽 Deep cleaning due notification sent for Room ${room.roomNumber}`);
            return NotificationAutomationService.triggerNotification(
              'deep_cleaning_due',
              {
                roomNumber: room.roomNumber,
                roomId: room._id,
                daysSinceLastCleaning: Math.floor((Date.now() - (room.lastCleaned || new Date(0))) / (24 * 60 * 60 * 1000)),
                recommendedAction: 'Schedule deep cleaning task'
              },
              'auto',
              'medium',
              room.hotelId
            );
          });

        await Promise.all(notificationPromises);
      }

    } catch (error) {
      logger.error('❌ Error checking deep cleaning schedule:', error);
    }
  }

  /**
   * Process scheduled notifications that are due
   */
  static async processScheduledNotifications() {
    try {
      const Notification = mongoose.model('Notification');

      // Find notifications scheduled for now or in the past
      const dueNotifications = await Notification.find({
        status: 'pending',
        scheduledFor: { $lte: new Date() }
      }).lean().limit(1000);

      logger.debug(`📬 Processing ${dueNotifications.length} scheduled notifications`);

      if (dueNotifications.length > 0) {
        // Batch update all due notifications to 'sent' status
        const dueIds = dueNotifications.map(n => n._id);
        await Notification.updateMany(
          { _id: { $in: dueIds } },
          { $set: { status: 'sent', sentAt: new Date() }, $unset: { scheduledFor: 1 } }
        );

        for (const notification of dueNotifications) {
          logger.debug(`📤 Sent scheduled notification: ${notification.title}`);
        }
      }

    } catch (error) {
      logger.error('❌ Error processing scheduled notifications:', error);
    }
  }

  // Phase 6: Operational Intelligence Notifications Methods

  /**
   * Check staff performance and send alerts for underperforming staff
   */
  static async checkStaffPerformance() {
    try {
      logger.debug('📊 Checking staff performance metrics...');

      const Hotel = mongoose.model('Hotel');
      const User = mongoose.model('User');
      const DailyRoutineCheck = mongoose.model('DailyRoutineCheck');
      const UserAnalytics = mongoose.model('UserAnalytics');

      const hotels = await Hotel.find({ isActive: true }).select('_id name').lean().limit(1000);
      const hotelIds = hotels.map(h => h._id);

      // Batch: get all relevant staff across all active hotels
      const staffMembers = await User.find({
        hotelId: { $in: hotelIds },
        role: { $in: ['staff', 'housekeeping', 'maintenance'] },
        isActive: true
      }).lean().limit(10000);

      if (staffMembers.length === 0) return;

      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staffIds = staffMembers.map(s => s._id);

      // Batch: aggregate task counts per staff member in a single query
      const [taskCounts, analyticsRecords] = await Promise.all([
        DailyRoutineCheck.aggregate([
          { $match: { checkedBy: { $in: staffIds }, createdAt: { $gte: last24Hours } } },
          { $group: {
            _id: '$checkedBy',
            assignedTasks: { $sum: 1 },
            completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
          }}
        ]),
        UserAnalytics.find({
          userId: { $in: staffIds },
          date: { $gte: last24Hours }
        }).lean()
      ]);

      const taskCountMap = new Map(taskCounts.map(tc => [tc._id.toString(), tc]));
      const analyticsMap = new Map(analyticsRecords.map(a => [a.userId.toString(), a]));
      const hotelMap = new Map(hotels.map(h => [h._id.toString(), h]));

      // Send notifications in parallel for underperforming staff
      const notificationPromises = [];
      for (const staff of staffMembers) {
        const tc = taskCountMap.get(staff._id.toString()) || { assignedTasks: 0, completedTasks: 0 };
        const analytics = analyticsMap.get(staff._id.toString());
        const completionRate = tc.assignedTasks > 0 ? (tc.completedTasks / tc.assignedTasks) * 100 : 100;
        const efficiencyScore = analytics?.performanceMetrics?.efficiencyScore || 75;

        if (tc.assignedTasks > 0 && (completionRate < 70 || efficiencyScore < 60)) {
          const priority = completionRate < 50 ? 'high' : 'medium';
          notificationPromises.push(
            NotificationAutomationService.triggerNotification(
              'staff_performance_alert',
              {
                staffName: `${staff.firstName} ${staff.lastName}`,
                staffId: staff._id,
                completionRate: Math.round(completionRate),
                efficiencyScore: Math.round(efficiencyScore),
                assignedTasks: tc.assignedTasks,
                completedTasks: tc.completedTasks,
                metric: completionRate < 70 ? 'Low task completion rate' : 'Low efficiency score',
                timeFrame: '24 hours',
                recommendations: this.generatePerformanceRecommendations(completionRate, efficiencyScore)
              },
              'auto',
              priority,
              staff.hotelId
            )
          );
        }
      }
      await Promise.all(notificationPromises);

    } catch (error) {
      logger.error('❌ Error checking staff performance:', error);
    }
  }

  /**
   * Check revenue impact from out-of-order rooms and operational issues
   */
  static async checkRevenueImpact() {
    try {
      logger.debug('💰 Checking revenue impact...');

      const Hotel = mongoose.model('Hotel');
      const Room = mongoose.model('Room');
      const RoomType = mongoose.model('RoomType');
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');

      const hotels = await Hotel.find({ isActive: true }).select('_id name').lean().limit(1000);
      const hotelIds = hotels.map(h => h._id);

      // Batch: get all out-of-order rooms and counts across all hotels in parallel
      const [outOfOrderRooms, roomCountsByHotel, maintenanceCounts] = await Promise.all([
        Room.find({ hotelId: { $in: hotelIds }, status: 'out_of_order' })
          .populate('roomTypeId', 'basePrice name').lean().limit(10000),
        Room.aggregate([
          { $match: { hotelId: { $in: hotelIds } } },
          { $group: { _id: '$hotelId', count: { $sum: 1 } } }
        ]),
        MaintenanceRequest.aggregate([
          { $match: { hotelId: { $in: hotelIds }, status: { $in: ['pending', 'in_progress'] }, priority: { $in: ['high', 'urgent'] } } },
          { $group: { _id: '$hotelId', count: { $sum: 1 } } }
        ])
      ]);

      const roomCountMap = new Map(roomCountsByHotel.map(r => [r._id.toString(), r.count]));
      const maintenanceCountMap = new Map(maintenanceCounts.map(m => [m._id.toString(), m.count]));
      const hotelMap = new Map(hotels.map(h => [h._id.toString(), h]));

      // Group out-of-order rooms by hotel
      const roomsByHotel = new Map();
      for (const room of outOfOrderRooms) {
        const hid = room.hotelId.toString();
        if (!roomsByHotel.has(hid)) roomsByHotel.set(hid, []);
        roomsByHotel.get(hid).push(room);
      }

      // Send notifications in parallel
      const notificationPromises = [];
      for (const [hotelIdStr, rooms] of roomsByHotel) {
        const hotel = hotelMap.get(hotelIdStr);
        if (!hotel) continue;

        let totalDailyRevenueLoss = 0;
        const roomDetails = rooms.map(room => {
          const dailyRate = room.roomTypeId?.basePrice || 100;
          totalDailyRevenueLoss += dailyRate;
          return {
            roomNumber: room.roomNumber,
            roomType: room.roomTypeId?.name || 'Standard',
            dailyRate,
            daysOutOfOrder: room.outOfOrderSince ?
              Math.floor((new Date() - new Date(room.outOfOrderSince)) / (1000 * 60 * 60 * 24)) : 1
          };
        });

        const maintenanceRequests = maintenanceCountMap.get(hotelIdStr) || 0;
        const totalRooms = roomCountMap.get(hotelIdStr) || 1;
        const priority = totalDailyRevenueLoss > 500 ? 'urgent' :
                        totalDailyRevenueLoss > 200 ? 'high' : 'medium';

        notificationPromises.push(NotificationAutomationService.triggerNotification(
          'revenue_impact_alert',
          {
            hotelName: hotel.name,
            outOfOrderRooms: rooms.length,
            dailyRevenueLoss: Math.round(totalDailyRevenueLoss),
            roomDetails,
            maintenanceRequests,
            totalRooms,
            impactPercentage: Math.round((rooms.length / totalRooms) * 100),
            urgentMaintenance: maintenanceRequests,
            estimatedWeeklyLoss: Math.round(totalDailyRevenueLoss * 7)
          },
          'auto',
          priority,
          hotel._id
        ));
      }
      await Promise.all(notificationPromises);

    } catch (error) {
      logger.error('❌ Error checking revenue impact:', error);
    }
  }

  /**
   * Check guest satisfaction scores and send alerts for low ratings
   */
  static async checkGuestSatisfaction() {
    try {
      logger.debug('⭐ Checking guest satisfaction scores...');

      const Hotel = mongoose.model('Hotel');
      const Review = mongoose.model('Review');
      const Room = mongoose.model('Room');

      const hotels = await Hotel.find({ isActive: true }).select('_id name').lean().limit(1000);
      const hotelIds = hotels.map(h => h._id);

      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Batch: get all low-rating reviews across all active hotels
      const lowRatingReviews = await Review.find({
        hotelId: { $in: hotelIds },
        rating: { $lte: 2 },
        createdAt: { $gte: last24Hours }
      }).populate('userId', 'firstName lastName email').populate('bookingId', 'roomId').lean().limit(10000);

      if (lowRatingReviews.length > 0) {
        // Batch: fetch all rooms referenced by reviews in a single query
        const roomIds = [...new Set(lowRatingReviews.filter(r => r.bookingId?.roomId).map(r => r.bookingId.roomId.toString()))];
        const rooms = roomIds.length > 0
          ? await Room.find({ _id: { $in: roomIds } }).select('_id roomNumber').limit(1000).lean()
          : [];
        const roomMap = new Map(rooms.map(r => [r._id.toString(), r.roomNumber]));

        // Send notifications in parallel
        await Promise.all(lowRatingReviews.map(review => {
          const roomNumber = review.bookingId?.roomId
            ? (roomMap.get(review.bookingId.roomId.toString()) || 'Unknown')
            : 'Unknown';

          return NotificationAutomationService.triggerNotification(
            'guest_satisfaction_low',
            {
              guestName: `${review.userId?.firstName || ''} ${review.userId?.lastName || ''}`.trim() || 'Anonymous',
              guestEmail: review.userId?.email,
              roomNumber,
              rating: review.rating,
              reviewTitle: review.title,
              reviewContent: review.content,
              reviewId: review._id,
              categories: review.categories,
              issueAreas: this.identifyIssueAreas(review),
              urgency: review.rating === 1 ? 'Critical' : 'High',
              responseRequired: true
            },
            'auto',
            review.rating === 1 ? 'urgent' : 'high',
            review.hotelId
          );
        }));
      }

      // Calculate overall satisfaction trends per hotel
      for (const hotel of hotels) {
        const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentReviews = await Review.find({
          hotelId: hotel._id,
          createdAt: { $gte: last7Days }
        }).lean().limit(1000);

        if (recentReviews.length >= 5) { // Only analyze if we have enough data
          const averageRating = recentReviews.reduce((sum, review) => sum + review.rating, 0) / recentReviews.length;

          if (averageRating < 3.5) {
            await NotificationAutomationService.triggerNotification(
              'guest_satisfaction_trend_low',
              {
                averageRating: Math.round(averageRating * 10) / 10,
                totalReviews: recentReviews.length,
                lowRatingCount: recentReviews.filter(r => r.rating <= 2).length,
                timeFrame: '7 days',
                trend: 'declining',
                actionRequired: 'Immediate attention needed for guest satisfaction'
              },
              'auto',
              'high',
              hotel._id
            );
          }
        }
      }

    } catch (error) {
      logger.error('❌ Error checking guest satisfaction:', error);
    }
  }

  /**
   * Check equipment failure patterns from maintenance requests
   */
  static async checkEquipmentFailurePatterns() {
    try {
      logger.debug('🔧 Checking equipment failure patterns...');

      const Hotel = mongoose.model('Hotel');
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');

      const hotels = await Hotel.find({ isActive: true }).select('_id name').lean().limit(1000);

      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      for (const hotel of hotels) {
        // Aggregate maintenance requests by equipment type
        const failurePatterns = await MaintenanceRequest.aggregate([
          {
            $match: {
              hotelId: hotel._id,
              createdAt: { $gte: last30Days },
              issueType: { $exists: true }
            }
          },
          {
            $group: {
              _id: '$issueType',
              count: { $sum: 1 },
              avgCost: { $avg: '$estimatedCost' },
              urgentCount: {
                $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
              },
              recentRequests: { $push: '$_id' }
            }
          },
          {
            $match: {
              count: { $gte: 3 } // At least 3 failures of the same type
            }
          },
          { $sort: { count: -1 } }
        ]);

        for (const pattern of failurePatterns) {
          const failureRate = (pattern.count / 30) * 100; // Failures per day as percentage
          const priority = pattern.urgentCount >= 2 ? 'urgent' :
                          pattern.count >= 5 ? 'high' : 'medium';

          await NotificationAutomationService.triggerNotification(
            'equipment_failure_pattern',
            {
              equipmentType: pattern._id,
              failureCount: pattern.count,
              timeFrame: '30 days',
              failureRate: Math.round(failureRate * 100) / 100,
              avgCost: Math.round(pattern.avgCost || 0),
              urgentFailures: pattern.urgentCount,
              totalCost: Math.round((pattern.avgCost || 0) * pattern.count),
              pattern: pattern.count >= 5 ? 'Critical pattern detected' : 'Concerning pattern detected',
              recommendation: this.generateMaintenanceRecommendation(pattern),
              preventiveMaintenance: pattern.count >= 4
            },
            'auto',
            priority,
            hotel._id
          );
        }
      }

    } catch (error) {
      logger.error('❌ Error checking equipment failure patterns:', error);
    }
  }

  // Helper methods for operational intelligence

  /**
   * Generate performance improvement recommendations
   */
  static generatePerformanceRecommendations(completionRate, efficiencyScore) {
    const recommendations = [];

    if (completionRate < 70) {
      recommendations.push('Schedule one-on-one training session');
      recommendations.push('Review task prioritization methods');
    }

    if (efficiencyScore < 60) {
      recommendations.push('Provide additional tools or resources');
      recommendations.push('Consider workload redistribution');
    }

    recommendations.push('Monitor progress for next 48 hours');

    return recommendations;
  }

  /**
   * Identify issue areas from review categories
   */
  static identifyIssueAreas(review) {
    const issues = [];

    if (review.categories) {
      Object.entries(review.categories).forEach(([category, rating]) => {
        if (rating <= 2) {
          issues.push(category);
        }
      });
    }

    return issues.length > 0 ? issues : ['General satisfaction'];
  }

  /**
   * Generate maintenance recommendations based on failure patterns
   */
  static generateMaintenanceRecommendation(pattern) {
    if (pattern.count >= 5) {
      return `Consider replacing ${pattern._id} equipment - high failure rate indicates end of life`;
    } else if (pattern.urgentCount >= 2) {
      return `Schedule immediate inspection of all ${pattern._id} equipment`;
    } else {
      return `Implement preventive maintenance schedule for ${pattern._id} equipment`;
    }
  }

  /**
   * Stop all scheduled jobs (useful for testing)
   */
  static stopScheduledJobs() {
    cron.getTasks().forEach((task, name) => {
      task.stop();
      logger.debug(`🛑 Stopped scheduled job: ${name}`);
    });

    this.isInitialized = false;
    logger.debug('🛑 All notification scheduler jobs stopped');
  }

  /**
   * Get status of all scheduled jobs
   */
  static getSchedulerStatus() {
    const tasks = cron.getTasks();
    const status = {
      isInitialized: this.isInitialized,
      activeJobs: tasks.size,
      jobs: []
    };

    tasks.forEach((task, name) => {
      status.jobs.push({
        name,
        running: task.running,
        scheduled: !!task.scheduled
      });
    });

    return status;
  }

  /**
   * Expire pending bookings whose reservedUntil window has passed
   * and release any rooms that were held for them.
   */
  static async expirePendingReservations() {
    try {
      logger.debug('🔍 Checking for expired pending reservations...');

      const Booking = mongoose.model('Booking');
      const Room = mongoose.model('Room');
      const now = new Date();

      const expiredBookings = await Booking.find({
        status: 'pending',
        reservedUntil: { $lt: now, $exists: true }
      }).select('_id rooms hotelId bookingNumber').limit(500).lean();

      if (expiredBookings.length === 0) return;

      logger.info(`Found ${expiredBookings.length} expired pending reservations`);

      const expiredIds = expiredBookings.map(b => b._id);
      await Booking.updateMany(
        { _id: { $in: expiredIds } },
        { $set: { status: 'cancelled', cancellationReason: 'Reservation expired — payment not completed in time' } }
      );

      // Release any reserved rooms
      const roomIds = expiredBookings.flatMap(b => (b.rooms || []).map(r => r.roomId?._id || r.roomId)).filter(Boolean);
      if (roomIds.length > 0) {
        await Room.updateMany(
          { _id: { $in: roomIds }, status: 'reserved' },
          { $set: { status: 'vacant' }, $unset: { currentBookingId: '' } }
        );
      }

      logger.info(`✅ Expired ${expiredBookings.length} pending reservations`);
    } catch (error) {
      logger.error('❌ Error expiring pending reservations:', error);
    }
  }

  static async sendCheckInReminders() {
    try {
      logger.debug('📧 Sending check-in reminders for tomorrow arrivals...');

      const Booking = mongoose.model('Booking');
      const User = mongoose.model('User');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const upcomingBookings = await Booking.find({
        checkIn: { $gte: tomorrow, $lt: dayAfter },
        status: { $in: ['confirmed', 'pending'] },
        reminderSent: { $ne: true }
      }).select('_id bookingNumber checkIn checkOut userId hotelId').limit(500).lean();

      logger.debug(`📋 Found ${upcomingBookings.length} bookings for tomorrow check-in reminders`);

      let sentCount = 0;
      for (const booking of upcomingBookings) {
        try {
          if (!booking.userId) continue;
          const guest = await User.findById(booking.userId).select('email name').lean();
          if (!guest?.email) continue;

          await emailService.sendEmail({
            to: guest.email,
            subject: `Check-in Reminder — ${booking.bookingNumber || booking._id}`,
            html: `
              <h2>Your stay is tomorrow!</h2>
              <p>Dear ${guest.name || 'Guest'},</p>
              <p>This is a friendly reminder that your check-in for booking <strong>${booking.bookingNumber || booking._id}</strong> is scheduled for <strong>${new Date(booking.checkIn).toLocaleDateString()}</strong>.</p>
              <p>We look forward to welcoming you!</p>
            `
          });

          await Booking.updateOne({ _id: booking._id }, { $set: { reminderSent: true } });
          sentCount++;
        } catch (err) {
          logger.warn('Failed to send check-in reminder', { bookingId: booking._id, error: err.message });
        }
      }

      if (sentCount > 0) {
        logger.info(`✅ Sent ${sentCount} check-in reminder emails`);
      }
    } catch (error) {
      logger.error('❌ Error sending check-in reminders:', error);
    }
  }
}

export default NotificationScheduler;