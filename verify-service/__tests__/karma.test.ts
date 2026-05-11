/**
 * Unit Tests for Karma Integration
 */

import { recordProductVerification, getKarmaProfile, getKarmaMultiplier } from '../src/lib/karma';

// Mock fetch
global.fetch = jest.fn();

describe('Karma Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.KARMA_API_URL = 'http://localhost:4001';
    process.env.INTERNAL_SERVICE_KEY = 'test-key';
  });

  describe('recordProductVerification', () => {
    it('should record verification to karma service', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ karmaEarned: 5, totalKarma: 100 }),
      });

      const result = await recordProductVerification(
        'user-123',
        'brand-456',
        'product-789',
        'serial-abc',
        { lat: 12.97, lng: 77.59 }
      );

      expect(result.success).toBe(true);
      expect(result.karmaEarned).toBe(5);
      expect(result.newTotal).toBe(100);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4001/api/karma/verify/checkin',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Service-Key': 'test-key',
          }),
        })
      );
    });

    it('should handle karma service failure gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Service error' }),
      });

      const result = await recordProductVerification(
        'user-123',
        'brand-456',
        'product-789',
        'serial-abc'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service error');
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await recordProductVerification(
        'user-123',
        'brand-456',
        'product-789',
        'serial-abc'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Karma service unavailable');
    });
  });

  describe('getKarmaProfile', () => {
    it('should fetch karma profile', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          totalKarma: 500,
          level: 'gold',
          verificationCount: 10,
        }),
      });

      const result = await getKarmaProfile('user-123');

      expect(result.success).toBe(true);
      expect(result.profile?.totalKarma).toBe(500);
      expect(result.profile?.level).toBe('gold');
    });

    it('should return default values for missing profile', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      const result = await getKarmaProfile('user-123');

      expect(result.success).toBe(false);
    });
  });

  describe('getKarmaMultiplier', () => {
    it('should return correct multiplier for bronze tier', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          totalKarma: 100,
          level: 'bronze',
        }),
      });

      const result = await getKarmaMultiplier('user-123');

      expect(result.multiplier).toBe(1.0);
      expect(result.tier).toBe('bronze');
    });

    it('should return correct multiplier for platinum tier', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          totalKarma: 5000,
          level: 'platinum',
        }),
      });

      const result = await getKarmaMultiplier('user-123');

      expect(result.multiplier).toBe(2.0);
      expect(result.tier).toBe('platinum');
    });

    it('should return default multiplier on error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await getKarmaMultiplier('user-123');

      expect(result.multiplier).toBe(1.0);
      expect(result.tier).toBe('default');
    });
  });
});
