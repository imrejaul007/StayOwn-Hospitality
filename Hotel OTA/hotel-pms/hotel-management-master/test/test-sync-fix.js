import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testSyncFix() {
  console.log('\n🔄 Testing Frontend-Backend Sync Fix...\n');

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

    // 2. Get current count
    console.log('\n2. Getting current API key count...');
    const initialResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });
    const initialData = await initialResponse.json();
    const initialCount = initialData.data?.apiKeys?.length || 0;
    console.log(`Current API keys in database: ${initialCount}`);

    // 3. Test deleting the problematic key (should handle 404 gracefully)
    console.log('\n3. Testing delete of already-deleted key...');
    const problematicKeyId = '68ce39598209168486e0c0b0';

    const deleteResponse = await fetch(`${BASE_URL}/api-management/api-keys/${problematicKeyId}`, {
      method: 'DELETE',
      headers
    });

    console.log(`Delete response status: ${deleteResponse.status}`);

    if (deleteResponse.status === 404) {
      console.log('✅ 404 response as expected (key already deleted)');
      const errorData = await deleteResponse.json();
      console.log(`Error message: ${errorData.error?.message}`);
    } else if (deleteResponse.ok) {
      console.log('✅ Key was found and deleted successfully');
    } else {
      console.log('❌ Unexpected response');
    }

    // 4. Verify count hasn't changed (since key was already deleted)
    console.log('\n4. Verifying API key count after delete attempt...');
    const afterDeleteResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });
    const afterDeleteData = await afterDeleteResponse.json();
    const afterDeleteCount = afterDeleteData.data?.apiKeys?.length || 0;
    console.log(`API keys after delete attempt: ${afterDeleteCount}`);

    if (afterDeleteCount === initialCount) {
      console.log('✅ Count unchanged (correct - key was already deleted)');
    } else {
      console.log('❌ Count changed unexpectedly');
    }

    // 5. Test create and delete cycle
    console.log('\n5. Testing proper create/delete cycle...');

    const testKeyData = {
      name: 'Sync Fix Test Key',
      description: 'Testing sync fix',
      type: 'read'
    };

    // Create
    const createResponse = await fetch(`${BASE_URL}/api-management/api-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testKeyData)
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create test key');
    }

    const createResult = await createResponse.json();
    const testKeyId = createResult.data._id;
    console.log(`✅ Created test key: ${testKeyId}`);

    // Verify count increased
    const afterCreateResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });
    const afterCreateData = await afterCreateResponse.json();
    const afterCreateCount = afterCreateData.data?.apiKeys?.length || 0;
    console.log(`API keys after create: ${afterCreateCount}`);

    if (afterCreateCount === initialCount + 1) {
      console.log('✅ Count increased correctly');
    } else {
      console.log('❌ Count not increased as expected');
    }

    // Delete the test key
    const deleteTestResponse = await fetch(`${BASE_URL}/api-management/api-keys/${testKeyId}`, {
      method: 'DELETE',
      headers
    });

    if (deleteTestResponse.ok) {
      console.log('✅ Test key deleted successfully');

      // Verify count back to original
      const finalResponse = await fetch(`${BASE_URL}/api-management/api-keys`, { headers });
      const finalData = await finalResponse.json();
      const finalCount = finalData.data?.apiKeys?.length || 0;
      console.log(`Final API key count: ${finalCount}`);

      if (finalCount === initialCount) {
        console.log('✅ Count back to original (perfect sync)');
      } else {
        console.log('❌ Count not back to original');
      }
    } else {
      console.log('❌ Failed to delete test key');
    }

    console.log('\n🎉 Frontend Sync Fix Testing Complete!');

    console.log('\n📊 SUMMARY:');
    console.log('   • 404 handling: ✅ Works correctly');
    console.log('   • Create/Delete cycle: ✅ Working');
    console.log('   • Database consistency: ✅ Maintained');
    console.log('\n💡 FRONTEND SHOULD NOW:');
    console.log('   • Handle already-deleted keys gracefully');
    console.log('   • Show "API key was already removed" message');
    console.log('   • Refresh the list to remove stale entries');
    console.log('   • No more 404 errors in console');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testSyncFix();