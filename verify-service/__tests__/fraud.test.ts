import { describe, it, expect } from 'vitest';
import { calculateFraudScore } from '../src/lib/fraud/scoring';
import { getFraudDecision } from '../src/lib/fraud/rules';

describe('Fraud Detection', () => {
  it('should calculate clean scan as low risk', () => {
    const input = {
      serialId: 'test-serial',
      userId: 'user-1',
      deviceId: 'device-1',
      location: { lat: 12.97, lng: 77.59, accuracy: 10 },
    };
    const context = {
      recentScansDevice: [],
      recentScansSerial: [],
    };

    const result = calculateFraudScore(input, context);
    expect(result.score).toBeLessThan(0.3);
    expect(result.decision).toBe('ALLOW');
  });

  it('should detect high velocity', () => {
    const input = {
      serialId: 'test-serial',
      userId: 'user-1',
      deviceId: 'device-1',
      location: { lat: 12.97, lng: 77.59 },
    };
    const now = new Date();
    const context = {
      recentScansDevice: [
        { timestamp: new Date(now.getTime() - 60000), serialId: 's1' },
        { timestamp: new Date(now.getTime() - 120000), serialId: 's2' },
        { timestamp: new Date(now.getTime() - 180000), serialId: 's3' },
        { timestamp: new Date(now.getTime() - 240000), serialId: 's4' },
        { timestamp: new Date(now.getTime() - 300000), serialId: 's5' },
        { timestamp: new Date(now.getTime() - 360000), serialId: 's6' },
      ],
      recentScansSerial: [],
    };

    const result = calculateFraudScore(input, context);
    expect(result.triggeredRules.some((r: any) => r.ruleId === 'VELOCITY')).toBe(true);
  });

  it('should get correct fraud decision', () => {
    expect(getFraudDecision(0.1)).toBe('ALLOW');
    expect(getFraudDecision(0.3)).toBe('FLAG');
    expect(getFraudDecision(0.7)).toBe('BLOCK');
  });
});
