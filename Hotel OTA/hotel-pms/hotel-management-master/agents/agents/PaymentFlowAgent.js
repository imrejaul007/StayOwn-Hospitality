import { BaseAgent } from '../core/BaseAgent.js';

/**
 * PaymentFlowAgent - PMS-specific agent for payment processing analysis.
 * Validates Stripe integration, refund flows, invoice generation, and financial consistency.
 */
export class PaymentFlowAgent extends BaseAgent {
  constructor() {
    super('PaymentFlowAgent', 'Analyzes payment processing, Stripe integration, refund flows, and financial data consistency');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.routes || []),
      ...(state.context.files.models || []),
    ];

    const paymentFiles = allFiles.filter((f) =>
      /pay|invoice|billing|charge|refund|stripe|settlement|financial|folio|ledger/i.test(f.name)
    );

    console.log(`[PaymentFlowAgent] Found ${paymentFiles.length} payment-related files`);

    for (const file of paymentFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      this._checkStripeIntegration(state, content, file);
      this._checkWebhookSecurity(state, content, file);
      this._checkRefundFlow(state, content, file);
      this._checkPaymentValidation(state, content, file);
      this._checkFinancialConsistency(state, content, file);
      this._checkIdempotency(state, content, file);
      this._checkPartialPayments(state, content, file);
      this._checkCurrencyHandling(state, content, file);
    }

    return {
      summary: `Payment flow analysis complete — ${paymentFiles.length} files analyzed`,
      paymentFilesAnalyzed: paymentFiles.length,
    };
  }

  _checkStripeIntegration(state, content, file) {
    // Check for proper error handling on Stripe API calls
    const stripeCallPattern = /stripe\.\w+\.\w+\s*\(/g;
    let match;
    let unhandledCalls = 0;

    while ((match = stripeCallPattern.exec(content))) {
      const surrounding = content.substring(
        Math.max(0, match.index - 200),
        match.index + 300
      );
      if (!surrounding.includes('try') && !surrounding.includes('.catch(')) {
        unhandledCalls++;
      }
    }

    if (unhandledCalls > 0) {
      this.addFinding(state, {
        severity: 'high',
        category: 'bug',
        title: `${unhandledCalls} Stripe API calls without error handling`,
        description: `${file.relativePath} makes ${unhandledCalls} Stripe API calls without proper error handling. Stripe operations can fail due to network issues, invalid cards, or rate limits. Unhandled failures leave payments in an unknown state.`,
        file: file.relativePath,
        suggestion: 'Wrap all Stripe API calls in try/catch. Handle specific Stripe error types: StripeCardError, StripeRateLimitError, StripeInvalidRequestError.',
        fixable: true,
      });
    }

    // Check for hardcoded Stripe keys
    if (/sk_(?:live|test)_\w{10,}/.test(content)) {
      this.addFinding(state, {
        severity: 'critical',
        category: 'security',
        title: 'Hardcoded Stripe secret key',
        description: `${file.relativePath} contains a hardcoded Stripe secret key. This is a critical security vulnerability — the key can be used to process charges, issue refunds, and access all payment data.`,
        file: file.relativePath,
        suggestion: 'Move to environment variable: process.env.STRIPE_SECRET_KEY. Never commit API keys.',
        fixable: true,
      });
    }
  }

  _checkWebhookSecurity(state, content, file) {
    // Only check files that actually handle incoming webhooks (route handlers)
    if (!file.relativePath.includes('route') && !file.relativePath.includes('webhook')) return;
    if (!/webhook/i.test(file.name) && !/router\.post.*webhook/i.test(content)) return;

    // Webhook signature verification
    if (/router\.post.*webhook|app\.post.*webhook/i.test(content)) {
      const hasSignatureVerification =
        /constructEvent|verifyWebhookSignature|stripe-signature|webhook.*secret/i.test(content);

      if (!hasSignatureVerification) {
        this.addFinding(state, {
          severity: 'critical',
          category: 'security',
          title: 'Payment webhook without signature verification',
          description: `${file.relativePath} handles payment webhooks but may not verify the webhook signature. Without verification, attackers can send fake payment confirmations to mark unpaid bookings as paid.`,
          file: file.relativePath,
          suggestion: 'Use stripe.webhooks.constructEvent(req.body, sig, webhookSecret) to verify webhook authenticity.',
          fixable: true,
        });
      }
    }

    // Raw body for Stripe webhooks
    if (content.includes('stripe') && content.includes('webhook')) {
      if (!content.includes('raw') && !content.includes('Buffer') && !content.includes('express.raw')) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'bug',
          title: 'Stripe webhook may not receive raw body',
          description: `${file.relativePath} handles Stripe webhooks but may not be configured to receive the raw request body. Stripe signature verification requires the raw body, but Express JSON middleware parses it.`,
          file: file.relativePath,
          suggestion: 'Use express.raw({ type: "application/json" }) middleware for the webhook route, before any JSON body parser.',
          fixable: true,
        });
      }
    }
  }

  _checkRefundFlow(state, content, file) {
    if (!/refund/i.test(content)) return;

    // Refund without amount validation
    const refundCreate = /refund|\.refunds\.create/g;
    if (refundCreate.test(content)) {
      const hasAmountValidation = /amount\s*(?:>|<|>=|<=|===)\s*|maxRefund|originalAmount|totalPaid/i.test(content);

      if (!hasAmountValidation) {
        this.addFinding(state, {
          severity: 'high',
          category: 'bug',
          title: 'Refund without amount validation',
          description: `${file.relativePath} processes refunds but may not validate the refund amount against the original payment. This could allow refunding more than what was paid.`,
          file: file.relativePath,
          suggestion: 'Validate: refundAmount <= originalPaymentAmount - previousRefunds. Track cumulative refunds per payment.',
          fixable: true,
        });
      }
    }

    // Refund without booking status update
    if (content.includes('refund')) {
      const updatesBooking = /booking.*status|status.*refund|booking.*cancel/i.test(content);
      if (!updatesBooking) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'bug',
          title: 'Refund may not update booking status',
          description: `${file.relativePath} processes refunds but may not update the associated booking status. This leaves bookings in a "paid" status even after full refund.`,
          file: file.relativePath,
          suggestion: 'After a full refund, update booking.paymentStatus to "refunded". For partial refunds, update to "partially_refunded".',
          fixable: true,
        });
      }
    }
  }

  _checkPaymentValidation(state, content, file) {
    // Payment amount validation
    if (content.includes('amount') && /pay|charge|invoice/i.test(file.name)) {
      const hasAmountValidation = /amount\s*(?:>|>=|<=)\s*0|isNaN\s*\(\s*amount|typeof\s+amount\s*!==?\s*['"]number/i.test(content);

      if (!hasAmountValidation && content.includes('req.body')) {
        this.addFinding(state, {
          severity: 'high',
          category: 'security',
          title: 'Payment amount not validated from user input',
          description: `${file.relativePath} accepts payment amounts from user input without apparent validation. Attackers could submit negative amounts (creating credits), zero amounts, or absurdly large amounts.`,
          file: file.relativePath,
          suggestion: 'Validate: amount must be a positive number, greater than minimum charge (e.g., $0.50 for Stripe), and less than a reasonable maximum.',
          fixable: true,
        });
      }
    }
  }

  _checkFinancialConsistency(state, content, file) {
    // Only check service and model files, not routes
    if (!file.relativePath.includes('service') && !file.relativePath.includes('model') && !file.relativePath.includes('controller')) return;

    // Double-entry bookkeeping check
    if (/ledger|journal|debit|credit/i.test(content)) {
      const hasBalanceCheck = /debit\s*===?\s*credit|balance.*===?\s*0|sum.*debit.*credit/i.test(content);
      if (!hasBalanceCheck) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'missing-feature',
          title: 'Financial ledger without balance verification',
          description: `${file.relativePath} handles ledger/journal entries but doesn't appear to verify that debits equal credits. Unbalanced entries indicate financial data corruption.`,
          file: file.relativePath,
          suggestion: 'Add assertion: total debits must equal total credits for each transaction. Run periodic reconciliation.',
          fixable: false,
        });
      }
    }

    // Settlement without reconciliation
    if (/settlement|settle/i.test(content)) {
      const hasReconciliation = /reconcil|verify|match|compare/i.test(content);
      if (!hasReconciliation) {
        this.addFinding(state, {
          severity: 'low',
          category: 'missing-feature',
          title: 'Payment settlement without reconciliation',
          description: `${file.relativePath} handles settlements but may not reconcile with the payment provider. Discrepancies between internal records and Stripe can go undetected.`,
          file: file.relativePath,
          suggestion: 'Implement daily reconciliation: compare internal payment records with Stripe balance transactions.',
          fixable: false,
        });
      }
    }
  }

  _checkIdempotency(state, content, file) {
    // Payment creation without idempotency key
    if (/\.create\s*\(|paymentIntent/i.test(content)) {
      const hasIdempotencyKey = /idempotency|idempotent|idempotencyKey|nonce/i.test(content);

      if (!hasIdempotencyKey && /pay|charge|stripe/i.test(file.name)) {
        this.addFinding(state, {
          severity: 'high',
          category: 'concurrency',
          title: 'Payment creation without idempotency key',
          description: `${file.relativePath} creates payments without an idempotency key. Network retries or user double-clicks can create duplicate charges.`,
          file: file.relativePath,
          suggestion: 'Pass idempotencyKey to Stripe API calls: stripe.paymentIntents.create({ ... }, { idempotencyKey: req.headers["idempotency-key"] })',
          fixable: true,
        });
      }
    }
  }

  _checkPartialPayments(state, content, file) {
    if (!/partial|split|installment/i.test(content) && /pay/i.test(file.name)) {
      // Check if partial payments are handled
      const hasPartialPayment = /partial|remaining|balance|outstanding|paid.*total|amount.*due/i.test(content);
      if (!hasPartialPayment && /pay/i.test(file.name)) {
        this.addFinding(state, {
          severity: 'low',
          category: 'missing-feature',
          title: 'Payment system may not support partial payments',
          description: `${file.relativePath} may not handle partial/split payments. Hotels commonly receive partial payments (advance, balance at checkout) and split payments (cash + card).`,
          file: file.relativePath,
          suggestion: 'Support partial payments: track totalAmount, paidAmount, and balanceDue. Allow multiple payment records per booking.',
          fixable: false,
        });
      }
    }
  }

  _checkCurrencyHandling(state, content, file) {
    if (!/currency|forex|exchange/i.test(content) && /pay|invoice|billing/i.test(file.name)) {
      // Check for hardcoded currency
      const hardcodedCurrency = /currency\s*[:=]\s*['"](?:INR|USD|EUR|GBP)['"]/g;
      if (hardcodedCurrency.test(content)) {
        this.addFinding(state, {
          severity: 'low',
          category: 'architecture',
          title: 'Hardcoded currency value',
          description: `${file.relativePath} has a hardcoded currency. For multi-property or international hotels, currency should be configurable per property.`,
          file: file.relativePath,
          suggestion: 'Store currency in hotel/property settings. Support multi-currency display for international guests.',
          fixable: true,
        });
      }
    }
  }
}
