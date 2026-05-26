import logger from './utils/logger';

/**
 * REZ Mind Client for StayOwn Service
 *
 * Sends all events to REZ Mind event platform.
 */

import axios from 'axios';

const REZ_MIND_URL = process.env.REZ_MIND_URL || 'http://localhost:4017';

export interface REZMindEvent {
  eventType: string;
  source: 'stayown';
  userId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

class REZMindClient {
  private static instance: REZMindClient;

  static getInstance(): REZMindClient {
    if (!REZMindClient.instance) {
      REZMindClient.instance = new REZMindClient();
    }
    return REZMindClient.instance;
  }

  async sendEvent(event: REZMindEvent): Promise<void> {
    try {
      await axios.post(`${REZ_MIND_URL}/api/events`, event, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      logger.info(`[REZMindClient] Event sent: ${event.eventType}`);
    } catch (error: any) {
      logger.warn(`[REZMindClient] Failed to send event ${event.eventType}: ${error.message}`);
      // Don't throw - event sending should not break the main flow
    }
  }
}

export const rezMindClient = REZMindClient.getInstance();
export default rezMindClient;
