'use strict';

const { snapshot } = require('./metrics');

function metrics(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: process.env.SERVICE_NAME || process.env.APP_NAME || 'operaon-service',
    timestamp: new Date().toISOString(),
    metrics: snapshot()
  });
}

module.exports = { metrics };
