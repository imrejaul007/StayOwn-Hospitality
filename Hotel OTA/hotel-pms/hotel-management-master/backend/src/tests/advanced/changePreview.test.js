import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import User from '../../models/User.js';
import Hotel from '../../models/Hotel.js';
import PropertyGroup from '../../models/PropertyGroup.js';
import SettingsInheritance from '../../models/SettingsInheritance.js';
import { SettingsInheritanceService } from '../../services/settingsInheritance.js';

/**
 * TEST FILE 2: Change Preview Tests
 *
 * Comprehensive test suite for Phase 5.6 Feature 2: Change Preview
 * Total: 15 test cases covering preview API and diff calculation
 */

describe('Change Preview - Phase 5.6 Feature 2', () => {
  let authToken;
  let testUser;
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

    testProperty3 = await Hotel.create({
      name: 'Test Hotel 3',
      code: 'TEST003',
      address: { city: 'Test City 3', country: 'Test Country' },
      contact: { phone: '123-456-7892', email: 'hotel3@test.com' },
      ownerId: testUser._id,
      propertyGroupId: testGroup._id,
      isActive: true,
      policies: {
        checkInTime: '15:00',
        checkOutTime: '11:00'
      }
    });

    // Create existing settings records
    await SettingsInheritance.create({
      propertyId: testProperty._id,
      groupId: testGroup._id,
      settingType: 'booking_rules',
      isInheriting: true,
      inheritedValues: {
        checkInTime: '15:00',
        checkOutTime: '11:00'
      },
      syncedBy: testUser._id,
      syncStatus: 'synced'
    });

    await SettingsInheritance.create({
      propertyId: testProperty2._id,
      groupId: testGroup._id,
      settingType: 'booking_rules',
      isInheriting: true,
      inheritedValues: {
        checkInTime: '14:00',
        checkOutTime: '12:00'
      },
      syncedBy: testUser._id,
      syncStatus: 'synced'
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
  // 1. POST /api/v1/settings/preview-changes - API (8 tests)
  // ==========================================

  describe('POST /api/v1/settings/preview-changes - API', () => {
    it('should preview single property changes', async () => {
      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '14:00', // Changed from 15:00
            checkOutTime: '12:00' // Changed from 11:00
          }
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.totalPropertiesAffected).toBe(1);
      expect(response.body.data.propertiesWithChanges).toBe(1);
      expect(response.body.data.preview).toHaveLength(1);
      expect(response.body.data.preview[0].changes.length).toBeGreaterThan(0);
    });

    it('should preview group property changes', async () => {
      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '16:00',
            checkOutTime: '10:00'
          }
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.totalPropertiesAffected).toBeGreaterThanOrEqual(2);
      expect(response.body.data.preview.length).toBeGreaterThanOrEqual(2);
    });

    it('should preview all properties changes', async () => {
      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'all',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '13:00'
          }
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.totalPropertiesAffected).toBeGreaterThanOrEqual(3);
      expect(response.body.data.scope).toBe('all');
    });

    it('should reject invalid scope', async () => {
      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'invalid',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '14:00' }
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('scope');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/settings/preview-changes')
        .send({
          scope: 'single',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '14:00' }
        })
        .expect(401);
    });

    it('should validate required fields (settingType, settingUpdates)', async () => {
      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty._id.toString()
        })
        .expect(400);

      expect(response.body.status).toBe('error');
    });

    it('should handle non-existent property', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: nonExistentId.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '14:00' }
        })
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not found');
    });

    it('should calculate summary statistics correctly', async () => {
      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '16:00',
            checkOutTime: '10:00',
            cancellationPolicy: 'flexible'
          }
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.totalPropertiesAffected).toBeDefined();
      expect(response.body.data.propertiesWithChanges).toBeDefined();
      expect(response.body.data.propertiesWithNoChanges).toBeDefined();
      expect(response.body.data.totalChangedFields).toBeDefined();

      // Verify sum adds up
      const total = response.body.data.propertiesWithChanges +
                    response.body.data.propertiesWithNoChanges +
                    (response.body.data.propertiesWithErrors || 0);
      expect(total).toBe(response.body.data.totalPropertiesAffected);
    });
  });

  // ==========================================
  // 2. Diff Calculation (7 tests)
  // ==========================================

  describe('Diff Calculation', () => {
    it('should detect added fields', async () => {
      const oldValues = { checkInTime: '15:00' };
      const newValues = { checkInTime: '15:00', checkOutTime: '11:00' };

      const diff = SettingsInheritanceService.calculateDetailedDiff(oldValues, newValues);

      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('checkOutTime');
      expect(diff[0].type).toBe('added');
      expect(diff[0].oldValue).toBeNull();
      expect(diff[0].newValue).toBe('11:00');
    });

    it('should detect modified fields', async () => {
      const oldValues = { checkInTime: '15:00', checkOutTime: '11:00' };
      const newValues = { checkInTime: '14:00', checkOutTime: '11:00' };

      const diff = SettingsInheritanceService.calculateDetailedDiff(oldValues, newValues);

      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('checkInTime');
      expect(diff[0].type).toBe('modified');
      expect(diff[0].oldValue).toBe('15:00');
      expect(diff[0].newValue).toBe('14:00');
    });

    it('should detect deleted fields', async () => {
      const oldValues = { checkInTime: '15:00', checkOutTime: '11:00' };
      const newValues = { checkInTime: '15:00' };

      const diff = SettingsInheritanceService.calculateDetailedDiff(oldValues, newValues);

      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('checkOutTime');
      expect(diff[0].type).toBe('deleted');
      expect(diff[0].oldValue).toBe('11:00');
      expect(diff[0].newValue).toBeNull();
    });

    it('should handle nested objects', async () => {
      const oldValues = {
        checkInTime: '15:00',
        policies: { flexible: true }
      };
      const newValues = {
        checkInTime: '15:00',
        policies: { flexible: false }
      };

      const diff = SettingsInheritanceService.calculateDetailedDiff(oldValues, newValues);

      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('policies');
      expect(diff[0].type).toBe('modified');
    });

    it('should handle arrays', async () => {
      const oldValues = { amenities: ['WiFi', 'AC'] };
      const newValues = { amenities: ['WiFi', 'AC', 'TV'] };

      const diff = SettingsInheritanceService.calculateDetailedDiff(oldValues, newValues);

      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('amenities');
      expect(diff[0].type).toBe('modified');
    });

    it('should handle no changes scenario', async () => {
      const oldValues = { checkInTime: '15:00', checkOutTime: '11:00' };
      const newValues = { checkInTime: '15:00', checkOutTime: '11:00' };

      const diff = SettingsInheritanceService.calculateDetailedDiff(oldValues, newValues);

      expect(diff).toHaveLength(0);
    });

    it('should handle empty current values', async () => {
      const oldValues = {};
      const newValues = { checkInTime: '15:00', checkOutTime: '11:00' };

      const diff = SettingsInheritanceService.calculateDetailedDiff(oldValues, newValues);

      expect(diff).toHaveLength(2);
      expect(diff.every(d => d.type === 'added')).toBe(true);
    });
  });

  // ==========================================
  // Additional Integration Tests
  // ==========================================

  describe('Preview Integration Tests', () => {
    it('should identify properties with no changes', async () => {
      // Create property with same values as proposed update
      await SettingsInheritance.create({
        propertyId: testProperty3._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true,
        inheritedValues: {
          checkInTime: '15:00',
          checkOutTime: '11:00'
        },
        syncedBy: testUser._id,
        syncStatus: 'synced'
      });

      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00',
            checkOutTime: '11:00'
          }
        })
        .expect(200);

      expect(response.body.data.propertiesWithNoChanges).toBeGreaterThan(0);
    });

    it('should show both current and proposed values', async () => {
      const response = await request(app)
        .post('/api/v1/settings/preview-changes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '16:00'
          }
        })
        .expect(200);

      const preview = response.body.data.preview[0];
      expect(preview.currentValues).toBeDefined();
      expect(preview.proposedValues).toBeDefined();
      expect(preview.changes).toBeDefined();
    });
  });
});
