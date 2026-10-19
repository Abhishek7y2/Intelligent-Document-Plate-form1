import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

const dummyPdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF';

export default function () {
  const boundary = '----WebKitFormBoundaryProc' + Math.random().toString(36).substring(2);
  const payload =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="proc-${Date.now()}.pdf"\r\n` +
    `Content-Type: application/pdf\r\n\r\n` +
    dummyPdf +
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="documentType"\r\n\r\n` +
    `invoice\r\n` +
    `--${boundary}--\r\n`;

  const headers = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'x-idempotency-key': `proc-idemp-${__VU}-${__ITER}-${Date.now()}`,
    ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
  };

  const uploadRes = http.post(`${BASE_URL}/documents/upload`, payload, { headers });
  if (uploadRes.status === 201 || uploadRes.status === 202) {
    const docId = uploadRes.json('documentId') || uploadRes.json('id');
    if (docId) {
      // Poll document status
      for (let i = 0; i < 5; i++) {
        sleep(1);
        const pollRes = http.get(`${BASE_URL}/documents/${docId}`, {
          headers: { ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}) },
        });
        const status = pollRes.json('status');
        if (status === 'STP_PROCESSED' || status === 'NEEDS_REVIEW' || status === 'FAILED') {
          break;
        }
      }
    }
  }

  sleep(1);
}
