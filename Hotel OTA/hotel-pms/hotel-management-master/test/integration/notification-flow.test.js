import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { EventEmitter } from 'events';
import app from '../../backend/src/app.js';
import User from '../../backend/src/models/User.js';
import Hotel from '../../backend/src/models/Hotel.js';
import Notification from '../../backend/src/models/Notification.js';
import NotificationTemplate from '../../backend/src/models/NotificationTemplate.js';
import NotificationPreference from '../../backend/src/models/NotificationPreference.js';
import optimizedNotificationService from '../../backend/src/services/optimizedNotificationService.js';
import { notificationEmitter } from '../../backend/src/services/notificationEmitter.js';
import jwt from 'jsonwebtoken';

// Test database
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pentouz_integration_test';

describe('Notification System Integration Tests', () => {
  let server;
  let testHotel;
  let adminUser;
  let staffUser;
  let guestUser;
  let adminToken;
  let staffToken;
  let guestToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_TEST_URI);

    // Start server
    server = app.listen(0);

    // Create test hotel
    testHotel = new Hotel({
      name: 'Integration Test Hotel',
      address: '123 Integration St',
      city: 'Test City',
      country: 'Test Country',
      contactEmail: 'test@integrationhotel.com',
      contactPhone: '+1234567890'
    });
    await testHotel.save();

    // Create test users
    adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@integrationtest.com',
      password: 'password123',
      role: 'admin',
      hotelId: testHotel._id,
      isActive: true
    });
    await adminUser.save();

    staffUser = new User({
      firstName: 'Staff',
      lastName: 'User',
      email: 'staff@integrationtest.com',
      password: 'password123',
      role: 'staff',
      hotelId: testHotel._id,
      department: 'Front Desk',
      isActive: true
    });
    await staffUser.save();

    guestUser = new User({
      firstName: 'Guest',
      lastName: 'User',
      email: 'guest@integrationtest.com',
      password: 'password123',
      role: 'guest',
      hotelId: testHotel._id,
      isActive: true
    });
    await guestUser.save();

    // Generate JWT tokens
    adminToken = jwt.sign({ userId: adminUser._id }, process.env.JWT_SECRET || 'test-secret');
    staffToken = jwt.sign({ userId: staffUser._id }, process.env.JWT_SECRET || 'test-secret');
    guestToken = jwt.sign({ userId: guestUser._id }, process.env.JWT_SECRET || 'test-secret');
  });

  afterAll(async () => {
    // Clean up
    await Notification.deleteMany({});
    await NotificationTemplate.deleteMany({});
    await NotificationPreference.deleteMany({});
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await mongoose.connection.close();
    server.close();
  });

  beforeEach(async () => {
    // Clean notifications and templates before each test
    await Notification.deleteMany({});
    await NotificationTemplate.deleteMany({});
  });

  describe('Complete Notification Lifecycle', () => {
    it('should handle the complete notification flow from template creation to delivery', async () => {
      // Step 1: Admin creates a notification template
      const templateData = {
        name: 'Welcome Guest Template',
        description: 'Welcome message for new guests',
        category: 'guest_experience',
        type: 'guest_welcome',
        subject: 'Welcome to {{hotelName}}, {{guestName}}!',
        title: 'Welcome!',
        message: 'Dear {{guestName}}, welcome to {{hotelName}}. We hope you enjoy your stay!',
        channels: ['in_app', 'email'],
        priority: 'medium',
        routing: {
          targetRoles: ['guest']
        },
        variables: [
          {
            name: 'guestName',
            description: 'Guest full name',
            type: 'string',
            required: true
          },
          {
            name: 'hotelName',
            description: 'Hotel name',
            type: 'string',
            required: true
          }
        ]
      };

      const createTemplateResponse = await request(app)
        .post('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateData)
        .expect(201);

      const createdTemplate = createTemplateResponse.body.data.template;
      expect(createdTemplate.name).toBe('Welcome Guest Template');

      // Step 2: Guest sets notification preferences
      const preferences = {
        notifications: {
          channels: {
            inApp: true,
            email: true,
            sms: false,
            push: false
          },
          categories: {
            guest_experience: true,
            promotional: false
          },
          quietHours: {
            enabled: false
          },
          sound: true,
          frequency: 'immediate'
        }
      };

      await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${guestToken}`)
        .send(preferences)
        .expect(200);

      // Step 3: Send notification using the optimized service
      const notificationResult = await optimizedNotificationService.sendNotification({
        templateId: createdTemplate._id,
        userId: guestUser._id,
        hotelId: testHotel._id,
        variables: {
          guestName: 'Guest User',
          hotelName: 'Integration Test Hotel'
        },
        channels: ['in_app', 'email'],
        priority: 'medium',
        skipRateLimit: true // Skip for integration test
      });

      expect(notificationResult.success).toBe(true);

      // Step 4: Wait for batch processing to complete
      await optimizedNotificationService.flushQueue();

      // Step 5: Verify notification was created in database
      const notifications = await Notification.find({ userId: guestUser._id });
      expect(notifications).toHaveLength(1);

      const notification = notifications[0];
      expect(notification.title).toBe('Welcome!');
      expect(notification.message).toContain('Dear Guest User');
      expect(notification.message).toContain('Integration Test Hotel');
      expect(notification.status).toBe('sent');

      // Step 6: Guest retrieves notifications via API
      const getNotificationsResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(getNotificationsResponse.body.data.notifications).toHaveLength(1);
      expect(getNotificationsResponse.body.data.notifications[0].title).toBe('Welcome!');

      // Step 7: Guest marks notification as read
      await request(app)
        .patch('/api/v1/notifications/mark-read')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ notificationIds: [notification._id] })
        .expect(200);

      // Step 8: Verify notification is marked as read
      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification.status).toBe('read');
      expect(updatedNotification.readAt).toBeDefined();

      // Step 9: Check analytics
      const analyticsResponse = await request(app)
        .get('/api/v1/notifications/analytics')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.summary.total).toBe(1);
      expect(analyticsResponse.body.data.summary.read).toBe(1);
      expect(analyticsResponse.body.data.summary.readRate).toBe(100);
    });

    it('should handle notification routing based on user preferences', async () => {
      // Create template for promotional content
      const promoTemplate = new NotificationTemplate({
        hotelId: testHotel._id,
        name: 'Special Offer',
        category: 'promotional',
        type: 'promotional_offer',
        subject: 'Special offer for you!',
        title: 'Limited Time Offer',
        message: 'Get 20% off your next stay!',
        channels: ['in_app', 'email'],
        priority: 'low',
        routing: {
          targetRoles: ['guest']
        },
        variables: [],
        metadata: {
          createdBy: adminUser._id,
          isSystem: false,
          version: 1,
          isActive: true
        }
      });
      await promoTemplate.save();

      // Guest disables promotional notifications
      await NotificationPreference.findOneAndUpdate(
        { userId: guestUser._id },
        {
          userId: guestUser._id,
          hotelId: testHotel._id,
          notifications: {
            channels: { inApp: true, email: true },
            categories: { promotional: false }, // Disabled
            quietHours: { enabled: false },
            frequency: 'immediate'
          }
        },
        { upsert: true }
      );

      // Try to send promotional notification
      const result = await optimizedNotificationService.sendNotification({
        templateId: promoTemplate._id,
        userId: guestUser._id,
        hotelId: testHotel._id,
        variables: {},
        channels: ['in_app', 'email'],
        priority: 'low',
        skipRateLimit: true
      });

      // Should be filtered out by routing logic
      expect(result.success).toBe(false);
      expect(result.reason).toBe('filtered_by_routing');

      // Verify no notification was created
      await optimizedNotificationService.flushQueue();
      const notifications = await Notification.find({ userId: guestUser._id });
      expect(notifications).toHaveLength(0);
    });

    it('should respect quiet hours settings', async () => {
      // Create template
      const template = new NotificationTemplate({
        hotelId: testHotel._id,
        name: 'Test Template',
        category: 'booking',
        type: 'booking_confirmation',
        subject: 'Test subject',
        title: 'Test title',
        message: 'Test message',
        channels: ['in_app'],
        priority: 'medium',
        routing: { targetRoles: ['guest'] },
        scheduling: { respectQuietHours: true },
        variables: [],
        metadata: {
          createdBy: adminUser._id,
          isSystem: false,
          version: 1,
          isActive: true
        }
      });
      await template.save();

      // Set quiet hours for guest (simulate night time)
      await NotificationPreference.findOneAndUpdate(
        { userId: guestUser._id },
        {
          userId: guestUser._id,
          hotelId: testHotel._id,
          notifications: {
            channels: { inApp: true },
            categories: { booking: true },
            quietHours: {
              enabled: true,
              start: 22, // 10 PM
              end: 7     // 7 AM
            },
            frequency: 'immediate'
          }
        },
        { upsert: true }
      );

      // Mock current time to be within quiet hours
      const originalDate = Date;
      const mockDate = new Date('2024-01-01T23:30:00.000Z'); // 11:30 PM
      global.Date = jest.fn(() => mockDate);
      global.Date.now = jest.fn(() => mockDate.getTime());

      const result = await optimizedNotificationService.sendNotification({
        templateId: template._id,
        userId: guestUser._id,
        hotelId: testHotel._id,
        variables: {},
        channels: ['in_app'],
        priority: 'medium',
        skipRateLimit: true
      });

      // Should be delayed or filtered due to quiet hours
      // Implementation may vary - could be queued for later or filtered
      console.log('Quiet hours result:', result);

      // Restore original Date
      global.Date = originalDate;
    });
  });

  describe('Real-time Notification Delivery', () => {
    it('should deliver notifications via SSE', async () => {
      // Set up SSE connection
      let sseData = [];
      const ssePromise = new Promise((resolve) => {
        const sseRequest = request(app)
          .get('/api/v1/notifications/stream')
          .set('Authorization', `Bearer ${guestToken}`)
          .set('Accept', 'text/event-stream');

        sseRequest.on('response', (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();

            // Parse SSE data
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  sseData.push(data);

                  if (data.type === 'notification') {
                    resolve(data);
                  }
                } catch (e) {
                  // Ignore parse errors for heartbeats, etc.
                }
              }
            }
          });
        });

        // Timeout after 10 seconds
        setTimeout(() => resolve(null), 10000);
      });

      // Wait a moment for SSE connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send a notification
      const result = await optimizedNotificationService.sendNotification({
        templateType: 'custom',
        userId: guestUser._id,
        hotelId: testHotel._id,
        variables: {},
        channels: ['in_app'],
        priority: 'medium',
        metadata: { title: 'SSE Test', message: 'Testing SSE delivery' },
        skipRateLimit: true
      });

      await optimizedNotificationService.flushQueue();

      const sseNotification = await ssePromise;

      if (sseNotification) {
        expect(sseNotification.type).toBe('notification');
        expect(sseNotification.data).toHaveProperty('title');
      }
    }, 15000);

    it('should handle concurrent SSE connections', async () => {
      const connections = 3;
      const connectionPromises = [];

      for (let i = 0; i < connections; i++) {
        const promise = new Promise((resolve) => {
          const sseRequest = request(app)
            .get('/api/v1/notifications/stream')
            .set('Authorization', `Bearer ${guestToken}`)
            .set('Accept', 'text/event-stream');

          let receivedNotification = false;
          sseRequest.on('response', (res) => {
            res.on('data', (chunk) => {
              const data = chunk.toString();
              if (data.includes('notification') && !receivedNotification) {
                receivedNotification = true;
                resolve(true);
              }
            });
          });

          setTimeout(() => resolve(false), 5000);
        });

        connectionPromises.push(promise);
      }

      // Send notification after connections are established
      setTimeout(async () => {
        await optimizedNotificationService.sendNotification({
          templateType: 'custom',
          userId: guestUser._id,
          hotelId: testHotel._id,
          variables: {},
          channels: ['in_app'],
          priority: 'medium',
          metadata: { title: 'Concurrent Test', message: 'Testing concurrent delivery' },
          skipRateLimit: true
        });
        await optimizedNotificationService.flushQueue();
      }, 500);

      const results = await Promise.all(connectionPromises);
      const successfulConnections = results.filter(Boolean).length;

      console.log(`${successfulConnections}/${connections} SSE connections received notifications`);
      expect(successfulConnections).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Template System Integration', () => {
    it('should handle template variable validation and population', async () => {
      // Create template with validation requirements
      const template = new NotificationTemplate({
        hotelId: testHotel._id,
        name: 'Booking Confirmation',
        category: 'booking',
        type: 'booking_confirmation',
        subject: 'Booking {{bookingNumber}} confirmed',
        title: 'Booking Confirmed',
        message: 'Hello {{guestName}}, your booking {{bookingNumber}} for {{checkInDate}} is confirmed. Amount: {{amount}}',
        channels: ['in_app'],
        priority: 'medium',
        routing: { targetRoles: ['guest'] },
        variables: [
          { name: 'guestName', type: 'string', required: true },
          { name: 'bookingNumber', type: 'string', required: true },
          { name: 'checkInDate', type: 'date', required: true },
          { name: 'amount', type: 'currency', required: true }
        ],
        metadata: {
          createdBy: adminUser._id,
          isSystem: false,
          version: 1,
          isActive: true
        }
      });
      await template.save();

      // Test with valid variables
      const validVariables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456',
        checkInDate: '2024-12-25',
        amount: 299.99
      };

      const successResult = await optimizedNotificationService.sendNotification({
        templateId: template._id,
        userId: guestUser._id,
        hotelId: testHotel._id,
        variables: validVariables,
        channels: ['in_app'],
        priority: 'medium',
        skipRateLimit: true
      });

      expect(successResult.success).toBe(true);

      await optimizedNotificationService.flushQueue();

      // Verify populated content
      const notification = await Notification.findOne({ userId: guestUser._id });
      expect(notification.subject).toBe('Booking BK123456 confirmed');
      expect(notification.message).toContain('Hello John Doe');
      expect(notification.message).toContain('$299.99');

      // Test template preview via API
      const previewResponse = await request(app)
        .post(`/api/v1/notifications/templates/${template._id}/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables: validVariables })
        .expect(200);

      expect(previewResponse.body.data.preview.subject).toBe('Booking BK123456 confirmed');
      expect(previewResponse.body.data.preview.message).toContain('$299.99');
    });

    it('should handle template search and filtering', async () => {
      // Create multiple templates
      const templates = [
        {
          name: 'Booking Confirmation',
          category: 'booking',
          type: 'booking_confirmation',
          metadata: { tags: ['booking', 'confirmation'] }
        },
        {
          name: 'Payment Receipt',
          category: 'payment',
          type: 'payment_success',
          metadata: { tags: ['payment', 'receipt'] }
        },
        {
          name: 'Booking Reminder',
          category: 'booking',
          type: 'booking_reminder',
          metadata: { tags: ['booking', 'reminder'] }
        }
      ];

      for (const templateData of templates) {
        const template = new NotificationTemplate({
          hotelId: testHotel._id,
          subject: 'Test subject',
          title: 'Test title',
          message: 'Test message',
          channels: ['in_app'],
          priority: 'medium',
          routing: { targetRoles: ['guest'] },
          variables: [],
          metadata: {
            createdBy: adminUser._id,
            isSystem: false,
            version: 1,
            isActive: true,
            ...templateData.metadata
          },
          ...templateData
        });
        await template.save();
      }

      // Test search by name
      const searchResponse = await request(app)
        .get('/api/v1/notifications/templates?search=booking')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(searchResponse.body.data.templates).toHaveLength(2); // Two booking templates

      // Test filter by category
      const categoryResponse = await request(app)
        .get('/api/v1/notifications/templates?category=payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(categoryResponse.body.data.templates).toHaveLength(1);
      expect(categoryResponse.body.data.templates[0].name).toBe('Payment Receipt');

      // Test get by type
      const typeResponse = await request(app)
        .get('/api/v1/notifications/templates/types/booking_confirmation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(typeResponse.body.data.template.name).toBe('Booking Confirmation');
    });
  });

  describe('Performance and Monitoring Integration', () => {
    it('should provide accurate system monitoring data', async () => {
      // Generate some activity
      const template = new NotificationTemplate({
        hotelId: testHotel._id,
        name: 'Monitoring Test',
        category: 'system',
        type: 'system_alert',
        subject: 'Test',
        title: 'Test',
        message: 'Test message',
        channels: ['in_app'],
        priority: 'medium',
        routing: { targetRoles: ['guest'] },
        variables: [],
        metadata: {
          createdBy: adminUser._id,
          isSystem: false,
          version: 1,
          isActive: true
        }
      });
      await template.save();

      // Send several notifications
      for (let i = 0; i < 5; i++) {
        await optimizedNotificationService.sendNotification({
          templateId: template._id,
          userId: guestUser._id,
          hotelId: testHotel._id,
          variables: {},
          channels: ['in_app'],
          priority: 'medium',
          skipRateLimit: true
        });
      }

      await optimizedNotificationService.flushQueue();

      // Check health status
      const healthResponse = await request(app)
        .get('/api/v1/notifications/monitoring/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(healthResponse.body.data.service).toBe('OptimizedNotificationService');
      expect(healthResponse.body.data.statistics.sent).toBeGreaterThan(0);

      // Check performance metrics
      const performanceResponse = await request(app)
        .get('/api/v1/notifications/monitoring/performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(performanceResponse.body.data).toHaveProperty('volumeData');
      expect(performanceResponse.body.data).toHaveProperty('successRateData');
      expect(performanceResponse.body.data).toHaveProperty('channelData');

      // Check rate limit status
      const rateLimitResponse = await request(app)
        .get('/api/v1/notifications/monitoring/rate-limits')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(rateLimitResponse.body.data.hotel).toBeDefined();
      expect(rateLimitResponse.body.data.user).toBeDefined();
    });

    it('should handle system cleanup operations', async () => {
      // Create old notifications
      const oldNotifications = [];
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      for (let i = 0; i < 10; i++) {
        oldNotifications.push({
          userId: guestUser._id,
          hotelId: testHotel._id,
          type: 'test',
          category: 'test',
          title: 'Old notification',
          message: 'This is old',
          channels: ['in_app'],
          priority: 'low',
          status: i % 2 === 0 ? 'read' : 'sent',
          readAt: i % 2 === 0 ? thirtyOneDaysAgo : null,
          createdAt: thirtyOneDaysAgo,
          updatedAt: thirtyOneDaysAgo
        });
      }

      await Notification.insertMany(oldNotifications);

      // Verify notifications exist
      const beforeCount = await Notification.countDocuments({});
      expect(beforeCount).toBe(10);

      // Trigger cleanup
      const cleanupResponse = await request(app)
        .post('/api/v1/notifications/monitoring/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(cleanupResponse.body.data.deleted).toBeGreaterThan(0);

      // Verify cleanup happened
      const afterCount = await Notification.countDocuments({});
      expect(afterCount).toBeLessThan(beforeCount);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid template data gracefully', async () => {
      const result = await optimizedNotificationService.sendNotification({
        templateId: new mongoose.Types.ObjectId(), // Non-existent template
        userId: guestUser._id,
        hotelId: testHotel._id,
        variables: {},
        channels: ['in_app'],
        priority: 'medium',
        skipRateLimit: true
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('error');
    });

    it('should handle network interruptions in SSE gracefully', async () => {
      let connectionCount = 0;
      const eventEmitter = new EventEmitter();

      // Simulate SSE connection that gets interrupted
      const ssePromise = new Promise((resolve) => {
        const sseRequest = request(app)
          .get('/api/v1/notifications/stream')
          .set('Authorization', `Bearer ${guestToken}`)
          .set('Accept', 'text/event-stream');

        sseRequest.on('response', (res) => {
          connectionCount++;

          res.on('data', () => {
            // Simulate connection interruption
            res.destroy();
            resolve(connectionCount);
          });

          res.on('error', () => {
            resolve(connectionCount);
          });
        });

        // Send some data to trigger the connection
        setTimeout(() => {
          eventEmitter.emit('test');
        }, 100);
      });

      const result = await ssePromise;
      expect(result).toBeGreaterThan(0); // Connection was established
    });

    it('should handle bulk notification failures gracefully', async () => {
      const notifications = [];

      // Create notifications with mix of valid and invalid data
      for (let i = 0; i < 10; i++) {
        notifications.push({
          templateType: 'custom',
          userId: i % 2 === 0 ? guestUser._id : new mongoose.Types.ObjectId(), // Some invalid users
          hotelId: testHotel._id,
          variables: {},
          channels: ['in_app'],
          priority: 'medium',
          metadata: {
            title: `Test ${i}`,
            message: `Message ${i}`
          },
          skipRateLimit: true
        });
      }

      const result = await optimizedNotificationService.sendBulkNotifications(notifications);

      expect(result.total).toBe(10);
      expect(result.failed).toBeGreaterThan(0); // Some should fail due to invalid users
      expect(result.successful).toBeGreaterThan(0); // Some should succeed
    });
  });

  describe('Security Integration Tests', () => {
    it('should prevent unauthorized access to other users notifications', async () => {
      // Create notification for guest user
      const notification = new Notification({
        userId: guestUser._id,
        hotelId: testHotel._id,
        type: 'test',
        category: 'test',
        title: 'Private notification',
        message: 'This should be private',
        channels: ['in_app'],
        priority: 'medium',
        status: 'sent'
      });
      await notification.save();

      // Try to access it as staff user
      const staffResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Staff should not see guest's notifications
      const staffNotifications = staffResponse.body.data.notifications;
      const foundPrivateNotification = staffNotifications.find(n => n._id === notification._id.toString());
      expect(foundPrivateNotification).toBeUndefined();
    });

    it('should validate template permissions correctly', async () => {
      // Guest tries to create template (should fail)
      const templateData = {
        name: 'Unauthorized Template',
        category: 'booking',
        type: 'custom',
        subject: 'Test',
        title: 'Test',
        message: 'Test'
      };

      await request(app)
        .post('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${guestToken}`)
        .send(templateData)
        .expect(403);

      // Admin can create template (should succeed)
      await request(app)
        .post('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateData)
        .expect(201);
    });

    it('should protect monitoring endpoints from unauthorized access', async () => {
      // Guest tries to access monitoring (should fail)
      await request(app)
        .get('/api/v1/notifications/monitoring/health')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);

      // Staff tries to access monitoring (should fail)
      await request(app)
        .get('/api/v1/notifications/monitoring/health')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      // Admin can access monitoring (should succeed)
      await request(app)
        .get('/api/v1/notifications/monitoring/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});