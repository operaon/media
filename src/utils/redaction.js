const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'token', 'refreshToken', 'accessToken', 'idToken',
  'secret', 'apiKey', 'api_key', 'authorization', 'cookie', 'set-cookie',
  'deviceFingerprint', 'twoFactorSecret', 'mfaSecret', 'backupCodes',
  'resetToken', 'verificationCode', 'sessionToken', 'privateKey', 'clientSecret',
]);

const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING_LENGTH = 12000;

const redact = (value, depth = 0) => {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (typeof value === 'string') return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]` : value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1));

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) result[key] = '[REDACTED]';
    else result[key] = redact(child, depth + 1);
  }
  return result;
};

const publicEvent = (event) => {
  const value = typeof event?.toJSON === 'function' ? event.toJSON() : event;
  const clean = redact(value);
  delete clean.legacyId;
  delete clean.legacySource;
  delete clean.retentionUntil;
  delete clean.legalHold;
  return clean;
};

module.exports = { redact, publicEvent, SENSITIVE_KEYS };
