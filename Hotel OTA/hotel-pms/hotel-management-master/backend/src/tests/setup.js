import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';

// Apply timeout immediately for all tests/hooks in this runtime.
jest.setTimeout(120000);
let replset;

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Start in-memory replica set so transaction-based tests can run.
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '7.0.14' }
  });
  const mongoUri = replset.getUri();
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

  global.testUtils = {
    async createTestHotel(overrides = {}) {
      const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const owner = await User.create({
        name: `Owner ${suffix}`,
        email: `owner-${suffix}@test.com`,
        password: 'password123',
        role: 'guest'
      });

      return Hotel.create({
        name: `Test Hotel ${suffix}`,
        address: {
          city: 'Test City',
          country: 'India'
        },
        contact: {
          phone: '+910000000000',
          email: `hotel-${suffix}@test.com`
        },
        ownerId: owner._id,
        ...overrides
      });
    },

    async createTestUser(overrides = {}) {
      const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      return User.create({
        name: `User ${suffix}`,
        email: `user-${suffix}@test.com`,
        password: 'password123',
        role: 'guest',
        ...overrides
      });
    },

    generateTestToken(user) {
      return jwt.sign(
        {
          id: user._id,
          role: user.role || 'guest',
          hotelId: user.hotelId
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    }
  };
});

// Global test teardown
afterAll(async () => {
  // Close any remaining connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replset) {
    await replset.stop();
  }
  delete global.testUtils;
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
