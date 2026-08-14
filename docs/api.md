# API e endpoints — Media & File Storage

A API HTTP deste módulo deve ser tratada como contrato versionado. Rotas públicas e internas devem ser separadas, com middleware de autenticação, tenant, validação de entrada, idempotência e tratamento de erros.

## Padrão de endpoint

| Camada | Responsabilidade |
| --- | --- |
| Route | Método, caminho, middleware e status HTTP |
| Controller | Validação de entrada e composição da resposta |
| Service | Regra de negócio e transação |
| Repository/Model | Persistência local e índices únicos |
| Integration client | Headers, timeout, retry e correlação |

## Endpoints internos

Endpoints internos devem utilizar "Authorization" de serviço, audience do destino, scopes mínimos, "X-Service-Id", "X-Correlation-Id", tenant/organization, origem e idempotência conforme o comando. Não devem ser publicados diretamente na Internet.

## Evolução

Toda alteração incompatível exige versão nova ou compatibilidade explícita. O README e este documento devem apontar para OpenAPI/AsyncAPI quando esses artefatos forem adicionados.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
