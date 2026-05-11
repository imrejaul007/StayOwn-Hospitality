import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api/v1';

async function testMultiPropertyRoomCounts() {
  try {
    console.log('='.repeat(80));
    console.log('🧪 TESTING MULTI-PROPERTY ROOM COUNTS');
    console.log('='.repeat(80));

    // Step 1: Login
    console.log('\n📝 Step 1: Logging in as admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@hotel.com',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful!');
    console.log('   - Token:', token.substring(0, 20) + '...');

    // Set up axios with auth header
    const api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Step 2: Get all hotels
    console.log('\n📝 Step 2: Fetching all hotels from /admin/hotels...');
    const hotelsResponse = await api.get('/admin/hotels');
    const hotels = hotelsResponse.data.data?.hotels || [];

    console.log(`✅ Received ${hotels.length} hotels:`);
    hotels.forEach((hotel, index) => {
      console.log(`   ${index + 1}. "${hotel.name}"`);
      console.log(`      - ID: ${hotel._id}`);
      console.log(`      - roomCount from /admin/hotels: ${hotel.roomCount}`);
    });

    // Step 3: Get occupancy data for each hotel
    console.log('\n📝 Step 3: Fetching occupancy data for each hotel...');
    console.log('='.repeat(80));

    for (let i = 0; i < hotels.length; i++) {
      const hotel = hotels[i];
      console.log(`\n🏨 Hotel ${i + 1}/${hotels.length}: "${hotel.name}"`);
      console.log(`   - ID: ${hotel._id}`);

      try {
        const occupancyResponse = await api.get(`/admin-dashboard/occupancy?hotelId=${hotel._id}`);
        const data = occupancyResponse.data.data;

        if (data && data.overallMetrics) {
          const metrics = data.overallMetrics;
          console.log(`   ✅ Occupancy API Response:`);
          console.log(`      - totalRooms: ${metrics.totalRooms}`);
          console.log(`      - occupiedRooms: ${metrics.occupiedRooms}`);
          console.log(`      - availableRooms: ${metrics.availableRooms}`);
          console.log(`      - cleaningRooms: ${metrics.cleaningRooms}`);
          console.log(`      - maintenanceRooms: ${metrics.maintenanceRooms}`);
          console.log(`      - outOfOrderRooms: ${metrics.outOfOrderRooms}`);
          console.log(`      - occupancyRate: ${metrics.occupancyRate}%`);
        } else {
          console.log(`   ⚠️  No overallMetrics in response`);
        }
      } catch (error) {
        console.log(`   ❌ Error fetching occupancy:`, error.response?.data?.message || error.message);
      }
    }

    // Step 4: Calculate totals
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));

    let totalRoomsFromHotelsAPI = hotels.reduce((sum, h) => sum + (h.roomCount || 0), 0);
    console.log(`Total rooms from /admin/hotels API: ${totalRoomsFromHotelsAPI}`);

    console.log('\nBreakdown by hotel:');
    hotels.forEach((hotel, index) => {
      console.log(`  ${index + 1}. ${hotel.name}: ${hotel.roomCount || 0} rooms`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testMultiPropertyRoomCounts().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
