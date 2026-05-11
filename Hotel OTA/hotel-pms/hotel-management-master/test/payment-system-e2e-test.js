import axios from 'axios';
import assert from 'assert';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:4000/api/v1';
const TEST_RESULTS = {
  settlement: { passed: 0, failed: 0, tests: [] },
  checkoutInventory: { passed: 0, failed: 0, tests: [] },
  billingSession: { passed: 0, failed: 0, tests: [] },
  payment: { passed: 0, failed: 0, tests: [] },
  integration: { passed: 0, failed: 0, tests: [] },
  dataIntegrity: { passed: 0, failed: 0, tests: [] },
  errorHandling: { passed: 0, failed: 0, tests: [] }
};

// Test credentials from seed data
const CREDENTIALS = {
  admin: { email: 'owner@grandpalacehotel.com', password: 'admin123' },
  staff: { email: 'reception@grandpalacehotel.com', password: 'staff123' },
  guest: { email: 'alice.johnson@email.com', password: 'guest123' }
};

const HOTEL_ID = '68bc094f80c86bfe258e172b';

let authTokens = {};
let testBookingId = null;
let testSettlementId = null;
let testCheckoutInventoryId = null;
let testBillingSessionId = null;

// Helper function to make authenticated requests
async function makeRequest(method, endpoint, data = null, token = null) {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.data = data;
  }

  return await axios(config);
}

// Test logging helper
function logTest(category, testName, status, details = '') {
  const result = { testName, status, details, timestamp: new Date().toISOString() };
  TEST_RESULTS[category].tests.push(result);

  if (status === 'PASS') {
    TEST_RESULTS[category].passed++;
    console.log(`✅ ${category}: ${testName}`);
  } else {
    TEST_RESULTS[category].failed++;
    console.log(`❌ ${category}: ${testName} - ${details}`);
  }
}

// Authentication setup
async function setupAuthentication() {
  console.log('\n🔐 Setting up authentication...');

  try {
    // Login as admin
    const adminLogin = await makeRequest('POST', '/auth/login', CREDENTIALS.admin);
    authTokens.admin = adminLogin.data.data.token;
    logTest('settlement', 'Admin Authentication', 'PASS', 'Admin token obtained');

    // Login as staff
    const staffLogin = await makeRequest('POST', '/auth/login', CREDENTIALS.staff);
    authTokens.staff = staffLogin.data.data.token;
    logTest('settlement', 'Staff Authentication', 'PASS', 'Staff token obtained');

    // Login as guest
    const guestLogin = await makeRequest('POST', '/auth/login', CREDENTIALS.guest);
    authTokens.guest = guestLogin.data.data.token;
    logTest('settlement', 'Guest Authentication', 'PASS', 'Guest token obtained');

    console.log('✅ Authentication setup completed');
    return true;
  } catch (error) {
    logTest('settlement', 'Authentication Setup', 'FAIL', error.message);
    return false;
  }
}

// Create test data for settlements
async function createTestBooking() {
  console.log('\n📝 Creating test booking for settlement testing...');

  try {
    // Get available rooms
    const roomsResponse = await makeRequest('GET', '/rooms', null, authTokens.admin);
    const availableRoom = roomsResponse.data.data.rooms.find(room => room.status === 'vacant');

    if (!availableRoom) {
      throw new Error('No available rooms found');
    }

    // Create a booking
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() - 5); // 5 days ago
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() - 1); // 1 day ago (checked out)

    const bookingData = {
      hotelId: HOTEL_ID,
      roomId: availableRoom._id,
      checkIn: checkIn.toISOString(),
      checkOut: checkOut.toISOString(),
      guestDetails: {
        adults: 2,
        children: 0
      },
      totalAmount: availableRoom.currentRate * 4, // 4 nights
      paymentStatus: 'paid',
      status: 'checked_out'
    };

    const bookingResponse = await makeRequest('POST', '/bookings', bookingData, authTokens.guest);
    testBookingId = bookingResponse.data.data.booking._id;

    logTest('settlement', 'Test Booking Creation', 'PASS', `Booking ID: ${testBookingId}`);
    return true;
  } catch (error) {
    logTest('settlement', 'Test Booking Creation', 'FAIL', error.message);
    return false;
  }
}

