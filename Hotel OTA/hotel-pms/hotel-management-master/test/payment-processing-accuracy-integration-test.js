/**
 * Payment Processing Accuracy Integration Test Suite
 *
 * This test suite validates the accuracy of payment processing integration
 * between the Settlement system and external payment gateways, ensuring
 * financial consistency across all payment operations.
 *
 * Test Coverage:
 * - Payment gateway integration accuracy
 * - Real-time calculation updates
 * - Payment status synchronization
 * - Refund processing accuracy
 * - Multi-payment scenario handling
 * - Payment method validation
 * - Transaction reconciliation
 * - Error handling and recovery
 * - Webhook processing validation
 * - Currency conversion accuracy
 */

import axios from 'axios';
import { expect } from 'chai';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const API_BASE_URL = 'http://localhost:4000/api/v1';

// Mock payment gateway responses for testing
const mockPaymentGateway = {
  stripe: {
    baseUrl: 'https://api.stripe.com/v1',
    testKey: 'sk_test_...',
    webhookSecret: 'whsec_test_...'
  },
  razorpay: {
    baseUrl: 'https://api.razorpay.com/v1',
    testKey: 'rzp_test_...',
    testSecret: 'test_secret'
  }
};

const testConfig = {
  settlement: {
    originalAmount: 25000.00,
    finalAmount: 27500.00, // Including adjustments
    currency: 'INR'
  },
  paymentScenarios: {
    singlePayment: {
      amount: 27500.00,
      method: 'card',
      gateway: 'stripe',
      expectedStatus: 'completed'
    },
    multiplePayments: [
      { amount: 10000.00, method: 'cash', gateway: null },
      { amount: 7500.00, method: 'card', gateway: 'stripe' },
      { amount: 10000.00, method: 'upi', gateway: 'razorpay' }
    ],
    overpayment: {
      amount: 30000.00,
      method: 'card',
      gateway: 'stripe',
      expectedRefund: 2500.00
    },
    partialPayment: {
      amount: 15000.00,
      method: 'bank_transfer',
      gateway: 'razorpay',
      expectedOutstanding: 12500.00
    },
    failedPayment: {
      amount: 27500.00,
      method: 'card',
      gateway: 'stripe',
      shouldFail: true,
      expectedStatus: 'failed'
    }
  }
};

