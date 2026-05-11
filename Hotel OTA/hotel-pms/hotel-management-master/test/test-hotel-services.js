// Test script for Hotel Services System
const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken = '';

async function testHotelServicesSystem() {
  console.log('🏨 Testing Hotel Services System...\n');

  try {
    // 1. Login to get auth token
    console.log('1. Testing Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, testUser);
    authToken = loginResponse.data.data.token;
    console.log('✅ Login successful\n');

    // 2. Test service types
    console.log('2. Testing Service Types...');
    const typesResponse = await axios.get(`${BASE_URL}/hotel-services/types`);
    console.log('✅ Service types loaded successfully');
    console.log('   Types found:', typesResponse.data.data.length);
    console.log('');

    // 3. Test get all services
    console.log('3. Testing Get All Services...');
    const servicesResponse = await axios.get(`${BASE_URL}/hotel-services`);
    console.log('✅ Services loaded successfully');
    console.log('   Services found:', servicesResponse.data.data.length);
    console.log('');

    // 4. Test featured services
    console.log('4. Testing Featured Services...');
    const featuredResponse = await axios.get(`${BASE_URL}/hotel-services/featured`);
    console.log('✅ Featured services loaded successfully');
    console.log('   Featured services:', featuredResponse.data.data.length);
    console.log('');

    // 5. Test services by type
    console.log('5. Testing Services by Type...');
    const diningResponse = await axios.get(`${BASE_URL}/hotel-services?type=dining`);
    console.log('✅ Dining services loaded successfully');
    console.log('   Dining services:', diningResponse.data.data.length);
    console.log('');

    // 6. Test service search
    console.log('6. Testing Service Search...');
    const searchResponse = await axios.get(`${BASE_URL}/hotel-services?search=spa`);
    console.log('✅ Service search working');
    console.log('   Search results:', searchResponse.data.data.length);
    console.log('');

    // 7. Test specific service details
    if (servicesResponse.data.data.length > 0) {
      const firstService = servicesResponse.data.data[0];
      console.log('7. Testing Service Details...');
      const serviceDetailResponse = await axios.get(`${BASE_URL}/hotel-services/${firstService._id}`);
      console.log('✅ Service details loaded successfully');
      console.log('   Service name:', serviceDetailResponse.data.data.name);
      console.log('   Service type:', serviceDetailResponse.data.data.type);
      console.log('   Service price:', serviceDetailResponse.data.data.price);
      console.log('');

      // 8. Test availability check
      console.log('8. Testing Availability Check...');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toISOString().split('T')[0];
      
      const availabilityResponse = await axios.get(`${BASE_URL}/hotel-services/${firstService._id}/availability`, {
        params: { date: dateString, people: 2 }
      });
      console.log('✅ Availability check working');
      console.log('   Available:', availabilityResponse.data.data.available);
      console.log('');

      // 9. Test service booking (if available)
      if (availabilityResponse.data.data.available) {
        console.log('9. Testing Service Booking...');
        const bookingData = {
          bookingDate: tomorrow.toISOString(),
          numberOfPeople: 2,
          specialRequests: 'Test booking request'
        };
        
        const bookingResponse = await axios.post(
          `${BASE_URL}/hotel-services/${firstService._id}/bookings`,
          bookingData,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('✅ Service booking created successfully');
        console.log('   Booking ID:', bookingResponse.data.data.booking._id);
        console.log('   Total amount:', bookingResponse.data.data.booking.totalAmount);
        console.log('');

        // 10. Test get user bookings
        console.log('10. Testing Get User Bookings...');
        const userBookingsResponse = await axios.get(`${BASE_URL}/hotel-services/bookings`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✅ User bookings loaded successfully');
        console.log('   User bookings:', userBookingsResponse.data.data.bookings.length);
        console.log('');

        // 11. Test booking details
        if (userBookingsResponse.data.data.bookings.length > 0) {
          const firstBooking = userBookingsResponse.data.data.bookings[0];
          console.log('11. Testing Booking Details...');
          const bookingDetailResponse = await axios.get(
            `${BASE_URL}/hotel-services/bookings/${firstBooking._id}`,
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          console.log('✅ Booking details loaded successfully');
          console.log('   Booking status:', bookingDetailResponse.data.data.status);
          console.log('');

          // 12. Test booking cancellation
          console.log('12. Testing Booking Cancellation...');
          const cancelData = { reason: 'Test cancellation' };
          const cancelResponse = await axios.post(
            `${BASE_URL}/hotel-services/bookings/${firstBooking._id}/cancel`,
            cancelData,
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          console.log('✅ Booking cancelled successfully');
          console.log('   New status:', cancelResponse.data.data.booking.status);
          console.log('');
        }
      }
    }

    console.log('🎉 All hotel services system tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Make sure you have a valid user account in the database');
    }
    
    if (error.response?.status === 404) {
      console.log('💡 Make sure you have hotel services in the database');
    }
  }
}

// Run the test
testHotelServicesSystem();