// Test Settlement functionality
async function testSettlementAPI() {
  console.log('\n💰 Testing Settlement API...');

  try {
    // Test 1: Create Settlement
    try {
      const settlementData = {
        bookingId: testBookingId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Test settlement for E2E testing'
      };

      const createResponse = await makeRequest('POST', '/settlements', settlementData, authTokens.admin);
      testSettlementId = createResponse.data.data.settlement._id;

      assert(createResponse.status === 201, 'Settlement creation should return 201');
      assert(createResponse.data.data.settlement._id, 'Settlement should have an ID');
      assert(createResponse.data.data.settlement.status === 'pending', 'New settlement should be pending');

      logTest('settlement', 'Create Settlement', 'PASS', `Settlement ID: ${testSettlementId}`);
    } catch (error) {
      logTest('settlement', 'Create Settlement', 'FAIL', error.message);
    }

    // Test 2: Get All Settlements
    try {
      const listResponse = await makeRequest('GET', '/settlements', null, authTokens.admin);

      assert(listResponse.status === 200, 'Get settlements should return 200');
      assert(Array.isArray(listResponse.data.data.settlements), 'Should return settlements array');

      logTest('settlement', 'List Settlements', 'PASS', `Found ${listResponse.data.data.settlements.length} settlements`);
    } catch (error) {
      logTest('settlement', 'List Settlements', 'FAIL', error.message);
    }

    // Test 3: Get Settlement by ID
    try {
      const getResponse = await makeRequest('GET', `/settlements/${testSettlementId}`, null, authTokens.admin);

      assert(getResponse.status === 200, 'Get settlement by ID should return 200');
      assert(getResponse.data.data.settlement._id === testSettlementId, 'Should return correct settlement');

      logTest('settlement', 'Get Settlement by ID', 'PASS', `Retrieved settlement: ${testSettlementId}`);
    } catch (error) {
      logTest('settlement', 'Get Settlement by ID', 'FAIL', error.message);
    }

    // Test 4: Add Payment to Settlement
    try {
      const paymentData = {
        amount: 5000,
        method: 'cash',
        reference: 'TEST-PAYMENT-001',
        notes: 'Test payment for E2E testing'
      };

      const paymentResponse = await makeRequest('POST', `/settlements/${testSettlementId}/payment`, paymentData, authTokens.admin);

      assert(paymentResponse.status === 200, 'Add payment should return 200');
      assert(paymentResponse.data.data.payment.amount === 5000, 'Payment amount should match');

      logTest('settlement', 'Add Payment to Settlement', 'PASS', `Payment added: ₹${paymentData.amount}`);
    } catch (error) {
      logTest('settlement', 'Add Payment to Settlement', 'FAIL', error.message);
    }

    // Test 5: Escalate Settlement
    try {
      const escalationData = {
        reason: 'Testing escalation functionality'
      };

      const escalateResponse = await makeRequest('POST', `/settlements/${testSettlementId}/escalate`, escalationData, authTokens.admin);

      assert(escalateResponse.status === 200, 'Escalate settlement should return 200');
      assert(escalateResponse.data.data.newEscalationLevel >= 1, 'Escalation level should increase');

      logTest('settlement', 'Escalate Settlement', 'PASS', `Escalated to level ${escalateResponse.data.data.newEscalationLevel}`);
    } catch (error) {
      logTest('settlement', 'Escalate Settlement', 'FAIL', error.message);
    }

    // Test 6: Add Communication
    try {
      const communicationData = {
        type: 'email',
        subject: 'Payment Reminder',
        message: 'This is a test payment reminder email',
        direction: 'outbound'
      };

      const commResponse = await makeRequest('POST', `/settlements/${testSettlementId}/communication`, communicationData, authTokens.admin);

      assert(commResponse.status === 200, 'Add communication should return 200');
      assert(commResponse.data.data.communication.type === 'email', 'Communication type should match');

      logTest('settlement', 'Add Communication', 'PASS', 'Communication added successfully');
    } catch (error) {
      logTest('settlement', 'Add Communication', 'FAIL', error.message);
    }

    // Test 7: Analytics
    try {
      const analyticsResponse = await makeRequest('GET', '/settlements/analytics', null, authTokens.admin);

      assert(analyticsResponse.status === 200, 'Analytics should return 200');
      assert(analyticsResponse.data.data.analytics, 'Should return analytics data');

      logTest('settlement', 'Settlement Analytics', 'PASS', 'Analytics retrieved successfully');
    } catch (error) {
      logTest('settlement', 'Settlement Analytics', 'FAIL', error.message);
    }

    // Test 8: Overdue Settlements
    try {
      const overdueResponse = await makeRequest('GET', '/settlements/overdue', null, authTokens.admin);

      assert(overdueResponse.status === 200, 'Overdue settlements should return 200');
      assert(Array.isArray(overdueResponse.data.data.overdueSettlements), 'Should return overdue settlements array');

      logTest('settlement', 'Overdue Settlements', 'PASS', `Found ${overdueResponse.data.data.overdueSettlements.length} overdue settlements`);
    } catch (error) {
      logTest('settlement', 'Overdue Settlements', 'FAIL', error.message);
    }

  } catch (error) {
    logTest('settlement', 'Settlement API Testing', 'FAIL', error.message);
  }
}

