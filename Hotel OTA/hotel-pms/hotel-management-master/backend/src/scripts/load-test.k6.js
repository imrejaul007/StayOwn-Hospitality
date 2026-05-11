import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const AUTH_EMAIL = __ENV.AUTH_EMAIL || '';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || '';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 200 },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1200']
  }
};

function login() {
  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    return null;
  }

  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  check(response, {
    'login status is 200': (r) => r.status === 200
  });

  const cookies = response.cookies?.accessToken;
  if (!cookies || !cookies.length) {
    return null;
  }

  return cookies[0].value;
}

export default function () {
  const token = login();
  const headers = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health endpoint healthy': (r) => r.status === 200
  });

  if (token) {
    const bookingsRes = http.get(`${BASE_URL}/bookings?limit=20`, { headers });
    check(bookingsRes, {
      'bookings endpoint OK': (r) => r.status === 200 || r.status === 304
    });

    const meRes = http.get(`${BASE_URL}/auth/me`, { headers });
    check(meRes, {
      'auth/me endpoint OK': (r) => r.status === 200
    });
  }

  sleep(1);
}
