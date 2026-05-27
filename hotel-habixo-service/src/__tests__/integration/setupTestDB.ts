// Test database utilities for clearing collections
import mongoose from 'mongoose';

/**
 * Clear all collections in the test database
 * Call this in beforeEach to ensure a clean state
 */
export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Clear a specific collection
 */
export async function clearCollection(modelName: string): Promise<void> {
  const collection = mongoose.connection.collections[modelName];
  if (collection) {
    await collection.deleteMany({});
  }
}

/**
 * Drop all collections (use with caution)
 */
export async function dropAllCollections(): Promise<void> {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].drop();
  }
}

/**
 * Wait for mongoose to be ready
 */
export async function waitForConnection(timeoutMs: number = 5000): Promise<void> {
  const start = Date.now();

  while (mongoose.connection.readyState !== 1) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('MongoDB connection timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
