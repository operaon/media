# Operação — Media & File Storage

## Execução local

A operação deve seguir os scripts reais do "package.json" e o ".env.example". Segredos reais são fornecidos pelo ambiente, nunca por este repositório.

| Procedimento | Regra |
| --- | --- |
| Inicialização | Validar configuração, conectividade e migrations antes de aceitar tráfego |
| Health | Expor health liveness sem dependência externa e readiness validando dependências críticas |
| Deploy | Executar migration compatível, subir instância, validar readiness e observar logs |
| Rollback | Reverter aplicação somente com migration reversível ou procedimento aprovado |
| Timeout | Usar timeout interno curto e retry limitado com backoff exponencial |
| Eventos | Publicar após commit via outbox; consumidores usam inbox/deduplicação |
| Falhas | Não apagar obrigações, pagamentos, créditos ou auditoria para esconder falhas |

## Observabilidade

Logs estruturados devem conter "serviceId", "tenantId" quando permitido, "correlationId", "requestId", "eventId", "sourceSystem", resultado, duração e erro classificável. Métricas mínimas: taxa de erro, latência, retries, rejeições de autenticação, duplicatas, backlog, DLQ e readiness.

## Ambientes

Desenvolvimento, homologação e produção devem possuir configurações e credenciais próprias. Portas, URLs, audience, scopes, certificados e limites podem variar por ambiente; nomes e regras do contrato permanecem uniformes.

## Continuidade

Backups, restore, retenção, RPO e RTO devem ser definidos pelo ambiente de infraestrutura. Migrations e eventos devem ser reproduzíveis e observáveis. Toda perda ou divergência deve ser tratada por runbook, sem alteração manual silenciosa no banco.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
