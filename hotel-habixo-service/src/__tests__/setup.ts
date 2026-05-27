// Jest test setup
import mongoose from 'mongoose';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = '1';

// Mock MongoDB connection for tests
jest.mock('../database/mongodb', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
  disconnectDB: jest.fn().mockResolvedValue(undefined),
  getConnectionStatus: jest.fn().mockReturnValue(true),
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
});

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
