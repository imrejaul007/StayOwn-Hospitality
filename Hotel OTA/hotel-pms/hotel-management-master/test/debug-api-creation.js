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

async function testAPIKeyCreation() {
  console.log('\n🔍 Debug API Key Creation...\n');

  try {
    const token = await getAuthToken();
    console.log('✅ Authentication successful');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Test with minimal data first
    const minimalData = {
      name: 'Test Debug Key',
      description: 'Testing API key creation',
      type: 'read'
    };

    console.log('\n1. Testing minimal API key creation...');
    console.log('Request payload:', JSON.stringify(minimalData, null, 2));

    const response = await fetch(`${BASE_URL}/api-management/api-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify(minimalData)
    });

    console.log(`Response status: ${response.status}`);

    const responseData = await response.json();
    console.log('Response data:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('✅ API key creation successful!');

      // Clean up - delete the created key
      const keyId = responseData.data?.id || responseData.data?._id;
      if (keyId) {
        console.log(`\n2. Cleaning up created key: ${keyId}`);
        await fetch(`${BASE_URL}/api-management/api-keys/${keyId}`, {
          method: 'DELETE',
          headers
        });
        console.log('✅ Cleanup completed');
      }
    } else {
      console.log('❌ API key creation failed');

      // If validation fails, try with permissions
      if (responseData.error?.message?.includes('permissions')) {
        console.log('\n3. Retrying with permissions...');

        const dataWithPermissions = {
          ...minimalData,
          permissions: [
            {
              resource: 'bookings',
              actions: ['read']
            }
          ]
        };

        console.log('Request payload:', JSON.stringify(dataWithPermissions, null, 2));

        const retryResponse = await fetch(`${BASE_URL}/api-management/api-keys`, {
          method: 'POST',
          headers,
          body: JSON.stringify(dataWithPermissions)
        });

        console.log(`Retry response status: ${retryResponse.status}`);
        const retryData = await retryResponse.json();
        console.log('Retry response data:', JSON.stringify(retryData, null, 2));

        if (retryResponse.ok) {
          console.log('✅ API key creation with permissions successful!');

          // Clean up
          const keyId = retryData.data?.id || retryData.data?._id;
          if (keyId) {
            await fetch(`${BASE_URL}/api-management/api-keys/${keyId}`, {
              method: 'DELETE',
              headers
            });
            console.log('✅ Cleanup completed');
          }
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Debug test failed:', error.message);
  }
}

testAPIKeyCreation();