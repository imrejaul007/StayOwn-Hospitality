import fetch from 'node-fetch';

const testThemeSwitching = async () => {
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

  // Test theme changes
  const themes = ['light', 'dark', 'auto'];

  for (const themeToTest of themes) {
    console.log(`\n2. Testing theme: ${themeToTest}`);

    const updateResponse = await fetch(`${API_URL}/users/display-preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ theme: themeToTest })
    });

    const updateData = await updateResponse.json();

    if (updateResponse.ok) {
      console.log(`✅ Theme ${themeToTest} saved successfully`);

      // Verify it was saved
      const getResponse = await fetch(`${API_URL}/users/display-preferences`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const getData = await getResponse.json();

      if (getData.data.preferences.theme === themeToTest) {
        console.log(`✅ Theme ${themeToTest} verified in database`);
      } else {
        console.log(`❌ Theme ${themeToTest} not saved correctly. Got: ${getData.data.preferences.theme}`);
      }
    } else {
      console.log(`❌ Failed to save theme ${themeToTest}:`, updateData);
    }
  }

  console.log('\n🎨 Theme switching test completed!');
  console.log('\nFrontend theme switching should now work when you:');
  console.log('1. Go to localhost:5173/admin/settings/display');
  console.log('2. Click on Dark theme');
  console.log('3. Click Save Changes');
  console.log('4. The page background should change to dark theme immediately');
};

// Run the test
testThemeSwitching().catch(console.error);