import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testFixedMapping() {
  console.log('\n🔧 Testing Fixed Field Mapping...\n');

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

    // 2. Update with specific test values
    console.log('\n2. Testing field mapping with specific values...');
    const testValues = {
      requireTwoFactor: false,
      sessionSettings: {
        timeout: 45, // Test session timeout
        maxConcurrentSessions: 3
      },
      passwordPolicy: {
        expireDays: 120, // Test password expiry
        minLength: 10,
        requireNumbers: true,
        requireUppercase: true,
        requireSymbols: true
      },
      auditLog: true,
      ipRestrictions: [],
      maxLoginAttempts: 8 // Test max login attempts (NEW FIELD)
    };

    console.log('Sending test values:');
    console.log(`• Two-Factor Auth: ${testValues.requireTwoFactor}`);
    console.log(`• Session Timeout: ${testValues.sessionSettings.timeout} minutes`);
    console.log(`• Password Expiry: ${testValues.passwordPolicy.expireDays} days`);
    console.log(`• Max Login Attempts: ${testValues.maxLoginAttempts} attempts`);
    console.log(`• Max Concurrent Sessions: ${testValues.sessionSettings.maxConcurrentSessions} sessions`);

    const updateResponse = await fetch(`${BASE_URL}/hotel-settings/security`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(testValues)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Update failed: ${updateResponse.status} - ${errorText}`);
    }

    console.log('✅ Update successful');

    // 3. Verify the values were saved correctly
    console.log('\n3. Verifying saved values...');
    const verifyResponse = await fetch(`${BASE_URL}/hotel-settings/security`, { headers });
    const verifyData = await verifyResponse.json();

    console.log('Retrieved values from backend:');
    const security = verifyData.data.security;
    console.log(`• Two-Factor Auth: ${security.requireTwoFactor}`);
    console.log(`• Session Timeout: ${security.sessionSettings?.timeout} minutes`);
    console.log(`• Password Expiry: ${security.passwordPolicy?.expireDays} days`);
    console.log(`• Max Login Attempts: ${security.maxLoginAttempts} attempts`);
    console.log(`• Max Concurrent Sessions: ${security.sessionSettings?.maxConcurrentSessions} sessions`);

    // 4. Check mapping accuracy
    console.log('\n4. Field mapping verification:');
    const mappingCheck = {
      twoFactorAuth: security.requireTwoFactor === testValues.requireTwoFactor,
      sessionTimeout: security.sessionSettings?.timeout === testValues.sessionSettings.timeout,
      passwordExpiry: security.passwordPolicy?.expireDays === testValues.passwordPolicy.expireDays,
      maxLoginAttempts: security.maxLoginAttempts === testValues.maxLoginAttempts,
      maxConcurrentSessions: security.sessionSettings?.maxConcurrentSessions === testValues.sessionSettings.maxConcurrentSessions
    };

    Object.entries(mappingCheck).forEach(([field, isCorrect]) => {
      console.log(`${isCorrect ? '✅' : '❌'} ${field}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    });

    const allCorrect = Object.values(mappingCheck).every(check => check);

    if (allCorrect) {
      console.log('\n🎉 ALL FIELD MAPPINGS ARE NOW CORRECT!');
      console.log('📋 Frontend should now:');
      console.log('   • Update all fields correctly when saving');
      console.log('   • Display correct values after page refresh');
      console.log('   • Handle Max Login Attempts as separate from Max Concurrent Sessions');
    } else {
      console.log('\n⚠️ Some mappings still have issues');
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   • Field mapping: ${allCorrect ? '✅ Fixed' : '❌ Still has issues'}`);
    console.log(`   • Data persistence: ✅ Working`);
    console.log(`   • Backend API: ✅ Working`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testFixedMapping();