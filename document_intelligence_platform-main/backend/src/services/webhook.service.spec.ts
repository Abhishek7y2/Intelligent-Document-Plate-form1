import crypto from 'crypto';
import {
  WebhookService,
  WebhookValidationError,
} from './webhook.service.js';

describe('Signed Outbound Webhook Service (Sprint 11 - FR-019, SEC-009)', () => {
  const TENANT_A = 'TNT-WEBHOOK-ALPHA';
  const USER_A = 'USR-ADMIN-01';

  beforeEach(() => {
    WebhookService.setStoreMode('memory');
    WebhookService.clearInMemory();
  });

  describe('Subscription Management', () => {
    it('should register a valid webhook subscription and generate high-entropy secret', async () => {
      const result = await WebhookService.createSubscription(TENANT_A, USER_A, {
        name: 'ERP Ingestion Endpoint',
        targetUrl: 'https://erp.enterprise.internal/webhooks/docunexa',
        subscribedEvents: ['document.approved', 'document.rejected'],
      });

      expect(result).toBeDefined();
      expect(result.subscription.id).toMatch(/^WHK-/);
      expect(result.subscription.tenantId).toBe(TENANT_A);
      expect(result.signingSecret).toMatch(/^whsec_[a-f0-9]{48}$/);
      expect(result.subscription.secretPreview).toMatch(/^whsec_\*\*\*\*[a-f0-9]{4}$/);
      expect(result.subscription.subscribedEvents).toEqual(['document.approved', 'document.rejected']);
    });

    it('should reject invalid URL schemes', async () => {
      await expect(
        WebhookService.createSubscription(TENANT_A, USER_A, {
          name: 'Invalid Scheme',
          targetUrl: 'ftp://ftp.example.com/data',
          subscribedEvents: ['document.approved'],
        })
      ).rejects.toThrow(WebhookValidationError);
    });

    it('should list and delete subscriptions within tenant boundary', async () => {
      const created = await WebhookService.createSubscription(TENANT_A, USER_A, {
        name: 'CRM Webhook',
        targetUrl: 'https://crm.example.com/hook',
        subscribedEvents: ['document.approved'],
      });

      const list = await WebhookService.listSubscriptions(TENANT_A);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(created.subscription.id);

      const deleted = await WebhookService.deleteSubscription(TENANT_A, created.subscription.id);
      expect(deleted).toBe(true);

      const listAfter = await WebhookService.listSubscriptions(TENANT_A);
      expect(listAfter.length).toBe(0);
    });
  });

  describe('Outbound Event Dispatch & Signature Integrity', () => {
    it('should dispatch event only to matching subscriptions with valid HMAC-SHA256 signature', async () => {
      const { subscription, signingSecret } = await WebhookService.createSubscription(TENANT_A, USER_A, {
        name: 'Approval Listener',
        targetUrl: 'https://listener.enterprise.internal/events',
        subscribedEvents: ['document.approved'],
      });

      const payload = { documentId: 'DOC-8891', status: 'APPROVED', amount: 15420.5 };
      const deliveries = await WebhookService.dispatchEvent(
        TENANT_A,
        'document.approved',
        payload
      );

      expect(deliveries.length).toBe(1);
      const delivery = deliveries[0];
      expect(delivery.subscriptionId).toBe(subscription.id);
      expect(delivery.status).toBe('SUCCESS');
      expect(delivery.signatureHeader).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

      // Verify the signature with WebhookService.verifySignature
      const verification = WebhookService.verifySignature(
        JSON.stringify(delivery.payloadSnapshot),
        delivery.signatureHeader,
        signingSecret
      );
      expect(verification.valid).toBe(true);
    });

    it('should NOT dispatch event to subscriptions that did not subscribe to that event type', async () => {
      await WebhookService.createSubscription(TENANT_A, USER_A, {
        name: 'Only Approvals',
        targetUrl: 'https://listener.enterprise.internal/events',
        subscribedEvents: ['document.approved'],
      });

      const deliveries = await WebhookService.dispatchEvent(
        TENANT_A,
        'document.quarantined',
        { documentId: 'DOC-9999' }
      );

      expect(deliveries.length).toBe(0);
    });
  });

  describe('Cryptographic Verification & Replay Protection (SEC-009)', () => {
    const rawSecret = 'whsec_fedcba9876543210fedcba9876543210fedcba9876543210';
    const payload = JSON.stringify({ event: 'test', id: 123 });

    it('should pass signature verification for authentic payload and current timestamp', () => {
      const timestampSec = Math.floor(Date.now() / 1000);
      const signature = crypto.createHmac('sha256', rawSecret)
        .update(`${timestampSec}.${payload}`)
        .digest('hex');
      const header = `t=${timestampSec},v1=${signature}`;

      const res = WebhookService.verifySignature(payload, header, rawSecret);
      expect(res.valid).toBe(true);
    });

    it('should fail verification if payload is tampered with', () => {
      const timestampSec = Math.floor(Date.now() / 1000);
      const signature = crypto.createHmac('sha256', rawSecret)
        .update(`${timestampSec}.${payload}`)
        .digest('hex');
      const header = `t=${timestampSec},v1=${signature}`;

      const tamperedPayload = JSON.stringify({ event: 'test', id: 999 }); // altered
      const res = WebhookService.verifySignature(tamperedPayload, header, rawSecret);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Signature mismatch.');
    });

    it('should reject replay attacks when timestamp is outside tolerance window (5 mins)', () => {
      const staleTimestampSec = Math.floor(Date.now() / 1000) - 360; // 6 minutes ago (tolerance 300s)
      const signature = crypto.createHmac('sha256', rawSecret)
        .update(`${staleTimestampSec}.${payload}`)
        .digest('hex');
      const header = `t=${staleTimestampSec},v1=${signature}`;

      const res = WebhookService.verifySignature(payload, header, rawSecret, 300);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Replay protection triggered');
    });
  });

  describe('Dead-Letter & Operator Retry', () => {
    it('should permit operator retry on delivery', async () => {
      await WebhookService.createSubscription(TENANT_A, USER_A, {
        name: 'Retry Target',
        targetUrl: 'https://listener.internal/events',
        subscribedEvents: ['document.approved'],
      });

      const deliveries = await WebhookService.dispatchEvent(
        TENANT_A,
        'document.approved',
        { docId: 'DOC-1' }
      );
      const delivery = deliveries[0];

      const retried = await WebhookService.retryDelivery(TENANT_A, delivery.id);
      expect(retried.attemptNumber).toBe(2);
      expect(retried.status).toBe('SUCCESS');
    });
  });
});
