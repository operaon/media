# Operaon Communication Contract v1

## Escopo

Este contrato é obrigatório para comunicação entre o Gateway/API e os módulos Operaon, para chamadas de consumo interno, comandos idempotentes e webhooks assíncronos.

## Headers internos

| Header | Obrigatório | Regra |
| --- | --- | --- |
| `Authorization` | Sim, exceto webhook externo | JWT de serviço com audience do destinatário e scopes mínimos |
| `X-Service-Key` | Compatibilidade temporária | Segredo exclusivo por serviço; não substitui JWT/mTLS |
| `X-Service-Id` | Sim | Identidade do chamador |
| `X-Key-Id` | Sim | Versão da chave ou certificado |
| `X-Protocol-Version` | Sim | Versão do contrato; atual `1` |
| `X-Request-Id` | Sim | Identificador da requisição no serviço atual |
| `X-Correlation-Id` | Sim | Propagado por toda a jornada |
| `X-Tenant-Id` | Em contexto multi-tenant | Recriado/validado pelo Gateway e pelo destinatário |
| `X-Organization-Id` | Quando aplicável | Validado contra tenant e token |
| `X-Source-System` | Em comandos/eventos | Serviço que originou o fato |
| `X-Source-Id` | Em comandos/eventos | Identificador do fato de negócio |
| `X-Event-Id` | Em eventos | UUID único do evento |
| `X-Event-Type` | Em comandos/eventos | Tipo registrado no catálogo |
| `X-Event-Version` | Em comandos/eventos | Versão do schema |
| `Idempotency-Key` | Em mutações financeiras | Determinística por operação de negócio |
| `X-Request-Timestamp` | Em chamadas internas | ISO-8601; usada para observabilidade e replay policy |
| `X-Request-Nonce` | Em chamadas internas | Valor único por entrega |

## Headers de webhook

| Header | Regra |
| --- | --- |
| `X-Webhook-Id` | Identifica a entrega; chave de inbox/deduplicação |
| `X-Webhook-Key-Id` | Identifica a versão do segredo |
| `X-Webhook-Timestamp` | Unix timestamp; janela padrão de 5 minutos |
| `X-Webhook-Nonce` | Proteção adicional contra replay |
| `X-Webhook-Signature` | HMAC-SHA256 sobre `timestamp.rawBody` |
| `X-Event-Type` | Tipo do evento |
| `X-Event-Version` | Versão do schema |
| `X-Correlation-Id` | Correlação da origem |
| `X-Delivery-Attempt` | Número da tentativa de entrega |

## Regras de confiança

O Gateway remove headers internos recebidos de clientes externos e os recria. Um serviço não confia em `X-Tenant-Id` sem comparar com o JWT e com o recurso. Webhooks externos não são autenticados por JWT da Operaon; são autenticados por assinatura, timestamp, nonce e deduplicação. Segredos, chaves privadas, tokens de provedor e credenciais não fazem parte deste documento nem devem ser versionados.

## Envelope de evento

```json
{
  "eventId": "evt_01",
  "eventType": "billing.payment.confirmed",
  "eventVersion": 1,
  "sourceSystem": "pay",
  "sourceId": "payment_01",
  "tenantId": "tenant_01",
  "organizationId": "org_01",
  "correlationId": "corr_01",
  "occurredAt": "2026-08-14T23:01:00.000Z",
  "payload": {}
}
```

## Compatibilidade

Durante a migração, `X-Service-Key` permanece aceito somente nos endpoints internos já publicados. Novos fluxos devem usar JWT de serviço e, em produção, mTLS. A remoção das chaves legadas exige uma janela de migração, métricas de uso e revogação controlada.
