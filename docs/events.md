# Eventos e integrações — Media & File Storage

## Princípio

Comandos alteram estado no owner; eventos informam mudanças depois do commit; consultas retornam dados autorizados. Um evento não deve ser tratado como comando implícito em outro domínio.

## Envelope

```json
{
  "eventId": "evt_01",
  "eventType": "media.entity.changed",
  "eventVersion": 1,
  "sourceSystem": "media",
  "sourceId": "entity_01",
  "tenantId": "tenant_01",
  "organizationId": "org_01",
  "correlationId": "corr_01",
  "occurredAt": "2026-08-14T23:00:00.000Z",
  "payload": {}
}
```

## Garantias

O produtor deve usar outbox quando o evento depender de transação local. O consumidor deve usar inbox ou registro de "eventId", tolerar entrega pelo menos uma vez, ser seguro para retry e enviar mensagens irrecuperáveis para DLQ.

## Integrações locais

Identity, Tenant & Organization e storage compatível com o ambiente.

Integrações externas devem validar assinatura, timestamp, nonce e "X-Webhook-Id". Integrações internas devem validar mTLS quando habilitado, JWT de serviço, audience, scopes e contrato de headers.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
