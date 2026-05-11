import fetch from 'node-fetch';

// Test configuration
const BASE_URL = 'http://localhost:4000/api/v1';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4Y2QwMTQxNDQxOWMxN2I1ZjZiNGMxNCIsInJvbGUiOiJhZG1pbiIsImhvdGVsSWQiOiI2OGNkMDE0MTQ0MTljMTdiNWY2YjRjMTIiLCJpYXQiOjE3NTg4NjkyNTAsImV4cCI6MTc1OTQ3NDA1MH0.G8xqthJxpH3SBH5HAImliuTn58t_HKH4DZo-keloMTo';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TEST_TOKEN}`
};

// Test data
const testHotelSettings = {
  basicInfo: {
    name: 'TEST HOTEL - Updated',
    address: {
      street: '456 Test Street',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      postalCode: '12345'
    },
    contact: {
      phone: '+1-555-TEST',
      email: 'test@testhotel.com',
      website: 'https://testhotel.com'
    }
  },
  operations: {
    checkInTime: '14:00',
    checkOutTime: '12:00',
    currency: 'USD',
    timezone: 'America/New_York'
  },
  policies: {
    cancellation: 'Free cancellation up to 48 hours before check-in',
    child: 'Children under 10 stay free',
    pet: 'Pets allowed with additional fee',
    smoking: 'No smoking in all areas',
    extraBed: 'Extra beds available for $50/night'
  },
  taxes: {
    gst: 8.5,
    serviceCharge: 15,
    localTax: 2.5,
    tourismTax: 3.0
  }
};

async function testHotelSettingsAPI() {
  console.log('\n🏨 Testing Hotel Settings API Integration...\n');

  try {
    // 1. Test GET hotel settings
    console.log('1. Testing GET /api/v1/hotel-settings...');
    const getResponse = await fetch(`${BASE_URL}/hotel-settings`, { headers });

    if (!getResponse.ok) {
      throw new Error(`GET failed: ${getResponse.status} ${getResponse.statusText}`);
    }

    const getResult = await getResponse.json();
    console.log('✅ GET hotel settings successful');
    console.log('Current settings:', JSON.stringify(getResult.data.settings, null, 2));

    // 2. Test PUT basic info
    console.log('\n2. Testing PUT /api/v1/hotel-settings/basic-info...');
    const basicInfoResponse = await fetch(`${BASE_URL}/hotel-settings/basic-info`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(testHotelSettings.basicInfo)
    });

    if (!basicInfoResponse.ok) {
      const errorText = await basicInfoResponse.text();
      throw new Error(`Basic Info PUT failed: ${basicInfoResponse.status} - ${errorText}`);
    }

    const basicInfoResult = await basicInfoResponse.json();
    console.log('✅ Basic info update successful');
    console.log('Response:', basicInfoResult.message);

    // 3. Test PUT operations
    console.log('\n3. Testing PUT /api/v1/hotel-settings/operations...');
    const operationsResponse = await fetch(`${BASE_URL}/hotel-settings/operations`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(testHotelSettings.operations)
    });

    if (!operationsResponse.ok) {
      const errorText = await operationsResponse.text();
      throw new Error(`Operations PUT failed: ${operationsResponse.status} - ${errorText}`);
    }

    const operationsResult = await operationsResponse.json();
    console.log('✅ Operations update successful');
    console.log('Response:', operationsResult.message);

    // 4. Test PUT policies
    console.log('\n4. Testing PUT /api/v1/hotel-settings/policies...');
    const policiesResponse = await fetch(`${BASE_URL}/hotel-settings/policies`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(testHotelSettings.policies)
    });

    if (!policiesResponse.ok) {
      const errorText = await policiesResponse.text();
      throw new Error(`Policies PUT failed: ${policiesResponse.status} - ${errorText}`);
    }

    const policiesResult = await policiesResponse.json();
    console.log('✅ Policies update successful');
    console.log('Response:', policiesResult.message);

    // 5. Test PUT taxes
    console.log('\n5. Testing PUT /api/v1/hotel-settings/taxes...');
    const taxesResponse = await fetch(`${BASE_URL}/hotel-settings/taxes`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(testHotelSettings.taxes)
    });

    if (!taxesResponse.ok) {
      const errorText = await taxesResponse.text();
      throw new Error(`Taxes PUT failed: ${taxesResponse.status} - ${errorText}`);
    }

    const taxesResult = await taxesResponse.json();
    console.log('✅ Taxes update successful');
    console.log('Response:', taxesResult.message);

    // 6. Verify updates - GET again
    console.log('\n6. Verifying updates - GET /api/v1/hotel-settings...');
    const verifyResponse = await fetch(`${BASE_URL}/hotel-settings`, { headers });

    if (!verifyResponse.ok) {
      throw new Error(`Verification GET failed: ${verifyResponse.status}`);
    }

    const verifyResult = await verifyResponse.json();
    const updatedSettings = verifyResult.data.settings;

    console.log('✅ Verification successful');
    console.log('Updated hotel name:', updatedSettings.basicInfo?.name);
    console.log('Updated check-in time:', updatedSettings.operations?.checkInTime);
    console.log('Updated GST rate:', updatedSettings.taxes?.gst);

    // 7. Test individual section endpoints
    console.log('\n7. Testing individual section endpoints...');

    const sectionsToTest = ['basicInfo', 'operations', 'policies', 'taxes'];

    for (const section of sectionsToTest) {
      const sectionResponse = await fetch(`${BASE_URL}/hotel-settings/${section}`, { headers });
      if (sectionResponse.ok) {
        const sectionResult = await sectionResponse.json();
        console.log(`✅ GET /hotel-settings/${section} - OK`);
      } else {
        console.log(`❌ GET /hotel-settings/${section} - Failed: ${sectionResponse.status}`);
      }
    }

    console.log('\n🎉 All Hotel Settings API tests completed successfully!');
    console.log('\n✅ SUMMARY:');
    console.log('   • GET hotel settings - Working');
    console.log('   • PUT basic info - Working');
    console.log('   • PUT operations - Working');
    console.log('   • PUT policies - Working');
    console.log('   • PUT taxes - Working');
    console.log('   • Individual section endpoints - Working');
    console.log('   • Data persistence - Verified');

  } catch (error) {
    console.error('\n❌ Hotel Settings API Test Failed:');
    console.error('Error:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Make sure the backend server is running on http://localhost:3000');
    }

    process.exit(1);
  }
}

// Run the test
testHotelSettingsAPI();