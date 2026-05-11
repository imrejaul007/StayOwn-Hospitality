import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';
const CREDENTIALS = {
  guest: { email: 'john@example.com', password: 'guest123' }
};

async function makeRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    return response.data;
  } catch (err) {
    console.error('Request failed:', err.response?.data || err.message);
    throw err;
  }
}

async function testAuth() {
  try {
    console.log('Testing authentication...');
    const guestLogin = await makeRequest('POST', '/auth/login', CREDENTIALS.guest);
    console.log('Guest login response:', JSON.stringify(guestLogin, null, 2));
    console.log('Token exists:', !!guestLogin.token);
    console.log('User exists:', !!guestLogin.user);
  } catch (err) {
    console.error('Auth test failed:', err.message);
  }
}

testAuth();