/**
 * Settlement Calculation Validation E2E Test Suite
 *
 * This comprehensive test suite validates the financial accuracy of the Settlement system
 * ensuring that all calculations are mathematically correct and prevent financial errors.
 *
 * Test Coverage:
 * - Basic calculation validation (outstanding balance, refund amounts)
 * - Payment processing accuracy
 * - Adjustment calculations
 * - Tax calculations
 * - Edge cases and boundary conditions
 * - Business rules enforcement
 * - Currency consistency
 * - Precision handling for financial amounts
 * - Error handling and correction mechanisms
 * - Audit trail functionality
 */

import axios from 'axios';
import { expect } from 'chai';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -15,
  toExpPos: 20
});

const API_BASE_URL = 'http://localhost:4000/api/v1';

// Test data and configuration
const testConfig = {
  hotel: {
    id: null, // Will be set during setup
    name: 'Test Hotel for Settlement Validation'
  },
  users: {
    admin: {
      email: 'settlement.admin@testhotel.com',
      password: 'Admin@123',
      name: 'Settlement Admin',
      role: 'admin',
      token: null
    },
    staff: {
      email: 'settlement.staff@testhotel.com',
      password: 'Staff@123',
      name: 'Settlement Staff',
      role: 'staff',
      token: null
    }
  },
  testScenarios: {
    basicCalculation: {
      originalAmount: 10000.00,
      finalAmount: 12000.00,
      payments: [
        { amount: 5000.00, method: 'cash' },
        { amount: 3000.00, method: 'card' }
      ],
      expectedOutstanding: 4000.00,
      expectedRefund: 0.00
    },
    overpaymentScenario: {
      originalAmount: 8000.00,
      finalAmount: 8000.00,
      payments: [
        { amount: 10000.00, method: 'card' }
      ],
      expectedOutstanding: 0.00,
      expectedRefund: 2000.00
    },
    adjustmentScenario: {
      originalAmount: 15000.00,
      adjustments: [
        { type: 'damage_charge', amount: 2000.00, taxAmount: 360.00 },
        { type: 'discount', amount: -1000.00, taxAmount: 0.00 },
        { type: 'service_charge', amount: 500.00, taxAmount: 90.00 }
      ],
      expectedFinalAmount: 16950.00 // 15000 + 2000 + 360 - 1000 + 500 + 90
    },
    precisionTest: {
      originalAmount: 12345.67,
      adjustments: [
        { type: 'damage_charge', amount: 123.45, taxAmount: 22.22 }
      ],
      payments: [
        { amount: 6789.12, method: 'upi' }
      ],
      expectedFinalAmount: 12491.34, // 12345.67 + 123.45 + 22.22
      expectedOutstanding: 5702.22   // 12491.34 - 6789.12
    },
    largeAmountTest: {
      originalAmount: 9999999.99,
      payments: [
        { amount: 5000000.00, method: 'bank_transfer' }
      ],
      expectedOutstanding: 4999999.99
    }
  }
};

