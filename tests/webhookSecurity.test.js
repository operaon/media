'use strict';

const {
  buildWebhookHeaders,
  verifyWebhookSignature,
  signWebhook
} = require('../src/middlewares/webhookSecurity');

const SECRET = 'crm-webhook-test-secret';
const BODY = JSON.stringify({ event: 'test.event', id: 'delivery-1' });

const requestFrom = (headers, body = BODY) => ({
  headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])),
  rawBody: Buffer.from(body)
});

describe('contrato HMAC de webhook do CRM', () => {
  it('aceita um envelope válido assinado sobre timestamp.nonce.rawBody', () => {
    const headers = buildWebhookHeaders({
      body: BODY,
      secret: SECRET,
      webhookId: 'delivery-1',
      keyId: 'crm-webhook-v1',
      eventType: 'test.event'
    });

    const result = verifyWebhookSignature(requestFrom(headers), {
      secret: SECRET,
      toleranceSeconds: 300
    });

    expect(result.valid).toBe(true);
    expect(result.webhookId).toBe('delivery-1');
    expect(result.nonce).toBe(headers['X-Webhook-Nonce']);
  });

  it('rejeita envelope sem nonce', () => {
    const headers = buildWebhookHeaders({ body: BODY, secret: SECRET, webhookId: 'delivery-2' });
    delete headers['X-Webhook-Nonce'];

    const result = verifyWebhookSignature(requestFrom(headers), { secret: SECRET });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('WEBHOOK_NONCE_MISSING');
  });

  it('rejeita nonce adulterado depois da assinatura', () => {
    const headers = buildWebhookHeaders({ body: BODY, secret: SECRET, webhookId: 'delivery-3' });
    headers['X-Webhook-Nonce'] = 'nonce-adulterado';

    const result = verifyWebhookSignature(requestFrom(headers), { secret: SECRET });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('produz assinaturas diferentes quando apenas o nonce muda', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const first = signWebhook({ body: BODY, secret: SECRET, timestamp, nonce: 'nonce-a' });
    const second = signWebhook({ body: BODY, secret: SECRET, timestamp, nonce: 'nonce-b' });

    expect(first).not.toBe(second);
  });
});
