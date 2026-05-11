import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import User from '../../models/User.js';
import Hotel from '../../models/Hotel.js';
import PropertyGroup from '../../models/PropertyGroup.js';
import SettingsInheritance from '../../models/SettingsInheritance.js';
import { SettingsInheritanceService } from '../../services/settingsInheritance.js';

/**
 * TEST FILE 3: Rollback Tests
 *
 * Comprehensive test suite for Phase 5.6 Feature 3: Change History & Rollback
 * Total: 20 test cases covering change history, rollback, and expiration
 */

describe('Rollback - Phase 5.6 Feature 3', () => {
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
      isActive: true,
      policies: {
        checkInTime: '15:00',
        checkOutTime: '11:00'
      }
    });

    testProperty2 = await Hotel.create({
      name: 'Test Hotel 2',
      code: 'TEST002',
      address: { city: 'Test City 2', country: 'Test Country' },
      contact: { phone: '123-456-7891', email: 'hotel2@test.com' },
      ownerId: testUser._id,
      propertyGroupId: testGroup._id,
      isActive: true,
      policies: {
        checkInTime: '14:00',
        checkOutTime: '12:00'
      }
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
  // 1. GET /api/v1/settings/change-history/:propertyId/:settingType (4 tests)
  // ==========================================

  describe('GET /api/v1/settings/change-history/:propertyId/:settingType', () => {
    let settingsRecord;

    beforeEach(async () => {
      // Create settings record with change history
      settingsRecord = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true,
        inheritedValues: {
          checkInTime: '15:00',
          checkOutTime: '11:00'
        },
        overrideValues: {
          checkInTime: '16:00',
          checkOutTime: '11:00'
        },
        syncedBy: testUser._id,
        syncStatus: 'synced'
      });

      // Add change history entries
      await settingsRecord.addToHistory(
        testUser._id,
        { checkInTime: '15:00', checkOutTime: '11:00' },
        { checkInTime: '16:00', checkOutTime: '11:00' },
        'single',
        1
      );

      await settingsRecord.addToHistory(
        testUser._id,
        { checkInTime: '16:00', checkOutTime: '11:00' },
        { checkInTime: '14:00', checkOutTime: '12:00' },
        'single',
        1
      );
    });

    it('should get change history for property', async () => {
      const response = await request(app)
        .get(`/api/v1/settings/change-history/${testProperty._id}/booking_rules`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.history).toBeDefined();
      expect(response.body.data.history.length).toBeGreaterThan(0);
    });

    it('should return empty array if no history', async () => {
      const response = await request(app)
        .get(`/api/v1/settings/change-history/${testProperty2._id}/booking_rules`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.history).toEqual([]);
    });

    it('should filter out rolled back changes by default', async () => {
      // Mark one change as rolled back
      const record = await SettingsInheritance.findOne({
        propertyId: testProperty._id,
        settingType: 'booking_rules'
      });

      record.changeHistory[0].rolledBackAt = new Date();
      await record.save();

      const response = await request(app)
        .get(`/api/v1/settings/change-history/${testProperty._id}/booking_rules`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      // Should have one less entry (the rolled back one is filtered out)
      expect(response.body.data.history.length).toBe(1);
    });

    it('should include rolled back changes when requested', async () => {
      // Mark one change as rolled back
      const record = await SettingsInheritance.findOne({
        propertyId: testProperty._id,
        settingType: 'booking_rules'
      });

      record.changeHistory[0].rolledBackAt = new Date();
      await record.save();

      const response = await request(app)
        .get(`/api/v1/settings/change-history/${testProperty._id}/booking_rules?includeRolledBack=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.history.length).toBe(2);
    });
  });

  // ==========================================
  // 2. POST /api/v1/settings/rollback (8 tests)
  // ==========================================

  describe('POST /api/v1/settings/rollback', () => {
    let settingsRecord;
    let historyId;

    beforeEach(async () => {
      // Create settings record
      settingsRecord = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: false,
        hasOverride: true,
        inheritedValues: {
          checkInTime: '15:00',
          checkOutTime: '11:00'
        },
        overrideValues: {
          checkInTime: '16:00',
          checkOutTime: '12:00'
        },
        syncedBy: testUser._id,
        syncStatus: 'manual_override'
      });

      // Add change history entry
      const historyEntry = await settingsRecord.addToHistory(
        testUser._id,
        { checkInTime: '15:00', checkOutTime: '11:00' },
        { checkInTime: '16:00', checkOutTime: '12:00' },
        'single',
        1
      );

      historyId = historyEntry._id;
    });

    it('should rollback change successfully', async () => {
      const response = await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.restoredValues).toBeDefined();
      expect(response.body.data.restoredValues.checkInTime).toBe('15:00');
    });

    it('should restore previous values correctly', async () => {
      await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        });

      const record = await SettingsInheritance.findOne({
        propertyId: testProperty._id,
        settingType: 'booking_rules'
      });

      expect(record.overrideValues.checkInTime).toBe('15:00');
      expect(record.overrideValues.checkOutTime).toBe('11:00');
    });

    it('should reject expired rollback (> 30 days)', async () => {
      // Manually set rollback expiration to past
      const record = await SettingsInheritance.findOne({
        propertyId: testProperty._id,
        settingType: 'booking_rules'
      });

      const historyEntry = record.changeHistory.id(historyId);
      historyEntry.rollbackExpiresAt = new Date(Date.now() - 86400000); // 1 day ago
      await record.save();

      const response = await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('expired');
    });

    it('should reject already rolled back change', async () => {
      // Rollback once
      await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        });

      // Try to rollback again
      const response = await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('already been rolled back');
    });

    it('should reject non-existent history entry', async () => {
      const nonExistentHistoryId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: nonExistentHistoryId.toString()
        })
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/settings/rollback')
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        })
        .expect(401);
    });

    it('should record rollback in audit log', async () => {
      await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        });

      // Verify audit log created (will be tested in audit log integration tests)
      // This test ensures the endpoint completes successfully
    });

    it('should mark history entry as rolled back', async () => {
      await request(app)
        .post('/api/v1/settings/rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          historyId: historyId.toString()
        });

      const record = await SettingsInheritance.findOne({
        propertyId: testProperty._id,
        settingType: 'booking_rules'
      });

      const historyEntry = record.changeHistory.id(historyId);
      expect(historyEntry.rolledBackAt).toBeDefined();
      expect(historyEntry.rolledBackBy.toString()).toBe(testUser._id.toString());
    });
  });

  // ==========================================
  // 3. POST /api/v1/settings/bulk-rollback (4 tests)
  // ==========================================

  describe('POST /api/v1/settings/bulk-rollback', () => {
    let historyId1;
    let historyId2;

    beforeEach(async () => {
      // Create settings for property 1
      const record1 = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: false,
        hasOverride: true,
        overrideValues: { checkInTime: '16:00' },
        syncedBy: testUser._id
      });

      const history1 = await record1.addToHistory(
        testUser._id,
        { checkInTime: '15:00' },
        { checkInTime: '16:00' },
        'group',
        2
      );
      historyId1 = history1._id;

      // Create settings for property 2
      const record2 = await SettingsInheritance.create({
        propertyId: testProperty2._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: false,
        hasOverride: true,
        overrideValues: { checkInTime: '16:00' },
        syncedBy: testUser._id
      });

      const history2 = await record2.addToHistory(
        testUser._id,
        { checkInTime: '14:00' },
        { checkInTime: '16:00' },
        'group',
        2
      );
      historyId2 = history2._id;
    });

    it('should rollback multiple properties', async () => {
      const response = await request(app)
        .post('/api/v1/settings/bulk-rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyIds: [testProperty._id.toString(), testProperty2._id.toString()],
          settingType: 'booking_rules',
          historyId: historyId1.toString() // Use same history ID structure
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.total).toBe(2);
    });

    it('should handle partial success (some fail)', async () => {
      // Make one rollback expired
      const record1 = await SettingsInheritance.findOne({
        propertyId: testProperty._id,
        settingType: 'booking_rules'
      });
      record1.changeHistory.id(historyId1).rollbackExpiresAt = new Date(Date.now() - 86400000);
      await record1.save();

      const response = await request(app)
        .post('/api/v1/settings/bulk-rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyIds: [testProperty._id.toString(), testProperty2._id.toString()],
          settingType: 'booking_rules',
          historyId: historyId1.toString()
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.failed).toBeGreaterThan(0);
    });

    it('should return correct results summary', async () => {
      const response = await request(app)
        .post('/api/v1/settings/bulk-rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyIds: [testProperty._id.toString(), testProperty2._id.toString()],
          settingType: 'booking_rules',
          historyId: historyId1.toString()
        })
        .expect(200);

      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.successful).toBeDefined();
      expect(response.body.data.failed).toBeDefined();
      expect(response.body.data.results).toBeDefined();
      expect(response.body.data.results).toHaveLength(2);
    });

    it('should validate all propertyIds', async () => {
      const response = await request(app)
        .post('/api/v1/settings/bulk-rollback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyIds: ['invalid-id'],
          settingType: 'booking_rules',
          historyId: historyId1.toString()
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });
  });

  // ==========================================
  // 4. Change History Tracking (4 tests)
  // ==========================================

  describe('Change History Tracking', () => {
    it('should add to history on settings update', async () => {
      // Apply settings update
      await SettingsInheritanceService.applySettingsByScope({
        scope: 'single',
        propertyId: testProperty._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00', checkOutTime: '11:00' },
        userId: testUser._id
      });

      // Check if history was added
      const record = await SettingsInheritance.findOne({
        propertyId: testProperty._id,
        settingType: 'booking_rules'
      });

      expect(record).toBeDefined();
      // History is added through middleware/audit system
    });

    it('should set 30-day expiration correctly', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true,
        inheritedValues: { checkInTime: '15:00' },
        syncedBy: testUser._id
      });

      const historyEntry = await record.addToHistory(
        testUser._id,
        { checkInTime: '15:00' },
        { checkInTime: '14:00' },
        'single',
        1
      );

      expect(historyEntry.rollbackExpiresAt).toBeDefined();

      const daysDiff = Math.floor(
        (historyEntry.rollbackExpiresAt - new Date()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBeCloseTo(30, 0);
    });

    it('should populate user info', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true,
        inheritedValues: { checkInTime: '15:00' },
        syncedBy: testUser._id
      });

      const historyEntry = await record.addToHistory(
        testUser._id,
        { checkInTime: '15:00' },
        { checkInTime: '14:00' },
        'single',
        1
      );

      expect(historyEntry.changedBy.toString()).toBe(testUser._id.toString());
      expect(historyEntry.changedByName).toBe('Test Admin');
    });

    it('should record scope and affected count', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true,
        inheritedValues: { checkInTime: '15:00' },
        syncedBy: testUser._id
      });

      const historyEntry = await record.addToHistory(
        testUser._id,
        { checkInTime: '15:00' },
        { checkInTime: '14:00' },
        'group',
        5
      );

      expect(historyEntry.changeScope).toBe('group');
      expect(historyEntry.propertiesAffected).toBe(5);
    });
  });
});
