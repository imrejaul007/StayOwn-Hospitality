import axios from 'axios';

const baseURL = 'http://localhost:3000/api/v1';

async function testStaffAPIEndpoints() {
  console.log('🔄 Testing Staff Dashboard API Endpoints...\n');

  try {
    // Step 1: Test staff login
    console.log('1. Testing staff login...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'staff@hotel.com',
      password: 'staff123'
    });

    const token = loginResponse.data.token;
    const user = loginResponse.data.user;

    console.log('✅ Staff login successful');
    console.log('   User:', user.name, '- Role:', user.role);
    console.log('   Token:', token.substring(0, 20) + '...');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Test staff dashboard endpoints
    console.log('\n2. Testing staff dashboard endpoints...');

    // Test today overview
    console.log('   Testing /staff-dashboard/today...');
    try {
      const todayResponse = await axios.get(`${baseURL}/staff-dashboard/today`, { headers });
      console.log('   ✅ Today overview:', todayResponse.data.data.today);
    } catch (error) {
      console.log('   ❌ Today overview failed:', error.response?.data?.message || error.message);
    }

    // Test room status
    console.log('   Testing /staff-dashboard/rooms/status...');
    try {
      const roomsResponse = await axios.get(`${baseURL}/staff-dashboard/rooms/status`, { headers });
      console.log('   ✅ Room status:', roomsResponse.data.data.summary);
    } catch (error) {
      console.log('   ❌ Room status failed:', error.response?.data?.message || error.message);
    }

    // Test inventory summary
    console.log('   Testing /staff-dashboard/inventory/summary...');
    try {
      const inventoryResponse = await axios.get(`${baseURL}/staff-dashboard/inventory/summary`, { headers });
      console.log('   ✅ Inventory summary:', inventoryResponse.data.data);
    } catch (error) {
      console.log('   ❌ Inventory summary failed:', error.response?.data?.message || error.message);
    }

    // Test activity
    console.log('   Testing /staff-dashboard/activity...');
    try {
      const activityResponse = await axios.get(`${baseURL}/staff-dashboard/activity`, { headers });
      console.log('   ✅ Activity data retrieved');
    } catch (error) {
      console.log('   ❌ Activity failed:', error.response?.data?.message || error.message);
    }

    // Step 3: Test daily routine check endpoints
    console.log('\n3. Testing daily routine check endpoints...');
    try {
      const routineResponse = await axios.get(`${baseURL}/daily-routine-check/my-rooms`, { headers });
      console.log('   ✅ Daily routine rooms:', routineResponse.data.data?.rooms?.length || 0, 'rooms assigned');
    } catch (error) {
      console.log('   ❌ Daily routine check failed:', error.response?.data?.message || error.message);
    }

    // Step 4: Test checkout inventory endpoints
    console.log('\n4. Testing checkout inventory endpoints...');
    try {
      const checkoutResponse = await axios.get(`${baseURL}/checkout-inventory?limit=5`, { headers });
      console.log('   ✅ Checkout inventory:', checkoutResponse.data.data?.checkoutInventories?.length || 0, 'items');
    } catch (error) {
      console.log('   ❌ Checkout inventory failed:', error.response?.data?.message || error.message);
    }

    console.log('\n✅ Staff API testing complete!');

  } catch (error) {
    if (error.response) {
      console.log('❌ Login failed:', error.response.data.message);
      console.log('   Status:', error.response.status);
    } else {
      console.log('❌ Connection failed:', error.message);
      console.log('   Make sure the backend server is running on port 3000');
    }
  }
}

// Run the test
testStaffAPIEndpoints();