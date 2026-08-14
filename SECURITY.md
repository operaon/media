# Política de segurança — media

A segurança é requisito de produção e deve ser tratada como defesa em profundidade. Vulnerabilidades não devem ser publicadas com segredos ou dados reais.

## Comunicação

Utilizar os headers canônicos, JWT com audience/scope, tenant validation, idempotência e assinatura de webhook conforme [docs/security.md](docs/security.md). Módulos não devem ser expostos diretamente à Internet.

## Relato

Relatos de vulnerabilidade devem ser tratados de forma privada pelo owner do repositório e pela plataforma. Não incluir tokens, credenciais, dados de pacientes, dados financeiros ou chaves privadas em issues públicas, commits ou documentação.

## Segredos

Segredos são fornecidos por ambiente seguro, rotacionados com identificação de versão e auditados. Exemplos documentais devem usar placeholders.

## Referências

[1]: https://github.com/operaon "Organização Operaon"