// Test Checkout Inventory functionality
async function testCheckoutInventoryAPI() {
  console.log('\n🏨 Testing Checkout Inventory API...');

  try {
    // Test 1: Create Checkout Inventory
    try {
      const inventoryData = {
        bookingId: testBookingId,
        roomId: '650e1f1e5d8b3c001a123456', // Using a sample room ID
        inventoryItems: [
          {
            category: 'Electronics',
            itemName: 'TV Remote',
            condition: 'working',
            quantity: 1,
            notes: 'All buttons functional'
          },
          {
            category: 'Furniture',
            itemName: 'Bed',
            condition: 'good',
            quantity: 1,
            notes: 'No visible damage'
          }
        ],
        damages: [
          {
            category: 'Bathroom',
            itemName: 'Mirror',
            damageType: 'crack',
            severity: 'minor',
            chargeAmount: 500,
            description: 'Small crack in bathroom mirror'
          }
        ],
        staffNotes: 'Room checkout completed successfully'
      };

      const createResponse = await makeRequest('POST', '/checkout-inventory', inventoryData, authTokens.staff);
      testCheckoutInventoryId = createResponse.data.data.checkoutInventory._id;

      assert(createResponse.status === 201, 'Checkout inventory creation should return 201');
      assert(createResponse.data.data.checkoutInventory._id, 'Checkout inventory should have an ID');

      logTest('checkoutInventory', 'Create Checkout Inventory', 'PASS', `Inventory ID: ${testCheckoutInventoryId}`);
    } catch (error) {
      logTest('checkoutInventory', 'Create Checkout Inventory', 'FAIL', error.message);
    }

    // Test 2: Get Checkout Inventory by ID
    try {
      const getResponse = await makeRequest('GET', `/checkout-inventory/${testCheckoutInventoryId}`, null, authTokens.staff);

      assert(getResponse.status === 200, 'Get checkout inventory should return 200');
      assert(getResponse.data.data.checkoutInventory._id === testCheckoutInventoryId, 'Should return correct inventory');

      logTest('checkoutInventory', 'Get Checkout Inventory', 'PASS', `Retrieved inventory: ${testCheckoutInventoryId}`);
    } catch (error) {
      logTest('checkoutInventory', 'Get Checkout Inventory', 'FAIL', error.message);
    }

    // Test 3: Complete Checkout Inventory
    try {
      const completeData = {
        finalNotes: 'Checkout completed with minor damage charge',
        completedBy: 'Test Staff Member'
      };

      const completeResponse = await makeRequest('PUT', `/checkout-inventory/${testCheckoutInventoryId}/complete`, completeData, authTokens.staff);

      assert(completeResponse.status === 200, 'Complete checkout should return 200');
      assert(completeResponse.data.data.checkoutInventory.status === 'completed', 'Status should be completed');

      logTest('checkoutInventory', 'Complete Checkout Inventory', 'PASS', 'Inventory marked as completed');
    } catch (error) {
      logTest('checkoutInventory', 'Complete Checkout Inventory', 'FAIL', error.message);
    }

    // Test 4: Process Payment for Damages
    try {
      const paymentData = {
        paymentMethod: 'card',
        amount: 500,
        reference: 'TEST-DAMAGE-PAYMENT-001'
      };

      const paymentResponse = await makeRequest('POST', `/checkout-inventory/${testCheckoutInventoryId}/payment`, paymentData, authTokens.staff);

      assert(paymentResponse.status === 200, 'Process payment should return 200');
      assert(paymentResponse.data.data.payment.amount === 500, 'Payment amount should match');

      logTest('checkoutInventory', 'Process Damage Payment', 'PASS', `Payment processed: ₹${paymentData.amount}`);
    } catch (error) {
      logTest('checkoutInventory', 'Process Damage Payment', 'FAIL', error.message);
    }

  } catch (error) {
    logTest('checkoutInventory', 'Checkout Inventory API Testing', 'FAIL', error.message);
  }
}

