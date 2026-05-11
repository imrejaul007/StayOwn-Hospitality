const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';

// Staff credentials
const STAFF_CREDENTIALS = {
  email: 'staff@hotel.com',
  password: 'staff123'
};

let staffToken = null;

async function authenticateStaff() {
  try {
    console.log('🔐 Authenticating staff user...');
    const response = await axios.post(`${BASE_URL}/auth/login`, STAFF_CREDENTIALS);
    staffToken = response.data.token;
    console.log('✅ Staff authentication successful');
    console.log('👤 User info:', {
      id: response.data.user.id,
      name: response.data.user.name,
      role: response.data.user.role,
      hotelId: response.data.user.hotelId
    });
    return response.data.user;
  } catch (error) {
    console.error('❌ Staff authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testStaffDashboardEndpoints() {
  const headers = {
    'Authorization': `Bearer ${staffToken}`,
    'Content-Type': 'application/json'
  };

  const endpoints = [
    '/staff-dashboard/health',
    '/staff-dashboard/today',
    '/staff-dashboard/rooms/status',
    '/staff-dashboard/inventory/summary',
    '/staff-dashboard/activity'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Testing ${endpoint}...`);
      const response = await axios.get(`${BASE_URL}${endpoint}`, { headers });
      console.log('✅ Success:', endpoint);
      console.log('📊 Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error(`❌ Failed ${endpoint}:`, error.response?.data || error.message);
      if (error.response?.status) {
        console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      }
    }
  }
}

async function main() {
  try {
    console.log('🚀 Starting Staff Dashboard API Test\n');

    const user = await authenticateStaff();
    await testStaffDashboardEndpoints();

    console.log('\n✅ Staff Dashboard API Test Completed');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();