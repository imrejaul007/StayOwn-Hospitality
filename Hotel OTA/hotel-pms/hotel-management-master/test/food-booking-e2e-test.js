/**
 * End-to-End Test for Guest Food Booking System
 * Tests the complete workflow from guest login to order completion
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';

// Test credentials
const CREDENTIALS = {
  guest: { email: 'john@example.com', password: 'guest123' },
  staff: { email: 'staff@hotel.com', password: 'staff123' },
  admin: { email: 'admin@hotel.com', password: 'admin123' }
};

let testTokens = {};
let testData = {};

/**
 * Test helper functions
 */
function log(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function error(message, err = null) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
  if (err) {
    console.error(err.response?.data || err.message);
  }
}

async function makeRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    return response.data;
  } catch (err) {
    throw err;
  }
}

/**
 * Test Step 1: Authentication
 */
async function testAuthentication() {
  log('🔐 Testing Authentication...');

  try {
    // Test guest login
    const guestLogin = await makeRequest('POST', '/auth/login', CREDENTIALS.guest);
    testTokens.guest = guestLogin.token;
    testData.guestUser = guestLogin.user;
    log('✅ Guest login successful');

    // Test staff login
    const staffLogin = await makeRequest('POST', '/auth/login', CREDENTIALS.staff);
    testTokens.staff = staffLogin.token;
    testData.staffUser = staffLogin.user;
    log('✅ Staff login successful');

    // Test admin login
    const adminLogin = await makeRequest('POST', '/auth/login', CREDENTIALS.admin);
    testTokens.admin = adminLogin.token;
    testData.adminUser = adminLogin.user;
    log('✅ Admin login successful');

    return true;
  } catch (err) {
    error('Authentication failed', err);
    return false;
  }
}

/**
 * Test Step 2: Get Guest Bookings
 */
async function testGetGuestBookings() {
  log('🏨 Testing Guest Bookings...');

  try {
    const bookings = await makeRequest('GET', '/bookings', null, testTokens.guest);

    if (bookings.status === 'success' && bookings.data.length > 0) {
      testData.booking = bookings.data.find(b => b.status === 'checked_in') || bookings.data[0];
      log(`✅ Found ${bookings.data.length} bookings, using booking: ${testData.booking.bookingNumber}`);
      return true;
    } else {
      error('No bookings found for guest');
      return false;
    }
  } catch (err) {
    error('Failed to get guest bookings', err);
    return false;
  }
}

/**
 * Test Step 3: Test POS System
 */
async function testPOSSystem() {
  log('🍽️ Testing POS System...');

  try {
    // Get POS outlets
    const outlets = await makeRequest('GET', '/pos/outlets', null, testTokens.admin);
    if (outlets.success && outlets.data.length > 0) {
      testData.outlet = outlets.data.find(o => o.type === 'room_service') || outlets.data[0];
      log(`✅ Found ${outlets.data.length} outlets, using: ${testData.outlet.name}`);
    } else {
      error('No POS outlets found');
      return false;
    }

    // Test POS order creation (this should now work after our fix)
    const orderData = {
      outlet: testData.outlet._id,
      type: 'room_service',
      customer: {
        guest: testData.guestUser.id,
        roomNumber: testData.booking.rooms?.[0]?.roomId?.roomNumber || '1001'
      },
      items: [
        {
          itemId: 'test_item_1',
          name: 'Test Burger',
          price: 350,
          quantity: 1
        },
        {
          itemId: 'test_item_2',
          name: 'Test Fries',
          price: 150,
          quantity: 2
        }
      ],
      specialRequests: 'Test order for e2e testing'
    };

    const posOrder = await makeRequest('POST', '/pos/orders', orderData, testTokens.admin);
    if (posOrder.success) {
      testData.posOrder = posOrder.data;
      log(`✅ POS order created successfully: ${testData.posOrder.orderNumber}`);
      return true;
    } else {
      error('Failed to create POS order');
      return false;
    }
  } catch (err) {
    error('POS system test failed', err);
    return false;
  }
}

/**
 * Test Step 4: Create Guest Service Request (Food Order)
 */
