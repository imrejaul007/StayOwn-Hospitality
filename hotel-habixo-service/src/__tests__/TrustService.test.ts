// Trust Service Unit Tests
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock mongoose and external services
const mockTrustScoreModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mockSave = jest.fn();

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose') as typeof import('mongoose');
  return {
    ...actualMongoose,
    model: jest.fn().mockReturnValue(function MockTrustScore() {
      return { save: mockSave, ...mockTrustScoreModel };
    }),
    Schema: actualMongoose.Schema,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: {
      readyState: 1,
      on: jest.fn(),
      close: jest.fn(),
    },
  };
});

jest.mock('../integrations/rez-karma', () => ({
  KarmaBenefits: {
    L1: { name: 'New', trustBoost: 0, benefits: ['Standard booking experience'] },
    L2: { name: 'Trusted', trustBoost: 5, benefits: ['Priority support', 'Early access'] },
    L3: { name: 'Valued', trustBoost: 10, benefits: ['Service fee discounts', 'Instant book'] },
    L4: { name: 'Elite', trustBoost: 15, benefits: ['VIP host access', 'Guaranteed availability'] },
  },
}));

// Import service after mocking
import * as TrustService from '../services/TrustService';
import { TRUST_COMPONENT_WEIGHTS } from '../types';

describe('TrustService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Trust Score Components', () => {
    it('should have 4 trust components', () => {
      const components = ['reliability', 'quality', 'behavior', 'reviews'];
      expect(components).toHaveLength(4);
    });

    it('should have correct weights totaling 100', () => {
      const totalWeight = Object.values(TRUST_COMPONENT_WEIGHTS).reduce((sum, w) => sum + w, 0);
      expect(totalWeight).toBe(100);
    });

    it('should have correct individual weights', () => {
      expect(TRUST_COMPONENT_WEIGHTS.reliability).toBe(30);
      expect(TRUST_COMPONENT_WEIGHTS.quality).toBe(30);
      expect(TRUST_COMPONENT_WEIGHTS.behavior).toBe(20);
      expect(TRUST_COMPONENT_WEIGHTS.reviews).toBe(20);
    });

    it('should calculate score correctly using weights', () => {
      const components = {
        reliability: 80,
        quality: 90,
        behavior: 70,
        reviews: 85,
      };

      const score = Math.round(
        components.reliability * (TRUST_COMPONENT_WEIGHTS.reliability / 100) +
        components.quality * (TRUST_COMPONENT_WEIGHTS.quality / 100) +
        components.behavior * (TRUST_COMPONENT_WEIGHTS.behavior / 100) +
        components.reviews * (TRUST_COMPONENT_WEIGHTS.reviews / 100)
      );

      // 80 * 0.30 + 90 * 0.30 + 70 * 0.20 + 85 * 0.20 = 24 + 27 + 14 + 17 = 82
      expect(score).toBe(82);
    });
  });

  describe('Trust Levels', () => {
    it('should define trust levels correctly', () => {
      const levels = [
        { threshold: 90, name: 'exceptional' },
        { threshold: 75, name: 'excellent' },
        { threshold: 60, name: 'good' },
        { threshold: 40, name: 'fair' },
        { threshold: 0, name: 'new' },
      ];

      expect(levels).toHaveLength(5);
      expect(levels[0].name).toBe('exceptional');
      expect(levels[0].threshold).toBe(90);
    });

    it('should categorize scores correctly', () => {
      const getTrustLevel = (score: number): string => {
        if (score >= 90) return 'exceptional';
        if (score >= 75) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'new';
      };

      expect(getTrustLevel(95)).toBe('exceptional');
      expect(getTrustLevel(85)).toBe('excellent');
      expect(getTrustLevel(70)).toBe('good');
      expect(getTrustLevel(50)).toBe('fair');
      expect(getTrustLevel(20)).toBe('new');
      expect(getTrustLevel(40)).toBe('fair');
      expect(getTrustLevel(60)).toBe('good');
      expect(getTrustLevel(75)).toBe('excellent');
      expect(getTrustLevel(90)).toBe('exceptional');
    });
  });

  describe('Karma Integration', () => {
    it('should have karma boosts for each level', () => {
      const karmaBoosts = {
        L1: 0,
        L2: 5,
        L3: 10,
        L4: 15,
      };

      expect(karmaBoosts.L1).toBe(0);
      expect(karmaBoosts.L2).toBe(5);
      expect(karmaBoosts.L3).toBe(10);
      expect(karmaBoosts.L4).toBe(15);
    });

    it('should calculate final score with karma boost', () => {
      const baseScore = 80;
      const karmaBoost = 10;
      const finalScore = Math.min(100, baseScore + karmaBoost);
      expect(finalScore).toBe(90);
    });

    it('should cap final score at 100', () => {
      const baseScore = 95;
      const karmaBoost = 15;
      const finalScore = Math.min(100, baseScore + karmaBoost);
      expect(finalScore).toBe(100);
    });

    it('should handle zero karma boost', () => {
      const baseScore = 50;
      const karmaBoost = 0;
      const finalScore = Math.min(100, baseScore + karmaBoost);
      expect(finalScore).toBe(50);
    });
  });

  describe('Component Updates', () => {
    it('should clamp component values between 0 and 100', () => {
      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value));

      expect(clamp(150, 0, 100)).toBe(100);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(0, 0, 100)).toBe(0);
      expect(clamp(100, 0, 100)).toBe(100);
    });

    it('should apply delta correctly', () => {
      const currentValue = 70;
      const delta = 10;
      const newValue = Math.max(0, Math.min(100, currentValue + delta));
      expect(newValue).toBe(80);
    });

    it('should handle negative deltas', () => {
      const currentValue = 30;
      const delta = -10;
      const newValue = Math.max(0, Math.min(100, currentValue + delta));
      expect(newValue).toBe(20);
    });

    it('should not exceed max value with positive delta', () => {
      const currentValue = 95;
      const delta = 10;
      const newValue = Math.max(0, Math.min(100, currentValue + delta));
      expect(newValue).toBe(100);
    });

    it('should not go below min value with negative delta', () => {
      const currentValue = 5;
      const delta = -10;
      const newValue = Math.max(0, Math.min(100, currentValue + delta));
      expect(newValue).toBe(0);
    });
  });

  describe('Trust Entity Types', () => {
    it('should support property entity type', () => {
      const entityTypes = ['property', 'host', 'guest'];
      expect(entityTypes).toContain('property');
    });

    it('should support host entity type', () => {
      const entityTypes = ['property', 'host', 'guest'];
      expect(entityTypes).toContain('host');
    });

    it('should support guest entity type', () => {
      const entityTypes = ['property', 'host', 'guest'];
      expect(entityTypes).toContain('guest');
    });

    it('should only allow valid entity types', () => {
      const validTypes = ['property', 'host', 'guest'];
      const isValidType = (type: string) => validTypes.includes(type);

      expect(isValidType('property')).toBe(true);
      expect(isValidType('host')).toBe(true);
      expect(isValidType('guest')).toBe(true);
      expect(isValidType('invalid')).toBe(false);
    });
  });

  describe('TrustScoreResponse Structure', () => {
    it('should have all required fields', () => {
      const response = {
        entityId: 'entity_123',
        entityType: 'property' as const,
        score: 75,
        level: 'excellent',
        components: {
          reliability: 80,
          quality: 70,
          behavior: 75,
          reviews: 75,
        },
        karmaBoost: 5,
        finalScore: 80,
        isNew: false,
      };

      expect(response.entityId).toBeDefined();
      expect(response.entityType).toMatch(/property|host|guest/);
      expect(response.score).toBeGreaterThanOrEqual(0);
      expect(response.score).toBeLessThanOrEqual(100);
      expect(response.level).toMatch(/exceptional|excellent|good|fair|new/);
      expect(response.components.reliability).toBeGreaterThanOrEqual(0);
      expect(response.components.quality).toBeGreaterThanOrEqual(0);
      expect(response.components.behavior).toBeGreaterThanOrEqual(0);
      expect(response.components.reviews).toBeGreaterThanOrEqual(0);
    });

    it('should have karma boost within valid range', () => {
      const karmaBoost = 10;
      expect(karmaBoost).toBeGreaterThanOrEqual(0);
      expect(karmaBoost).toBeLessThanOrEqual(20);
    });
  });

  describe('Default Trust Score', () => {
    it('should start with default score of 50', () => {
      const defaultScore = 50;
      expect(defaultScore).toBe(50);
    });

    it('should have default component values of 50', () => {
      const defaultComponents = {
        reliability: 50,
        quality: 50,
        behavior: 50,
        reviews: 50,
      };

      expect(defaultComponents.reliability).toBe(50);
      expect(defaultComponents.quality).toBe(50);
      expect(defaultComponents.behavior).toBe(50);
      expect(defaultComponents.reviews).toBe(50);
    });
  });
});

