import { httpRequest, getServiceUrl } from './external-services';
import { logger } from '../utils/logger';

const mindLogger = logger.child({ service: 'ReZ-Mind' });

export interface IntentEvent {
  userId: string;
  appType: 'habixo_stay' | 'habixo_rent' | 'habixo_match';
  eventType: 'search' | 'view' | 'wishlist' | 'hold' | 'fulfilled';
  category: 'TRAVEL' | 'HOUSING';
  intentKey: string;
  intentQuery?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Capture intent event to ReZ Mind
 */
export async function captureIntent(event: IntentEvent): Promise<boolean> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('intentGraph')}/api/intent/capture`,
    {
      method: 'POST',
      body: {
        userId: event.userId,
        appType: event.appType,
        eventType: event.eventType,
        category: event.category,
        intentKey: event.intentKey,
        intentQuery: event.intentQuery,
        metadata: event.metadata,
      },
    }
  );

  if (!result.success) {
    mindLogger.warn({ event }, 'Failed to capture intent');
    return false;
  }

  return true;
}

/**
 * Trigger dormant intent revival
 */
export async function triggerRevival(
  dormantIntentId: string,
  triggerType: 'price_drop' | 'return_user' | 'seasonality' | 'offer_match' | 'manual'
): Promise<boolean> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('intentGraph')}/api/intent/revival`,
    {
      method: 'POST',
      body: {
        dormantIntentId,
        triggerType,
      },
    }
  );

  return result.success;
}

/**
 * Send nudge to user
 */
export async function sendNudge(
  userId: string,
  intentKey: string,
  message: string,
  channel: 'push' | 'email' | 'sms' | 'in_app' = 'push'
): Promise<boolean> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('intentGraph')}/api/intent/nudge/send`,
    {
      method: 'POST',
      body: {
        userId,
        intentKey,
        message,
        channel,
      },
    }
  );

  return result.success;
}

// Habixo Intent Builders
export const HabixoIntents = {
  // Stay intents
  staySearch: (city: string, metadata?: Record<string, unknown>) => ({
    appType: 'habixo_stay' as const,
    category: 'TRAVEL' as const,
    eventType: 'search' as const,
    intentKey: `habixo_stay_search_${city.toLowerCase().replace(/\s+/g, '_')}`,
    metadata,
  }),

  stayView: (propertyId: string, propertyTitle?: string, city?: string) => ({
    appType: 'habixo_stay' as const,
    category: 'TRAVEL' as const,
    eventType: 'view' as const,
    intentKey: `habixo_stay_view_${propertyId}`,
    intentQuery: propertyTitle,
    metadata: { propertyId, city },
  }),

  stayWishlist: (propertyId: string, propertyTitle: string) => ({
    appType: 'habixo_stay' as const,
    category: 'TRAVEL' as const,
    eventType: 'wishlist' as const,
    intentKey: `habixo_stay_wishlist_${propertyId}`,
    intentQuery: propertyTitle,
    metadata: { propertyId },
  }),

  stayBooked: (propertyId: string, bookingId: string, checkIn?: string, checkOut?: string) => ({
    appType: 'habixo_stay' as const,
    category: 'TRAVEL' as const,
    eventType: 'fulfilled' as const,
    intentKey: `habixo_stay_booked_${propertyId}`,
    metadata: { propertyId, bookingId, checkIn, checkOut },
  }),

  // Rent intents
  rentSearch: (city: string, neighborhood?: string, metadata?: Record<string, unknown>) => ({
    appType: 'habixo_rent' as const,
    category: 'HOUSING' as const,
    eventType: 'search' as const,
    intentKey: `habixo_rent_search_${city.toLowerCase().replace(/\s+/g, '_')}`,
    metadata: { neighborhood, ...metadata },
  }),

  rentView: (propertyId: string, propertyTitle?: string) => ({
    appType: 'habixo_rent' as const,
    category: 'HOUSING' as const,
    eventType: 'view' as const,
    intentKey: `habixo_rent_view_${propertyId}`,
    intentQuery: propertyTitle,
    metadata: { propertyId },
  }),

  rentLease: (propertyId: string, leaseId: string) => ({
    appType: 'habixo_rent' as const,
    category: 'HOUSING' as const,
    eventType: 'fulfilled' as const,
    intentKey: `habixo_rent_lease_${propertyId}`,
    metadata: { propertyId, leaseId },
  }),

  // Match intents
  matchSearch: (city: string, vibeTags?: string[]) => ({
    appType: 'habixo_match' as const,
    category: 'HOUSING' as const,
    eventType: 'search' as const,
    intentKey: `habixo_match_search_${city.toLowerCase().replace(/\s+/g, '_')}`,
    metadata: { vibeTags },
  }),

  matchView: (flatmateId: string, compatibilityScore?: number) => ({
    appType: 'habixo_match' as const,
    category: 'HOUSING' as const,
    eventType: 'view' as const,
    intentKey: `habixo_match_view_${flatmateId}`,
    metadata: { flatmateId, compatibilityScore },
  }),

  matchConnect: (flatmateId: string, connectionId: string) => ({
    appType: 'habixo_match' as const,
    category: 'HOUSING' as const,
    eventType: 'hold' as const,
    intentKey: `habixo_match_connect_${flatmateId}`,
    metadata: { flatmateId, connectionId },
  }),
};
