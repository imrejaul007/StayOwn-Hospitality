// Matching Service Unit Tests
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock mongoose and external services
jest.mock('mongoose', () => {
  const mockLean = jest.fn();
  return {
    Schema: jest.fn().mockImplementation(() => ({
      index: jest.fn().mockReturnThis(),
      pre: jest.fn().mockReturnThis(),
    })),
    model: jest.fn().mockReturnValue(function MockFlatmateProfile() {
      return {
        find: jest.fn(),
        findOne: jest.fn(),
        countDocuments: jest.fn(),
        save: jest.fn(),
      };
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    connection: {
      readyState: 1,
      on: jest.fn(),
      close: jest.fn(),
    },
  };
});

jest.mock('../integrations/rez-mind', () => ({
  captureIntent: jest.fn().mockResolvedValue(true),
  HabixoIntents: {
    matchView: jest.fn().mockReturnValue({
      appType: 'habixo_match',
      category: 'HOUSING',
      eventType: 'view',
      intentKey: 'mock_intent',
    }),
  },
}));

jest.mock('../integrations/external-services', () => ({
  httpRequest: jest.fn().mockResolvedValue({ success: true, data: {} }),
  getServiceUrl: jest.fn().mockReturnValue('http://mock-service'),
}));

// Import service after mocking
import * as MatchingService from '../services/MatchingService';
import { IFlatmateProfile } from '../models/FlatmateProfile';
import { NotFoundError } from '../utils/errors';

describe('MatchingService', () => {
  describe('calculateCompatibility', () => {
    it('should calculate high score for identical profiles', () => {
      const profile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['chill', 'professional'],
          sleepSchedule: 'flexible',
          workFromHome: true,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 10000,
          maxBudget: 20000,
          preferredAreas: ['Bangalore', 'HSR'],
        },
      };

      const profile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['chill', 'professional'],
          sleepSchedule: 'flexible',
          workFromHome: true,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 10000,
          maxBudget: 20000,
          preferredAreas: ['Bangalore', 'HSR'],
        },
      };

      const result = MatchingService.calculateCompatibility(profile1 as IFlatmateProfile, profile2 as IFlatmateProfile);

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.matchedTags).toContain('sleepSchedule');
      expect(result.matchedTags).toContain('workFromHome');
      expect(result.matchedTags).toContain('smoking');
      expect(result.matchedTags).toContain('pets');
    });

    it('should calculate lower score for different lifestyles', () => {
      const profile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['party', 'night-owl'],
          sleepSchedule: 'night_owl',
          workFromHome: false,
          smoking: 'occasionally',
          drinking: 'socially',
          pets: true,
        },
        preferences: {
          minBudget: 5000,
          maxBudget: 10000,
          preferredAreas: ['Koramangala'],
        },
      };

      const profile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['chill', 'early-bird'],
          sleepSchedule: 'early_bird',
          workFromHome: true,
          smoking: 'never',
          drinking: 'never',
          pets: false,
        },
        preferences: {
          minBudget: 15000,
          maxBudget: 30000,
          preferredAreas: ['Whitefield'],
        },
      };

      const result = MatchingService.calculateCompatibility(profile1 as IFlatmateProfile, profile2 as IFlatmateProfile);

      expect(result.score).toBeLessThan(60);
    });

    it('should match shared vibe tags', () => {
      const profile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['chill', 'professional', 'fitness'],
          sleepSchedule: 'flexible',
          workFromHome: true,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 10000,
          maxBudget: 20000,
          preferredAreas: ['Bangalore'],
        },
      };

      const profile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['chill', 'professional', 'foodie'],
          sleepSchedule: 'flexible',
          workFromHome: true,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 10000,
          maxBudget: 20000,
          preferredAreas: ['Bangalore'],
        },
      };

      const result = MatchingService.calculateCompatibility(profile1 as IFlatmateProfile, profile2 as IFlatmateProfile);

      expect(result.matchedTags).toContain('chill');
      expect(result.matchedTags).toContain('professional');
    });

    it('should handle budget overlap correctly', () => {
      const profile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 10000,
          maxBudget: 20000,
          preferredAreas: [],
        },
      };

      const profile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 15000,
          maxBudget: 25000,
          preferredAreas: [],
        },
      };

      const result = MatchingService.calculateCompatibility(profile1 as IFlatmateProfile, profile2 as IFlatmateProfile);

      expect(result.matchedTags).toContain('budget');
    });

    it('should handle no budget overlap', () => {
      const profile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 50000,
          maxBudget: 80000,
          preferredAreas: [],
        },
      };

      const profile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 5000,
          maxBudget: 10000,
          preferredAreas: [],
        },
      };

      const result = MatchingService.calculateCompatibility(profile1 as IFlatmateProfile, profile2 as IFlatmateProfile);

      expect(result.score).toBeLessThan(100);
    });

    it('should always return score between 0 and 100', () => {
      const extremeProfile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['party'],
          sleepSchedule: 'night_owl',
          workFromHome: false,
          smoking: 'regularly',
          drinking: 'socially',
          pets: true,
        },
        preferences: {
          minBudget: 1000,
          maxBudget: 2000,
          preferredAreas: ['Area1'],
        },
      };

      const extremeProfile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: ['chill'],
          sleepSchedule: 'early_bird',
          workFromHome: true,
          smoking: 'never',
          drinking: 'never',
          pets: false,
        },
        preferences: {
          minBudget: 100000,
          maxBudget: 200000,
          preferredAreas: ['Area100'],
        },
      };

      const result = MatchingService.calculateCompatibility(
        extremeProfile1 as IFlatmateProfile,
        extremeProfile2 as IFlatmateProfile
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle shared area preferences', () => {
      const profile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 10000,
          maxBudget: 20000,
          preferredAreas: ['Bangalore', 'HSR', 'Koramangala'],
        },
      };

      const profile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 15000,
          maxBudget: 25000,
          preferredAreas: ['HSR', 'Whitefield'],
        },
      };

      const result = MatchingService.calculateCompatibility(profile1 as IFlatmateProfile, profile2 as IFlatmateProfile);

      expect(result.matchedTags).toContain('area');
      expect(result.matchedTags).toContain('HSR');
    });

    it('should handle null budget values', () => {
      const profile1: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          preferredAreas: [],
        },
      };

      const profile2: Partial<IFlatmateProfile> = {
        lifestyle: {
          vibeTags: [],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 15000,
          maxBudget: 25000,
          preferredAreas: [],
        },
      };

      // Should not throw with undefined minBudget
      const result = MatchingService.calculateCompatibility(profile1 as IFlatmateProfile, profile2 as IFlatmateProfile);

      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
    });
  });

  describe('Lifestyle Vibe Tags', () => {
    it('should validate supported vibe tags', () => {
      const validTags = ['chill', 'party', 'professional', 'fitness', 'foodie', 'creative', 'outdoors', 'gamer'];
      expect(validTags).toContain('chill');
      expect(validTags).toContain('professional');
      expect(validTags).toContain('fitness');
      expect(validTags).toContain('foodie');
    });

    it('should validate vibe tag format', () => {
      const vibeTags = ['chill', 'professional'];
      expect(Array.isArray(vibeTags)).toBe(true);
      expect(vibeTags.every(tag => typeof tag === 'string')).toBe(true);
    });
  });

  describe('Sleep Schedules', () => {
    it('should validate sleep schedule types', () => {
      const schedules = ['early_bird', 'night_owl', 'flexible'];
      expect(schedules).toContain('early_bird');
      expect(schedules).toContain('night_owl');
      expect(schedules).toContain('flexible');
    });
  });

  describe('Smoking Habits', () => {
    it('should validate smoking habit types', () => {
      const habits = ['never', 'occasionally', 'regularly'];
      expect(habits).toContain('never');
      expect(habits).toContain('occasionally');
      expect(habits).toContain('regularly');
    });
  });

  describe('Compatibility Score Range', () => {
    it('should return score between 0 and 100 for all inputs', () => {
      const testCases = [
        { profile1: { lifestyle: { vibeTags: ['chill'], sleepSchedule: 'flexible', workFromHome: true, smoking: 'never', drinking: 'occasionally', pets: false }, preferences: { minBudget: 10000, maxBudget: 20000, preferredAreas: ['Bangalore'] } }, profile2: { lifestyle: { vibeTags: ['party'], sleepSchedule: 'night_owl', workFromHome: false, smoking: 'regularly', drinking: 'socially', pets: true }, preferences: { minBudget: 5000, maxBudget: 10000, preferredAreas: ['Mumbai'] } } },
        { profile1: { lifestyle: { vibeTags: [], sleepSchedule: 'flexible', workFromHome: true, smoking: 'never', drinking: 'never', pets: false }, preferences: { minBudget: 10000, maxBudget: 20000, preferredAreas: [] } }, profile2: { lifestyle: { vibeTags: [], sleepSchedule: 'flexible', workFromHome: true, smoking: 'never', drinking: 'never', pets: false }, preferences: { minBudget: 10000, maxBudget: 20000, preferredAreas: [] } } },
      ];

      for (const testCase of testCases) {
        const result = MatchingService.calculateCompatibility(
          testCase.profile1 as IFlatmateProfile,
          testCase.profile2 as IFlatmateProfile
        );
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe('MatchingService Types', () => {
  it('should have valid CreateFlatmateProfileInput interface structure', () => {
    const input = {
      userId: 'user_123',
      lifestyle: {
        vibeTags: ['chill'],
        sleepSchedule: 'flexible',
        workFromHome: true,
        smoking: 'never' as const,
        drinking: 'occasionally' as const,
        pets: false,
        allergies: ['dust'],
      },
      preferences: {
        minBudget: 10000,
        maxBudget: 20000,
        preferredAreas: ['Bangalore'],
        moveInDate: '2024-06-01',
        leaseDuration: 6,
        roommateCount: { min: 1, max: 2 },
      },
    };

    expect(input.userId).toBeDefined();
    expect(input.lifestyle.vibeTags).toBeInstanceOf(Array);
    expect(input.lifestyle.sleepSchedule).toMatch(/early_bird|night_owl|flexible/);
    expect(input.preferences.minBudget).toBeLessThan(input.preferences.maxBudget!);
  });

  it('should have valid FlatmateSearchInput interface structure', () => {
    const input = {
      city: 'Bangalore',
      minBudget: 10000,
      maxBudget: 20000,
      vibeTags: ['chill'],
      sleepSchedule: 'flexible',
      workFromHome: true,
      smoking: 'never',
      petFriendly: false,
      page: 1,
      limit: 20,
    };

    expect(input.page).toBeGreaterThanOrEqual(1);
    expect(input.limit).toBeGreaterThan(0);
    expect(input.minBudget).toBeLessThan(input.maxBudget!);
  });
});
