# Contribuição — media

## Antes de alterar

Leia [docs/INDEX.md](docs/INDEX.md), confirme o owner do domínio e consulte as ADRs. Não altere ownership, contratos ou segurança sem documentar a decisão e o impacto.

## Qualidade

Execute os scripts de syntax/lint, testes, validação documental e verificação de segredos disponíveis no repositório. Mudanças de API, eventos, webhooks, migrations e configuração devem incluir documentação compatível.

## Segurança

Não inclua tokens, senhas, certificados privados, dados pessoais ou arquivos .env reais. Nunca force escrita legada para contornar o owner do módulo.

## Publicação

As alterações deste ecossistema devem ser feitas na branch main, com commit descritivo, validação local e sincronização com origin/main.

## Referências

[1]: https://github.com/operaon "Organização Operaon"
