// Test script for Loyalty System
const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken = '';

async function testLoyaltySystem() {
  console.log('🧪 Testing Loyalty System...\n');

  try {
    // 1. Login to get auth token
    console.log('1. Testing Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, testUser);
    authToken = loginResponse.data.data.token;
    console.log('✅ Login successful\n');

    // 2. Test loyalty dashboard
    console.log('2. Testing Loyalty Dashboard...');
    const dashboardResponse = await axios.get(`${BASE_URL}/loyalty/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Dashboard loaded successfully');
    console.log('   Points:', dashboardResponse.data.data.user.points);
    console.log('   Tier:', dashboardResponse.data.data.user.tier);
    console.log('   Available Offers:', dashboardResponse.data.data.availableOffers.length);
    console.log('   Recent Transactions:', dashboardResponse.data.data.recentTransactions.length);
    console.log('');

    // 3. Test loyalty points
    console.log('3. Testing Loyalty Points...');
    const pointsResponse = await axios.get(`${BASE_URL}/loyalty/points`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Points loaded successfully');
    console.log('   Total Points:', pointsResponse.data.data.totalPoints);
    console.log('   Active Points:', pointsResponse.data.data.activePoints);
    console.log('');

    // 4. Test loyalty offers
    console.log('4. Testing Loyalty Offers...');
    const offersResponse = await axios.get(`${BASE_URL}/loyalty/offers`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Offers loaded successfully');
    console.log('   Available Offers:', offersResponse.data.data.length);
    console.log('');

    // 5. Test transaction history
    console.log('5. Testing Transaction History...');
    const historyResponse = await axios.get(`${BASE_URL}/loyalty/history`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ History loaded successfully');
    console.log('   Transactions:', historyResponse.data.data.transactions.length);
    console.log('   Total Pages:', historyResponse.data.data.pagination.totalPages);
    console.log('');

    console.log('🎉 All loyalty system tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Make sure you have a valid user account in the database');
    }
  }
}

// Run the test
testLoyaltySystem();