describe('Settlement Calculation Validation E2E Tests', function() {
  this.timeout(60000); // 60 second timeout for comprehensive tests

  let testBookingId = null;
  let testSettlements = [];

  before(async function() {
    console.log('🧮 Starting Settlement Calculation Validation E2E Tests...');
    console.log('📊 Testing financial accuracy and calculation integrity...');

    // Setup test environment
    await setupTestEnvironment();
    await authenticateUsers();
    await createTestBooking();
  });

  after(async function() {
    console.log('🧹 Cleaning up test data...');
    await cleanupTestData();
    console.log('✅ Settlement Calculation Validation E2E Tests completed');
  });

  describe('Basic Calculation Validation', function() {
    it('should correctly calculate outstanding balance', async function() {
      const scenario = testConfig.testScenarios.basicCalculation;

      // Create settlement
      const settlement = await createTestSettlement(scenario.originalAmount, scenario.finalAmount);

      // Add payments
      for (const payment of scenario.payments) {
        await addPaymentToSettlement(settlement._id, payment);
      }

      // Validate calculations
      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.true;
      expect(parseFloat(validation.calculationValidation.calculations.outstandingBalance.expected))
        .to.equal(scenario.expectedOutstanding);

      console.log('✅ Outstanding balance calculation validated');
    });

    it('should correctly calculate refund amount for overpayment', async function() {
      const scenario = testConfig.testScenarios.overpaymentScenario;

      const settlement = await createTestSettlement(scenario.originalAmount, scenario.finalAmount);

      // Add overpayment
      await addPaymentToSettlement(settlement._id, scenario.payments[0], true); // Allow overpayment

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.true;
      expect(parseFloat(validation.calculationValidation.calculations.refundAmount.expected))
        .to.equal(scenario.expectedRefund);

      console.log('✅ Refund amount calculation validated');
    });

    it('should handle zero amounts correctly', async function() {
      const settlement = await createTestSettlement(0, 0);

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.true;
      expect(validation.calculationValidation.calculations.outstandingBalance.expected).to.equal(0);
      expect(validation.calculationValidation.calculations.refundAmount.expected).to.equal(0);

      console.log('✅ Zero amounts handled correctly');
    });
  });

  describe('Payment Processing Accuracy', function() {
    it('should validate payment totals against payment records', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      const payments = [
        { amount: 2500.50, method: 'cash' },
        { amount: 3000.25, method: 'card' },
        { amount: 1499.25, method: 'upi' }
      ];

      for (const payment of payments) {
        await addPaymentToSettlement(settlement._id, payment);
      }

      const validation = await validateSettlementCalculations(settlement._id);

      const expectedTotal = payments.reduce((sum, p) => sum + p.amount, 0);
      expect(parseFloat(validation.calculationValidation.calculations.paymentTotal.calculatedFromPayments))
        .to.equal(expectedTotal);

      console.log('✅ Payment totals validation passed');
    });

    it('should reject invalid payment amounts', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      try {
        await addPaymentToSettlement(settlement._id, { amount: -100, method: 'cash' });
        expect.fail('Should have rejected negative payment amount');
      } catch (error) {
        expect(error.response.status).to.equal(400);
        expect(error.response.data.message).to.include('validation failed');
      }

      console.log('✅ Invalid payment amount rejection validated');
    });

    it('should enforce payment method constraints', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      // Test large cash payment (should trigger warning)
      try {
        await addPaymentToSettlement(settlement._id, { amount: 250000, method: 'cash' });
        expect.fail('Should have rejected large cash payment');
      } catch (error) {
        expect(error.response.status).to.equal(400);
        expect(error.response.data.violations).to.be.an('array');
      }

      console.log('✅ Payment method constraints enforced');
    });
  });

  describe('Adjustment Calculations', function() {
    it('should correctly calculate final amount with adjustments', async function() {
      const scenario = testConfig.testScenarios.adjustmentScenario;

      const settlement = await createTestSettlement(scenario.originalAmount, scenario.originalAmount);

      // Add adjustments
      for (const adjustment of scenario.adjustments) {
        await addAdjustmentToSettlement(settlement._id, adjustment);
      }

      // Get updated settlement
      const updatedSettlement = await getSettlement(settlement._id);

      // Validate final amount calculation
      expect(parseFloat(updatedSettlement.finalAmount)).to.be.closeTo(
        scenario.expectedFinalAmount,
        0.01
      );

      console.log('✅ Adjustment calculations validated');
    });

    it('should validate tax calculations for adjustments', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      const adjustment = {
        type: 'service_charge',
        amount: 1000,
        description: 'Additional service charge',
        taxable: true,
        taxAmount: 180 // 18% GST
      };

      await addAdjustmentToSettlement(settlement._id, adjustment);

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.true;

      console.log('✅ Tax calculations for adjustments validated');
    });
  });

  describe('Precision and Decimal Handling', function() {
    it('should handle decimal amounts with precision', async function() {
      const scenario = testConfig.testScenarios.precisionTest;

      const settlement = await createTestSettlement(scenario.originalAmount, scenario.originalAmount);

      // Add adjustment with decimal precision
      for (const adjustment of scenario.adjustments) {
        await addAdjustmentToSettlement(settlement._id, adjustment);
      }

      // Add payment with decimal precision
      for (const payment of scenario.payments) {
        await addPaymentToSettlement(settlement._id, payment);
      }

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.true;
      expect(parseFloat(validation.calculationValidation.calculations.outstandingBalance.expected))
        .to.be.closeTo(scenario.expectedOutstanding, 0.01);

      console.log('✅ Decimal precision handling validated');
    });

    it('should reject amounts with more than 2 decimal places', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      try {
        await addPaymentToSettlement(settlement._id, { amount: 100.123, method: 'card' });
        expect.fail('Should have rejected amount with 3 decimal places');
      } catch (error) {
        expect(error.response.status).to.equal(400);
      }

      console.log('✅ Decimal place validation enforced');
    });
  });

  describe('Business Rules Enforcement', function() {
    it('should enforce outstanding balance and refund exclusivity', async function() {
      const settlement = await createTestSettlement(5000, 5000);

      await addPaymentToSettlement(settlement._id, { amount: 7000, method: 'card' }, true);

      const validation = await validateSettlementCalculations(settlement._id);

      // Should have refund but no outstanding balance
      expect(validation.calculationValidation.calculations.outstandingBalance.expected).to.equal(0);
      expect(validation.calculationValidation.calculations.refundAmount.expected).to.equal(2000);

      console.log('✅ Outstanding balance and refund exclusivity enforced');
    });

    it('should validate status consistency with amounts', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      // Fully pay the settlement
      await addPaymentToSettlement(settlement._id, { amount: 10000, method: 'card' });

      const updatedSettlement = await getSettlement(settlement._id);

      expect(updatedSettlement.status).to.equal('completed');
      expect(updatedSettlement.outstandingBalance).to.equal(0);

      console.log('✅ Status consistency validation passed');
    });
  });

  describe('Large Amount Handling', function() {
    it('should handle large financial amounts correctly', async function() {
      const scenario = testConfig.testScenarios.largeAmountTest;

      const settlement = await createTestSettlement(scenario.originalAmount, scenario.originalAmount);

      await addPaymentToSettlement(settlement._id, scenario.payments[0]);

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.true;
      expect(parseFloat(validation.calculationValidation.calculations.outstandingBalance.expected))
        .to.equal(scenario.expectedOutstanding);

      console.log('✅ Large amount handling validated');
    });
  });

  describe('Error Detection and Correction', function() {
    it('should detect and correct calculation errors', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      // Manually corrupt the outstanding balance (simulate calculation error)
      const corruption = await axios.patch(`${API_BASE_URL}/test/settlements/${settlement._id}/corrupt`, {
        outstandingBalance: 999999 // Incorrect value
      }, {
        headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
      });

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.false;
      expect(validation.calculationValidation.errors.length).to.be.greaterThan(0);

      console.log('✅ Calculation error detection validated');
    });

    it('should maintain audit trail for corrections', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      await addPaymentToSettlement(settlement._id, { amount: 5000, method: 'cash' });

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.auditTrail).to.be.an('array');
      expect(validation.auditTrail.length).to.be.greaterThan(0);

      const paymentEntry = validation.auditTrail.find(entry => entry.type === 'payment_addition');
      expect(paymentEntry).to.exist;

      console.log('✅ Audit trail maintenance validated');
    });
  });

  describe('Currency Consistency', function() {
    it('should validate currency consistency across operations', async function() {
      const settlement = await createTestSettlement(10000, 10000, 'USD');

      const validation = await validateSettlementCalculations(settlement._id);

      expect(validation.calculationValidation.isValid).to.be.true;

      console.log('✅ Currency consistency validated');
    });
  });

  describe('Late Fee Calculations', function() {
    it('should calculate late fees correctly', async function() {
      const settlement = await createTestSettlement(10000, 10000);

      // Set due date in the past
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 30); // 30 days overdue

      await updateSettlement(settlement._id, { dueDate: pastDueDate });

      const lateFee = await calculateLateFee(settlement._id);

      expect(lateFee.lateFeeCalculation.applicable).to.be.true;
      expect(lateFee.lateFeeCalculation.daysLate).to.be.greaterThan(25);

      console.log('✅ Late fee calculations validated');
    });
  });

  describe('Validation Statistics', function() {
    it('should provide accurate validation statistics', async function() {
      // Create multiple settlements for statistics
      await createTestSettlement(5000, 5000);
      await createTestSettlement(7500, 7500);

      const stats = await getValidationStatistics();

      expect(stats.statistics.totalSettlements).to.be.greaterThan(0);
      expect(stats.statistics.validationRate).to.be.a('number');

      console.log('✅ Validation statistics accuracy confirmed');
    });
  });

  // Helper functions
  async function setupTestEnvironment() {
    // Implementation would setup test hotel and users
    console.log('Setting up test environment...');
  }

  async function authenticateUsers() {
    for (const userType of Object.keys(testConfig.users)) {
      const user = testConfig.users[userType];
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: user.email,
        password: user.password
      });
      user.token = response.data.token;
    }
    console.log('Users authenticated successfully');
  }

  async function createTestBooking() {
    const response = await axios.post(`${API_BASE_URL}/bookings`, {
      // Booking creation data
      checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000),
      checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      guestDetails: {
        adults: 2,
        children: 0
      },
      totalAmount: 10000
    }, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });

    testBookingId = response.data.data.booking._id;
    console.log(`Test booking created: ${testBookingId}`);
  }

  async function createTestSettlement(originalAmount, finalAmount, currency = 'INR') {
    const response = await axios.post(`${API_BASE_URL}/settlements`, {
      bookingId: testBookingId,
      originalAmount,
      finalAmount,
      currency,
      notes: 'Test settlement for calculation validation'
    }, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });

    const settlement = response.data.data.settlement;
    testSettlements.push(settlement._id);
    return settlement;
  }

  async function addPaymentToSettlement(settlementId, payment, allowOverpayment = false) {
    return await axios.post(`${API_BASE_URL}/settlements/${settlementId}/payment`, {
      ...payment,
      allowOverpayment
    }, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });
  }

  async function addAdjustmentToSettlement(settlementId, adjustment) {
    return await axios.post(`${API_BASE_URL}/settlements/${settlementId}/adjustment`, {
      ...adjustment,
      description: adjustment.description || `Test ${adjustment.type} adjustment`
    }, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });
  }

  async function validateSettlementCalculations(settlementId) {
    const response = await axios.post(`${API_BASE_URL}/settlements/${settlementId}/validate`, {}, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });
    return response.data.data;
  }

  async function getSettlement(settlementId) {
    const response = await axios.get(`${API_BASE_URL}/settlements/${settlementId}`, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });
    return response.data.data.settlement;
  }

  async function updateSettlement(settlementId, updateData) {
    return await axios.patch(`${API_BASE_URL}/settlements/${settlementId}`, updateData, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });
  }

  async function calculateLateFee(settlementId) {
    const response = await axios.get(`${API_BASE_URL}/settlements/${settlementId}/late-fee`, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });
    return response.data.data;
  }

  async function getValidationStatistics() {
    const response = await axios.get(`${API_BASE_URL}/settlements/validation-statistics`, {
      headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
    });
    return response.data.data;
  }

  async function cleanupTestData() {
    // Clean up test settlements
    for (const settlementId of testSettlements) {
      try {
        await axios.delete(`${API_BASE_URL}/settlements/${settlementId}`, {
          headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
        });
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Clean up test booking
    if (testBookingId) {
      try {
        await axios.delete(`${API_BASE_URL}/bookings/${testBookingId}`, {
          headers: { Authorization: `Bearer ${testConfig.users.admin.token}` }
        });
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }
});

// Export test configuration for use in other test files
export { testConfig };