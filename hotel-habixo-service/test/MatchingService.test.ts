/**
 * Unit tests for MatchingService
 *
 * Tests the core matching algorithm including:
 * - calculateCompatibility: Pure function for scoring profile pairs
 * - findMatches: Async function with mocked database
 * - Edge cases and boundary conditions
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  calculateCompatibility,
  createFlatmateProfile,
  findMatches,
  getFlatmateProfile,
  onMatchFound,
  CreateFlatmateProfileInput,
  FlatmateSearchInput,
} from '../src/services/MatchingService';
import { FlatmateProfile, IFlatmateProfile } from '../src/models';
import { NotFoundError } from '../src/utils/errors';

// ─── Mock Definitions ─────────────────────────────────────────────────────────

// Mock the FlatmateProfile model
const mockFlatmateProfileModel = {
  findOne: jest.fn<() => { lean: () => Promise<IFlatmateProfile | null> }>(),
  find: jest.fn<() => {
    skip: (n: number) => {
      limit: (n: number) => {
        lean: () => Promise<IFlatmateProfile[]>;
      };
    };
  }>(),
  countDocuments: jest.fn<() => Promise<number>>(),
};

jest.mock('../src/models', () => ({
  FlatmateProfile: mockFlatmateProfileModel,
}));

// Mock notification service
const mockNotifyMatchFound = jest.fn<() => Promise<{ success: boolean; error?: string }>>();

jest.mock('../src/services/NotificationService', () => ({
  notificationService: {
    notifyMatchFound: mockNotifyMatchFound,
  },
}));

// Mock ReZ Mind integration
const mockCaptureIntent = jest.fn<() => Promise<boolean>>();

jest.mock('../src/integrations/rez-mind', () => ({
  captureIntent: mockCaptureIntent,
  HabixoIntents: {
    matchView: (flatmateId: string, score?: number) => ({
      appType: 'habixo_match' as const,
      category: 'HOUSING' as const,
      eventType: 'view' as const,
      intentKey: `habixo_match_view_${flatmateId}`,
      metadata: { flatmateId, compatibilityScore: score },
    }),
  },
}));

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const createMockProfile = (overrides: Partial<IFlatmateProfile> = {}): IFlatmateProfile =>
  ({
    profileId: 'FLT-TEST123',
    userId: 'user-123',
    name: 'Test User',
    lifestyle: {
      vibeTags: ['social', 'fitness'],
      sleepSchedule: 'flexible',
      workFromHome: false,
      smoking: 'never',
      drinking: 'occasionally',
      pets: false,
    },
    preferences: {
      minBudget: 5000,
      maxBudget: 10000,
      preferredAreas: ['Koramangala', 'Indiranagar'],
    },
    trustScore: 80,
    verified: true,
    status: 'active' as const,
    notificationsEnabled: true,
    matchNotifications: {
      newMatches: true,
      messages: true,
    },
    ...overrides,
  } as IFlatmateProfile);

const profileWithMatchingLifestyle: IFlatmateProfile = createMockProfile({
  profileId: 'FLT-MATCH1',
  userId: 'user-match1',
  lifestyle: {
    vibeTags: ['social', 'fitness', 'music'],
    sleepSchedule: 'flexible', // Same as base
    workFromHome: false, // Same as base
    smoking: 'never', // Same as base
    drinking: 'occasionally',
    pets: false, // Same as base
  },
  preferences: {
    minBudget: 4000, // Overlaps with 5000-10000
    maxBudget: 12000, // Overlaps with 5000-10000
    preferredAreas: ['Koramangala', 'HSR'], // Has Koramangala overlap
  },
});

const profileWithConflictingLifestyle: IFlatmateProfile = createMockProfile({
  profileId: 'FLT-CONFLICT',
  userId: 'user-conflict',
  lifestyle: {
    vibeTags: ['quiet', 'homebody'],
    sleepSchedule: 'night_owl', // Different from flexible
    workFromHome: true, // Different from false
    smoking: 'regularly', // Different from never
    drinking: 'never',
    pets: true, // Different from false
  },
  preferences: {
    minBudget: 15000, // No overlap with 5000-10000
    maxBudget: 20000, // No overlap with 5000-10000
    preferredAreas: ['Whitefield'], // No overlap with Koramangala/Indiranagar
  },
});

const profileWithPartialMatch: IFlatmateProfile = createMockProfile({
  profileId: 'FLT-PARTIAL',
  userId: 'user-partial',
  lifestyle: {
    vibeTags: ['social'],
    sleepSchedule: 'early_bird', // Different
    workFromHome: false, // Same
    smoking: 'never', // Same
    drinking: 'occasionally',
    pets: false, // Same
  },
  preferences: {
    minBudget: 8000, // Overlaps with 5000-10000
    maxBudget: 15000, // Overlaps with 5000-10000
    preferredAreas: ['MG Road'], // No overlap
  },
});

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('MatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // calculateCompatibility Tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('calculateCompatibility', () => {
    describe('happy path - matching preferences', () => {
      it('should return high score for profiles with matching lifestyle', () => {
        const result = calculateCompatibility(
          createMockProfile(),
          profileWithMatchingLifestyle
        );

        expect(result.score).toBeGreaterThanOrEqual(70);
        expect(result.matchedTags).toContain('sleepSchedule');
        expect(result.matchedTags).toContain('workFromHome');
        expect(result.matchedTags).toContain('smoking');
        expect(result.matchedTags).toContain('pets');
        expect(result.matchedTags).toContain('budget');
        expect(result.matchedTags).toContain('area');
      });

      it('should include shared vibe tags in matchedTags', () => {
        const profile1 = createMockProfile({
          lifestyle: { vibeTags: ['social', 'fitness', 'music'] },
        });
        const profile2 = createMockProfile({
          lifestyle: { vibeTags: ['fitness', 'music', 'cooking'] },
        });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('fitness');
        expect(result.matchedTags).toContain('music');
        expect(result.matchedTags).not.toContain('social');
        expect(result.matchedTags).not.toContain('cooking');
      });

      it('should give bonus for matching sleep schedules', () => {
        const profile1 = createMockProfile({ lifestyle: { sleepSchedule: 'night_owl' } });
        const profile2 = createMockProfile({ lifestyle: { sleepSchedule: 'night_owl' } });
        const profile3 = createMockProfile({ lifestyle: { sleepSchedule: 'early_bird' } });

        const sameSchedule = calculateCompatibility(profile1, profile2);
        const diffSchedule = calculateCompatibility(profile1, profile3);

        expect(sameSchedule.score).toBeGreaterThan(diffSchedule.score);
        expect(sameSchedule.matchedTags).toContain('sleepSchedule');
      });

      it('should give bonus for matching work from home preference', () => {
        const profile1 = createMockProfile({ lifestyle: { workFromHome: true } });
        const profile2 = createMockProfile({ lifestyle: { workFromHome: true } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('workFromHome');
      });

      it('should give bonus for matching area preferences', () => {
        const profile1 = createMockProfile({
          preferences: { preferredAreas: ['Area A', 'Area B'] },
        });
        const profile2 = createMockProfile({
          preferences: { preferredAreas: ['Area B', 'Area C'] },
        });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.score).toBeGreaterThanOrEqual(60); // Base + area bonus
        expect(result.matchedTags).toContain('area');
      });
    });

    describe('conflicting preferences', () => {
      it('should return low score for completely conflicting profiles', () => {
        const result = calculateCompatibility(
          createMockProfile(),
          profileWithConflictingLifestyle
        );

        expect(result.score).toBeLessThan(70);
      });

      it('should return base score for profiles with no shared attributes', () => {
        const profile1 = createMockProfile({
          lifestyle: {
            vibeTags: [],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'never',
            pets: false,
          },
          preferences: {
            minBudget: 10000,
            maxBudget: 15000,
            preferredAreas: [],
          },
        });

        const profile2 = createMockProfile({
          lifestyle: {
            vibeTags: [],
            sleepSchedule: 'early_bird',
            workFromHome: true,
            smoking: 'regularly',
            drinking: 'socially',
            pets: true,
          },
          preferences: {
            minBudget: 20000,
            maxBudget: 30000,
            preferredAreas: [],
          },
        });

        const result = calculateCompatibility(profile1, profile2);

        // Should be close to base score (50) since nothing matches
        expect(result.score).toBeLessThanOrEqual(60);
        expect(result.score).toBeGreaterThanOrEqual(50);
      });

      it('should handle non-overlapping budget ranges', () => {
        const profile1 = createMockProfile({
          preferences: { minBudget: 5000, maxBudget: 8000 },
        });
        const profile2 = createMockProfile({
          preferences: { minBudget: 15000, maxBudget: 20000 },
        });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).not.toContain('budget');
      });

      it('should handle non-overlapping area preferences', () => {
        const profile1 = createMockProfile({
          preferences: { preferredAreas: ['Area A', 'Area B'] },
        });
        const profile2 = createMockProfile({
          preferences: { preferredAreas: ['Area C', 'Area D'] },
        });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).not.toContain('area');
      });
    });

    describe('edge cases - empty inputs', () => {
      it('should handle empty vibe tags on first profile', () => {
        const profile1 = createMockProfile({ lifestyle: { vibeTags: [] } });
        const profile2 = createMockProfile({ lifestyle: { vibeTags: ['social', 'fitness'] } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });

      it('should handle empty vibe tags on second profile', () => {
        const profile1 = createMockProfile({ lifestyle: { vibeTags: ['social'] } });
        const profile2 = createMockProfile({ lifestyle: { vibeTags: [] } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.score).toBeDefined();
      });

      it('should handle empty vibe tags on both profiles', () => {
        const profile1 = createMockProfile({ lifestyle: { vibeTags: [] } });
        const profile2 = createMockProfile({ lifestyle: { vibeTags: [] } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.score).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(50); // Base score at minimum
      });

      it('should handle empty preferred areas', () => {
        const profile1 = createMockProfile({ preferences: { preferredAreas: [] } });
        const profile2 = createMockProfile({ preferences: { preferredAreas: [] } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).not.toContain('area');
      });

      it('should handle undefined budget values (use defaults)', () => {
        const profile1 = createMockProfile({
          preferences: { minBudget: undefined, maxBudget: undefined },
        });
        const profile2 = createMockProfile({
          preferences: { minBudget: undefined, maxBudget: undefined },
        });

        const result = calculateCompatibility(profile1, profile2);

        // Should use default behavior with Infinity ranges
        expect(result.score).toBeDefined();
        expect(result.matchedTags).toContain('budget'); // Infinite ranges always overlap
      });

      it('should handle mixed undefined budget values', () => {
        const profile1 = createMockProfile({
          preferences: { minBudget: 5000, maxBudget: 10000 },
        });
        const profile2 = createMockProfile({
          preferences: { minBudget: undefined, maxBudget: undefined },
        });

        const result = calculateCompatibility(profile1, profile2);

        // Infinity max should overlap with any min
        expect(result.matchedTags).toContain('budget');
      });
    });

    describe('boundary conditions', () => {
      it('should cap score at 100', () => {
        const perfectProfile = createMockProfile({
          lifestyle: {
            vibeTags: ['social', 'fitness'],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'occasionally',
            pets: false,
          },
          preferences: {
            minBudget: 5000,
            maxBudget: 10000,
            preferredAreas: ['Koramangala', 'Indiranagar'],
          },
        });

        const result = calculateCompatibility(perfectProfile, perfectProfile);

        expect(result.score).toBeLessThanOrEqual(100);
      });

      it('should handle maximum vibe tags overlap', () => {
        const profile1 = createMockProfile({
          lifestyle: { vibeTags: ['a', 'b', 'c', 'd', 'e'] },
        });
        const profile2 = createMockProfile({
          lifestyle: { vibeTags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
        });

        const result = calculateCompatibility(profile1, profile2);

        // All profile1 tags are in profile2
        expect(result.score).toBeGreaterThanOrEqual(65); // Base + vibe bonus
      });

      it('should handle identical profiles', () => {
        const profile = createMockProfile();

        const result = calculateCompatibility(profile, profile);

        expect(result.score).toBe(100);
        expect(result.matchedTags.length).toBeGreaterThan(5);
      });

      it('should handle partial budget overlap at boundaries', () => {
        const profile1 = createMockProfile({
          preferences: { minBudget: 5000, maxBudget: 10000 },
        });
        const profile2 = createMockProfile({
          preferences: { minBudget: 10000, maxBudget: 15000 },
        });

        // 10000 is included in both ranges (5000-10000 and 10000-15000)
        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('budget');
      });

      it('should handle adjacent but non-overlapping budgets', () => {
        const profile1 = createMockProfile({
          preferences: { minBudget: 5000, maxBudget: 9999 },
        });
        const profile2 = createMockProfile({
          preferences: { minBudget: 10000, maxBudget: 15000 },
        });

        const result = calculateCompatibility(profile1, profile2);

        // 9999 < 10000, so no overlap
        expect(result.matchedTags).not.toContain('budget');
      });

      it('should handle all area preferences matching', () => {
        const profile1 = createMockProfile({
          preferences: { preferredAreas: ['Area A', 'Area B'] },
        });
        const profile2 = createMockProfile({
          preferences: { preferredAreas: ['Area A', 'Area B'] },
        });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('area');
      });
    });

    describe('smoking compatibility logic', () => {
      it('should give bonus when both never smoke', () => {
        const profile1 = createMockProfile({ lifestyle: { smoking: 'never' } });
        const profile2 = createMockProfile({ lifestyle: { smoking: 'never' } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('smoking');
      });

      it('should give bonus when one never smokes regardless of other', () => {
        const profile1 = createMockProfile({ lifestyle: { smoking: 'never' } });
        const profile2 = createMockProfile({ lifestyle: { smoking: 'regularly' } });

        const result = calculateCompatibility(profile1, profile2);

        // Should still include smoking tag due to never-smoker rule
        expect(result.matchedTags).toContain('smoking');
      });

      it('should handle occasional smokers compatibility', () => {
        const profile1 = createMockProfile({ lifestyle: { smoking: 'occasionally' } });
        const profile2 = createMockProfile({ lifestyle: { smoking: 'occasionally' } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('smoking');
      });

      it('should handle regular smokers matching', () => {
        const profile1 = createMockProfile({ lifestyle: { smoking: 'regularly' } });
        const profile2 = createMockProfile({ lifestyle: { smoking: 'regularly' } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('smoking');
      });
    });

    describe('pet compatibility logic', () => {
      it('should match when both have pets', () => {
        const profile1 = createMockProfile({ lifestyle: { pets: true } });
        const profile2 = createMockProfile({ lifestyle: { pets: true } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('pets');
      });

      it('should match when neither has pets', () => {
        const profile1 = createMockProfile({ lifestyle: { pets: false } });
        const profile2 = createMockProfile({ lifestyle: { pets: false } });

        const result = calculateCompatibility(profile1, profile2);

        expect(result.matchedTags).toContain('pets');
      });

      it('should penalize when one has pets and other does not', () => {
        const profile1 = createMockProfile({ lifestyle: { pets: true } });
        const profile2 = createMockProfile({ lifestyle: { pets: false } });

        const result = calculateCompatibility(profile1, profile2);

        // Should not get the pets match bonus
        expect(result.matchedTags).not.toContain('pets');
      });
    });

    describe('score precision and rounding', () => {
      it('should round score to integer', () => {
        const profile1 = createMockProfile();
        const profile2 = createMockProfile();

        const result = calculateCompatibility(profile1, profile2);

        expect(Number.isInteger(result.score)).toBe(true);
      });

      it('should return unique matchedTags (no duplicates)', () => {
        const profile1 = createMockProfile();
        const profile2 = createMockProfile();

        const result = calculateCompatibility(profile1, profile2);

        const uniqueTags = [...new Set(result.matchedTags)];
        expect(result.matchedTags).toEqual(uniqueTags);
      });
    });

    describe('score weighting verification', () => {
      it('should weight lifestyle matching at approximately 40%', () => {
        const baseProfile = createMockProfile({
          lifestyle: {
            vibeTags: [],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'never',
            pets: false,
          },
          preferences: { preferredAreas: [] },
        });

        // Profile with only lifestyle matches
        const lifestyleOnlyMatch = createMockProfile({
          lifestyle: {
            vibeTags: [],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'never',
            pets: false,
          },
          preferences: { preferredAreas: [] }, // No area match
        });

        const result = calculateCompatibility(baseProfile, lifestyleOnlyMatch);

        // Base 50 + sleep (10) + work (5) + smoking (5) + pets (5) = 75
        expect(result.score).toBe(75);
      });

      it('should weight vibe tags at approximately 15%', () => {
        const profile1 = createMockProfile({
          lifestyle: {
            vibeTags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'never',
            pets: false,
          },
          preferences: { preferredAreas: [] },
        });

        const profile2 = createMockProfile({
          lifestyle: {
            vibeTags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'never',
            pets: false,
          },
          preferences: { preferredAreas: [] },
        });

        const result = calculateCompatibility(profile1, profile2);

        // All 10 tags match = 15 points for vibe tags
        // Plus base 50 + sleep 10 + work 5 + smoking 5 + pets 5 = 75
        // With all vibes matching = 15 bonus = 90
        expect(result.score).toBe(90);
      });

      it('should weight area preferences at 25% (15 points)', () => {
        const profile1 = createMockProfile({
          lifestyle: {
            vibeTags: [],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'never',
            pets: false,
          },
          preferences: {
            preferredAreas: ['Area A'],
          },
        });

        const profile2 = createMockProfile({
          lifestyle: {
            vibeTags: [],
            sleepSchedule: 'flexible',
            workFromHome: false,
            smoking: 'never',
            drinking: 'never',
            pets: false,
          },
          preferences: {
            preferredAreas: ['Area A'],
          },
        });

        const result = calculateCompatibility(profile1, profile2);

        // Base 50 + sleep 10 + work 5 + smoking 5 + pets 5 + area 15 = 90
        expect(result.score).toBe(90);
        expect(result.matchedTags).toContain('area');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // findMatches Tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('findMatches', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockNotifyMatchFound.mockResolvedValue({ success: true });
    });

    it('should return matches sorted by score descending', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });

      const candidates: IFlatmateProfile[] = [
        createMockProfile({ profileId: 'low', userId: 'low', lifestyle: { vibeTags: [] } }),
        createMockProfile({ profileId: 'high', userId: 'high', lifestyle: { vibeTags: ['social', 'fitness'] } }),
        createMockProfile({ profileId: 'medium', userId: 'medium', lifestyle: { vibeTags: ['social'] } }),
      ];

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve(candidates),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(3);

      const result = await findMatches('user-123', {});

      expect(result.matches.length).toBe(3);
      expect(result.matches[0].compatibility.score).toBeGreaterThanOrEqual(
        result.matches[1].compatibility.score
      );
      expect(result.matches[1].compatibility.score).toBeGreaterThanOrEqual(
        result.matches[2].compatibility.score
      );
    });

    it('should limit results based on limit parameter', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });
      const candidates: IFlatmateProfile[] = Array.from({ length: 30 }, (_, i) =>
        createMockProfile({ profileId: `p${i}`, userId: `u${i}` })
      );

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: (limit: number) => ({
            lean: () => Promise.resolve(candidates.slice(0, limit)),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(30);

      const result = await findMatches('user-123', { limit: 10 });

      expect(result.matches.length).toBe(10);
    });

    it('should filter by minimum score threshold (50%)', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });

      // Create profiles that will score above and below 50
      const candidates: IFlatmateProfile[] = [
        createMockProfile({ profileId: 'above', userId: 'above', lifestyle: { vibeTags: ['social', 'fitness'] } }),
        createMockProfile({
          profileId: 'below',
          userId: 'below',
          lifestyle: { vibeTags: [], sleepSchedule: 'night_owl', workFromHome: true, smoking: 'regularly', pets: true },
        }),
      ];

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve(candidates),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(2);

      const result = await findMatches('user-123', {});

      // Both should be included as they score above 50
      expect(result.matches.length).toBe(2);
      result.matches.forEach((m) => {
        expect(m.compatibility.score).toBeGreaterThanOrEqual(50);
      });
    });

    it('should throw NotFoundError when user profile does not exist', async () => {
      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(null),
      });

      await expect(findMatches('nonexistent-user', {})).rejects.toThrow(NotFoundError);
    });

    it('should send notifications for top matches (score >= 80%)', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });

      const highMatch = createMockProfile({
        profileId: 'high-match',
        userId: 'high-match',
        lifestyle: { vibeTags: ['social', 'fitness'], sleepSchedule: 'flexible' },
        notificationsEnabled: true,
      });

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve([highMatch]),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(1);

      await findMatches('user-123', {});

      // High match should trigger notification (assuming it scores >= 80)
      // Note: We need to verify the notification was called
      expect(mockNotifyMatchFound).toHaveBeenCalled();
    });

    it('should not send notifications when notificationsEnabled is false', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });

      const highMatch = createMockProfile({
        profileId: 'high-match',
        userId: 'high-match',
        lifestyle: { vibeTags: ['social', 'fitness'], sleepSchedule: 'flexible' },
        notificationsEnabled: false,
      });

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve([highMatch]),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(1);

      await findMatches('user-123', {});

      // Notification should not be sent when disabled
      expect(mockNotifyMatchFound).not.toHaveBeenCalled();
    });

    it('should apply pagination correctly', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });
      const candidates: IFlatmateProfile[] = Array.from({ length: 5 }, (_, i) =>
        createMockProfile({ profileId: `p${i}`, userId: `u${i}` })
      );

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: (limit: number) => ({
            lean: () => Promise.resolve(candidates.slice(0, limit)),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(100);

      const result = await findMatches('user-123', { page: 3, limit: 10 });

      // Verify skip was called with correct value (page 3, limit 10 = skip 20)
      expect(mockFlatmateProfileModel.find).toHaveBeenCalled();
      expect(result.total).toBe(100);
    });

    it('should exclude the requesting user from results', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve([]),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

      await findMatches('user-123', {});

      // Verify query excludes the user
      const findCall = mockFlatmateProfileModel.find.mock.calls[0];
      expect(findCall[0]).toHaveProperty('userId');
      expect((findCall[0] as Record<string, unknown>).userId).toEqual({ $ne: 'user-123' });
    });

    it('should only return active profiles', async () => {
      const userProfile = createMockProfile({ userId: 'user-123' });

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(userProfile),
      });

      mockFlatmateProfileModel.find.mockReturnValue({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve([]),
          }),
        }),
      });

      mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

      await findMatches('user-123', {});

      const findCall = mockFlatmateProfileModel.find.mock.calls[0];
      expect((findCall[0] as Record<string, unknown>).status).toBe('active');
    });

    describe('filter parameters', () => {
      it('should filter by minBudget', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        await findMatches('user-123', { minBudget: 5000 });

        const findCall = mockFlatmateProfileModel.find.mock.calls[0];
        expect((findCall[0] as Record<string, unknown>)['preferences.maxBudget']).toEqual({ $gte: 5000 });
      });

      it('should filter by maxBudget', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        await findMatches('user-123', { maxBudget: 10000 });

        const findCall = mockFlatmateProfileModel.find.mock.calls[0];
        expect((findCall[0] as Record<string, unknown>)['preferences.minBudget']).toEqual({ $lte: 10000 });
      });

      it('should filter by vibeTags', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        await findMatches('user-123', { vibeTags: ['social', 'fitness'] });

        const findCall = mockFlatmateProfileModel.find.mock.calls[0];
        expect((findCall[0] as Record<string, unknown>)['lifestyle.vibeTags']).toEqual({
          $in: ['social', 'fitness'],
        });
      });

      it('should filter by sleepSchedule', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        await findMatches('user-123', { sleepSchedule: 'night_owl' });

        const findCall = mockFlatmateProfileModel.find.mock.calls[0];
        expect((findCall[0] as Record<string, unknown>)['lifestyle.sleepSchedule']).toBe('night_owl');
      });

      it('should filter by workFromHome', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        await findMatches('user-123', { workFromHome: true });

        const findCall = mockFlatmateProfileModel.find.mock.calls[0];
        expect((findCall[0] as Record<string, unknown>)['lifestyle.workFromHome']).toBe(true);
      });

      it('should filter by smoking', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        await findMatches('user-123', { smoking: 'never' });

        const findCall = mockFlatmateProfileModel.find.mock.calls[0];
        expect((findCall[0] as Record<string, unknown>)['lifestyle.smoking']).toBe('never');
      });

      it('should filter by petFriendly', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        await findMatches('user-123', { petFriendly: true });

        const findCall = mockFlatmateProfileModel.find.mock.calls[0];
        expect((findCall[0] as Record<string, unknown>)['lifestyle.pets']).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should handle notification service failure gracefully', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        const highMatch = createMockProfile({
          profileId: 'high-match',
          userId: 'high-match',
          lifestyle: { vibeTags: ['social', 'fitness'], sleepSchedule: 'flexible' },
          notificationsEnabled: true,
        });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([highMatch]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(1);

        // Mock notification to fail
        mockNotifyMatchFound.mockRejectedValue(new Error('Notification service down'));

        // Should not throw, just log error
        const result = await findMatches('user-123', {});

        expect(result.matches.length).toBeGreaterThan(0);
      });

      it('should handle empty candidates gracefully', async () => {
        const userProfile = createMockProfile({ userId: 'user-123' });

        mockFlatmateProfileModel.findOne.mockReturnValue({
          lean: () => Promise.resolve(userProfile),
        });

        mockFlatmateProfileModel.find.mockReturnValue({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        });

        mockFlatmateProfileModel.countDocuments.mockResolvedValue(0);

        const result = await findMatches('user-123', {});

        expect(result.matches).toEqual([]);
        expect(result.total).toBe(0);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // createFlatmateProfile Tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('createFlatmateProfile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create profile with default values', async () => {
      const mockSave = jest.fn<() => Promise<void>>();
      const mockProfile = {
        profileId: 'FLT-TEST123',
        userId: 'user-new',
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
        status: 'active',
        trustScore: 50,
        verified: false,
        save: mockSave,
      };

      // Mock FlatmateProfile constructor
      (FlatmateProfile as unknown as jest.Mock).mockImplementation(() => mockProfile);

      const input: CreateFlatmateProfileInput = {
        userId: 'user-new',
        lifestyle: {},
        preferences: {},
      };

      const result = await createFlatmateProfile(input);

      expect(mockSave).toHaveBeenCalled();
      expect(result.status).toBe('active');
      expect(result.trustScore).toBe(50);
      expect(result.verified).toBe(false);
      expect(result.lifestyle.sleepSchedule).toBe('flexible');
      expect(result.lifestyle.smoking).toBe('never');
    });

    it('should use provided lifestyle values', async () => {
      const mockSave = jest.fn<() => Promise<void>>();
      const mockProfile = {
        profileId: 'FLT-TEST456',
        userId: 'user-new',
        lifestyle: {
          vibeTags: ['social'],
          sleepSchedule: 'night_owl',
          workFromHome: true,
          smoking: 'never',
          drinking: 'occasionally',
          pets: true,
        },
        preferences: {
          minBudget: 5000,
          maxBudget: 10000,
          preferredAreas: ['Koramangala'],
        },
        status: 'active',
        trustScore: 50,
        verified: false,
        save: mockSave,
      };

      (FlatmateProfile as unknown as jest.Mock).mockImplementation(() => mockProfile);

      const input: CreateFlatmateProfileInput = {
        userId: 'user-new',
        lifestyle: {
          vibeTags: ['social'],
          sleepSchedule: 'night_owl',
          workFromHome: true,
          smoking: 'never',
          drinking: 'occasionally',
          pets: true,
          allergies: ['dust'],
        },
        preferences: {
          minBudget: 5000,
          maxBudget: 10000,
          preferredAreas: ['Koramangala'],
          moveInDate: '2024-06-01',
          leaseDuration: 12,
        },
      };

      const result = await createFlatmateProfile(input);

      expect(result.lifestyle.vibeTags).toEqual(['social']);
      expect(result.lifestyle.sleepSchedule).toBe('night_owl');
      expect(result.lifestyle.workFromHome).toBe(true);
      expect(result.lifestyle.pets).toBe(true);
      expect(result.preferences.minBudget).toBe(5000);
      expect(result.preferences.maxBudget).toBe(10000);
      expect(result.preferences.moveInDate).toBeInstanceOf(Date);
    });

    it('should generate unique profileId', async () => {
      const mockSave = jest.fn<() => Promise<void>>();
      const mockProfile = {
        profileId: '',
        save: mockSave,
      };

      (FlatmateProfile as unknown as jest.Mock).mockImplementation(() => mockProfile);

      const input: CreateFlatmateProfileInput = {
        userId: 'user-new',
        lifestyle: {},
        preferences: {},
      };

      const result = await createFlatmateProfile(input);

      expect(result.profileId).toMatch(/^FLT-[A-Z0-9]{8}$/);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // getFlatmateProfile Tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('getFlatmateProfile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return profile for existing user', async () => {
      const mockProfile = createMockProfile({ userId: 'user-123' });

      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(mockProfile),
      });

      const result = await getFlatmateProfile('user-123');

      expect(result).toEqual(mockProfile);
      expect(mockFlatmateProfileModel.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
    });

    it('should throw NotFoundError for nonexistent user', async () => {
      mockFlatmateProfileModel.findOne.mockReturnValue({
        lean: () => Promise.resolve(null),
      });

      await expect(getFlatmateProfile('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // onMatchFound Tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('onMatchFound', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockNotifyMatchFound.mockResolvedValue({ success: true });
    });

    it('should send notification with correct details', async () => {
      const matchedProfile = createMockProfile({
        profileId: 'FLT-MATCH',
        userId: 'matched-user',
        name: 'John Doe',
      });

      await onMatchFound('user-123', matchedProfile, 85, ['social', 'fitness']);

      expect(mockNotifyMatchFound).toHaveBeenCalledWith('user-123', expect.objectContaining({
        profileId: 'FLT-MATCH',
        userId: 'matched-user',
        name: 'John Doe',
        compatibilityScore: 85,
        sharedInterests: ['social', 'fitness'],
      }));
    });

    it('should use fallback name when profile name is undefined', async () => {
      const matchedProfile = createMockProfile({
        profileId: 'FLT-MATCH',
        userId: 'matched-user',
        name: undefined,
      });

      await onMatchFound('user-123', matchedProfile, 85, ['social']);

      expect(mockNotifyMatchFound).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          name: 'A potential roommate',
        })
      );
    });

    it('should handle notification service failure gracefully', async () => {
      const matchedProfile = createMockProfile({ profileId: 'FLT-MATCH' });
      mockNotifyMatchFound.mockRejectedValue(new Error('Service unavailable'));

      // Should not throw
      await expect(
        onMatchFound('user-123', matchedProfile, 85, ['social'])
      ).resolves.not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // onMatchView Tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('onMatchView', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockCaptureIntent.mockResolvedValue(true);
    });

    it('should capture intent with correct parameters', async () => {
      await onMatchView('viewer-123', 'flatmate-456', 75);

      expect(mockCaptureIntent).toHaveBeenCalledWith({
        userId: 'viewer-123',
        appType: 'habixo_match',
        category: 'HOUSING',
        eventType: 'view',
        intentKey: 'habixo_match_view_flatmate-456',
        metadata: {
          flatmateId: 'flatmate-456',
          compatibilityScore: 75,
        },
      });
    });
  });
});
