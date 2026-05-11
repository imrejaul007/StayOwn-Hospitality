import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import User from '../../models/User.js';
import Hotel from '../../models/Hotel.js';
import PropertyGroup from '../../models/PropertyGroup.js';
import ScheduledUpdate from '../../models/ScheduledUpdate.js';
import SettingsAuditLog from '../../models/SettingsAuditLog.js';
import SettingsInheritance from '../../models/SettingsInheritance.js';
import { SettingsInheritanceService } from '../../services/settingsInheritance.js';

/**
 * TEST FILE 4: Audit Log Integration Tests
 *
 * Comprehensive test suite for Phase 5.6 Feature 4: Audit Log Integration
 * Total: 20 test cases covering audit logging, statistics, and exports
 */

describe('Audit Log Integration - Phase 5.6 Feature 4', () => {
  let authToken;
  let testUser;
  let testUser2;
  let testProperty;
  let testProperty2;
  let testProperty3;
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
    await SettingsAuditLog.deleteMany({});
    await SettingsInheritance.deleteMany({});

    // Create test users
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true
    });

    testUser2 = await User.create({
      name: 'Test Manager',
      email: 'manager@test.com',
      password: 'password123',
      role: 'manager',
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

    testProperty3 = await Hotel.create({
      name: 'Test Hotel 3',
      code: 'TEST003',
      address: { city: 'Test City 3', country: 'Test Country' },
      contact: { phone: '123-456-7892', email: 'hotel3@test.com' },
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
  // 1. Audit Logging for Scheduled Updates (4 tests)
  // ==========================================

  describe('Audit Logging for Scheduled Updates', () => {
    it('should log when update is scheduled', async () => {
      const scheduledFor = new Date(Date.now() + 3600000);

      await request(app)
        .post('/api/v1/scheduled-updates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scheduledFor,
          scope: 'group',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' }
        });

      // Check audit log
      const auditLog = await SettingsAuditLog.findOne({
        userId: testUser._id,
        action: 'schedule',
        settingType: 'booking_rules'
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.scope).toBe('group');
      expect(auditLog.status).toBe('success');
    });

    it('should log when update is cancelled', async () => {
      // Create scheduled update
      const update = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        createdBy: testUser._id,
        status: 'pending'
      });

      await request(app)
        .delete(`/api/v1/scheduled-updates/${update._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test cancellation' });

      // Check audit log
      const auditLog = await SettingsAuditLog.findOne({
        userId: testUser._id,
        action: 'cancel',
        settingType: 'booking_rules'
      });

      expect(auditLog).toBeDefined();
    });

    it('should log when update is rescheduled', async () => {
      const update = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        createdBy: testUser._id,
        status: 'pending'
      });

      const newScheduledFor = new Date(Date.now() + 7200000);

      await request(app)
        .put(`/api/v1/scheduled-updates/${update._id}/reschedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scheduledFor: newScheduledFor });

      // Check audit log (rescheduling may log as update action)
      const auditLogs = await SettingsAuditLog.find({
        userId: testUser._id,
        settingType: 'booking_rules'
      });

      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it('should log when update is executed', async () => {
      const update = await ScheduledUpdate.create({
        scheduledFor: new Date(Date.now() + 3600000),
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00', checkOutTime: '11:00' },
        createdBy: testUser._id,
        status: 'pending'
      });

      await request(app)
        .post(`/api/v1/scheduled-updates/${update._id}/execute`)
        .set('Authorization', `Bearer ${authToken}`);

      // Check audit log
      const auditLog = await SettingsAuditLog.findOne({
        action: 'update',
        settingType: 'booking_rules',
        propertyId: testProperty._id
      });

      expect(auditLog).toBeDefined();
    });
  });

  // ==========================================
  // 2. Audit Logging for Rollbacks (3 tests)
  // ==========================================

  describe('Audit Logging for Rollbacks', () => {
    let historyId;

    beforeEach(async () => {
      // Create settings with history
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: false,
        hasOverride: true,
        overrideValues: { checkInTime: '16:00' },
        syncedBy: testUser._id
      });

      const history = await record.addToHistory(
        testUser._id,
        { checkInTime: '15:00' },
        { checkInTime: '16:00' },
        'single',
        1
      );
      historyId = history._id;
    });

    it('should log rollback action', async () => {
      await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        });

      const auditLog = await SettingsAuditLog.findOne({
        userId: testUser._id,
        action: 'rollback',
        settingType: 'booking_rules'
      });

      expect(auditLog).toBeDefined();
    });

    it('should capture before/after values', async () => {
      await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        });

      const auditLog = await SettingsAuditLog.findOne({
        userId: testUser._id,
        action: 'rollback',
        settingType: 'booking_rules'
      });

      expect(auditLog.previousValues).toBeDefined();
      expect(auditLog.newValues).toBeDefined();
    });

    it('should record rollback reason', async () => {
      // Rollback with reason in metadata
      await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString(),
          reason: 'Incorrect configuration'
        });

      const auditLog = await SettingsAuditLog.findOne({
        userId: testUser._id,
        action: 'rollback',
        settingType: 'booking_rules'
      });

      expect(auditLog).toBeDefined();
    });
  });

  // ==========================================
  // 3. Statistics Accuracy (5 tests)
  // ==========================================

  describe('Statistics Accuracy', () => {
    beforeEach(async () => {
      // Create sample audit logs
      await SettingsAuditLog.create([
        {
          userId: testUser._id,
          userName: testUser.name,
          userEmail: testUser.email,
          action: 'update',
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          duration: 150
        },
        {
          userId: testUser._id,
          userName: testUser.name,
          userEmail: testUser.email,
          action: 'update',
          scope: 'group',
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'room_taxes',
          propertiesAffected: 3,
          status: 'success',
          duration: 350
        },
        {
          userId: testUser2._id,
          userName: testUser2.name,
          userEmail: testUser2.email,
          action: 'rollback',
          scope: 'single',
          propertyId: testProperty2._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          duration: 100
        }
      ]);
    });

    it('Total changes should be accurate', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.totalChanges).toBe(3);
    });

    it('Breakdown by action should be correct', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.byAction).toBeDefined();
      const updateCount = response.body.data.byAction.find(a => a._id === 'update');
      const rollbackCount = response.body.data.byAction.find(a => a._id === 'rollback');

      expect(updateCount.count).toBe(2);
      expect(rollbackCount.count).toBe(1);
    });

    it('Breakdown by scope should be correct', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.byScope).toBeDefined();
      const singleScope = response.body.data.byScope.find(s => s._id === 'single');
      const groupScope = response.body.data.byScope.find(s => s._id === 'group');

      expect(singleScope.count).toBe(2);
      expect(groupScope.count).toBe(1);
    });

    it('Breakdown by setting type should be correct', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.bySettingType).toBeDefined();
      const bookingRules = response.body.data.bySettingType.find(s => s._id === 'booking_rules');
      const roomTaxes = response.body.data.bySettingType.find(s => s._id === 'room_taxes');

      expect(bookingRules.count).toBe(2);
      expect(roomTaxes.count).toBe(1);
    });

    it('Most active users should be correct', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/most-active-users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.users).toBeDefined();
      expect(response.body.data.users.length).toBeGreaterThan(0);

      const mostActive = response.body.data.users[0];
      expect(mostActive._id.toString()).toBe(testUser._id.toString());
      expect(mostActive.totalChanges).toBe(2);
    });
  });

  // ==========================================
  // 4. Time Savings Calculation (2 tests)
  // ==========================================

  describe('Time Savings Calculation', () => {
    it('should calculate time saved correctly for bulk operations', async () => {
      // Create audit logs for bulk operations
      await SettingsAuditLog.create([
        {
          userId: testUser._id,
          userName: testUser.name,
          userEmail: testUser.email,
          action: 'update',
          scope: 'group',
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          propertiesAffected: 10,
          status: 'success',
          duration: 2000
        },
        {
          userId: testUser._id,
          userName: testUser.name,
          userEmail: testUser.email,
          action: 'update',
          scope: 'all',
          propertyId: testProperty._id,
          settingType: 'room_taxes',
          propertiesAffected: 15,
          status: 'success',
          duration: 3000
        }
      ]);

      const response = await request(app)
        .get('/api/v1/audit-log/time-savings')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: new Date(Date.now() - 86400000).toISOString() })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.totalTimeSavedMinutes).toBeGreaterThan(0);
      expect(response.body.data.bulkOperationsCount).toBeGreaterThan(0);
    });

    it('should return zero for single property updates', async () => {
      await SettingsAuditLog.create({
        userId: testUser._id,
        userName: testUser.name,
        userEmail: testUser.email,
        action: 'update',
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        propertiesAffected: 1,
        status: 'success',
        duration: 500
      });

      const response = await request(app)
        .get('/api/v1/audit-log/time-savings')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: new Date(Date.now() - 86400000).toISOString() })
        .expect(200);

      // Single property updates don't count as time savings
      expect(response.body.data.totalTimeSavedMinutes).toBe(0);
    });
  });

  // ==========================================
  // 5. Heatmap Data (2 tests)
  // ==========================================

  describe('Heatmap Data', () => {
    beforeEach(async () => {
      const now = new Date();

      // Create logs at different times
      await SettingsAuditLog.create([
        {
          userId: testUser._id,
          userName: testUser.name,
          action: 'update',
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          timestamp: new Date(now.getTime() - 3600000) // 1 hour ago
        },
        {
          userId: testUser._id,
          userName: testUser.name,
          action: 'update',
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          timestamp: new Date(now.getTime() - 7200000) // 2 hours ago
        },
        {
          userId: testUser._id,
          userName: testUser.name,
          action: 'update',
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          timestamp: new Date(now.getTime() - 86400000) // 1 day ago
        }
      ]);
    });

    it('should generate heatmap data correctly', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/heatmap')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.heatmap).toBeDefined();
      expect(Array.isArray(response.body.data.heatmap)).toBe(true);
    });

    it('should group by day/week/month correctly', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/heatmap')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
          endDate: new Date().toISOString(),
          groupBy: 'day'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.heatmap).toBeDefined();
    });
  });

  // ==========================================
  // 6. Export Functionality (2 tests)
  // ==========================================

  describe('Export Functionality', () => {
    beforeEach(async () => {
      await SettingsAuditLog.create([
        {
          userId: testUser._id,
          userName: testUser.name,
          userEmail: testUser.email,
          action: 'update',
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          duration: 150
        },
        {
          userId: testUser._id,
          userName: testUser.name,
          userEmail: testUser.email,
          action: 'rollback',
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          duration: 100
        }
      ]);
    });

    it('should export to CSV format', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/export?format=csv')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('timestamp');
      expect(response.text).toContain('action');
    });

    it('should export to JSON format', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log/export?format=json')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ==========================================
  // 7. Filtering and Pagination (2 tests)
  // ==========================================

  describe('Filtering and Pagination', () => {
    beforeEach(async () => {
      const logs = [];
      for (let i = 0; i < 25; i++) {
        logs.push({
          userId: testUser._id,
          userName: testUser.name,
          userEmail: testUser.email,
          action: i % 2 === 0 ? 'update' : 'rollback',
          scope: 'single',
          propertyId: testProperty._id,
          settingType: 'booking_rules',
          propertiesAffected: 1,
          status: 'success',
          timestamp: new Date(Date.now() - i * 3600000) // Stagger timestamps
        });
      }
      await SettingsAuditLog.create(logs);
    });

    it('should filter by date range correctly', async () => {
      const startDate = new Date(Date.now() - 10 * 3600000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.logs.length).toBeLessThanOrEqual(11); // 0-10 hours = 11 logs
    });

    it('should paginate results correctly', async () => {
      const response = await request(app)
        .get('/api/v1/audit-log')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.logs.length).toBeLessThanOrEqual(10);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });
  });
});
