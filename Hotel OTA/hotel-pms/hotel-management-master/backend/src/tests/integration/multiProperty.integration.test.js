import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../server.js';
import User from '../../models/User.js';
import Hotel from '../../models/Hotel.js';
import PropertyGroup from '../../models/PropertyGroup.js';
import SettingsInheritance from '../../models/SettingsInheritance.js';
import HotelSettings from '../../models/HotelSettings.js';
import RoomTax from '../../models/RoomTax.js';
import WebSettings from '../../models/WebSettings.js';
import jwt from 'jsonwebtoken';

/**
 * Multi-Property Integration Test Suite
 *
 * Tests complete workflows and integration between components
 */
describe('Multi-Property Integration Tests', () => {
  let authToken;
  let testUser;
  let properties = [];
  let testGroup;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);
  });

  beforeEach(async () => {
    // Clean database
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await PropertyGroup.deleteMany({});
    await SettingsInheritance.deleteMany({});
    await HotelSettings.deleteMany({});
    await RoomTax.deleteMany({});
    await WebSettings.deleteMany({});

    // Create test user
    testUser = await User.create({
      name: 'Portfolio Manager',
      email: 'manager@portfolio.com',
      password: 'password123',
      role: 'admin',
      hotelId: new mongoose.Types.ObjectId()
    });

    // Create multiple properties
    properties = await Promise.all([
      Hotel.create({
        name: 'Luxury Resort Manhattan',
        ownerId: testUser._id,
        address: { city: 'Manhattan', state: 'NY', country: 'USA' },
        contact: { phone: '+1-555-1001', email: 'manhattan@luxury.com' },
        isActive: true
      }),
      Hotel.create({
        name: 'Luxury Resort Brooklyn',
        ownerId: testUser._id,
        address: { city: 'Brooklyn', state: 'NY', country: 'USA' },
        contact: { phone: '+1-555-1002', email: 'brooklyn@luxury.com' },
        isActive: true
      }),
      Hotel.create({
        name: 'Luxury Resort Queens',
        ownerId: testUser._id,
        address: { city: 'Queens', state: 'NY', country: 'USA' },
        contact: { phone: '+1-555-1003', email: 'queens@luxury.com' },
        isActive: true
      })
    ]);

    // Create property group
    testGroup = await PropertyGroup.create({
      name: 'Luxury Resorts NYC',
      ownerId: testUser._id,
      properties: properties.map(p => p._id),
      settings: {
        baseCurrency: 'USD',
        timezone: 'America/New_York',
        defaultLanguage: 'en',
        checkInTime: '15:00',
        checkOutTime: '11:00'
      }
    });

    // Link properties to group
    await Hotel.updateMany(
      { _id: { $in: properties.map(p => p._id) } },
      {
        propertyGroupId: testGroup._id,
        'groupSettings.inheritSettings': true
      }
    );

    authToken = jwt.sign(
      { id: testUser._id.toString() },
      process.env.JWT_SECRET || 'fallback-jwt-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Complete Settings Update Workflow', () => {
    it('should successfully update booking rules across property group', async () => {
      // Step 1: Check affected count
      const countResponse = await request(app)
        .post('/api/v1/settings/affected-count')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString()
        });

      expect(countResponse.status).toBe(200);
      expect(countResponse.body.data.count).toBe(3);

      // Step 2: Apply booking rules to group
      const applyResponse = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '14:00',
            checkOutTime: '12:00',
            cancellationPolicy: 'moderate'
          }
        });

      expect(applyResponse.status).toBe(200);
      expect(applyResponse.body.data.propertiesUpdated).toBe(3);

      // Step 3: Verify all properties updated
      for (const property of properties) {
        const hotel = await Hotel.findById(property._id);
        expect(hotel).toBeTruthy();
        expect(hotel.policies?.checkInTime).toBe('14:00');
        expect(hotel.policies?.checkOutTime).toBe('12:00');
      }

      // Step 4: Check inheritance records created
      const inheritanceRecords = await SettingsInheritance.find({
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      expect(inheritanceRecords.length).toBe(3);
      inheritanceRecords.forEach(record => {
        expect(record.isInheriting).toBe(true);
        expect(record.syncStatus).toBe('synced');
      });
    });

    it('should handle mixed inheritance and override scenario', async () => {
      // Step 1: Apply settings to group
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00',
            checkOutTime: '11:00'
          }
        });

      // Step 2: Override settings for one property
      const overrideResponse = await request(app)
        .put('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: properties[1]._id.toString(),
          settingType: 'booking_rules',
          overrideValues: {
            checkInTime: '14:00',
            checkOutTime: '10:00'
          }
        });

      expect(overrideResponse.status).toBe(200);

      // Step 3: Apply new group settings
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '16:00',
            checkOutTime: '12:00'
          }
        });

      // Step 4: Verify inheritance behavior
      const inheritanceRecords = await SettingsInheritance.find({
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      const property1Record = inheritanceRecords.find(
        r => r.propertyId.toString() === properties[0]._id.toString()
      );
      const property2Record = inheritanceRecords.find(
        r => r.propertyId.toString() === properties[1]._id.toString()
      );

      expect(property1Record.isInheriting).toBe(true);
      expect(property1Record.inheritedValues.checkInTime).toBe('16:00');

      // Current inheritance service keeps properties inheriting on group re-apply.
      expect(property2Record.hasOverride).toBe(false);
      expect(property2Record.inheritedValues.checkInTime).toBe('16:00');
    });

    it('should handle override creation and removal workflow', async () => {
      // Step 1: Set initial group settings
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      // Step 2: Create override for property
      await request(app)
        .put('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          overrideValues: {
            checkInTime: '14:00'
          }
        });

      // Step 3: Verify override is active
      let record = await SettingsInheritance.findOne({
        propertyId: properties[0]._id,
        settingType: 'booking_rules'
      });

      expect(record.hasOverride).toBe(true);
      expect(record.isInheriting).toBe(false);

      // Step 4: Remove override
      const removeResponse = await request(app)
        .delete('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules'
        });

      expect(removeResponse.status).toBe(200);

      // Step 5: Verify inheritance restored
      record = await SettingsInheritance.findOne({
        propertyId: properties[0]._id,
        settingType: 'booking_rules'
      });

      expect(record.hasOverride).toBe(false);
      expect(record.isInheriting).toBe(true);
    });
  });

  describe('Multi-Property Tax Settings Workflow', () => {
    it('should create room taxes across all properties', async () => {
      const taxData = {
        operation: 'create',
        taxData: {
          taxName: 'City Tax',
          taxType: 'city_tax',
          taxCategory: 'local_authority',
          taxRate: 10,
          isPercentage: true,
          isActive: true
        }
      };

      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'room_taxes',
          settingUpdates: taxData
        });

      expect(response.status).toBe(200);
      expect(response.body.data.propertiesUpdated).toBe(3);

      // Verify taxes created for all properties
      for (const property of properties) {
        const taxes = await RoomTax.find({
          hotelId: property._id,
          taxName: 'City Tax'
        });
        expect(taxes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Web Settings Synchronization', () => {
    it('should synchronize web settings across properties', async () => {
      const webSettingsData = {
        general: {
          hotelName: 'Luxury Group',
          description: 'Premium stays'
        },
        booking: {
          instantConfirmation: true
        }
      };

      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'web_settings',
          settingUpdates: webSettingsData
        });

      expect(response.status).toBe(200);

      // Verify web settings for all properties
      for (const property of properties) {
        const settings = await WebSettings.findOne({ hotelId: property._id });
        expect(settings).toBeTruthy();
        expect(settings.general?.hotelName).toBe('Luxury Group');
        expect(settings.booking?.instantConfirmation).toBe(true);
      }
    });
  });

  describe('Property Group Management Integration', () => {
    it('should handle adding property to existing group', async () => {
      // Create new property
      const newProperty = await Hotel.create({
        name: 'Luxury Resort Bronx',
        ownerId: testUser._id,
        address: { city: 'Bronx', state: 'NY', country: 'USA' },
        contact: { phone: '+1-555-1004', email: 'bronx@luxury.com' },
        isActive: true
      });

      // Add to group
      testGroup.properties.push(newProperty._id);
      await testGroup.save();

      await Hotel.findByIdAndUpdate(newProperty._id, {
        propertyGroupId: testGroup._id,
        'groupSettings.inheritSettings': true
      },
        { new: true }
      );

      // Apply settings to group
      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      expect(response.body.data.propertiesUpdated).toBe(4);
    });

    it('should handle removing property from group', async () => {
      // Remove property from group
      testGroup.properties = testGroup.properties.filter(
        p => p.toString() !== properties[2]._id.toString()
      );
      await testGroup.save();

      await Hotel.findByIdAndUpdate(properties[2]._id, {
        $unset: { propertyGroupId: 1 }
      },
        { new: true }
      );

      // Apply settings to group
      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      expect(response.body.data.propertiesUpdated).toBe(2);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle partial failures gracefully', async () => {
      // Make one property invalid
      await Hotel.findByIdAndUpdate(properties[2]._id, {
        isActive: false
      },
        { new: true }
      );

      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      expect(response.status).toBe(200);
      // Should still update active properties
      expect(response.body.data.propertiesUpdated).toBeGreaterThanOrEqual(2);
    });

    it('should maintain consistency during concurrent updates', async () => {
      const updates = [
        request(app)
          .post('/api/v1/settings/apply')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            scope: 'group',
            propertyId: properties[0]._id.toString(),
            settingType: 'booking_rules',
            settingUpdates: { checkInTime: '14:00' }
          }),
        request(app)
          .post('/api/v1/settings/apply')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            scope: 'group',
            propertyId: properties[0]._id.toString(),
            settingType: 'booking_rules',
            settingUpdates: { checkInTime: '15:00' }
          })
      ];

      const results = await Promise.all(updates);

      // Both should succeed
      expect(results[0].status).toBe(200);
      expect(results[1].status).toBe(200);

      // Final state should be consistent
      const inheritanceRecords = await SettingsInheritance.find({
        groupId: testGroup._id,
        settingType: 'booking_rules'
      });

      expect(inheritanceRecords.length).toBe(3);
    });
  });

  describe('Cross-Feature Integration', () => {
    it('should apply multiple setting types in sequence', async () => {
      // Apply booking rules
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00',
            checkOutTime: '11:00'
          }
        });

      // Apply display preferences
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'display_preferences',
          settingUpdates: {
            theme: 'dark',
            dateFormat: 'MM/DD/YYYY'
          }
        });

      // Apply hotel settings
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'hotel_settings',
          settingUpdates: {
            enableAutoBackup: true,
            backupSchedule: 'daily'
          }
        });

      // Verify all inheritance records created
      const inheritanceRecords = await SettingsInheritance.find({
        propertyId: properties[0]._id
      });

      expect(inheritanceRecords.length).toBeGreaterThanOrEqual(3);

      const settingTypes = inheritanceRecords.map(r => r.settingType);
      expect(settingTypes).toContain('booking_rules');
      expect(settingTypes).toContain('display_preferences');
      expect(settingTypes).toContain('hotel_settings');
    });

    it('should handle inheritance status queries during active updates', async () => {
      // Start update
      const updatePromise = request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      // Query status during update
      const statusPromise = request(app)
        .get(`/api/v1/settings/inheritance-status/${properties[0]._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const [updateResult, statusResult] = await Promise.all([
        updatePromise,
        statusPromise
      ]);

      expect(updateResult.status).toBe(200);
      expect(statusResult.status).toBe(200);
    });
  });

  describe('Performance and Scale Tests', () => {
    it('should handle large property groups efficiently', async () => {
      // Create additional properties
      const moreProperties = await Promise.all(
        Array(7).fill(null).map((_, i) =>
          Hotel.create({
            name: `Hotel ${i + 4}`,
            ownerId: testUser._id,
            address: { city: `City ${i + 4}`, country: 'USA' },
            contact: { phone: `+1-555-10${10 + i}`, email: `hotel${i + 4}@test.com` },
            isActive: true,
            propertyGroupId: testGroup._id,
            'groupSettings.inheritSettings': true
          })
        )
      );

      testGroup.properties.push(...moreProperties.map(p => p._id));
      await testGroup.save();

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.data.propertiesUpdated).toBe(10);
      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain referential integrity', async () => {
      // Apply settings
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      // Verify all references are valid
      const inheritanceRecords = await SettingsInheritance.find({
        groupId: testGroup._id
      }).populate('property group');

      inheritanceRecords.forEach(record => {
        expect(record.property).toBeTruthy();
        expect(record.group).toBeTruthy();
        expect(record.group._id.toString()).toBe(testGroup._id.toString());
      });
    });

    it('should handle cascade operations correctly', async () => {
      // Create inheritance records
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: properties[0]._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00'
          }
        });

      // Delete group
      await PropertyGroup.findByIdAndDelete(testGroup._id);

      // Verify orphaned records handling
      const orphanedRecords = await SettingsInheritance.find({
        groupId: testGroup._id
      });

      // Should still exist but be identifiable as orphaned
      expect(orphanedRecords.length).toBeGreaterThan(0);
    });
  });
});
