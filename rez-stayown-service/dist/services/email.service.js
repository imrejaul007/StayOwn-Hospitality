"use strict";
/**
 * Email Service for StayOwn Hotel Bookings
 *
 * Handles sending transactional and marketing emails via configured provider
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
exports.getEmailService = getEmailService;
exports.createEmailService = createEmailService;
const email_templates_1 = require("../templates/email-templates");
class EmailService {
    config;
    mockMode;
    constructor(config) {
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
     * Send booking confirmation email
     */
    async sendBookingConfirmation(data) {
        const email = (0, email_templates_1.generateBookingConfirmationEmail)(data);
        try {
            if (this.mockMode) {
                console.log('[EmailService] Mock mode - skipping send:', {
                    to: email.to,
                    subject: email.subject
                });
                return { success: true, messageId: `mock-${Date.now()}` };
            }
            const messageId = await this.sendEmail({
                to: email.to,
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                replyTo: this.config.replyTo,
                subject: email.subject,
                html: email.html,
            });
            return { success: true, messageId };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[EmailService] Failed to send booking confirmation:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }
    /**
     * Send check-in reminder email (24h before)
     */
    async sendCheckinReminder(data) {
        const email = (0, email_templates_1.generateCheckinReminderEmail)(data);
        try {
            if (this.mockMode) {
                console.log('[EmailService] Mock mode - skipping checkin reminder:', {
                    to: email.to,
                    subject: email.subject
                });
                return { success: true, messageId: `mock-${Date.now()}` };
            }
            const messageId = await this.sendEmail({
                to: email.to,
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                replyTo: this.config.replyTo,
                subject: email.subject,
                html: email.html,
            });
            return { success: true, messageId };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[EmailService] Failed to send checkin reminder:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }
    /**
     * Send review request email (after checkout)
     */
    async sendReviewRequest(data) {
        const email = (0, email_templates_1.generateReviewRequestEmail)(data);
        try {
            if (this.mockMode) {
                console.log('[EmailService] Mock mode - skipping review request:', {
                    to: email.to,
                    subject: email.subject
                });
                return { success: true, messageId: `mock-${Date.now()}` };
            }
            const messageId = await this.sendEmail({
                to: email.to,
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                replyTo: this.config.replyTo,
                subject: email.subject,
                html: email.html,
            });
            return { success: true, messageId };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[EmailService] Failed to send review request:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }
    /**
     * Send special offer / promotional email
     */
    async sendSpecialOffer(data) {
        const email = (0, email_templates_1.generateSpecialOfferEmail)(data);
        try {
            if (this.mockMode) {
                console.log('[EmailService] Mock mode - skipping special offer:', {
                    to: email.to,
                    subject: email.subject
                });
                return { success: true, messageId: `mock-${Date.now()}` };
            }
            const messageId = await this.sendEmail({
                to: email.to,
                from: `${this.config.fromName} <${this.config.fromEmail}>`,
                replyTo: this.config.replyTo,
                subject: email.subject,
                html: email.html,
            });
            return { success: true, messageId };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[EmailService] Failed to send special offer:', errorMessage);
            return { success: false, error: errorMessage };
        }
    }
    /**
     * Send batch emails (for promotional campaigns)
     */
    async sendBatch(emails) {
        const results = [];
        let totalSent = 0;
        let totalFailed = 0;
        for (const email of emails) {
            try {
                if (this.mockMode) {
                    console.log('[EmailService] Mock mode - batch email:', { to: email.to, subject: email.subject });
                    results.push({ success: true, messageId: `mock-${Date.now()}` });
                    totalSent++;
                }
                else {
                    const messageId = await this.sendEmail({
                        to: email.to,
                        from: `${this.config.fromName} <${this.config.fromEmail}>`,
                        replyTo: this.config.replyTo,
                        subject: email.subject,
                        html: email.html,
                    });
                    results.push({ success: true, messageId });
                    totalSent++;
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({ success: false, error: errorMessage });
                totalFailed++;
            }
        }
        return { results, totalSent, totalFailed };
    }
    /**
     * Core email sending function - routes to appropriate provider
     */
    async sendEmail(email) {
        switch (this.config.provider) {
            case 'sendgrid':
                return this.sendViaSendGrid(email);
            case 'ses':
                return this.sendViaSES(email);
            case 'smtp':
                return this.sendViaSMTP(email);
            default:
                throw new Error(`Unknown email provider: ${this.config.provider}`);
        }
    }
    /**
     * Send via SendGrid
     */
    async sendViaSendGrid(email) {
        if (!this.config.apiKey) {
            throw new Error('SendGrid API key not configured');
        }
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: email.to }] }],
                from: { email: email.from },
                reply_to: email.replyTo ? { email: email.replyTo } : undefined,
                subject: email.subject,
                content: [{ type: 'text/html', value: email.html }],
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SendGrid error: ${response.status} - ${errorText}`);
        }
        const messageId = response.headers.get('X-Message-Id') || `sg-${Date.now()}`;
        return messageId;
    }
    /**
     * Send via AWS SES
     */
    async sendViaSES(email) {
        if (!this.config.apiKey) {
            throw new Error('AWS credentials not configured for SES');
        }
        // AWS SES requires AWS SDK - simplified implementation
        // In production, use @aws-sdk/client-ses
        const response = await fetch(`${process.env.AWS_SES_ENDPOINT || 'https://email.us-east-1.amazonaws.com'}/v1/email/outbound`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': this.config.apiKey,
            },
            body: JSON.stringify({
                Source: email.from,
                Destination: { ToAddresses: [email.to] },
                Message: {
                    Subject: { Data: email.subject, Charset: 'UTF-8' },
                    Body: { Html: { Data: email.html, Charset: 'UTF-8' } },
                },
                ReplyToAddresses: email.replyTo ? [email.replyTo] : [],
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SES error: ${response.status} - ${errorText}`);
        }
        return `ses-${Date.now()}`;
    }
    /**
     * Send via SMTP
     */
    async sendViaSMTP(email) {
        // In production, use nodemailer
        // For now, log the email details
        console.log('[EmailService] SMTP send:', {
            to: email.to,
            from: email.from,
            subject: email.subject,
        });
        // Simulate async send
        await new Promise(resolve => setTimeout(resolve, 100));
        return `smtp-${Date.now()}`;
    }
    /**
     * Update service configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.mockMode = this.config.provider === 'mock';
    }
    /**
     * Get current configuration (without secrets)
     */
    getConfig() {
        return {
            ...this.config,
            apiKey: this.config.apiKey ? '***' : undefined,
        };
    }
}
exports.EmailService = EmailService;
// Singleton instance
let emailServiceInstance = null;
function getEmailService(config) {
    if (!emailServiceInstance) {
        emailServiceInstance = new EmailService(config);
    }
    else if (config) {
        emailServiceInstance.updateConfig(config);
    }
    return emailServiceInstance;
}
function createEmailService(config) {
    return new EmailService(config);
}
//# sourceMappingURL=email.service.js.map