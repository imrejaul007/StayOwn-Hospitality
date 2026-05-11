import mongoose from 'mongoose';
import { SettingsInheritanceService } from '../../services/settingsInheritance.js';
import Hotel from '../../models/Hotel.js';
import PropertyGroup from '../../models/PropertyGroup.js';
import SettingsInheritance from '../../models/SettingsInheritance.js';
import User from '../../models/User.js';

/**
 * Settings Inheritance Service Test Suite
 *
 * Tests service layer methods for settings inheritance
 */
describe('SettingsInheritanceService', () => {
  let testUser;
  let testProperty1;
  let testProperty2;
  let testProperty3;
  let testGroup;
  let standaloneProperty;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);
  });

  beforeEach(async () => {
    // Clean database
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await PropertyGroup.deleteMany({});
    await SettingsInheritance.deleteMany({});

    // Setup test data
    testUser = await User.create({
      name: 'Test User',
      email: 'test@service.test',
      password: 'password123',
      role: 'admin'
    });

    testProperty1 = await Hotel.create({
      name: 'Property 1',
      ownerId: testUser._id,
      address: { city: 'City1', country: 'USA' },
      contact: { phone: '+1-555-0001', email: 'prop1@test.com' },
      isActive: true
    });

    testProperty2 = await Hotel.create({
      name: 'Property 2',
      ownerId: testUser._id,
      address: { city: 'City2', country: 'USA' },
      contact: { phone: '+1-555-0002', email: 'prop2@test.com' },
      isActive: true
    });

    testProperty3 = await Hotel.create({
      name: 'Property 3',
      ownerId: testUser._id,
      address: { city: 'City3', country: 'USA' },
      contact: { phone: '+1-555-0003', email: 'prop3@test.com' },
      isActive: true
    });

    standaloneProperty = await Hotel.create({
      name: 'Standalone Property',
      ownerId: testUser._id,
      address: { city: 'City4', country: 'USA' },
      contact: { phone: '+1-555-0004', email: 'standalone@test.com' },
      isActive: true
    });

    testGroup = await PropertyGroup.create({
      name: 'Test Group',
      ownerId: testUser._id,
      properties: [testProperty1._id, testProperty2._id, testProperty3._id],
      settings: {
        baseCurrency: 'USD',
        timezone: 'America/New_York',
        checkInTime: '15:00',
        checkOutTime: '11:00'
      }
    });

    // Update properties to reference group
    await Hotel.updateMany(
      { _id: { $in: [testProperty1._id, testProperty2._id, testProperty3._id] } },
      {
        propertyGroupId: testGroup._id,
        'groupSettings.inheritSettings': true
      }
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('getInheritanceStatus', () => {
    it('should return correct status for property in group', async () => {
      const status = await SettingsInheritanceService.getInheritanceStatus(testProperty1._id);

      expect(status).toHaveProperty('propertyId');
      expect(status).toHaveProperty('hasGroup');
      expect(status).toHaveProperty('groupName');
      expect(status.hasGroup).toBe(true);
      expect(status.groupName).toBe('Test Group');
      expect(status.propertyName).toBe('Property 1');
    });

    it('should return correct status for standalone property', async () => {
      const status = await SettingsInheritanceService.getInheritanceStatus(standaloneProperty._id);

      expect(status.hasGroup).toBe(false);
      expect(status.groupId).toBeUndefined();
    });

    it('should throw error for non-existent property', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        SettingsInheritanceService.getInheritanceStatus(fakeId)
      ).rejects.toThrow('Property not found');
    });

    it('should include inheritance summary', async () => {
      // Create inheritance record
      await SettingsInheritance.create({
        propertyId: testProperty1._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true,
        syncStatus: 'synced'
      });

      const status = await SettingsInheritanceService.getInheritanceStatus(testProperty1._id);

      expect(status).toHaveProperty('summary');
      expect(status.summary.total).toBeGreaterThan(0);
    });
  });

  describe('applySettingsByScope', () => {
    it('should apply settings to single property', async () => {
      const result = await SettingsInheritanceService.applySettingsByScope({
        scope: 'single',
        propertyId: testProperty1._id,
        settingType: 'booking_rules',
        settingUpdates: {
          checkInTime: '14:00',
          checkOutTime: '12:00'
        },
        userId: testUser._id
      });

      expect(result.success).toBe(true);
      expect(result.propertiesUpdated).toBe(1);
      expect(result.scope).toBe('single');
    });

    it('should apply settings to all properties in group', async () => {
      const result = await SettingsInheritanceService.applySettingsByScope({
        scope: 'group',
        propertyId: testProperty1._id,
        settingType: 'booking_rules',
        settingUpdates: {
          checkInTime: '16:00'
        },
        userId: testUser._id
      });

      expect(result.success).toBe(true);
      expect(result.propertiesUpdated).toBe(3);
      expect(result.totalProperties).toBe(3);
    });

    it('should apply settings to all user properties', async () => {
      const result = await SettingsInheritanceService.applySettingsByScope({
        scope: 'all',
        propertyId: testProperty1._id,
        settingType: 'booking_rules',
        settingUpdates: {
          checkInTime: '15:00'
        },
        userId: testUser._id
      });

      expect(result.success).toBe(true);
      expect(result.propertiesUpdated).toBeGreaterThanOrEqual(4);
    });

    it('should throw error for invalid scope', async () => {
      await expect(
        SettingsInheritanceService.applySettingsByScope({
          scope: 'invalid',
          propertyId: testProperty1._id,
          settingType: 'booking_rules',
          settingUpdates: {},
          userId: testUser._id
        })
      ).rejects.toThrow('Invalid scope');
    });

    it('should throw error for group scope on standalone property', async () => {
      await expect(
        SettingsInheritanceService.applySettingsByScope({
          scope: 'group',
          propertyId: standaloneProperty._id,
          settingType: 'booking_rules',
          settingUpdates: {},
          userId: testUser._id
        })
      ).rejects.toThrow('not part of a group');
    });

    it('should return sync duration', async () => {
      const result = await SettingsInheritanceService.applySettingsByScope({
        scope: 'single',
        propertyId: testProperty1._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        userId: testUser._id
      });

      expect(result).toHaveProperty('syncDuration');
      expect(typeof result.syncDuration).toBe('number');
      expect(result.syncDuration).toBeGreaterThanOrEqual(0);
    });

    it('should create inheritance records for group scope', async () => {
      await SettingsInheritanceService.applySettingsByScope({
        scope: 'group',
        propertyId: testProperty1._id,
        settingType: 'booking_rules',
        settingUpdates: { checkInTime: '14:00' },
        userId: testUser._id
      });

      const records = await SettingsInheritance.find({
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      expect(records.length).toBeGreaterThan(0);
    });
  });

  describe('getAffectedPropertiesCount', () => {
    it('should return 1 for single scope', async () => {
      const count = await SettingsInheritanceService.getAffectedPropertiesCount({
        scope: 'single',
        propertyId: testProperty1._id
      });

      expect(count).toBe(1);
    });

    it('should return group property count for group scope', async () => {
      const count = await SettingsInheritanceService.getAffectedPropertiesCount({
        scope: 'group',
        propertyId: testProperty1._id
      });

      expect(count).toBe(3);
    });

    it('should return all user properties count for all scope', async () => {
      const count = await SettingsInheritanceService.getAffectedPropertiesCount({
        scope: 'all',
        propertyId: testProperty1._id
      });

      expect(count).toBeGreaterThanOrEqual(4);
    });

    it('should return 1 for standalone property with group scope', async () => {
      const count = await SettingsInheritanceService.getAffectedPropertiesCount({
        scope: 'group',
        propertyId: standaloneProperty._id
      });

      expect(count).toBe(1);
    });

    it('should return 0 for invalid property', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const count = await SettingsInheritanceService.getAffectedPropertiesCount({
        scope: 'single',
        propertyId: fakeId
      });

      expect(count).toBe(0);
    });
  });

  describe('getGroupInheritanceSummary', () => {
    it('should return summary for group', async () => {
      // Create inheritance records
      await SettingsInheritance.bulkCreate([
        {
          propertyId: testProperty1._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncStatus: 'synced'
        },
        {
          propertyId: testProperty2._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncStatus: 'synced'
        }
      ]);

      const summary = await SettingsInheritanceService.getGroupInheritanceSummary(testGroup._id);

      expect(summary.groupName).toBe('Test Group');
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('properties');
    });

    it('should throw error for non-existent group', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await expect(
        SettingsInheritanceService.getGroupInheritanceSummary(fakeId)
      ).rejects.toThrow('Property group not found');
    });
  });

  describe('toggleInheritance', () => {
    it('should enable inheritance for a setting', async () => {
      const result = await SettingsInheritanceService.toggleInheritance(
        testProperty1._id,
        'booking_rules',
        true
      );

      expect(result.success).toBe(true);
      expect(result.inheritance.isInheriting).toBe(true);
      expect(result.inheritance.syncStatus).toBe('pending');
    });

    it('should disable inheritance for a setting', async () => {
      const result = await SettingsInheritanceService.toggleInheritance(
        testProperty1._id,
        'booking_rules',
        false
      );

      expect(result.success).toBe(true);
      expect(result.inheritance.isInheriting).toBe(false);
      expect(result.inheritance.syncStatus).toBe('manual_override');
    });

    it('should create new record if none exists', async () => {
      const countBefore = await SettingsInheritance.countDocuments({
        propertyId: testProperty1._id,
        settingType: 'room_taxes'
      });

      await SettingsInheritanceService.toggleInheritance(
        testProperty1._id,
        'room_taxes',
        true
      );

      const countAfter = await SettingsInheritance.countDocuments({
        propertyId: testProperty1._id,
        settingType: 'room_taxes'
      });

      expect(countAfter).toBe(countBefore + 1);
    });

    it('should update existing record', async () => {
      // Create record
      await SettingsInheritance.create({
        propertyId: testProperty1._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true
      });

      // Toggle it
      await SettingsInheritanceService.toggleInheritance(
        testProperty1._id,
        'booking_rules',
        false
      );

      const record = await SettingsInheritance.findOne({
        propertyId: testProperty1._id,
        settingType: 'booking_rules'
      });

      expect(record.isInheriting).toBe(false);
    });

    it('should fail for property not in group', async () => {
      await expect(
        SettingsInheritanceService.toggleInheritance(
          standaloneProperty._id,
          'booking_rules',
          true
        )
      ).rejects.toThrow('not part of a group');
    });
  });

  describe('setOverride', () => {
    it('should set override values', async () => {
      const overrideValues = {
        checkInTime: '16:00',
        checkOutTime: '10:00'
      };

      const result = await SettingsInheritanceService.setOverride(
        testProperty1._id,
        'booking_rules',
        overrideValues,
        testUser._id
      );

      expect(result.success).toBe(true);
      expect(result.inheritance.hasOverride).toBe(true);
      expect(result.inheritance.overrideValues).toMatchObject(overrideValues);
      expect(result.inheritance.isInheriting).toBe(false);
    });

    it('should create new record with override', async () => {
      const overrideValues = { checkInTime: '17:00' };

      await SettingsInheritanceService.setOverride(
        testProperty1._id,
        'room_taxes',
        overrideValues,
        testUser._id
      );

      const record = await SettingsInheritance.findOne({
        propertyId: testProperty1._id,
        settingType: 'room_taxes'
      });

      expect(record).toBeTruthy();
      expect(record.hasOverride).toBe(true);
    });

    it('should update existing record with override', async () => {
      // Create record first
      await SettingsInheritance.create({
        propertyId: testProperty1._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true
      });

      const overrideValues = { checkInTime: '18:00' };
      await SettingsInheritanceService.setOverride(
        testProperty1._id,
        'booking_rules',
        overrideValues,
        testUser._id
      );

      const record = await SettingsInheritance.findOne({
        propertyId: testProperty1._id,
        settingType: 'booking_rules'
      });

      expect(record.hasOverride).toBe(true);
      expect(record.overrideValues).toMatchObject(overrideValues);
    });
  });

  describe('removeOverride', () => {
    it('should remove override and restore inheritance', async () => {
      // Set override first
      await SettingsInheritanceService.setOverride(
        testProperty1._id,
        'booking_rules',
        { checkInTime: '16:00' },
        testUser._id
      );

      // Remove override
      const result = await SettingsInheritanceService.removeOverride(
        testProperty1._id,
        'booking_rules'
      );

      expect(result.success).toBe(true);
      expect(result.inheritance.hasOverride).toBe(false);
      expect(result.inheritance.isInheriting).toBe(true);
    });

    it('should throw error if record not found', async () => {
      await expect(
        SettingsInheritanceService.removeOverride(
          testProperty1._id,
          'non_existent_setting'
        )
      ).rejects.toThrow('Inheritance record not found');
    });
  });

  describe('validateSettings', () => {
    it('should validate check-in/out times', async () => {
      const result = SettingsInheritanceService.validateSettings(
        {
          checkInTime: '15:00',
          checkOutTime: '11:00'
        },
        'checkInOut'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid time format', async () => {
      const result = SettingsInheritanceService.validateSettings(
        {
          checkInTime: '25:00'
        },
        'checkInOut'
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate currency codes', async () => {
      const result = SettingsInheritanceService.validateSettings(
        { currency: 'USD' },
        'currency'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject invalid currency codes', async () => {
      const result = SettingsInheritanceService.validateSettings(
        { currency: 'INVALID' },
        'currency'
      );

      expect(result.valid).toBe(false);
    });

    it('should validate timezone', async () => {
      const result = SettingsInheritanceService.validateSettings(
        { timezone: 'America/New_York' },
        'timezone'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject invalid timezone', async () => {
      const result = SettingsInheritanceService.validateSettings(
        { timezone: 'Invalid/Timezone' },
        'timezone'
      );

      expect(result.valid).toBe(false);
    });
  });

  describe('canOverride', () => {
    it('should allow override for standalone property', async () => {
      const canOverride = await SettingsInheritanceService.canOverride(
        standaloneProperty,
        'checkInTime'
      );

      expect(canOverride).toBe(true);
    });

    it('should check group override settings', async () => {
      const property = await Hotel.findById(testProperty1._id);
      const canOverride = await SettingsInheritanceService.canOverride(
        property,
        'checkInTime'
      );

      expect(typeof canOverride).toBe('boolean');
    });

    it('should allow override if group not found', async () => {
      const property = await Hotel.findById(testProperty1._id);
      // Remove the group
      await PropertyGroup.deleteOne({ _id: testGroup._id });

      const canOverride = await SettingsInheritanceService.canOverride(
        property,
        'checkInTime'
      );

      expect(canOverride).toBe(true);
    });
  });
});