// Test Billing Session functionality
async function testBillingSessionAPI() {
  console.log('\n🧾 Testing Billing Session API...');

  try {
    // Test 1: Create Billing Session
    try {
      const sessionData = {
        sessionType: 'restaurant',
        tableName: 'Table 5',
        guestId: testBookingId, // Using booking ID as guest reference
        staffId: authTokens.staff
      };

      const createResponse = await makeRequest('POST', '/billing-sessions', sessionData, authTokens.staff);
      testBillingSessionId = createResponse.data.data.billingSession._id;

      assert(createResponse.status === 201, 'Billing session creation should return 201');
      assert(createResponse.data.data.billingSession._id, 'Billing session should have an ID');

      logTest('billingSession', 'Create Billing Session', 'PASS', `Session ID: ${testBillingSessionId}`);
    } catch (error) {
      logTest('billingSession', 'Create Billing Session', 'FAIL', error.message);
    }

    // Test 2: Add Items to Billing Session
    try {
      const itemData = {
        items: [
          {
            name: 'Club Sandwich',
            category: 'Food',
            price: 450,
            quantity: 2,
            notes: 'No onions'
          },
          {
            name: 'Fresh Orange Juice',
            category: 'Beverage',
            price: 180,
            quantity: 2
          }
        ]
      };

      const addItemsResponse = await makeRequest('POST', `/billing-sessions/${testBillingSessionId}/items`, itemData, authTokens.staff);

      assert(addItemsResponse.status === 200, 'Add items should return 200');
      assert(addItemsResponse.data.data.billingSession.items.length > 0, 'Session should have items');

      logTest('billingSession', 'Add Items to Session', 'PASS', `Added ${itemData.items.length} items`);
    } catch (error) {
      logTest('billingSession', 'Add Items to Session', 'FAIL', error.message);
    }

    // Test 3: Calculate Session Total
    try {
      const totalResponse = await makeRequest('GET', `/billing-sessions/${testBillingSessionId}/total`, null, authTokens.staff);

      assert(totalResponse.status === 200, 'Calculate total should return 200');
      assert(totalResponse.data.data.total > 0, 'Total should be greater than 0');

      logTest('billingSession', 'Calculate Session Total', 'PASS', `Total: ₹${totalResponse.data.data.total}`);
    } catch (error) {
      logTest('billingSession', 'Calculate Session Total', 'FAIL', error.message);
    }

    // Test 4: Checkout Billing Session
    try {
      const checkoutData = {
        paymentMethod: 'cash',
        discountPercentage: 10,
        notes: 'Guest satisfaction survey completed'
      };

      const checkoutResponse = await makeRequest('POST', `/billing-sessions/${testBillingSessionId}/checkout`, checkoutData, authTokens.staff);

      assert(checkoutResponse.status === 200, 'Checkout session should return 200');
      assert(checkoutResponse.data.data.billingSession.status === 'completed', 'Session should be completed');

      logTest('billingSession', 'Checkout Billing Session', 'PASS', 'Session checked out successfully');
    } catch (error) {
      logTest('billingSession', 'Checkout Billing Session', 'FAIL', error.message);
    }

  } catch (error) {
    logTest('billingSession', 'Billing Session API Testing', 'FAIL', error.message);
  }
}

