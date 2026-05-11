import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/pentouz_test';

  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
});

// Global test cleanup
afterAll(() => {
  // Cleanup any global resources
});

// Mock external services
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

jest.mock('twilio', () => ({
  Twilio: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'test-sms-sid' })
    }
  }))
}));

// Mock Redis for caching tests
jest.mock('ioredis', () => {
  return jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
    setex: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    pipeline: jest.fn(() => ({
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn()
    })),
    ping: jest.fn().mockResolvedValue('PONG'),
    info: jest.fn().mockResolvedValue('used_memory_human:1.2M\nused_memory_peak_human:2.4M'),
    dbsize: jest.fn().mockResolvedValue(100),
    disconnect: jest.fn()
  }));
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeValidNotification(received) {
    const pass = received &&
      typeof received.title === 'string' &&
      typeof received.message === 'string' &&
      Array.isArray(received.channels) &&
      received.userId &&
      received.hotelId;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid notification`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid notification`,
        pass: false,
      };
    }
  },

  toBeValidTemplate(received) {
    const pass = received &&
      typeof received.name === 'string' &&
      typeof received.category === 'string' &&
      typeof received.type === 'string' &&
      typeof received.subject === 'string' &&
      typeof received.message === 'string' &&
      Array.isArray(received.channels) &&
      received.hotelId;

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid template`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid template`,
        pass: false,
      };
    }
  }
});