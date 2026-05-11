import cron from 'node-cron';
import Settlement from '../models/Settlement.js';
import emailService from './emailService.js';
import notificationService from './notificationService.js';
import logger from '../utils/logger.js';

class SettlementNotificationService {
  constructor() {
    this.scheduledJobs = new Map();
    this.startScheduledTasks();
  }

  // Start all scheduled notification tasks
  startScheduledTasks() {
    // Daily check for overdue settlements at 9 AM
    cron.schedule('0 9 * * *', () => {
      this.processOverdueSettlements();
    });

    // Check for settlements due today at 10 AM
    cron.schedule('0 10 * * *', () => {
      this.processDueTodaySettlements();
    });

    // Weekly escalation check every Monday at 8 AM
    cron.schedule('0 8 * * MON', () => {
      this.processEscalationReminders();
    });

    logger.debug('✅ Settlement notification scheduler started');
  }

  // Process overdue settlements
  async processOverdueSettlements() {
    try {
      logger.debug('🔄 Processing overdue settlement notifications...');

      const overdueSettlements = await Settlement.find({
        status: { $in: ['pending', 'partial'] },
        dueDate: { $lt: new Date() }
      }).populate({
        path: 'bookingId',
        populate: { path: 'userId hotelId' }
      }).lean().limit(1000);

      for (const settlement of overdueSettlements) {
        await this.sendOverdueNotification(settlement);
      }

      logger.debug(`📧 Processed ${overdueSettlements.length} overdue settlement notifications`);
    } catch (error) {
      logger.error('❌ Error processing overdue settlements:', error);
    }
  }

  // Process settlements due today
  async processDueTodaySettlements() {
    try {
      logger.debug('🔄 Processing due today settlement notifications...');

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const dueTodaySettlements = await Settlement.find({
        status: { $in: ['pending', 'partial'] },
        dueDate: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      }).populate({
        path: 'bookingId',
        populate: { path: 'userId hotelId' }
      }).lean().limit(1000);

      for (const settlement of dueTodaySettlements) {
        await this.sendDueTodayNotification(settlement);
      }

      logger.debug(`📧 Processed ${dueTodaySettlements.length} due today settlement notifications`);
    } catch (error) {
      logger.error('❌ Error processing due today settlements:', error);
    }
  }

  // Process escalation reminders
  async processEscalationReminders() {
    try {
      logger.debug('🔄 Processing escalation reminders...');

      // Find settlements that need escalation (overdue by more than 7 days)
      const escalationDate = new Date();
      escalationDate.setDate(escalationDate.getDate() - 7);

      const settlementsForEscalation = await Settlement.find({
        status: { $in: ['pending', 'partial'] },
        dueDate: { $lt: escalationDate },
        escalationLevel: { $lt: 3 } // Don't escalate beyond level 3
      }).populate({
        path: 'bookingId',
        populate: { path: 'userId hotelId' }
      }).lean().limit(1000);

      for (const settlement of settlementsForEscalation) {
        await this.escalateSettlement(settlement);
      }

      logger.debug(`⬆️ Processed ${settlementsForEscalation.length} settlement escalations`);
    } catch (error) {
      logger.error('❌ Error processing escalation reminders:', error);
    }
  }

  // Send overdue notification
  async sendOverdueNotification(settlement) {
    try {
      const booking = settlement.bookingId;
      const guest = booking.userId;
      const hotel = booking.hotelId;

      const daysOverdue = Math.ceil((new Date() - settlement.dueDate) / (1000 * 60 * 60 * 24));

      // Email notification
      const emailData = {
        to: guest.email,
        subject: `Payment Overdue: Settlement for Booking ${booking.bookingNumber}`,
        template: 'settlement-overdue',
        data: {
          guestName: guest.name,
          hotelName: hotel.name,
          bookingNumber: booking.bookingNumber,
          settlementNumber: settlement.settlementNumber,
          outstandingAmount: settlement.outstandingBalance,
          daysOverdue: daysOverdue,
          dueDate: settlement.dueDate.toLocaleDateString(),
          paymentLink: `${process.env.FRONTEND_URL}/settlements/${settlement._id}/pay`
        }
      };

      await emailService.sendEmail(emailData);

      // Push notification to hotel staff
      await notificationService.sendNotification({
        type: 'system_alert',
        recipient: `hotel_${hotel._id}`,
        channels: ['inApp', 'push'],
        priority: 'high',
        data: {
          title: 'Overdue Settlement',
          message: `Settlement ${settlement.settlementNumber} is ${daysOverdue} days overdue (booking ${booking.bookingNumber}).`,
          body: `Settlement ${settlement.settlementNumber} is ${daysOverdue} days overdue`,
          hotelId: hotel._id,
          data: {
            type: 'settlement_overdue',
            settlementId: settlement._id.toString(),
            bookingId: booking._id.toString()
          }
        }
      });

      // Update settlement with notification sent
      settlement.communications.push({
        type: 'email',
        direction: 'outbound',
        subject: emailData.subject,
        message: `Overdue notification sent - ${daysOverdue} days overdue`,
        sentAt: new Date()
      });

      await settlement.save();

    } catch (error) {
      logger.error(`❌ Error sending overdue notification for settlement ${settlement._id}:`, error);
    }
  }

