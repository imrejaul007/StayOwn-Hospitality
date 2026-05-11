const testSettingsAPI = async () => {
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
  console.log('Login response:', loginData);

  if (!loginData.token) {
    console.error('Failed to login');
    return;
  }

  const token = loginData.token;
  console.log('Got token:', token.substring(0, 20) + '...');

  // Test profile update
  console.log('\n2. Testing profile update...');
  const profileResponse = await fetch(`${API_URL}/users/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Hotel Admin Updated',
      email: 'admin@thepentouz.com',
      phone: '+91-9876543210',
      timezone: 'Asia/Kolkata',
      language: 'en',
      avatar: null
    })
  });

  const profileData = await profileResponse.json();
  console.log('Profile update response:', profileData);
  console.log('Response status:', profileResponse.status);
  console.log('Response OK:', profileResponse.ok);

  // Test notification settings
  console.log('\n3. Testing notification preferences...');
  const notifResponse = await fetch(`${API_URL}/users/notification-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
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

  const notifData = await notifResponse.json();
  console.log('Notification update response:', notifData);

  // Test display settings
  console.log('\n4. Testing display preferences...');
  const displayResponse = await fetch(`${API_URL}/users/display-preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
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

  const displayData = await displayResponse.json();
  console.log('Display update response:', displayData);
};

// Run the test
testSettingsAPI().catch(error => {
  console.error('Test failed:', error);
});