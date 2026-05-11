const axios = require('axios');

async function testServer() {
  try {
    console.log('Testing server health...');
    const healthResponse = await axios.get('http://localhost:4000/health');
    console.log('✅ Health endpoint working:', healthResponse.data);
    
    console.log('\nTesting API documentation...');
    const docsResponse = await axios.get('http://localhost:4000/docs');
    console.log('✅ API docs accessible');
    
    console.log('\n✅ Server is running successfully!');
  } catch (error) {
    console.error('❌ Server test failed:', error.message);
  }
}

testServer();