  // Send due today notification
  async sendDueTodayNotification(settlement) {
    try {
      const booking = settlement.bookingId;
      const guest = booking.userId;
      const hotel = booking.hotelId;

      // Email notification
      const emailData = {
        to: guest.email,
        subject: `Payment Due Today: Settlement for Booking ${booking.bookingNumber}`,
        template: 'settlement-due-today',
        data: {
          guestName: guest.name,
          hotelName: hotel.name,
          bookingNumber: booking.bookingNumber,
          settlementNumber: settlement.settlementNumber,
          outstandingAmount: settlement.outstandingBalance,
          dueDate: settlement.dueDate.toLocaleDateString(),
          paymentLink: `${process.env.FRONTEND_URL}/settlements/${settlement._id}/pay`
        }
      };

      await emailService.sendEmail(emailData);

      // Push notification to guest if they have the app
      await notificationService.sendNotification({
        type: 'system_alert',
        recipient: `user_${guest._id}`,
        channels: ['inApp', 'push'],
        priority: 'high',
        data: {
          title: 'Payment Due Today',
          message: `Your settlement payment of ₹${settlement.outstandingBalance} is due today for booking ${booking.bookingNumber}.`,
          body: `Your settlement payment of ₹${settlement.outstandingBalance} is due today`,
          hotelId: hotel._id,
          data: {
            type: 'settlement_due_today',
            settlementId: settlement._id.toString()
          }
        }
      });

      // Update settlement
      settlement.communications.push({
        type: 'email',
        direction: 'outbound',
        subject: emailData.subject,
        message: 'Due today reminder sent',
        sentAt: new Date()
      });

      await settlement.save();

    } catch (error) {
      logger.error(`❌ Error sending due today notification for settlement ${settlement._id}:`, error);
    }
  }

  // Escalate settlement
  async escalateSettlement(settlement) {
    try {
      const booking = settlement.bookingId;
      const hotel = booking.hotelId;

      // Increase escalation level
      settlement.escalationLevel = Math.min(settlement.escalationLevel + 1, 3);
      settlement.escalationHistory.push({
        level: settlement.escalationLevel,
        reason: 'Automatic escalation due to overdue payment',
        escalatedBy: 'system',
        escalatedAt: new Date()
      });

      // Determine escalation recipient based on level
      let escalationEmails = [];
      let escalationMessage = '';

      switch (settlement.escalationLevel) {
        case 1:
          escalationEmails = ['frontdesk@thepentouz.com'];
          escalationMessage = 'Settlement escalated to front desk team';
          break;
        case 2:
          escalationEmails = ['manager@thepentouz.com'];
          escalationMessage = 'Settlement escalated to management';
          break;
        case 3:
          escalationEmails = ['director@thepentouz.com', 'finance@thepentouz.com'];
          escalationMessage = 'Settlement escalated to director and finance team';
          break;
      }

      // Send escalation emails
      for (const email of escalationEmails) {
        const escalationEmailData = {
          to: email,
          subject: `Settlement Escalation Level ${settlement.escalationLevel}: ${settlement.settlementNumber}`,
          template: 'settlement-escalation',
          data: {
            hotelName: hotel.name,
            bookingNumber: booking.bookingNumber,
            settlementNumber: settlement.settlementNumber,
            outstandingAmount: settlement.outstandingBalance,
            escalationLevel: settlement.escalationLevel,
            daysOverdue: Math.ceil((new Date() - settlement.dueDate) / (1000 * 60 * 60 * 24)),
            guestName: booking.userId.name,
            guestEmail: booking.userId.email,
            settlementUrl: `${process.env.FRONTEND_URL}/admin/settlements/${settlement._id}`
          }
        };

        await emailService.sendEmail(escalationEmailData);
      }

      // Record communication
      settlement.communications.push({
        type: 'email',
        direction: 'outbound',
        subject: `Escalation Level ${settlement.escalationLevel}`,
        message: escalationMessage,
        sentAt: new Date()
      });

      await settlement.save();

      logger.debug(`⬆️ Escalated settlement ${settlement.settlementNumber} to level ${settlement.escalationLevel}`);

    } catch (error) {
      logger.error(`❌ Error escalating settlement ${settlement._id}:`, error);
    }
  }

