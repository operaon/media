'use strict';

const crypto = require('crypto');
const path = require('path');
const { Op } = require('sequelize');
const env = require('../config/env');
const { MediaObject } = require('../models');
const objectStore = require('./objectStore');
const {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} = require('../utils/errors');

const CATEGORY_RULES = {
  logo: {
    aliases: ['logos'],
    allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    maxBytes: 5 * 1024 * 1024,
    visibility: 'public',
  },
  signature: {
    aliases: ['signatures'],
    allowedTypes: ['image/png'],
    maxBytes: 2 * 1024 * 1024,
    visibility: 'private',
  },
  document: {
    aliases: ['documents'],
    allowedTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxBytes: 10 * 1024 * 1024,
    visibility: 'private',
  },
  contract: {
    aliases: ['contracts', 'sale-contracts'],
    allowedTypes: ['application/pdf'],
    maxBytes: 10 * 1024 * 1024,
    visibility: 'private',
  },
  site: {
    aliases: ['site'],
    allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
    maxBytes: 20 * 1024 * 1024,
    visibility: 'public',
  },
};

const normalizeCategory = (value) => {
  const candidate = String(value || '').trim().toLowerCase();
  if (!candidate) return 'document';
  const match = Object.entries(CATEGORY_RULES).find(([category, rule]) => category === candidate || rule.aliases.includes(candidate));
  return match ? match[0] : candidate.replace(/[^a-z0-9_-]/g, '-').slice(0, 80) || 'document';
};

const safeName = (name) => {
  const base = path.basename(String(name || 'file'));
  const normalized = base.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return normalized.slice(0, 180) || 'file';
};

const scopeWhere = (context, requested = {}) => {
  const tenantId = requested.tenantId || context?.tenantId;
  if (!tenantId) throw new AuthorizationError('Tenant obrigatório no contexto de mídia', 'TENANT_REQUIRED');
  if (!context?.isService && context?.tenantId && tenantId !== context.tenantId) {
    throw new AuthorizationError('Tenant fora do escopo autorizado', 'TENANT_SCOPE_DENIED');
  }

  const organizationId = requested.organizationId || null;
  if (!context?.isService && organizationId && Array.isArray(context.organizationIds)
    && context.organizationIds.length > 0
    && !context.organizationIds.includes(organizationId)) {
    throw new AuthorizationError('Organização fora do escopo autorizado', 'ORGANIZATION_SCOPE_DENIED');
  }

  return { tenantId, organizationId };
};

const requireScopeForObject = (context, object) => scopeWhere(context, {
  tenantId: object.tenantId,
  organizationId: object.organizationId,
});

const categoryRule = (category) => CATEGORY_RULES[normalizeCategory(category)] || {
  allowedTypes: [],
  maxBytes: env.storage.maxFileSizeBytes,
  visibility: 'private',
};

const ensureFile = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new ValidationError('Nenhum arquivo fornecido', 'FILE_REQUIRED');
  }
  if (!file.originalname) throw new ValidationError('Nome original do arquivo obrigatório', 'FILE_NAME_REQUIRED');
};

const ensureAllowedFile = (file, category) => {
  ensureFile(file);
  const rule = categoryRule(category);
  const contentType = String(file.mimetype || 'application/octet-stream').toLowerCase();
  if (rule.allowedTypes.length > 0 && !rule.allowedTypes.includes(contentType)) {
    throw new ValidationError(`Tipo de arquivo não permitido para ${normalizeCategory(category)}`, 'FILE_TYPE_NOT_ALLOWED', {
      contentType,
      allowedTypes: rule.allowedTypes,
    });
  }
  if (file.buffer.length > rule.maxBytes || file.buffer.length > env.storage.maxFileSizeBytes) {
    throw new ValidationError('Arquivo excede o limite permitido', 'FILE_TOO_LARGE', {
      maxBytes: Math.min(rule.maxBytes, env.storage.maxFileSizeBytes),
    });
  }
  return contentType;
};

const serialize = (object) => ({
  id: object.id,
  tenantId: object.tenantId,
  organizationId: object.organizationId,
  ownerType: object.ownerType,
  ownerId: object.ownerId,
  category: object.category,
  bucket: object.bucket,
  objectKey: object.objectKey,
  originalName: object.originalName,
  contentType: object.contentType,
  sizeBytes: Number(object.sizeBytes),
  checksumSha256: object.checksumSha256,
  visibility: object.visibility,
  status: object.status,
  uploadedByUserId: object.uploadedByUserId,
  sourceSystem: object.sourceSystem,
  sourceId: object.sourceId,
  metadata: object.metadata || {},
  createdAt: object.createdAt,
  updatedAt: object.updatedAt,
});

const findIdempotent = async ({ sourceSystem, sourceId, idempotencyKey }) => {
  if (sourceSystem && sourceId) {
    const bySource = await MediaObject.findOne({ where: { sourceSystem, sourceId, status: { [Op.ne]: 'deleted' } } });
    if (bySource) return bySource;
  }
  if (idempotencyKey) {
    const byKey = await MediaObject.findOne({ where: { idempotencyKey, status: { [Op.ne]: 'deleted' } } });
    if (byKey) return byKey;
  }
  return null;
};

