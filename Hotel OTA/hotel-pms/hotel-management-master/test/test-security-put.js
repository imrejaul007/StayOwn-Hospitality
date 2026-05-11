import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testSecurityPutRoute() {
  console.log('\n🔒 Testing Security PUT Route...\n');

  try {
    // 1. Login first
    console.log('1. Authenticating...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hotel.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Authentication successful');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 2. Test PUT /api/v1/hotel-settings/security
    console.log('\n2. Testing PUT security settings...');
    const updateData = {
      requireTwoFactor: false,
      sessionSettings: {
        timeout: 60,
        maxConcurrentSessions: 5
      },
      passwordPolicy: {
        expireDays: 90,
        minLength: 8,
        requireNumbers: true,
        requireUppercase: true,
        requireSymbols: false
      },
      auditLog: true,
      ipRestrictions: []
    };

    console.log('Request payload:', JSON.stringify(updateData, null, 2));

    const putResponse = await fetch(`${BASE_URL}/hotel-settings/security`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData)
    });

    console.log(`Response Status: ${putResponse.status}`);

    if (putResponse.ok) {
      const putData = await putResponse.json();
      console.log('✅ PUT security settings - Working');
      console.log('Response:', JSON.stringify(putData, null, 2));
    } else {
      const errorText = await putResponse.text();
      console.log('❌ PUT security settings - Failed');
      console.log('Error:', errorText);
    }

    // 3. Test GET to verify the update worked
    console.log('\n3. Verifying update with GET...');
    const getResponse = await fetch(`${BASE_URL}/hotel-settings/security`, { headers });

    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log('✅ GET verification successful');
      console.log('Current security settings:', JSON.stringify(getData.data.security, null, 2));
    } else {
      console.log('❌ GET verification failed');
    }

    console.log('\n🎉 Security PUT Route Test Completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testSecurityPutRoute();