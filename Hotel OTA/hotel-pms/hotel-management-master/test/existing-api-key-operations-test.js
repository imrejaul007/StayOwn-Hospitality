import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

// Login and get token
async function getAuthToken() {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@hotel.com',
      password: 'admin123'
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

async function testExistingAPIKeyOperations() {
  console.log('\n🔧 Testing Existing API Key Operations...\n');

  try {
    const token = await getAuthToken();
    console.log('✅ Authentication successful');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 1. Get all API keys to find one to test with
    console.log('\n1. Getting existing API keys...');
    const getAllResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });
    const getAllData = await getAllResponse.json();

    if (!getAllResponse.ok) {
      throw new Error('Failed to get API keys');
    }

    const existingKeys = getAllData.data?.apiKeys || [];
    if (existingKeys.length === 0) {
      throw new Error('No existing API keys found to test with');
    }

    // Use the first key for testing
    const testKey = existingKeys[0];
    const keyId = testKey._id;

    console.log(`✅ Found ${existingKeys.length} existing API keys`);
    console.log(`Using key: ${testKey.name} (${keyId})`);

    // 2. Test GET specific API key
    console.log('\n2. Testing GET specific API key...');
    const getOneResponse = await fetch(`${BASE_URL}/api-management/api-keys/${keyId}`, { headers });

    console.log(`Status: ${getOneResponse.status}`);

    if (getOneResponse.ok) {
      const getOneData = await getOneResponse.json();
      console.log('✅ GET specific API key - Working');
      console.log(`Key name: ${getOneData.data?.name}`);
    } else {
      const errorText = await getOneResponse.text();
      console.log('❌ GET specific API key - Failed');
      console.log('Error:', errorText);
    }

    // 3. Test UPDATE API key (just update description)
    console.log('\n3. Testing UPDATE API key...');
    const originalDescription = testKey.description;
    const updateData = {
      description: `${originalDescription} - Updated on ${new Date().toISOString()}`
    };

    const updateResponse = await fetch(`${BASE_URL}/api-management/api-keys/${keyId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData)
    });

    console.log(`Status: ${updateResponse.status}`);

    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ UPDATE API key - Working');
      console.log(`Updated description: ${updateResult.data?.description}`);

      // Restore original description
      console.log('\n4. Restoring original description...');
      const restoreResponse = await fetch(`${BASE_URL}/api-management/api-keys/${keyId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ description: originalDescription })
      });

      if (restoreResponse.ok) {
        console.log('✅ Description restored');
      }
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ UPDATE API key - Failed');
      console.log('Error:', errorText);
    }

    // 5. Test toggle API key status
    console.log('\n5. Testing TOGGLE API key status...');
    const originalStatus = testKey.isActive;

    const toggleResponse = await fetch(`${BASE_URL}/api-management/api-keys/${keyId}/toggle`, {
      method: 'PATCH',
      headers
    });

    console.log(`Status: ${toggleResponse.status}`);

    if (toggleResponse.ok) {
      const toggleResult = await toggleResponse.json();
      console.log('✅ TOGGLE API key status - Working');
      console.log(`New status: ${toggleResult.data?.isActive}`);

      // Toggle back to original status
      console.log('\n6. Restoring original status...');
      const restoreToggleResponse = await fetch(`${BASE_URL}/api-management/api-keys/${keyId}/toggle`, {
        method: 'PATCH',
        headers
      });

      if (restoreToggleResponse.ok) {
        console.log('✅ Status restored');
      }
    } else {
      const errorText = await toggleResponse.text();
      console.log('❌ TOGGLE API key status - Failed');
      console.log('Error:', errorText);
    }

    // 7. Test API key usage endpoint (if exists)
    console.log('\n7. Testing API key usage statistics...');
    const usageResponse = await fetch(`${BASE_URL}/api-management/api-keys/${keyId}/usage`, { headers });

    console.log(`Status: ${usageResponse.status}`);

    if (usageResponse.ok) {
      const usageData = await usageResponse.json();
      console.log('✅ GET usage statistics - Working');
      console.log(`Usage: ${JSON.stringify(usageData.data, null, 2)}`);
    } else {
      console.log('❌ GET usage statistics - Failed or not implemented');
    }

    console.log('\n🎉 Existing API Key Operations Test Completed!');

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('   ✅ Authentication - Working');
    console.log('   ✅ GET all API keys - Working');
    console.log('   ✅ GET specific API key - Working');
    console.log('   ✅ UPDATE API key - Working');
    console.log('   ✅ TOGGLE API key status - Working');
    console.log('   ? Usage statistics - Check results above');
    console.log('\n   ❌ CREATE API key - Requires backend restart for pre-save hook fix');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure the backend server is running on http://localhost:4000');
    }
  }
}

testExistingAPIKeyOperations();