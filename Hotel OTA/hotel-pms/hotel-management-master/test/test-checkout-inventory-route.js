const request = require('supertest');
const app = require('../backend/src/server.js');

/**
 * Test script to verify CheckoutInventory route conflict is resolved
 * This script tests that /api/v1/checkout-inventory returns inventory data, not settings data
 */

// Test credentials (update with actual test user tokens)
const testTokens = {
  staff: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',  // Replace with actual staff token
  admin: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'   // Replace with actual admin token
};

async function testCheckoutInventoryRoutes() {
  console.log('🧪 Testing CheckoutInventory Route Conflict Fix...\n');

  try {
    // Test 1: GET /api/v1/checkout-inventory - Should return inventory data
    console.log('Test 1: GET /api/v1/checkout-inventory');
    const response1 = await request(app)
      .get('/api/v1/checkout-inventory')
      .set('Authorization', `Bearer ${testTokens.staff}`);

    console.log(`Status: ${response1.status}`);
    console.log(`Response type: ${typeof response1.body}`);

    if (response1.status === 200 && response1.body.data && response1.body.data.checkoutInventories) {
      console.log('✅ SUCCESS: Route returns checkout inventory data');
    } else if (response1.status === 401) {
      console.log('⚠️  AUTH REQUIRED: Need valid token to test');
    } else {
      console.log('❌ FAILURE: Route not returning expected inventory data');
      console.log('Response:', JSON.stringify(response1.body, null, 2));
    }

    // Test 2: GET /api/v1/settings - Should return settings data
    console.log('\nTest 2: GET /api/v1/settings');
    const response2 = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${testTokens.staff}`);

    console.log(`Status: ${response2.status}`);

    if (response2.status === 200) {
      console.log('✅ SUCCESS: Settings route working correctly');
    } else {
      console.log('❌ FAILURE: Settings route not working');
    }

    // Test 3: POST /api/v1/checkout-inventory - Should create inventory
    console.log('\nTest 3: POST /api/v1/checkout-inventory');
    const testInventoryData = {
      bookingId: '507f1f77bcf86cd799439011',  // Sample booking ID
      roomId: '507f1f77bcf86cd799439012',     // Sample room ID
      items: [
        {
          itemName: 'Test Item',
          category: 'cleaning',
          quantity: 1,
          unitPrice: 10.00,
          status: 'missing',
          notes: 'Test item for route verification'
        }
      ],
      notes: 'Test checkout inventory creation'
    };

    const response3 = await request(app)
      .post('/api/v1/checkout-inventory')
      .set('Authorization', `Bearer ${testTokens.staff}`)
      .send(testInventoryData);

    console.log(`Status: ${response3.status}`);

    if (response3.status === 201) {
      console.log('✅ SUCCESS: Checkout inventory creation working');
    } else if (response3.status === 401) {
      console.log('⚠️  AUTH REQUIRED: Need valid token to test');
    } else {
      console.log('❌ FAILURE: Checkout inventory creation failed');
      console.log('Response:', JSON.stringify(response3.body, null, 2));
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }

  console.log('\n🎯 Route Conflict Test Completed');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testCheckoutInventoryRoutes();
}

module.exports = { testCheckoutInventoryRoutes };