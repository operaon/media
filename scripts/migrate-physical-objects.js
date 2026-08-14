'use strict';

require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const { QueryTypes, Op } = require('sequelize');
const env = require('../src/config/env');
const legacySequelize = require('../src/config/legacyDatabase');
const sequelize = require('../src/config/database');
const { MediaObject } = require('../src/models');
const objectStore = require('../src/services/objectStore');

const contentTypeFor = (value) => {
  const ext = path.extname(String(value || '')).toLowerCase();
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }[ext] || 'application/octet-stream';
};

const safeName = (value) => {
  const base = path.basename(String(value || 'file').split('?')[0]);
  return base.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 180) || 'file';
};

const referenceToKey = (value, bucket) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    const bucketMarker = `${bucket}/`;
    const bucketIndex = pathname.indexOf(bucketMarker);
    if (bucketIndex >= 0) return pathname.slice(bucketIndex + bucketMarker.length);
    const minioMarker = '/minio/';
    const minioIndex = pathname.indexOf(minioMarker);
    if (minioIndex >= 0) {
      const afterMinio = pathname.slice(minioIndex + minioMarker.length);
      if (afterMinio.startsWith(bucketMarker)) return afterMinio.slice(bucketMarker.length);
    }
    return pathname;
  } catch (_) {
    return raw.replace(/^\/+/, '').replace(new RegExp(`^${bucket}/`), '');
  }
};

const destinationKey = (ref) => {
  const categoryPrefix = ref.category === 'logo' ? 'logo' : ref.category;
  return `${categoryPrefix}/${ref.tenantId}/${ref.ownerType}/${ref.ownerId || 'unowned'}/${ref.sourceId}-${safeName(ref.legacyKey)}`;
};

const references = async () => {
  const queries = [
    {
      sql: `SELECT 'tenant' AS owner_type, 'logo' AS category, t.id::text AS owner_id, t.id::text AS source_id,
          t.id AS tenant_id, t."organizationId" AS organization_id, t.logo AS object_ref, 'logo' AS field_name
        FROM tenants t WHERE NULLIF(t.logo, '') IS NOT NULL`,
    },
    {
      sql: `SELECT 'tenant' AS owner_type, 'signature' AS category, t.id::text AS owner_id, t.id::text AS source_id,
          t.id AS tenant_id, t."organizationId" AS organization_id,
          COALESCE(t."assinaturaResponsavelTecnicoKey", t."assinaturaResponsavelTecnicoUrl") AS object_ref,
          'assinaturaResponsavelTecnico' AS field_name
        FROM tenants t
        WHERE NULLIF(COALESCE(t."assinaturaResponsavelTecnicoKey", t."assinaturaResponsavelTecnicoUrl"), '') IS NOT NULL`,
    },
    {
      sql: `SELECT 'user' AS owner_type, 'signature' AS category, u.id::text AS owner_id, u.id::text AS source_id,
          u."tenantId" AS tenant_id, t."organizationId" AS organization_id,
          COALESCE(u."assinaturaKey", u."assinaturaUrl") AS object_ref,
          'assinatura' AS field_name
        FROM users u LEFT JOIN tenants t ON t.id = u."tenantId"
        WHERE NULLIF(COALESCE(u."assinaturaKey", u."assinaturaUrl"), '') IS NOT NULL`,
    },
    {
      sql: `SELECT 'contracting_party' AS owner_type, 'signature' AS category, cp.id::text AS owner_id, cp.id::text AS source_id,
          COALESCE(u."tenantId", t.id) AS tenant_id, t."organizationId" AS organization_id,
          COALESCE(cp."assinaturaRepresentanteKey", cp."assinaturaRepresentanteUrl") AS object_ref,
          'assinaturaRepresentante' AS field_name
        FROM contracting_parties cp
        LEFT JOIN users u ON u.id = cp."createdByUserId"
        LEFT JOIN tenants t ON t.id = u."tenantId"
        WHERE NULLIF(COALESCE(cp."assinaturaRepresentanteKey", cp."assinaturaRepresentanteUrl"), '') IS NOT NULL`,
    },
    {
      sql: `SELECT 'tenant_contract' AS owner_type, 'contract' AS category, c.id::text AS owner_id, c.id::text AS source_id,
          c."tenantId" AS tenant_id, t."organizationId" AS organization_id,
          COALESCE(c."generatedPdfKey", c."generatedPdfUrl") AS object_ref,
          'generatedPdf' AS field_name
        FROM tenant_contracts c LEFT JOIN tenants t ON t.id = c."tenantId"
        WHERE NULLIF(COALESCE(c."generatedPdfKey", c."generatedPdfUrl"), '') IS NOT NULL`,
    },
    {
      sql: `SELECT 'tenant_contract' AS owner_type, 'document' AS category, c.id::text AS owner_id, c.id::text AS source_id,
          c."tenantId" AS tenant_id, t."organizationId" AS organization_id,
          c."contractDocumentUrl" AS object_ref, 'contractDocument' AS field_name
        FROM tenant_contracts c LEFT JOIN tenants t ON t.id = c."tenantId"
        WHERE NULLIF(c."contractDocumentUrl", '') IS NOT NULL`,
    },
  ];

  const rows = [];
  for (const query of queries) {
    const result = await legacySequelize.query(query.sql, { type: QueryTypes.SELECT });
    rows.push(...result);
  }
  return rows.map((row) => ({
    ...row,
    sourceSystem: 'legacy-api',
    sourceId: `${row.ownerType}:${row.sourceId}:${row.fieldName}`,
    legacyBucket: env.storage.legacyBucket,
    legacyKey: referenceToKey(row.object_ref, env.storage.legacyBucket),
  })).filter((row) => row.tenant_id && row.legacyKey);
};

