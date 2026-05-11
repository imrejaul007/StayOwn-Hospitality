const axios = require('axios');

const API_BASE = 'http://localhost:4000/api/v1';

async function testExtraPersonAPI() {
  try {
    console.log('🧪 Testing Extra Person API...\n');

    // First, get list of bookings to find one to test with
    console.log('1. Getting available bookings...');
    const bookingsResponse = await axios.get(`${API_BASE}/bookings?limit=5`);
    const bookings = bookingsResponse.data.data.bookings;

    if (bookings.length === 0) {
      console.log('❌ No bookings found to test with');
      return;
    }

    const testBooking = bookings[0];
    console.log(`✅ Found test booking: ${testBooking.bookingId || testBooking._id}`);

    // 2. Test adding extra person
    console.log('\n2. Adding extra person to booking...');
    const addPersonData = {
      name: 'Prince Kumar',
      type: 'adult',
      age: 25,
      autoCalculateCharges: true
    };

    const addResponse = await axios.post(
      `${API_BASE}/bookings/${testBooking._id}/extra-persons`,
      addPersonData,
      {
        headers: {
          'Authorization': `Bearer YOUR_TOKEN_HERE`, // Replace with actual token if needed
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Extra person added successfully!');
    console.log('Response:', JSON.stringify(addResponse.data, null, 2));

    // 3. Test calculating charges
    console.log('\n3. Calculating extra person charges...');
    const calcResponse = await axios.post(
      `${API_BASE}/bookings/${testBooking._id}/extra-persons/calculate-charges`,
      {},
      {
        headers: {
          'Authorization': `Bearer YOUR_TOKEN_HERE`, // Replace with actual token if needed
        }
      }
    );

    console.log('✅ Charges calculated successfully!');
    console.log('Charge Breakdown:', JSON.stringify(calcResponse.data.data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.log('\n💡 Note: You may need to add proper authentication headers for this test to work fully.');
    }
  }
}

testExtraPersonAPI();