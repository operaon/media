# Segurança — Media & File Storage

## Modelo

A segurança segue **defense in depth** e zero trust. A existência de rede interna não autoriza uma chamada automaticamente. Cada requisição deve ser autenticada, autorizada, vinculada ao tenant correto, rastreável e limitada ao escopo necessário.

## Comunicação

| Controle | Regra |
| --- | --- |
| Entrada pública | Somente pelo API Gateway, quando aplicável |
| Serviço chamador | Identificado por "X-Service-Id" e JWT de serviço. |
| JWT | Issuer da Identity, audience específica do destino, scopes mínimos e expiração curta |
| Headers | Contrato comum; o Gateway remove headers internos recebidos do cliente e recria o contexto |
| Webhooks | Assinatura HMAC/assimétrica, timestamp, nonce, ID de entrega e deduplicação |
| Tenant | Validado contra token, rota e recurso; não confiar em valor enviado pelo cliente |
| Segredos | Fora do código e dos documentos; usar secret manager/KMS/Vault no ambiente |
| Logs | Nunca registrar senha, token, chave privada, CVV ou dados clínicos desnecessários |

## Headers canônicos

Chamadas internas utilizam "Authorization", "X-Service-Id", "X-Key-Id", "X-Protocol-Version", "X-Tenant-Id", "X-Organization-Id", "X-Correlation-Id", "X-Request-Id", "X-Source-System", "X-Source-Id", "X-Event-Id", "X-Event-Type", "X-Event-Version", "Idempotency-Key", timestamp e nonce conforme o contexto.

Webhooks utilizam "X-Webhook-Id", "X-Webhook-Key-Id", "X-Webhook-Timestamp", "X-Webhook-Nonce", "X-Webhook-Signature", "X-Event-Type", "X-Event-Version", "X-Correlation-Id" e "X-Delivery-Attempt".

## Rotação

"COMMUNICATION_KEY_ID" e "WEBHOOK_KEY_ID" identificam versões de credenciais. A rotação efetiva deve manter versão ativa e anterior durante uma janela de grace, publicar a nova versão, revogar a antiga após expiração de tokens e auditar cada mudança. Chaves privadas não devem ficar no banco do módulo sem envelope encryption e chave mestre externa.

## Incidentes

Em suspeita de comprometimento, revogar a credencial por "keyId", bloquear o principal, preservar logs e eventos, avaliar replay, rotacionar o segredo, registrar o incidente no Audit e somente depois reprocessar mensagens autorizadas.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
