# Operaon Media & File Storage

Standalone responsável pelo catálogo de metadados, upload, leitura autenticada, URLs presignadas, visibilidade pública controlada, exclusão lógica e ciclo de vida dos objetos de mídia da Operaon. O serviço possui banco próprio e usa armazenamento S3-compatible/MinIO isolado do gateway.

> **Fronteira do domínio:** o serviço administra objetos, metadados, chaves físicas, visibilidade e ciclo de vida. Ele não cadastra tenants, usuários, pacientes ou contratos e não mantém foreign keys físicas para outros bancos. Os vínculos são representados por identificadores estáveis e escopo autorizado.

## Execução

O serviço usa Node.js 18 ou superior, Express, Sequelize 6, PostgreSQL 16, MinIO/S3-compatible e Multer. A porta local padronizada é `4770`, o banco próprio é `operaon_media` e o banco de teste é `operaon_media_test`.

| Comando | Finalidade |
| --- | --- |
| `npm install` | Instala dependências |
| `npm start` | Inicia o serviço |
| `npm run dev` | Inicia com recarregamento por Nodemon |
| `npm run migrate` | Aplica migrations pendentes no banco próprio |
| `npm run migrate:undo` | Reverte a última migration |
| `npm test` | Executa a suíte Jest/Supertest |
| `npm run lint:syntax` | Verifica a sintaxe de `src`, `scripts` e `tests` |
| `npm run backfill:legacy` | Cataloga referências legadas em dry-run por padrão |
| `npm run migrate:objects` | Copia fisicamente objetos do bucket legado e valida SHA-256 |

A aplicação expõe `GET /health` para liveness e `GET /ready` para readiness. O prefixo das rotas de negócio é `/api/media`.

## Configuração

Copie `.env.example` para o ambiente de execução e substitua as credenciais do ambiente. O `.env` versionado contém apenas valores locais padronizados; nenhuma chave de produção deve ser commitada.

| Variável | Desenvolvimento | Observação |
| --- | --- | --- |
| `PORT` | `4770` | Porta HTTP do standalone |
| `DB_NAME` | `operaon_media` | Banco próprio do catálogo |
| `DB_USER` / `DB_PASSWORD` | `dbadmin` / valor local | Credenciais locais do PostgreSQL |
| `SERVICE_API_KEY` | placeholder local | Chave usada no header `X-Service-Key` |
| `JWT_ALGORITHM` | `HS256` | Em produção, usar a política criptográfica do Identity |
| `JWT_ISSUER` | `operaon-identity` | Issuer aceito pelo Identity |
| `JWT_AUDIENCE` | `operaon-api,operaon-identity,operaon-media` | Audiências aceitas |
| `MINIO_ENDPOINT` / `MINIO_PORT` | `minio` / `9000` | Endpoint interno do object storage |
| `MINIO_BUCKET` | `operaon-media` | Bucket de destino dos novos objetos e da migração |
| `LEGACY_MINIO_BUCKET` | `velyon-files` | Bucket de origem durante o cutover |
| `MINIO_PUBLIC_ENDPOINT` | `/minio` | Prefixo público usado por URLs de logos e assets |
| `MEDIA_MAX_FILE_SIZE_BYTES` | `10485760` | Limite global máximo de upload |
| `MEDIA_MIGRATION_WRITE_ENABLED` | `false` | Exige `true` para copiar objetos e gravar catálogo |
| `MEDIA_MIGRATION_DELETE_LEGACY_ENABLED` | `false` | Permanece desabilitado; remoção exige reconciliação separada |

A conexão de origem usa `LEGACY_DB_HOST`, `LEGACY_DB_NAME`, `LEGACY_DB_USER`, `LEGACY_DB_PASSWORD` e `LEGACY_DATABASE_URL`. Em produção, a origem deve apontar para a base legada real apenas durante a migração controlada.

## Segurança e escopo

Todas as rotas de negócio exigem autenticação **dual**: `X-Service-Key` precisa corresponder à chave de serviço configurada e `Authorization` precisa conter um bearer token JWT de acesso emitido pelo Identity. O JWT é validado por algoritmo, issuer, audience, expiração e `tokenType=access`.

O claim `tenantId` define o tenant principal; `organizationIds` restringe organizações autorizadas; `sub` identifica o usuário que realizou a operação. Se `X-Tenant-Id` for informado, ele precisa ser igual ao tenant do JWT. Tokens de serviço reconhecidos pelo próprio JWT podem receber escopo interno explicitamente fornecido pelo chamador. Não há bypass baseado no nome fixo de uma role.

| Permissão dinâmica | Operações |
| --- | --- |
| `media:read` | Listagem, consulta, presign e streaming autenticado |
| `media:write` | Upload multipart |
| `media:admin` | Exclusão lógica e operações administrativas |

Somente as categorias `logo` e `site` podem ser públicas. Assinaturas, documentos e contratos permanecem privados e são entregues por URL presignada ou streaming autenticado.

## Catálogo e object storage

A tabela `media_objects` é o catálogo próprio e registra tenant, organização, proprietário lógico, categoria, bucket físico, chave, nome original, MIME type, tamanho, SHA-256, visibilidade, status, origem e metadados. A combinação `bucket + objectKey` é única; referências de backfill usam `sourceSystem + sourceId` para garantir idempotência.

