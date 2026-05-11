import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testDataPersistence() {
  console.log('\n🔄 Testing Data Persistence After Update...\n');

  try {
    // 1. Login first
    console.log('1. Authenticating...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hotel.com',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Authentication successful');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 2. Get current security settings
    console.log('\n2. Getting current security settings...');
    const getCurrentResponse = await fetch(`${BASE_URL}/hotel-settings/security`, { headers });
    const currentData = await getCurrentResponse.json();
    console.log('Current settings:', {
      requireTwoFactor: currentData.data.security.requireTwoFactor,
      sessionTimeout: currentData.data.security.sessionSettings?.timeout,
      passwordExpiry: currentData.data.security.passwordPolicy?.expireDays
    });

    // 3. Update with new values
    console.log('\n3. Updating security settings with new values...');
    const newValues = {
      requireTwoFactor: !currentData.data.security.requireTwoFactor, // Toggle this
      sessionSettings: {
        timeout: 120, // Change timeout to 120 minutes
        maxConcurrentSessions: 3 // Change max sessions to 3
      },
      passwordPolicy: {
        expireDays: 60, // Change to 60 days
        minLength: 10,
        requireNumbers: true,
        requireUppercase: true,
        requireSymbols: true
      },
      auditLog: true,
      ipRestrictions: []
    };

    console.log('New values being set:', {
      requireTwoFactor: newValues.requireTwoFactor,
      sessionTimeout: newValues.sessionSettings.timeout,
      passwordExpiry: newValues.passwordPolicy.expireDays,
      maxConcurrentSessions: newValues.sessionSettings.maxConcurrentSessions
    });

    const updateResponse = await fetch(`${BASE_URL}/hotel-settings/security`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(newValues)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Update failed: ${updateResponse.status} - ${errorText}`);
    }

    const updateResult = await updateResponse.json();
    console.log('✅ Update successful');

    // 4. Immediately fetch again to verify persistence
    console.log('\n4. Fetching again to verify persistence...');
    const verifyResponse = await fetch(`${BASE_URL}/hotel-settings/security`, { headers });
    const verifyData = await verifyResponse.json();

    console.log('Verified values from database:', {
      requireTwoFactor: verifyData.data.security.requireTwoFactor,
      sessionTimeout: verifyData.data.security.sessionSettings?.timeout,
      passwordExpiry: verifyData.data.security.passwordPolicy?.expireDays,
      maxConcurrentSessions: verifyData.data.security.sessionSettings?.maxConcurrentSessions
    });

    // 5. Check if values match
    const valuesMatch = {
      requireTwoFactor: verifyData.data.security.requireTwoFactor === newValues.requireTwoFactor,
      sessionTimeout: verifyData.data.security.sessionSettings?.timeout === newValues.sessionSettings.timeout,
      passwordExpiry: verifyData.data.security.passwordPolicy?.expireDays === newValues.passwordPolicy.expireDays,
      maxConcurrentSessions: verifyData.data.security.sessionSettings?.maxConcurrentSessions === newValues.sessionSettings.maxConcurrentSessions
    };

    console.log('\n5. Data persistence check:');
    console.log('✅ Require Two-Factor:', valuesMatch.requireTwoFactor ? 'PERSISTED' : 'NOT PERSISTED');
    console.log('✅ Session Timeout:', valuesMatch.sessionTimeout ? 'PERSISTED' : 'NOT PERSISTED');
    console.log('✅ Password Expiry:', valuesMatch.passwordExpiry ? 'PERSISTED' : 'NOT PERSISTED');
    console.log('✅ Max Concurrent Sessions:', valuesMatch.maxConcurrentSessions ? 'PERSISTED' : 'NOT PERSISTED');

    const allPersisted = Object.values(valuesMatch).every(match => match);

    if (allPersisted) {
      console.log('\n🎉 ALL VALUES SUCCESSFULLY PERSISTED!');
      console.log('📋 Frontend data refresh should now work correctly.');
      console.log('💡 Try refreshing the page - it should show the updated values.');
    } else {
      console.log('\n⚠️ Some values were not persisted correctly');
      console.log('Values that did not persist:', Object.entries(valuesMatch).filter(([key, match]) => !match).map(([key]) => key));
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   • Data persistence: ${allPersisted ? '✅ Working' : '❌ Has Issues'}`);
    console.log(`   • Backend API: ✅ Working`);
    console.log(`   • Frontend should: ${allPersisted ? '✅ Show updated values on refresh' : '❌ Need investigation'}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testDataPersistence();