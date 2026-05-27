// Matching Integration Tests
import { FlatmateProfile } from '../../models/FlatmateProfile';
import * as MatchingService from '../../services/MatchingService';
import { createMockFlatmateProfile } from './testData';
import { NotFoundError } from '../../utils/errors';

// Mock external services
jest.mock('../../integrations/rez-mind', () => ({
  captureIntent: jest.fn().mockResolvedValue(true),
  HabixoIntents: {
    matchView: jest.fn().mockReturnValue({
      appType: 'habixo_match',
      category: 'HOUSING',
      eventType: 'view',
      intentKey: 'mock_match_intent',
      metadata: {},
    }),
  },
}));

jest.mock('../../integrations/external-services', () => ({
  httpRequest: jest.fn().mockResolvedValue({ success: true, data: {} }),
  getServiceUrl: jest.fn().mockReturnValue('http://mock-service'),
}));

describe('Matching Integration Tests', () => {
  describe('createFlatmateProfile', () => {
    it('should create a flatmate profile with all required fields', async () => {
      const mockProfile = createMockFlatmateProfile();

      const result = await MatchingService.createFlatmateProfile({
        userId: mockProfile.userId!,
        lifestyle: mockProfile.lifestyle!,
        preferences: mockProfile.preferences!,
      });

      expect(result).toBeDefined();
      expect(result.profileId).toMatch(/^FLT-[A-Z0-9]+$/);
      expect(result.userId).toBe(mockProfile.userId);
      expect(result.status).toBe('active');
      expect(result.trustScore).toBe(50);
      expect(result.verified).toBe(false);
    });

    it('should generate unique profile IDs', async () => {
      const profile1 = await MatchingService.createFlatmateProfile({
        userId: 'user_1',
        lifestyle: { vibeTags: ['chill'] },
        preferences: { minBudget: 10000, maxBudget: 20000, preferredAreas: ['Bangalore'] },
      });

      const profile2 = await MatchingService.createFlatmateProfile({
        userId: 'user_2',
        lifestyle: { vibeTags: ['professional'] },
        preferences: { minBudget: 15000, maxBudget: 25000, preferredAreas: ['Mumbai'] },
      });

      expect(profile1.profileId).not.toBe(profile2.profileId);
    });

    it('should set default values for optional fields', async () => {
      const result = await MatchingService.createFlatmateProfile({
        userId: 'user_test_defaults',
        lifestyle: {},
        preferences: {},
      });

      expect(result.lifestyle.sleepSchedule).toBe('flexible');
      expect(result.lifestyle.workFromHome).toBe(false);
      expect(result.lifestyle.smoking).toBe('never');
      expect(result.lifestyle.drinking).toBe('occasionally');
      expect(result.lifestyle.pets).toBe(false);
      expect(result.preferences.preferredAreas).toEqual([]);
    });
  });

  describe('calculateCompatibility', () => {
    it('should return high score for identical profiles', () => {
      const profile1 = createMockFlatmateProfile({
        userId: 'user_1',
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
      });

      const profile2 = createMockFlatmateProfile({
        userId: 'user_2',
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
      });

      const result = MatchingService.calculateCompatibility(
        profile1 as any,
        profile2 as any
      );

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.matchedTags).toContain('sleepSchedule');
      expect(result.matchedTags).toContain('workFromHome');
      expect(result.matchedTags).toContain('budget');
    });

    it('should return lower score for incompatible profiles', () => {
      const profile1 = createMockFlatmateProfile({
        userId: 'user_1',
        lifestyle: {
          vibeTags: ['party', 'night-owl'],
          sleepSchedule: 'night_owl',
          workFromHome: false,
          smoking: 'regularly',
          drinking: 'socially',
          pets: true,
        },
        preferences: {
          minBudget: 5000,
          maxBudget: 10000,
          preferredAreas: ['Koramangala'],
        },
      });

      const profile2 = createMockFlatmateProfile({
        userId: 'user_2',
        lifestyle: {
          vibeTags: ['chill', 'early-bird'],
          sleepSchedule: 'early_bird',
          workFromHome: true,
          smoking: 'never',
          drinking: 'never',
          pets: false,
        },
        preferences: {
          minBudget: 30000,
          maxBudget: 50000,
          preferredAreas: ['Whitefield'],
        },
      });

      const result = MatchingService.calculateCompatibility(
        profile1 as any,
        profile2 as any
      );

      expect(result.score).toBeLessThan(60);
    });

    it('should handle budget overlap correctly', () => {
      const profile1 = createMockFlatmateProfile({
        userId: 'user_1',
        lifestyle: { vibeTags: [], sleepSchedule: 'flexible' },
        preferences: {
          minBudget: 10000,
          maxBudget: 20000,
          preferredAreas: [],
        },
      });

      const profile2 = createMockFlatmateProfile({
        userId: 'user_2',
        lifestyle: { vibeTags: [], sleepSchedule: 'flexible' },
        preferences: {
          minBudget: 15000,
          maxBudget: 25000,
          preferredAreas: [],
        },
      });

      const result = MatchingService.calculateCompatibility(
        profile1 as any,
        profile2 as any
      );

      expect(result.matchedTags).toContain('budget');
    });

    it('should handle no budget overlap', () => {
      const profile1 = createMockFlatmateProfile({
        userId: 'user_1',
        lifestyle: { vibeTags: [], sleepSchedule: 'flexible' },
        preferences: {
          minBudget: 50000,
          maxBudget: 80000,
          preferredAreas: [],
        },
      });

      const profile2 = createMockFlatmateProfile({
        userId: 'user_2',
        lifestyle: { vibeTags: [], sleepSchedule: 'flexible' },
        preferences: {
          minBudget: 5000,
          maxBudget: 10000,
          preferredAreas: [],
        },
      });

      const result = MatchingService.calculateCompatibility(
        profile1 as any,
        profile2 as any
      );

      expect(result.matchedTags).not.toContain('budget');
    });

    it('should match shared vibe tags', () => {
      const profile1 = createMockFlatmateProfile({
        userId: 'user_1',
        lifestyle: {
          vibeTags: ['chill', 'professional', 'fitness', 'foodie'],
          sleepSchedule: 'flexible',
        },
        preferences: { preferredAreas: [] },
      });

      const profile2 = createMockFlatmateProfile({
        userId: 'user_2',
        lifestyle: {
          vibeTags: ['chill', 'professional', 'creative'],
          sleepSchedule: 'flexible',
        },
        preferences: { preferredAreas: [] },
      });

      const result = MatchingService.calculateCompatibility(
        profile1 as any,
        profile2 as any
      );

      expect(result.matchedTags).toContain('chill');
      expect(result.matchedTags).toContain('professional');
      expect(result.matchedTags).not.toContain('fitness');
      expect(result.matchedTags).not.toContain('foodie');
      expect(result.matchedTags).not.toContain('creative');
    });

    it('should match shared area preferences', () => {
      const profile1 = createMockFlatmateProfile({
        userId: 'user_1',
        lifestyle: { vibeTags: [], sleepSchedule: 'flexible' },
        preferences: {
          preferredAreas: ['Bangalore', 'HSR', 'Koramangala'],
        },
      });

      const profile2 = createMockFlatmateProfile({
        userId: 'user_2',
        lifestyle: { vibeTags: [], sleepSchedule: 'flexible' },
        preferences: {
          preferredAreas: ['HSR', 'Whitefield', 'Indiranagar'],
        },
      });

      const result = MatchingService.calculateCompatibility(
        profile1 as any,
        profile2 as any
      );

      expect(result.matchedTags).toContain('area');
      expect(result.matchedTags).toContain('HSR');
    });

    it('should always return score between 0 and 100', () => {
      const extreme1 = createMockFlatmateProfile({
        userId: 'user_1',
        lifestyle: {
          vibeTags: ['party', 'gamer', 'night-owl'],
          sleepSchedule: 'night_owl',
          workFromHome: false,
          smoking: 'regularly',
          drinking: 'socially',
          pets: true,
        },
        preferences: {
          minBudget: 1000,
          maxBudget: 5000,
          preferredAreas: ['Area1'],
        },
      });

      const extreme2 = createMockFlatmateProfile({
        userId: 'user_2',
        lifestyle: {
          vibeTags: ['chill', 'professional', 'fitness'],
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
      });

      const result = MatchingService.calculateCompatibility(
        extreme1 as any,
        extreme2 as any
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('findMatches', () => {
    beforeEach(async () => {
      // Create multiple profiles for matching
      const profiles = [
        createMockFlatmateProfile({
          userId: 'match_user_main',
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
        }),
        createMockFlatmateProfile({
          userId: 'match_user_1',
          lifestyle: {
            vibeTags: ['chill', 'professional', 'fitness'],
            sleepSchedule: 'flexible',
            workFromHome: true,
            smoking: 'never',
            drinking: 'occasionally',
            pets: false,
          },
          preferences: {
            minBudget: 15000,
            maxBudget: 25000,
            preferredAreas: ['Bangalore', 'HSR', 'Koramangala'],
          },
        }),
        createMockFlatmateProfile({
          userId: 'match_user_2',
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
        }),
      ];

      for (const profile of profiles) {
        await new FlatmateProfile(profile).save();
      }
    });

    it('should find matching profiles for a user', async () => {
      const result = await MatchingService.findMatches('match_user_main', {});

      expect(result.total).toBeGreaterThan(0);
      expect(result.matches.length).toBeGreaterThan(0);
      // Should not include the user themselves
      result.matches.forEach((m) => {
        expect(m.profile.userId).not.toBe('match_user_main');
      });
    });

    it('should filter by budget', async () => {
      const result = await MatchingService.findMatches('match_user_main', {
        minBudget: 12000,
        maxBudget: 22000,
      });

      result.matches.forEach((m) => {
        expect(m.profile.preferences?.minBudget || 0).toBeLessThanOrEqual(22000);
        expect(m.profile.preferences?.maxBudget || Infinity).toBeGreaterThanOrEqual(12000);
      });
    });

    it('should filter by vibe tags', async () => {
      const result = await MatchingService.findMatches('match_user_main', {
        vibeTags: ['professional'],
      });

      result.matches.forEach((m) => {
        expect(m.profile.lifestyle?.vibeTags).toContain('professional');
      });
    });

    it('should filter by sleep schedule', async () => {
      const result = await MatchingService.findMatches('match_user_main', {
        sleepSchedule: 'flexible',
      });

      result.matches.forEach((m) => {
        expect(m.profile.lifestyle?.sleepSchedule).toBe('flexible');
      });
    });

    it('should filter by work from home', async () => {
      const result = await MatchingService.findMatches('match_user_main', {
        workFromHome: true,
      });

      result.matches.forEach((m) => {
        expect(m.profile.lifestyle?.workFromHome).toBe(true);
      });
    });

    it('should sort matches by compatibility score', async () => {
      const result = await MatchingService.findMatches('match_user_main', {});

      if (result.matches.length > 1) {
        for (let i = 0; i < result.matches.length - 1; i++) {
          expect(result.matches[i].compatibility.score).toBeGreaterThanOrEqual(
            result.matches[i + 1].compatibility.score
          );
        }
      }
    });

    it('should paginate results', async () => {
      const page1 = await MatchingService.findMatches('match_user_main', {
        page: 1,
        limit: 1,
      });

      const page2 = await MatchingService.findMatches('match_user_main', {
        page: 2,
        limit: 1,
      });

      expect(page1.matches.length).toBeLessThanOrEqual(1);
      expect(page2.matches.length).toBeLessThanOrEqual(1);
    });

    it('should throw NotFoundError for non-existent user profile', async () => {
      await expect(
        MatchingService.findMatches('nonexistent_user', {})
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getFlatmateProfile', () => {
    it('should retrieve a flatmate profile by user ID', async () => {
      const mockProfile = createMockFlatmateProfile();
      await new FlatmateProfile(mockProfile).save();

      const retrieved = await MatchingService.getFlatmateProfile(mockProfile.userId!);

      expect(retrieved.userId).toBe(mockProfile.userId);
      expect(retrieved.profileId).toBe(mockProfile.profileId);
    });

    it('should throw NotFoundError for non-existent profile', async () => {
      await expect(
        MatchingService.getFlatmateProfile('nonexistent_user')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('onMatchView', () => {
    it('should capture intent when viewing a match', async () => {
      await expect(
        MatchingService.onMatchView('viewer_123', 'flatmate_456', 85)
      ).resolves.not.toThrow();
    });
  });
});
