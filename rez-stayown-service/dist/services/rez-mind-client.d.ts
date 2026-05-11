/**
 * REZ Mind Client for StayOwn Service
 *
 * Sends all events to REZ Mind event platform.
 */
export interface REZMindEvent {
    eventType: string;
    source: 'stayown';
    userId?: string;
    data: Record<string, unknown>;
    timestamp: Date;
}
declare class REZMindClient {
    private static instance;
    static getInstance(): REZMindClient;
    sendEvent(event: REZMindEvent): Promise<void>;
}
export declare const rezMindClient: REZMindClient;
export default rezMindClient;
//# sourceMappingURL=rez-mind-client.d.ts.map