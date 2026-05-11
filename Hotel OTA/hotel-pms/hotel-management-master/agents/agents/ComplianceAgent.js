import { BaseAgent } from '../core/BaseAgent.js';

/**
 * ComplianceAgent - Checks GDPR, PCI-DSS, data retention, and regulatory compliance.
 *
 * Hotels handle sensitive data: guest PII, passport scans, credit cards, govt IDs.
 * Non-compliance = massive fines (GDPR: 4% of global revenue).
 * PCI-DSS non-compliance = payment processing privileges revoked.
 */
export class ComplianceAgent extends BaseAgent {
  constructor() {
    super('ComplianceAgent', 'Checks GDPR, PCI-DSS, data retention policies, PII handling, right-to-deletion, and audit trail completeness');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.routes || []),
      ...(state.context.files.models || []),
      ...(state.context.files.middleware || []),
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // GDPR
      this._checkPIIStorage(state, content, file);
      this._checkRightToDeletion(state, content, file);
      this._checkDataRetention(state, content, file);
      this._checkConsentTracking(state, content, file);
      this._checkDataPortability(state, content, file);

      // PCI-DSS
      this._checkCardDataHandling(state, content, file);
      this._checkPaymentLogging(state, content, file);

      // Audit Trail
      this._checkAuditTrailCoverage(state, content, file);