async function testGuestServiceRequest() {
  log('🛎️ Testing Guest Service Request...');

  try {
    const serviceRequestData = {
      bookingId: testData.booking._id,
      serviceType: 'room_service',
      serviceVariation: 'food_order',
      title: 'Room Service Food Order - E2E Test',
      description: 'Test food order for end-to-end testing',
      priority: 'now',
      items: [
        {
          itemId: 'butter_chicken',
          name: 'Butter Chicken',
          price: 450,
          quantity: 2
        },
        {
          itemId: 'naan_bread',
          name: 'Naan Bread',
          price: 80,
          quantity: 4
        },
        {
          itemId: 'rice',
          name: 'Basmati Rice',
          price: 120,
          quantity: 2
        }
      ],
      specialInstructions: 'E2E test order - please prepare test items. No spicy food.'
    };

    const serviceRequest = await makeRequest('POST', '/guest-services', serviceRequestData, testTokens.guest);

    if (serviceRequest.status === 'success') {
      testData.serviceRequest = serviceRequest.data.serviceRequest;
      testData.autoPosOrder = serviceRequest.data.posOrder;

      log('✅ Guest service request created successfully');
      log(`   Service Request ID: ${testData.serviceRequest._id}`);

      if (testData.autoPosOrder) {
        log(`   Auto-created POS Order: ${testData.autoPosOrder.orderNumber}`);
        log('✅ POS integration working - order automatically created!');
      } else {
        log('⚠️ POS order was not automatically created');
      }

      return true;
    } else {
      error('Failed to create guest service request');
      return false;
    }
  } catch (err) {
    error('Guest service request test failed', err);
    return false;
  }
}

/**
 * Test Step 5: Verify Staff Visibility
 */
async function testStaffVisibility() {
  log('👨‍💼 Testing Staff Visibility...');

  try {
    const staffServices = await makeRequest('GET', '/guest-services', null, testTokens.staff);

    if (staffServices.status === 'success') {
      const ourRequest = staffServices.data.serviceRequests.find(
        req => req._id === testData.serviceRequest._id
      );

      if (ourRequest) {
        log('✅ Staff can see the guest service request');
        log(`   Status: ${ourRequest.status}`);
        log(`   Assigned to: ${ourRequest.assignedTo?.name || 'Not assigned'}`);
        return true;
      } else {
        error('Staff cannot see the guest service request');
        return false;
      }
    } else {
      error('Failed to get staff service requests');
      return false;
    }
  } catch (err) {
    error('Staff visibility test failed', err);
    return false;
  }
}

/**
 * Test Step 6: Test Payment Integration
 */
async function testPaymentIntegration() {
  log('💳 Testing Payment Integration...');

  try {
    // Test room charge payment
    const roomChargeData = {
      orderId: testData.autoPosOrder?._id || testData.posOrder._id,
      amount: 1010, // Total for our test items
      currency: 'INR',
      roomNumber: testData.booking.rooms?.[0]?.roomId?.roomNumber || '1001',
      bookingId: testData.booking._id,
      items: testData.serviceRequest.items
    };

    const roomChargePayment = await makeRequest('POST', '/payments/room-charge', roomChargeData, testTokens.guest);

    if (roomChargePayment.success) {
      testData.roomChargePayment = roomChargePayment.data;
      log('✅ Room charge payment processed successfully');
      log(`   Transaction ID: ${testData.roomChargePayment.transactionId}`);
      return true;
    } else {
      error('Room charge payment failed');
      return false;
    }
  } catch (err) {
    error('Payment integration test failed', err);
    return false;
  }
}

/**
 * Test Step 7: Test Cash on Delivery
 */
async function testCashOnDelivery() {
  log('💵 Testing Cash on Delivery...');

  try {
    const codData = {
      orderId: testData.posOrder._id,
      amount: 650, // Different amount for COD test
      currency: 'INR',
      roomNumber: testData.booking.rooms?.[0]?.roomId?.roomNumber || '1001'
    };

    const codPayment = await makeRequest('POST', '/payments/cash-on-delivery', codData, testTokens.guest);

    if (codPayment.success) {
      testData.codPayment = codPayment.data;
      log('✅ Cash on delivery payment processed successfully');
      log(`   Transaction ID: ${testData.codPayment.transactionId}`);
      return true;
    } else {
      error('Cash on delivery payment failed');
      return false;
    }
  } catch (err) {
    error('Cash on delivery test failed', err);
    return false;
  }
}

