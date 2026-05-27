import { httpRequest, getServiceUrl } from './external-services';
import { logger } from '../utils/logger';

const karmaLogger = logger.child({ service: 'ReZ-Karma' });

export interface KarmaStatus {
  userId: string;
  level: 'L1' | 'L2' | 'L3' | 'L4';
  points: number;
  totalPoints: number;
}

/**
 * Get user karma status
 */
export async function getKarmaStatus(
  userId: string
): Promise<{ success: boolean; karma?: KarmaStatus; error?: string }> {
  const result = await httpRequest<{
    success: boolean;
    data?: KarmaStatus;
  }>(
    `${getServiceUrl('karma')}/api/karma/${userId}/status`
  );

  if (result.success && result.data) {
    return { success: true, karma: result.data };
  }

  return { success: false, error: result.error };
}

/**
 * Add karma points
 */
export async function addKarmaPoints(
  userId: string,
  points: number,
  reason: string
): Promise<boolean> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('karma')}/api/karma/${userId}/points/add`,
    {
      method: 'POST',
      body: { points, reason, source: 'habixo' },
    }
  );

  if (result.success) {
    karmaLogger.info({ userId, points, reason }, 'Karma points added');
  }

  return result.success;
}

/**
 * Deduct karma points
 */
export async function deductKarmaPoints(
  userId: string,
  points: number,
  reason: string
): Promise<boolean> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('karma')}/api/karma/${userId}/points/deduct`,
    {
      method: 'POST',
      body: { points, reason, source: 'habixo' },
    }
  );

  if (result.success) {
    karmaLogger.info({ userId, points, reason }, 'Karma points deducted');
  }

  return result.success;
}

/**
 * Check if user qualifies for level upgrade
 */
export async function checkKarmaUpgrade(
  userId: string
): Promise<{ upgraded: boolean; newLevel?: string }> {
  const result = await httpRequest<{
    success: boolean;
    upgraded?: boolean;
    newLevel?: string;
  }>(
    `${getServiceUrl('karma')}/api/karma/${userId}/check-upgrade`,
    { method: 'POST' }
  );

  return {
    upgraded: result.success && result.data?.upgraded === true,
    newLevel: result.data?.newLevel,
  };
}

// Karma level benefits
export const KarmaBenefits = {
  L1: {
    name: 'New',
    trustBoost: 0,
    benefits: ['Standard booking experience'],
  },
  L2: {
    name: 'Trusted',
    trustBoost: 5,
    benefits: ['Priority support', 'Early access to listings'],
  },
  L3: {
    name: 'Valued',
    trustBoost: 10,
    benefits: ['Service fee discounts', 'Instant book eligibility', 'Priority support'],
  },
  L4: {
    name: 'Elite',
    trustBoost: 15,
    benefits: ['VIP host access', 'Guaranteed availability', 'Premium support', 'Reduced service fees'],
  },
};