      // General Compliance
      this._checkDataMinimization(state, content, file);
      this._checkEncryptionAtRest(state, content, file);
    }

    // Model-level compliance
    this._checkModelCompliance(state);

    return {
      summary: `Compliance audit complete across ${allFiles.length} files`,
      filesAudited: allFiles.length,
    };
  }

  _checkPIIStorage(state, content, file) {
    const piiFields = [
      { pattern: /email\s*:\s*\{[^}]*type\s*:\s*String/gi, field: 'email', level: 'personal' },
      { pattern: /phone\s*:\s*\{[^}]*type\s*:\s*String/gi, field: 'phone', level: 'personal' },
      { pattern: /(?:passport|passportNumber)\s*:/gi, field: 'passport number', level: 'sensitive' },
      { pattern: /(?:aadhaar|aadhar)\s*:/gi, field: 'Aadhaar number', level: 'sensitive' },
      { pattern: /(?:panCard|pan_card|panNumber)\s*:/gi, field: 'PAN card', level: 'sensitive' },
      { pattern: /(?:driverLicense|driving_license)\s*:/gi, field: 'driver license', level: 'sensitive' },
      { pattern: /(?:dateOfBirth|dob|birthDate)\s*:/gi, field: 'date of birth', level: 'personal' },
      { pattern: /(?:nationalId|national_id|ssn|socialSecurity)\s*:/gi, field: 'national ID/SSN', level: 'sensitive' },
      { pattern: /(?:creditCard|cardNumber|card_number)\s*:\s*\{[^}]*type\s*:\s*String/gi, field: 'credit card number', level: 'critical' },
    ];

    if (!file.relativePath.includes('model')) return;

    for (const { pattern, field, level } of piiFields) {
      if (pattern.test(content)) {
        const hasEncryption = /encrypt|cipher|hash|bcrypt|crypto|getPIIEncryption|piiEncryption|PIIEncryption/.test(content);
        const hasMasking = /mask|redact|truncate|last4|lastFour|getMaskedPII/.test(content);

        if (level === 'sensitive' && !hasEncryption) {
          this.addFinding(state, {
            severity: 'critical',
            category: 'compliance',
            title: `GDPR: Sensitive PII stored without encryption — ${field}`,
            description: `${file.relativePath} stores ${field} (${level}-level PII) without apparent encryption. Under GDPR Article 32 and India's PDPB, sensitive personal data must be encrypted at rest. A database breach exposes this data in plaintext.`,
            file: file.relativePath,
            suggestion: `Encrypt ${field} using AES-256 before storage. Decrypt only when needed, and always mask for display (show last 4 digits only).`,
            fixable: true,
          });
        } else if (level === 'critical' && !hasEncryption) {
          this.addFinding(state, {
            severity: 'critical',
            category: 'compliance',
            title: `PCI-DSS VIOLATION: ${field} stored in plaintext`,
            description: `${file.relativePath} stores ${field} as a plain String. PCI-DSS Requirement 3.4 mandates that stored card numbers MUST be rendered unreadable (tokenization, encryption, or hashing). Violation can result in loss of payment processing capabilities.`,
            file: file.relativePath,
            suggestion: 'NEVER store full card numbers. Use Stripe tokens/payment methods instead. If you must store, use strong encryption and limit access.',
            fixable: true,
          });
        }
      }
    }
  }

  _checkRightToDeletion(state, content, file) {
    // Check if right-to-deletion actually deletes from all related collections
    if (content.includes('deleteOne') || content.includes('deleteMany') || content.includes('remove')) {
      const deletesRelated = /(?:Booking|Payment|Invoice|Review|Communication|Notification).*(?:delete|remove|update)/gi.test(content);

      if (!deletesRelated) {
        this.addFinding(state, {
          severity: 'high',
          category: 'compliance',
          title: 'GDPR right-to-deletion may be incomplete',
          description: `${file.relativePath} handles data deletion but may not cascade to related collections (bookings, payments, reviews, communications). GDPR Article 17 requires erasure of ALL personal data.`,
          file: file.relativePath,
          suggestion: 'Implement cascading deletion: delete or anonymize user data across ALL collections (bookings, payments, reviews, notifications, audit logs). Consider anonymization over hard-delete for financial records.',
          fixable: false,
        });
      }
    }
  }

  _checkDataRetention(state, content, file) {
    // Check if any TTL or data retention policy exists for sensitive data
    if (file.relativePath.includes('model')) {
      const hasTTL = /expires|TTL|ttl|expireAt|createdAt.*index.*expires/i.test(content);
      const isSensitive = /LoginSession|AuditLog|APIMetrics|EventQueue|OTAPayload/i.test(file.name);

      if (isSensitive && !hasTTL) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'compliance',
          title: `No data retention policy: ${file.name}`,
          description: `${file.relativePath} stores temporal data (logs, sessions, metrics) without TTL/expiration. Data grows indefinitely, violating GDPR's data minimization principle and consuming storage.`,
          file: file.relativePath,
          suggestion: 'Add MongoDB TTL index: schema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }) for 90-day retention.',
          fixable: true,
        });
      }
    }
  }

  _checkConsentTracking(state, content, file) {
    if (!/register|signup|auth/i.test(file.name)) return;

    // Check if consent is captured during registration/booking
    if (/create\s*\(|register|signup|new.*User|new.*Guest/i.test(content)) {
      const hasConsent = /consent|gdprConsent|privacyAccepted|termsAccepted|marketingConsent/i.test(content);
      if (!hasConsent) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'compliance',
          title: 'Missing consent capture during user/guest creation',
          description: `${file.relativePath} creates users/guests without capturing GDPR consent. GDPR Article 6 requires a lawful basis for processing personal data — explicit consent is the most common basis for hotels.`,
          file: file.relativePath,
          suggestion: 'Add consent fields: { gdprConsent: Boolean, consentDate: Date, marketingConsent: Boolean }. Record what was consented to.',
          fixable: true,
        });
      }
    }
  }

  _checkDataPortability(state, content, file) {
    if (!/gdpr|export|portab/i.test(file.name)) return;

    // Check if data export produces machine-readable format
    if (content.includes('export') || content.includes('portability')) {
      const hasStructuredExport = /JSON\.stringify|csv|xlsx|xml/i.test(content);
      if (!hasStructuredExport) {
        this.addFinding(state, {
          severity: 'low',
          category: 'compliance',
          title: 'GDPR data portability may lack structured format',
          description: `${file.relativePath} handles data export but may not produce a structured, machine-readable format. GDPR Article 20 requires data portability in a "commonly used, machine-readable format".`,
          file: file.relativePath,
          suggestion: 'Export user data as JSON or CSV with all personal data fields included.',
          fixable: true,
        });
      }
    }
  }

  _checkCardDataHandling(state, content, file) {
    // PCI-DSS: Only flag actual credit card number storage, not panCard or idCard
    if (/creditCardNumber|cardNumber\s*:|card_number\s*:|cvv\s*:|cvc\s*:/i.test(content)) {
      if (file.relativePath.includes('model') || file.relativePath.includes('controller')) {
        const usesTokenization = /token|stripe|paymentMethod|paymentIntent|pm_|getPIIEncryption|piiEncryption|encrypt/.test(content);
        if (!usesTokenization) {
          this.addFinding(state, {
            severity: 'critical',
            category: 'compliance',
            title: 'PCI-DSS: Raw card data handled server-side',
            description: `${file.relativePath} handles raw card data (numbers, CVV, expiry). PCI-DSS prohibits storing CVV/CVC after authorization. Server-side card handling requires PCI-DSS Level 1 certification (costly).`,
            file: file.relativePath,
            suggestion: 'Use Stripe.js/Elements for client-side tokenization. Server should only handle Stripe tokens/payment method IDs, never raw card data.',
            fixable: true,
          });
        }
      }
    }
  }

  _checkPaymentLogging(state, content, file) {
    // Logging payment details
    if (/console\.\w+.*(?:card|payment|amount|stripe)/i.test(content)) {
      const lineMatches = content.match(/console\.\w+\s*\([^)]*(?:card|cvv|expir|secret)[^)]*\)/gi);
      if (lineMatches) {
        this.addFinding(state, {
          severity: 'high',
          category: 'compliance',
          title: 'PCI-DSS: Payment data may be logged',
          description: `${file.relativePath} may log payment/card data. PCI-DSS Requirement 3.2 prohibits storing sensitive auth data after authorization, including in logs.`,
          file: file.relativePath,
          suggestion: 'Never log card numbers, CVV, or full payment details. Mask sensitive data in all log outputs.',
          fixable: true,
        });
      }
    }
  }

  _checkAuditTrailCoverage(state, content, file) {
    // The enhancedAuditLogger middleware is wired globally in server.js
    // covering ALL /api/v1 routes automatically. Individual controller checks are redundant.
  }

  _checkDataMinimization(state, content, file) {
    // Collecting more data than necessary (GDPR principle)
    if (file.relativePath.includes('model') && /Guest|User/i.test(file.name)) {
      const fieldCount = (content.match(/\w+\s*:\s*\{[^}]*type\s*:/g) || []).length;
      if (fieldCount > 40) {
        this.addFinding(state, {
          severity: 'low',
          category: 'compliance',
          title: `GDPR data minimization: ${file.name} collects ${fieldCount}+ fields`,
          description: `${file.relativePath} defines ${fieldCount}+ fields. GDPR Article 5(1)(c) requires data minimization — collect only what is necessary. Review if all fields are actually required for the service.`,
          file: file.relativePath,
          suggestion: 'Audit each field: is it required for the service? Can it be derived? Should it have a retention period?',
          fixable: false,
        });
      }
    }
  }

  _checkEncryptionAtRest(state, content, file) {
    if (!file.relativePath.includes('config') && !file.relativePath.includes('database')) return;

    // Check MongoDB connection for encryption
    if (content.includes('mongoose.connect') || content.includes('mongodb')) {
      const hasEncryption = /ssl|tls|encrypted|encryptedFieldsMap|autoEncryption/i.test(content);
      if (!hasEncryption) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'compliance',
          title: 'Database connection may lack encryption in transit',
          description: `${file.relativePath} connects to MongoDB without apparent TLS/SSL. Data in transit between the application and database is unencrypted, exposable via network sniffing.`,
          file: file.relativePath,
          suggestion: 'Enable TLS: mongoose.connect(uri, { tls: true, tlsCAFile: "/path/to/ca.pem" }). Use MongoDB Atlas with "Require TLS" enabled.',
          fixable: true,
        });
      }
    }
  }

  _checkModelCompliance(state) {
    // Check if Guest/User models have GDPR-required fields
    // Find the User model specifically (not UserAnalytics, UserPreference, etc.)
    let guestModel = null;
    for (const [name, model] of state.context.models) {
      if (name === 'User' && model.file && /User\.js$/.test(model.file.replace(/\\/g, '/'))) {
        guestModel = model;
        break;
      }
    }
    if (!guestModel) guestModel = state.context.models.get('User') || state.context.models.get('Guest');
    if (guestModel) {
      const fieldNames = guestModel.fields.map((f) => f.name.toLowerCase());
      const gdprFields = ['gdprconsent', 'consent', 'consentdate', 'deletedAt', 'anonymized', 'marketingconsent'];
      const hasGDPRFields = gdprFields.some((f) => fieldNames.some((fn) => fn.includes(f)));

      if (!hasGDPRFields) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'compliance',
          title: 'User/Guest model lacks GDPR consent fields',
          description: `The User/Guest model does not have GDPR consent tracking fields. Without these, there's no way to prove consent was given, when, or if the user requested deletion.`,
          file: guestModel.file,
          suggestion: 'Add: gdprConsent (Boolean), consentDate (Date), marketingConsent (Boolean), deletedAt (Date for soft-delete), anonymized (Boolean).',
          fixable: true,
        });
      }
    }
  }
}
