import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import websocketService from './websocketService.js';
import logger from '../utils/logger.js';
import { deliverInAppNotificationsBulk } from './inAppNotificationDeliveryService.js';

const OPS_ROLES = { $in: ['admin', 'manager', 'frontdesk'] };

/**
 * Inventory Notification Service
 * Handles creating and sending notifications for inventory-related events
 */
class InventoryNotificationService {
  
  /**
   * Notify admins when inventory items are damaged/missing during daily checks
   */
  async notifyInventoryIssues(dailyCheck) {
    try {
      const { hotelId, roomId, guestId, inventoryItems, housekeeperId, totalCharges } = dailyCheck;
    
      // Find all admin users for this hotel
      const admins = await User.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        role: OPS_ROLES,
        isActive: true
      }).lean().limit(1000);

      // Get room details
      const { default: Room } = await import('../models/Room.js');
      const room = await Room.findById(roomId).select('roomNumber').lean();
    
      // Get housekeeper details
      const housekeeper = await User.findById(housekeeperId).select('name').lean();
    
      // Get guest details if applicable
      let guest = null;
      if (guestId) {
        guest = await User.findById(guestId).select('name email').lean();
      }

      // Find items with issues
      const damagedItems = inventoryItems.filter(item => 
        item.condition === 'damaged' || item.needsReplacement
      );
      const missingItems = inventoryItems.filter(item => 
        item.condition === 'missing'
      );
      const chargedItems = inventoryItems.filter(item => item.chargeGuest);

      const notifications = [];

      // Notification for damaged items
      if (damagedItems.length > 0) {
        const notification = {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          type: 'inventory_damage',
          title: `Inventory Damage - Room ${room.roomNumber}`,
          message: `${damagedItems.length} items damaged in Room ${room.roomNumber}. Reported by ${housekeeper.name}.${guest ? ` Guest: ${guest.name}` : ''}`,
          channels: ['in_app', 'email'],
          priority: 'high',
          metadata: {
            roomId: roomId.toString(),
            roomNumber: room.roomNumber,
            housekeeperId: housekeeperId.toString(),
            guestId: guestId?.toString(),
            dailyCheckId: dailyCheck._id.toString(),
            itemsCount: damagedItems.length,
            items: damagedItems.map(item => ({
              itemName: item.itemId?.name,
              condition: item.condition,
              reason: item.replacementReason
            }))
          }
        };

        // Create notification for each admin
        for (const admin of admins) {
          notifications.push({
            ...notification,
            userId: admin._id
          });
        }
      }

      // Notification for missing items
      if (missingItems.length > 0) {
        const notification = {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          type: 'inventory_missing',
          title: `Missing Items - Room ${room.roomNumber}`,
          message: `${missingItems.length} items missing from Room ${room.roomNumber}. Investigation required.`,
          channels: ['in_app', 'email'],
          priority: 'urgent',
          metadata: {
            roomId: roomId.toString(),
            roomNumber: room.roomNumber,
            housekeeperId: housekeeperId.toString(),
            guestId: guestId?.toString(),
            dailyCheckId: dailyCheck._id.toString(),
            itemsCount: missingItems.length,
            items: missingItems.map(item => ({
              itemName: item.itemId?.name,
              expectedQuantity: item.expectedQuantity,
              actualQuantity: item.actualQuantity
            }))
          }
        };

        for (const admin of admins) {
          notifications.push({
            ...notification,
            userId: admin._id
          });
        }
      }

      // Notification for guest charges
      if (chargedItems.length > 0 && totalCharges > 0) {
        const notification = {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          type: 'inventory_guest_charged',
          title: `Guest Charged - Room ${room.roomNumber}`,
          message: `Guest ${guest?.name || 'Unknown'} charged $${totalCharges.toFixed(2)} for ${chargedItems.length} damaged/missing items.`,
          channels: ['in_app'],
          priority: 'medium',
          metadata: {
            roomId: roomId.toString(),
            roomNumber: room.roomNumber,
            guestId: guestId?.toString(),
            guestName: guest?.name,
            totalCharges: totalCharges,
            itemsCount: chargedItems.length,
            items: chargedItems.map(item => ({
              itemName: item.itemId?.name,
              cost: item.replacementCost,
              reason: item.replacementReason
            }))
          }
        };

        for (const admin of admins) {
          notifications.push({
            ...notification,
            userId: admin._id
          });
        }
      }

