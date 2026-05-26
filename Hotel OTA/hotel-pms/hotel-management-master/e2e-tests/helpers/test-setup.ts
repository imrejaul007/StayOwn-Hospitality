import logger from './utils/logger';

import { test as base } from '@playwright/test';
import { AuthHelper } from './auth-helper';
import { BookingHelper } from './booking-helper';

// Define custom fixtures
type TestFixtures = {
  authHelper: AuthHelper;
  bookingHelper: BookingHelper;
};

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
  authHelper: async ({ page }, use) => {
    const authHelper = new AuthHelper(page);
    await use(authHelper);
  },

  bookingHelper: async ({ page }, use) => {
    const bookingHelper = new BookingHelper(page);
    await use(bookingHelper);
  },
});

export { expect } from '@playwright/test';

// Global test hooks
export const globalSetup = async () => {
  logger.info('Setting up test environment...');

  // You can add global setup logic here
  // For example, seeding the database, starting services, etc.

  return async () => {
    logger.info('Tearing down test environment...');
    // Global teardown logic
  };
};

// Helper function to reset database to clean state
export async function resetTestDatabase() {
  // This would typically call your backend API to reset test data
  try {
    const response = await fetch('http://localhost:4000/api/v1/test/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true'
      }
    });

    if (!response.ok) {
      logger.warn('Failed to reset test database');
    }
  } catch (error) {
    logger.warn('Database reset endpoint not available');
  }
}

// Helper function to wait for backend to be ready
export async function waitForBackend(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:4000/health');
      if (response.ok) {
        logger.info('Backend is ready');
        return true;
      }
    } catch (error) {
      // Backend not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Backend failed to start within timeout');
}

// Helper function to wait for frontend to be ready
export async function waitForFrontend(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:3000');
      if (response.ok) {
        logger.info('Frontend is ready');
        return true;
      }
    } catch (error) {
      // Frontend not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Frontend failed to start within timeout');
}

// Common test data generators
export const generateTestEmail = () => `test.${Date.now()}@example.com`;
export const generateTestPhone = () => `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
export const generateBookingReference = () => `TEST${Date.now().toString(36).toUpperCase()}`;

// Performance metrics helper
export class PerformanceHelper {
  private marks: Map<string, number> = new Map();

  mark(name: string) {
    this.marks.set(name, Date.now());
  }

  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark);
    if (!start) {
      throw new Error(`Mark ${startMark} not found`);
    }

    const duration = Date.now() - start;
    logger.info(`Performance: ${name} took ${duration}ms`);
    return duration;
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      logger.info(`Performance: ${name} took ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.info(`Performance: ${name} failed after ${duration}ms`);
      throw error;
    }
  }
}

// Retry helper for flaky operations
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.info(`Attempt ${i + 1} failed, retrying...`);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

// Screenshot helper with custom naming
export async function takeScreenshot(page: any, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshots/${name}-${timestamp}.png`;

  await page.screenshot({
    path: filename,
    fullPage: true
  });

  logger.info(`Screenshot saved: ${filename}`);
  return filename;
}

// API helper for direct backend testing
export class APIHelper {
  private baseURL = 'http://localhost:4000/api/v1';
  private token: string | null = null;

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    this.token = data.token;
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`GET ${endpoint} failed: ${response.status}`);
    }

    return response.json();
  }

  async post(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`POST ${endpoint} failed: ${response.status}`);
    }

    return response.json();
  }

  async put(endpoint: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`PUT ${endpoint} failed: ${response.status}`);
    }

    return response.json();
  }

  async delete(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`DELETE ${endpoint} failed: ${response.status}`);
    }

    return response.json();
  }
}