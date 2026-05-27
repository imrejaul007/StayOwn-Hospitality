import { httpRequest, getServiceUrl } from './external-services';
import { logger } from '../utils/logger';

const gamificationLogger = logger.child({ service: 'ReZ-Gamification' });

export interface StreakData {
  userId: string;
  streakCount: number;
  lastActivity: Date;
  longestStreak: number;
}

/**
 * Get user streak data
 */
export async function getUserStreak(
  userId: string
): Promise<StreakData | null> {
  const result = await httpRequest<{
    success: boolean;
    data?: StreakData;
  }>(
    `${getServiceUrl('gamification')}/streaks/${userId}`
  );

  if (!result.success || !result.data) {
    return null;
  }

  return result.data;
}

/**
 * Increment user streak
 */
export async function incrementStreak(
  userId: string,
  context?: string
): Promise<boolean> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('gamification')}/streaks/${userId}/increment`,
    {
      method: 'POST',
      body: { context, timestamp: new Date().toISOString() },
    }
  );

  if (!result.success) {
    gamificationLogger.warn({ userId, context }, 'Failed to increment streak');
    return false;
  }

  gamificationLogger.info({ userId, context }, 'Streak incremented');
  return true;
}

/**
 * Get streak bonus multiplier
 */
export function getStreakBonus(streakCount: number): number {
  if (streakCount >= 30) return 2.0;
  if (streakCount >= 14) return 1.5;
  if (streakCount >= 7) return 1.25;
  if (streakCount >= 3) return 1.1;
  return 1.0;
}
