'use strict';

const state = {
  startedAt: Date.now(),
  requestsTotal: 0,
  responsesByStatus: Object.create(null),
  errorsTotal: 0,
  latencyMs: { count: 0, sum: 0, max: 0 }
};

function collectMetrics(req, res, next) {
  const path = req.path || req.url || '';
  if (path === '/health' || path === '/ready' || path === '/metrics' || path.endsWith('/health') || path.endsWith('/ready') || path.endsWith('/metrics')) {
    return next();
  }

  const started = process.hrtime.bigint();
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const status = String(res.statusCode);
    state.requestsTotal += 1;
    state.responsesByStatus[status] = (state.responsesByStatus[status] || 0) + 1;
    if (res.statusCode >= 500) state.errorsTotal += 1;
    state.latencyMs.count += 1;
    state.latencyMs.sum += durationMs;
    state.latencyMs.max = Math.max(state.latencyMs.max, durationMs);
  });
  return next();
}

function snapshot() {
  const memory = process.memoryUsage();
  const averageLatencyMs = state.latencyMs.count === 0 ? 0 : state.latencyMs.sum / state.latencyMs.count;
  return {
    process: {
      uptimeSeconds: process.uptime(),
      startedAt: new Date(state.startedAt).toISOString(),
      pid: process.pid,
      nodeVersion: process.version,
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external
      }
    },
    http: {
      requestsTotal: state.requestsTotal,
      responsesByStatus: { ...state.responsesByStatus },
      errorsTotal: state.errorsTotal,
      latencyMs: {
        count: state.latencyMs.count,
        sum: state.latencyMs.sum,
        average: averageLatencyMs,
        max: state.latencyMs.max
      }
    }
  };
}

module.exports = { collectMetrics, snapshot };
