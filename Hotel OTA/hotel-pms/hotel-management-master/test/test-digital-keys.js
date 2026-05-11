// Test script for Digital Keys System
const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken = '';

async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, testUser);
    authToken = response.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testDigitalKeysSystem() {
  console.log('🚀 Starting Digital Keys System Tests...\n');

  // Login
  if (!(await login())) {
    return;
  }

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Get all digital keys
    console.log('📋 Test 1: Get all digital keys');
    const keysResponse = await axios.get(`${BASE_URL}/digital-keys`, { headers });
    console.log(`✅ Found ${keysResponse.data.data.keys.length} keys`);
    console.log('Keys:', keysResponse.data.data.keys.map(k => ({
      id: k._id,
      room: k.roomId?.number,
      status: k.status,
      type: k.type
    })));
    console.log('');

    // Test 2: Get shared keys
    console.log('📋 Test 2: Get shared keys');
    const sharedKeysResponse = await axios.get(`${BASE_URL}/digital-keys/shared`, { headers });
    console.log(`✅ Found ${sharedKeysResponse.data.data.keys.length} shared keys`);
    console.log('');

    // Test 3: Get key statistics
    console.log('📋 Test 3: Get key statistics');
    const statsResponse = await axios.get(`${BASE_URL}/digital-keys/stats/overview`, { headers });
    console.log('✅ Statistics retrieved:', statsResponse.data.data);
    console.log('');

    // Test 4: Generate a new digital key (if we have a booking)
    console.log('📋 Test 4: Generate new digital key');
    try {
      // First, let's get user's bookings to find a valid booking ID
      const bookingsResponse = await axios.get(`${BASE_URL}/bookings`, { headers });
      const validBooking = bookingsResponse.data.data.bookings.find(b => 
        ['confirmed', 'checked_in'].includes(b.status)
      );

      if (validBooking) {
        const generateKeyData = {
          bookingId: validBooking._id,
          type: 'primary',
          maxUses: 10,
          securitySettings: {
            requirePin: false,
            allowSharing: true,
            maxSharedUsers: 3,
            requireApproval: false
          }
        };

        const generateResponse = await axios.post(
          `${BASE_URL}/digital-keys/generate`,
          generateKeyData,
          { headers }
        );
        console.log('✅ Key generated successfully:', {
          id: generateResponse.data.data._id,
          keyCode: generateResponse.data.data.keyCode,
          room: generateResponse.data.data.roomId.number
        });

        const newKeyId = generateResponse.data.data._id;

        // Test 5: Get specific key details
        console.log('📋 Test 5: Get specific key details');
        const keyDetailsResponse = await axios.get(`${BASE_URL}/digital-keys/${newKeyId}`, { headers });
        console.log('✅ Key details retrieved:', {
          id: keyDetailsResponse.data.data._id,
          status: keyDetailsResponse.data.data.status,
          qrCode: keyDetailsResponse.data.data.qrCode ? 'Present' : 'Missing'
        });
        console.log('');

        // Test 6: Share the key
        console.log('📋 Test 6: Share digital key');
        const shareData = {
          email: 'friend@example.com',
          name: 'John Friend',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
        };

        const shareResponse = await axios.post(
          `${BASE_URL}/digital-keys/${newKeyId}/share`,
          shareData,
          { headers }
        );
        console.log('✅ Key shared successfully:', shareResponse.data.message);
        console.log('');

        // Test 7: Get key access logs
        console.log('📋 Test 7: Get key access logs');
        const logsResponse = await axios.get(`${BASE_URL}/digital-keys/${newKeyId}/logs`, { headers });
        console.log(`✅ Found ${logsResponse.data.data.logs.length} access logs`);
        console.log('Recent logs:', logsResponse.data.data.logs.slice(0, 3).map(log => ({
          action: log.action,
          timestamp: log.timestamp
        })));
        console.log('');

        // Test 8: Validate a key (simulate door access)
        console.log('📋 Test 8: Validate digital key');
        const validateData = {
          pin: null,
          deviceInfo: {
            userAgent: 'Test Device',
            ipAddress: '192.168.1.100',
            location: 'Hotel Lobby'
          }
        };

        const validateResponse = await axios.post(
          `${BASE_URL}/digital-keys/validate/${keyDetailsResponse.data.data.keyCode}`,
          validateData,
          { headers }
        );
        console.log('✅ Key validated successfully:', validateResponse.data.message);
        console.log('Access granted to:', validateResponse.data.data.roomNumber);
        console.log('');

        // Test 9: Test key with PIN (if PIN is required)
        if (keyDetailsResponse.data.data.securitySettings.requirePin) {
          console.log('📋 Test 9: Validate key with PIN');
          const validateWithPinData = {
            pin: keyDetailsResponse.data.data.securitySettings.pin,
            deviceInfo: {
              userAgent: 'Test Device with PIN',
              ipAddress: '192.168.1.101'
            }
          };

          const validatePinResponse = await axios.post(
            `${BASE_URL}/digital-keys/validate/${keyDetailsResponse.data.data.keyCode}`,
            validateWithPinData,
            { headers }
          );
          console.log('✅ Key validated with PIN successfully');
          console.log('');
        }

        // Test 10: Revoke shared access
        console.log('📋 Test 10: Revoke shared access');
        const revokeShareResponse = await axios.delete(
          `${BASE_URL}/digital-keys/${newKeyId}/share/friend@example.com`,
          { headers }
        );
        console.log('✅ Shared access revoked successfully:', revokeShareResponse.data.message);
        console.log('');

        // Test 11: Revoke the key
        console.log('📋 Test 11: Revoke digital key');
        const revokeResponse = await axios.delete(`${BASE_URL}/digital-keys/${newKeyId}`, { headers });
        console.log('✅ Key revoked successfully:', revokeResponse.data.message);
        console.log('');

      } else {
        console.log('⚠️ No valid bookings found for key generation test');
      }

    } catch (error) {
      console.error('❌ Key generation/management test failed:', error.response?.data?.message || error.message);
    }

    // Test 12: Test pagination
    console.log('📋 Test 12: Test pagination');
    const paginationResponse = await axios.get(`${BASE_URL}/digital-keys?page=1&limit=5`, { headers });
    console.log('✅ Pagination test successful:', {
      currentPage: paginationResponse.data.data.pagination.currentPage,
      totalPages: paginationResponse.data.data.pagination.totalPages,
      totalItems: paginationResponse.data.data.pagination.totalItems,
      hasNext: paginationResponse.data.data.pagination.hasNext,
      hasPrev: paginationResponse.data.data.pagination.hasPrev
    });
    console.log('');

    // Test 13: Test filtering
    console.log('📋 Test 13: Test filtering');
    const filterResponse = await axios.get(`${BASE_URL}/digital-keys?status=active&type=primary`, { headers });
    console.log(`✅ Filter test successful: Found ${filterResponse.data.data.keys.length} active primary keys`);
    console.log('');

    console.log('🎉 All Digital Keys System tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data?.error) {
      console.error('Error details:', error.response.data.error);
    }
  }
}

// Run the tests
testDigitalKeysSystem().catch(console.error);
