import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const baseUrl = 'http://localhost:3007';

  // Search properties
  const searchRes = http.get(`${baseUrl}/api/habixo/search?city=Bangalore`);
  check(searchRes, { 'search status 200': (r) => r.status === 200 });

  // Get property detail
  const propRes = http.get(`${baseUrl}/api/habixo/properties`);
  if (propRes.status === 200) {
    const props = JSON.parse(propRes.body);
    if (props.data && props.data.length > 0) {
      const propId = props.data[0].propertyId;
      http.get(`${baseUrl}/api/habixo/properties/${propId}`);
    }
  }

  sleep(1);
}