  // Manual notification methods (for immediate use)
  async sendImmediateReminder(settlementId, reminderType = 'payment_reminder') {
    try {
      const settlement = await Settlement.findById(settlementId).populate({
        path: 'bookingId',
        populate: { path: 'userId hotelId' }
      }).lean();

      if (!settlement) {
        throw new Error('Settlement not found');
      }

      switch (reminderType) {
        case 'payment_reminder':
          await this.sendPaymentReminder(settlement);
          break;
        case 'final_notice':
          await this.sendFinalNotice(settlement);
          break;
        case 'courtesy_reminder':
          await this.sendCourtesyReminder(settlement);
          break;
        default:
          throw new Error('Invalid reminder type');
      }

      return { success: true, message: 'Reminder sent successfully' };
    } catch (error) {
      logger.error('❌ Error sending immediate reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPaymentReminder(settlement) {
    try {
      const booking = settlement.bookingId;
      const guest = booking.userId;
      const hotel = booking.hotelId;

      const emailData = {
        to: guest.email,
        subject: `Payment Reminder: Settlement ${settlement.settlementNumber}`,
        template: 'settlement-reminder',
        data: {
          guestName: guest.name,
          hotelName: hotel.name,
          bookingNumber: booking.bookingNumber,
          settlementNumber: settlement.settlementNumber,
          outstandingAmount: settlement.outstandingBalance,
          dueDate: settlement.dueDate.toLocaleDateString(),
          paymentLink: `${process.env.FRONTEND_URL}/settlements/${settlement._id}/pay`
        }
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async sendFinalNotice(settlement) {
    try {
      const booking = settlement.bookingId;
      const guest = booking.userId;
      const hotel = booking.hotelId;

      const emailData = {
        to: guest.email,
        subject: `Final Notice: Settlement ${settlement.settlementNumber}`,
        template: 'settlement-final-notice',
        data: {
          guestName: guest.name,
          hotelName: hotel.name,
          bookingNumber: booking.bookingNumber,
          settlementNumber: settlement.settlementNumber,
          outstandingAmount: settlement.outstandingBalance,
          dueDate: settlement.dueDate.toLocaleDateString(),
          paymentLink: `${process.env.FRONTEND_URL}/settlements/${settlement._id}/pay`,
          consequencesText: 'Failure to pay may result in collection activities and impact your credit rating.'
        }
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async sendCourtesyReminder(settlement) {
    try {
      const booking = settlement.bookingId;
      const guest = booking.userId;
      const hotel = booking.hotelId;

      const emailData = {
        to: guest.email,
        subject: `Courtesy Reminder: Settlement ${settlement.settlementNumber}`,
        template: 'settlement-courtesy',
        data: {
          guestName: guest.name,
          hotelName: hotel.name,
          bookingNumber: booking.bookingNumber,
          settlementNumber: settlement.settlementNumber,
          outstandingAmount: settlement.outstandingBalance,
          dueDate: settlement.dueDate.toLocaleDateString(),
          paymentLink: `${process.env.FRONTEND_URL}/settlements/${settlement._id}/pay`
        }
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  // Utility methods
  async getSettlementStats() {
    try {
      const stats = await Settlement.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$outstandingBalance' }
          }
        }
      ]);

      const overdueCount = await Settlement.countDocuments({
        status: { $in: ['pending', 'partial'] },
        dueDate: { $lt: new Date() }
      });

      return {
        byStatus: stats,
        overdueCount: overdueCount,
        lastProcessed: new Date()
      };
    } catch (error) {
      logger.error('❌ Error getting settlement stats:', error);
      return null;
    }
  }

  // Stop all scheduled jobs (for graceful shutdown)
  stop() {
    logger.debug('🛑 Stopping settlement notification service...');
    // Cron jobs will stop when the process exits
  }
}

// Create singleton instance
export const settlementNotificationService = new SettlementNotificationService();
export default settlementNotificationService;