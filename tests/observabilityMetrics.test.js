'use strict';

const EventEmitter = require('events');
const { collectMetrics, snapshot } = require('../src/middlewares/observabilityMetrics');

describe('observabilidade HTTP', () => {
  it('contabiliza uma resposta de domínio e mede latência', () => {
    const before = snapshot();
    const res = new EventEmitter();
    res.statusCode = 201;
    let called = false;

    collectMetrics({ path: '/api/domain-resource' }, res, () => { called = true; });
    res.emit('finish');

    const after = snapshot();
    expect(called).toBe(true);
    expect(after.http.requestsTotal).toBe(before.http.requestsTotal + 1);
    expect(after.http.responsesByStatus['201']).toBe((before.http.responsesByStatus['201'] || 0) + 1);
    expect(after.http.latencyMs.count).toBe(before.http.latencyMs.count + 1);
  });

  it('não contabiliza health, readiness ou métricas como tráfego de domínio', () => {
    const before = snapshot();
    for (const path of ['/health', '/ready', '/metrics']) {
      const res = new EventEmitter();
      res.statusCode = 200;
      collectMetrics({ path }, res, () => {});
      res.emit('finish');
    }
    const after = snapshot();
    expect(after.http.requestsTotal).toBe(before.http.requestsTotal);
    expect(after.http.latencyMs.count).toBe(before.http.latencyMs.count);
  });
});
