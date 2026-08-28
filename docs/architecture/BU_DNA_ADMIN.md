# BU DNA Admin

## Auditoria inicial

Prosper aparecia como regra de produto em alguns pontos:

- `src/lib/tenancy/prosper.ts`: contexto institucional da Prosper.
- `src/lib/tenancy/demo.ts`: lista demo de BUs importando Prosper diretamente.
- `src/components/diagnostics/AuthorityDiagnostic.tsx`: exemplos de formulario e painel visual condicionados a `bu_prosper`.
- `src/lib/diagnostics/authority.ts`: oportunidades, recomendacoes e plano usando `prosperMode`.
- `src/components/decision-makers/DecisionMakerMapExperience.tsx`: areas/cargos de decisores fixos para Prosper.
- `src/components/app/HomeExperience.tsx`: Prosper como sinal de primeiro contexto no login.
- `src/test/authority.test.ts`: caso de teste baseado em Prosper.

## Decisao arquitetural

O produto passa a seguir:

`Share AI -> Organization -> BusinessUnit -> BU DNA -> Skills`

Skills recebem `businessUnitContext` e nao devem fazer `if BU === "Prosper"`.

## Schema atual e evolucao

O schema ja possuia:

- `Organization`
- `BusinessUnit`
- `BrandPack`
- `Document`
- `Skill`
- `SkillRun`
- `ProspectCompany`
- `ProspectPerson`
- `ResearchSource`
- `RapportReport`
- `AidaSequence`
- `MeetingBrief`
- `ApprovalRequest`
- `AuditLog`

Foram adicionados ao contrato Prisma:

- `PublicationStatus`
- `BusinessUnitProduct`
- `BusinessUnitIcp`
- `BusinessUnitPersona`
- `BusinessUnitAuthorityTerritory`
- `BusinessUnitContentDna`
- `BusinessUnitClaim`
- campos `publicationStatus` e `dnaVersion` em `BusinessUnit`

Nenhuma tabela existente foi removida e nenhum campo existente foi alterado de forma destrutiva.

## Migração Prosper

O conhecimento atual da Prosper foi consolidado em `src/lib/business-units/dna.ts` como primeira BU publicada. Esse catálogo funciona como seed idempotente até ligarmos o Admin ao Neon.

Conteudos migrados:

- identidade e brand pack;
- posicionamento;
- produtos: Inic.IA, AI for Business, AI Builders, Potenc.IA;
- ICP principal;
- persona Head de T&D;
- territorios de autoridade;
- Content DNA;
- claims aprovados/proibidos;
- documentos conhecidos.

## Admin implementado nesta fase

Rota:

- `/admin/business-units`

Funcionalidades visuais/contratuais:

- lista de BUs;
- status ativa/draft;
- produtos, ICP e health;
- detalhe da BU selecionada;
- preview de wizard em 9 etapas;
- paineis de produtos, ICPs, personas, territorios, claims e documentos.

Limite real:

- ainda nao ha persistencia de escrita do Admin no banco;
- ainda nao ha RBAC real bloqueando comercial;
- botoes de editar/duplicar/nova BU estao preparados como UI de fundacao.

## Reaproveitamento

Reaproveitado:

- `BrandPack` existente;
- `BusinessUnit` existente;
- `Document` existente;
- `SkillRun` e `ResearchSource` para rastrear proximas execucoes;
- `AuthorityAssessment` para diagnostico;
- conectores Gemini e Apify ja implementados;
- pagina `/conectores`.

## Proximas fases

1. Criar API Admin para persistir BU DNA no Neon com RBAC.
2. Criar seed idempotente da Prosper.
3. Ligar seleção de BU, diagnostico, Mapa de Decisores e Conteúdo ao mesmo repositório de BU DNA.
4. Implementar draft/published com preview "Testar esta BU".
5. Completar Next Best Action usando autoridade, conteudo, contas e reunioes.
