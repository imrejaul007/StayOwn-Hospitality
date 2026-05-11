/**
 * No-Show Endpoint Manual Test Script
 *
 * This script provides examples of how to test the no-show endpoint
 * using Node.js with axios or fetch
 *
 * Prerequisites:
 * - Backend server running on http://localhost:5000
 * - Valid admin or staff authentication token
 * - At least one booking with status 'confirmed' or 'pending'
 */

import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:5000/api/v1';
const AUTH_TOKEN = 'your-admin-or-staff-token-here'; // Replace with actual token

// Test cases
const testCases = {
  // Test 1: Mark as no-show without charge
  noShowNoCharge: {
    bookingId: 'replace-with-actual-booking-id',
    payload: {
      reason: 'Guest called to cancel but past cancellation deadline'
    }
  },

  // Test 2: Mark as no-show with penalty charge
  noShowWithCharge: {
    bookingId: 'replace-with-actual-booking-id',
    payload: {
      reason: 'Guest did not arrive and did not respond to confirmation calls',
      chargeAmount: 2500
    }
  },

  // Test 3: Invalid - Missing reason (should fail with 400)
  missingReason: {
    bookingId: 'replace-with-actual-booking-id',
    payload: {
      chargeAmount: 1000
    }
  },

  // Test 4: Invalid - Reason too long (should fail with 400)
  reasonTooLong: {
    bookingId: 'replace-with-actual-booking-id',
    payload: {
      reason: 'A'.repeat(501), // 501 characters
      chargeAmount: 1000
    }
  },

  // Test 5: Invalid - Negative charge amount (should fail with 400)
  negativeCharge: {
    bookingId: 'replace-with-actual-booking-id',
    payload: {
      reason: 'Test negative charge',
      chargeAmount: -1000
    }
  },

  // Test 6: Invalid - Charge exceeds total (should fail with 400)
  chargeExceedsTotal: {
    bookingId: 'replace-with-actual-booking-id',
    payload: {
      reason: 'Test excessive charge',
      chargeAmount: 999999
    }
  },

  // Test 7: Invalid - Wrong booking status (should fail with 400)
  // Use a booking that's already checked_out, cancelled, or no_show
  wrongStatus: {
    bookingId: 'replace-with-checked-out-booking-id',
    payload: {
      reason: 'Trying to mark checked-out booking as no-show',
      chargeAmount: 1000
    }
  }
};

/**
 * Execute a test case
 */
async function runTest(testName, testData, expectSuccess = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(60));

  try {
    const response = await axios.post(
      `${BASE_URL}/bookings/${testData.bookingId}/no-show`,
      testData.payload,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SUCCESS');
    console.log('Status:', response.status);
    console.log('Message:', response.data.data.message);
    console.log('\nNo-Show Details:');
    console.log(JSON.stringify(response.data.data.noShowDetails, null, 2));

    if (!expectSuccess) {
      console.log('⚠️  WARNING: Expected this test to fail, but it succeeded!');
    }

    return response.data;

  } catch (error) {
    if (expectSuccess) {
      console.log('❌ FAILED (unexpected)');
    } else {
      console.log('✅ FAILED AS EXPECTED');
    }

    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data?.message || error.message);

    if (error.response?.data) {
      console.log('\nFull Error Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }

    if (expectSuccess) {
      throw error;
    }
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  console.log('NO-SHOW ENDPOINT TEST SUITE');
  console.log('═'.repeat(60));

  try {
    // Success cases
    console.log('\n\n📋 RUNNING SUCCESS CASES...\n');

    await runTest(
      'No-Show Without Charge',
      testCases.noShowNoCharge,
      true
    );

    await runTest(
      'No-Show With Penalty Charge',
      testCases.noShowWithCharge,
      true
    );

    // Failure cases
    console.log('\n\n📋 RUNNING VALIDATION FAILURE CASES...\n');

    await runTest(
      'Missing Reason (should fail)',
      testCases.missingReason,
      false
    );

    await runTest(
      'Reason Too Long (should fail)',
      testCases.reasonTooLong,
      false
    );

    await runTest(
      'Negative Charge Amount (should fail)',
      testCases.negativeCharge,
      false
    );

    await runTest(
      'Charge Exceeds Total (should fail)',
      testCases.chargeExceedsTotal,
      false
    );

    await runTest(
      'Wrong Booking Status (should fail)',
      testCases.wrongStatus,
      false
    );

    console.log('\n\n' + '═'.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('═'.repeat(60));

  } catch (error) {
    console.log('\n\n' + '═'.repeat(60));
    console.log('❌ TEST SUITE FAILED');
    console.log('═'.repeat(60));
    console.error(error.message);
  }
}

/**
 * Single test runner - use this to run individual tests
 */
async function runSingleTest() {
  // Example: Test marking a booking as no-show with charge
  const bookingId = '507f1f77bcf86cd799439011'; // Replace with actual ID

  await runTest('Single Test', {
    bookingId,
    payload: {
      reason: 'Guest did not arrive and did not cancel reservation',
      chargeAmount: 2500
    }
  }, true);
}

// Uncomment the test you want to run:
// runAllTests();
// runSingleTest();

/**
 * CURL EXAMPLES FOR MANUAL TESTING
 */
const curlExamples = `
# ============================================================
# CURL TEST EXAMPLES
# ============================================================

# 1. Mark as no-show without charge
curl -X POST http://localhost:5000/api/v1/bookings/507f1f77bcf86cd799439011/no-show \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "reason": "Guest called to cancel but past cancellation deadline"
  }'

# 2. Mark as no-show with penalty charge
curl -X POST http://localhost:5000/api/v1/bookings/507f1f77bcf86cd799439011/no-show \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "reason": "Guest did not arrive and did not respond to confirmation calls",
    "chargeAmount": 2500
  }'

# 3. Test missing reason (should fail)
curl -X POST http://localhost:5000/api/v1/bookings/507f1f77bcf86cd799439011/no-show \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "chargeAmount": 1000
  }'

# 4. Test negative charge (should fail)
curl -X POST http://localhost:5000/api/v1/bookings/507f1f77bcf86cd799439011/no-show \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "reason": "Test negative charge",
    "chargeAmount": -1000
  }'

# ============================================================
# EXPECTED RESPONSES
# ============================================================

# SUCCESS (200):
{
  "status": "success",
  "data": {
    "booking": { ... },
    "message": "Booking marked as no-show successfully with a charge of ₹2500",
    "noShowDetails": {
      "markedAt": "2025-01-18T10:30:00.000Z",
      "markedBy": {
        "userId": "507f1f77bcf86cd799439012",
        "userName": "Admin User",
        "userRole": "admin"
      },
      "reason": "Guest did not arrive...",
      "chargeAmount": 2500,
      "charged": true
    }
  }
}

# ERROR (400 - Missing reason):
{
  "status": "error",
  "message": "Reason is required for marking a booking as no-show"
}

# ERROR (400 - Invalid status):
{
  "status": "error",
  "message": "Cannot mark booking as no-show. Current status: checked_out. Only confirmed or pending bookings can be marked as no-show."
}

# ERROR (404 - Not found):
{
  "status": "error",
  "message": "Booking not found"
}

# ERROR (403 - Unauthorized):
{
  "status": "error",
  "message": "Access denied. Required roles: admin, staff"
}
`;

console.log(curlExamples);

export {
  runAllTests,
  runSingleTest,
  runTest,
  testCases
};
