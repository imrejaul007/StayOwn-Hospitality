/**
 * WhatsApp Business API Integration
 * FIX: Added retry logic with exponential backoff for transient failures
 */
declare const TEMPLATES: {
    booking_confirmed: {
        name: string;
        language: {
            code: string;
        };
        components: {
            type: string;
            parameters: {
                type: string;
                text: string;
            }[];
        }[];
    };
    checkin_reminder: {
        name: string;
        language: {
            code: string;
        };
        components: {
            type: string;
            parameters: {
                type: string;
                text: string;
            }[];
        }[];
    };
    room_service_ready: {
        name: string;
        language: {
            code: string;
        };
        components: {
            type: string;
            parameters: {
                type: string;
                text: string;
            }[];
        }[];
    };
};
export interface WhatsAppMessageResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
declare class WhatsAppService {
    /**
     * Send a WhatsApp template message
     * FIX: Added retry logic with exponential backoff for reliability
     */
    sendMessage(phone: string, template: keyof typeof TEMPLATES, params: string[]): Promise<WhatsAppMessageResult>;
    /**
     * Send a raw WhatsApp text message (for testing or simple messages)
     * FIX: Added retry logic with exponential backoff
     */
    sendTextMessage(phone: string, message: string): Promise<WhatsAppMessageResult>;
    /**
     * Send booking confirmation message
     */
    sendBookingConfirmation(phone: string, data: {
        hotelName: string;
        guestName: string;
        checkIn: string;
        roomNumber: string;
    }): Promise<WhatsAppMessageResult>;
    /**
     * Send check-in reminder with QR code
     */
    sendCheckinReminder(phone: string, data: {
        guestName: string;
        hotelName: string;
        checkInTime: string;
        qrUrl: string;
    }): Promise<WhatsAppMessageResult>;
    /**
     * Send room service ready notification
     */
    sendServiceReady(phone: string, data: {
        guestName: string;
        orderId: string;
    }): Promise<WhatsAppMessageResult>;
    /**
     * Validate phone number format (E.164)
     */
    validatePhoneNumber(phone: string): boolean;
    /**
     * Format phone number to E.164 if needed
     */
    formatPhoneNumber(phone: string, countryCode?: string): string;
}
export declare const whatsappService: WhatsAppService;
export {};
//# sourceMappingURL=whatsapp.service.d.ts.map