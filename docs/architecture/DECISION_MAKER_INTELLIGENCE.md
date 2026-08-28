# Decision Maker Intelligence

## Fase 1: auditoria de capacidades

Esta area deve mapear decisores sem parecer uma lista fria de leads. O fluxo precisa responder quem abordar, por que a pessoa e relevante, qual papel provavel ela exerce na decisao, qual caminho usar e quais evidencias sustentam qualquer abordagem.

## Conectores existentes no projeto

| Capacidade | Actor/conector existente | Cobertura | Limitacao | Custo/risco | Recomendacao |
| --- | --- | --- | --- | --- | --- |
| `researchCompany` | `harvestapi/linkedin-company` | Dados publicos da pagina da empresa no LinkedIn. | Depende da URL correta ou de uma etapa anterior de descoberta. | Baixo a moderado quando usado apenas para contas selecionadas. | Reutilizar agora. |
| `findDecisionMakers` | `harvestapi/linkedin-company-employees` | Funcionarios por empresa, cargo, localidade e modo de perfil. | Nao confirma organograma nem poder real de decisao. | Moderado; limitar resultados antes de enriquecer. | Reutilizar agora. |
| `researchPerson` | `unseenuser/linkedin-profile` | Perfil publico informado por URL. | Usar apos selecionar poucas pessoas relevantes. | Moderado se enriquecermos muitos perfis. | Reutilizar agora. |
| `researchPerson` | `harvestapi/linkedin-profile-posts` | Posts publicos, temas e sinais de rapport profissional. | Nem todo perfil tera posts suficientes. | Moderado; coletar poucos posts recentes por pessoa selecionada. | Reutilizar agora. |
| `rankDecisionMakers` | AI Provider Gemini | Classificacao de papel provavel, fit, acessibilidade e confianca. | Nao pode inventar pessoas, contatos ou evidencias. | Controlado por credencial do usuario. | Reutilizar agora. |
| `generateRapport` | AI Provider Gemini | Angulos de rapport a partir de evidencias profissionais. | Deve separar fato, provavel, inferencia e nao verificado. | Baixo apos ranking reduzir pessoas. | Reutilizar agora. |
| `generateApproach` | AI Provider Gemini | Abordagem por canal, relacao e objetivo. | Nunca executar acao externa sem aprovacao humana. | Baixo; preview antes de acao. | Reutilizar agora. |

## Actors candidatos vistos nos prints

| Capacidade | Actor candidato | Cobertura esperada | Limitacao | Custo/risco | Recomendacao |
| --- | --- | --- | --- | --- | --- |
| `discoverCompany` | `apify/google-search-scraper` | SERP publica para encontrar site, pagina LinkedIn, noticias e sinais. | Resultados variam por pais, idioma e consulta. | Baixo se `maxPagesPerQuery` ficar em 1 no MVP. | Candidato para Fase 2. |
| `findDecisionMakers` | `harvestapi/linkedin-profile-search` | Busca pessoas por empresa, cargo, localidade e termos. | Pode retornar volume alto; precisa ranking antes de enriquecimento. | Moderado; limitar resultados. | Candidato, sem duplicar `linkedin-company-employees`. |
| `discoverCompany` | `compass/crawler-google-places` | Descoberta de empresas, sites e telefones corporativos publicos. | Mais util para hunting local/SMB do que conta enterprise ja conhecida. | Moderado; nao usar para toda busca por padrao. | Futuro, sob demanda. |
| `findProfessionalContacts` | `compass/crawler-google-places` add-ons | Contatos corporativos publicos quando disponiveis. | Nao buscar dados pessoais sensiveis; contato exige fonte e verificacao. | Alto se add-ons forem ativados sem controle. | Futuro, apos controle de custo. |

## Schema reaproveitavel

O schema atual ja contem `ProspectCompany`, `ProspectPerson`, `ResearchSource`, `RapportReport`, `AidaSequence`, `SkillRun`, `ApprovalRequest` e `AuditLog`. A Fase 2 deve reaproveitar essas entidades antes de criar novas tabelas.

Entidades adicionais so devem entrar quando houver necessidade real:

- `DecisionMakerAnalysis`
- `PersonContact`
- `ContactVerification`
- `RapportAngle`
- `ApproachDraft`
- `AccountResearch`

## Fluxo tecnico proposto

1. Receber empresa, BU, objetivo, areas, cargos e localizacao opcional.
2. Executar pesquisa barata e limitada para descobrir site, pagina LinkedIn e sinais publicos.
3. Criar ou reutilizar `ProspectCompany` com `ResearchSource`.
4. Encontrar possiveis pessoas estrategicas com limite de resultados.
5. Ranqueamento inicial sem enriquecimento profundo.
6. Enriquecer apenas top pessoas selecionadas.
7. Gerar Rapport Intelligence com fatos, inferencias e itens proibidos.
8. Gerar abordagem somente como preview e exigir aprovacao humana antes de qualquer acao externa.

## Guardrails

- Nao inferir dados sensiveis.
- Nao inventar e-mail, telefone, organograma ou relacao hierarquica.
- Nao apresentar inferencia como fato.
- Nao enriquecer grandes listas por padrao.
- Nao transformar rapport em pitch disfarçado.
- Registrar fonte, provider, data de coleta, confianca e erro tecnico quando houver.
