import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import User from '../../models/User.js';
import Hotel from '../../models/Hotel.js';
import PropertyGroup from '../../models/PropertyGroup.js';
import ScheduledUpdate from '../../models/ScheduledUpdate.js';
import SettingsInheritance from '../../models/SettingsInheritance.js';
import { SettingsInheritanceService } from '../../services/settingsInheritance.js';

/**
 * TEST FILE 1: Scheduled Updates Tests
 *
 * Comprehensive test suite for Phase 5.6 Feature 1: Scheduled Updates
 * Total: 25 test cases covering all CRUD operations, validations, and edge cases
 */

describe('Scheduled Updates - Phase 5.6 Feature 1', () => {
  let authToken;
  let testUser;
  let testProperty;
  let testProperty2;
  let testGroup;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);
    }
  });

  beforeEach(async () => {
    // Clean database
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await PropertyGroup.deleteMany({});
    await ScheduledUpdate.deleteMany({});
    await SettingsInheritance.deleteMany({});

    // Create test user (admin)
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true
    });

    // Create test property group
    testGroup = await PropertyGroup.create({
      name: 'Test Group',
      code: 'TEST-GROUP',
      description: 'Test property group',
      ownerId: testUser._id,
      isActive: true
    });

    // Create test properties
    testProperty = await Hotel.create({
      name: 'Test Hotel 1',
      code: 'TEST001',
      address: { city: 'Test City', country: 'Test Country' },
      contact: { phone: '123-456-7890', email: 'hotel1@test.com' },
      ownerId: testUser._id,
      propertyGroupId: testGroup._id,
      isActive: true
    });

    testProperty2 = await Hotel.create({
      name: 'Test Hotel 2',
      code: 'TEST002',
      address: { city: 'Test City 2', country: 'Test Country' },
      contact: { phone: '123-456-7891', email: 'hotel2@test.com' },
      ownerId: testUser._id,
      propertyGroupId: testGroup._id,
      isActive: true
    });

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ==========================================
  // 1. POST /api/v1/scheduled-updates (7 tests)
  // ==========================================

  describe('POST /api/v1/scheduled-updates', () => {
    it('should schedule update with valid data', async () => {
      const scheduledFor = new Date(Date.now() + 3600000); // 1 hour from now

      const response = await request(app)
        .post('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledFor,
          scope: 'single',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00',
            checkOutTime: '11:00'
          },
          settingName: 'Check-in/Check-out Times'
        })
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.update).toBeDefined();
      expect(response.body.data.update.status).toBe('pending');
      expect(response.body.data.update.scope).toBe('single');
      expect(response.body.data.update.propertiesAffected).toBe(0);
    });

    it('should reject past date', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago

      const response = await request(app)
        .post('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledFor: pastDate,
          scope: 'single',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' }
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('future');
    });

    it('should reject date more than 1 year in future', async () => {
      const farFutureDate = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000); // 366 days

      const response = await request(app)
        .post('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledFor: farFutureDate,
          scope: 'single',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' }
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('year');
    });

    it('should require authentication', async () => {
      const scheduledFor = new Date(Date.now() + 3600000);

      await request(app)
        .post('/api/v1/scheduled-updates')
        .send({
          scheduledFor,
          scope: 'single',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' }
        })
        .expect(401);
    });

    it('should validate scope (single/group/all)', async () => {
      const scheduledFor = new Date(Date.now() + 3600000);

      const response = await request(app)
        .post('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledFor,
          scope: 'invalid_scope',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' }
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('scope');
    });

    it('should require propertyId for single scope', async () => {
      const scheduledFor = new Date(Date.now() + 3600000);

      const response = await request(app)
        .post('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledFor,
          scope: 'single',
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' }
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('propertyId');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty._id.toString()
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  // ==========================================
  // 2. GET /api/v1/scheduled-updates (5 tests)
  // ==========================================

  describe('GET /api/v1/scheduled-updates', () => {
    beforeEach(async () => {
      // Create test scheduled updates
      await ScheduledUpdate.create([
        {
          scheduledFor: new Date(Date.now() + 3600000),
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '14:00' },
          createdBy: testUser._id,
          status: 'pending'
        },
        {
          scheduledFor: new Date(Date.now() + 7200000),
          scope: 'group',
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'room_taxes',
          settingUpdates: { taxRate: 10 },
          createdBy: testUser._id,
          status: 'pending'
        },
        {
          scheduledFor: new Date(Date.now() - 3600000),
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' },
          createdBy: testUser._id,
          status: 'completed',
          executedAt: new Date(Date.now() - 1800000),
          propertiesAffected: 1
        }
      ]);
    });

    it('should list all scheduled updates', async () => {
      const response = await request(app)
        .get('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updates).toHaveLength(3);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter by status (pending/completed/failed/cancelled)', async () => {
      const response = await request(app)
        .get('/api/v1/scheduled-updates?status=pending')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updates).toHaveLength(2);
      expect(response.body.data.updates.every(u => u.status === 'pending')).toBe(true);
    });

    it('should filter by propertyId', async () => {
      const response = await request(app)
        .get(`/api/v1/scheduled-updates?propertyId=${testProperty._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updates.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() + 1800000).toISOString();
      const endDate = new Date(Date.now() + 10800000).toISOString();

      const response = await request(app)
        .get(`/api/v1/scheduled-updates?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updates.length).toBeGreaterThan(0);
    });

    it('should paginate results correctly', async () => {
      const response = await request(app)
        .get('/api/v1/scheduled-updates?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.updates.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });
  });

  // ==========================================
  // 3. GET /api/v1/scheduled-updates/:id (2 tests)
  // ==========================================

  describe('GET /api/v1/scheduled-updates/:id', () => {
    let scheduledUpdateId;

    beforeEach(async () => {
      const update = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        createdBy: testUser._id,
        status: 'pending'
      });
      scheduledUpdateId = update._id;
    });

    it('should get specific scheduled update', async () => {
      const response = await request(app)
        .get(`/api/v1/scheduled-updates/${scheduledUpdateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.update._id).toBe(scheduledUpdateId.toString());
      expect(response.body.data.update.status).toBe('pending');
    });

    it('should return 404 for non-existent update', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/v1/scheduled-updates/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ==========================================
  // 4. DELETE /api/v1/scheduled-updates/:id (3 tests)
  // ==========================================

  describe('DELETE /api/v1/scheduled-updates/:id', () => {
    let pendingUpdateId;
    let completedUpdateId;

    beforeEach(async () => {
      const pendingUpdate = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        createdBy: testUser._id,
        status: 'pending'
      });
      pendingUpdateId = pendingUpdate._id;

      const completedUpdate = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() - 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '15:00' },
        createdBy: testUser._id,
        status: 'completed',
        executedAt: new Date()
      });
      completedUpdateId = completedUpdate._id;
    });

    it('should cancel pending update', async () => {
      const response = await request(app)
        .delete(`/api/v1/scheduled-updates/${pendingUpdateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.update.status).toBe('cancelled');
      expect(response.body.data.update.cancelReason).toBe('Test cancellation');
    });

    it('should not cancel completed/failed update', async () => {
      const response = await request(app)
        .delete(`/api/v1/scheduled-updates/${completedUpdateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test cancellation' })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Cannot cancel');
    });

    it('should record cancellation reason', async () => {
      await request(app)
        .delete(`/api/v1/scheduled-updates/${pendingUpdateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Changed requirements' });

      const update = await ScheduledUpdate.findById(pendingUpdateId);
      expect(update.status).toBe('cancelled');
      expect(update.cancelReason).toBe('Changed requirements');
      expect(update.cancelledBy.toString()).toBe(testUser._id.toString());
      expect(update.cancelledAt).toBeDefined();
    });
  });

  // ==========================================
  // 5. PUT /api/v1/scheduled-updates/:id/reschedule (3 tests)
  // ==========================================

  describe('PUT /api/v1/scheduled-updates/:id/reschedule', () => {
    let pendingUpdateId;
    let completedUpdateId;

    beforeEach(async () => {
      const pendingUpdate = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        createdBy: testUser._id,
        status: 'pending'
      });
      pendingUpdateId = pendingUpdate._id;

      const completedUpdate = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() - 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '15:00' },
        createdBy: testUser._id,
        status: 'completed',
        executedAt: new Date()
      });
      completedUpdateId = completedUpdate._id;
    });

    it('should reschedule pending update', async () => {
      const newScheduledFor = new Date(Date.now() + 7200000); // 2 hours from now

      const response = await request(app)
        .put(`/api/v1/scheduled-updates/${pendingUpdateId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledFor: newScheduledFor })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(new Date(response.body.data.update.scheduledFor).getTime())
        .toBeCloseTo(newScheduledFor.getTime(), -3);
    });

    it('should validate new scheduled time (future)', async () => {
      const pastDate = new Date(Date.now() - 3600000);

      const response = await request(app)
        .put(`/api/v1/scheduled-updates/${pendingUpdateId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledFor: pastDate })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('future');
    });

    it('should not reschedule non-pending update', async () => {
      const newScheduledFor = new Date(Date.now() + 7200000);

      const response = await request(app)
        .put(`/api/v1/scheduled-updates/${completedUpdateId}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledFor: newScheduledFor })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Cannot reschedule');
    });
  });

  // ==========================================
  // 6. POST /api/v1/scheduled-updates/:id/execute (2 tests)
  // ==========================================

  describe('POST /api/v1/scheduled-updates/:id/execute', () => {
    let pendingUpdateId;
    let completedUpdateId;

    beforeEach(async () => {
      const pendingUpdate = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00', checkOutTime: '11:00' },
        createdBy: testUser._id,
        status: 'pending'
      });
      pendingUpdateId = pendingUpdate._id;

      const completedUpdate = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() - 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '15:00' },
        createdBy: testUser._id,
        status: 'completed',
        executedAt: new Date()
      });
      completedUpdateId = completedUpdate._id;
    });

    it('should execute pending update immediately', async () => {
      const response = await request(app)
        .post(`/api/v1/scheduled-updates/${pendingUpdateId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.update.status).toBe('completed');
      expect(response.body.data.update.executedAt).toBeDefined();
      expect(response.body.data.update.executedBy).toBeDefined();
    });

    it('should not execute non-pending update', async () => {
      const response = await request(app)
        .post(`/api/v1/scheduled-updates/${completedUpdateId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Only pending');
    });
  });

  // ==========================================
  // 7. Model & Service Tests (3 tests)
  // ==========================================

  describe('Model & Service Tests', () => {
    it('Model validation should work correctly', async () => {
      // Test past date validation
      try {
        await ScheduledUpdate.create({
          scheduledFor: new Date(Date.now() - 3600000), // Past date
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '14:00' },
          createdBy: testUser._id
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('future');
      }
    });

    it('Execute method should call settingsInheritanceService', async () => {
      const update = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00', checkOutTime: '11:00' },
        createdBy: testUser._id,
        status: 'pending'
      });

      const result = await update.execute(SettingsInheritanceService);

      expect(result.success).toBe(true);
      expect(update.status).toBe('completed');
      expect(update.executedAt).toBeDefined();
      expect(update.propertiesAffected).toBeGreaterThan(0);
    });

    it('Cancel method should update status and record reason', async () => {
      const update = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        createdBy: testUser._id,
        status: 'pending'
      });

      await update.cancel(testUser._id, 'Test cancellation reason');

      expect(update.status).toBe('cancelled');
      expect(update.cancelReason).toBe('Test cancellation reason');
      expect(update.cancelledBy.toString()).toBe(testUser._id.toString());
      expect(update.cancelledAt).toBeDefined();
    });
  });
});