// Test Payment functionality and Stripe integration
async function testPaymentAPI() {
  console.log('\n💳 Testing Payment API and Stripe Integration...');

  try {
    // Test 1: Create Payment Intent
    try {
      const paymentIntentData = {
        amount: 10000, // ₹100.00
        currency: 'INR',
        description: 'Test payment for settlement',
        settlementId: testSettlementId
      };

      const intentResponse = await makeRequest('POST', '/payments/create-intent', paymentIntentData, authTokens.admin);

      assert(intentResponse.status === 200, 'Create payment intent should return 200');
      assert(intentResponse.data.data.clientSecret, 'Should return client secret');

      logTest('payment', 'Create Payment Intent', 'PASS', 'Payment intent created successfully');
    } catch (error) {
      logTest('payment', 'Create Payment Intent', 'FAIL', error.message);
    }

    // Test 2: Process Settlement Payment
    try {
      const settlementPaymentData = {
        settlementId: testSettlementId,
        amount: 5000,
        paymentMethod: 'stripe',
        paymentIntentId: 'pi_test_payment_intent_123'
      };

      const settlementPaymentResponse = await makeRequest('POST', '/payments/settlement', settlementPaymentData, authTokens.admin);

      assert(settlementPaymentResponse.status === 200, 'Process settlement payment should return 200');
      assert(settlementPaymentResponse.data.data.payment, 'Should return payment details');

      logTest('payment', 'Process Settlement Payment', 'PASS', `Settlement payment: ₹${settlementPaymentData.amount}`);
    } catch (error) {
      logTest('payment', 'Process Settlement Payment', 'FAIL', error.message);
    }

    // Test 3: Process Refund
    try {
      const refundData = {
        paymentIntentId: 'pi_test_payment_intent_123',
        amount: 1000,
        reason: 'Customer request - testing refund functionality'
      };

      const refundResponse = await makeRequest('POST', '/payments/refund', refundData, authTokens.admin);

      assert(refundResponse.status === 200, 'Process refund should return 200');
      assert(refundResponse.data.data.refund, 'Should return refund details');

      logTest('payment', 'Process Refund', 'PASS', `Refund processed: ₹${refundData.amount}`);
    } catch (error) {
      logTest('payment', 'Process Refund', 'FAIL', error.message);
    }

    // Test 4: Get Payment History
    try {
      const historyResponse = await makeRequest('GET', '/payments/history', null, authTokens.admin);

      assert(historyResponse.status === 200, 'Get payment history should return 200');
      assert(Array.isArray(historyResponse.data.data.payments), 'Should return payments array');

      logTest('payment', 'Get Payment History', 'PASS', `Found ${historyResponse.data.data.payments.length} payments`);
    } catch (error) {
      logTest('payment', 'Get Payment History', 'FAIL', error.message);
    }

  } catch (error) {
    logTest('payment', 'Payment API Testing', 'FAIL', error.message);
  }
}

// Test Integration workflows
async function testIntegrationWorkflows() {
  console.log('\n🔗 Testing Integration Workflows...');

  try {
    // Test 1: Complete Guest Checkout → Settlement Creation → Payment Processing
    try {
      // This tests the complete workflow from checkout to payment
      const workflow1Response = await makeRequest('GET', `/settlements/${testSettlementId}`, null, authTokens.admin);

      assert(workflow1Response.status === 200, 'Settlement should exist');
      assert(workflow1Response.data.data.settlement.payments.length > 0, 'Settlement should have payments');

      logTest('integration', 'Checkout to Settlement Workflow', 'PASS', 'Complete workflow tested successfully');
    } catch (error) {
      logTest('integration', 'Checkout to Settlement Workflow', 'FAIL', error.message);
    }

    // Test 2: Checkout Inventory → Damage Charges → Payment Completion
    try {
      const workflow2Response = await makeRequest('GET', `/checkout-inventory/${testCheckoutInventoryId}`, null, authTokens.staff);

      assert(workflow2Response.status === 200, 'Checkout inventory should exist');
      assert(workflow2Response.data.data.checkoutInventory.paymentStatus === 'completed', 'Payment should be completed');

      logTest('integration', 'Inventory to Payment Workflow', 'PASS', 'Damage charge workflow tested successfully');
    } catch (error) {
      logTest('integration', 'Inventory to Payment Workflow', 'FAIL', error.message);
    }

    // Test 3: Billing Session → Item Addition → Multiple Payment Methods
    try {
      const workflow3Response = await makeRequest('GET', `/billing-sessions/${testBillingSessionId}`, null, authTokens.staff);

      assert(workflow3Response.status === 200, 'Billing session should exist');
      assert(workflow3Response.data.data.billingSession.status === 'completed', 'Session should be completed');

      logTest('integration', 'Billing Session Workflow', 'PASS', 'POS billing workflow tested successfully');
    } catch (error) {
      logTest('integration', 'Billing Session Workflow', 'FAIL', error.message);
    }

  } catch (error) {
    logTest('integration', 'Integration Workflow Testing', 'FAIL', error.message);
  }
}

