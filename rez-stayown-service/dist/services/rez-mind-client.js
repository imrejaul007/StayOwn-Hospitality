"use strict";
/**
 * REZ Mind Client for StayOwn Service
 *
 * Sends all events to REZ Mind event platform.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rezMindClient = void 0;
const axios_1 = __importDefault(require("axios"));
const REZ_MIND_URL = process.env.REZ_MIND_URL || 'http://localhost:4017';
class REZMindClient {
    static instance;
    static getInstance() {
        if (!REZMindClient.instance) {
            REZMindClient.instance = new REZMindClient();
        }
        return REZMindClient.instance;
    }
    async sendEvent(event) {
        try {
            await axios_1.default.post(`${REZ_MIND_URL}/api/events`, event, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            console.log(`[REZMindClient] Event sent: ${event.eventType}`);
        }
        catch (error) {
            console.warn(`[REZMindClient] Failed to send event ${event.eventType}: ${error.message}`);
            // Don't throw - event sending should not break the main flow
        }
    }
}
exports.rezMindClient = REZMindClient.getInstance();
exports.default = exports.rezMindClient;
//# sourceMappingURL=rez-mind-client.js.map