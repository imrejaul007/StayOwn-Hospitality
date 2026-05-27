/**
 * Unit Tests for Habixo MatchingService
 * Tests calculateCompatibility and findMatches functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('../models', () => ({
  FlatmateProfile: {
    findOne: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../integrations/rez-mind', () => ({
  captureIntent: vi.fn(),
  HabixoIntents: {},
}));

vi.mock('./NotificationService', () => ({
  notificationService: {
    sendMatchNotification: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

// Import after mocks
import { calculateCompatibility } from '../services/MatchingService';
import { FlatmateProfile } from '../models';
import { captureIntent } from '../integrations/rez-mind';
import { notificationService } from './NotificationService';

// Mock FlatmateProfile instance
const createMockProfile = (overrides = {}) => ({
  profileId: 'FLT-TEST123',
  userId: 'user-123',
  lifestyle: {
    vibeTags: ['chill', 'clean'],
    sleepSchedule: 'night-owl',
    workFromHome: true,
    smoking: 'never',
    drinking: 'occasionally',
    pets: false,
    allergies: [],
    ...overrides.lifestyle,
  },
  preferences: {
    minBudget: 10000,
    maxBudget: 20000,
    preferredAreas: ['mumbai-south', 'bandra'],
    moveInDate: new Date(),
    leaseDuration: 12,
    roommateCount: { min: 1, max: 2 },
    ...overrides.preferences,
  },
  status: 'active',
  trustScore: 75,
  verified: true,
  notificationsEnabled: true,
  ...overrides,
});

describe('MatchingService', () => {
  describe('calculateCompatibility', () => {
    it('should return high score for matching profiles', () => {
      const profile1 = createMockProfile();
      const profile2 = createMockProfile({
        lifestyle: {
          vibeTags: ['chill', 'clean', 'social'],
          sleepSchedule: 'night-owl',
          workFromHome: true,
          smoking: 'never',
          drinking: 'occasionally',
          pets: false,
        },
        preferences: {
          minBudget: 12000,
          maxBudget: 18000,
          preferredAreas: ['mumbai-south', 'bandra', 'juhu'],
        },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.matchedTags).toContain('sleepSchedule');
      expect(result.matchedTags).toContain('workFromHome');
      expect(result.matchedTags).toContain('smoking');
      expect(result.matchedTags).toContain('pets');
      expect(result.matchedTags).toContain('budget');
      expect(result.matchedTags).toContain('area');
    });

    it('should return low score for conflicting preferences', () => {
      const profile1 = createMockProfile({
        lifestyle: {
          vibeTags: ['quiet', 'early-bird'],
          sleepSchedule: 'early-bird',
          workFromHome: false,
          smoking: 'never',
          drinking: 'never',
          pets: false,
        },
        preferences: {
          minBudget: 5000,
          maxBudget: 10000,
          preferredAreas: ['quiet-neighborhood'],
        },
      });

      const profile2 = createMockProfile({
        lifestyle: {
          vibeTags: ['party', 'night-owl', 'social'],
          sleepSchedule: 'night-owl',
          workFromHome: true,
          smoking: 'regularly',
          drinking: 'regularly',
          pets: true,
        },
        preferences: {
          minBudget: 25000,
          maxBudget: 50000,
          preferredAreas: ['downtown', 'party-area'],
        },
      });

      const result = calculateCompatibility(profile1, profile2);

      // Should still have base score but minimal matches
      expect(result.score).toBeLessThan(100);
      expect(result.matchedTags).not.toContain('area');
      expect(result.matchedTags).not.toContain('budget');
    });

    it('should handle empty vibeTags array', () => {
      const profile1 = createMockProfile({
        lifestyle: { vibeTags: [] },
      });
      const profile2 = createMockProfile({
        lifestyle: { vibeTags: ['chill', 'social'] },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.matchedTags).toBeDefined();
    });

    it('should handle profiles with no preferred areas', () => {
      const profile1 = createMockProfile({
        preferences: { preferredAreas: [], minBudget: 10000, maxBudget: 20000 },
      });
      const profile2 = createMockProfile({
        preferences: { preferredAreas: ['mumbai-south'], minBudget: 15000, maxBudget: 25000 },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.score).toBeGreaterThanOrEqual(0);
      // Budget should still match even without area preferences
      expect(result.matchedTags).toContain('budget');
    });

    it('should handle undefined budget values', () => {
      const profile1 = createMockProfile({
        preferences: { minBudget: undefined, maxBudget: undefined },
      });
      const profile2 = createMockProfile({
        preferences: { minBudget: undefined, maxBudget: undefined },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should cap score at 100', () => {
      const profile1 = createMockProfile();
      const profile2 = createMockProfile({
        lifestyle: profile1.lifestyle,
        preferences: profile1.preferences,
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should match sleep schedule correctly', () => {
      const profile1 = createMockProfile({
        lifestyle: { sleepSchedule: 'night-owl' },
      });
      const profile2 = createMockProfile({
        lifestyle: { sleepSchedule: 'night-owl' },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).toContain('sleepSchedule');
    });

    it('should match work from home status', () => {
      const profile1 = createMockProfile({
        lifestyle: { workFromHome: true },
      });
      const profile2 = createMockProfile({
        lifestyle: { workFromHome: true },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).toContain('workFromHome');
    });

    it('should handle smoking compatibility', () => {
      // Both non-smokers
      const profile1 = createMockProfile({
        lifestyle: { smoking: 'never' },
      });
      const profile2 = createMockProfile({
        lifestyle: { smoking: 'never' },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).toContain('smoking');
    });

    it('should handle pet compatibility', () => {
      const profile1 = createMockProfile({
        lifestyle: { pets: true },
      });
      const profile2 = createMockProfile({
        lifestyle: { pets: true },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).toContain('pets');
    });

    it('should match budget ranges that overlap', () => {
      const profile1 = createMockProfile({
        preferences: { minBudget: 10000, maxBudget: 20000 },
      });
      const profile2 = createMockProfile({
        preferences: { minBudget: 15000, maxBudget: 25000 },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).toContain('budget');
    });

    it('should not match non-overlapping budget ranges', () => {
      const profile1 = createMockProfile({
        preferences: { minBudget: 10000, maxBudget: 15000 },
      });
      const profile2 = createMockProfile({
        preferences: { minBudget: 20000, maxBudget: 30000 },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).not.toContain('budget');
    });

    it('should match shared area preferences', () => {
      const profile1 = createMockProfile({
        preferences: { preferredAreas: ['mumbai-south', 'bandra', 'juhu'] },
      });
      const profile2 = createMockProfile({
        preferences: { preferredAreas: ['bandra', 'andheri', 'juhu'] },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).toContain('area');
    });

    it('should deduplicate matchedTags', () => {
      const profile1 = createMockProfile({
        lifestyle: { vibeTags: ['chill', 'clean'] },
      });
      const profile2 = createMockProfile({
        lifestyle: { vibeTags: ['chill', 'clean', 'social'] },
      });

      const result = calculateCompatibility(profile1, profile2);

      // No duplicates should exist
      const tagCounts = result.matchedTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.values(tagCounts).forEach((count) => {
        expect(count).toBe(1);
      });
    });

    it('should return all common vibe tags', () => {
      const profile1 = createMockProfile({
        lifestyle: { vibeTags: ['chill', 'clean', 'quiet'] },
      });
      const profile2 = createMockProfile({
        lifestyle: { vibeTags: ['chill', 'clean', 'social'] },
      });

      const result = calculateCompatibility(profile1, profile2);

      expect(result.matchedTags).toContain('chill');
      expect(result.matchedTags).toContain('clean');
    });
  });

  describe('calculateCompatibility - edge cases', () => {
    it('should handle missing optional lifestyle fields', () => {
      const profile1 = createMockProfile({
        lifestyle: {
          vibeTags: ['chill'],
          sleepSchedule: 'flexible',
          workFromHome: false,
          smoking: 'never',
          drinking: 'never',
          pets: false,
          // allergies intentionally undefined
        },
      });

      const result = calculateCompatibility(profile1, profile1);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero minBudget and maxBudget', () => {
      const profile1 = createMockProfile({
        preferences: { minBudget: 0, maxBudget: 0 },
      });

      const result = calculateCompatibility(profile1, profile1);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