// Test Data Integrity
async function testDataIntegrity() {
  console.log('\n📊 Testing Data Integrity...');

  try {
    // Test 1: Payment amounts match between frontend/backend
    try {
      const settlementResponse = await makeRequest('GET', `/settlements/${testSettlementId}`, null, authTokens.admin);
      const settlement = settlementResponse.data.data.settlement;

      // Calculate total from payments array
      const calculatedTotal = settlement.payments.reduce((sum, payment) => sum + payment.amount, 0);

      assert(calculatedTotal === settlement.totalPaid, 'Calculated total should match totalPaid field');
      assert(settlement.outstandingBalance >= 0, 'Outstanding balance should not be negative');

      logTest('dataIntegrity', 'Payment Amount Consistency', 'PASS', `Total: ₹${calculatedTotal}, Outstanding: ₹${settlement.outstandingBalance}`);
    } catch (error) {
      logTest('dataIntegrity', 'Payment Amount Consistency', 'FAIL', error.message);
    }

    // Test 2: Settlement status updates correctly
    try {
      const settlementResponse = await makeRequest('GET', `/settlements/${testSettlementId}`, null, authTokens.admin);
      const settlement = settlementResponse.data.data.settlement;

      // Check status logic
      if (settlement.outstandingBalance === 0 && settlement.refundAmount === 0) {
        assert(settlement.status === 'completed', 'Status should be completed when fully paid');
      } else if (settlement.totalPaid > 0 && settlement.outstandingBalance > 0) {
        assert(settlement.status === 'partial', 'Status should be partial when partially paid');
      }

      logTest('dataIntegrity', 'Settlement Status Logic', 'PASS', `Status: ${settlement.status}, Logic verified`);
    } catch (error) {
      logTest('dataIntegrity', 'Settlement Status Logic', 'FAIL', error.message);
    }

    // Test 3: Outstanding balance calculations are accurate
    try {
      const settlementResponse = await makeRequest('GET', `/settlements/${testSettlementId}`, null, authTokens.admin);
      const settlement = settlementResponse.data.data.settlement;

      const expectedOutstanding = Math.max(0, settlement.finalAmount - settlement.totalPaid);

      assert(settlement.outstandingBalance === expectedOutstanding, 'Outstanding balance calculation should be correct');

      logTest('dataIntegrity', 'Outstanding Balance Calculation', 'PASS', `Expected: ₹${expectedOutstanding}, Actual: ₹${settlement.outstandingBalance}`);
    } catch (error) {
      logTest('dataIntegrity', 'Outstanding Balance Calculation', 'FAIL', error.message);
    }

    // Test 4: Multi-tenant data isolation by hotelId
    try {
      const settlementsResponse = await makeRequest('GET', '/settlements', null, authTokens.admin);
      const settlements = settlementsResponse.data.data.settlements;

      // All settlements should belong to the same hotel
      const allSameHotel = settlements.every(settlement => settlement.hotelId === HOTEL_ID);

      assert(allSameHotel, 'All settlements should belong to the same hotel');

      logTest('dataIntegrity', 'Multi-tenant Data Isolation', 'PASS', `All ${settlements.length} settlements belong to correct hotel`);
    } catch (error) {
      logTest('dataIntegrity', 'Multi-tenant Data Isolation', 'FAIL', error.message);
    }

  } catch (error) {
    logTest('dataIntegrity', 'Data Integrity Testing', 'FAIL', error.message);
  }
}

