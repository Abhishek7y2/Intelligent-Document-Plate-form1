import http from 'k6/http';
import { check, sleep } from 'k6';

// NFR-02: Search & metadata listing response time must maintain p95 < 1000ms
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 concurrent users
    { duration: '1m', target: 20 },  // Steady state load
    { duration: '15s', target: 0 },  // Ramp down
  ],
  thresholds: {
    // Hard requirement: p95 latency under 1000ms
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'], // < 1% error rate
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
  };

  // 1. Metadata query: Document listing with pagination & sorting
  const listRes = http.get(
    `${BASE_URL}/documents?limit=25&page=1&sort=uploaded_at&order=desc`,
    { headers }
  );
  check(listRes, {
    'list status is 200': (r) => r.status === 200,
    'list latency under 1000ms': (r) => r.timings.duration < 1000,
  });

  // 2. Filtered search query by document type & status
  const filterRes = http.get(
    `${BASE_URL}/documents?type=invoice&status=STP_PROCESSED&limit=10`,
    { headers }
  );
  check(filterRes, {
    'filter status is 200': (r) => r.status === 200,
    'filter latency under 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
