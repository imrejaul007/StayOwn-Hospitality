// Test script for Meet-Up Requests System
const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken = '';

async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, testUser);
    authToken = response.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testMeetUpRequestsSystem() {
  console.log('🚀 Starting Meet-Up Requests System Tests...\n');

  // Login
  if (!(await login())) {
    return;
  }

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Get all meet-up requests
    console.log('📋 Test 1: Get all meet-up requests');
    const meetUpsResponse = await axios.get(`${BASE_URL}/meet-up-requests`, { headers });
    console.log(`✅ Found ${meetUpsResponse.data.data.meetUps.length} meet-up requests`);
    console.log('Meet-ups:', meetUpsResponse.data.data.meetUps.map(m => ({
      id: m._id,
      title: m.title,
      status: m.status,
      type: m.type
    })));
    console.log('');

    // Test 2: Get pending requests
    console.log('📋 Test 2: Get pending requests');
    const pendingResponse = await axios.get(`${BASE_URL}/meet-up-requests/pending`, { headers });
    console.log(`✅ Found ${pendingResponse.data.data.pendingRequests.length} pending requests`);
    console.log('');

    // Test 3: Get upcoming meet-ups
    console.log('📋 Test 3: Get upcoming meet-ups');
    const upcomingResponse = await axios.get(`${BASE_URL}/meet-up-requests/upcoming`, { headers });
    console.log(`✅ Found ${upcomingResponse.data.data.upcomingMeetUps.length} upcoming meet-ups`);
    console.log('');

    // Test 4: Get meet-up statistics
    console.log('📋 Test 4: Get meet-up statistics');
    const statsResponse = await axios.get(`${BASE_URL}/meet-up-requests/stats/overview`, { headers });
    console.log('✅ Statistics retrieved:', statsResponse.data.data);
    console.log('');

    // Test 5: Search for potential partners
    console.log('📋 Test 5: Search for potential partners');
    const partnersResponse = await axios.get(`${BASE_URL}/meet-up-requests/search/partners`, { headers });
    console.log(`✅ Found ${partnersResponse.data.data.users.length} potential partners`);
    console.log('Partners:', partnersResponse.data.data.users.map(p => ({
      id: p._id,
      name: p.name,
      email: p.email
    })));
    console.log('');

    // Test 6: Create a new meet-up request (if we have potential partners)
    console.log('📋 Test 6: Create new meet-up request');
    try {
      if (partnersResponse.data.data.users.length > 0) {
        const targetUser = partnersResponse.data.data.users[0];
        
        // First, let's get user's bookings to find a hotel ID
        const bookingsResponse = await axios.get(`${BASE_URL}/bookings`, { headers });
        const userBooking = bookingsResponse.data.data.bookings[0];

        if (userBooking) {
          const createMeetUpData = {
            targetUserId: targetUser._id,
            hotelId: userBooking.hotelId._id,
            type: 'casual',
            title: 'Coffee Meet-up',
            description: 'Let\'s grab a coffee and chat!',
            proposedDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
            proposedTime: {
              start: '14:00',
              end: '15:00'
            },
            location: {
              type: 'restaurant',
              name: 'Hotel Coffee Shop',
              details: 'Main lobby coffee shop'
            },
            participants: {
              maxParticipants: 4
            },
            preferences: {
              interests: ['coffee', 'networking'],
              languages: ['English'],
              ageGroup: 'any',
              gender: 'any'
            },
            communication: {
              preferredMethod: 'in_app',
              contactInfo: {
                email: 'test@example.com'
              }
            },
            activity: {
              type: 'coffee',
              duration: 60,
              cost: 0,
              costSharing: false
            },
            safety: {
              verifiedOnly: false,
              publicLocation: true,
              hotelStaffPresent: true
            },
            metadata: {
              tags: ['casual', 'networking'],
              category: 'leisure',
              difficulty: 'easy'
            }
          };

          const createResponse = await axios.post(
            `${BASE_URL}/meet-up-requests`,
            createMeetUpData,
            { headers }
          );
          console.log('✅ Meet-up request created successfully:', {
            id: createResponse.data.data._id,
            title: createResponse.data.data.title,
            status: createResponse.data.data.status
          });

          const newMeetUpId = createResponse.data.data._id;

          // Test 7: Get specific meet-up request
          console.log('📋 Test 7: Get specific meet-up request');
          const meetUpDetailsResponse = await axios.get(`${BASE_URL}/meet-up-requests/${newMeetUpId}`, { headers });
          console.log('✅ Meet-up details retrieved:', {
            id: meetUpDetailsResponse.data.data._id,
            title: meetUpDetailsResponse.data.data.title,
            status: meetUpDetailsResponse.data.data.status
          });
          console.log('');

          // Test 8: Accept meet-up request (if we're the target user)
          if (meetUpDetailsResponse.data.data.targetUserId._id === testUser.id) {
            console.log('📋 Test 8: Accept meet-up request');
            const acceptData = {
              message: 'Sounds great! Looking forward to it.'
            };

            const acceptResponse = await axios.post(
              `${BASE_URL}/meet-up-requests/${newMeetUpId}/accept`,
              acceptData,
              { headers }
            );
            console.log('✅ Meet-up request accepted successfully:', acceptResponse.data.message);
            console.log('');

            // Test 9: Add participant to meet-up
            console.log('📋 Test 9: Add participant to meet-up');
            const addParticipantData = {
              userId: targetUser._id,
              name: targetUser.name,
              email: targetUser.email
            };

            const addParticipantResponse = await axios.post(
              `${BASE_URL}/meet-up-requests/${newMeetUpId}/participants`,
              addParticipantData,
              { headers }
            );
            console.log('✅ Participant added successfully:', addParticipantResponse.data.message);
            console.log('');

            // Test 10: Complete meet-up request
            console.log('📋 Test 10: Complete meet-up request');
            const completeResponse = await axios.post(
              `${BASE_URL}/meet-up-requests/${newMeetUpId}/complete`,
              {},
              { headers }
            );
            console.log('✅ Meet-up marked as completed:', completeResponse.data.message);
            console.log('');

          } else {
            console.log('⚠️ Skipping accept/complete tests - not the target user');
          }

        } else {
          console.log('⚠️ No bookings found for meet-up creation test');
        }

      } else {
        console.log('⚠️ No potential partners found for meet-up creation test');
      }

    } catch (error) {
      console.error('❌ Meet-up creation/management test failed:', error.response?.data?.message || error.message);
    }

    // Test 11: Test pagination
    console.log('📋 Test 11: Test pagination');
    const paginationResponse = await axios.get(`${BASE_URL}/meet-up-requests?page=1&limit=5`, { headers });
    console.log('✅ Pagination test successful:', {
      currentPage: paginationResponse.data.data.pagination.currentPage,
      totalPages: paginationResponse.data.data.pagination.totalPages,
      totalItems: paginationResponse.data.data.pagination.totalItems,
      hasNext: paginationResponse.data.data.pagination.hasNext,
      hasPrev: paginationResponse.data.data.pagination.hasPrev
    });
    console.log('');

    // Test 12: Test filtering
    console.log('📋 Test 12: Test filtering');
    const filterResponse = await axios.get(`${BASE_URL}/meet-up-requests?status=pending&type=casual`, { headers });
    console.log(`✅ Filter test successful: Found ${filterResponse.data.data.meetUps.length} pending casual meet-ups`);
    console.log('');

    // Test 13: Test partner search with filters
    console.log('📋 Test 13: Test partner search with filters');
    const searchFilterResponse = await axios.get(`${BASE_URL}/meet-up-requests/search/partners?interests=coffee&languages=English`, { headers });
    console.log(`✅ Partner search filter test successful: Found ${searchFilterResponse.data.data.users.length} partners with coffee interest and English language`);
    console.log('');

    console.log('🎉 All Meet-Up Requests System tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data?.error) {
      console.error('Error details:', error.response.data.error);
    }
  }
}

// Run the tests
testMeetUpRequestsSystem().catch(console.error);