      // Bulk create notifications
      if (notifications.length > 0) {
        const createdNotifications = await Notification.insertMany(notifications);
        logger.debug(`Created ${notifications.length} inventory notifications`);
        await deliverInAppNotificationsBulk(createdNotifications);

        if (createdNotifications.length > 0) {
          const sampleNotification = createdNotifications[0];
          websocketService.broadcastToHotel(hotelId.toString(), 'inventory:alert', {
            type: sampleNotification.type,
            title: sampleNotification.title,
            message: sampleNotification.message,
            priority: sampleNotification.priority,
            metadata: sampleNotification.metadata,
            count: createdNotifications.length,
            roomNumber: room.roomNumber,
            timestamp: new Date().toISOString()
          });
        }
      }

      return notifications.length;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Notify admins when checkout inspection fails
   */
  async notifyCheckoutInspectionFailed(inspection) {
    try {
      const { hotelId, roomId, bookingId, guestId, totalCharges } = inspection;
    
      const admins = await User.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        role: OPS_ROLES,
        isActive: true
      }).lean().limit(1000);

      const { default: Room } = await import('../models/Room.js');
      const room = await Room.findById(roomId).select('roomNumber').lean();
      const guest = await User.findById(guestId).select('name email').lean();

      const notifications = [];
    
      if (totalCharges > 0) {
        const notification = {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          type: 'checkout_inspection_failed',
          title: `Checkout Issues - Room ${room.roomNumber}`,
          message: `Checkout inspection found issues in Room ${room.roomNumber}. Guest ${guest.name} charged $${totalCharges.toFixed(2)}.`,
          channels: ['in_app', 'email'],
          priority: 'high',
          metadata: {
            roomId: roomId.toString(),
            roomNumber: room.roomNumber,
            bookingId: bookingId.toString(),
            guestId: guestId.toString(),
            guestName: guest.name,
            totalCharges: totalCharges,
            inspectionId: inspection._id.toString()
          }
        };

        for (const admin of admins) {
          notifications.push({
            ...notification,
            userId: admin._id
          });
        }
      }

      if (notifications.length > 0) {
        const created = await Notification.insertMany(notifications);
        await deliverInAppNotificationsBulk(created);
      }

      return notifications.length;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Notify admins about low stock items
   */
  async notifyLowStock(hotelId, lowStockItems) {
    try {
      const admins = await User.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        role: OPS_ROLES,
        isActive: true
      }).lean().limit(1000);

      if (lowStockItems.length === 0) return 0;