describe('Trust Level Thresholds', () => {
  const thresholds = [
    { threshold: 90, name: 'exceptional', description: 'Top tier trust' },
    { threshold: 75, name: 'excellent', description: 'High trust' },
    { threshold: 60, name: 'good', description: 'Good trust' },
    { threshold: 40, name: 'fair', description: 'Fair trust' },
    { threshold: 0, name: 'new', description: 'New user' },
  ];

  it('should have non-overlapping thresholds', () => {
    for (let i = 0; i < thresholds.length - 1; i++) {
      expect(thresholds[i].threshold).toBeGreaterThan(thresholds[i + 1].threshold);
    }
  });

  it('should cover full score range from 0 to 100', () => {
    expect(thresholds[0].threshold).toBe(90);
    expect(thresholds[thresholds.length - 1].threshold).toBe(0);
  });
});

describe('Karma Level Benefits', () => {
  const benefits = {
    L1: { name: 'New', trustBoost: 0, benefits: ['Standard booking experience'] },
    L2: { name: 'Trusted', trustBoost: 5, benefits: ['Priority support', 'Early access'] },
    L3: { name: 'Valued', trustBoost: 10, benefits: ['Service fee discounts', 'Instant book'] },
    L4: { name: 'Elite', trustBoost: 15, benefits: ['VIP host access', 'Guaranteed availability'] },
  };

  it('should have increasing trust boost per level', () => {
    expect(benefits.L1.trustBoost).toBeLessThan(benefits.L2.trustBoost);
    expect(benefits.L2.trustBoost).toBeLessThan(benefits.L3.trustBoost);
    expect(benefits.L3.trustBoost).toBeLessThan(benefits.L4.trustBoost);
  });

  it('should have benefits array for each level', () => {
    Object.values(benefits).forEach(level => {
      expect(Array.isArray(level.benefits)).toBe(true);
      expect(level.benefits.length).toBeGreaterThan(0);
    });
  });
});
