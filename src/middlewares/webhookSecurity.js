'use strict';

const crypto = require('crypto');
const { HEADER, safeValue, generatedId } = require('./communicationContext');

const DEFAULT_TOLERANCE_SECONDS = 300;

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const rawBody = (req) => {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody);
  if (Buffer.isBuffer(req.body)) return req.body;
  return Buffer.from(JSON.stringify(req.body || {}));
};

const captureRawBody = (req, _res, buffer) => {
  if (buffer?.length) req.rawBody = Buffer.from(buffer);
};

const signWebhook = ({ body, secret, timestamp, prefix = 'v1' }) => {
  if (!secret) throw new Error('Segredo de webhook não configurado');
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body || {}));
  const timestampValue = String(timestamp || Math.floor(Date.now() / 1000));
  const digest = crypto.createHmac('sha256', secret).update(`${timestampValue}.${bodyBuffer.toString('utf8')}`).digest('hex');
  return `${prefix}=${digest}`;
};

const buildWebhookHeaders = ({ body, secret, webhookId = generatedId(), keyId = process.env.WEBHOOK_KEY_ID || process.env.COMMUNICATION_KEY_ID || 'default', eventType = 'integration.event', eventVersion = 1, correlationId = generatedId(), deliveryAttempt = 1 } = {}) => {
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Webhook-Id': webhookId,
    'X-Webhook-Key-Id': keyId,
    'X-Webhook-Timestamp': String(timestamp),
    'X-Webhook-Nonce': generatedId(),
    'X-Webhook-Signature': signWebhook({ body, secret, timestamp }),
    'X-Event-Type': eventType,
    'X-Event-Version': String(eventVersion),
    'X-Correlation-Id': correlationId,
    'X-Delivery-Attempt': String(deliveryAttempt)
  };
};

const parseSignature = (header) => {
  const values = String(header || '').split(',').map((part) => part.trim());
  const parsed = {};
  values.forEach((part) => {
    const separator = part.indexOf('=');
    if (separator > 0) parsed[part.slice(0, separator)] = part.slice(separator + 1);
  });
  return { timestamp: parsed.t || null, signature: parsed.v1 || parsed.signature || null };
};

const verifyWebhookSignature = (req, { secret, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS, requireSignature = true } = {}) => {
  if (!secret) return { valid: false, reason: 'WEBHOOK_SECRET_NOT_CONFIGURED' };

  const signatureHeader = req.headers?.[HEADER.webhookSignature];
  const timestampHeader = req.headers?.[HEADER.webhookTimestamp];
  const parsed = parseSignature(signatureHeader);
  const timestamp = parsed.timestamp || timestampHeader;
  const signature = parsed.signature;
  if (requireSignature && (!timestamp || !signature)) return { valid: false, reason: 'WEBHOOK_SIGNATURE_MISSING' };

  if (timestamp) {
    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > toleranceSeconds) {
      return { valid: false, reason: 'WEBHOOK_TIMESTAMP_INVALID' };
    }
  }

  if (signature) {
    const expected = signWebhook({ body: rawBody(req), secret, timestamp });
    if (!safeEqual(signature, expected.split('=').slice(1).join('='))) return { valid: false, reason: 'WEBHOOK_SIGNATURE_INVALID' };
  }

  const webhookId = safeValue(req.headers?.[HEADER.webhookId]);
  if (requireSignature && !webhookId) return { valid: false, reason: 'WEBHOOK_ID_MISSING' };

  return { valid: true, webhookId, timestamp: timestamp || null };
};

const webhookContext = (req, res, next) => {
  req.webhookContext = {
    webhookId: safeValue(req.headers?.[HEADER.webhookId]),
    keyId: safeValue(req.headers?.[HEADER.webhookKeyId]),
    timestamp: req.headers?.[HEADER.webhookTimestamp] || null,
    nonce: safeValue(req.headers?.[HEADER.webhookNonce]),
    eventType: safeValue(req.headers?.[HEADER.eventType]),
    eventVersion: safeValue(req.headers?.[HEADER.eventVersion]) || '1',
    correlationId: safeValue(req.headers?.[HEADER.correlationId]) || generatedId(),
    deliveryAttempt: Number(req.headers?.[HEADER.deliveryAttempt] || 1)
  };
  res.setHeader('X-Correlation-Id', req.webhookContext.correlationId);
  next();
};

module.exports = {
  DEFAULT_TOLERANCE_SECONDS,
  captureRawBody,
  signWebhook,
  buildWebhookHeaders,
  verifyWebhookSignature,
  webhookContext,
  safeEqual,
  rawBody
};
