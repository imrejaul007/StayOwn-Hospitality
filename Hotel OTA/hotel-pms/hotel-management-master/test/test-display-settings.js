import fetch from 'node-fetch';

const testDisplaySettings = async () => {
  const API_URL = 'http://localhost:4000/api/v1';

  // First login as admin
  console.log('1. Logging in as admin...');
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@hotel.com',
      password: 'admin123'
    })
  });

  const loginData = await loginResponse.json();
  if (!loginData.token) {
    console.error('Failed to login');
    return;
  }

  const token = loginData.token;
  console.log('✅ Login successful');

  // Test getting display preferences
  console.log('\n2. Testing get display preferences...');
  const getResponse = await fetch(`${API_URL}/users/display-preferences`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const getData = await getResponse.json();
  console.log('Get response status:', getResponse.status);
  console.log('Get response:', JSON.stringify(getData, null, 2));

  if (getResponse.ok) {
    console.log('✅ Get display preferences successful');
  } else {
    console.log('❌ Get display preferences failed');

    // Try alternative endpoint
    console.log('\n2a. Trying alternative endpoint /users/settings...');
    const altResponse = await fetch(`${API_URL}/users/settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const altData = await altResponse.json();
    console.log('Alternative response status:', altResponse.status);
    console.log('Alternative response:', JSON.stringify(altData, null, 2));
  }

  // Test updating display preferences
  console.log('\n3. Testing update display preferences...');
  const updateData = {
    theme: 'dark',
    sidebarCollapsed: true,
    compactView: false,
    highContrastMode: true,
    language: 'English',
    currency: 'Indian Rupee (₹)',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24 Hour'
  };

  const updateResponse = await fetch(`${API_URL}/users/display-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updateData)
  });

  const updateResponseData = await updateResponse.json();
  console.log('Update response status:', updateResponse.status);
  console.log('Update response:', JSON.stringify(updateResponseData, null, 2));

  if (updateResponse.ok) {
    console.log('✅ Update display preferences successful');

    // Verify the update by getting preferences again
    console.log('\n4. Verifying updated preferences...');
    const verifyResponse = await fetch(`${API_URL}/users/display-preferences`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const verifyData = await verifyResponse.json();
    console.log('Verify response:', JSON.stringify(verifyData, null, 2));

    if (verifyResponse.ok) {
      console.log('✅ Display preferences verification successful');
    } else {
      console.log('❌ Display preferences verification failed');
    }
  } else {
    console.log('❌ Update display preferences failed');

    // Try alternative update endpoint
    console.log('\n3a. Trying alternative update endpoint /users/settings...');
    const altUpdateResponse = await fetch(`${API_URL}/users/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ display: updateData })
    });

    const altUpdateData = await altUpdateResponse.json();
    console.log('Alternative update response status:', altUpdateResponse.status);
    console.log('Alternative update response:', JSON.stringify(altUpdateData, null, 2));
  }
};

// Run the test
testDisplaySettings().catch(console.error);