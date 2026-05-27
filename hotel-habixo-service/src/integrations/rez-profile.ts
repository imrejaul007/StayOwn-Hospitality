/**
 * ReZ Profile Service Integration
 *
 * Integrates with the ReZ Profile Service for:
 * - User profile management
 * - Host profile management and verification
 * - FCM/push token storage for push notifications
 */

import { httpRequest, getServiceUrl } from './external-services';
import { logger } from '../utils/logger';

const profileLogger = logger.child({ service: 'ReZ-Profile' });

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  userId: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  role: 'user' | 'consumer' | 'merchant' | 'admin' | 'support' | 'operator' | 'super_admin';
  segment: IdentitySegment;
  isVerified: boolean;
  isOnboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export type IdentitySegment =
  | 'normal'
  | 'verified'
  | 'student'
  | 'pro'
  | 'creator'
  | 'business'
  | 'influencer'
  | 'host'
  | 'vip';

export interface HostProfile extends UserProfile {
  segment: 'host';
  hostProfile?: {
    verified: boolean;
    verifiedAt?: string;
    totalProperties: number;
    responseRate: number;
    responseTime: string;
    superhost: boolean;
    yearsHosting: number;
  };
}

export interface CreateHostProfileInput {
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
}

export interface UpdateProfileInput {
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
}

export interface PushTokenData {
  fcmToken: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  appVersion?: string;
  enabled?: boolean;
}

export interface UserPushTokens {
  userId: string;
  tokens: Array<{
    fcmToken: string;
    platform: 'ios' | 'android' | 'web';
    deviceId?: string;
    enabled: boolean;
    updatedAt: string;
  }>;
}

// ─── User Profile Functions ─────────────────────────────────────────────────────

/**
 * Get user profile from ReZ Profile Service
 * @param userId - The user ID
 * @returns User profile or null if not found
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const result = await httpRequest<{ success: boolean; data?: UserProfile }>(
    `${getServiceUrl('profile')}/profile/${userId}`,
    {
      method: 'GET',
    }
  );

  if (result.success && result.data) {
    profileLogger.debug({ userId }, 'User profile retrieved');
    return result.data.data;
  }

  if (result.statusCode === 404) {
    profileLogger.debug({ userId }, 'User profile not found');
    return null;
  }

  profileLogger.warn({ userId, error: result.error }, 'Failed to get user profile');
  return null;
}

/**
 * Update user profile
 * @param userId - The user ID
 * @param data - Profile data to update
 * @returns Updated profile or null if failed
 */
export async function updateUserProfile(
  userId: string,
  data: UpdateProfileInput
): Promise<UserProfile | null> {
  const result = await httpRequest<{ success: boolean; data?: UserProfile }>(
    `${getServiceUrl('profile')}/profile/${userId}`,
    {
      method: 'PATCH',
      body: data,
    }
  );

  if (result.success && result.data) {
    profileLogger.info({ userId, fields: Object.keys(data) }, 'User profile updated');
    return result.data.data;
  }

  profileLogger.warn({ userId, error: result.error }, 'Failed to update user profile');
  return null;
}

// ─── Host Profile Functions ────────────────────────────────────────────────────

/**
 * Get host profile from ReZ Profile Service
 * @param hostId - The host user ID
 * @returns Host profile with host-specific data or null if not found
 */
export async function getHostProfile(hostId: string): Promise<HostProfile | null> {
  const profile = await getUserProfile(hostId);

  if (!profile) {
    return null;
  }

  // Enhance with host-specific segment
  const hostProfile: HostProfile = {
    ...profile,
    segment: 'host',
    hostProfile: {
      verified: profile.isVerified,
      verifiedAt: profile.isVerified ? profile.updatedAt : undefined,
      totalProperties: 0, // Will be populated by PropertyService
      responseRate: 100,
      responseTime: 'within an hour',
      superhost: profile.segment === 'vip' || profile.isVerified,
      yearsHosting: 0,
    },
  };

  profileLogger.debug({ hostId }, 'Host profile retrieved');
  return hostProfile;
}

