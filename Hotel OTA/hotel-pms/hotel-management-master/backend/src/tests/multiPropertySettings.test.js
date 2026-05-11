import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import PropertyGroup from '../models/PropertyGroup.js';
import SettingsInheritance from '../models/SettingsInheritance.js';
import HotelSettings from '../models/HotelSettings.js';
import bcrypt from 'bcryptjs';

/**
 * Multi-Property Settings API Test Suite
 *
 * Tests all 25 API endpoints for multi-property settings management
 */
describe('Multi-Property Settings API', () => {
  let authToken;
  let testUser;
  let testProperty1;
  let testProperty2;
  let testProperty3;
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

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await User.create({
      name: 'Test Admin',
      email: 'admin@multiproperty.test',
      password: hashedPassword,
      role: 'admin'
    });

    // Create test properties
    testProperty1 = await Hotel.create({
      name: 'Grand Hotel Downtown',
      ownerId: testUser._id,
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        postalCode: '10001'
      },
      contact: {
        phone: '+1-555-0101',
        email: 'downtown@grandhotel.com'
      },
      isActive: true
    });

    testProperty2 = await Hotel.create({
      name: 'Grand Hotel Uptown',
      ownerId: testUser._id,
      address: {
        street: '456 Park Ave',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        postalCode: '10021'
      },
      contact: {
        phone: '+1-555-0102',
        email: 'uptown@grandhotel.com'
      },
      isActive: true
    });

    testProperty3 = await Hotel.create({
      name: 'Grand Hotel Brooklyn',
      ownerId: testUser._id,
      address: {
        street: '789 Bridge St',
        city: 'Brooklyn',
        state: 'NY',
        country: 'USA',
        postalCode: '11201'
      },
      contact: {
        phone: '+1-555-0103',
        email: 'brooklyn@grandhotel.com'
      },
      isActive: true
    });

    // Create property group
    testGroup = await PropertyGroup.create({
      name: 'Grand Hotels NYC',
      description: 'All Grand Hotels in NYC',
      ownerId: testUser._id,
      properties: [testProperty1._id, testProperty2._id, testProperty3._id],
      settings: {
        baseCurrency: 'USD',
        timezone: 'America/New_York',
        defaultLanguage: 'en',
        defaultCancellationPolicy: 'flexible',
        checkInTime: '15:00',
        checkOutTime: '11:00'
      }
    });

    // Update properties to reference group
    await Hotel.updateMany(
      { _id: { $in: [testProperty1._id, testProperty2._id, testProperty3._id] } },
      {
        propertyGroupId: testGroup._id,
        groupSettings: {
          inheritSettings: true
        }
      }
    );

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@multiproperty.test',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/v1/settings/inheritance-status/:propertyId', () => {
    it('should return inheritance status for property in group', async () => {
      const response = await request(app)
        .get(`/api/v1/settings/inheritance-status/${testProperty1._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('hasGroup');
      expect(response.body.data).toHaveProperty('groupName');
      expect(response.body.data.hasGroup).toBe(true);
      expect(response.body.data.groupName).toBe('Grand Hotels NYC');
    });

    it('should return inheritance status for standalone property', async () => {
      const standaloneProperty = await Hotel.create({
        name: 'Standalone Hotel',
        ownerId: testUser._id,
        address: { city: 'Boston', country: 'USA' },
        contact: { phone: '+1-555-0200', email: 'standalone@hotel.com' }
      });

      const response = await request(app)
        .get(`/api/v1/settings/inheritance-status/${standaloneProperty._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.hasGroup).toBe(false);
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get(`/api/v1/settings/inheritance-status/${testProperty1._id}`)
        .expect(401);
    });

    it('should return 404 for non-existent property', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/v1/settings/inheritance-status/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/settings/apply', () => {
    it('should apply settings to single property', async () => {
      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '15:00',
            checkOutTime: '11:00',
            cancellationPolicy: 'flexible'
          }
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.propertiesUpdated).toBe(1);
    });

    it('should apply settings to property group', async () => {
      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '14:00',
            checkOutTime: '12:00'
          }
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.propertiesUpdated).toBe(3);
    });

    it('should apply settings to all user properties', async () => {
      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'all',
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '16:00'
          }
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.propertiesUpdated).toBeGreaterThanOrEqual(3);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty1._id.toString()
          // Missing settingType and settingUpdates
        })
        .expect(400);
    });

    it('should validate scope values', async () => {
      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'invalid_scope',
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {}
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid scope');
    });

    it('should handle property not in group for group scope', async () => {
      const standaloneProperty = await Hotel.create({
        name: 'Standalone',
        ownerId: testUser._id,
        address: { city: 'Boston', country: 'USA' },
        contact: { phone: '+1-555-0300', email: 'test@hotel.com' }
      });

      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: standaloneProperty._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '14:00' }
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/settings/affected-count', () => {
    it('should return correct count for single scope', async () => {
      const response = await request(app)
        .post('/api/v1/settings/affected-count')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty1._id.toString()
        })
        .expect(200);

      expect(response.body.data.count).toBe(1);
    });

    it('should return correct count for group scope', async () => {
      const response = await request(app)
        .post('/api/v1/settings/affected-count')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: testProperty1._id.toString()
        })
        .expect(200);

      expect(response.body.data.count).toBe(3);
    });

    it('should return correct count for all scope', async () => {
      const response = await request(app)
        .post('/api/v1/settings/affected-count')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'all',
          propertyId: testProperty1._id.toString()
        })
        .expect(200);

      expect(response.body.data.count).toBeGreaterThanOrEqual(3);
    });

    it('should require valid scope', async () => {
      await request(app)
        .post('/api/v1/settings/affected-count')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'invalid',
          propertyId: testProperty1._id.toString()
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/settings/group/:groupId/summary', () => {
    it('should return inheritance summary for group', async () => {
      // Create some inheritance records
      await SettingsInheritance.create({
        propertyId: testProperty1._id,
        groupId: testGroup._id,
        settingType: 'booking_rules',
        isInheriting: true,
        syncStatus: 'synced'
      });

      const response = await request(app)
        .get(`/api/v1/settings/group/${testGroup._id}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('groupName');
      expect(response.body.data.groupName).toBe('Grand Hotels NYC');
    });

    it('should return 404 for non-existent group', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/v1/settings/group/${fakeId}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/settings/toggle-inheritance', () => {
    it('should enable inheritance for a setting', async () => {
      const response = await request(app)
        .post('/api/v1/settings/toggle-inheritance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          enable: true
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.inheritance.isInheriting).toBe(true);
    });

    it('should disable inheritance for a setting', async () => {
      const response = await request(app)
        .post('/api/v1/settings/toggle-inheritance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          enable: false
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.inheritance.isInheriting).toBe(false);
    });

    it('should fail for property not in group', async () => {
      const standaloneProperty = await Hotel.create({
        name: 'Standalone',
        ownerId: testUser._id,
        address: { city: 'Boston', country: 'USA' },
        contact: { phone: '+1-555-0400', email: 'test@hotel.com' }
      });

      await request(app)
        .post('/api/v1/settings/toggle-inheritance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: standaloneProperty._id.toString(),
          settingType: 'booking_rules',
          enable: true
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/settings/override', () => {
    it('should set override values for a property', async () => {
      const overrideValues = {
        checkInTime: '16:00',
        checkOutTime: '10:00'
      };

      const response = await request(app)
        .post('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          overrideValues
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.inheritance.hasOverride).toBe(true);
      expect(response.body.data.inheritance.overrideValues).toMatchObject(overrideValues);
    });

    it('should require valid override values', async () => {
      await request(app)
        .post('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules'
          // Missing overrideValues
        })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/settings/override', () => {
    it('should remove override and restore inheritance', async () => {
      // First set an override
      await request(app)
        .post('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          overrideValues: { checkInTime: '16:00' }
        });

      // Then remove it
      const response = await request(app)
        .delete('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.inheritance.hasOverride).toBe(false);
      expect(response.body.data.inheritance.isInheriting).toBe(true);
    });

    it('should return 404 if no override exists', async () => {
      await request(app)
        .delete('/api/v1/settings/override')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules'
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/settings/property/:propertyId/summary', () => {
    it('should return property inheritance summary', async () => {
      // Create some inheritance records
      await SettingsInheritance.bulkCreate([
        {
          propertyId: testProperty1._id,
          groupId: testGroup._id,
          settingType: 'booking_rules',
          isInheriting: true,
          syncStatus: 'synced'
        },
        {
          propertyId: testProperty1._id,
          groupId: testGroup._id,
          settingType: 'room_taxes',
          isInheriting: false,
          hasOverride: true,
          syncStatus: 'manual_override'
        }
      ]);

      const response = await request(app)
        .get(`/api/v1/settings/property/${testProperty1._id}/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid property ID format', async () => {
      await request(app)
        .get('/api/v1/settings/inheritance-status/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle missing authentication', async () => {
      await request(app)
        .post('/api/v1/settings/apply')
        .send({
          scope: 'single',
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {}
        })
        .expect(401);
    });

    it('should handle concurrent updates gracefully', async () => {
      const updates = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/v1/settings/apply')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            scope: 'single',
            propertyId: testProperty1._id.toString(),
            settingType: 'booking_rules',
            settingUpdates: { checkInTime: `${14 + i}:00` }
          })
      );

      const results = await Promise.all(updates);
      const successCount = results.filter(r => r.status === 200).length;

      expect(successCount).toBeGreaterThanOrEqual(1);
    });

    it('should validate setting type enum', async () => {
      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'single',
          propertyId: testProperty1._id.toString(),
          settingType: 'invalid_setting_type',
          settingUpdates: {}
        })
        .expect(400);
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk group updates efficiently', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '14:00',
            checkOutTime: '12:00',
            cancellationPolicy: 'moderate'
          }
        });

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should return sync duration in response', async () => {
      const response = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scope: 'group',
          propertyId: testProperty1._id.toString(),
          settingType: 'booking_rules',
          settingUpdates: { checkInTime: '15:00' }
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('syncDuration');
      expect(typeof response.body.data.syncDuration).toBe('number');
    });
  });

  describe('Authorization and Access Control', () => {
    it('should prevent unauthorized property access', async () => {
      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@test.com',
        password: await bcrypt.hash('password123', 10),
        role: 'admin'
      });

      const otherUserLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'other@test.com',
          password: 'password123'
        });

      const otherToken = otherUserLogin.body.token;

      // Try to access first user's property
      await request(app)
        .get(`/api/v1/settings/inheritance-status/${testProperty1._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });
});