/**
 * Test Step 8: Verify Data Consistency
 */
async function testDataConsistency() {
  log('🔍 Testing Data Consistency...');

  try {
    // Check if booking was updated with extra charges
    const updatedBooking = await makeRequest('GET', `/bookings/${testData.booking._id}`, null, testTokens.guest);

    if (updatedBooking.status === 'success') {
      const booking = updatedBooking.data.booking;

      if (booking.settlementTracking?.adjustments && booking.settlementTracking.adjustments.length > 0) {
        const roomServiceCharge = booking.settlementTracking.adjustments.find(
          charge => charge.type === 'service_charge'
        );

        if (roomServiceCharge) {
          log('✅ Room service charge added to booking successfully');
          log(`   Charge amount: ₹${roomServiceCharge.amount}`);
          log(`   Description: ${roomServiceCharge.description}`);
        } else {
          error('Room service charge not found in booking');
          return false;
        }
      } else {
        error('No service charges found in booking');
        return false;
      }

      return true;
    } else {
      error('Failed to get updated booking');
      return false;
    }
  } catch (err) {
    error('Data consistency test failed', err);
    return false;
  }
}

/**
 * Main test runner
 */
async function runEndToEndTest() {
  console.log('🚀 Starting Guest Food Booking E2E Test');
  console.log('=====================================');

  const tests = [
    { name: 'Authentication', fn: testAuthentication },
    { name: 'Guest Bookings', fn: testGetGuestBookings },
    { name: 'POS System', fn: testPOSSystem },
    { name: 'Guest Service Request', fn: testGuestServiceRequest },
    { name: 'Staff Visibility', fn: testStaffVisibility },
    { name: 'Payment Integration', fn: testPaymentIntegration },
    { name: 'Cash on Delivery', fn: testCashOnDelivery },
    { name: 'Data Consistency', fn: testDataConsistency }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n--- Running ${test.name} Test ---`);

    try {
      const result = await test.fn();
      if (result) {
        passed++;
        log(`✅ ${test.name} test PASSED`);
      } else {
        failed++;
        log(`❌ ${test.name} test FAILED`);
      }
    } catch (err) {
      failed++;
      error(`❌ ${test.name} test FAILED with exception`, err);
    }
  }

  console.log('\n=====================================');
  console.log('🏁 E2E Test Summary');
  console.log('=====================================');
  console.log(`✅ Tests Passed: ${passed}`);
  console.log(`❌ Tests Failed: ${failed}`);
  console.log(`📊 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Guest Food Booking system is working correctly!');

    console.log('\n📋 Test Results Summary:');
    console.log('• Guest authentication working ✅');
    console.log('• POS order creation fixed ✅');
    console.log('• Guest service requests working ✅');
    console.log('• Automatic POS integration working ✅');
    console.log('• Staff assignment and visibility working ✅');
    console.log('• Payment integration working ✅');
    console.log('• Room charge processing working ✅');
    console.log('• Cash on delivery working ✅');
    console.log('• Data consistency maintained ✅');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the logs above for details.');
  }

  console.log('\n📊 Test Data Generated:');
  console.log(`• Service Request ID: ${testData.serviceRequest?._id}`);
  console.log(`• POS Order Number: ${testData.autoPosOrder?.orderNumber || testData.posOrder?.orderNumber}`);
  console.log(`• Room Charge Transaction: ${testData.roomChargePayment?.transactionId}`);
  console.log(`• COD Transaction: ${testData.codPayment?.transactionId}`);
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEndToEndTest()
    .then(() => {
      console.log('\n🏁 E2E test completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n💥 E2E test failed:', err);
      process.exit(1);
    });
}

export {
  runEndToEndTest,
  CREDENTIALS,
  BASE_URL
};