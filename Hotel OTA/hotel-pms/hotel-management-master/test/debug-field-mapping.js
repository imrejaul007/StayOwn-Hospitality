import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

async function debugFieldMapping() {
  console.log('\n🔍 Debugging Field Mapping Issues...\n');

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

    // 2. Get current security settings and analyze structure
    console.log('\n2. Fetching current security settings...');
    const response = await fetch(`${BASE_URL}/hotel-settings/security`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data = await response.json();
    console.log('\n📋 COMPLETE BACKEND RESPONSE:');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n🎯 CURRENT FIELD MAPPING IN FRONTEND:');
    console.log('Frontend Field → Backend Path → Current Value');
    console.log('─'.repeat(60));

    const security = data.data.security;

    console.log(`twoFactorAuth → requireTwoFactor → ${security.requireTwoFactor}`);
    console.log(`sessionTimeout → sessionSettings.timeout → ${security.sessionSettings?.timeout}`);
    console.log(`passwordExpiry → passwordPolicy.expireDays → ${security.passwordPolicy?.expireDays}`);
    console.log(`loginAttempts → sessionSettings.maxConcurrentSessions → ${security.sessionSettings?.maxConcurrentSessions}`);

    console.log('\n❌ PROBLEM IDENTIFIED:');
    console.log('• "Max Login Attempts" is mapped to maxConcurrentSessions');
    console.log('• This should be a separate field for failed login attempt limits');
    console.log('• maxConcurrentSessions is about how many active sessions, not failed attempts');

    console.log('\n💡 BACKEND DATA STRUCTURE ANALYSIS:');
    console.log('Available fields in security settings:');
    Object.keys(security).forEach(key => {
      if (typeof security[key] === 'object' && security[key] !== null) {
        console.log(`• ${key}:`);
        Object.keys(security[key]).forEach(subKey => {
          console.log(`  - ${subKey}: ${security[key][subKey]}`);
        });
      } else {
        console.log(`• ${key}: ${security[key]}`);
      }
    });

    console.log('\n🔧 SUGGESTED FIXES:');
    console.log('1. Add proper maxLoginAttempts field to backend security settings');
    console.log('2. Update frontend mapping to use correct field');
    console.log('3. Separate maxConcurrentSessions from maxLoginAttempts concept');

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
  }
}

debugFieldMapping();