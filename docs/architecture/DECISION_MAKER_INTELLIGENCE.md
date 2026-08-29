# Decision Maker Intelligence

## Fase 1: auditoria de capacidades

Esta área deve mapear decisores sem parecer uma lista fria de leads. O fluxo precisa responder quem abordar, por que a pessoa é relevante, qual papel provável ela exerce na decisão, qual caminho usar e quais evidências sustentam qualquer abordagem.

## Conectores existentes no projeto

| Capacidade | Conector existente | Cobertura | Limitação | Custo/risco | Recomendação |
| --- | --- | --- | --- | --- | --- |
| `researchCompany` | `harvestapi/linkedin-company` | Dados públicos da página da empresa no LinkedIn. | Depende da URL correta ou de uma etapa anterior de descoberta. | Baixo a moderado quando usado apenas para contas selecionadas. | Reutilizar agora. |
| `findDecisionMakers` | `harvestapi/linkedin-company-employees` | Funcionários por empresa, cargo, localidade e modo de perfil. | Não confirma organograma nem poder real de decisão. | Moderado; limitar resultados antes de enriquecer. | Reutilizar agora. |
| `researchPerson` | `unseenuser/linkedin-profile` | Perfil público informado por URL. | Usar após selecionar poucas pessoas relevantes. | Moderado se enriquecermos muitos perfis. | Reutilizar agora. |
| `researchPerson` | `harvestapi/linkedin-profile-posts` | Posts públicos, temas e sinais de rapport profissional. | Nem todo perfil terá posts suficientes. | Moderado; coletar poucos posts recentes por pessoa selecionada. | Reutilizar agora. |
| `rankDecisionMakers` | Gemini | Classificação de papel provável, aderência, acessibilidade e confiança. | Não pode inventar pessoas, contatos ou evidências. | Controlado por credencial do usuário. | Reutilizar agora. |
| `generateRapport` | Gemini | Ângulos de rapport a partir de evidências profissionais. | Deve separar fato, provável, inferência e não verificado. | Baixo após ranking reduzir pessoas. | Reutilizar agora. |
| `generateApproach` | Gemini | Abordagem por canal, relação e objetivo. | Nunca executar ação externa sem aprovação humana. | Baixo; prévia antes de ação. | Reutilizar agora. |

## Conectores candidatos vistos nos prints

| Capacidade | Conector candidato | Cobertura esperada | Limitação | Custo/risco | Recomendação |
| --- | --- | --- | --- | --- | --- |
| `discoverCompany` | `apify/google-search-scraper` | Pesquisa pública para encontrar site, página LinkedIn, notícias e sinais. | Resultados variam por país, idioma e consulta. | Baixo se `maxPagesPerQuery` ficar em 1 no MVP. | Candidato para Fase 2. |
| `findDecisionMakers` | `harvestapi/linkedin-profile-search` | Busca pessoas por empresa, cargo, localidade e termos. | Pode retornar volume alto; precisa ranking antes de enriquecimento. | Moderado; limitar resultados. | Candidato, sem duplicar `linkedin-company-employees`. |
| `discoverCompany` | `compass/crawler-google-places` | Descoberta de empresas, sites e telefones corporativos públicos. | Mais útil para hunting local/SMB do que conta enterprise já conhecida. | Moderado; não usar para toda busca por padrão. | Futuro, sob demanda. |
| `findProfessionalContacts` | `compass/crawler-google-places` add-ons | Contatos corporativos públicos quando disponíveis. | Não buscar dados pessoais sensíveis; contato exige fonte e verificação. | Alto se add-ons forem ativados sem controle. | Futuro, após controle de custo. |

## Schema reaproveitável

O schema atual já contém `ProspectCompany`, `ProspectPerson`, `ResearchSource`, `RapportReport`, `AidaSequence`, registros de execução, pedidos de aprovação e auditoria. A Fase 2 deve reaproveitar essas entidades antes de criar novas tabelas.

Entidades adicionais só devem entrar quando houver necessidade real:

- `DecisionMakerAnalysis`
- `PersonContact`
- `ContactVerification`
- `RapportAngle`
- `ApproachDraft`
- `AccountResearch`

## Fluxo técnico proposto

1. Receber empresa, BU, objetivo, áreas, cargos e localização opcional.
2. Executar pesquisa barata e limitada para descobrir site, página LinkedIn e sinais públicos.
3. Criar ou reutilizar `ProspectCompany` com `ResearchSource`.
4. Encontrar possíveis pessoas estratégicas com limite de resultados.
5. Ranqueamento inicial sem enriquecimento profundo.
6. Enriquecer apenas top pessoas selecionadas.
7. Gerar Rapport Intelligence com fatos, inferências e itens proibidos.
8. Gerar abordagem somente como preview e exigir aprovação humana antes de qualquer ação externa.

## Guardrails

- Não inferir dados sensíveis.
- Não inventar e-mail, telefone, organograma ou relação hierárquica.
- Não apresentar inferência como fato.
- Não enriquecer grandes listas por padrão.
- Não transformar rapport em pitch disfarçado.
- Registrar fonte, conector, data de coleta, confiança e erro técnico quando houver.