/**
 * Create host profile in ReZ Profile Service
 * Creates a user profile with 'host' segment
 * @param hostId - The host user ID
 * @param data - Initial host profile data
 * @returns Created host profile or null if failed
 */
export async function createHostProfile(
  hostId: string,
  data: CreateHostProfileInput
): Promise<HostProfile | null> {
  const createData = {
    ...data,
    role: 'user',
    segment: 'host' as IdentitySegment,
    isVerified: false,
    isOnboarded: false,
  };

  const result = await httpRequest<{ success: boolean; data?: UserProfile }>(
    `${getServiceUrl('profile')}/profile/${hostId}`,
    {
      method: 'PATCH',
      body: createData,
    }
  );

  if (result.success && result.data) {
    const profile = result.data.data;
    const hostProfile: HostProfile = {
      ...profile,
      segment: 'host',
      hostProfile: {
        verified: false,
        totalProperties: 0,
        responseRate: 100,
        responseTime: 'within an hour',
        superhost: false,
        yearsHosting: 0,
      },
    };
    profileLogger.info({ hostId }, 'Host profile created');
    return hostProfile;
  }

  profileLogger.warn({ hostId, error: result.error }, 'Failed to create host profile');
  return null;
}

/**
 * Mark host as verified in ReZ Profile Service
 * @param hostId - The host user ID
 * @returns Updated host profile or null if failed
 */
export async function verifyHost(hostId: string): Promise<HostProfile | null> {
  const result = await httpRequest<{ success: boolean; data?: UserProfile }>(
    `${getServiceUrl('profile')}/profile/${hostId}`,
    {
      method: 'PATCH',
      body: {
        isVerified: true,
        segment: 'host',
      },
    }
  );

  if (result.success && result.data) {
    const profile = result.data.data;
    const hostProfile: HostProfile = {
      ...profile,
      segment: 'host',
      hostProfile: {
        verified: true,
        verifiedAt: new Date().toISOString(),
        totalProperties: 0,
        responseRate: 100,
        responseTime: 'within an hour',
        superhost: true,
        yearsHosting: 0,
      },
    };
    profileLogger.info({ hostId }, 'Host verified');
    return hostProfile;
  }

  profileLogger.warn({ hostId, error: result.error }, 'Failed to verify host');
  return null;
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Get or create user profile (utility function)
 * @param userId - The user ID
 * @param defaultData - Default data if profile doesn't exist
 * @returns User profile (existing or newly created)
 */
export async function getOrCreateUserProfile(
  userId: string,
  defaultData?: CreateHostProfileInput
): Promise<UserProfile | null> {
  let profile = await getUserProfile(userId);

  if (!profile && defaultData) {
    profile = await createHostProfile(userId, defaultData);
  }

  return profile;
}

/**
 * Get guest profile for booking context
 * Returns safe, non-sensitive guest information
 * @param guestId - The guest user ID
 * @returns Safe guest profile data
 */
export async function getGuestProfileForBooking(guestId: string): Promise<{
  userId: string;
  firstName: string;
  avatar?: string;
  isVerified: boolean;
  memberSince: string;
} | null> {
  const profile = await getUserProfile(guestId);

  if (!profile) {
    return null;
  }

  return {
    userId: profile.userId,
    firstName: profile.firstName || 'Guest',
    avatar: profile.avatar,
    isVerified: profile.isVerified,
    memberSince: profile.createdAt,
  };
}

/**
 * Get host profile with property stats
 * Combines profile data with Habixo property stats
 * @param hostId - The host user ID
 * @param propertyStats - Stats from Habixo (totalProperties, responseRate, etc.)
 * @returns Enhanced host profile
 */
export async function getHostProfileWithStats(
  hostId: string,
  propertyStats: {
    totalProperties: number;
    responseRate: number;
    responseTime: string;
    avgRating: number;
    totalReviews: number;
    yearsHosting: number;
  }
): Promise<HostProfile | null> {
  const profile = await getUserProfile(hostId);

  if (!profile) {
    return null;
  }

  const hostProfile: HostProfile = {
    ...profile,
    segment: 'host',
    hostProfile: {
      verified: profile.isVerified,
      verifiedAt: profile.isVerified ? profile.updatedAt : undefined,
      totalProperties: propertyStats.totalProperties,
      responseRate: propertyStats.responseRate,
      responseTime: propertyStats.responseTime,
      superhost:
        propertyStats.avgRating >= 4.8 &&
        propertyStats.totalReviews >= 10 &&
        propertyStats.responseRate >= 95,
      yearsHosting: propertyStats.yearsHosting,
    },
  };

  return hostProfile;
}

// ─── Push Token Management ──────────────────────────────────────────────────────

/**
 * Register or update FCM push token for a user
 * @param userId - The user ID
 * @param tokenData - Push token data
 * @returns Success status
 */
export async function registerPushToken(
  userId: string,
  tokenData: PushTokenData
): Promise<{ success: boolean; error?: string }> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('profile')}/profile/${userId}/push-token`,
    {
      method: 'POST',
      body: {
        fcmToken: tokenData.fcmToken,
        platform: tokenData.platform,
        deviceId: tokenData.deviceId,
        appVersion: tokenData.appVersion,
        enabled: tokenData.enabled ?? true,
      },
    }
  );

  if (result.success) {
    profileLogger.info(
      { userId, platform: tokenData.platform },
      'Push token registered'
    );
    return { success: true };
  }

  profileLogger.warn(
    { userId, error: result.error },
    'Failed to register push token'
  );
  return { success: false, error: result.error };
}

/**
 * Remove FCM push token for a user
 * @param userId - The user ID
 * @param fcmToken - The FCM token to remove
 * @returns Success status
 */
export async function removePushToken(
  userId: string,
  fcmToken: string
): Promise<{ success: boolean; error?: string }> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('profile')}/profile/${userId}/push-token`,
    {
      method: 'DELETE',
      body: { fcmToken },
    }
  );

  if (result.success) {
    profileLogger.info({ userId }, 'Push token removed');
    return { success: true };
  }

  return { success: false, error: result.error };
}

