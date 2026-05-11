import fetch from 'node-fetch';

const testNotificationSettings = async () => {
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

  // Test getting notification preferences
  console.log('\n2. Testing get notification preferences...');
  const getResponse = await fetch(`${API_URL}/notifications/preferences`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const getData = await getResponse.json();
  console.log('Get response status:', getResponse.status);
  console.log('Get response:', JSON.stringify(getData, null, 2));

  if (getResponse.ok) {
    console.log('✅ Get notification preferences successful');
  } else {
    console.log('❌ Get notification preferences failed');
  }

  // Test updating notification preferences with the correct API structure
  console.log('\n3. Testing update notification preferences...');
  const updateData = {
    email: {
      enabled: false,
      types: {
        booking_confirmation: true,
        booking_reminder: true,
        booking_cancellation: true,
        payment_success: true,
        payment_failed: true,
        system_alert: false,
        loyalty_points: true,
        service_booking: true,
        service_reminder: true,
        promotional: true,
        welcome: true,
        check_in: true,
        check_out: true,
        review_request: true,
        special_offer: true
      },
      quietHours: {
        enabled: true,
        start: '23:00',
        end: '07:00'
      }
    },
    push: {
      enabled: true,
      types: {
        booking_confirmation: true,
        booking_reminder: true,
        payment_success: true,
        loyalty_points: true,
        system_alert: false,
        booking_cancellation: true,
        payment_failed: true,
        service_booking: true,
        service_reminder: true,
        promotional: true,
        welcome: true,
        check_in: true,
        check_out: true,
        review_request: true,
        special_offer: true
      },
      quietHours: {
        enabled: true,
        start: '23:00',
        end: '07:00'
      }
    },
    inApp: {
      enabled: true,
      sound: false,
      vibration: false,
      showBadge: true,
      types: {
        booking_confirmation: true,
        booking_reminder: true,
        loyalty_points: true,
        system_alert: false,
        welcome: true,
        booking_cancellation: true,
        payment_success: true,
        payment_failed: true,
        service_booking: true,
        service_reminder: true,
        promotional: true,
        check_in: true,
        check_out: true,
        review_request: true,
        special_offer: true
      }
    }
  };

  const updateResponse = await fetch(`${API_URL}/notifications/preferences`, {
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
    console.log('✅ Update notification preferences successful');

    // Verify the update by getting preferences again
    console.log('\n4. Verifying updated preferences...');
    const verifyResponse = await fetch(`${API_URL}/notifications/preferences`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const verifyData = await verifyResponse.json();
    console.log('Verify response:', JSON.stringify(verifyData, null, 2));

    if (verifyResponse.ok) {
      console.log('✅ Notification preferences verification successful');
    } else {
      console.log('❌ Notification preferences verification failed');
    }
  } else {
    console.log('❌ Update notification preferences failed');
  }
};

// Run the test
testNotificationSettings().catch(console.error);