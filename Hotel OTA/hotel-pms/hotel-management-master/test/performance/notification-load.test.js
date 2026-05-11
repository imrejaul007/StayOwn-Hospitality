import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../backend/src/models/User.js';
import Hotel from '../../backend/src/models/Hotel.js';
import NotificationTemplate from '../../backend/src/models/NotificationTemplate.js';
import optimizedNotificationService from '../../backend/src/services/optimizedNotificationService.js';
import notificationCache from '../../backend/src/services/notificationCache.js';
import rateLimiter from '../../backend/src/services/rateLimiter.js';

// Test database
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pentouz_load_test';

describe('Notification System Load Tests', () => {
  let testHotel;
  let testUsers = [];
  let testTemplates = [];

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_TEST_URI);

    // Create test hotel
    testHotel = new Hotel({
      name: 'Load Test Hotel',
      address: '123 Load Test St',
      city: 'Test City',
      country: 'Test Country'
    });
    await testHotel.save();

    // Create test users (1000 users)
    console.log('Creating 1000 test users...');
    const userPromises = [];
    for (let i = 0; i < 1000; i++) {
      userPromises.push(
        User.create({
          firstName: `User${i}`,
          lastName: 'Test',
          email: `user${i}@loadtest.com`,
          password: 'password123',
          role: i % 10 === 0 ? 'admin' : i % 5 === 0 ? 'staff' : 'guest',
          hotelId: testHotel._id,
          isActive: true,
          department: i % 5 === 0 ? 'Front Desk' : undefined
        })
      );

      // Process in batches to avoid memory issues
      if (userPromises.length === 100) {
        const batch = await Promise.all(userPromises);
        testUsers.push(...batch);
        userPromises.length = 0;
      }
    }

    // Process remaining users
    if (userPromises.length > 0) {
      const batch = await Promise.all(userPromises);
      testUsers.push(...batch);
    }

    console.log(`Created ${testUsers.length} test users`);

    // Create test templates
    const templates = [
      {
        name: 'Load Test Booking',
        category: 'booking',
        type: 'booking_confirmation',
        subject: 'Booking {{bookingNumber}} confirmed',
        title: 'Booking Confirmed',
        message: 'Hello {{guestName}}, your booking is confirmed.',
        variables: [
          { name: 'guestName', type: 'string', required: true },
          { name: 'bookingNumber', type: 'string', required: true }
        ]
      },
      {
        name: 'Load Test Payment',
        category: 'payment',
        type: 'payment_success',
        subject: 'Payment {{amount}} received',
        title: 'Payment Confirmed',
        message: 'Payment of {{amount}} confirmed for {{guestName}}.',
        variables: [
          { name: 'guestName', type: 'string', required: true },
          { name: 'amount', type: 'currency', required: true }
        ]
      },
      {
        name: 'Load Test Service',
        category: 'service',
        type: 'service_booking',
        subject: 'Service booked for {{date}}',
        title: 'Service Booking',
        message: 'Your {{serviceName}} is booked for {{date}}.',
        variables: [
          { name: 'serviceName', type: 'string', required: true },
          { name: 'date', type: 'date', required: true }
        ]
      }
    ];

    for (const templateData of templates) {
      const template = new NotificationTemplate({
        ...templateData,
        hotelId: testHotel._id,
        channels: ['in_app', 'email'],
        priority: 'medium',
        routing: { targetRoles: ['guest'] },
        metadata: {
          createdBy: testUsers[0]._id,
          isSystem: false,
          version: 1,
          isActive: true
        }
      });
      await template.save();
      testTemplates.push(template);
    }

    console.log('Load test setup completed');
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await NotificationTemplate.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Cache Performance Tests', () => {
    it('should handle concurrent cache operations', async () => {
      const startTime = Date.now();
      const operations = [];

      // Simulate 100 concurrent cache operations
      for (let i = 0; i < 100; i++) {
        const user = testUsers[i];
        operations.push(
          Promise.all([
            notificationCache.getUserProfile(user._id),
            notificationCache.getUserPreferences(user._id),
            notificationCache.getTemplateByType(testHotel._id, 'booking_confirmation')
          ])
        );
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`100 concurrent cache operations completed in ${duration}ms`);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toHaveLength(100);
    });

    it('should warm up user cache efficiently', async () => {
      const startTime = Date.now();
      const userIds = testUsers.slice(0, 100).map(user => user._id.toString());

      await optimizedNotificationService.warmupUserCache(userIds);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Cache warmup for 100 users completed in ${duration}ms`);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle cache misses gracefully', async () => {
      const startTime = Date.now();
      const operations = [];

      // Request data for non-existent users
      for (let i = 0; i < 50; i++) {
        const fakeId = new mongoose.Types.ObjectId();
        operations.push(
          notificationCache.getUserProfile(fakeId),
          notificationCache.getUserPreferences(fakeId)
        );
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`50 cache misses handled in ${duration}ms`);
      expect(duration).toBeLessThan(3000); // Should handle misses quickly
      expect(results.every(result => result === null)).toBe(true);
    });
  });

  describe('Rate Limiting Performance Tests', () => {
    it('should handle high-frequency rate limit checks', async () => {
      const startTime = Date.now();
      const checks = [];

      // Simulate 500 rapid rate limit checks
      for (let i = 0; i < 500; i++) {
        const user = testUsers[i % 100]; // Cycle through 100 users
        checks.push(
          rateLimiter.canSendNotification({
            hotelId: testHotel._id,
            userId: user._id,
            templateId: testTemplates[0]._id,
            category: 'booking',
            channels: ['in_app'],
            priority: 'medium'
          })
        );
      }

      const results = await Promise.all(checks);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`500 rate limit checks completed in ${duration}ms`);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.every(result => typeof result.allowed === 'boolean')).toBe(true);
    });

    it('should efficiently track rate limit counters', async () => {
      const startTime = Date.now();
      const records = [];

      // Record 200 notification sends
      for (let i = 0; i < 200; i++) {
        const user = testUsers[i % 50]; // Cycle through 50 users
        records.push(
          rateLimiter.recordNotificationSent({
            hotelId: testHotel._id,
            userId: user._id,
            templateId: testTemplates[i % 3]._id,
            category: testTemplates[i % 3].category,
            channels: ['in_app', 'email']
          })
        );
      }

      await Promise.all(records);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`200 rate limit records completed in ${duration}ms`);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Bulk Notification Performance Tests', () => {
    it('should send 1000 notifications efficiently', async () => {
      const startTime = Date.now();
      const notifications = [];

      // Create 1000 notification requests
      for (let i = 0; i < 1000; i++) {
        const user = testUsers[i];
        const template = testTemplates[i % testTemplates.length];

        notifications.push({
          templateId: template._id,
          userId: user._id,
          hotelId: testHotel._id,
          variables: {
            guestName: `${user.firstName} ${user.lastName}`,
            bookingNumber: `BK${String(i).padStart(6, '0')}`,
            amount: 299.99,
            serviceName: 'Spa Service',
            date: new Date().toISOString()
          },
          channels: ['in_app', 'email'],
          priority: 'medium',
          skipRateLimit: true // Skip for load testing
        });
      }

      console.log('Sending 1000 notifications...');
      const result = await optimizedNotificationService.sendBulkNotifications(notifications);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`1000 notifications processed in ${duration}ms`);
      console.log(`Success rate: ${(result.successful / result.total * 100).toFixed(2)}%`);

      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.successful).toBeGreaterThan(950); // At least 95% success rate
      expect(result.failed).toBeLessThan(50); // Less than 5% failure rate
    }, 60000); // 60 second timeout

    it('should handle concurrent bulk operations', async () => {
      const startTime = Date.now();
      const bulkOperations = [];

      // Create 5 concurrent bulk operations of 100 notifications each
      for (let batch = 0; batch < 5; batch++) {
        const batchNotifications = [];

        for (let i = 0; i < 100; i++) {
          const userIndex = (batch * 100 + i) % testUsers.length;
          const user = testUsers[userIndex];
          const template = testTemplates[i % testTemplates.length];

          batchNotifications.push({
            templateId: template._id,
            userId: user._id,
            hotelId: testHotel._id,
            variables: {
              guestName: `${user.firstName} ${user.lastName}`,
              bookingNumber: `BK${String(batch * 100 + i).padStart(6, '0')}`
            },
            channels: ['in_app'],
            priority: 'medium',
            skipRateLimit: true
          });
        }

        bulkOperations.push(
          optimizedNotificationService.sendBulkNotifications(batchNotifications)
        );
      }

      console.log('Running 5 concurrent bulk operations...');
      const results = await Promise.all(bulkOperations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const totalSent = results.reduce((sum, result) => sum + result.successful, 0);
      const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);

      console.log(`5 concurrent bulk operations completed in ${duration}ms`);
      console.log(`Total sent: ${totalSent}, Failed: ${totalFailed}`);

      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
      expect(totalSent).toBeGreaterThan(475); // At least 95% success rate
    }, 60000);
  });

  describe('Template Performance Tests', () => {
    it('should handle concurrent template operations', async () => {
      const startTime = Date.now();
      const operations = [];

      // Simulate 200 concurrent template operations
      for (let i = 0; i < 200; i++) {
        const template = testTemplates[i % testTemplates.length];
        operations.push(
          Promise.all([
            notificationCache.getTemplate(testHotel._id, template._id),
            template.populateTemplate({
              guestName: `Guest ${i}`,
              bookingNumber: `BK${i}`,
              amount: 299.99,
              serviceName: 'Test Service',
              date: new Date().toISOString()
            }),
            template.validateVariables({
              guestName: `Guest ${i}`,
              bookingNumber: `BK${i}`
            })
          ])
        );
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`200 concurrent template operations completed in ${duration}ms`);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toHaveLength(200);
    });

    it('should efficiently populate complex templates', async () => {
      // Create a complex template with many variables
      const complexTemplate = new NotificationTemplate({
        hotelId: testHotel._id,
        name: 'Complex Template',
        category: 'booking',
        type: 'custom',
        subject: '{{title}} {{guestName}} - {{bookingNumber}} ({{hotelName}})',
        title: 'Complex Notification',
        message: `
          Dear {{title}} {{firstName}} {{lastName}},

          Your booking {{bookingNumber}} is confirmed for {{hotelName}}.
          Check-in: {{checkInDate}} at {{checkInTime}}
          Check-out: {{checkOutDate}} at {{checkOutTime}}
          Room: {{roomType}} - {{roomNumber}}
          Guests: {{adultCount}} adults, {{childCount}} children
          Total Amount: {{totalAmount}}

          Services booked:
          {{#services}}
          - {{serviceName}} on {{serviceDate}} at {{serviceTime}} ({{servicePrice}})
          {{/services}}

          Thank you for choosing {{hotelName}}!
        `,
        variables: [
          { name: 'title', type: 'string', required: false, defaultValue: 'Mr./Ms.' },
          { name: 'firstName', type: 'string', required: true },
          { name: 'lastName', type: 'string', required: true },
          { name: 'guestName', type: 'string', required: true },
          { name: 'bookingNumber', type: 'string', required: true },
          { name: 'hotelName', type: 'string', required: true },
          { name: 'checkInDate', type: 'date', required: true },
          { name: 'checkInTime', type: 'string', required: true },
          { name: 'checkOutDate', type: 'date', required: true },
          { name: 'checkOutTime', type: 'string', required: true },
          { name: 'roomType', type: 'string', required: true },
          { name: 'roomNumber', type: 'string', required: true },
          { name: 'adultCount', type: 'number', required: true },
          { name: 'childCount', type: 'number', required: true },
          { name: 'totalAmount', type: 'currency', required: true }
        ],
        channels: ['in_app', 'email'],
        priority: 'medium',
        routing: { targetRoles: ['guest'] },
        metadata: {
          createdBy: testUsers[0]._id,
          isSystem: false,
          version: 1,
          isActive: true
        }
      });

      const startTime = Date.now();
      const operations = [];

      // Test 100 complex template populations
      for (let i = 0; i < 100; i++) {
        const variables = {
          title: i % 2 === 0 ? 'Mr.' : 'Ms.',
          firstName: `First${i}`,
          lastName: `Last${i}`,
          guestName: `First${i} Last${i}`,
          bookingNumber: `BK${String(i).padStart(6, '0')}`,
          hotelName: 'Load Test Hotel',
          checkInDate: new Date(Date.now() + i * 86400000).toISOString(),
          checkInTime: '15:00',
          checkOutDate: new Date(Date.now() + (i + 3) * 86400000).toISOString(),
          checkOutTime: '11:00',
          roomType: 'Deluxe Suite',
          roomNumber: `${Math.floor(i / 10) + 1}0${(i % 10) + 1}`,
          adultCount: Math.floor(Math.random() * 4) + 1,
          childCount: Math.floor(Math.random() * 3),
          totalAmount: Math.floor(Math.random() * 500) + 200
        };

        operations.push(complexTemplate.populateTemplate(variables));
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`100 complex template populations completed in ${duration}ms`);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(results).toHaveLength(100);
      expect(results.every(result => result.subject && result.message)).toBe(true);
    });
  });

  describe('System Monitoring Performance Tests', () => {
    it('should generate analytics quickly under load', async () => {
      // First create some test notifications for analytics
      const notifications = [];
      for (let i = 0; i < 100; i++) {
        notifications.push({
          userId: testUsers[i]._id,
          hotelId: testHotel._id,
          type: testTemplates[i % testTemplates.length].type,
          category: testTemplates[i % testTemplates.length].category,
          title: 'Load Test Notification',
          message: 'This is a load test notification',
          channels: ['in_app'],
          priority: 'medium',
          status: Math.random() > 0.1 ? 'delivered' : 'failed',
          readAt: Math.random() > 0.2 ? new Date() : null
        });
      }

      // Insert notifications in the database directly for speed
      const Notification = mongoose.model('Notification');
      await Notification.insertMany(notifications);

      const startTime = Date.now();

      // Test health status generation
      const healthStatus = await optimizedNotificationService.getHealthStatus();

      // Test rate limit metrics
      const rateLimitMetrics = await rateLimiter.getMetrics();

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`System monitoring data generated in ${duration}ms`);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(healthStatus.service).toBe('OptimizedNotificationService');
      expect(rateLimitMetrics).toBeDefined();

      // Cleanup
      await Notification.deleteMany({});
    });

    it('should handle concurrent monitoring requests', async () => {
      const startTime = Date.now();
      const requests = [];

      // Simulate 50 concurrent monitoring requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          Promise.all([
            optimizedNotificationService.getHealthStatus(),
            rateLimiter.getRateLimitStatus(testHotel._id, testUsers[i % 10]._id)
          ])
        );
      }

      const results = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`50 concurrent monitoring requests completed in ${duration}ms`);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
      expect(results).toHaveLength(50);
    });
  });

  describe('Memory and Resource Tests', () => {
    it('should maintain reasonable memory usage during bulk operations', async () => {
      const startMemory = process.memoryUsage();
      console.log('Initial memory usage:', startMemory);

      // Process notifications in batches to test memory management
      const totalNotifications = 2000;
      const batchSize = 100;
      let processed = 0;

      while (processed < totalNotifications) {
        const batchNotifications = [];
        const currentBatchSize = Math.min(batchSize, totalNotifications - processed);

        for (let i = 0; i < currentBatchSize; i++) {
          const userIndex = (processed + i) % testUsers.length;
          const user = testUsers[userIndex];
          const template = testTemplates[(processed + i) % testTemplates.length];

          batchNotifications.push({
            templateId: template._id,
            userId: user._id,
            hotelId: testHotel._id,
            variables: {
              guestName: `${user.firstName} ${user.lastName}`,
              bookingNumber: `BK${String(processed + i).padStart(6, '0')}`
            },
            channels: ['in_app'],
            priority: 'medium',
            skipRateLimit: true
          });
        }

        await optimizedNotificationService.sendBulkNotifications(batchNotifications);
        processed += currentBatchSize;

        // Check memory usage every 500 notifications
        if (processed % 500 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - startMemory.heapUsed;
          console.log(`Processed ${processed} notifications, memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

          // Memory increase should be reasonable (less than 100MB per 500 notifications)
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
        }
      }

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - startMemory.heapUsed;
      console.log(`Final memory increase after ${totalNotifications} notifications: ${Math.round(totalMemoryIncrease / 1024 / 1024)}MB`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterGCMemory = process.memoryUsage();
      console.log('Memory after GC:', afterGCMemory);

      // Total memory increase should be reasonable
      expect(totalMemoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB max
    }, 120000); // 2 minute timeout

    it('should clean up resources properly', async () => {
      const initialStats = optimizedNotificationService.getStatistics();

      // Generate some load
      const notifications = [];
      for (let i = 0; i < 100; i++) {
        notifications.push({
          templateId: testTemplates[0]._id,
          userId: testUsers[i]._id,
          hotelId: testHotel._id,
          variables: { guestName: 'Test', bookingNumber: 'BK123' },
          channels: ['in_app'],
          skipRateLimit: true
        });
      }

      await optimizedNotificationService.sendBulkNotifications(notifications);

      // Wait for processing
      await optimizedNotificationService.flushQueue();

      const afterLoadStats = optimizedNotificationService.getStatistics();

      // Perform cleanup
      await optimizedNotificationService.cleanup();

      const afterCleanupStats = optimizedNotificationService.getStatistics();

      console.log('Initial stats:', initialStats);
      console.log('After load stats:', afterLoadStats);
      console.log('After cleanup stats:', afterCleanupStats);

      expect(afterLoadStats.sent).toBeGreaterThan(initialStats.sent);
      expect(afterCleanupStats.queueSize).toBe(0); // Queue should be empty
    });
  });
});

// Helper function to create performance report
function generatePerformanceReport(testResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResults.numPassedTests + testResults.numFailedTests,
      passed: testResults.numPassedTests,
      failed: testResults.numFailedTests,
      executionTime: testResults.perfStats?.end - testResults.perfStats?.start
    },
    performance: {
      cacheOperations: '< 5000ms for 100 concurrent operations',
      rateLimitChecks: '< 5000ms for 500 checks',
      bulkNotifications: '< 30000ms for 1000 notifications',
      templateOperations: '< 5000ms for 200 concurrent operations',
      memoryUsage: '< 200MB increase for 2000 notifications'
    }
  };

  console.log('\n📊 PERFORMANCE TEST REPORT');
  console.log('=' .repeat(50));
  console.log(JSON.stringify(report, null, 2));

  return report;
}

export { generatePerformanceReport };