/**
 * Get all push tokens for a user
 * @param userId - The user ID
 * @returns List of push tokens
 */
export async function getUserPushTokens(
  userId: string
): Promise<{ success: boolean; tokens?: UserPushTokens; error?: string }> {
  const result = await httpRequest<{
    success: boolean;
    data?: UserPushTokens;
  }>(
    `${getServiceUrl('profile')}/profile/${userId}/push-tokens`
  );

  if (result.success && result.data) {
    return { success: true, tokens: result.data.data };
  }

  return { success: false, error: result.error };
}

/**
 * Enable/disable a specific push token
 * @param userId - The user ID
 * @param fcmToken - The FCM token to update
 * @param enabled - Enable or disable the token
 * @returns Success status
 */
export async function setPushTokenEnabled(
  userId: string,
  fcmToken: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('profile')}/profile/${userId}/push-token/enable`,
    {
      method: 'PATCH',
      body: { fcmToken, enabled },
    }
  );

  if (result.success) {
    profileLogger.info({ userId, enabled }, 'Push token enabled status updated');
    return { success: true };
  }

  return { success: false, error: result.error };
}

/**
 * Remove all push tokens for a user (e.g., on logout)
 * @param userId - The user ID
 * @returns Success status
 */
export async function removeAllPushTokens(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('profile')}/profile/${userId}/push-tokens`,
    {
      method: 'DELETE',
    }
  );

  if (result.success) {
    profileLogger.info({ userId }, 'All push tokens removed');
    return { success: true };
  }

  return { success: false, error: result.error };
}
