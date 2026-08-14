'use strict';

const mediaService = require('../services/mediaService');
const { ValidationError } = require('../utils/errors');

const parseMetadata = (value) => {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('metadata precisa ser objeto');
    return parsed;
  } catch (_error) {
    throw new ValidationError('metadata deve ser um JSON de objeto válido', 'METADATA_INVALID');
  }
};

const bodyPayload = (req) => ({
  tenantId: req.body?.tenantId || undefined,
  organizationId: req.body?.organizationId || undefined,
  ownerType: req.body?.ownerType || undefined,
  ownerId: req.body?.ownerId || undefined,
  category: req.body?.category || req.params?.category || 'document',
  visibility: req.body?.visibility || undefined,
  sourceSystem: req.body?.sourceSystem || undefined,
  sourceId: req.body?.sourceId || undefined,
  idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey || undefined,
  metadata: parseMetadata(req.body?.metadata),
});

const upload = async (req, res, next) => {
  try {
    const result = await mediaService.upload(req.file, bodyPayload(req), {
      ...req.context,
      idempotencyKey: req.get('Idempotency-Key') || null,
    });
    return res.status(result.idempotent ? 200 : 201).json({ success: true, data: result.object, idempotent: result.idempotent });
  } catch (error) {
    return next(error);
  }
};

const list = async (req, res, next) => {
  try {
    return res.json({ success: true, data: await mediaService.list(req.query, req.context) });
  } catch (error) {
    return next(error);
  }
};

const get = async (req, res, next) => {
  try {
    return res.json({ success: true, data: mediaService.serialize(await mediaService.getById(req.params.id, req.context)) });
  } catch (error) {
    return next(error);
  }
};

const presign = async (req, res, next) => {
  try {
    return res.json({ success: true, data: await mediaService.presign(req.params.id, req.context, req.query.expiresIn) });
  } catch (error) {
    return next(error);
  }
};

const content = async (req, res, next) => {
  try {
    const result = await mediaService.stream(req.params.id, req.context);
    const filename = String(result.object.originalName || 'file').replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', result.object.contentType);
    res.setHeader('Content-Length', String(result.size));
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    result.stream.on('error', next);
    return result.stream.pipe(res);
  } catch (error) {
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    return res.json({ success: true, data: await mediaService.remove(req.params.id, req.context) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { upload, list, get, presign, content, remove };
