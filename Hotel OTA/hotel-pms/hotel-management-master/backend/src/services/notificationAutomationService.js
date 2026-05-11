import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import logger from '../utils/logger.js';
import { coerceDbNotificationType } from '../utils/notificationTypeCoercion.js';

/**
 * Notification Automation Service
 * Handles automated notification triggers for hotel management operations
 */
class NotificationAutomationService {

  /**
   * Trigger a notification with automatic recipient resolution and template generation
   * @param {string} type - Notification type from enum
   * @param {Object} data - Context data for notification
   * @param {Array|string} recipients - Recipients (user IDs, roles, or 'auto')
   * @param {string} priority - Notification priority
   * @param {string} hotelId - Hotel ID
   */
  static async triggerNotification(type, data, recipients = 'auto', priority = 'medium', hotelId) {
    try {
      const dbType = coerceDbNotificationType(type);
      // Generate notification content based on type and data
      const notificationContent = await this.generateNotificationContent(type, data);

      // Resolve recipients if auto-detection is requested
      const resolvedRecipients = await this.resolveRecipients(type, data, recipients, hotelId);

      // Create notifications for each recipient, checking user preferences first
      const notifications = [];
      for (const recipientId of resolvedRecipients) {
        // Check user notification preferences before sending
        const userPrefs = await NotificationPreference.findOne({ userId: recipientId }).lean();
        if (userPrefs) {
          // Check if this notification type is disabled across in_app channel
          const typeKey = type; // e.g., 'booking_confirmation'
          if (userPrefs.inApp && userPrefs.inApp.types && userPrefs.inApp.types[typeKey] === false) {
            continue; // Skip this recipient - they've opted out of this type
          }

          // Check if global notifications are disabled
          if (userPrefs.global && userPrefs.global.enabled === false) {
            continue; // Skip this recipient - all notifications disabled
          }

          // Check quiet hours (use push channel quiet hours as the general quiet hours)
          const channelQH = (userPrefs.push && userPrefs.push.quietHours) ||
                            (userPrefs.email && userPrefs.email.quietHours);
          if (channelQH && channelQH.enabled) {
            const now = new Date();
            const currentHour = now.getHours();
            const start = parseInt(channelQH.start) || 22;
            const end = parseInt(channelQH.end) || 7;
            const isQuietTime = start > end
              ? (currentHour >= start || currentHour < end)
              : (currentHour >= start && currentHour < end);
            if (isQuietTime && priority !== 'urgent') {
              // Defer non-urgent notifications during quiet hours instead of dropping them
              const deferHours = (end - currentHour + 24) % 24;
              const scheduledFor = new Date(now.getTime() + deferHours * 60 * 60 * 1000);
              const notification = await this.createNotificationForUser(
                dbType,
                notificationContent,
                recipientId,
                hotelId,
                priority,
                { ...data, scheduledFor }
              );
              notification.scheduledFor = scheduledFor;
              await notification.save();
              notifications.push(notification);
              continue;
            }
          }
        }

        const notification = await this.createNotificationForUser(
          dbType,
          notificationContent,
          recipientId,
          hotelId,
          priority,
          data
        );
        notifications.push(notification);
      }

      // Send real-time notifications (only those not deferred)
      const immediateNotifications = notifications.filter(n => !n.scheduledFor);
      await this.sendRealTimeNotifications(immediateNotifications);

      logger.debug(`✅ Created ${notifications.length} notifications for type: ${type}`);
      return notifications;

    } catch (error) {
      logger.error(`❌ Error creating notification for type ${type}:`, error);
      throw error;
    }
  }

