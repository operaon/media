const jwt = require('jsonwebtoken');
const env = require('../config/env');

const verificationKey = () => {
  if (env.jwt.algorithm === 'HS256') return env.jwt.secret;
  if (!env.jwt.publicKey) throw new Error('JWT_PUBLIC_KEY não configurada');
  return env.jwt.publicKey;
};

const verifyAccessToken = (token) => {
  try {
    const claims = jwt.verify(token, verificationKey(), {
      algorithms: [env.jwt.algorithm],
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    });
    return claims?.tokenType === 'access' ? claims : null;
  } catch (_) {
    return null;
  }
};

module.exports = { verifyAccessToken };
