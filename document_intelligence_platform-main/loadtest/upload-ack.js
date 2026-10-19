import http from 'k6/http';
import { check, sleep } from 'k6';

// NFR-03: Ingestion ACK response time must maintain p95 < 5000ms
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 concurrent uploaders
    { duration: '1m', target: 10 },  // Steady load
    { duration: '15s', target: 0 },  // Ramp down
  ],
  thresholds: {
    // Hard requirement: p95 ACK latency under 5000ms
    http_req_duration: ['p(95)<5000', 'p(99)<8000'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Minimal valid PDF binary representation
const dummyPdfBytes = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF';

export default function () {
  const boundary = '----WebKitFormBoundaryK6LoadTest' + Math.random().toString(36).substring(2);
  const fileName = `loadtest-${Date.now()}-${__VU}-${__ITER}.pdf`;

  const payload =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: application/pdf\r\n\r\n` +
    dummyPdfBytes +
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="documentType"\r\n\r\n` +
    `invoice\r\n` +
    `--${boundary}--\r\n`;

  const params = {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'x-idempotency-key': `loadtest-idemp-${__VU}-${__ITER}-${Date.now()}`,
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
    timeout: '10s',
  };

  const res = http.post(`${BASE_URL}/documents/upload`, payload, params);

  check(res, {
    'upload ack status is 201 or 202': (r) => r.status === 201 || r.status === 202,
    'upload ack latency < 5000ms': (r) => r.timings.duration < 5000,
  });

  sleep(2);
}