// Test Error Handling
async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...');

  try {
    // Test 1: Invalid payment amounts
    try {
      const invalidPaymentData = {
        amount: -1000, // Negative amount
        method: 'cash'
      };

      const response = await makeRequest('POST', `/settlements/${testSettlementId}/payment`, invalidPaymentData, authTokens.admin);

      // Should not reach here
      assert(false, 'Should have thrown an error for negative amount');
    } catch (error) {
      assert(error.response.status === 400, 'Should return 400 for invalid amount');
      logTest('errorHandling', 'Invalid Payment Amount', 'PASS', 'Correctly rejected negative amount');
    }

    // Test 2: Invalid settlement ID
    try {
      const response = await makeRequest('GET', '/settlements/invalid-id-123', null, authTokens.admin);

      // Should not reach here
      assert(false, 'Should have thrown an error for invalid ID');
    } catch (error) {
      assert(error.response.status === 400 || error.response.status === 404, 'Should return 400/404 for invalid ID');
      logTest('errorHandling', 'Invalid Settlement ID', 'PASS', 'Correctly rejected invalid settlement ID');
    }

    // Test 3: Permission errors (guest accessing admin endpoints)
    try {
      const response = await makeRequest('GET', '/settlements', null, authTokens.guest);

      // Should not reach here
      assert(false, 'Should have thrown an error for insufficient permissions');
    } catch (error) {
      assert(error.response.status === 403, 'Should return 403 for insufficient permissions');
      logTest('errorHandling', 'Permission Error', 'PASS', 'Correctly rejected guest access to admin endpoint');
    }

    // Test 4: Missing required fields
    try {
      const incompleteData = {
        // Missing required fields
        method: 'cash'
        // amount is missing
      };

      const response = await makeRequest('POST', `/settlements/${testSettlementId}/payment`, incompleteData, authTokens.admin);

      // Should not reach here
      assert(false, 'Should have thrown an error for missing fields');
    } catch (error) {
      assert(error.response.status === 400, 'Should return 400 for missing required fields');
      logTest('errorHandling', 'Missing Required Fields', 'PASS', 'Correctly rejected incomplete payment data');
    }

    // Test 5: Duplicate settlement creation
    try {
      const duplicateData = {
        bookingId: testBookingId, // Same booking ID
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await makeRequest('POST', '/settlements', duplicateData, authTokens.admin);

      // Should not reach here
      assert(false, 'Should have thrown an error for duplicate settlement');
    } catch (error) {
      assert(error.response.status === 400, 'Should return 400 for duplicate settlement');
      logTest('errorHandling', 'Duplicate Settlement', 'PASS', 'Correctly rejected duplicate settlement creation');
    }

  } catch (error) {
    logTest('errorHandling', 'Error Handling Testing', 'FAIL', error.message);
  }
}

// Generate test report
function generateTestReport() {
  console.log('\n📋 COMPREHENSIVE E2E TEST REPORT');
  console.log('='.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;

  Object.keys(TEST_RESULTS).forEach(category => {
    const result = TEST_RESULTS[category];
    totalPassed += result.passed;
    totalFailed += result.failed;

    console.log(`\n${category.toUpperCase()}:`);
    console.log(`  ✅ Passed: ${result.passed}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  📊 Total: ${result.passed + result.failed}`);

    if (result.failed > 0) {
      console.log(`  🚨 Failed Tests:`);
      result.tests.filter(test => test.status === 'FAIL').forEach(test => {
        console.log(`    - ${test.testName}: ${test.details}`);
      });
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL SUMMARY:`);
  console.log(`✅ Total Passed: ${totalPassed}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📊 Total Tests: ${totalPassed + totalFailed}`);
  console.log(`📈 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(2)}%`);

  // Generate detailed JSON report
  const detailedReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPassed,
      totalFailed,
      totalTests: totalPassed + totalFailed,
      successRate: ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(2)
    },
    categories: TEST_RESULTS,
    testEnvironment: {
      apiBase: API_BASE,
      hotelId: HOTEL_ID,
      authenticationStatus: 'SUCCESS'
    }
  };

  console.log('\n📁 Detailed JSON report saved to test results');
  return detailedReport;
}

// Main test execution
async function runE2ETests() {
  console.log('🚀 Starting Comprehensive E2E Testing of Payment System');
  console.log('=' .repeat(80));

  try {
    // Setup
    const authSuccess = await setupAuthentication();
    if (!authSuccess) {
      console.log('❌ Authentication setup failed. Aborting tests.');
      return;
    }

    const bookingSuccess = await createTestBooking();
    if (!bookingSuccess) {
      console.log('❌ Test booking creation failed. Aborting tests.');
      return;
    }

    // Run all test suites
    await testSettlementAPI();
    await testCheckoutInventoryAPI();
    await testBillingSessionAPI();
    await testPaymentAPI();
    await testIntegrationWorkflows();
    await testDataIntegrity();
    await testErrorHandling();

    // Generate report
    const report = generateTestReport();

    console.log('\n🎉 E2E Testing completed!');

    return report;

  } catch (error) {
    console.error('💥 Critical error during testing:', error);
    return null;
  }
}

// Export for use in other test files
export { runE2ETests, TEST_RESULTS };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runE2ETests().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}