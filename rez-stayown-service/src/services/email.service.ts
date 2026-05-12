/**
 * Email Service for StayOwn Hotel Bookings
 *
 * Handles sending transactional and marketing emails via RABTUL Notification Service
 */

import {
  generateBookingConfirmationEmail,
  generateCheckinReminderEmail,
  generateReviewRequestEmail,
  generateSpecialOfferEmail,
  BookingConfirmationData,
  CheckinReminderData,
  ReviewRequestData,
  SpecialOfferData
} from '../templates/email-templates';

// RABTUL Notification Service URL
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';

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

class EmailService {
  private config: EmailConfig;
  private mockMode: boolean;

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      provider: config?.provider || 'mock',
      apiKey: config?.apiKey || process.env.EMAIL_API_KEY,
      fromEmail: config?.fromEmail || process.env.EMAIL_FROM || 'noreply@stayown.com',
      fromName: config?.fromName || process.env.EMAIL_FROM_NAME || 'StayOwn Hotels',
      replyTo: config?.replyTo || process.env.EMAIL_REPLY_TO || 'support@stayown.com',
    };
    this.mockMode = this.config.provider === 'mock';
  }

  /**
   * Send email via RABTUL Notification Service
   */
  private async sendViaRABTUL(email: {
    to: string;
    subject: string;
    html: string;
  }): Promise<string> {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';

    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': internalToken,
      },
      body: JSON.stringify({
        userId: email.to,
        channel: 'EMAIL',
        template: 'custom',
        data: {
          to: email.to,
          subject: email.subject,
          html: email.html,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RABTUL Notification Service error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.messageId || `rabtul-${Date.now()}`;
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: BookingConfirmationData): Promise<EmailResult> {
    const email = generateBookingConfirmationEmail(data);

    try {
      if (this.mockMode) {
        console.log('[EmailService] Mock mode - skipping send:', {
          to: email.to,
          subject: email.subject
        });
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      const messageId = await this.sendViaRABTUL({
        to: email.to,
        subject: email.subject,
        html: email.html,
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Failed to send booking confirmation:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send check-in reminder email (24h before)
   */
  async sendCheckinReminder(data: CheckinReminderData): Promise<EmailResult> {
    const email = generateCheckinReminderEmail(data);

    try {
      if (this.mockMode) {
        console.log('[EmailService] Mock mode - skipping checkin reminder:', {
          to: email.to,
          subject: email.subject
        });
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      const messageId = await this.sendViaRABTUL({
        to: email.to,
        subject: email.subject,
        html: email.html,
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Failed to send checkin reminder:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send review request email (after checkout)
   */
  async sendReviewRequest(data: ReviewRequestData): Promise<EmailResult> {
    const email = generateReviewRequestEmail(data);

    try {
      if (this.mockMode) {
        console.log('[EmailService] Mock mode - skipping review request:', {
          to: email.to,
          subject: email.subject
        });
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      const messageId = await this.sendViaRABTUL({
        to: email.to,
        subject: email.subject,
        html: email.html,
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Failed to send review request:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send special offer / promotional email
   */
  async sendSpecialOffer(data: SpecialOfferData): Promise<EmailResult> {
    const email = generateSpecialOfferEmail(data);

    try {
      if (this.mockMode) {
        console.log('[EmailService] Mock mode - skipping special offer:', {
          to: email.to,
          subject: email.subject
        });
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      const messageId = await this.sendViaRABTUL({
        to: email.to,
        subject: email.subject,
        html: email.html,
      });

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Failed to send special offer:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send batch emails (for promotional campaigns)
   */
  async sendBatch(
    emails: Array<{
      to: string;
      subject: string;
      html: string;
    }>
  ): Promise<{ results: EmailResult[]; totalSent: number; totalFailed: number }> {
    const results: EmailResult[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    for (const email of emails) {
      try {
        if (this.mockMode) {
          console.log('[EmailService] Mock mode - batch email:', { to: email.to, subject: email.subject });
          results.push({ success: true, messageId: `mock-${Date.now()}` });
          totalSent++;
        } else {
          const messageId = await this.sendViaRABTUL({
            to: email.to,
            subject: email.subject,
            html: email.html,
          });
          results.push({ success: true, messageId });
          totalSent++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ success: false, error: errorMessage });
        totalFailed++;
      }
    }

    return { results, totalSent, totalFailed };
  }

  /**
   * Core email sending function - routes to RABTUL Notification Service
   */
  private async sendEmail(email: {
    to: string;
    from: string;
    replyTo?: string;
    subject: string;
    html: string;
  }): Promise<string> {
    // Route all emails through RABTUL Notification Service
    return this.sendViaRABTUL({
      to: email.to,
      subject: email.subject,
      html: email.html,
    });
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<EmailConfig>): void {
    this.config = { ...this.config, ...config };
    this.mockMode = this.config.provider === 'mock';
  }

  /**
   * Get current configuration (without secrets)
   */
  getConfig(): Omit<EmailConfig, 'apiKey'> & { apiKey?: string } {
    return {
      ...this.config,
      apiKey: this.config.apiKey ? '***' : undefined,
    };
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(config?: Partial<EmailConfig>): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService(config);
  } else if (config) {
    emailServiceInstance.updateConfig(config);
  }
  return emailServiceInstance;
}

export function createEmailService(config?: Partial<EmailConfig>): EmailService {
  return new EmailService(config);
}

export { EmailService };
