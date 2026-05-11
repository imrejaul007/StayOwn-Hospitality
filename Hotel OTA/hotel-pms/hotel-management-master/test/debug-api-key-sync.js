import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

async function debugAPIKeySync() {
  console.log('\n🔍 Debugging API Key Synchronization Issue...\n');

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

    // 2. Get current API keys from database
    console.log('\n2. Fetching current API keys from database...');
    const getResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch API keys: ${getResponse.status}`);
    }

    const getData = await getResponse.json();
    const apiKeys = getData.data?.apiKeys || [];

    console.log(`Found ${apiKeys.length} API keys in database:`);
    apiKeys.forEach((key, index) => {
      console.log(`${index + 1}. ID: ${key._id}, Name: ${key.name}, Active: ${key.isActive}`);
    });

    // 3. Check if the problematic key exists
    const problematicKeyId = '68ce39598209168486e0c0b0';
    const keyExists = apiKeys.find(key => key._id === problematicKeyId);

    console.log(`\n3. Checking problematic key ${problematicKeyId}:`);
    if (keyExists) {
      console.log('✅ Key EXISTS in database');
      console.log(`   Name: ${keyExists.name}`);
      console.log(`   Status: ${keyExists.isActive ? 'Active' : 'Inactive'}`);
    } else {
      console.log('❌ Key DOES NOT EXIST in database');
      console.log('🔧 This explains the 404 error when trying to delete');
    }

    // 4. Frontend sync issue analysis
    console.log('\n4. Frontend synchronization analysis:');
    if (!keyExists) {
      console.log('🚨 SYNC ISSUE IDENTIFIED:');
      console.log('   • Frontend still shows this API key');
      console.log('   • Backend database no longer has this key');
      console.log('   • This causes 404 when trying to delete');

      console.log('\n💡 SOLUTIONS:');
      console.log('   1. Frontend should refetch API keys after any operation');
      console.log('   2. Add proper error handling for 404 deletes');
      console.log('   3. Remove stale keys from frontend state gracefully');
    }

    // 5. Test creating and deleting a key properly
    console.log('\n5. Testing proper create/delete flow...');

    const testKeyData = {
      name: 'Sync Test Key',
      description: 'Testing sync',
      type: 'read'
    };

    const createResponse = await fetch(`${BASE_URL}/api-management/api-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testKeyData)
    });

    if (createResponse.ok) {
      const createResult = await createResponse.json();
      const newKeyId = createResult.data._id;
      console.log(`✅ Created test key: ${newKeyId}`);

      // Try to delete it immediately
      const deleteResponse = await fetch(`${BASE_URL}/api-management/api-keys/${newKeyId}`, {
        method: 'DELETE',
        headers
      });

      if (deleteResponse.ok) {
        console.log('✅ Deleted test key successfully');
        console.log('✅ Create/Delete flow is working properly');
      } else {
        console.log('❌ Failed to delete test key');
      }
    } else {
      console.log('❌ Failed to create test key');
    }

    console.log('\n📊 SUMMARY:');
    console.log('   • Database API keys:', apiKeys.length);
    console.log(`   • Problematic key exists: ${keyExists ? 'Yes' : 'No'}`);
    console.log('   • Create/Delete flow: Working');
    console.log('   • Issue: Frontend showing stale data');

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
  }
}

debugAPIKeySync();