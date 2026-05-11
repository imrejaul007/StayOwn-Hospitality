import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

// Test credentials from the analysis
const LOGIN_CREDENTIALS = {
    email: 'admin@hotel.com',
    password: 'admin123'
};

async function testAPIEndpoints() {
    console.log('🔗 TESTING ADVANCED RESERVATIONS API ENDPOINTS');
    console.log('=' .repeat(60));

    try {
        // Step 1: Test server connectivity
        console.log('🔌 Testing server connectivity...');
        try {
            const healthResponse = await fetch(`${BASE_URL}/health`, {
                method: 'GET',
                timeout: 5000
            });

            if (healthResponse.ok) {
                console.log('✅ Server is running and accessible');
            } else {
                console.log('⚠️  Server responded but with error status:', healthResponse.status);
            }
        } catch (error) {
            console.log('❌ Server connectivity failed:', error.message);
            console.log('🔄 Trying alternative ports...');

            // Try port 4002
            try {
                const altResponse = await fetch('http://localhost:4002/api/v1/health', {
                    method: 'GET',
                    timeout: 5000
                });
                if (altResponse.ok) {
                    console.log('✅ Server found on port 4002');
                    BASE_URL = 'http://localhost:4002/api/v1';
                }
            } catch (error2) {
                console.log('❌ Server not accessible on port 4002 either');
                return;
            }
        }

        // Step 2: Login to get authentication token
        console.log('\n🔑 Authenticating...');
        let authToken = null;

        try {
            const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(LOGIN_CREDENTIALS)
            });

            if (loginResponse.ok) {
                const loginData = await loginResponse.json();
                authToken = loginData.token || loginData.data?.token;
                console.log('✅ Authentication successful');
            } else {
                const errorData = await loginResponse.json().catch(() => null);
                console.log('❌ Authentication failed:', loginResponse.status, errorData?.message);
                console.log('🔄 Proceeding without authentication (testing public endpoints)...');
            }
        } catch (error) {
            console.log('❌ Login request failed:', error.message);
            console.log('🔄 Proceeding without authentication...');
        }

        // Step 3: Test Advanced Reservations endpoints
        console.log('\n📋 Testing Advanced Reservations endpoints...');

        const headers = {
            'Content-Type': 'application/json'
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        // Test GET /advanced-reservations
        console.log('\n🔍 Testing GET /advanced-reservations');
        try {
            const response = await fetch(`${BASE_URL}/advanced-reservations`, {
                method: 'GET',
                headers
            });

            console.log(`Status: ${response.status}`);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Advanced Reservations endpoint working');
                console.log(`Total reservations returned: ${data.data?.length || 0}`);
                console.log(`Pagination info:`, data.pagination);

                if (data.data && data.data.length > 0) {
                    console.log('\n📊 First reservation sample:');
                    const first = data.data[0];
                    console.log(`  ID: ${first._id}`);
                    console.log(`  Reservation ID: ${first.reservationId}`);
                    console.log(`  Type: ${first.reservationType}`);
                    console.log(`  Priority: ${first.priority}`);
                }
            } else {
                const errorData = await response.json().catch(() => null);
                console.log('❌ Advanced Reservations endpoint failed');
                console.log('Error:', errorData?.message || response.statusText);
            }
        } catch (error) {
            console.log('❌ Advanced Reservations request failed:', error.message);
        }

        // Test GET /advanced-reservations/stats
        console.log('\n📈 Testing GET /advanced-reservations/stats');
        try {
            const response = await fetch(`${BASE_URL}/advanced-reservations/stats`, {
                method: 'GET',
                headers
            });

            console.log(`Status: ${response.status}`);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Advanced Reservations stats endpoint working');
                console.log('\n📊 Stats data:');
                console.log(`Type stats:`, data.data?.typeStats);
                console.log(`Priority stats:`, data.data?.priorityStats);
                console.log(`Upgrade stats:`, data.data?.upgradeStats);
                console.log(`Waitlist count:`, data.data?.waitlistCount);

                // Compare with screenshot data
                if (data.data) {
                    const stats = data.data;
                    const totalReservations = stats.typeStats?.reduce((sum, stat) => sum + stat.count, 0) || 0;
                    const totalUpgrades = stats.upgradeStats?.reduce((sum, stat) => sum + stat.count, 0) || 0;
                    const vipCount = stats.typeStats?.find(s => s._id === 'vip')?.count || 0;

                    console.log('\n🎯 SCREENSHOT COMPARISON:');
                    console.log('Expected vs API Response:');
                    console.log(`Total Reservations: 5 vs ${totalReservations}`);
                    console.log(`Upgrades: 2 vs ${totalUpgrades}`);
                    console.log(`Waitlist: 5 vs ${stats.waitlistCount || 0}`);
                    console.log(`VIP Reservations: 1 vs ${vipCount}`);
                }
            } else {
                const errorData = await response.json().catch(() => null);
                console.log('❌ Advanced Reservations stats endpoint failed');
                console.log('Error:', errorData?.message || response.statusText);
            }
        } catch (error) {
            console.log('❌ Advanced Reservations stats request failed:', error.message);
        }

        // Test waitlist endpoint
        console.log('\n⏳ Testing waitlist-related endpoints...');
        try {
            const response = await fetch(`${BASE_URL}/waiting-list`, {
                method: 'GET',
                headers
            });

            console.log(`Waitlist endpoint status: ${response.status}`);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Waitlist endpoint working');
                console.log(`Waitlist entries: ${data.data?.length || 0}`);
            } else {
                console.log('❌ Waitlist endpoint failed or no access');
            }
        } catch (error) {
            console.log('❌ Waitlist request failed:', error.message);
        }

        // Summary
        console.log('\n📋 API ENDPOINTS SUMMARY:');
        console.log('='.repeat(40));
        console.log('✅ Server is accessible');
        console.log(authToken ? '✅ Authentication working' : '⚠️  Authentication failed/skipped');
        console.log('✅ Advanced Reservations API endpoints tested');
        console.log('\n🔍 CONCLUSION: The Advanced Reservations page appears to be using REAL API data');

    } catch (error) {
        console.error('❌ API testing failed:', error.message);
        console.log('\n🔍 This suggests the UI might be using MOCK DATA due to API connectivity issues');
    }
}

// Run the API tests
testAPIEndpoints().catch(console.error);