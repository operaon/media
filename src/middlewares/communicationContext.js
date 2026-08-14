'use strict';

const crypto = require('crypto');

const HEADER = Object.freeze({
  serviceId: 'x-service-id',
  keyId: 'x-key-id',
  protocolVersion: 'x-protocol-version',
  tenantId: 'x-tenant-id',
  organizationId: 'x-organization-id',
  correlationId: 'x-correlation-id',
  requestId: 'x-request-id',
  sourceSystem: 'x-source-system',
  sourceId: 'x-source-id',
  eventId: 'x-event-id',
  eventType: 'x-event-type',
  eventVersion: 'x-event-version',
  idempotencyKey: 'idempotency-key',
  requestTimestamp: 'x-request-timestamp',
  requestNonce: 'x-request-nonce',
  webhookId: 'x-webhook-id',
  webhookKeyId: 'x-webhook-key-id',
  webhookTimestamp: 'x-webhook-timestamp',
  webhookNonce: 'x-webhook-nonce',
  webhookSignature: 'x-webhook-signature',
  deliveryAttempt: 'x-delivery-attempt'
});

const SAFE_VALUE = /^[A-Za-z0-9._:/-]{1,200}$/;

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const safeValue = (value, fallback = null) => {
  const normalized = value === undefined || value === null ? '' : String(value).trim();
  return normalized && SAFE_VALUE.test(normalized) ? normalized : fallback;
};

const generatedId = () => crypto.randomUUID();

const getRequestContext = (req = {}) => {
  const requestId = safeValue(req.headers?.[HEADER.requestId]) || generatedId();
  const correlationId = safeValue(req.headers?.[HEADER.correlationId]) || requestId;
  const serviceId = safeValue(req.headers?.[HEADER.serviceId]);
  const sourceSystem = safeValue(req.headers?.[HEADER.sourceSystem]) || serviceId || null;
  const eventId = safeValue(req.headers?.[HEADER.eventId]);
  const idempotencyKey = safeValue(req.headers?.[HEADER.idempotencyKey]);

  return {
    requestId,
    correlationId,
    serviceId,
    keyId: safeValue(req.headers?.[HEADER.keyId]),
    protocolVersion: safeValue(req.headers?.[HEADER.protocolVersion]) || '1',
    tenantId: safeValue(req.headers?.[HEADER.tenantId]),
    organizationId: safeValue(req.headers?.[HEADER.organizationId]),
    sourceSystem,
    sourceId: safeValue(req.headers?.[HEADER.sourceId]),
    eventId,
    eventType: safeValue(req.headers?.[HEADER.eventType]),
    eventVersion: safeValue(req.headers?.[HEADER.eventVersion]) || '1',
    idempotencyKey,
    requestTimestamp: req.headers?.[HEADER.requestTimestamp] || null,
    requestNonce: safeValue(req.headers?.[HEADER.requestNonce])
  };
};

const communicationContext = (req, res, next) => {
  const context = getRequestContext(req);
  req.communicationContext = context;
  req.requestId = context.requestId;
  req.correlationId = context.correlationId;

  res.setHeader('X-Request-Id', context.requestId);
  res.setHeader('X-Correlation-Id', context.correlationId);
  res.setHeader('X-Protocol-Version', context.protocolVersion);

  next();
};

const buildInternalHeaders = ({
  context = {},
  serviceId = process.env.SERVICE_NAME || process.env.APP_NAME || 'operaon-service',
  serviceKey,
  accessToken,
  keyId = process.env.COMMUNICATION_KEY_ID || 'default',
  method = 'POST',
  eventType,
  eventVersion = '1',
  idempotencyKey,
  sourceSystem,
  sourceId,
  eventId,
  tenantId,
  organizationId
} = {}) => {
  const requestId = safeValue(context.requestId) || generatedId();
  const correlationId = safeValue(context.correlationId) || requestId;
  const resolvedServiceId = safeValue(serviceId) || 'operaon-service';
  const resolvedSourceSystem = safeValue(sourceSystem || context.sourceSystem) || resolvedServiceId;
  const resolvedSourceId = safeValue(sourceId || context.sourceId) || requestId;
  const resolvedEventId = safeValue(eventId || context.eventId) || requestId;
  const resolvedIdempotencyKey = safeValue(idempotencyKey || context.idempotencyKey) || `${String(method).toUpperCase()}:${resolvedSourceId}`;
  const timestamp = new Date().toISOString();

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Service-Id': resolvedServiceId,
    'X-Key-Id': safeValue(keyId || context.keyId) || process.env.COMMUNICATION_KEY_ID || 'default',
    'X-Protocol-Version': safeValue(context.protocolVersion) || '1',
    'X-Request-Id': requestId,
    'X-Correlation-Id': correlationId,
    'X-Source-System': resolvedSourceSystem,
    'X-Source-Id': resolvedSourceId,
    'X-Event-Id': resolvedEventId,
    'X-Event-Type': safeValue(eventType || context.eventType) || 'request',
    'X-Event-Version': safeValue(eventVersion || context.eventVersion) || '1',
    'Idempotency-Key': resolvedIdempotencyKey,
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': generatedId()
  };

  const resolvedTenantId = safeValue(tenantId || context.tenantId);
  const resolvedOrganizationId = safeValue(organizationId || context.organizationId);
  if (resolvedTenantId) headers['X-Tenant-Id'] = resolvedTenantId;
  if (resolvedOrganizationId) headers['X-Organization-Id'] = resolvedOrganizationId;
  if (serviceKey) headers['X-Service-Key'] = serviceKey;
  if (accessToken) headers.Authorization = String(accessToken).startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`;

  return headers;
};

const buildEventEnvelope = ({ eventType, eventVersion = 1, payload, context = {}, sourceSystem, sourceId, tenantId, organizationId, eventId }) => ({
  eventId: safeValue(eventId || context.eventId) || generatedId(),
  eventType: safeValue(eventType) || 'integration.event',
  eventVersion,
  sourceSystem: safeValue(sourceSystem || context.sourceSystem) || process.env.SERVICE_NAME || 'operaon-service',
  sourceId: safeValue(sourceId || context.sourceId) || null,
  tenantId: safeValue(tenantId || context.tenantId) || null,
  organizationId: safeValue(organizationId || context.organizationId) || null,
  correlationId: safeValue(context.correlationId) || safeValue(context.requestId) || generatedId(),
  occurredAt: new Date().toISOString(),
  payload
});

module.exports = {
  HEADER,
  firstDefined,
  safeValue,
  generatedId,
  getRequestContext,
  communicationContext,
  buildInternalHeaders,
  buildEventEnvelope
};
