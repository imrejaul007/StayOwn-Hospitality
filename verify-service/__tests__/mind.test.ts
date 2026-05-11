/**
 * Unit Tests for Mind Integration
 */

import {
  sendVerificationToMind,
  captureVerificationIntent,
  getRecommendations,
  sendFraudSignalToMind,
} from '../src/lib/mind';

// Mock fetch
global.fetch = jest.fn();

describe('Mind Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REZ_MIND_URL = 'http://localhost:4008';
    process.env.INTENT_CAPTURE_URL = 'https://rez-intent-graph.onrender.com';
  });

  describe('sendVerificationToMind', () => {
    it('should send verification event to Mind', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await sendVerificationToMind({
        userId: 'user-123',
        brandId: 'brand-456',
        productId: 'product-789',
        serialId: 'serial-abc',
        brandName: 'Test Brand',
        productName: 'Test Product',
        category: 'electronics',
        timestamp: new Date(),
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4008/webhook/consumer/verification',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle Mind service errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(
        sendVerificationToMind({
          userId: 'user-123',
          brandId: 'brand-456',
          productId: 'product-789',
          serialId: 'serial-abc',
          brandName: 'Test Brand',
          productName: 'Test Product',
          category: 'electronics',
          timestamp: new Date(),
        })
      ).resolves.not.toThrow();
    });
  });

  describe('captureVerificationIntent', () => {
    it('should capture intent to intent graph', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await captureVerificationIntent(
        'user-123',
        'brand-456',
        'product-789',
        'serial-abc',
        { scanCount: 1 }
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://rez-intent-graph.onrender.com/api/intent/capture',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-123',
            appType: 'verify',
            event: 'product_verified',
            intentKey: 'verify_brand-456_product-789',
            metadata: {
              brandId: 'brand-456',
              productId: 'product-789',
              serialId: 'serial-abc',
              scanCount: 1,
            },
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        captureVerificationIntent(
          'user-123',
          'brand-456',
          'product-789',
          'serial-abc'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('getRecommendations', () => {
    it('should fetch recommendations', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          recommendations: [
            { brandId: 'brand-1', brandName: 'Brand 1', productId: 'p1', productName: 'Product 1', reason: 'Similar' },
          ],
        }),
      });

      const result = await getRecommendations('user-123', 5);

      expect(result.success).toBe(true);
      expect(result.recommendations).toHaveLength(1);
    });

    it('should handle errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await getRecommendations('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Recommendation service unavailable');
    });
  });

  describe('sendFraudSignalToMind', () => {
    it('should send fraud signal', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await sendFraudSignalToMind(
        'user-123',
        'brand-456',
        'velocity_check_failed',
        { score: 0.8 }
      );

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4008/webhook/consumer/fraud',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('verification_fraud_attempt'),
        })
      );
    });
  });
});
