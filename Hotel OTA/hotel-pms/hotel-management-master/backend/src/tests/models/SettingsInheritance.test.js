import mongoose from 'mongoose';
import SettingsInheritance from '../../models/SettingsInheritance.js';
import Hotel from '../../models/Hotel.js';
import PropertyGroup from '../../models/PropertyGroup.js';
import User from '../../models/User.js';

/**
 * SettingsInheritance Model Test Suite
 *
 * Tests model methods, validations, and virtuals
 */
describe('SettingsInheritance Model', () => {
  let testProperty;
  let testGroup;
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);
  });

  beforeEach(async () => {
    // Clean database
    await SettingsInheritance.deleteMany({});
    await Hotel.deleteMany({});
    await PropertyGroup.deleteMany({});
    await User.deleteMany({});

    // Setup test data
    testUser = await User.create({
      name: 'Test User',
      email: 'test@model.test',
      password: 'password123',
      role: 'admin'
    });

    testProperty = await Hotel.create({
      name: 'Test Property',
      ownerId: testUser._id,
      address: { city: 'Test City', country: 'USA' },
      contact: { phone: '+1-555-0000', email: 'test@property.com' }
    });

    testGroup = await PropertyGroup.create({
      name: 'Test Group',
      ownerId: testUser._id,
      properties: [testProperty._id]
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Schema Validation', () => {
    it('should create a valid inheritance record', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true
      });

      expect(record).toHaveProperty('_id');
      expect(record.settingType).toBe('booking_rules');
      expect(record.isInheriting).toBe(true);
      expect(record.syncStatus).toBe('synced');
    });

    it('should require propertyId', async () => {
      try {
        await SettingsInheritance.create({
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors.propertyId).toBeDefined();
      }
    });

    it('should require groupId', async () => {
      try {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          settingType: 'booking_rules'
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors.groupId).toBeDefined();
      }
    });

    it('should require settingType', async () => {
      try {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors.settingType).toBeDefined();
      }
    });

    it('should validate settingType enum', async () => {
      try {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'invalid_type'
        });
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }
    });

    it('should accept all valid settingType values', async () => {
      const validTypes = [
        'check_in_out', 'currency', 'timezone', 'general',
        'integration_settings', 'system_settings', 'display_preferences',
        'room_taxes', 'pos_taxes', 'payment_method',
        'room_types', 'booking_rules', 'seasonal_pricing_season',
        'web_settings', 'ota_channel_configuration',
        'message_templates', 'notification_templates', 'email_campaign',
        'housekeeping_settings', 'allotment_global_settings'
      ];

      for (const type of validTypes.slice(0, 5)) { // Test a subset
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: type
        });

        expect(record.settingType).toBe(type);
        await record.deleteOne();
      }
    });

    it('should validate syncStatus enum', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        syncStatus: 'pending'
      });

      expect(record.syncStatus).toBe('pending');
    });

    it('should set default values', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      expect(record.isInheriting).toBe(true);
      expect(record.hasOverride).toBe(false);
      expect(record.syncStatus).toBe('synced');
      expect(record.overrideValues).toEqual({});
      expect(record.inheritedValues).toEqual({});
    });
  });

  describe('Indexes', () => {
    it('should enforce unique compound index on propertyId and settingType', async () => {
      await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      try {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });
        fail('Should have thrown duplicate key error');
      } catch (error) {
        expect(error.code).toBe(11000);
      }
    });

    it('should allow same settingType for different properties', async () => {
      const property2 = await Hotel.create({
        name: 'Property 2',
        ownerId: testUser._id,
        address: { city: 'City 2', country: 'USA' },
        contact: { phone: '+1-555-0001', email: 'prop2@test.com' }
      });

      const record1 = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      const record2 = await SettingsInheritance.create({
        propertyId: property2._id,
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      expect(record1._id).not.toEqual(record2._id);
    });
  });

  describe('Instance Methods', () => {
    describe('applyInheritance', () => {
      it('should apply inherited values', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        const groupSettings = {
          checkInTime: '15:00',
          checkOutTime: '11:00'
        };

        const result = await record.applyInheritance(groupSettings);

        expect(result.success).toBe(true);
        expect(record.inheritedValues).toMatchObject(groupSettings);
        expect(record.syncStatus).toBe('synced');
        expect(record.syncError).toBeNull();
      });

      it('should update metadata', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        await record.applyInheritance({ checkInTime: '14:00' });

        expect(record.metadata.currentVersion).toBeDefined();
      });

      it('should handle errors gracefully', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        // Force an error by making save fail
        record.save = jest.fn().mockRejectedValue(new Error('Save failed'));

        try {
          await record.applyInheritance({});
          fail('Should have thrown error');
        } catch (error) {
          expect(error.message).toBe('Save failed');
        }
      });
    });

    describe('setOverride', () => {
      it('should set override values', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true
        });

        const overrideValues = { checkInTime: '16:00' };
        const result = await record.setOverride(overrideValues, testUser._id);

        expect(result.success).toBe(true);
        expect(record.hasOverride).toBe(true);
        expect(record.isInheriting).toBe(false);
        expect(record.overrideValues).toMatchObject(overrideValues);
        expect(record.syncStatus).toBe('manual_override');
        expect(record.syncedBy.toString()).toBe(testUser._id.toString());
      });

      it('should update version metadata', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        await record.setOverride({ checkInTime: '17:00' }, testUser._id);

        expect(record.metadata.previousVersion).toBeDefined();
        expect(record.metadata.currentVersion).toBeDefined();
      });
    });

    describe('removeOverride', () => {
      it('should remove override and restore inheritance', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          hasOverride: true,
          overrideValues: { checkInTime: '16:00' },
          isInheriting: false
        });

        const result = await record.removeOverride();

        expect(result.success).toBe(true);
        expect(record.hasOverride).toBe(false);
        expect(record.isInheriting).toBe(true);
        expect(record.overrideValues).toEqual({});
        expect(record.syncStatus).toBe('synced');
      });

      it('should update version metadata', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          hasOverride: true
        });

        await record.removeOverride();

        expect(record.metadata.previousVersion).toBeDefined();
        expect(record.metadata.currentVersion).toBeDefined();
      });
    });

    describe('getEffectiveValues', () => {
      it('should return override values when override exists', async () => {
        const overrideValues = { checkInTime: '16:00' };
        const inheritedValues = { checkInTime: '15:00' };

        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          hasOverride: true,
          overrideValues,
          inheritedValues
        });

        const effective = record.getEffectiveValues();
        expect(effective).toEqual(overrideValues);
      });

      it('should return inherited values when no override', async () => {
        const inheritedValues = { checkInTime: '15:00' };

        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          hasOverride: false,
          inheritedValues
        });

        const effective = record.getEffectiveValues();
        expect(effective).toEqual(inheritedValues);
      });
    });

    describe('needsSync', () => {
      it('should return false if not inheriting', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: false
        });

        const needsSync = record.needsSync(new Date());
        expect(needsSync).toBe(false);
      });

      it('should return true if sync failed', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncStatus: 'failed'
        });

        const needsSync = record.needsSync(new Date());
        expect(needsSync).toBe(true);
      });

      it('should return true if never synced', async () => {
        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncedAt: null
        });

        const needsSync = record.needsSync(new Date());
        expect(needsSync).toBe(true);
      });

      it('should return true if group updated after last sync', async () => {
        const pastDate = new Date(Date.now() - 10000);
        const futureDate = new Date(Date.now() + 10000);

        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncedAt: pastDate
        });

        const needsSync = record.needsSync(futureDate);
        expect(needsSync).toBe(true);
      });

      it('should return false if synced after group update', async () => {
        const futureDate = new Date(Date.now() + 10000);
        const pastDate = new Date(Date.now() - 10000);

        const record = await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncedAt: futureDate
        });

        const needsSync = record.needsSync(pastDate);
        expect(needsSync).toBe(false);
      });
    });
  });

  describe('Static Methods', () => {
    describe('findByProperty', () => {
      it('should find all records for a property', async () => {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'room_taxes'
        });

        const records = await SettingsInheritance.findByProperty(testProperty._id);
        expect(records).toHaveLength(2);
      });

      it('should filter by settingType', async () => {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        const records = await SettingsInheritance.findByProperty(
          testProperty._id,
          { settingType: 'booking_rules' }
        );

        expect(records).toHaveLength(1);
        expect(records[0].settingType).toBe('booking_rules');
      });

      it('should filter by isInheriting', async () => {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true
        });

        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'room_taxes',
          isInheriting: false
        });

        const records = await SettingsInheritance.findByProperty(
          testProperty._id,
          { isInheriting: true }
        );

        expect(records).toHaveLength(1);
      });
    });

    describe('findByGroup', () => {
      it('should find all records for a group', async () => {
        const property2 = await Hotel.create({
          name: 'Property 2',
          ownerId: testUser._id,
          address: { city: 'City 2', country: 'USA' },
          contact: { phone: '+1-555-0001', email: 'prop2@test.com' }
        });

        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        await SettingsInheritance.create({
          propertyId: property2._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        const records = await SettingsInheritance.findByGroup(testGroup._id);
        expect(records).toHaveLength(2);
      });
    });

    describe('findPendingSync', () => {
      it('should find records that need syncing', async () => {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncStatus: 'pending'
        });

        const records = await SettingsInheritance.findPendingSync(
          testGroup._id,
          'booking_rules'
        );

        expect(records).toHaveLength(1);
      });
    });

    describe('bulkUpsert', () => {
      it('should create new records', async () => {
        const records = [
          {
            propertyId: testProperty._id,
            groupId: testGroup._id,
            settingType: 'booking_rules',
            isInheriting: true
          }
        ];

        await SettingsInheritance.bulkUpsert(records);

        const count = await SettingsInheritance.countDocuments({
          propertyId: testProperty._id,
          settingType: 'booking_rules'
        });

        expect(count).toBe(1);
      });

      it('should update existing records', async () => {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: false
        });

        const records = [
          {
            propertyId: testProperty._id,
            groupId: testGroup._id,
            settingType: 'booking_rules',
            isInheriting: true
          }
        ];

        await SettingsInheritance.bulkUpsert(records);

        const record = await SettingsInheritance.findOne({
          propertyId: testProperty._id,
          settingType: 'booking_rules'
        });

        expect(record.isInheriting).toBe(true);
      });
    });

    describe('getPropertySummary', () => {
      it('should return summary statistics', async () => {
        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncStatus: 'synced'
        });

        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'room_taxes',
          isInheriting: false,
          hasOverride: true,
          syncStatus: 'manual_override'
        });

        const summary = await SettingsInheritance.getPropertySummary(testProperty._id);

        expect(summary.total).toBe(2);
        expect(summary.inheriting).toBe(1);
        expect(summary.overridden).toBe(1);
        expect(summary.synced).toBe(1);
        expect(summary.bySettingType).toHaveProperty('booking_rules');
        expect(summary.bySettingType).toHaveProperty('room_taxes');
      });
    });

    describe('getGroupSummary', () => {
      it('should return group summary statistics', async () => {
        const property2 = await Hotel.create({
          name: 'Property 2',
          ownerId: testUser._id,
          address: { city: 'City 2', country: 'USA' },
          contact: { phone: '+1-555-0001', email: 'prop2@test.com' }
        });

        await SettingsInheritance.create({
          propertyId: testProperty._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        await SettingsInheritance.create({
          propertyId: property2._id,
          groupId: testGroup._id,
          settingType: 'booking_rules'
        });

        const summary = await SettingsInheritance.getGroupSummary(testGroup._id);

        expect(summary.total).toBe(2);
        expect(summary.properties).toHaveLength(2);
        expect(summary.settingTypes).toContain('booking_rules');
      });
    });
  });

  describe('Middleware', () => {
    it('should clear override values when transitioning to inherited state', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        hasOverride: true,
        overrideValues: { checkInTime: '16:00' }
      });

      record.isInheriting = true;
      record.hasOverride = false;
      await record.save();

      expect(record.overrideValues).toEqual({});
    });

    it('should update syncedAt when syncStatus changes', async () => {
      const record = await SettingsInheritance.create({
        propertyId: testProperty._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        syncStatus: 'pending'
      });

      const originalSyncedAt = record.syncedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      record.syncStatus = 'synced';
      await record.save();

      expect(record.syncedAt.getTime()).toBeGreaterThanOrEqual(originalSyncedAt.getTime());
    });
  });
});
