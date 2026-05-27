import { TrustScore, ITrustScore } from '../models';
import { logger } from '../utils/logger';
import { KarmaBenefits, KarmaStatus } from '../integrations/rez-karma';

const trustLogger = logger.child({ service: 'TrustService' });

export interface TrustScoreResponse {
  entityId: string;
  entityType: 'property' | 'host' | 'guest';
  score: number;
  level: string;
  components: {
    reliability: number;
    quality: number;
    behavior: number;
    reviews: number;
  };
  karmaBoost: number;
  finalScore: number;
  isNew: boolean;
}

const TRUST_LEVELS = [
  { threshold: 90, level: 'exceptional' },
  { threshold: 75, level: 'excellent' },
  { threshold: 60, level: 'good' },
  { threshold: 40, level: 'fair' },
  { threshold: 0, level: 'new' },
];

function getTrustLevel(score: number): string {
  for (const { threshold, level } of TRUST_LEVELS) {
    if (score >= threshold) return level;
  }
  return 'new';
}

/**
 * Get or create trust score
 */
export async function getOrCreateTrustScore(
  entityId: string,
  entityType: 'property' | 'host' | 'guest'
): Promise<ITrustScore> {
  let trust = await TrustScore.findOne({ entityId, entityType });

  if (!trust) {
    trust = new TrustScore({
      entityId,
      entityType,
      components: {
        reliability: 50,
        quality: 50,
        behavior: 50,
        reviews: 50,
      },
      score: 50,
      karmaBoost: 0,
      finalScore: 50,
    });
    await trust.save();
    trustLogger.info({ entityId, entityType }, 'Trust score created');
  }

  return trust;
}

/**
 * Get trust score with response
 */
export async function getTrustScoreResponse(
  entityId: string,
  entityType: 'property' | 'host' | 'guest'
): Promise<TrustScoreResponse> {
  const trust = await getOrCreateTrustScore(entityId, entityType);

  return {
    entityId: trust.entityId,
    entityType: trust.entityType,
    score: trust.score,
    level: getTrustLevel(trust.score),
    components: trust.components,
    karmaBoost: trust.karmaBoost,
    finalScore: trust.finalScore,
    isNew: trust.createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000, // Created in last 7 days
  };
}

/**
 * Update trust components based on events
 */
export async function updateTrustComponents(
  entityId: string,
  entityType: 'property' | 'host' | 'guest',
  component: 'reliability' | 'quality' | 'behavior' | 'reviews',
  delta: number
): Promise<ITrustScore> {
  const trust = await getOrCreateTrustScore(entityId, entityType);

  const currentValue = trust.components[component];
  trust.components[component] = Math.max(0, Math.min(100, currentValue + delta));

  await trust.save();
  trustLogger.info({ entityId, entityType, component, delta }, 'Trust component updated');

  return trust;
}

/**
 * Update guest behavior score (after booking completion)
 */
export async function updateGuestBehaviorScore(guestId: string): Promise<void> {
  // Good checkout behavior increases score
  await updateTrustComponents(guestId, 'guest', 'behavior', 5);
}

/**
 * Update host reliability score
 */
export async function updateHostReliabilityScore(hostId: string): Promise<void> {
  // High response rate increases score
  const trust = await getOrCreateTrustScore(hostId, 'host');
  trust.components.reliability = Math.min(100, trust.components.reliability + 2);
  await trust.save();
}

/**
 * Apply karma boost to trust score based on user's karma level
 */
export async function applyKarmaBoost(
  entityId: string,
  entityType: 'property' | 'host' | 'guest',
  karmaLevel: 'L1' | 'L2' | 'L3' | 'L4'
): Promise<ITrustScore> {
  const trust = await getOrCreateTrustScore(entityId, entityType);
  const boost = KarmaBenefits[karmaLevel]?.trustBoost ?? 0;

  trust.karmaBoost = boost;
  await trust.save();

  trustLogger.info({ entityId, entityType, karmaLevel, boost }, 'Karma boost applied');

  return trust;
}

/**
 * Apply karma boost from a user's actual karma status
 */
export async function applyKarmaBoostFromStatus(
  entityId: string,
  entityType: 'property' | 'host' | 'guest',
  karmaStatus: KarmaStatus
): Promise<ITrustScore> {
  return applyKarmaBoost(entityId, entityType, karmaStatus.level);
}
