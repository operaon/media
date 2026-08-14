# Runbook — health, readiness e incidentes

## Verificação inicial

1. Confirmar branch/versão e ambiente implantado.
2. Consultar liveness e readiness.
3. Buscar X-Correlation-Id ou X-Request-Id nos logs.
4. Verificar dependências, banco, fila/outbox, secret manager e certificados.
5. Avaliar se a falha é retryable antes de reprocessar.

## Readiness degradado

Não liberar tráfego quando migration incompatível, banco indisponível, segredo ausente ou certificado expirado impedir operação segura. Liveness pode continuar respondendo para permitir diagnóstico.

## Falha de chamada interna

Aplicar timeout, no máximo três tentativas com backoff, respeitar idempotência e não duplicar cobrança, crédito ou notificação. Após o limite, registrar evento e enviar para DLQ ou fila de revisão.

## Falha financeira

Manter a obrigação em estado pendente/falho; nunca apagar a venda. Pay deve preservar a transação e o webhook bruto. Billing deve aguardar confirmação, conciliar ou abrir exceção operacional.

## Segurança

Em suspeita de replay ou comprometimento: bloquear ou revogar a credencial pelo keyId, preservar evidências, rotacionar segredo, verificar eventos duplicados, notificar o owner e registrar auditoria.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
