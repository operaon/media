require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';
const requiredInProduction = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (isProduction && !value) throw new Error(`${name} é obrigatório em produção`);
  return value;
};
const parseList = (value, fallback = []) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : fallback);
const parsePositiveInt = (name, fallback, min = 1) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min) throw new Error(`${name} deve ser um inteiro >= ${min}`);
  return value;
};

const host = process.env.HOST || '0.0.0.0';
const port = parsePositiveInt('PORT', 4790);
if (port > 65535) throw new Error('PORT inválida');
const jwtAlgorithm = process.env.JWT_ALGORITHM || 'HS256';
if (!['HS256', 'RS256', 'EdDSA'].includes(jwtAlgorithm)) throw new Error('JWT_ALGORITHM deve ser HS256, RS256 ou EdDSA');
const jwtSecret = requiredInProduction('JWT_SECRET', isTest ? 'media-test-jwt-secret-change-me' : 'media-development-jwt-secret-change-me');
if (jwtAlgorithm === 'HS256' && isProduction && jwtSecret.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em produção');
const normalizeKey = (value) => (value ? value.replace(/\\n/g, '\n') : undefined);

module.exports = {
  nodeEnv,
  isProduction,
  isTest,
  host,
  port,
  serviceName: process.env.SERVICE_NAME || 'operaon_media',
  trustProxyHops: parsePositiveInt('TRUST_PROXY_HOPS', 1, 0),
  serviceApiKey: requiredInProduction('SERVICE_API_KEY', isTest ? 'media-test-service-key' : 'media-development-service-key'),
  jwt: {
    algorithm: jwtAlgorithm,
    secret: jwtSecret,
    publicKey: normalizeKey(process.env.JWT_PUBLIC_KEY),
    issuer: process.env.JWT_ISSUER || 'operaon-identity',
    audience: parseList(process.env.JWT_AUDIENCE, ['operaon-media']),
  },
  database: {
    url: process.env.DATABASE_URL,
    name: process.env.DB_NAME || 'operaon_media',
    user: process.env.DB_USER || 'dbadmin',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    ssl: process.env.DB_SSL === 'true',
  },
  legacyDatabase: {
    url: process.env.LEGACY_DATABASE_URL,
    name: process.env.LEGACY_DB_NAME || 'velyon_api',
    user: process.env.LEGACY_DB_USER || 'dbadmin',
    password: process.env.LEGACY_DB_PASSWORD || '',
    host: process.env.LEGACY_DB_HOST || 'localhost',
    port: Number(process.env.LEGACY_DB_PORT || 5432),
  },
  cors: { origin: process.env.CORS_ORIGIN || (isProduction ? '' : '*') },
  requestTimeoutMs: parsePositiveInt('REQUEST_TIMEOUT_MS', 5000),
  maxQueryLimit: parsePositiveInt('MAX_QUERY_LIMIT', 100),
  backfillWriteEnabled: process.env.BACKFILL_WRITE_ENABLED === 'true',
  mediaMigrationWriteEnabled: process.env.MEDIA_MIGRATION_WRITE_ENABLED === 'true',
  mediaMigrationDeleteLegacyEnabled: process.env.MEDIA_MIGRATION_DELETE_LEGACY_ENABLED === 'true',
  storage: {
    endpoint: process.env.MINIO_ENDPOINT || 'minio',
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'operaon-media',
    legacyBucket: process.env.LEGACY_MINIO_BUCKET || 'velyon-files',
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT || '/minio',
    region: process.env.MINIO_REGION || 'us-east-1',
    presignExpirySeconds: parsePositiveInt('PRESIGN_EXPIRY_SECONDS', 900),
    maxFileSizeBytes: parsePositiveInt('MEDIA_MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024),
  },
};
