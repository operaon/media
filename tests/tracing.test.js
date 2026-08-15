'use strict';

const {
  getRequestContext,
  communicationContext,
  buildInternalHeaders,
  buildEventEnvelope
} = require('../src/middlewares/communicationContext');

describe('contrato de tracing da comunicação interna', () => {
  it('preserva o trace ID recebido e o devolve na resposta', () => {
    const req = { headers: {
      'x-request-id': 'request-1',
      'x-correlation-id': 'correlation-1',
      'x-trace-id': 'trace-1'
    } };
    const responseHeaders = {};
    const res = { setHeader(name, value) { responseHeaders[name] = value; } };
    let called = false;

    communicationContext(req, res, () => { called = true; });

    expect(called).toBe(true);
    expect(req.traceId).toBe('trace-1');
    expect(responseHeaders['X-Trace-Id']).toBe('trace-1');
  });

  it('usa correlation ID como fallback determinístico quando trace ID não é enviado', () => {
    const context = getRequestContext({ headers: { 'x-correlation-id': 'correlation-2' } });
    expect(context.traceId).toBe('correlation-2');
  });

  it('propaga trace ID em headers internos e no envelope de evento', () => {
    const context = { requestId: 'request-3', correlationId: 'correlation-3', traceId: 'trace-3' };
    const headers = buildInternalHeaders({ context, method: 'POST', eventType: 'test.event' });
    const envelope = buildEventEnvelope({ eventType: 'test.event', payload: { ok: true }, context });

    expect(headers['X-Trace-Id']).toBe('trace-3');
    expect(envelope.traceId).toBe('trace-3');
  });
});
