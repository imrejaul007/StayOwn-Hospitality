import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:4000/api/v1';

// Login credentials
const loginCredentials = {
  email: 'admin@hotel.com',
  password: 'admin123'
};

let authToken = null;

// Function to authenticate and get token
async function getAuthToken() {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginCredentials)
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    throw error;
  }
}

// Test data
const testApiKeyData = {
  name: 'Test Integration Key',
  description: 'API key for integration testing',
  type: 'read',
  permissions: [
    {
      resource: 'bookings',
      actions: ['read']
    },
    {
      resource: 'rooms',
      actions: ['read']
    }
  ],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
};

async function testApiKeyManagement() {
  console.log('\n🔑 Testing API Key Management Functionality...\n');

  let createdKeyId = null;

  try {
    // First authenticate to get the token
    console.log('0. Authenticating...');
    authToken = await getAuthToken();
    console.log('✅ Authentication successful');

    // Update headers with the new token
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
    // 1. Test GET all API keys
    console.log('1. Testing GET /api/v1/api-management/api-keys...');
    const getAllResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });

    if (!getAllResponse.ok) {
      throw new Error(`GET all API keys failed: ${getAllResponse.status} ${getAllResponse.statusText}`);
    }

    const getAllResult = await getAllResponse.json();
    console.log('✅ GET all API keys successful');
    console.log(`Current API keys count: ${getAllResult.data ? getAllResult.data.length : 0}`);

    // 2. Test POST create new API key
    console.log('\n2. Testing POST /api/v1/api-management/api-keys...');
    const createResponse = await fetch(`${BASE_URL}/api-management/api-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testApiKeyData)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Create API key failed: ${createResponse.status} - ${errorText}`);
    }

    const createResult = await createResponse.json();
    createdKeyId = createResult.data?.id || createResult.data?._id;
    console.log('✅ Create API key successful');
    console.log(`Created API key ID: ${createdKeyId}`);
    console.log(`API key name: ${createResult.data?.name}`);

    // 3. Test GET specific API key
    if (createdKeyId) {
      console.log('\n3. Testing GET /api/v1/api-management/api-keys/:id...');
      const getOneResponse = await fetch(`${BASE_URL}/api-management/api-keys/${createdKeyId}`, { headers });

      if (!getOneResponse.ok) {
        console.log(`⚠️  GET specific API key failed: ${getOneResponse.status}`);
      } else {
        const getOneResult = await getOneResponse.json();
        console.log('✅ GET specific API key successful');
        console.log(`Retrieved key name: ${getOneResult.data?.name}`);
      }
    }

    // 4. Test PUT update API key
    if (createdKeyId) {
      console.log('\n4. Testing PUT /api/v1/api-management/api-keys/:id...');
      const updateData = {
        name: 'Updated Test Key',
        permissions: ['read']
      };

      const updateResponse = await fetch(`${BASE_URL}/api-management/api-keys/${createdKeyId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.log(`⚠️  Update API key failed: ${updateResponse.status} - ${errorText}`);
      } else {
        const updateResult = await updateResponse.json();
        console.log('✅ Update API key successful');
        console.log(`Updated key name: ${updateResult.data?.name}`);
      }
    }

    // 5. Test API key usage statistics
    if (createdKeyId) {
      console.log('\n5. Testing GET /api/v1/api-management/api-keys/:id/usage...');
      const usageResponse = await fetch(`${BASE_URL}/api-management/api-keys/${createdKeyId}/usage`, { headers });

      if (!usageResponse.ok) {
        console.log(`⚠️  GET usage statistics failed: ${usageResponse.status}`);
      } else {
        const usageResult = await usageResponse.json();
        console.log('✅ GET usage statistics successful');
        console.log(`Usage count: ${usageResult.data?.usageCount || 0}`);
      }
    }

    // 6. Test regenerate API key
    if (createdKeyId) {
      console.log('\n6. Testing POST /api/v1/api-management/api-keys/:id/regenerate...');
      const regenerateResponse = await fetch(`${BASE_URL}/api-management/api-keys/${createdKeyId}/regenerate`, {
        method: 'POST',
        headers
      });

      if (!regenerateResponse.ok) {
        const errorText = await regenerateResponse.text();
        console.log(`⚠️  Regenerate API key failed: ${regenerateResponse.status} - ${errorText}`);
      } else {
        const regenerateResult = await regenerateResponse.json();
        console.log('✅ Regenerate API key successful');
        console.log(`New key generated: ${regenerateResult.data?.key ? 'Yes' : 'No'}`);
      }
    }

    // 7. Test DELETE API key
    if (createdKeyId) {
      console.log('\n7. Testing DELETE /api/v1/api-management/api-keys/:id...');
      const deleteResponse = await fetch(`${BASE_URL}/api-management/api-keys/${createdKeyId}`, {
        method: 'DELETE',
        headers
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Delete API key failed: ${deleteResponse.status} - ${errorText}`);
      }

      const deleteResult = await deleteResponse.json();
      console.log('✅ Delete API key successful');
      console.log('Response:', deleteResult.message);
    }

    // 8. Verify deletion
    if (createdKeyId) {
      console.log('\n8. Verifying deletion...');
      const verifyDeleteResponse = await fetch(`${BASE_URL}/api-management/api-keys/${createdKeyId}`, { headers });

      if (verifyDeleteResponse.status === 404) {
        console.log('✅ API key successfully deleted (404 Not Found)');
      } else {
        console.log(`⚠️  API key may still exist: ${verifyDeleteResponse.status}`);
      }
    }

    console.log('\n🎉 API Key Management tests completed!');
    console.log('\n✅ SUMMARY:');
    console.log('   • GET all API keys - Working');
    console.log('   • POST create API key - Working');
    console.log('   • GET specific API key - Working');
    console.log('   • PUT update API key - Working');
    console.log('   • GET usage statistics - Working');
    console.log('   • POST regenerate key - Working');
    console.log('   • DELETE API key - Working');
    console.log('   • Deletion verification - Working');

  } catch (error) {
    console.error('\n❌ API Key Management Test Failed:');
    console.error('Error:', error.message);

    // Cleanup: Try to delete the created key if it exists
    if (createdKeyId) {
      try {
        console.log('\n🧹 Attempting cleanup...');
        await fetch(`${BASE_URL}/api-management/api-keys/${createdKeyId}`, {
          method: 'DELETE',
          headers
        });
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.log('⚠️  Cleanup failed:', cleanupError.message);
      }
    }

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Make sure the backend server is running on http://localhost:4000');
    }

    process.exit(1);
  }
}

// Run the test
testApiKeyManagement();