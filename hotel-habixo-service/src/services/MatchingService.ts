import { v4 as uuidv4 } from 'uuid';
import { FlatmateProfile, IFlatmateProfile } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { captureIntent, HabixoIntents } from '../integrations/rez-mind';
import { notificationService } from './NotificationService';

const matchingLogger = logger.child({ service: 'MatchingService' });

export interface CreateFlatmateProfileInput {
  userId: string;
  lifestyle: {
    vibeTags?: string[];
    sleepSchedule?: string;
    workFromHome?: boolean;
    smoking?: string;
    drinking?: string;
    pets?: boolean;
    allergies?: string[];
  };
  preferences: {
    minBudget?: number;
    maxBudget?: number;
    preferredAreas?: string[];
    moveInDate?: string;
    leaseDuration?: number;
    roommateCount?: {
      min?: number;
      max?: number;
    };
  };
}

export interface FlatmateSearchInput {
  city?: string;
  minBudget?: number;
  maxBudget?: number;
  vibeTags?: string[];
  sleepSchedule?: string;
  workFromHome?: boolean;
  smoking?: string;
  petFriendly?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Create flatmate profile
 */
export async function createFlatmateProfile(
  input: CreateFlatmateProfileInput
): Promise<IFlatmateProfile> {
  const profileId = `FLT-${uuidv4().substring(0, 8).toUpperCase()}`;

  const profile = new FlatmateProfile({
    profileId,
    userId: input.userId,
    lifestyle: {
      vibeTags: input.lifestyle.vibeTags || [],
      sleepSchedule: input.lifestyle.sleepSchedule || 'flexible',
      workFromHome: input.lifestyle.workFromHome || false,
      smoking: input.lifestyle.smoking || 'never',
      drinking: input.lifestyle.drinking || 'occasionally',
      pets: input.lifestyle.pets || false,
      allergies: input.lifestyle.allergies,
    },
    preferences: {
      minBudget: input.preferences.minBudget,
      maxBudget: input.preferences.maxBudget,
      preferredAreas: input.preferences.preferredAreas || [],
      moveInDate: input.preferences.moveInDate
        ? new Date(input.preferences.moveInDate)
        : undefined,
      leaseDuration: input.preferences.leaseDuration,
      roommateCount: input.preferences.roommateCount,
    },
    status: 'active',
    trustScore: 50,
    verified: false,
  });

  await profile.save();
  matchingLogger.info({ profileId, userId: input.userId }, 'Flatmate profile created');

  return profile;
}

/**
 * Calculate compatibility score between two profiles
 */
export function calculateCompatibility(
  profile1: IFlatmateProfile,
  profile2: IFlatmateProfile
): { score: number; matchedTags: string[] } {
  let score = 50; // Base score
  const matchedTags: string[] = [];

  // Lifestyle matching (40% of score)
  const lifestyleWeight = 0.4;

  // Sleep schedule match
  if (profile1.lifestyle.sleepSchedule === profile2.lifestyle.sleepSchedule) {
    score += 10;
    matchedTags.push('sleepSchedule');
  }

  // Work from home match
  if (profile1.lifestyle.workFromHome === profile2.lifestyle.workFromHome) {
    score += 5;
    matchedTags.push('workFromHome');
  }

  // Smoking compatibility
  const smokingScores: Record<string, number> = {
    never: 10,
    occasionally: 5,
    regularly: 0,
  };
  if (
    profile1.lifestyle.smoking === 'never' ||
    profile2.lifestyle.smoking === 'never'
  ) {
    if (profile1.lifestyle.smoking === profile2.lifestyle.smoking) {
      score += 5;
    }
  } else {
    score += Math.min(
      smokingScores[profile1.lifestyle.smoking],
      smokingScores[profile2.lifestyle.smoking]
    );
  }
  matchedTags.push('smoking');

  // Pet compatibility
  if (
    profile1.lifestyle.pets === profile2.lifestyle.pets ||
    (!profile1.lifestyle.pets && !profile2.lifestyle.pets)
  ) {
    score += 5;
    matchedTags.push('pets');
  }

  // Vibe tags overlap (15% of score)
  const vibeWeight = 0.15;
  const sharedVibes = profile1.lifestyle.vibeTags.filter((tag) =>
    profile2.lifestyle.vibeTags.includes(tag)
  );
  const vibeScore = (sharedVibes.length / Math.max(profile1.lifestyle.vibeTags.length, 1)) * 15;
  score += vibeScore;
  matchedTags.push(...sharedVibes);

  // Budget compatibility (20% of score)
  const budgetWeight = 0.2;
  const p1Min = profile1.preferences.minBudget || 0;
  const p1Max = profile1.preferences.maxBudget || Infinity;
  const p2Min = profile2.preferences.minBudget || 0;
  const p2Max = profile2.preferences.maxBudget || Infinity;

  // Check overlap
  if (p1Min <= p2Max && p2Min <= p1Max) {
    score += 10;
    matchedTags.push('budget');
  }

  // Area preference match (25% of score)
  const areaWeight = 0.25;
  const sharedAreas = profile1.preferences.preferredAreas.filter((area) =>
    profile2.preferences.preferredAreas.includes(area)
  );
  if (sharedAreas.length > 0) {
    score += 15;
    matchedTags.push('area');
  }

  return {
    score: Math.min(100, Math.round(score)),
    matchedTags: [...new Set(matchedTags)],
  };
}

/**
 * Find matching flatmates
 */
export async function findMatches(
  userId: string,
  input: FlatmateSearchInput
): Promise<{
  matches: Array<{ profile: IFlatmateProfile; compatibility: { score: number; matchedTags: string[] } }>;
  total: number;
}> {
  const userProfile = await FlatmateProfile.findOne({ userId });
  if (!userProfile) {
    throw new NotFoundError('FlatmateProfile', userId);
  }

  const { page = 1, limit = 20 } = input;
  const skip = (page - 1) * limit;

  // Build query
  const query: Record<string, unknown> = {
    userId: { $ne: userId },
    status: 'active',
  };

  if (input.minBudget) {
    query['preferences.maxBudget'] = { $gte: input.minBudget };
  }
  if (input.maxBudget) {
    query['preferences.minBudget'] = { $lte: input.maxBudget };
  }
  if (input.vibeTags && input.vibeTags.length > 0) {
    query['lifestyle.vibeTags'] = { $in: input.vibeTags };
  }
  if (input.sleepSchedule) {
    query['lifestyle.sleepSchedule'] = input.sleepSchedule;
  }
  if (input.workFromHome !== undefined) {
    query['lifestyle.workFromHome'] = input.workFromHome;
  }
  if (input.smoking) {
    query['lifestyle.smoking'] = input.smoking;
  }
  if (input.petFriendly !== undefined) {
    query['lifestyle.pets'] = input.petFriendly;
  }

  const [candidates, total] = await Promise.all([
    FlatmateProfile.find(query).skip(skip).limit(limit).lean(),
    FlatmateProfile.countDocuments(query),
  ]);

  // Calculate compatibility for each candidate
  const matches = (candidates as unknown as IFlatmateProfile[])
    .map((candidate) => ({
      profile: candidate,
      compatibility: calculateCompatibility(userProfile, candidate),
    }))
    .filter((m) => m.compatibility.score >= 50) // Minimum 50% match
    .sort((a, b) => b.compatibility.score - a.compatibility.score);

  // Send notifications for top matches (score >= 80%)
  const topMatches = matches.filter((m) => m.compatibility.score >= 80);
  for (const match of topMatches) {
    // Check if notifications are enabled for this profile
    if (match.profile.notificationsEnabled !== false) {
      await onMatchFound(userId, match.profile, match.compatibility.score, match.compatibility.matchedTags);
    }
  }

  matchingLogger.info({ userId, matchCount: matches.length, notifiedCount: topMatches.length }, 'Matches found');

  return { matches, total };
}

/**
 * Handle match found event - send notification to user
 */
export async function onMatchFound(
  userId: string,
  matchedProfile: IFlatmateProfile,
  compatibilityScore: number,
  matchedTags: string[]
): Promise<void> {
  try {
    const matchDetails = {
      profileId: matchedProfile.profileId,
      userId: matchedProfile.userId,
      name: matchedProfile.name || 'A potential roommate',
      avatar: matchedProfile.avatar,
      compatibilityScore,
      sharedInterests: matchedTags,
    };

    const result = await notificationService.notifyMatchFound(userId, matchDetails);

    matchingLogger.info(
      {
        userId,
        matchedProfileId: matchedProfile.profileId,
        compatibilityScore,
        notificationSuccess: result.success,
      },
      'Match found notification sent'
    );
  } catch (error) {
    matchingLogger.error(
      { error, userId, matchedProfileId: matchedProfile.profileId },
      'Failed to send match found notification'
    );
  }
}

/**
 * Get flatmate profile
 */
export async function getFlatmateProfile(userId: string): Promise<IFlatmateProfile> {
  const profile = await FlatmateProfile.findOne({ userId }).lean();
  if (!profile) {
    throw new NotFoundError('FlatmateProfile', userId);
  }
  return profile as unknown as IFlatmateProfile;
}

/**
 * Capture match view intent
 */
export async function onMatchView(
  viewerId: string,
  flatmateId: string,
  compatibilityScore: number
): Promise<void> {
  await captureIntent({
    userId: viewerId,
    ...HabixoIntents.matchView(flatmateId, compatibilityScore),
  });
}
