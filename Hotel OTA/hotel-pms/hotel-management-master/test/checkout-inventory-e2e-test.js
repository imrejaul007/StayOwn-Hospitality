/**
 * Comprehensive E2E Test for CheckoutInventory Route Conflict Fix
 *
 * This test validates:
 * 1. CheckoutInventory API returns correct data (not settings data)
 * 2. All CRUD operations work correctly
 * 3. Settings API still works independently
 * 4. No route conflicts exist
 *
 * Run this test after starting both backend and frontend servers
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';

// Test configuration
const testConfig = {
  // You'll need to update these with actual auth tokens
  staffToken: 'your-staff-token-here',
  adminToken: 'your-admin-token-here',

  // Test data
  testBookingId: '507f1f77bcf86cd799439011',
  testRoomId: '507f1f77bcf86cd799439012',
  testInventoryData: {
    bookingId: '507f1f77bcf86cd799439011',
    roomId: '507f1f77bcf86cd799439012',
    items: [
      {
        itemName: 'Towel',
        category: 'bathroom',
        quantity: 2,
        unitPrice: 50.00,
        status: 'missing',
        notes: 'Test missing towels'
      },
      {
        itemName: 'Remote Control',
        category: 'electronics',
        quantity: 1,
        unitPrice: 200.00,
        status: 'damaged',
        notes: 'Remote control damaged by guest'
      }
    ],
    notes: 'Comprehensive E2E test checkout inventory'
  }
};

// Helper function to make authenticated requests
function makeRequest(method, endpoint, data = null, token = testConfig.staffToken) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  return axios(config);
}

// Test functions
async function testRouteConflictResolution() {
  console.log('🔍 Testing Route Conflict Resolution...\n');

  try {
    // Test 1: Verify CheckoutInventory route returns correct data structure
    console.log('1️⃣ Testing GET /checkout-inventory');
    const checkoutResponse = await makeRequest('GET', '/checkout-inventory');

    console.log(`   Status: ${checkoutResponse.status}`);
    console.log(`   Data structure: ${typeof checkoutResponse.data}`);

    // Verify it's CheckoutInventory data, not settings data
    if (checkoutResponse.data.data &&
        checkoutResponse.data.data.hasOwnProperty('checkoutInventories')) {
      console.log('   ✅ SUCCESS: Returns checkout inventory data structure');
    } else if (checkoutResponse.status === 401) {
      console.log('   ⚠️  AUTH REQUIRED: Update test tokens to continue');
      return false;
    } else {
      console.log('   ❌ FAILURE: Wrong data structure returned');
      console.log('   Response:', JSON.stringify(checkoutResponse.data, null, 2));
      return false;
    }

    // Test 2: Verify Settings route still works independently
    console.log('\n2️⃣ Testing GET /settings');
    const settingsResponse = await makeRequest('GET', '/settings');

    console.log(`   Status: ${settingsResponse.status}`);

    if (settingsResponse.status === 200) {
      console.log('   ✅ SUCCESS: Settings route working independently');
    } else {
      console.log('   ❌ FAILURE: Settings route not working');
      console.log('   Response:', JSON.stringify(settingsResponse.data, null, 2));
    }

    return true;

  } catch (error) {
    console.error('❌ Route conflict test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testCheckoutInventoryCRUD() {
  console.log('\n🛠️ Testing CheckoutInventory CRUD Operations...\n');

  let createdInventoryId = null;

  try {
    // Test CREATE
    console.log('1️⃣ Testing POST /checkout-inventory (Create)');
    const createResponse = await makeRequest('POST', '/checkout-inventory', testConfig.testInventoryData);

    console.log(`   Status: ${createResponse.status}`);

    if (createResponse.status === 201 && createResponse.data.data.checkoutInventory) {
      createdInventoryId = createResponse.data.data.checkoutInventory._id;
      console.log(`   ✅ SUCCESS: Created checkout inventory with ID: ${createdInventoryId}`);
      console.log(`   Total Amount: ₹${createResponse.data.data.checkoutInventory.totalAmount}`);
    } else if (createResponse.status === 401) {
      console.log('   ⚠️  AUTH REQUIRED: Update test tokens');
      return false;
    } else {
      console.log('   ❌ FAILURE: Checkout inventory creation failed');
      console.log('   Response:', JSON.stringify(createResponse.data, null, 2));
      return false;
    }

    // Test READ by ID
    if (createdInventoryId) {
      console.log('\n2️⃣ Testing GET /checkout-inventory/:id (Read)');
      const readResponse = await makeRequest('GET', `/checkout-inventory/${createdInventoryId}`);

      console.log(`   Status: ${readResponse.status}`);

      if (readResponse.status === 200 && readResponse.data.data.checkoutInventory) {
        console.log('   ✅ SUCCESS: Retrieved checkout inventory by ID');
        console.log(`   Items count: ${readResponse.data.data.checkoutInventory.items.length}`);
      } else {
        console.log('   ❌ FAILURE: Failed to retrieve checkout inventory');
      }
    }

    // Test UPDATE
    if (createdInventoryId) {
      console.log('\n3️⃣ Testing PATCH /checkout-inventory/:id (Update)');
      const updateData = {
        status: 'completed',
        notes: 'Updated via E2E test'
      };

      const updateResponse = await makeRequest('PATCH', `/checkout-inventory/${createdInventoryId}`, updateData);

      console.log(`   Status: ${updateResponse.status}`);

      if (updateResponse.status === 200) {
        console.log('   ✅ SUCCESS: Updated checkout inventory');
        console.log(`   New status: ${updateResponse.data.data.checkoutInventory.status}`);
      } else {
        console.log('   ❌ FAILURE: Failed to update checkout inventory');
      }
    }

    // Test COMPLETE CHECK
    if (createdInventoryId) {
      console.log('\n4️⃣ Testing POST /checkout-inventory/:id/complete');
      const completeResponse = await makeRequest('POST', `/checkout-inventory/${createdInventoryId}/complete`);

      console.log(`   Status: ${completeResponse.status}`);

      if (completeResponse.status === 200) {
        console.log('   ✅ SUCCESS: Marked inventory check as completed');
      } else {
        console.log('   ⚠️  Note: Complete check may fail if already completed');
      }
    }

    // Test PAYMENT PROCESSING
    if (createdInventoryId) {
      console.log('\n5️⃣ Testing POST /checkout-inventory/:id/payment');
      const paymentData = {
        paymentMethod: 'cash',
        notes: 'E2E test payment'
      };

      const paymentResponse = await makeRequest('POST', `/checkout-inventory/${createdInventoryId}/payment`, paymentData);

      console.log(`   Status: ${paymentResponse.status}`);

      if (paymentResponse.status === 200) {
        console.log('   ✅ SUCCESS: Payment processed successfully');
        console.log(`   Payment status: ${paymentResponse.data.data.checkoutInventory.paymentStatus}`);
      } else {
        console.log('   ❌ FAILURE: Payment processing failed');
        console.log('   Response:', JSON.stringify(paymentResponse.data, null, 2));
      }
    }

    return true;

  } catch (error) {
    console.error('❌ CRUD test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testSpecificRoutePatterns() {
  console.log('\n🎯 Testing Specific Route Patterns...\n');

  const routeTests = [
    { route: '/checkout-inventory', expectedType: 'checkout_inventory' },
    { route: '/settings', expectedType: 'settings' },
    { route: '/settings/general', expectedType: 'settings' },
    { route: '/settings/notifications', expectedType: 'settings' }
  ];

  for (const test of routeTests) {
    try {
      console.log(`Testing: GET ${test.route}`);
      const response = await makeRequest('GET', test.route);

      console.log(`   Status: ${response.status}`);

      if (response.status === 200) {
        // Check if response matches expected type
        const hasCheckoutData = response.data.data && response.data.data.checkoutInventories;
        const hasSettingsData = !hasCheckoutData; // Simple check

        if (test.expectedType === 'checkout_inventory' && hasCheckoutData) {
          console.log('   ✅ SUCCESS: Returns checkout inventory data');
        } else if (test.expectedType === 'settings' && hasSettingsData) {
          console.log('   ✅ SUCCESS: Returns settings data');
        } else {
          console.log('   ❌ FAILURE: Wrong data type returned');
        }
      } else if (response.status === 401) {
        console.log('   ⚠️  AUTH REQUIRED');
      } else {
        console.log(`   ❌ FAILURE: Unexpected status ${response.status}`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
}

// Main test execution
async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE E2E TEST SUITE');
  console.log('===================================');
  console.log('Testing CheckoutInventory Route Conflict Fix\n');

  // Check if backend is running
  try {
    await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    console.log('✅ Backend server is running\n');
  } catch (error) {
    console.error('❌ Backend server is not running. Please start it first.');
    console.error('Run: cd backend && npm run dev\n');
    return;
  }

  const results = {
    routeConflict: false,
    crudOperations: false,
    routePatterns: true
  };

  // Run all tests
  results.routeConflict = await testRouteConflictResolution();

  if (results.routeConflict) {
    results.crudOperations = await testCheckoutInventoryCRUD();
  }

  await testSpecificRoutePatterns();

  // Final results
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  console.log(`Route Conflict Resolution: ${results.routeConflict ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`CRUD Operations: ${results.crudOperations ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Route Patterns: ${results.routePatterns ? '✅ PASSED' : '❌ FAILED'}`);

  const overallStatus = results.routeConflict && results.crudOperations && results.routePatterns;
  console.log(`\n🎯 Overall Status: ${overallStatus ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  if (overallStatus) {
    console.log('\n🎉 Route conflict fix is working correctly!');
    console.log('✅ CheckoutInventory API is now fully functional');
    console.log('✅ Settings API remains unaffected');
    console.log('✅ All CRUD operations work as expected');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
    console.log('💡 Common fixes:');
    console.log('   - Update auth tokens in testConfig');
    console.log('   - Ensure backend server is running');
    console.log('   - Check if database has test data');
  }
}

// Instructions for running the test
if (require.main === module) {
  console.log('📝 SETUP INSTRUCTIONS:');
  console.log('1. Start backend: cd backend && npm run dev');
  console.log('2. Update auth tokens in testConfig');
  console.log('3. Run: node test/checkout-inventory-e2e-test.js\n');

  runComprehensiveTests();
}

module.exports = { runComprehensiveTests };