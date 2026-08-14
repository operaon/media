# Documentação — Media & File Storage

> **Status:** documentação versionada em Docs as Code. **Owner:** Media & File Storage. **Branch:** main.

Este índice organiza a documentação oficial do repositório [Media & File Storage][1]. A documentação global define os padrões; este repositório registra somente responsabilidades, contratos e procedimentos específicos.

## Visão rápida

| Campo | Valor |
| --- | --- |
| Repositório | `media` |
| Tipo | module |
| Responsabilidade | Metadados, upload, download, objetos físicos e controle de arquivos. |
| Porta declarada | 4770 |
| Banco próprio | Sim, conforme configuração do serviço |
| Entrada oficial | Gateway ou serviço autorizado |

## Documentos

- [Contrato do módulo](module-contract.md)
- [API e endpoints](api.md)
- [Eventos e integrações](events.md)
- [Segurança](security.md)
- [Operação](operations.md)
- [Testes](testing.md)
- [Runbook de saúde](runbooks/health-and-readiness.md)
- [Decisões arquiteturais](decisions/ADR-0001-documentation-standard.md)

## Princípios

Arquivos devem possuir tenant, owner, autorização, retenção e trilha de acesso; URLs devem ser temporárias quando necessário.

A regra de ownership é obrigatória: comandos que alteram estado devem ser enviados ao owner do domínio; eventos informam mudanças após commit; consultas não transferem ownership.

## Referências

[1]: https://github.com/operaon/media "Repositório Media & File Storage"
[2]: https://github.com/operaon/api "API Gateway Operaon"
[3]: https://github.com/operaon/identity "Identity Operaon"
