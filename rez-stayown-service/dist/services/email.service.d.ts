/**
 * Email Service for StayOwn Hotel Bookings
 *
 * Handles sending transactional and marketing emails via configured provider
 */
import { BookingConfirmationData, CheckinReminderData, ReviewRequestData, SpecialOfferData } from '../templates/email-templates';
export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
export interface EmailConfig {
    provider: 'sendgrid' | 'ses' | 'smtp' | 'mock';
    apiKey?: string;
    fromEmail: string;
    fromName: string;
    replyTo?: string;
}
declare class EmailService {
    private config;
    private mockMode;
    constructor(config?: Partial<EmailConfig>);
    /**
     * Send booking confirmation email
     */
    sendBookingConfirmation(data: BookingConfirmationData): Promise<EmailResult>;
    /**
     * Send check-in reminder email (24h before)
     */
    sendCheckinReminder(data: CheckinReminderData): Promise<EmailResult>;
    /**
     * Send review request email (after checkout)
     */
    sendReviewRequest(data: ReviewRequestData): Promise<EmailResult>;
    /**
     * Send special offer / promotional email
     */
    sendSpecialOffer(data: SpecialOfferData): Promise<EmailResult>;
    /**
     * Send batch emails (for promotional campaigns)
     */
    sendBatch(emails: Array<{
        to: string;
        subject: string;
        html: string;
    }>): Promise<{
        results: EmailResult[];
        totalSent: number;
        totalFailed: number;
    }>;
    /**
     * Core email sending function - routes to appropriate provider
     */
    private sendEmail;
    /**
     * Send via SendGrid
     */
    private sendViaSendGrid;
    /**
     * Send via AWS SES
     */
    private sendViaSES;
    /**
     * Send via SMTP
     */
    private sendViaSMTP;
    /**
     * Update service configuration
     */
    updateConfig(config: Partial<EmailConfig>): void;
    /**
     * Get current configuration (without secrets)
     */
    getConfig(): Omit<EmailConfig, 'apiKey'> & {
        apiKey?: string;
    };
}
export declare function getEmailService(config?: Partial<EmailConfig>): EmailService;
export declare function createEmailService(config?: Partial<EmailConfig>): EmailService;
export { EmailService };
//# sourceMappingURL=email.service.d.ts.map