      const notifications = [];
      const notification = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: 'inventory_low_stock',
        title: `Low Stock Alert`,
        message: `${lowStockItems.length} items are running low on stock. Immediate restocking required.`,
        channels: ['in_app', 'email'],
        priority: 'medium',
        metadata: {
          itemsCount: lowStockItems.length,
          items: lowStockItems.map(item => ({
            name: item.name,
            currentStock: item.currentStock,
            threshold: item.stockThreshold,
            category: item.category
          }))
        }
      };

      for (const admin of admins) {
        notifications.push({
          ...notification,
          userId: admin._id
        });
      }

      const created = await Notification.insertMany(notifications);
      await deliverInAppNotificationsBulk(created);
      return notifications.length;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get inventory-related notifications for admin
   */
  async getInventoryNotifications(userId, hotelId, limit = 20) {
    try {
      const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const inventoryTypes = [
        'inventory_damage',
        'inventory_missing',
        'inventory_replacement_needed',
        'inventory_guest_charged',
        'inventory_low_stock',
        'checkout_inspection_failed',
        'inventory_theft',
        'supply_request_approved',
        'supply_request_rejected'
      ];

      return await Notification.find({
        userId: new mongoose.Types.ObjectId(userId),
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: { $in: inventoryTypes }
      })
      .sort({ createdAt: -1 })
      .limit(safeLimit).lean();
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Mark inventory notifications as read
   */
  async markInventoryNotificationsRead(userId, notificationIds) {
    try {
      return await Notification.updateMany(
        {
          _id: { $in: notificationIds.map(id => new mongoose.Types.ObjectId(id)) },
          userId: new mongoose.Types.ObjectId(userId)
        },
        { 
          status: 'read',
          readAt: new Date()
        }
      );
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Get unread inventory notification count
   */
  async getUnreadInventoryCount(userId, hotelId) {
    try {
      const inventoryTypes = [
        'inventory_damage',
        'inventory_missing',
        'inventory_replacement_needed',
        'inventory_guest_charged',
        'inventory_low_stock',
        'checkout_inspection_failed',
        'inventory_theft',
        'supply_request_approved',
        'supply_request_rejected'
      ];

      return await Notification.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: { $in: inventoryTypes },
        status: { $ne: 'read' }
      });
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Notify admins about daily inventory audit results
   */
  async notifyInventoryAuditResults(hotelId, auditResults) {
    try {
      const opsUsers = await User.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        role: OPS_ROLES,
        isActive: true
      }).lean().limit(1000);

      if (opsUsers.length === 0) return 0;

      const { lowStockCount, outOfStockCount } = auditResults;
    
      if (lowStockCount === 0 && outOfStockCount === 0) return 0;

      const priority = outOfStockCount > 0 ? 'high' : 'medium';
      const notifications = [];
    
      const notification = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: 'inventory_audit_alert',
        title: `Daily Inventory Audit Alert`,
        message: `Audit found ${lowStockCount} low stock items${outOfStockCount > 0 ? ` and ${outOfStockCount} out-of-stock items` : ''}. Review inventory status immediately.`,
        channels: ['in_app', 'email'],
        priority,
        metadata: {
          auditDate: new Date().toISOString().split('T')[0],
          lowStockCount,
          outOfStockCount,
          categories: auditResults.categories
        }
      };

      for (const u of opsUsers) {
        notifications.push({
          ...notification,
          userId: u._id
        });
      }

      // Create notifications
      if (notifications.length > 0) {
        const created = await Notification.insertMany(notifications);
        logger.debug(`Created ${notifications.length} audit notifications`);
        await deliverInAppNotificationsBulk(created);

        const sampleNotification = notifications[0];
        websocketService.broadcastToHotel(hotelId.toString(), 'inventory:alert', {
          type: 'inventory_audit_alert',
          title: sampleNotification.title,
          message: sampleNotification.message,
          priority: sampleNotification.priority,
          metadata: sampleNotification.metadata,
          count: notifications.length,
          timestamp: new Date().toISOString()
        });
      }

      return notifications.length;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Notify admins about weekly inventory report
   */
  async notifyWeeklyInventoryReport(hotelId, reportData) {
    try {
      const opsUsers = await User.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        role: OPS_ROLES,
        isActive: true
      }).lean().limit(1000);

      if (opsUsers.length === 0) return 0;

      const notifications = [];
      const notification = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: 'inventory_weekly_report',
        title: `Weekly Inventory Report`,
        message: `Weekly inventory report: ${reportData.totalItems} items, $${reportData.totalValue.toFixed(2)} total value, ${reportData.lowStockItems} items need restocking.`,
        channels: ['in_app', 'email'],
        priority: 'low',
        metadata: {
          reportWeek: new Date().toISOString().split('T')[0],
          ...reportData
        }
      };

      for (const u of opsUsers) {
        notifications.push({
          ...notification,
          userId: u._id
        });
      }

      if (notifications.length > 0) {
        const created = await Notification.insertMany(notifications);
        await deliverInAppNotificationsBulk(created);
        logger.debug(`Created ${notifications.length} weekly report notifications`);
      }

      return notifications.length;
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  /**
   * Notify the assigned staff member when a new task is created for them.
   */
  async notifyTaskAssignment(task) {
    try {
      const hotelId = task.hotelId?.toString ? task.hotelId.toString() : task.hotelId;
      const assignedToId = task.assignedTo?._id?.toString
        ? task.assignedTo._id.toString()
        : task.assignedTo?.toString
          ? task.assignedTo.toString()
          : null;

      if (!assignedToId) {
        logger.warn('notifyTaskAssignment: no assignedTo on task', { taskId: task._id });
        return 0;
      }

      const notification = await Notification.create({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        userId: new mongoose.Types.ObjectId(assignedToId),
        type: 'task_assigned',
        title: `New Task Assigned: ${task.title}`,
        message: `You have been assigned a new task: "${task.title}". Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}.`,
        channels: ['in_app'],
        priority: task.priority === 'urgent' ? 'high' : 'medium',
        metadata: {
          taskId: task._id?.toString(),
          taskType: task.taskType,
          dueDate: task.dueDate
        },
        isRead: false,
        readAt: null
      });

      await deliverInAppNotificationsBulk([notification]);

      // Real-time push to the assigned staff member via Socket.io
      websocketService.broadcastToHotel(hotelId, 'task:assigned', {
        taskId: task._id?.toString(),
        title: task.title,
        taskType: task.taskType,
        priority: task.priority,
        dueDate: task.dueDate,
        timestamp: new Date().toISOString()
      });

      return 1;
    } catch (error) {
      logger.error('notifyTaskAssignment failed', { error: error.message, taskId: task._id });
      // Non-fatal — do not surface notification failures to the API caller
      return 0;
    }
  }
}

export default new InventoryNotificationService();