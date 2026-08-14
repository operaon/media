'use strict';

process.env.NODE_ENV = 'test';
process.env.SERVICE_API_KEY = 'media-test-service-key';
process.env.JWT_SECRET = 'media-test-jwt-secret-change-me';
process.env.JWT_ISSUER = 'operaon-identity';
process.env.JWT_AUDIENCE = 'operaon-media';
process.env.MINIO_BUCKET = 'operaon-media-test';

jest.mock('../src/config/database', () => ({
  authenticate: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/models', () => ({
  sequelize: { authenticate: jest.fn().mockResolvedValue(undefined), close: jest.fn().mockResolvedValue(undefined) },
  MediaObject: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
}));

jest.mock('../src/services/objectStore', () => ({
  bucket: 'operaon-media-test',
  ensureBucket: jest.fn().mockResolvedValue(undefined),
  putObject: jest.fn().mockResolvedValue({ bucket: 'operaon-media-test', objectKey: 'logo/key.png' }),
  getPresignedUrl: jest.fn().mockResolvedValue('http://media.example/private-url'),
  publicUrl: jest.fn((key, bucket) => `http://media.example/${bucket}/${key}`),
  statObject: jest.fn().mockResolvedValue({ size: 12 }),
  getObjectStream: jest.fn(),
  removeObject: jest.fn().mockResolvedValue(undefined),
  isNotFound: jest.fn().mockReturnValue(false),
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const { MediaObject } = require('../src/models');
const objectStore = require('../src/services/objectStore');

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const objectId = '33333333-3333-4333-8333-333333333333';

const tokenFor = (permissions, extra = {}) => jwt.sign({
  sub: '44444444-4444-4444-8444-444444444444',
  tokenType: 'access',
  tenantId,
  organizationIds: [],
  permissions,
  ...extra,
}, process.env.JWT_SECRET, { issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE.split(',') });

const headers = (permissions) => ({
  'X-Service-Key': process.env.SERVICE_API_KEY,
  Authorization: `Bearer ${tokenFor(permissions)}`,
  'X-Tenant-Id': tenantId,
});

const mediaObject = (overrides = {}) => ({
  id: objectId,
  tenantId,
  organizationId: null,
  ownerType: 'tenant',
  ownerId: tenantId,
  category: 'logo',
  bucket: 'operaon-media-test',
  objectKey: 'logo/11111111-1111-4111-8111-111111111111/logo.png',
  originalName: 'logo.png',
  contentType: 'image/png',
  sizeBytes: 12,
  checksumSha256: 'a'.repeat(64),
  visibility: 'public',
  status: 'active',
  uploadedByUserId: '44444444-4444-4444-8444-444444444444',
  sourceSystem: null,
  sourceId: null,
  idempotencyKey: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('rejeita token destinado a outra audience', async () => {
  const wrongAudience = jwt.sign({ sub: '44444444-4444-4444-8444-444444444444', tokenType: 'access', tenantId, permissions: ['media:read'] }, process.env.JWT_SECRET, { issuer: process.env.JWT_ISSUER, audience: 'operaon-api' });
  const response = await request(app).get('/api/objects').set({ 'X-Service-Key': process.env.SERVICE_API_KEY, Authorization: `Bearer ${wrongAudience}`, 'X-Tenant-Id': tenantId });
  expect(response.status).toBe(401);
});

test('não concede bypass universal a token de serviço', async () => {
  const serviceToken = jwt.sign({ sub: '44444444-4444-4444-8444-444444444444', tokenType: 'access', service: true, tenantId, permissions: [] }, process.env.JWT_SECRET, { issuer: process.env.JWT_ISSUER, audience: 'operaon-media' });
  const response = await request(app).get('/api/objects').set({ 'X-Service-Key': process.env.SERVICE_API_KEY, Authorization: `Bearer ${serviceToken}`, 'X-Tenant-Id': tenantId });
  expect(response.status).toBe(403);
});

test('faz upload multipart e cria metadados no catálogo próprio', async () => {
  const stored = mediaObject();
  MediaObject.findOne.mockResolvedValue(null);
  MediaObject.create.mockResolvedValue(stored);

  const response = await request(app)
    .post('/api/objects')
    .set(headers(['media:write']))
    .field('category', 'logo')
    .field('ownerType', 'tenant')
    .attach('file', Buffer.from('png-payload'), 'logo.png');

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data.category).toBe('logo');
  expect(objectStore.putObject).toHaveBeenCalledTimes(1);
  expect(MediaObject.create).toHaveBeenCalledTimes(1);
});

test('retorna o objeto existente quando a operação é idempotente', async () => {
  const stored = mediaObject({ idempotencyKey: 'upload-123' });
  MediaObject.findOne.mockResolvedValue(stored);

  const response = await request(app)
    .post('/api/upload/logo')
    .set({ ...headers(['media:write']), 'Idempotency-Key': 'upload-123' })
    .attach('file', Buffer.from('same-payload'), 'logo.png');

  expect(response.status).toBe(200);
  expect(response.body.idempotent).toBe(true);
  expect(objectStore.putObject).not.toHaveBeenCalled();
  expect(MediaObject.create).not.toHaveBeenCalled();
});

test('rejeita consulta explicitamente fora do tenant do JWT', async () => {
  MediaObject.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

  const response = await request(app)
    .get(`/api/objects?tenantId=${otherTenantId}`)
    .set(headers(['media:read']));

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe('TENANT_SCOPE_DENIED');
  expect(MediaObject.findAndCountAll).not.toHaveBeenCalled();
});

test('gera presigned URL usando o bucket físico registrado no objeto legado', async () => {
  MediaObject.findByPk.mockResolvedValue(mediaObject({
    bucket: 'velyon-files',
    visibility: 'private',
    objectKey: 'signatures/legacy-signature.png',
  }));

  const response = await request(app)
    .get(`/api/objects/${objectId}/presign?expiresIn=600`)
    .set(headers(['media:read']));

  expect(response.status).toBe(200);
  expect(response.body.data.url).toBe('http://media.example/private-url');
  expect(objectStore.statObject).toHaveBeenCalledWith('signatures/legacy-signature.png', 'velyon-files');
  expect(objectStore.getPresignedUrl).toHaveBeenCalledWith('signatures/legacy-signature.png', 600, 'velyon-files');
});

test('bloqueia leitura sem a permissão dinâmica media:read', async () => {
  const response = await request(app)
    .get('/api/objects')
    .set(headers(['media:write']));

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe('PERMISSION_DENIED');
});
