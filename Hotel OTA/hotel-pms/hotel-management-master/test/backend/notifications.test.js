import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../backend/src/app.js';
import User from '../../backend/src/models/User.js';
import Hotel from '../../backend/src/models/Hotel.js';
import Notification from '../../backend/src/models/Notification.js';
import NotificationTemplate from '../../backend/src/models/NotificationTemplate.js';
import NotificationPreference from '../../backend/src/models/NotificationPreference.js';
import jwt from 'jsonwebtoken';

// Test database
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pentouz_test';

describe('Notification System API Tests', () => {
  let server;
  let testHotel;
  let adminUser;
  let staffUser;
  let guestUser;
  let adminToken;
  let staffToken;
  let guestToken;
  let testTemplate;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_TEST_URI);

    // Start server
    server = app.listen(0);

    // Create test hotel
    testHotel = new Hotel({
      name: 'Test Hotel',
      address: '123 Test St',
      city: 'Test City',
      country: 'Test Country',
      contactEmail: 'test@testhotel.com',
      contactPhone: '+1234567890'
    });
    await testHotel.save();

    // Create test users
    adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@testhotel.com',
      password: 'password123',
      role: 'admin',
      hotelId: testHotel._id,
      isActive: true
    });
    await adminUser.save();

    staffUser = new User({
      firstName: 'Staff',
      lastName: 'User',
      email: 'staff@testhotel.com',
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
      email: 'guest@testhotel.com',
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
    // Clean up test data
    await Notification.deleteMany({});
    await NotificationTemplate.deleteMany({});
    await NotificationPreference.deleteMany({});
    await User.deleteMany({});
    await Hotel.deleteMany({});

    // Close connections
    await mongoose.connection.close();
    server.close();
  });

  beforeEach(async () => {
    // Clean notifications before each test
    await Notification.deleteMany({});
    await NotificationTemplate.deleteMany({});
  });

  describe('Authentication & Authorization', () => {
    it('should require authentication for all notification routes', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .expect(401);

      expect(response.body.message).toContain('token');
    });

    it('should allow authenticated users to access notifications', async () => {
      await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);
    });

    it('should restrict admin routes to admin users only', async () => {
      await request(app)
        .get('/api/v1/notifications/monitoring/health')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);

      await request(app)
        .get('/api/v1/notifications/monitoring/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Notification CRUD Operations', () => {
    beforeEach(async () => {
      // Create a test notification
      const notification = new Notification({
        userId: guestUser._id,
        hotelId: testHotel._id,
        type: 'booking_confirmation',
        category: 'booking',
        title: 'Test Notification',
        message: 'This is a test notification',
        channels: ['in_app'],
        priority: 'medium',
        status: 'sent'
      });
      await notification.save();
    });

    it('should get user notifications with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?page=1&limit=20')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.notifications).toBeInstanceOf(Array);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('total', 1);
    });

    it('should filter notifications by status', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?status=sent')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
    });

    it('should filter notifications by type', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?type=booking_confirmation')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
    });

    it('should filter unread notifications only', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
    });

    it('should mark notifications as read', async () => {
      const notification = await Notification.findOne({ userId: guestUser._id });

      const response = await request(app)
        .patch('/api/v1/notifications/mark-read')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ notificationIds: [notification._id] })
        .expect(200);

      expect(response.body.data.modifiedCount).toBe(1);

      // Verify notification is marked as read
      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification.readAt).toBeDefined();
      expect(updatedNotification.status).toBe('read');
    });

    it('should delete notifications', async () => {
      const notification = await Notification.findOne({ userId: guestUser._id });

      await request(app)
        .delete(`/api/v1/notifications/${notification._id}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      // Verify notification is deleted
      const deletedNotification = await Notification.findById(notification._id);
      expect(deletedNotification).toBeNull();
    });

    it('should bulk delete notifications', async () => {
      const notification = await Notification.findOne({ userId: guestUser._id });

      const response = await request(app)
        .delete('/api/v1/notifications/bulk')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ notificationIds: [notification._id] })
        .expect(200);

      expect(response.body.data.deletedCount).toBe(1);
    });
  });

  describe('Notification Preferences', () => {
    it('should get user notification preferences', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.preferences).toHaveProperty('notifications');
    });

    it('should update notification preferences', async () => {
      const newPreferences = {
        notifications: {
          channels: {
            inApp: true,
            email: false,
            sms: false,
            push: true
          },
          categories: {
            bookings: true,
            payments: true,
            services: false,
            promotional: false
          },
          quietHours: {
            enabled: true,
            start: 22,
            end: 7
          },
          sound: false,
          frequency: 'digest'
        }
      };

      const response = await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${guestToken}`)
        .send(newPreferences)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.preferences.notifications.channels.email).toBe(false);
    });

    it('should validate preference updates', async () => {
      const invalidPreferences = {
        notifications: {
          channels: {
            invalid_channel: true
          }
        }
      };

      await request(app)
        .patch('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${guestToken}`)
        .send(invalidPreferences)
        .expect(400);
    });
  });

  describe('Notification Templates', () => {
    beforeEach(async () => {
      testTemplate = new NotificationTemplate({
        hotelId: testHotel._id,
        name: 'Test Template',
        description: 'Test template description',
        category: 'booking',
        type: 'booking_confirmation',
        subject: 'Booking Confirmed - {{bookingNumber}}',
        title: 'Booking Confirmed',
        message: 'Hello {{guestName}}, your booking {{bookingNumber}} is confirmed.',
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
            name: 'bookingNumber',
            description: 'Booking reference number',
            type: 'string',
            required: true
          }
        ],
        metadata: {
          createdBy: adminUser._id,
          isSystem: false,
          version: 1,
          isActive: true
        }
      });
      await testTemplate.save();
    });

    it('should get all templates for hotel', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.templates).toHaveLength(1);
      expect(response.body.data.templates[0].name).toBe('Test Template');
    });

    it('should get specific template by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/notifications/templates/${testTemplate._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.template.name).toBe('Test Template');
    });

    it('should create new template', async () => {
      const newTemplate = {
        name: 'Payment Success Template',
        description: 'Payment confirmation template',
        category: 'payment',
        type: 'payment_success',
        subject: 'Payment Received - {{amount}}',
        title: 'Payment Confirmed',
        message: 'Thank you {{guestName}}! Payment of {{amount}} received.',
        channels: ['in_app', 'email'],
        priority: 'medium',
        routing: {
          targetRoles: ['guest']
        },
        variables: [
          {
            name: 'guestName',
            description: 'Guest name',
            type: 'string',
            required: true
          },
          {
            name: 'amount',
            description: 'Payment amount',
            type: 'currency',
            required: true
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTemplate)
        .expect(201);

      expect(response.body.data.template.name).toBe('Payment Success Template');
    });

    it('should restrict template creation to admin/manager', async () => {
      const newTemplate = {
        name: 'Unauthorized Template',
        category: 'booking',
        type: 'custom'
      };

      await request(app)
        .post('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${guestToken}`)
        .send(newTemplate)
        .expect(403);
    });

    it('should update existing template', async () => {
      const updates = {
        name: 'Updated Test Template',
        description: 'Updated description'
      };

      const response = await request(app)
        .patch(`/api/v1/notifications/templates/${testTemplate._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.template.name).toBe('Updated Test Template');
      expect(response.body.data.template.metadata.version).toBe(2);
    });

    it('should delete (deactivate) template', async () => {
      await request(app)
        .delete(`/api/v1/notifications/templates/${testTemplate._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify template is deactivated, not deleted
      const deactivatedTemplate = await NotificationTemplate.findById(testTemplate._id);
      expect(deactivatedTemplate.metadata.isActive).toBe(false);
    });

    it('should preview template with variables', async () => {
      const variables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456'
      };

      const response = await request(app)
        .post(`/api/v1/notifications/templates/${testTemplate._id}/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables })
        .expect(200);

      expect(response.body.data.preview.subject).toBe('Booking Confirmed - BK123456');
      expect(response.body.data.preview.message).toContain('Hello John Doe');
    });

    it('should validate required variables in preview', async () => {
      const variables = {
        guestName: 'John Doe'
        // Missing required bookingNumber
      };

      const response = await request(app)
        .post(`/api/v1/notifications/templates/${testTemplate._id}/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables })
        .expect(400);

      expect(response.body.message).toContain('validation failed');
    });

    it('should get templates by category', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/templates/categories/booking')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.templates).toHaveLength(1);
    });

    it('should get template by type', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/templates/types/booking_confirmation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.template.type).toBe('booking_confirmation');
    });

    it('should initialize default templates', async () => {
      // Clear existing templates first
      await NotificationTemplate.deleteMany({});

      const response = await request(app)
        .post('/api/v1/notifications/templates/initialize')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.data.templates.length).toBeGreaterThan(0);
      expect(response.body.message).toContain('default templates created');
    });
  });

  describe('Notification Analytics', () => {
    beforeEach(async () => {
      // Create some test notifications for analytics
      const notifications = [
        {
          userId: guestUser._id,
          hotelId: testHotel._id,
          type: 'booking_confirmation',
          category: 'booking',
          title: 'Booking Confirmed',
          message: 'Your booking is confirmed',
          channels: ['in_app'],
          priority: 'medium',
          status: 'delivered',
          readAt: new Date()
        },
        {
          userId: guestUser._id,
          hotelId: testHotel._id,
          type: 'payment_success',
          category: 'payment',
          title: 'Payment Received',
          message: 'Payment successful',
          channels: ['email'],
          priority: 'high',
          status: 'sent'
        }
      ];

      await Notification.insertMany(notifications);
    });

    it('should get notification analytics for user', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/analytics')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.data.summary.total).toBe(2);
      expect(response.body.data.summary.unread).toBe(1);
      expect(response.body.data.summary.readRate).toBe(50);
    });

    it('should get notification analytics with time filter', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/analytics?days=7')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.data.summary.total).toBe(2);
    });
  });

  describe('Monitoring Routes', () => {
    it('should get system health status (admin only)', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/monitoring/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.service).toBe('OptimizedNotificationService');
      expect(response.body.data.status).toBe('healthy');
    });

    it('should get performance metrics (admin only)', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/monitoring/performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('volumeData');
      expect(response.body.data).toHaveProperty('successRateData');
      expect(response.body.data).toHaveProperty('channelData');
    });

    it('should get rate limit status (admin only)', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/monitoring/rate-limits')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('hotel');
      expect(response.body.data).toHaveProperty('user');
    });

    it('should get detailed metrics with timeframe', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/monitoring/metrics?timeframe=24h')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.timeframe).toBe('24h');
      expect(response.body.data).toHaveProperty('aggregations');
      expect(response.body.data).toHaveProperty('service');
    });

    it('should trigger system cleanup (admin only)', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/monitoring/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('Cleanup completed');
      expect(response.body.data).toHaveProperty('deleted');
      expect(response.body.data).toHaveProperty('archived');
    });

    it('should flush notification queue (admin only)', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/monitoring/flush-queue')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('flushed successfully');
    });
  });

  describe('SSE Stream', () => {
    it('should establish SSE connection for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/stream')
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Accept', 'text/event-stream')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent template', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/v1/notifications/templates/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should handle invalid template data', async () => {
      const invalidTemplate = {
        name: '', // Empty name should fail validation
        category: 'invalid_category'
      };

      await request(app)
        .post('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTemplate)
        .expect(400);
    });

    it('should handle invalid notification IDs', async () => {
      await request(app)
        .patch('/api/v1/notifications/mark-read')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ notificationIds: ['invalid-id'] })
        .expect(400);
    });
  });
});

