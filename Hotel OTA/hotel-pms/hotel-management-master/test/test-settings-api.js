import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api/v1';
let authToken = '';

async function loginAsAdmin() {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@thepentouz.com',
        password: 'Admin@123'
      })
    });

    const data = await response.json();
    if (data.status === 'success') {
      authToken = data.token;
      console.log('✓ Admin login successful');
      return true;
    }
    console.error('✗ Admin login failed:', data.message);
    return false;
  } catch (error) {
    console.error('✗ Admin login error:', error.message);
    return false;
  }
}

async function testProfileUpdate() {
  console.log('\n--- Testing Profile Settings ---');

  try {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'Hotel Admin',
        email: 'admin@thepentouz.com',
        phone: '+91-9876543210',
        timezone: 'Asia/Kolkata',
        language: 'en'
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✓ Profile update successful');
      return true;
    }
    console.error('✗ Profile update failed:', data.message);
    return false;
  } catch (error) {
    console.error('✗ Profile update error:', error.message);
    return false;
  }
}

async function testNotificationSettings() {
  console.log('\n--- Testing Notification Settings ---');

  try {
    const response = await fetch(`${API_URL}/users/notification-preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        channels: {
          inApp: true,
          email: true,
          sms: false,
          push: true
        },
        categories: {
          systemAlerts: true,
          bookingUpdates: true,
          paymentNotifications: true,
          guestRequests: true
        }
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✓ Notification settings update successful');
      return true;
    }
    console.error('✗ Notification settings update failed:', data.message);
    return false;
  } catch (error) {
    console.error('✗ Notification settings error:', error.message);
    return false;
  }
}

async function testDisplaySettings() {
  console.log('\n--- Testing Display Settings ---');

  try {
    const response = await fetch(`${API_URL}/users/display-preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        theme: 'light',
        sidebarCollapsed: false,
        language: 'en',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        currency: 'INR'
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✓ Display settings update successful');
      return true;
    }
    console.error('✗ Display settings update failed:', data.message);
    return false;
  } catch (error) {
    console.error('✗ Display settings error:', error.message);
    return false;
  }
}

async function testHotelSettings() {
  console.log('\n--- Testing Hotel Settings ---');

  try {
    const response = await fetch(`${API_URL}/hotels/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'THE PENTOUZ Hotel',
        address: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        phone: '+91-9876543210',
        email: 'info@thepentouz.com',
        checkInTime: '15:00',
        checkOutTime: '11:00'
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✓ Hotel settings update successful');
      return true;
    }
    console.error('✗ Hotel settings update failed:', data.message);
    return false;
  } catch (error) {
    console.error('✗ Hotel settings error:', error.message);
    return false;
  }
}

async function testSystemSettings() {
  console.log('\n--- Testing System Settings ---');

  try {
    const response = await fetch(`${API_URL}/system/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        twoFactorAuth: false,
        sessionTimeout: 60,
        backupSchedule: 'daily',
        dataRetention: 365,
        autoLogout: true,
        passwordExpiry: 90
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✓ System settings update successful');
      return true;
    }
    console.error('✗ System settings update failed:', data.message);
    return false;
  } catch (error) {
    console.error('✗ System settings error:', error.message);
    return false;
  }
}

async function testIntegrationSettings() {
  console.log('\n--- Testing Integration Settings ---');

  try {
    const response = await fetch(`${API_URL}/integrations/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        payment: {
          stripe: {
            enabled: false,
            publicKey: '',
            secretKey: ''
          },
          razorpay: {
            enabled: false,
            keyId: '',
            keySecret: ''
          }
        }
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✓ Integration settings update successful');
      return true;
    }
    console.error('✗ Integration settings update failed:', data.message);
    return false;
  } catch (error) {
    console.error('✗ Integration settings error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('=== Starting Settings API Tests ===\n');

  if (await loginAsAdmin()) {
    const results = [];
    results.push(await testProfileUpdate());
    results.push(await testNotificationSettings());
    results.push(await testDisplaySettings());
    results.push(await testHotelSettings());
    results.push(await testSystemSettings());
    results.push(await testIntegrationSettings());

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log(`\n=== Test Results: ${passed}/${total} passed ===`);
  } else {
    console.log('\n=== Tests aborted: Login failed ===');
  }
}

// Run tests
runAllTests().catch(console.error);