const upload = async (file, payload, context) => {
  const scope = scopeWhere(context, payload);
  const category = normalizeCategory(payload.category);
  const rule = categoryRule(category);
  const contentType = ensureAllowedFile(file, category);
  const visibility = payload.visibility || rule.visibility;
  if (!['private', 'public'].includes(visibility)) {
    throw new ValidationError('visibility deve ser private ou public', 'VISIBILITY_INVALID');
  }
  if (visibility === 'public' && !['logo', 'site'].includes(category)) {
    throw new AuthorizationError('Somente logos e assets de site podem ser públicos', 'PUBLIC_MEDIA_CATEGORY_DENIED');
  }

  const sourceSystem = payload.sourceSystem ? String(payload.sourceSystem).trim().slice(0, 80) : null;
  const sourceId = payload.sourceId ? String(payload.sourceId).trim().slice(0, 180) : null;
  const idempotencyKey = payload.idempotencyKey || context?.idempotencyKey || null;
  const existing = await findIdempotent({ sourceSystem, sourceId, idempotencyKey });
  if (existing) return { object: serialize(existing), idempotent: true };

  const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const objectKey = `${category}/${scope.tenantId}/${crypto.randomUUID()}-${safeName(file.originalname)}`;
  await objectStore.putObject(objectKey, file.buffer, contentType);

  try {
    const created = await MediaObject.create({
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      ownerType: payload.ownerType || 'tenant',
      ownerId: payload.ownerId || null,
      category,
      bucket: objectStore.bucket,
      objectKey,
      originalName: safeName(file.originalname),
      contentType,
      sizeBytes: file.buffer.length,
      checksumSha256,
      visibility,
      status: 'active',
      uploadedByUserId: context?.userId || null,
      sourceSystem,
      sourceId,
      idempotencyKey,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    });
    return { object: serialize(created), idempotent: false };
  } catch (error) {
    await objectStore.removeObject(objectKey).catch(() => {});
    const duplicate = await findIdempotent({ sourceSystem, sourceId, idempotencyKey });
    if (duplicate) return { object: serialize(duplicate), idempotent: true };
    throw error;
  }
};

const getById = async (id, context) => {
  const object = await MediaObject.findByPk(id);
  if (!object || object.status === 'deleted') throw new NotFoundError('Objeto de mídia não encontrado', 'MEDIA_OBJECT_NOT_FOUND');
  requireScopeForObject(context, object);
  return object;
};

const list = async (query, context) => {
  const scope = scopeWhere(context, query);
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), env.maxQueryLimit);
  const offset = Math.max(Number(query.offset || 0), 0);
  const where = { tenantId: scope.tenantId, status: query.status || 'active' };
  if (scope.organizationId) where.organizationId = scope.organizationId;
  if (query.category) where.category = normalizeCategory(query.category);
  if (query.ownerType) where.ownerType = query.ownerType;
  if (query.ownerId) where.ownerId = query.ownerId;
  const result = await MediaObject.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  return { items: result.rows.map(serialize), total: result.count, limit, offset };
};

const presign = async (id, context, expiresIn) => {
  const object = await getById(id, context);
  try {
    await objectStore.statObject(object.objectKey, object.bucket);
  } catch (error) {
    if (objectStore.isNotFound(error)) throw new NotFoundError('Objeto físico não encontrado', 'MEDIA_OBJECT_MISSING');
    throw error;
  }
  if (object.visibility === 'public') return { object: serialize(object), url: objectStore.publicUrl(object.objectKey, object.bucket), expiresIn: null };
  const requestedExpiry = Number(expiresIn || env.storage.presignExpirySeconds);
  const safeExpiry = Math.min(Math.max(requestedExpiry, 60), 24 * 60 * 60);
  return { object: serialize(object), url: await objectStore.getPresignedUrl(object.objectKey, safeExpiry, object.bucket), expiresIn: safeExpiry };
};

const stream = async (id, context) => {
  const object = await getById(id, context);
  try {
    const stat = await objectStore.statObject(object.objectKey, object.bucket);
    return { object, stream: await objectStore.getObjectStream(object.objectKey, object.bucket), size: stat.size };
  } catch (error) {
    if (objectStore.isNotFound(error)) throw new NotFoundError('Objeto físico não encontrado', 'MEDIA_OBJECT_MISSING');
    throw error;
  }
};

const remove = async (id, context) => {
  const object = await getById(id, context);
  await objectStore.removeObject(object.objectKey, object.bucket).catch((error) => {
    if (!objectStore.isNotFound(error)) throw error;
  });
  await object.update({ status: 'deleted', deletedAt: new Date() });
  return serialize(object);
};

module.exports = {
  CATEGORY_RULES,
  normalizeCategory,
  serialize,
  upload,
  getById,
  list,
  presign,
  stream,
  remove,
};
