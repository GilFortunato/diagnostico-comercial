# Fechamento futuro — aguardando autorização

## Regra

Não consolidar branches, fazer merge em produção, aplicar migrations, alterar variáveis/aliases ou fazer deploy enquanto a usuária não autorizar. Publicação não foi feita nesta tarefa.
Após autorização, respeitar a sequência abaixo e realizar somente um deploy de produção depois de tudo verde.

## Comparação remota feita antes da retomada

Fetch remoto em 02/10/2026, sem push:
- base Scout: codex/share-hub-postdeploy-fixes — 8937d36;
- produção/remoto padrão: codex/share-ai-mvp-foundation — bf602f2;
- B2B e Nexus: codex/b2b-workspace-fixes — 7983028;
- HR: codex/hr-owner-delete-job — f2b64d5;
- refinamentos: codex/share-hub-refinements — 23e4e3a;
- Scout anterior: codex/share-scout-mvp — adb330d.

Refinamentos, Scout anterior e postdeploy já são ancestrais desta base.
A branch B2B contém as correções de HR, além do workspace compartilhado e dos tiles/ordem aprovados de Home/Nexus.
Os arquivos Scout e autenticação não divergem entre a base e o head B2B.
Admin, Humanship, permissões e Diagnóstico também não divergem nessa comparação.
Nenhuma dessas branches foi movida ou sobrescrita.

A branch MKT não incorpora os novos commits de B2B/Home/HR: eles permanecem em suas branches até a consolidação autorizada.
Prisma é o ponto compartilhado: B2B acrescenta modelos perto de HrCandidateReview; MKT acrescenta MktScoutRecord ao fim. Preservar ambos.
Migrations novas têm nomes completos distintos: 20261002090000_add_b2b_workspace e 20261002090000_mkt_scout_records. Revisar as duas e a ordem completa antes de aplicar.

## 1. MKT Scout

- [x] Radar, fontes e score explicado implementados.
- [x] Visual Scout fora da navegação separada; direção visual integrada.
- [x] Falha parcial/total, métricas ausentes, ausência de keys e validade temporal testadas.
- [x] Cache e gerações por conta testados sem produção.
- [x] Desktop/mobile auditados em harness local com fixtures identificadas.
- [ ] Validar OAuth e permissões com contas de teste em ambiente isolado.
- [ ] Aplicar migration somente em banco isolado autorizado e validar histórico PostgreSQL.
- [ ] Validar Gemini e provedores visuais com credenciais de teste.
- [ ] Repetir integração na árvore consolidada.

## 2. B2B Hunting

Preservar os commits atuais e validar:
- sidebar/workspace, pesquisas compartilhadas;
- “Pesquisa da Gil” e “Lead da Gil”;
- persistência do banco de leads e autoria;
- consulta ao cache antes do motor externo;
- listas compartilhadas e ações;
- evitar apagar modelos/migration B2B ao integrar Prisma.

## 3. Humanship

Validar sem substituir as correções existentes:
- workspace e cards por evento;
- participantes e importação dentro do evento;
- restrições editáveis e versionadas;
- ADM Humanship;
- exclusão somente por contas autorizadas.

## 4. Restante da plataforma

- HR Hunting, incluindo exclusão de vaga pelo proprietário;
- Admin/permissões;
- logs/auditoria;
- Home/Nexus: tiles, ordem, rótulos e navegação aprovados;
- Diagnóstico Comercial.

## Gates antes da consolidação/deploy

- [ ] Atualizar refs e comparar novamente; hashes acima podem avançar.
- [ ] Resolver lint global preexistente sem reverter trabalho de outra frente.
- [ ] Lint, typecheck, testes e build da árvore consolidada verdes.
- [ ] Revisar conflitos e confirmar presença de todas as correções.
- [ ] Revisar migration completa, banco alvo e resultado em ambiente isolado.
- [ ] Obter autorização explícita da usuária para o fechamento.
- [ ] Consolidar branches preservando histórico e alterações.
- [ ] Aplicar migrations aprovadas e fazer um único deploy de produção.
- [ ] Validar produção na mesma ordem.

Não executar scripts/vercel-build.mjs como um simples teste local: o script existente aplica migrations se VERCEL_ENV=production. Nesta tarefa foi usado exclusivamente pnpm build, que executa next build.
