const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'credentials',
      'credentials.*',
      'secret',
      'serviceApiKey',
      'apiKey',
      'clientSecret',
      'accessToken',
      'refreshToken',
      'password',
      'token',
    ],
    censor: '[REDACTED]',
  },
});
