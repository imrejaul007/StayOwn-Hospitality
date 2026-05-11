import { describe, test, expect } from 'vitest';
import { ensureAuthenticated, loginAsAdmin, loginAsGuest, getAuthToken, setAuthToken } from './auth';

describe('auth utils production safety', () => {
  test('does not expose bearer token from storage', () => {
    expect(getAuthToken()).toBeNull();
    expect(() => setAuthToken('token-1')).not.toThrow();
  });

  test('disables demo auto-login helpers', async () => {
    await expect(loginAsAdmin()).rejects.toThrow('disabled for production safety');
    await expect(loginAsGuest()).rejects.toThrow('disabled for production safety');
    await expect(ensureAuthenticated()).rejects.toThrow('Authentication required');
  });
});
