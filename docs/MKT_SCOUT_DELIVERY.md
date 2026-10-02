# MKT Scout — entrega para revisão

## Estado

Branch local: `codex/mkt-scout-rebuild`, criada de `origin/codex/share-hub-postdeploy-fixes` (`8937d36`).
Nenhum push, merge, deploy ou migration aplicada. Nenhuma variável de ambiente de produção alterada.

A rota principal continua `/sharetrendintelligence`. `/sharevisualscout` redireciona para ela e preserva o tema da URL.
Os componentes e adapters visuais antigos continuam no repositório. A navegação e o login apresentam apenas MKT Scout.

## Experiência

- Radar automático de sinais atuais, coleta datada, fontes identificadas e busca manual secundária.
- Contextos Share, Aché, Prosper e Potenc.IA em configuração central. São contextos editoriais iniciais, sujeitos a validação pelas marcas.
- Detalhe com fato observado, evidências, limites da leitura de crescimento, fontes, relevância, riscos, oito propostas de formato e direção visual.
- Cada oportunidade traz ângulo, público, objetivo, hook, estrutura, CTA e justificativa.
- Conteúdo gerado apenas por clique. A cópia inclui links das fontes e mantém marca, evidências e oportunidade.
- Gerações salvas são recuperáveis em `/sharetrendintelligence?generation=<uuid>`, somente pela conta que as criou.
- Direção visual com composição, clima, meio, paleta, enquadramento, área livre, elementos a incluir/evitar, textos proibidos e orientações por canal.

## Arquitetura interna

| Etapa | Implementação |
| --- | --- |
| Trend Scout | Adapters independentes, validação Zod, limite de payload, timeout e concorrência limitada |
| Signal Analyst | Deduplicação, associação explícita de notícias pelo feed, agrupamento conservador e score explicado |
| Brand Relevance | Correspondência de temas com configuração central; rotulada como estimativa editorial |
| Content Strategist | Propostas estruturadas por canal, a partir do assunto e contexto da marca |
| Copy Creator | AI SDK 7, ToolLoopAgent, Output.object/Zod e ferramenta restrita às evidências coletadas; fallback editorial identificado |
| Visual Director | Briefing editorial estruturado que funciona sem credenciais de imagem |

Coleta, pontuação, estratégia e briefing são etapas determinísticas. O único agente que usa modelo nesta versão é o Copy Creator, acionado pelo usuário. Isso evita chamadas pagas ao abrir o radar e mantém fatos separados da criação editorial. As propostas determinísticas são pontos de partida para revisão, não uma pesquisa profunda dos artigos.

O modelo usa o resolvedor de credenciais Gemini existente. Ordem: SCOUT_GEMINI_MODEL, GEMINI_MODEL, gemini-3.8-flash (verificado no catálogo e docs instalados). O agente tem três passos máximos, sem retry automático e timeout de 40 segundos. IDs de evidência desconhecidos e links escritos pelo modelo são rejeitados. Links apresentados vêm dos sinais coletados.

## Fontes e fallback

| Fonte | Descoberta / busca | TTL | Janela máxima | Sem chave / falha |
| --- | --- | --- | --- | --- |
| Google Trends BR | RSS de temas em alta e links relacionados; pesquisa filtra a amostra | 20 min | 48 h | Sem chave; manter última coleta ainda recente ou indicar indisponibilidade |
| Agência Brasil / EBC | RSS de últimas notícias com atribuição; pesquisa filtra a amostra | 15 min | 72 h | Sem chave; falha isolada |
| Hacker News | API oficial top stories; Algolia search_by_date para pesquisa | 20 min | 48 h | Sem chave; identificado como comunidade global, falhas parciais informadas |
| YouTube | mostPopular BR; search.list + videos.list para tema | 60 min | 72 h | YOUTUBE_API_KEY opcional; indisponibilidade não interrompe outras fontes |
| Unsplash / Pexels / Pixabay | Adapters visuais existentes, dentro do detalhe | 60 min | Referências, não sinais temporais | Direção visual preservada; busca externa opcional |

Há até quatro requisições de fonte simultâneas, timeout de 6 s por HTTP, orçamento de 20 s por adapter e resposta máxima de 1 MB.
Não há scraping massivo nem conteúdo de bancos de imagem fabricado.
Links de notícias associados pelo Google Trends têm data original nula quando ela não está no feed; não recebem a data do tema como data de publicação.

Verificação real em 02/10/2026 às 07:46 UTC, sem chaves: Trends 40 registros, Agência Brasil 10, Hacker News 12, YouTube indisponível. Analista formou 32 grupos; o radar mostra até 24.

