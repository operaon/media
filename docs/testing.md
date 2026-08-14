# Testes e qualidade — Media & File Storage

## Estratégia

A qualidade deve ser validada em camadas: sintaxe e lint, testes unitários, testes de integração com banco/HTTP, testes de contrato, testes de segurança e smoke test de health/readiness.

## Casos mínimos

| Área | Casos obrigatórios |
| --- | --- |
| Autenticação | token ausente, issuer/audience inválidos, scope insuficiente, keyId revogado |
| Multi-tenant | tenant divergente, organization inválida, recurso de outro tenant |
| Idempotência | replay com mesmo payload, mesma chave com payload diferente, concorrência |
| Headers | propagação, geração, precedência segura e rejeição de valores inválidos |
| Webhooks | assinatura válida, assinatura inválida, timestamp expirado, replay e payload inválido |
| Operação | readiness degradado, timeout, retry limitado, DLQ e recuperação |
| Domínio | transições válidas e inválidas do owner local |

## Evidências

Cada pipeline deve publicar resultado de testes, cobertura quando disponível, validação de schemas e relatório de segredos. Testes que dependem de banco local devem documentar pré-requisitos e causa de falha de infraestrutura separadamente de falha de código.

## Compatibilidade

Mudanças de API, evento ou webhook devem executar testes contra a versão anterior durante a janela de compatibilidade. Um consumidor desconhecido não pode ser quebrado sem ADR, versionamento e plano de migração.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