describe('Template Model Tests', () => {
  let testTemplate;
  let testHotel;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_TEST_URI);
    }

    testHotel = new Hotel({
      name: 'Test Hotel',
      address: '123 Test St',
      city: 'Test City',
      country: 'Test Country'
    });
    await testHotel.save();
  });

  beforeEach(async () => {
    await NotificationTemplate.deleteMany({});

    testTemplate = new NotificationTemplate({
      hotelId: testHotel._id,
      name: 'Test Template',
      category: 'booking',
      type: 'booking_confirmation',
      subject: 'Booking {{bookingNumber}} confirmed for {{guestName}}',
      title: 'Booking Confirmed',
      message: 'Dear {{guestName}}, your booking {{bookingNumber}} for {{checkInDate}} is confirmed. Total: {{amount}}.',
      variables: [
        { name: 'guestName', type: 'string', required: true, description: 'Guest name' },
        { name: 'bookingNumber', type: 'string', required: true, description: 'Booking number' },
        { name: 'checkInDate', type: 'date', required: true, description: 'Check-in date' },
        { name: 'amount', type: 'currency', required: true, description: 'Total amount' }
      ],
      metadata: { isSystem: false, version: 1, isActive: true }
    });
    await testTemplate.save();
  });

  afterAll(async () => {
    await NotificationTemplate.deleteMany({});
    await Hotel.deleteMany({});
  });

  describe('populateTemplate method', () => {
    it('should populate template with provided variables', () => {
      const variables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456',
        checkInDate: '2024-12-25',
        amount: 299.99
      };

      const result = testTemplate.populateTemplate(variables);

      expect(result.subject).toBe('Booking BK123456 confirmed for John Doe');
      expect(result.title).toBe('Booking Confirmed');
      expect(result.message).toContain('Dear John Doe');
      expect(result.message).toContain('booking BK123456');
      expect(result.message).toContain('$299.99'); // Currency formatting
    });

    it('should use default values when variables not provided', () => {
      const template = new NotificationTemplate({
        hotelId: testHotel._id,
        subject: 'Hello {{name}}',
        message: 'Welcome {{name}}!',
        variables: [
          { name: 'name', type: 'string', defaultValue: 'Guest' }
        ]
      });

      const result = template.populateTemplate({});

      expect(result.subject).toBe('Hello Guest');
      expect(result.message).toBe('Welcome Guest!');
    });

    it('should format currency variables correctly', () => {
      const variables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456',
        checkInDate: '2024-12-25',
        amount: 1234.56
      };

      const result = testTemplate.populateTemplate(variables);

      expect(result.message).toContain('$1,234.56');
    });

    it('should format date variables correctly', () => {
      const variables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456',
        checkInDate: '2024-12-25T00:00:00.000Z',
        amount: 299.99
      };

      const result = testTemplate.populateTemplate(variables);

      // Should format date as locale string
      const expectedDate = new Date('2024-12-25T00:00:00.000Z').toLocaleDateString();
      expect(result.message).toContain(expectedDate);
    });
  });

  describe('validateVariables method', () => {
    it('should return no errors for valid variables', () => {
      const variables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456',
        checkInDate: '2024-12-25',
        amount: '299.99'
      };

      const errors = testTemplate.validateVariables(variables);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for missing required variables', () => {
      const variables = {
        guestName: 'John Doe',
        // Missing required bookingNumber, checkInDate, amount
      };

      const errors = testTemplate.validateVariables(variables);
      expect(errors).toHaveLength(3);
      expect(errors[0]).toContain('Missing required variable: bookingNumber');
    });

    it('should validate number types', () => {
      const variables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456',
        checkInDate: '2024-12-25',
        amount: 'not a number'
      };

      const errors = testTemplate.validateVariables(variables);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be a number');
    });

    it('should validate date types', () => {
      const variables = {
        guestName: 'John Doe',
        bookingNumber: 'BK123456',
        checkInDate: 'invalid date',
        amount: '299.99'
      };

      const errors = testTemplate.validateVariables(variables);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be a valid date');
    });
  });

  describe('incrementUsage method', () => {
    it('should increment usage statistics', async () => {
      const initialUsage = testTemplate.usage.timesUsed;

      await testTemplate.incrementUsage(95, 80);

      expect(testTemplate.usage.timesUsed).toBe(initialUsage + 1);
      expect(testTemplate.usage.lastUsed).toBeDefined();
      expect(testTemplate.usage.avgDeliveryRate).toBe(95);
      expect(testTemplate.usage.avgReadRate).toBe(80);
    });

    it('should calculate running averages correctly', async () => {
      testTemplate.usage.timesUsed = 2;
      testTemplate.usage.avgDeliveryRate = 90;
      testTemplate.usage.avgReadRate = 70;

      await testTemplate.incrementUsage(80, 60);

      // New average should be (90*2 + 80) / 3 = 83.33
      expect(Math.round(testTemplate.usage.avgDeliveryRate)).toBe(83);
      // New average should be (70*2 + 60) / 3 = 66.67
      expect(Math.round(testTemplate.usage.avgReadRate)).toBe(67);
    });
  });

  describe('Static methods', () => {
    beforeEach(async () => {
      await NotificationTemplate.deleteMany({});

      const templates = [
        {
          hotelId: testHotel._id,
          name: 'Booking Template',
          category: 'booking',
          type: 'booking_confirmation',
          usage: { timesUsed: 10 },
          metadata: { isActive: true }
        },
        {
          hotelId: testHotel._id,
          name: 'Payment Template',
          category: 'payment',
          type: 'payment_success',
          usage: { timesUsed: 5 },
          metadata: { isActive: true }
        },
        {
          hotelId: testHotel._id,
          name: 'Inactive Template',
          category: 'booking',
          type: 'custom',
          usage: { timesUsed: 20 },
          metadata: { isActive: false }
        }
      ];

      await NotificationTemplate.insertMany(templates);
    });

    it('should get templates by category', async () => {
      const templates = await NotificationTemplate.getByCategory(testHotel._id, 'booking');

      expect(templates).toHaveLength(1); // Only active booking templates
      expect(templates[0].name).toBe('Booking Template');
    });

    it('should get template by type', async () => {
      const template = await NotificationTemplate.getByType(testHotel._id, 'payment_success');

      expect(template.name).toBe('Payment Template');
      expect(template.type).toBe('payment_success');
    });

    it('should search templates', async () => {
      const templates = await NotificationTemplate.search(testHotel._id, 'booking');

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Booking Template');
    });

    it('should get most used templates', async () => {
      const templates = await NotificationTemplate.getMostUsed(testHotel._id, 5);

      expect(templates).toHaveLength(2); // Only active templates
      expect(templates[0].name).toBe('Booking Template'); // Most used first
      expect(templates[0].usage.timesUsed).toBe(10);
    });
  });
});