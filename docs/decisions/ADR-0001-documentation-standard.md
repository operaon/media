# ADR-0001 — Padrão documental e ownership

- **Status:** Accepted
- **Data:** 2026-08-14
- **Owner:** Media & File Storage
- **Escopo:** Media & File Storage

## Contexto

A organização Operaon possui múltiplos módulos e clientes com responsabilidades distintas. Documentação dispersa ou duplicada dificulta operação, segurança e evolução dos contratos.

## Decisão

Este repositório seguirá Docs as Code: README para entrada, documentos Markdown para explicação, OpenAPI para REST, AsyncAPI/JSON Schema para eventos quando disponibilizados, Mermaid para diagramas, ADR para decisões e runbooks para operação. O ownership permanece no domínio descrito no índice.

## Consequências

A documentação passa a ser revisada junto com o código e pode ser validada no CI. Alterações de contrato exigem atualização documental e evidência de compatibilidade. A documentação não substitui testes nem autorização em runtime.

## Pendências

- [ ] Publicar especificação OpenAPI formal do módulo.
- [ ] Publicar AsyncAPI/JSON Schema dos eventos reais.
- [ ] Integrar validação documental ao CI.
- [ ] Migrar chaves de serviço para secret manager com rotação automática.
- [ ] Tornar mTLS obrigatório em produção.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