| Categoria | Uso | Visibilidade padrão | Tipos principais |
| --- | --- | --- | --- |
| `logo` | Logo do tenant | Pública | PNG, JPEG, WebP, SVG |
| `site` | Assets públicos do site | Pública | PNG, JPEG, WebP, SVG, GIF |
| `signature` | Assinaturas de usuários, responsáveis e partes | Privada | PNG |
| `document` | Documentos gerais | Privada | PDF, PNG, JPEG, DOC, DOCX |
| `contract` | PDFs de contratos | Privada | PDF |

O adapter é S3-compatible e pode operar com MinIO ou outro endpoint compatível. O bucket de destino recebe política pública apenas para os prefixos `logo/*` e `site/*`. A leitura de documentos e assinaturas nunca depende de URL pública.

## Contrato HTTP

| Método e caminho | Permissão | Finalidade |
| --- | --- | --- |
| `POST /api/media/objects` | `media:write` | Upload multipart com o campo `file` e metadados JSON opcionais |
| `GET /api/media/objects` | `media:read` | Lista metadados paginados por tenant, organização, categoria e proprietário |
| `GET /api/media/objects/:id` | `media:read` | Consulta um objeto dentro do escopo autorizado |
| `GET /api/media/objects/:id/presign` | `media:read` | Gera URL pública ou presignada conforme visibilidade |
| `GET /api/media/objects/:id/content` | `media:read` | Faz streaming autenticado do conteúdo |
| `DELETE /api/media/objects/:id` | `media:admin` | Remove o objeto físico e marca o catálogo como `deleted` |

O upload aceita `tenantId`, `organizationId`, `ownerType`, `ownerId`, `category`, `visibility`, `sourceSystem`, `sourceId`, `idempotencyKey` e `metadata`. O header `Idempotency-Key` também pode ser usado. Repetições da mesma origem ou chave retornam o objeto existente com `idempotent: true`.

## Migração física completa

A migração foi desenhada para copiar todos os objetos legados para `MINIO_BUCKET`, não apenas seus metadados. O script `scripts/migrate-physical-objects.js` lê as referências do banco legado, resolve chaves e URLs, copia o conteúdo do bucket `LEGACY_MINIO_BUCKET`, calcula SHA-256 antes da cópia, lê novamente o destino, valida tamanho e checksum e só então cria ou atualiza o registro em `media_objects`.

As referências cobertas são logos de tenants, assinaturas de responsáveis técnicos, assinaturas de usuários, assinaturas de partes contratantes, PDFs gerados de contratos e documentos de contratos. O catálogo registra a origem em `metadata.migratedFrom`, conserva o campo legado e passa a apontar para o bucket novo.

O fluxo é seguro para reexecução. O modo padrão é dry-run e não grava nada; a cópia efetiva exige explicitamente `MEDIA_MIGRATION_WRITE_ENABLED=true`:

```bash
LEGACY_DB_NAME=velyon_api_test \
LEGACY_DB_PASSWORD='senha-local' \
MEDIA_MIGRATION_WRITE_ENABLED=true \
NODE_ENV=development \
npm run migrate:objects
```

Nenhum objeto legado é removido pelo migrador. A deleção física só pode ocorrer em uma etapa operacional posterior, depois de reconciliação independente de contagem, tamanho, SHA-256, leitura no bucket novo e ausência de consumidores legados. A flag `MEDIA_MIGRATION_DELETE_LEGACY_ENABLED` permanece desabilitada por padrão e não autoriza remoção automática.

Se o bucket legado ou o endpoint MinIO estiver indisponível, a execução falha de forma explícita antes de declarar a migração concluída. Isso evita catalogar objetos inexistentes ou apagar referências sem validação física.

## Backfill de referências

`scripts/backfill-legacy.js` continua disponível para catalogar referências sem copiar conteúdo. Ele é útil para inventário e reconciliação, mas não substitui `npm run migrate:objects` quando o requisito é isolamento físico completo. Ambos os scripts são somente-aditivos e não alteram tabelas legadas.

## Cutover gradual

O gateway preserva as rotas legadas de logo, assinatura e upload durante a transição. O namespace novo `/api/media-standalone` encaminha o contrato para este serviço por meio de integração dinâmica cadastrada no gateway. O cutover recomendado é executar inventário, copiar e validar todos os objetos, apontar o catálogo para o bucket novo, comparar consumidores frontend e backend, habilitar novas gravações no namespace standalone e somente depois remover caminhos legados.

Durante a janela de reconciliação, o bucket antigo permanece intacto. Após a confirmação de que nenhum consumidor consulta chaves antigas, a limpeza dos objetos e das colunas legadas deve ser feita em operação separada, com backup e rollback documentados.

## Desenvolvimento e validação

Antes de publicar alterações, execute:

```bash
npm run lint:syntax
npm test -- --runInBand
npm run migrate
npm run migrate:objects
```

A suíte cobre upload multipart, idempotência, isolamento de tenant, URLs privadas e RBAC dinâmico. O serviço registra `X-Request-Id`, usa logs estruturados com Pino, aplica Helmet, compressão, CORS configurável, rate limit operacional e readiness com verificação do banco próprio e do bucket de destino.
