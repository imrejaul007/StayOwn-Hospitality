/**
 * Room Service Webhook Service
 *
 * Listens for room service events from Hotel OTA and syncs to StayOwn folio.
 *
 * Events:
 * - request.created - New service request
 * - request.completed - Service completed (triggers charge)
 * - charge.added - Direct charge (minibar, etc.)
 * - checkout.requested - Guest requests checkout
 */
import { RoomServiceWebhookEvent } from '../room-qr';
/**
 * Event types from Hotel OTA
 */
export type RoomServiceEventType = 'request.created' | 'request.completed' | 'request.cancelled' | 'charge.added' | 'checkout.requested';
export interface RoomServiceEvent {
    type: RoomServiceEventType;
    bookingId: string;
    hotelId: string;
    roomId: string;
    timestamp: Date;
    data?: Record<string, any>;
}
/**
 * Webhook subscription configuration
 */
export interface WebhookSubscription {
    id: string;
    url: string;
    events: RoomServiceEventType[];
    secret: string;
    active: boolean;
    createdAt: Date;
}
/**
 * Process incoming webhook from Hotel OTA
 */
export declare function processWebhook(payload: RoomServiceWebhookEvent, signature: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Register webhook with Hotel OTA
 */
export declare function registerWebhook(): Promise<boolean>;
/**
 * Retry failed webhook processing
 */
export declare function retryWebhook(payload: RoomServiceWebhookEvent, maxRetries?: number): Promise<boolean>;
/**
 * Handle webhook queue processing (for background jobs)
 */
export declare function processWebhookQueue(): Promise<void>;
/**
 * Event transformer - converts Hotel OTA events to StayOwn format
 */
export declare function transformRoomServiceEvent(hotelOtaEvent: any): RoomServiceWebhookEvent;
/**
 * Webhook health check
 */
export declare function webhookHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    lastCheck: Date;
    registeredHotels: number;
}>;
/**
 * Event logging for audit trail
 */
export declare function logWebhookEvent(event: RoomServiceWebhookEvent, result: 'success' | 'failure', error?: string): Promise<void>;
//# sourceMappingURL=room-service.d.ts.map