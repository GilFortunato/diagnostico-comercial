# Admin do DNA da BU

## Auditoria inicial

Prosper aparecia como regra de produto em alguns pontos:

- `src/lib/tenancy/prosper.ts`: contexto institucional da Prosper.
- `src/lib/tenancy/demo.ts`: lista demo de BUs importando Prosper diretamente.
- `src/components/diagnostics/AuthorityDiagnostic.tsx`: exemplos de formulário e painel visual condicionados a `bu_prosper`.
- `src/lib/diagnostics/authority.ts`: oportunidades, recomendações e plano usando `prosperMode`.
- `src/components/decision-makers/DecisionMakerMapExperience.tsx`: áreas/cargos de decisores fixos para Prosper.
- `src/components/app/HomeExperience.tsx`: Prosper como sinal de primeiro contexto no login.
- `src/test/authority.test.ts`: caso de teste baseado em Prosper.

## Decisão arquitetural

O produto passa a seguir:

`Share AI -> Organização -> Unidade de Negócio -> DNA da BU -> recursos`

Os recursos recebem `businessUnitContext` e não devem fazer `if BU === "Prosper"`.

## Schema atual e evolução

O schema já possuía:

- `Organization`
- `BusinessUnit`
- `BrandPack`
- `Document`
- `Skill`
- registros de execução
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

Conteúdos migrados:

- identidade e brand pack;
- posicionamento;
- produtos: Inic.IA, AI for Business, AI Builders, Potenc.IA;
- ICP principal;
- persona Head de T&D;
- territórios de autoridade;
- DNA editorial;
- afirmações aprovadas/proibidas;
- documentos conhecidos.

## Admin implementado nesta fase

Rota:

- `/admin/business-units`

Funcionalidades visuais/contratuais:

- lista de BUs;
- status ativa/rascunho;
- produtos, ICP e health;
- detalhe da BU selecionada;
- prévia de assistente em 9 etapas;
- painéis de produtos, ICPs, personas, territórios, afirmações e documentos.

Limite real:

- ainda não há persistência de escrita do Admin no banco;
- ainda não há controle de acesso real bloqueando perfis comerciais;
- botões de editar/duplicar/nova BU estão preparados como interface de fundação.

## Reaproveitamento

Reaproveitado:

- `BrandPack` existente;
- `BusinessUnit` existente;
- `Document` existente;
- registros de execução e fontes para rastrear próximas execuções;
- `AuthorityAssessment` para diagnóstico;
- conectores Gemini e Apify já implementados;
- página `/conectores`.

## Próximas fases

1. Criar API Admin para persistir DNA da BU no Neon com RBAC.
2. Criar seed idempotente da Prosper.
3. Ligar seleção de BU, diagnóstico, Mapa de Decisores e Conteúdo ao mesmo repositório de DNA da BU.
4. Implementar draft/published com preview "Testar esta BU".
5. Completar Próxima Melhor Ação usando autoridade, conteúdo, contas e reuniões.