Fontes técnicas: [Google Trends RSS BR](https://trends.google.com/trending/rss?geo=BR), [Agência Brasil RSS](https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml), [Hacker News API](https://github.com/HackerNews/API), [HN Search API](https://hn.algolia.com/api), [YouTube Data API](https://developers.google.com/youtube/v3/docs).

## Score

Pesos de referência: velocidade 30%, recência 20%, volume 20%, diversidade 15%, relevância da marca 15%.
Métricas ausentes têm valor nulo e peso efetivo zero; os demais pesos são renormalizados.

- Velocidade fica indisponível: uma contagem acumulada não comprova crescimento.
- Volume usa o maior indicador normalizado disponível, sem somar buscas, views e pontos.
- Recência usa data original validada, não a data de coleta como substituição.
- Origens repetidas por URL/manchete não contam como confirmação adicional.
- Diversidade não comprova independência editorial nem veracidade.
- O indicador é prioridade editorial, não previsão de viralização. A confiança por fonte é heurística.

## Cache e persistência

Migration aditiva `20261002090000_mkt_scout_records` cria somente `MktScoutRecord` e dois índices. Não modifica tabelas dos outros módulos.
Schema validado e cliente Prisma gerado localmente; migration não executada.

Registros usam hash de tipo/chave/conta, JSON validado, criação, atualização e expiração:
- `source`: sinais e status com primeira/última detecção e métricas; TTL por fonte;
- `trend`: snapshot com score e contexto de marca, retenção lógica de 7 dias; detalhe rejeita evidência vencida;
- `analysis`: briefing e oportunidades, hash de contexto/evidências/versão, TTL 6 h;
- `generation`: UUID antes de chamar o modelo, estado pending/completed, contexto completo, resultado e uso;
- `copy-cache`: ID da geração, isolado por conta; 24 h para IA, 10 min para fallback editorial;
- `references`: resultados visuais por análise, TTL 1 h.

Em falha de fonte, última coleta é usada somente dentro da janela original; nova tentativa após 2 min. O cache não rejuvenesce dados.
Em falha de banco/tabela ausente, há cache de processo limitado a 500 registros e aviso de histórico indisponível. Chamadas pagas não começam sem gravação durável do estado pending. Em desenvolvimento, SCOUT_LOCAL_STORE_DIR permite persistência local explícita para testes; esse fallback é ignorado em produção.

Custo por IA fica nulo quando tarifa real não está disponível, com tokens armazenados. Fallback sem chamada tem custo zero; falha de provider tem custo desconhecido. Não há preço estimado inventado.
Requisições simultâneas idênticas são deduplicadas no processo e gerações recentes são reutilizadas por conta. Não há lock distribuído entre réplicas; isso deve ser considerado ao dimensionar concorrência. Registros expirados não são servidos como atuais; limpeza física periódica pode ser definida posteriormente sem apagar histórico automaticamente.

## Chaves e limites de validação

- Radar público e direção visual funcionam sem API keys.
- YouTube depende de YOUTUBE_API_KEY.
- Referências dependem de pelo menos uma chave UNSPLASH_ACCESS_KEY / PEXELS_API_KEY / PIXABAY_API_KEY.
- Redação por IA depende do Gemini configurado no projeto e armazenamento durável.
- Sem a migration aprovada/aplicada posteriormente, histórico usa fallback de processo e a redação usa o modo editorial.
- Nenhuma chamada real de modelo pago, credencial visual ou banco de produção foi usada no teste.
- A sessão OAuth real e persistência PostgreSQL precisam ser validadas em ambiente isolado com credenciais antes de produção.

## Skills efetivamente usadas

- ai-sdk: documentação instalada, ToolLoopAgent, tool calling e saída estruturada.
- ai-generation-persistence: IDs prévios, snapshots, histórico, cache e tokens.
- agent-browser + agent-browser-verify: navegação e inspeção local desktop/mobile.
- [audit oficial](https://github.com/openai/plugins/blob/main/plugins/product-design/skills/audit/SKILL.md): captura, inspeção e relatório de fluxo.
- nextjs + react-best-practices: fronteiras cliente/servidor, handlers, hooks, requisições e acessibilidade.
- Documentação instalada Next 16.3.3 lida conforme AGENTS.md.
- openai-knowledge foi localizada e consultada; não houve integração com API OpenAI a implementar.
- ai-gateway não foi introduzido: reaproveitamento do Gemini atual dispensa outra infraestrutura.

## Validação

| Verificação | Resultado |
| --- | --- |
| test:mkt-scout | 33 testes passaram |
| typecheck | Passou |
| next build local | Passou; 39 páginas estáticas, rotas dinâmicas compiladas |
| Lint escopo MKT Scout | Passou, zero warnings |
| Lint global | Falha preexistente: 4 erros e 4 warnings fora do Scout |
| prisma validate | Passou; schema válido, nenhuma migration executada |
| git diff --check | Sem erros de whitespace |
| Browser desktop 1440x1000 / mobile 390x844 | Fluxos auditados; sem overflow horizontal ou overlay de erro |
| APIs reais sem sessão | GET radar, GET/POST content retornam 401 |
| Rota visual legada | 307 para MKT Scout |

Falhas globais preservadas: HomeExperience.tsx (import não usado); HumanshipAgendaManager.tsx (Date.now no render e setState em effect); HumanshipR1ShipExperience.tsx (setState em effect); safeStrategicSearch.ts e humanship/service.ts (parâmetros não usados). Os cinco arquivos são idênticos à base desta branch. Não foram editados, conforme a restrição de escopo.

A auditoria completa e evidências estão em MKT_SCOUT_AUDIT.md. Não existe URL de preview publicada. A sessão de desenvolvimento e a rota temporária de QA foram encerradas/removidas antes do build.

## Arquivos

Modificados: package.json, pnpm-lock.yaml, prisma/schema.prisma; páginas sharetrendintelligence, sharevisualscout, share-scout/login; ScoutHeader e TrendIntelligenceClient.

Adicionados:
- src/lib/scout/mkt/{types,brands,sources,signals,analysisTypes,editorial,store,service,copyAgent,generation,http}.ts
- src/app/api/scout/{radar,analysis,content,references}/route.ts
- src/components/scout/{MktScout.module.css,TrendDetail.tsx,SavedGeneration.tsx,scoutClient.ts}
- src/test/{mktSignals.test.ts,mktSources.server.ts,mktScoutWorkflow.server.ts}
- prisma/migrations/20261002090000_mkt_scout_records/migration.sql
- scripts/qa-mkt-scout.mjs
- docs/MKT_SCOUT_DELIVERY.md, docs/MKT_SCOUT_AUDIT.md, docs/PRE_DEPLOY_VALIDATION.md

Nenhum deploy de produção foi realizado.