const migrateOne = async (ref, counters) => {
  const sourceBucket = ref.legacyBucket;
  const targetBucket = env.storage.bucket;
  const sourceBuffer = await objectStore.getObjectBuffer(ref.legacyKey, sourceBucket);
  const checksum = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
  const objectKey = destinationKey(ref);
  const sourceId = ref.sourceId;
  const existing = await MediaObject.findOne({ where: { sourceSystem: ref.sourceSystem, sourceId } });

  if (!env.mediaMigrationWriteEnabled) {
    counters.dryRun += 1;
    return { sourceId, status: 'planned', legacyKey: ref.legacyKey, objectKey, checksum, sizeBytes: sourceBuffer.length };
  }

  await objectStore.putObject(objectKey, sourceBuffer, contentTypeFor(ref.legacyKey), targetBucket);
  const targetBuffer = await objectStore.getObjectBuffer(objectKey, targetBucket);
  const targetChecksum = crypto.createHash('sha256').update(targetBuffer).digest('hex');
  if (targetBuffer.length !== sourceBuffer.length || targetChecksum !== checksum) {
    throw new Error(`Checksum ou tamanho divergente após cópia: ${sourceId}`);
  }

  const payload = {
    tenantId: ref.tenant_id,
    organizationId: ref.organization_id || null,
    ownerType: ref.owner_type,
    ownerId: ref.owner_id,
    category: ref.category,
    bucket: targetBucket,
    objectKey,
    originalName: safeName(ref.legacyKey),
    contentType: contentTypeFor(ref.legacyKey),
    sizeBytes: sourceBuffer.length,
    checksumSha256: checksum,
    visibility: ref.category === 'logo' ? 'public' : 'private',
    status: 'active',
    uploadedByUserId: null,
    sourceSystem: ref.sourceSystem,
    sourceId,
    idempotencyKey: `physical-migration:${sourceId}`,
    metadata: {
      migratedFrom: { bucket: sourceBucket, objectKey: ref.legacyKey },
      legacyField: ref.fieldName,
      migratedAt: new Date().toISOString(),
    },
  };

  if (existing) {
    await existing.update(payload);
    counters.updated += 1;
    return { sourceId, status: 'updated', objectKey, checksum, sizeBytes: sourceBuffer.length };
  }
  await MediaObject.create(payload);
  counters.created += 1;
  return { sourceId, status: 'created', objectKey, checksum, sizeBytes: sourceBuffer.length };
};

const main = async () => {
  const refs = await references();
  const counters = { planned: 0, created: 0, updated: 0, failed: 0 };
  if (!(await objectStore.bucketExists(env.storage.legacyBucket))) {
    throw new Error(`Bucket legado não encontrado: ${env.storage.legacyBucket}`);
  }
  if (env.mediaMigrationWriteEnabled) await objectStore.ensureBucket(env.storage.bucket);

  const results = [];
  for (const ref of refs) {
    try {
      results.push(await migrateOne(ref, counters));
    } catch (error) {
      counters.failed += 1;
      results.push({ sourceId: ref.sourceId, status: 'failed', message: error.message });
    }
  }

  console.log(JSON.stringify({
    mode: env.mediaMigrationWriteEnabled ? 'write' : 'dry-run',
    sourceBucket: env.storage.legacyBucket,
    targetBucket: env.storage.bucket,
    totalReferences: refs.length,
    counters,
    results,
    legacyDeletion: env.mediaMigrationDeleteLegacyEnabled ? 'blocked-by-design: run reconciliation first' : 'disabled',
  }, null, 2));
  if (counters.failed > 0) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([legacySequelize.close(), sequelize.close()]);
  });
