const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');
const { toErrorResponse } = require('../utils/errors');

const requestContext = (req, res, next) => {
  req.requestId = req.get('X-Request-Id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

const authRateLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT || 100),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const errorHandler = (error, req, res, _next) => {
  const statusCode = error.statusCode || 500;
  logger.error({ err: error, requestId: req.requestId, statusCode }, 'request failed');
  res.status(statusCode).json({ ...toErrorResponse(error), requestId: req.requestId });
};

module.exports = { requestContext, authRateLimiter, errorHandler };