  /**
   * Generate notification title and message based on type and context
   */
  static async generateNotificationContent(type, data) {
    try {
      const templates = {
        // Daily Operations
        'daily_check_assigned': {
          title: 'Daily Check Assigned',
          message: `Room ${data.roomNumber} daily check has been assigned to you`,
          icon: '📋'
        },
        'daily_check_overdue': {
          title: 'Daily Check Overdue',
          message: `⚠️ Daily check for Room ${data.roomNumber} is overdue (${data.overdueHours}h)`,
          icon: '⏰'
        },
        'daily_check_completed': {
          title: 'Daily Check Completed',
          message: `✅ Room ${data.roomNumber} daily check completed with quality score: ${data.qualityScore}/5`,
          icon: '✅'
        },
        'daily_check_issues': {
          title: 'Issues Found in Daily Check',
          message: `🚨 Issues found in Room ${data.roomNumber}: ${data.issueDescription}`,
          icon: '🚨'
        },

        // Maintenance Workflow
        'maintenance_request_created': {
          title: 'New Maintenance Request',
          message: `New ${data.issueType} maintenance request for Room ${data.roomNumber}`,
          icon: '🔧'
        },
        'maintenance_urgent': {
          title: 'URGENT Maintenance Required',
          message: `🚨 URGENT: ${data.issueType} in Room ${data.roomNumber} - Immediate attention required`,
          icon: '🚨'
        },
        'maintenance_assigned': {
          title: 'Maintenance Task Assigned',
          message: `Maintenance task assigned: ${data.description} for Room ${data.roomNumber}`,
          icon: '🔧'
        },
        'maintenance_completed': {
          title: 'Maintenance Completed',
          message: `✅ Maintenance completed for Room ${data.roomNumber}: ${data.description}`,
          icon: '✅'
        },
        'maintenance_overdue': {
          title: 'Maintenance Overdue',
          message: `⚠️ Maintenance task overdue for Room ${data.roomNumber}: ${data.description}`,
          icon: '⚠️'
        },
        'maintenance_high_cost': {
          title: 'High-Cost Maintenance Alert',
          message: `💰 High-cost maintenance: $${data.cost} for Room ${data.roomNumber}`,
          icon: '💰'
        },

        // Housekeeping & Room Status
        'room_needs_cleaning': {
          title: 'Room Needs Cleaning',
          message: `Room ${data.roomNumber} marked as dirty - cleaning required`,
          icon: '🧹'
        },
        'housekeeping_assigned': {
          title: 'Housekeeping Task Assigned',
          message: `Housekeeping task assigned: ${data.title} for Room ${data.roomNumber}`,
          icon: '🧹'
        },
        'cleaning_completed': {
          title: 'Cleaning Completed',
          message: `✅ Room ${data.roomNumber} cleaned and ready for guests`,
          icon: '✨'
        },
        'room_out_of_order': {
          title: 'Room Out of Order',
          message: `🚫 Room ${data.roomNumber} marked OUT OF ORDER - ${data.reason || 'Maintenance required'}`,
          icon: '🚫'
        },
        'room_back_in_service': {
          title: 'Room Back in Service',
          message: `✅ Room ${data.roomNumber} is back in service and available for booking`,
          icon: '✅'
        },
        'room_checkout_dirty': {
          title: 'Room Checkout - Cleaning Needed',
          message: `Room ${data.roomNumber} checked out - housekeeping needed before next guest`,
          icon: '🧹'
        },

        // Guest Service Workflow
        'guest_service_created': {
          title: 'New Guest Service Request',
          message: `New ${data.serviceType} request from Room ${data.roomNumber}: ${data.description || data.serviceVariation}`,
          icon: '🛎️'
        },
        'guest_service_urgent': {
          title: 'URGENT Guest Service',
          message: `🚨 URGENT: ${data.serviceType} request from Room ${data.roomNumber}`,
          icon: '🚨'
        },
        'guest_service_assigned': {
          title: 'Service Request Assigned',
          message: `${data.serviceType} request assigned to you from Room ${data.roomNumber}`,
          icon: '🛎️'
        },
        'guest_service_completed': {
          title: 'Service Request Completed',
          message: `✅ ${data.serviceType} request completed for Room ${data.roomNumber}`,
          icon: '✅'
        },
        'guest_service_overdue': {
          title: 'Service Request Overdue',
          message: `⚠️ Guest service overdue: ${data.serviceType} for Room ${data.roomNumber}`,
          icon: '⚠️'
        },
        'guest_service_vip': {
          title: 'VIP Guest Service Request',
          message: `👑 VIP guest service request: ${data.serviceType} from Room ${data.roomNumber}`,
          icon: '👑'
        },

        // Inventory Management
        'inventory_low_stock': {
          title: 'Low Inventory Alert',
          message: `⚠️ Low stock: ${data.itemName} (${data.currentStock} remaining)`,
          icon: '📦'
        },
        'inventory_out_of_stock': {
          title: 'Out of Stock',
          message: `🚫 OUT OF STOCK: ${data.itemName} - Immediate reorder required`,
          icon: '🚫'
        },
        'inventory_damaged': {
          title: 'Damaged Inventory Found',
          message: `❌ Damaged inventory: ${data.itemName} in Room ${data.roomNumber}`,
          icon: '❌'
        },
        'inventory_missing': {
          title: 'Missing Inventory',
          message: `🚨 Missing inventory: ${data.itemName} from Room ${data.roomNumber}`,
          icon: '🚨'
        },
        'inventory_high_value_used': {
          title: 'High-Value Item Used',
          message: `💰 High-value item consumed: ${data.itemName} ($${data.value}) in Room ${data.roomNumber}`,
          icon: '💰'
        },

        // Operational Intelligence
        'daily_operations_summary': {
          title: 'Daily Operations Summary',
          message: `📊 Daily Summary: ${data.completedTasks} completed, ${data.pendingTasks} pending, ${data.overdueItems} overdue`,
          icon: '📊'
        },
        'staff_performance_alert': {
          title: 'Staff Performance Alert',
          message: `📈 Performance alert: ${data.staffName} - ${data.metric}: ${data.value}`,
          icon: '📈'
        },
        'revenue_impact_alert': {
          title: 'Revenue Impact Alert',
          message: `💰 Revenue impact: ${data.outOfOrderRooms} rooms out of service - Estimated loss: $${data.estimatedLoss}`,
          icon: '💰'
        },

        // Task Management
        'task_assignment': {
          title: 'Task Assigned',
          message: `📋 New task assigned: ${data.taskTitle} - Due: ${data.dueDate}`,
          icon: '📋'
        },
        'task_overdue': {
          title: 'Task Overdue',
          message: `⚠️ Task overdue: ${data.taskTitle} (${data.overdueDays} days)`,
          icon: '⚠️'
        }
      };

      const template = templates[type];
      if (!template) {
        return {
          title: `Hotel Notification: ${type}`,
          message: `Notification for ${type}: ${JSON.stringify(data)}`,
          icon: '🏨'
        };
      }

      return {
        title: template.title,
        message: template.message,
        icon: template.icon
      };
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Resolve notification recipients based on type and context
   */
  static async resolveRecipients(type, data, recipients, hotelId) {
    try {
      if (recipients !== 'auto') {
        // If specific recipients provided, return them
        return Array.isArray(recipients) ? recipients : [recipients];
      }

      const User = mongoose.model('User');

      // Auto-resolve recipients based on notification type
      const recipientRules = {
        // Daily Operations - Staff and Admin
        'daily_check_assigned': () => [data.assignedToUserId],
        'daily_check_overdue': async () => {
          try {
            const admins = await User.find({ hotelId, role: { $in: ['admin', 'manager'] } }).select('_id').lean().limit(1000);
            return admins.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'daily_check_completed': async () => {
          try {
            const admins = await User.find({ hotelId, role: { $in: ['admin', 'manager'] } }).select('_id').lean().limit(1000);
            return admins.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'daily_check_issues': async () => {
          try {
            const staff = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager', 'maintenance'] }
            }).select('_id').lean().limit(1000);
            return staff.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },

        // Maintenance - Maintenance staff and Admin
        'maintenance_request_created': async () => {
          try {
            const staff = await User.find({
              hotelId,
              role: { $in: ['admin', 'maintenance'] }
            }).select('_id').lean().limit(1000);
            return staff.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'maintenance_urgent': async () => {
          try {
            const urgentStaff = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager', 'maintenance'] }
            }).select('_id').lean().limit(1000);
            return urgentStaff.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'maintenance_assigned': () => [data.assignedTo],
        'maintenance_completed': async () => {
          try {
            const admins = await User.find({ hotelId, role: { $in: ['admin'] } }).select('_id').lean().limit(1000);
            const requester = data.createdBy ? [data.createdBy] : [];
            return [...admins.map(u => u._id), ...requester];
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'maintenance_high_cost': async () => {
          try {
            const managers = await User.find({ hotelId, role: { $in: ['admin', 'manager'] } }).select('_id').lean().limit(1000);
            return managers.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },

        // Housekeeping - Housekeeping staff and Front desk
        'room_needs_cleaning': async () => {
          try {
            const housekeeping = await User.find({
              hotelId,
              role: { $in: ['staff', 'housekeeping'] }
            }).select('_id').lean().limit(1000);
            return housekeeping.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'housekeeping_assigned': () => [data.assignedTo || data.assignedToUserId],
        'cleaning_completed': async () => {
          try {
            const frontDesk = await User.find({
              hotelId,
              role: { $in: ['admin', 'staff'] }
            }).select('_id').lean().limit(1000);
            return frontDesk.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'room_out_of_order': async () => {
          try {
            const critical = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager'] }
            }).select('_id').lean().limit(1000);
            return critical.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'room_checkout_dirty': async () => {
          try {
            const housekeeping = await User.find({
              hotelId,
              role: { $in: ['staff', 'housekeeping'] }
            }).select('_id').lean().limit(1000);
            return housekeeping.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },

        // Guest Services - Appropriate service staff
        'guest_service_created': async () => {
          try {
            const serviceStaff = await User.find({
              hotelId,
              role: { $in: ['staff', 'admin'] }
            }).select('_id').lean().limit(1000);
            return serviceStaff.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'guest_service_urgent': async () => {
          try {
            const urgentStaff = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager'] }
            }).select('_id').lean().limit(1000);
            return urgentStaff.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'guest_service_assigned': () => [data.assignedTo],
        'guest_service_vip': async () => {
          try {
            const vipStaff = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager'] }
            }).select('_id').lean().limit(1000);
            return vipStaff.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },

        // Inventory - Inventory managers and Admin
        'inventory_low_stock': async () => {
          try {
            const inventory = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager'] }
            }).select('_id').lean().limit(1000);
            return inventory.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'inventory_out_of_stock': async () => {
          try {
            const urgent = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager'] }
            }).select('_id').lean().limit(1000);
            return urgent.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },
        'inventory_missing': async () => {
          try {
            const security = await User.find({
              hotelId,
              role: { $in: ['admin', 'manager'] }
            }).select('_id').lean().limit(1000);
            return security.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        },

        // Default: Admin and Manager
        'default': async () => {
          try {
            const admins = await User.find({ hotelId, role: { $in: ['admin', 'manager'] } }).select('_id').lean().limit(1000);
            return admins.map(u => u._id);
        
          } catch (error) {
            console.error('Operation failed:', error.message);
            throw error;
          }
        }
      };

      const resolver = recipientRules[type] || recipientRules['default'];
      return await resolver();
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Create notification document for a specific user
   */
  static async createNotificationForUser(type, content, userId, hotelId, priority, metadata) {
    try {
      const notification = new Notification({
        userId,
        hotelId,
        type,
        title: content.title,
        message: content.message,
        priority,
        status: 'pending',
        channels: ['in_app', 'push'], // Default channels
        metadata: {
          ...metadata,
          icon: content.icon,
          timestamp: new Date().toISOString()
        }
      });

      await notification.save();
      return notification;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Send real-time notifications via WebSocket
   */
  static async sendRealTimeNotifications(notifications) {
    try {
      const websocketService = (await import('./websocketService.js')).default;
      const { deliverInAppNotificationToUser } = await import('./inAppNotificationDeliveryService.js');

      logger.debug(`🔔 Sending ${notifications.length} real-time in-app notifications`);

      const sentIds = [];
      const failedIds = [];
      for (const notification of notifications) {
        try {
          await deliverInAppNotificationToUser(notification);

          if (notification.priority === 'urgent' || notification.priority === 'high') {
            await websocketService.sendToHotel(String(notification.hotelId), 'notification:urgent', {
              id: notification._id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              priority: notification.priority,
              userId: notification.userId
            });
          }

          sentIds.push(notification._id);
          logger.debug(`✅ Delivered real-time notification: ${notification.title} to user ${notification.userId}`);

        } catch (error) {
          logger.error(`❌ Error sending real-time notification ${notification._id}:`, error);
          failedIds.push(notification._id);
        }
      }

      // Batch: mark all sent/failed notifications with updateMany
      const Notification = mongoose.model('Notification');
      if (sentIds.length > 0) {
        await Notification.updateMany(
          { _id: { $in: sentIds } },
          { $set: { status: 'sent', sentAt: new Date() } }
        );
      }

    } catch (error) {
      logger.error('❌ Error sending real-time notifications:', error);

      // Fallback: batch mark as sent for database consistency
      const Notification = mongoose.model('Notification');
      const notifIds = notifications.map(n => n._id);
      if (notifIds.length > 0) {
        await Notification.updateMany(
          { _id: { $in: notifIds } },
          { $set: { status: 'sent', sentAt: new Date() } }
        );
      }
    }
  }

  /**
   * Schedule a notification for future delivery
   */
  static async scheduleNotification(type, data, scheduledFor, recipients, priority, hotelId) {
    try {
      const dbType = coerceDbNotificationType(type);
      const content = await this.generateNotificationContent(type, data);
      const resolvedRecipients = await this.resolveRecipients(type, data, recipients, hotelId);

      const notifications = await Promise.all(
        resolvedRecipients.map(recipientId => {
          const notification = new Notification({
            userId: recipientId,
            hotelId,
            type: dbType,
            title: content.title,
            message: content.message,
            priority,
            status: 'pending',
            scheduledFor: new Date(scheduledFor),
            channels: ['in_app', 'push'],
            metadata: {
              ...data,
              icon: content.icon,
              scheduled: true
            }
          });
          return notification.save();
        })
      );

      logger.debug(`📅 Scheduled ${notifications.length} notifications for ${scheduledFor}`);
      return notifications;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Batch create multiple notifications efficiently
   */
  static async batchNotifications(notificationBatch) {
    try {
      const notifications = await Promise.all(
        notificationBatch.map(batch =>
          this.triggerNotification(
            batch.type,
            batch.data,
            batch.recipients,
            batch.priority,
            batch.hotelId
          )
        )
      );

      logger.debug(`📦 Batch created ${notifications.flat().length} notifications`);
      return notifications.flat();
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Smart notification rules to prevent spam and improve UX
   */
  static async applyNotificationRules(notification) {
    try {
      // Rule 1: Don't send low-priority notifications during off-hours (10 PM - 6 AM)
      const currentHour = new Date().getHours();
      if (notification.priority === 'low' && (currentHour >= 22 || currentHour <= 6)) {
        notification.scheduledFor = new Date();
        notification.scheduledFor.setHours(7, 0, 0, 0); // Schedule for 7 AM
      }

      // Rule 2: Combine similar notifications within 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      // Find similar recent notifications (need full Mongoose document for .save())
      const similarNotifications = await Notification.find({
        userId: notification.userId,
        type: notification.type,
        createdAt: { $gte: fiveMinutesAgo },
        status: { $in: ['pending', 'sent'] }
      }).limit(1000);

      if (similarNotifications.length > 0) {
        // Update existing notification instead of creating new one
        const existingNotification = similarNotifications[0];
        existingNotification.message += ` (+${similarNotifications.length} more)`;
        await existingNotification.save();
        return null; // Don't create new notification
      }

      return notification;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }
}

export default NotificationAutomationService;