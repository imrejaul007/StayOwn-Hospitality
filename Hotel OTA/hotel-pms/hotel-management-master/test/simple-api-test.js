import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

// Login credentials
const loginCredentials = {
  email: 'admin@hotel.com',
  password: 'admin123'
};

async function getAuthToken() {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginCredentials)
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Authentication failed:', error.message);
    throw error;
  }
}

async function testBasicEndpoints() {
  console.log('\n🔍 Testing Basic API Functionality...\n');

  try {
    // Authenticate
    console.log('1. Authenticating...');
    const token = await getAuthToken();
    console.log('✅ Authentication successful');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Test API Keys GET
    console.log('\n2. Testing GET API keys...');
    const apiKeysResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });
    const apiKeysData = await apiKeysResponse.json();

    console.log(`Status: ${apiKeysResponse.status}`);
    console.log(`Response:`, JSON.stringify(apiKeysData, null, 2));

    if (apiKeysResponse.ok) {
      console.log('✅ GET API keys - Working');
      console.log(`Found ${apiKeysData.data?.length || 0} existing API keys`);
    } else {
      console.log('❌ GET API keys - Failed');
    }

    // Test Hotel Settings Security
    console.log('\n3. Testing GET hotel settings security...');
    const securityResponse = await fetch(`${BASE_URL}/hotel-settings/security`, { headers });
    const securityData = await securityResponse.json();

    console.log(`Status: ${securityResponse.status}`);
    console.log(`Response:`, JSON.stringify(securityData, null, 2));

    if (securityResponse.ok) {
      console.log('✅ GET security settings - Working');
    } else {
      console.log('❌ GET security settings - Failed');
    }

    // Test System Settings
    console.log('\n4. Testing GET system settings...');
    const systemResponse = await fetch(`${BASE_URL}/system/settings`, { headers });

    console.log(`Status: ${systemResponse.status}`);

    if (systemResponse.ok) {
      const systemData = await systemResponse.json();
      console.log(`Response:`, JSON.stringify(systemData, null, 2));
      console.log('✅ GET system settings - Working');
    } else {
      console.log('❌ GET system settings - Failed (this endpoint might not exist)');
    }

    // Test Backup endpoint
    console.log('\n5. Testing backup availability...');
    const backupResponse = await fetch(`${BASE_URL}/hotel-settings/backup`, {
      method: 'GET',
      headers
    });

    console.log(`Status: ${backupResponse.status}`);

    if (backupResponse.ok) {
      console.log('✅ Backup endpoint - Working');
    } else {
      const backupError = await backupResponse.text();
      console.log('❌ Backup endpoint - Failed');
      console.log('Error:', backupError);
    }

    console.log('\n🎉 Basic endpoint testing completed!');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure the backend server is running on http://localhost:4000');
    }
  }
}

testBasicEndpoints();