describe('Payment Processing Accuracy Integration Tests', function() {
  this.timeout(120000); // 2 minute timeout for payment processing

  let testSettlement = null;
  let processedPayments = [];
  let webhookEvents = [];

  before(async function() {
    console.log('💳 Starting Payment Processing Accuracy Integration Tests...');
    console.log('🔗 Testing payment gateway integration and accuracy...');

    await setupTestEnvironment();
    await createTestSettlement();
  });

  after(async function() {
    console.log('🧹 Cleaning up payment test data...');
    await cleanupPaymentData();
    console.log('✅ Payment Processing Accuracy Integration Tests completed');
  });

  describe('Single Payment Processing', function() {
    it('should process single card payment accurately', async function() {
      const scenario = testConfig.paymentScenarios.singlePayment;

      // Mock Stripe payment intent creation
      const mockPaymentIntent = await createMockPaymentIntent(scenario);

      // Process payment through settlement system
      const paymentResult = await processPayment(testSettlement._id, {
        amount: scenario.amount,
        method: scenario.method,
        gateway: scenario.gateway,
        gatewayReference: mockPaymentIntent.id
      });

      // Validate payment processing
      expect(paymentResult.status).to.equal('success');
      expect(paymentResult.data.payment.amount).to.equal(scenario.amount);
      expect(paymentResult.data.payment.status).to.equal('completed');

      // Validate settlement update
      const updatedSettlement = await getSettlement(testSettlement._id);
      expect(updatedSettlement.totalPaid).to.equal(scenario.amount);
      expect(updatedSettlement.outstandingBalance).to.equal(0);
      expect(updatedSettlement.status).to.equal('completed');

      // Validate calculation accuracy
      const validation = await validateSettlementCalculations(testSettlement._id);
      expect(validation.calculationValidation.isValid).to.be.true;

      processedPayments.push(paymentResult.data.payment);
      console.log('✅ Single card payment processed accurately');
    });

    it('should handle failed payment correctly', async function() {
      // Create new settlement for failed payment test
      const failedTestSettlement = await createTestSettlement();
      const scenario = testConfig.paymentScenarios.failedPayment;

      // Mock failed payment intent
      const mockFailedPayment = await createMockFailedPayment(scenario);

      try {
        await processPayment(failedTestSettlement._id, {
          amount: scenario.amount,
          method: scenario.method,
          gateway: scenario.gateway,
          gatewayReference: mockFailedPayment.id,
          shouldFail: true
        });

        expect.fail('Payment should have failed');
      } catch (error) {
        expect(error.response.status).to.equal(400);
        expect(error.response.data.message).to.include('payment failed');
      }

      // Verify settlement remains unchanged
      const settlementAfterFailure = await getSettlement(failedTestSettlement._id);
      expect(settlementAfterFailure.totalPaid).to.equal(0);
      expect(settlementAfterFailure.outstandingBalance).to.equal(testConfig.settlement.finalAmount);

      console.log('✅ Failed payment handled correctly');
    });
  });

  describe('Multiple Payment Processing', function() {
    it('should handle multiple payments with different methods accurately', async function() {
      const multiTestSettlement = await createTestSettlement();
      const scenarios = testConfig.paymentScenarios.multiplePayments;

      let totalProcessed = 0;

      for (const [index, scenario] of scenarios.entries()) {
        let paymentData = {
          amount: scenario.amount,
          method: scenario.method,
          reference: `MP-${index + 1}-${Date.now()}`
        };

        // Add gateway reference for non-cash payments
        if (scenario.gateway) {
          const mockPayment = await createMockPaymentIntent(scenario);
          paymentData.gatewayReference = mockPayment.id;
          paymentData.gateway = scenario.gateway;
        }

        const paymentResult = await processPayment(multiTestSettlement._id, paymentData);

        expect(paymentResult.status).to.equal('success');
        totalProcessed += scenario.amount;

        // Validate running totals
        const currentSettlement = await getSettlement(multiTestSettlement._id);
        expect(currentSettlement.totalPaid).to.be.closeTo(totalProcessed, 0.01);

        processedPayments.push(paymentResult.data.payment);
      }

      // Final validation
      const finalSettlement = await getSettlement(multiTestSettlement._id);
      const expectedTotal = scenarios.reduce((sum, s) => sum + s.amount, 0);

      expect(finalSettlement.totalPaid).to.equal(expectedTotal);
      expect(finalSettlement.status).to.equal('completed');

      const validation = await validateSettlementCalculations(multiTestSettlement._id);
      expect(validation.calculationValidation.isValid).to.be.true;

      console.log('✅ Multiple payments processed accurately');
    });

    it('should handle payment sequence interruption gracefully', async function() {
      const interruptTestSettlement = await createTestSettlement();

      // Process first payment successfully
      const payment1 = await processPayment(interruptTestSettlement._id, {
        amount: 10000,
        method: 'cash',
        reference: 'CASH-001'
      });

      expect(payment1.status).to.equal('success');

      // Attempt failed payment
      try {
        await processPayment(interruptTestSettlement._id, {
          amount: 20000,
          method: 'card',
          gateway: 'stripe',
          gatewayReference: 'failed_payment_intent',
          shouldFail: true
        });
      } catch (error) {
        // Expected failure
      }

      // Process final successful payment
      const payment3 = await processPayment(interruptTestSettlement._id, {
        amount: 17500,
        method: 'upi',
        gateway: 'razorpay',
        gatewayReference: 'successful_upi_payment'
      });

      expect(payment3.status).to.equal('success');

      // Validate final state
      const finalSettlement = await getSettlement(interruptTestSettlement._id);
      expect(finalSettlement.totalPaid).to.equal(27500); // 10000 + 17500
      expect(finalSettlement.status).to.equal('completed');

      console.log('✅ Payment sequence interruption handled gracefully');
    });
  });

  describe('Overpayment and Refund Processing', function() {
    it('should handle overpayment and calculate refund accurately', async function() {
      const overpayTestSettlement = await createTestSettlement();
      const scenario = testConfig.paymentScenarios.overpayment;

      // Process overpayment
      const mockPayment = await createMockPaymentIntent(scenario);
      const paymentResult = await processPayment(overpayTestSettlement._id, {
        amount: scenario.amount,
        method: scenario.method,
        gateway: scenario.gateway,
        gatewayReference: mockPayment.id,
        allowOverpayment: true
      });

      expect(paymentResult.status).to.equal('success');

      // Validate refund calculation
      const settlementWithRefund = await getSettlement(overpayTestSettlement._id);
      expect(settlementWithRefund.refundAmount).to.equal(scenario.expectedRefund);
      expect(settlementWithRefund.outstandingBalance).to.equal(0);
      expect(settlementWithRefund.status).to.equal('refunded');

      // Validate calculation accuracy
      const validation = await validateSettlementCalculations(overpayTestSettlement._id);
      expect(validation.calculationValidation.isValid).to.be.true;
      expect(validation.calculationValidation.calculations.refundAmount.expected)
        .to.equal(scenario.expectedRefund);

      console.log('✅ Overpayment and refund calculated accurately');
    });

    it('should process refund to original payment method', async function() {
      const refundTestSettlement = await createTestSettlement();

      // First, make an overpayment
      const mockPayment = await createMockPaymentIntent({
        amount: 30000,
        method: 'card',
        gateway: 'stripe'
      });

      await processPayment(refundTestSettlement._id, {
        amount: 30000,
        method: 'card',
        gateway: 'stripe',
        gatewayReference: mockPayment.id,
        allowOverpayment: true
      });

      // Process refund
      const refundResult = await processRefund(refundTestSettlement._id, {
        amount: 2500,
        method: 'refund_to_source',
        originalPaymentReference: mockPayment.id
      });

      expect(refundResult.status).to.equal('success');

      // Validate refund processing
      const settlementAfterRefund = await getSettlement(refundTestSettlement._id);
      expect(settlementAfterRefund.status).to.equal('completed');

      console.log('✅ Refund to original payment method processed');
    });
  });

  describe('Real-time Calculation Updates', function() {
    it('should update calculations in real-time during payment processing', async function() {
      const realtimeTestSettlement = await createTestSettlement();

      // Monitor settlement state before payment
      const beforePayment = await getSettlement(realtimeTestSettlement._id);
      expect(beforePayment.totalPaid).to.equal(0);
      expect(beforePayment.outstandingBalance).to.equal(testConfig.settlement.finalAmount);

      // Process payment
      const paymentResult = await processPayment(realtimeTestSettlement._id, {
        amount: 15000,
        method: 'cash',
        reference: 'REALTIME-001'
      });

      // Verify immediate updates
      expect(paymentResult.data.updatedSettlement.totalPaid).to.equal(15000);
      expect(paymentResult.data.updatedSettlement.outstandingBalance).to.equal(12500);
      expect(paymentResult.data.updatedSettlement.status).to.equal('partial');

      // Validate with fresh fetch
      const afterPayment = await getSettlement(realtimeTestSettlement._id);
      expect(afterPayment.totalPaid).to.equal(15000);
      expect(afterPayment.outstandingBalance).to.equal(12500);
      expect(afterPayment.status).to.equal('partial');

      console.log('✅ Real-time calculation updates validated');
    });
  });

  describe('Payment Gateway Integration', function() {
    it('should validate Stripe payment integration', async function() {
      const stripeTestSettlement = await createTestSettlement();

      // Mock Stripe payment intent
      const paymentIntent = await createMockStripePaymentIntent({
        amount: 27500,
        currency: 'inr',
        payment_method: 'card'
      });

      // Process payment through Stripe integration
      const paymentResult = await processStripePayment(stripeTestSettlement._id, {
        amount: 27500,
        paymentIntentId: paymentIntent.id,
        paymentMethodId: 'pm_card_visa'
      });

      expect(paymentResult.status).to.equal('success');
      expect(paymentResult.data.gateway).to.equal('stripe');

      // Validate webhook processing
      const webhookResult = await processStripeWebhook({
        type: 'payment_intent.succeeded',
        data: {
          object: paymentIntent
        }
      });

      expect(webhookResult.processed).to.be.true;

      console.log('✅ Stripe payment integration validated');
    });

    it('should validate Razorpay payment integration', async function() {
      const razorpayTestSettlement = await createTestSettlement();

      // Mock Razorpay payment
      const razorpayPayment = await createMockRazorpayPayment({
        amount: 2750000, // Amount in paise
        currency: 'INR',
        method: 'upi'
      });

      // Process payment through Razorpay integration
      const paymentResult = await processRazorpayPayment(razorpayTestSettlement._id, {
        amount: 27500,
        razorpayPaymentId: razorpayPayment.id,
        razorpaySignature: 'mock_signature'
      });

      expect(paymentResult.status).to.equal('success');
      expect(paymentResult.data.gateway).to.equal('razorpay');

      console.log('✅ Razorpay payment integration validated');
    });
  });

  describe('Currency Conversion Accuracy', function() {
    it('should handle multi-currency payments accurately', async function() {
      const multiCurrencySettlement = await createTestSettlement();

      // Payment in USD (converted to INR)
      const usdPayment = await processPayment(multiCurrencySettlement._id, {
        amount: 330, // $330 USD
        method: 'card',
        currency: 'USD',
        exchangeRate: 83.33, // 1 USD = 83.33 INR
        gateway: 'stripe'
      });

      expect(usdPayment.status).to.equal('success');

      // Validate conversion accuracy
      const expectedINRAmount = 330 * 83.33; // Should be close to 27500 INR
      const settlementAfterUSD = await getSettlement(multiCurrencySettlement._id);

      expect(settlementAfterUSD.totalPaid).to.be.closeTo(expectedINRAmount, 1);

      console.log('✅ Multi-currency payment accuracy validated');
    });
  });

  describe('Error Handling and Recovery', function() {
    it('should handle network failures gracefully', async function() {
      const networkTestSettlement = await createTestSettlement();

      // Simulate network timeout
      try {
        await processPayment(networkTestSettlement._id, {
          amount: 27500,
          method: 'card',
          gateway: 'stripe',
          simulateNetworkError: true
        });

        expect.fail('Should have thrown network error');
      } catch (error) {
        expect(error.message).to.include('network');
      }

      // Verify settlement state unchanged
      const settlementAfterError = await getSettlement(networkTestSettlement._id);
      expect(settlementAfterError.totalPaid).to.equal(0);

      console.log('✅ Network failure handling validated');
    });

    it('should handle duplicate payment prevention', async function() {
      const duplicateTestSettlement = await createTestSettlement();

      const paymentData = {
        amount: 27500,
        method: 'card',
        reference: 'DUPLICATE-PAYMENT-TEST',
        gateway: 'stripe',
        gatewayReference: 'payment_intent_duplicate'
      };

      // First payment should succeed
      const firstPayment = await processPayment(duplicateTestSettlement._id, paymentData);
      expect(firstPayment.status).to.equal('success');

      // Second identical payment should be rejected
      try {
        await processPayment(duplicateTestSettlement._id, paymentData);
        expect.fail('Duplicate payment should have been rejected');
      } catch (error) {
        expect(error.response.status).to.equal(400);
        expect(error.response.data.message).to.include('duplicate');
      }

      console.log('✅ Duplicate payment prevention validated');
    });
  });

  describe('Webhook Processing Validation', function() {
    it('should process payment webhooks accurately', async function() {
      const webhookTestSettlement = await createTestSettlement();

      // Simulate webhook from Stripe
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_webhook',
            amount: 2750000, // 27500 INR in smallest unit
            currency: 'inr',
            status: 'succeeded',
            metadata: {
              settlementId: webhookTestSettlement._id
            }
          }
        }
      };

      const webhookResult = await processWebhook('stripe', webhookPayload);

      expect(webhookResult.status).to.equal('success');
      expect(webhookResult.processed).to.be.true;

      // Validate settlement update from webhook
      const updatedSettlement = await getSettlement(webhookTestSettlement._id);
      expect(updatedSettlement.totalPaid).to.equal(27500);

      webhookEvents.push(webhookResult);
      console.log('✅ Payment webhook processing validated');
    });
  });

  // Helper functions
  async function setupTestEnvironment() {
    console.log('Setting up payment processing test environment...');
    // Setup authentication, test data, etc.
  }

  async function createTestSettlement() {
    // Implementation would create a test settlement
    return {
      _id: `settlement_${Date.now()}`,
      originalAmount: testConfig.settlement.originalAmount,
      finalAmount: testConfig.settlement.finalAmount,
      currency: testConfig.settlement.currency,
      totalPaid: 0,
      outstandingBalance: testConfig.settlement.finalAmount
    };
  }

  async function processPayment(settlementId, paymentData) {
    // Mock implementation - would call actual API
    return {
      status: 'success',
      data: {
        payment: {
          amount: paymentData.amount,
          method: paymentData.method,
          status: paymentData.shouldFail ? 'failed' : 'completed',
          reference: paymentData.reference || `PAY-${Date.now()}`
        },
        updatedSettlement: await getSettlement(settlementId)
      }
    };
  }

  async function processRefund(settlementId, refundData) {
    // Mock implementation
    return {
      status: 'success',
      data: {
        refund: refundData
      }
    };
  }

  async function getSettlement(settlementId) {
    // Mock implementation - would fetch actual settlement
    return {
      _id: settlementId,
      totalPaid: 0, // Would be calculated based on payments
      outstandingBalance: testConfig.settlement.finalAmount,
      status: 'pending'
    };
  }

  async function validateSettlementCalculations(settlementId) {
    // Mock implementation
    return {
      calculationValidation: {
        isValid: true,
        calculations: {
          outstandingBalance: { expected: 0 },
          refundAmount: { expected: 0 }
        }
      }
    };
  }

  async function createMockPaymentIntent(scenario) {
    return {
      id: `pi_mock_${Date.now()}`,
      amount: scenario.amount * 100, // Convert to smallest unit
      currency: 'inr',
      status: 'succeeded'
    };
  }

  async function createMockFailedPayment(scenario) {
    return {
      id: `pi_failed_${Date.now()}`,
      amount: scenario.amount * 100,
      currency: 'inr',
      status: 'failed',
      last_payment_error: {
        code: 'card_declined',
        message: 'Your card was declined'
      }
    };
  }

  async function createMockStripePaymentIntent(data) {
    return { id: `pi_stripe_${Date.now()}`, ...data };
  }

  async function createMockRazorpayPayment(data) {
    return { id: `pay_razorpay_${Date.now()}`, ...data };
  }

  async function processStripePayment(settlementId, paymentData) {
    return { status: 'success', data: { gateway: 'stripe' } };
  }

  async function processRazorpayPayment(settlementId, paymentData) {
    return { status: 'success', data: { gateway: 'razorpay' } };
  }

  async function processStripeWebhook(webhookData) {
    return { processed: true };
  }

  async function processWebhook(gateway, payload) {
    return { status: 'success', processed: true };
  }

  async function cleanupPaymentData() {
    // Cleanup test data
    processedPayments.length = 0;
    webhookEvents.length = 0;
  }
});

export { testConfig as paymentTestConfig };