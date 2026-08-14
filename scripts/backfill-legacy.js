'use strict';

require('dotenv').config();
const crypto = require('crypto');
const { Sequelize, QueryTypes } = require('sequelize');
const env = require('../src/config/env');
const { sequelize, MediaObject } = require('../src/models');
const objectStore = require('../src/services/objectStore');

const legacy = env.legacyDatabase.url
  ? new Sequelize(env.legacyDatabase.url, { dialect: 'postgres', logging: false })
  : new Sequelize(env.legacyDatabase.name, env.legacyDatabase.user, env.legacyDatabase.password, {
    dialect: 'postgres', host: env.legacyDatabase.host, port: env.legacyDatabase.port, logging: false,
  });

const hasTable = async (tableName) => {
  const rows = await legacy.query('SELECT to_regclass(:tableName) AS relation', {
    replacements: { tableName }, type: QueryTypes.SELECT,
  });
  return Boolean(rows[0]?.relation);
};

const pick = (row, ...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null && value !== '');
const uuid = (value) => (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null);
const keyFrom = (value) => {
  if (!value || typeof value !== 'string') return null;
  const clean = value.split('?')[0].replace(/^\/+/, '');
  const marker = '/velyon-files/';
  if (clean.includes(marker)) return clean.split(marker)[1];
  const minioMarker = '/minio/';
  if (clean.includes(minioMarker)) return clean.split(minioMarker)[1].replace(/^velyon-files\//, '');
  return clean.includes('/') ? clean : null;
};
const checksumForLegacyReference = (bucket, objectKey) => crypto.createHash('sha256').update(`${bucket}:${objectKey}`).digest('hex');

const candidatesFromTenants = (rows) => rows.flatMap((row) => {
  const tenantId = uuid(row.id);
  const organizationId = uuid(pick(row, 'organizationId', 'organization_id'));
  if (!tenantId) return [];
  const candidates = [];
  const logoKey = keyFrom(pick(row, 'logoKey', 'logo_key', 'logo'));
  if (logoKey) candidates.push({ tenantId, organizationId, ownerType: 'tenant', ownerId: tenantId, category: 'logo', key: logoKey, sourceId: `tenant:${tenantId}:logo`, originalName: 'logo' });
  const signatureKey = keyFrom(pick(row, 'assinaturaResponsavelTecnicoKey', 'assinatura_responsavel_tecnico_key', 'assinaturaResponsavelTecnicoUrl'));
  if (signatureKey) candidates.push({ tenantId, organizationId, ownerType: 'tenant', ownerId: tenantId, category: 'signature', key: signatureKey, sourceId: `tenant:${tenantId}:signature`, originalName: 'assinatura.png' });
  return candidates;
});

const candidatesFromUsers = (rows) => rows.flatMap((row) => {
  const userId = uuid(row.id);
  const tenantId = uuid(pick(row, 'tenantId', 'tenant_id'));
  const organizationId = uuid(pick(row, 'organizationId', 'organization_id'));
  const key = keyFrom(pick(row, 'assinaturaKey', 'assinatura_key', 'assinaturaUrl'));
  if (!userId || !tenantId || !key) return [];
  return [{ tenantId, organizationId, ownerType: 'user', ownerId: userId, category: 'signature', key, sourceId: `user:${userId}:signature`, originalName: 'assinatura.png' }];
});

const main = async () => {
  const writeEnabled = env.backfillWriteEnabled;
  const summary = { dryRun: !writeEnabled, tables: {}, candidates: 0, written: 0, skipped: 0, missingPhysicalObjects: 0 };
  if (writeEnabled) {
    await sequelize.authenticate();
    console.warn('BACKFILL_WRITE_ENABLED=true: somente metadados serão gravados; nenhum objeto legado será movido, sobrescrito ou removido.');
  } else {
    console.log('Dry-run padrão: nenhuma escrita será realizada. Defina BACKFILL_WRITE_ENABLED=true somente após aprovação operacional.');
  }

  const states = {};
  for (const table of ['tenants', 'users']) states[table] = await hasTable(table);
  summary.tables = states;
  const candidates = [];
  if (states.tenants) candidates.push(...candidatesFromTenants(await legacy.query('SELECT * FROM "tenants"', { type: QueryTypes.SELECT })));
  if (states.users) candidates.push(...candidatesFromUsers(await legacy.query('SELECT * FROM "users"', { type: QueryTypes.SELECT })));

  for (const candidate of candidates) {
    summary.candidates += 1;
    let physicalExists = true;
    try {
      await objectStore.statObject(candidate.key, env.storage.legacyBucket);
    } catch (error) {
      if (objectStore.isNotFound(error)) physicalExists = false;
      else throw error;
    }
    if (!physicalExists) summary.missingPhysicalObjects += 1;
    if (!writeEnabled) continue;
    const [, created] = await MediaObject.findOrCreate({
      where: { sourceSystem: 'legacy-api', sourceId: candidate.sourceId },
      defaults: {
        tenantId: candidate.tenantId,
        organizationId: candidate.organizationId,
        ownerType: candidate.ownerType,
        ownerId: candidate.ownerId,
        category: candidate.category,
        bucket: env.storage.legacyBucket,
        objectKey: candidate.key,
        originalName: candidate.originalName,
        contentType: candidate.category === 'logo' ? 'image/png' : 'image/png',
        sizeBytes: 0,
        checksumSha256: checksumForLegacyReference(env.storage.legacyBucket, candidate.key),
        visibility: candidate.category === 'logo' ? 'public' : 'private',
        status: physicalExists ? 'active' : 'orphaned',
        sourceSystem: 'legacy-api',
        sourceId: candidate.sourceId,
        metadata: { migratedFrom: 'legacy-reference', legacyBucket: env.storage.legacyBucket },
      },
    });
    if (created) summary.written += 1; else summary.skipped += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
  await legacy.close();
  if (writeEnabled) await sequelize.close();
};

main().catch(async (error) => {
  console.error(error);
  await legacy.close().catch(() => {});
  await sequelize.close().catch(() => {});
  process.exit(1);
});
