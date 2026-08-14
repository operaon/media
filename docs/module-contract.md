# Contrato do módulo — media

Este documento resume o contrato local de media. O contrato transversal de headers e webhooks está em [communication-contract.md](communication-contract.md).

## Entrada

Chamadas internas devem utilizar JWT de serviço com audience do destino, scopes mínimos, contexto de tenant, correlação, origem, idempotência e os headers canônicos. Rotas públicas, quando existirem, passam pelo API Gateway.

## Saída

Chamadas a outros módulos devem utilizar o builder de headers padronizado, timeout, retry limitado, correlação e idempotência. Eventos devem utilizar envelope versionado e ser publicados após commit via outbox quando dependerem de transação local.

## Compatibilidade

Mudanças incompatíveis exigem nova versão ou período de compatibilidade documentado. Nenhum consumidor deve depender de tabelas internas ou de estados que pertencem a outro owner.

## Segurança

O módulo não deve ser exposto diretamente à Internet. O tenant deve ser validado, segredos devem permanecer fora do Git e webhooks devem validar assinatura, timestamp, nonce e identificador de entrega.

## Referências

[1]: https://github.com/operaon "Organização Operaon"
